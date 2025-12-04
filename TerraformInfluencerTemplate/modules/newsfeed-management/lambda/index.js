const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const NEWSFEED_TABLE = process.env.NEWSFEED_TABLE_NAME;
const MEDIA_BUCKET = process.env.MEDIA_BUCKET_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

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
