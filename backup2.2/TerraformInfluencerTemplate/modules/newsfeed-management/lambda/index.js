const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const https = require('https');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const NEWSFEED_TABLE = process.env.NEWSFEED_TABLE_NAME;
const MEDIA_BUCKET = process.env.MEDIA_BUCKET_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';
const SETTINGS_TABLE = process.env.SETTINGS_TABLE_NAME;
const TELEGRAM_SETTINGS_ID = 'telegram-config';

// Helper: Check if user is admin
function isAdmin(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  console.log('isAdmin check - claims:', JSON.stringify(claims));
  
  if (!claims) {
    console.log('isAdmin: No claims found');
    return false;
  }
  
  let groups = claims['cognito:groups'];
  console.log('isAdmin - raw groups:', groups, 'type:', typeof groups);
  
  if (!groups) {
    console.log('isAdmin: No groups found');
    return false;
  }
  
  if (typeof groups === 'string') {
    if (groups.startsWith('[') && groups.endsWith(']')) {
      const groupsStr = groups.slice(1, -1);
      groups = groupsStr.split(',').map(g => g.trim());
      console.log('isAdmin - extracted groups from brackets:', groups);
    } else {
      groups = [groups];
      console.log('isAdmin - single group:', groups);
    }
  }
  
  const result = groups.includes(ADMIN_GROUP);
  console.log('isAdmin result:', result, 'groups:', groups, 'looking for:', ADMIN_GROUP);
  return result;
}

// Helper: CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
}

// Helper: Response
function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

// Helper: Build media URLs
function buildMediaUrls(post) {
  const result = { ...post };
  
  if (post.imageKey) {
    result.imageUrl = `https://${CDN_DOMAIN}/${post.imageKey}`;
  }
  
  if (post.videoKey) {
    result.videoUrl = `https://${CDN_DOMAIN}/${post.videoKey}`;
  }
  
  return result;
}

// Helper: Load Telegram settings from DynamoDB
async function loadTelegramSettings() {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingId: TELEGRAM_SETTINGS_ID }
    }));

    if (!result.Item || !result.Item.enabled) {
      console.log('Telegram integration is disabled or not configured');
      return null;
    }

    if (!result.Item.botToken || !result.Item.chatId) {
      console.log('Telegram bot token or chat ID not configured');
      return null;
    }

    return {
      botToken: result.Item.botToken,
      chatId: result.Item.chatId
    };
  } catch (error) {
    console.error('Error loading Telegram settings:', error);
    return null;
  }
}

// Helper: Escape HTML for Telegram
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: Format post for Telegram
function formatPostMessage(post) {
  let message = `<b>${escapeHtml(post.title)}</b>\n\n`;
  message += `${escapeHtml(post.description)}\n\n`;
  
  if (post.location) {
    message += `📍 ${escapeHtml(post.location)}\n`;
    if (post.locationUrl) {
      message += `🗺️ <a href="${post.locationUrl}">Auf Karte anzeigen</a>\n`;
    }
  }
  
  if (post.externalLink) {
    message += `🔗 <a href="${post.externalLink}">Mehr erfahren</a>\n`;
  }
  
  return message;
}

// Helper: Send Telegram message
async function sendTelegramMessage(botToken, chatId, message, mediaUrl = null, mediaType = null) {
  return new Promise((resolve, reject) => {
    let method = 'sendMessage';
    let body = {
      chat_id: chatId,
      parse_mode: 'HTML'
    };

    // Determine method based on media type
    if (mediaUrl && mediaType === 'photo') {
      method = 'sendPhoto';
      body.photo = mediaUrl;
      body.caption = message;
    } else if (mediaUrl && mediaType === 'video') {
      method = 'sendVideo';
      body.video = mediaUrl;
      body.caption = message;
    } else {
      body.text = message;
    }

    const postData = JSON.stringify(body);
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            console.log('Telegram message sent successfully:', response);
            resolve(response);
          } else {
            console.error('Telegram API error:', response);
            reject(new Error(response.description || 'Unknown Telegram API error'));
          }
        } catch (error) {
          console.error('Failed to parse Telegram response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Helper: Send post to Telegram
async function sendPostToTelegram(post) {
  try {
    // Only send if status is 'published'
    if (post.status !== 'published') {
      console.log('Post is not published, skipping Telegram notification');
      return;
    }

    // Load Telegram settings
    const settings = await loadTelegramSettings();
    if (!settings) {
      console.log('Telegram integration not configured or disabled, skipping');
      return;
    }

    console.log('Sending post to Telegram, chatId:', settings.chatId);

    // Format message
    const message = formatPostMessage(post);

    // Send message with media if available
    if (post.imageKey) {
      const imageUrl = `https://${CDN_DOMAIN}/${post.imageKey}`;
      console.log('Sending photo to Telegram:', imageUrl);
      await sendTelegramMessage(settings.botToken, settings.chatId, message, imageUrl, 'photo');
    } else if (post.videoKey) {
      const videoUrl = `https://${CDN_DOMAIN}/${post.videoKey}`;
      console.log('Sending video to Telegram:', videoUrl);
      await sendTelegramMessage(settings.botToken, settings.chatId, message, videoUrl, 'video');
    } else {
      // Send text-only message
      console.log('Sending text message to Telegram');
      await sendTelegramMessage(settings.botToken, settings.chatId, message);
    }

    console.log('Successfully sent post to Telegram:', post.postId);
  } catch (error) {
    // Don't fail the main request if Telegram fails
    console.error('Failed to send post to Telegram (non-fatal):', error);
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Request Context:', JSON.stringify(event.requestContext, null, 2));

  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || event.requestContext?.routeKey?.split(' ')[0];
  const path = event.requestContext?.http?.path || event.path || event.requestContext?.path || event.rawPath || event.requestContext?.resourcePath;
  
  console.log('Detected method:', method);
  console.log('Detected path:', path);

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  try {
    // GET /newsfeed - List all published posts (public)
    if (method === 'GET' && path === '/newsfeed') {
      const result = await docClient.send(new QueryCommand({
        TableName: NEWSFEED_TABLE,
        IndexName: 'StatusCreatedIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'published'
        },
        ScanIndexForward: false // newest first
      }));

      const posts = (result.Items || []).map(post => buildMediaUrls(post));

      return response(200, { posts });
    }

    // GET /newsfeed/{postId} - Get single post (public)
    if (method === 'GET' && path.startsWith('/newsfeed/') && !path.includes('upload-url')) {
      const postId = path.split('/')[2];

      const result = await docClient.send(new GetCommand({
        TableName: NEWSFEED_TABLE,
        Key: { postId }
      }));

      if (!result.Item) {
        return response(404, { error: 'Post not found' });
      }

      const post = buildMediaUrls(result.Item);

      return response(200, { post });
    }

    // All other routes require admin authentication
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    // POST /newsfeed - Create new post
    if (method === 'POST' && path === '/newsfeed') {
      const body = JSON.parse(event.body);
      const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const post = {
        postId,
        title: body.title,
        description: body.description,
        imageKey: body.imageKey || null,
        videoKey: body.videoKey || null,
        externalLink: body.externalLink || null,
        location: body.location || null,
        locationUrl: body.locationUrl || null,
        status: body.status || 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: NEWSFEED_TABLE,
        Item: post
      }));

      // Send to Telegram if enabled (non-blocking)
      sendPostToTelegram(post).catch(err => {
        console.error('Telegram notification failed (non-fatal):', err);
      });

      return response(201, { post: buildMediaUrls(post) });
    }

    // PUT /newsfeed/{postId} - Update post
    if (method === 'PUT' && path.startsWith('/newsfeed/') && !path.includes('upload-url')) {
      const postId = path.split('/')[2];
      const body = JSON.parse(event.body);

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      if (body.title !== undefined) {
        updateExpression.push('title = :title');
        expressionAttributeValues[':title'] = body.title;
      }
      if (body.description !== undefined) {
        updateExpression.push('description = :description');
        expressionAttributeValues[':description'] = body.description;
      }
      if (body.imageKey !== undefined) {
        updateExpression.push('imageKey = :imageKey');
        expressionAttributeValues[':imageKey'] = body.imageKey;
      }
      if (body.videoKey !== undefined) {
        updateExpression.push('videoKey = :videoKey');
        expressionAttributeValues[':videoKey'] = body.videoKey;
      }
      if (body.externalLink !== undefined) {
        updateExpression.push('externalLink = :externalLink');
        expressionAttributeValues[':externalLink'] = body.externalLink;
      }
      if (body.location !== undefined) {
        updateExpression.push('#location = :location');
        expressionAttributeNames['#location'] = 'location';
        expressionAttributeValues[':location'] = body.location;
      }
      if (body.locationUrl !== undefined) {
        updateExpression.push('locationUrl = :locationUrl');
        expressionAttributeValues[':locationUrl'] = body.locationUrl;
      }
      if (body.status !== undefined) {
        updateExpression.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = body.status;
      }

      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: NEWSFEED_TABLE,
        Key: { postId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      return response(200, { message: 'Post updated' });
    }

    // DELETE /newsfeed/{postId} - Delete post
    if (method === 'DELETE' && path.startsWith('/newsfeed/')) {
      const postId = path.split('/')[2];

      // Get post to delete media
      const result = await docClient.send(new GetCommand({
        TableName: NEWSFEED_TABLE,
        Key: { postId }
      }));

      if (result.Item) {
        // Delete image if exists
        if (result.Item.imageKey) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: result.Item.imageKey
          }));
        }
        
        // Delete video if exists
        if (result.Item.videoKey) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: result.Item.videoKey
          }));
        }
      }

      await docClient.send(new DeleteCommand({
        TableName: NEWSFEED_TABLE,
        Key: { postId }
      }));

      return response(200, { message: 'Post deleted' });
    }

    // POST /newsfeed/upload-url - Generate presigned URL for media upload
    if (method === 'POST' && path === '/newsfeed/upload-url') {
      const body = JSON.parse(event.body);
      const { fileName, fileType, mediaType } = body; // mediaType: 'image' or 'video'

      const prefix = mediaType === 'video' ? 'videos' : 'images';
      const mediaKey = `newsfeed/${prefix}/${Date.now()}_${fileName}`;
      
      const command = new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: mediaKey,
        ContentType: fileType
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return response(200, {
        uploadUrl,
        mediaKey,
        mediaUrl: `https://${CDN_DOMAIN}/${mediaKey}`
      });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
