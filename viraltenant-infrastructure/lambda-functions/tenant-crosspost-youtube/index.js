/**
 * YouTube Crosspost Lambda
 * 
 * Handles OAuth authentication and uploading Shorts to YouTube.
 * Only processes Short posts (9:16 vertical videos).
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });

const SETTINGS_TABLE = process.env.YOUTUBE_SETTINGS_TABLE;

// ============================================
// OAUTH FUNCTIONS
// ============================================

async function handleOAuthCallback(code, redirectUri, tenantId) {
  const settings = await getSettings(tenantId);
  
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('YouTube Client ID und Secret müssen zuerst in den Einstellungen hinterlegt werden');
  }
  
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('client_id', settings.clientId);
  params.append('client_secret', settings.clientSecret);
  params.append('redirect_uri', redirectUri);
  params.append('grant_type', 'authorization_code');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await response.json();
  
  // Get channel info
  const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
  });
  
  if (!channelResponse.ok) {
    throw new Error('Konnte Kanal-Informationen nicht abrufen');
  }
  
  const channelData = await channelResponse.json();
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('Kein YouTube-Kanal gefunden');
  }
  
  const channel = channelData.items[0];
  
  // Save tokens
  await updateSettings(tenantId, {
    ...settings,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    channelId: channel.id,
    channelName: channel.snippet.title,
    enabled: true
  });
  
  return {
    success: true,
    channelId: channel.id,
    channelName: channel.snippet.title
  };
}

async function refreshToken(tenantId) {
  const settings = await getSettings(tenantId);
  
  if (!settings.refreshToken || !settings.clientId || !settings.clientSecret) {
    throw new Error('Refresh token not available');
  }
  
  const params = new URLSearchParams();
  params.append('client_id', settings.clientId);
  params.append('client_secret', settings.clientSecret);
  params.append('refresh_token', settings.refreshToken);
  params.append('grant_type', 'refresh_token');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  const tokenData = await response.json();
  
  await updateSettings(tenantId, {
    ...settings,
    accessToken: tokenData.access_token
  });
  
  return tokenData.access_token;
}

// ============================================
// POSTING FUNCTIONS
// ============================================

async function uploadShort(tenantId, post, settings) {
  if (!post.isShort || !post.videoKey) {
    throw new Error('Only Shorts with video can be uploaded to YouTube');
  }
  
  // Log post data for debugging
  console.log('Post data received:', {
    postId: post.postId,
    title: post.title,
    description: post.description,
    tags: post.tags,
    isShort: post.isShort,
    videoKey: post.videoKey
  });
  
  // Build description with tags - use title as fallback if description is empty
  let description = (post.description && post.description.trim()) || post.title || '';
  
  // Add tags if available
  if (post.tags && post.tags.length > 0) {
    description += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  console.log('Final YouTube description:', description);
  
  // Get video from S3
  console.log('Downloading video from S3:', post.videoKey);
  const s3Response = await s3.send(new GetObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: post.videoKey
  }));
  
  const videoBuffer = await streamToBuffer(s3Response.Body);
  console.log('Video downloaded, size:', videoBuffer.length);
  
  let accessToken = settings.accessToken;
  
  // Initialize resumable upload
  const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': videoBuffer.length.toString()
    },
    body: JSON.stringify({
      snippet: {
        title: post.title,
        description: description,
        categoryId: '22', // People & Blogs
        tags: post.tags && post.tags.length > 0 ? [...post.tags, 'Shorts'] : ['Shorts']
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    })
  });
  
  // Retry with refreshed token if expired
  if (initResponse.status === 401) {
    console.log('YouTube: Token expired, refreshing...');
    accessToken = await refreshToken(tenantId);
    
    const retryResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': videoBuffer.length.toString()
      },
      body: JSON.stringify({
        snippet: {
          title: post.title,
          description: description,
          categoryId: '22',
          tags: post.tags && post.tags.length > 0 ? [...post.tags, 'Shorts'] : ['Shorts']
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      })
    });
    
    if (!retryResponse.ok) {
      const error = await retryResponse.text();
      throw new Error(`YouTube upload init failed: ${error}`);
    }
    
    const uploadUrl = retryResponse.headers.get('location');
    return await uploadVideoToUrl(uploadUrl, videoBuffer, accessToken);
  }
  
  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new Error(`YouTube upload init failed: ${error}`);
  }
  
  const uploadUrl = initResponse.headers.get('location');
  return await uploadVideoToUrl(uploadUrl, videoBuffer, accessToken);
}

async function uploadVideoToUrl(uploadUrl, videoBuffer, accessToken) {
  console.log('Uploading video to YouTube...');
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length.toString()
    },
    body: videoBuffer
  });
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`YouTube upload failed: ${error}`);
  }
  
  const videoData = await uploadResponse.json();
  console.log('YouTube Short uploaded:', videoData.id);
  
  return {
    success: true,
    videoId: videoData.id,
    url: `https://youtube.com/shorts/${videoData.id}`
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function getSettings(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || { tenant_id: tenantId, enabled: false };
  } catch (error) {
    return { tenant_id: tenantId, enabled: false };
  }
}

async function updateSettings(tenantId, settings) {
  const item = {
    ...settings,
    tenant_id: tenantId,
    updated_at: new Date().toISOString()
  };
  await dynamodb.send(new PutCommand({ TableName: SETTINGS_TABLE, Item: item }));
  return item;
}

// ============================================
// HANDLER
// ============================================

exports.handler = async (event) => {
  console.log('YouTube Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // OAuth callback
    if (action === 'oauth_callback') {
      const { code, redirectUri } = event;
      const result = await handleOAuthCallback(code, redirectUri, tenantId);
      return { statusCode: 200, body: JSON.stringify(result) };
    }
    
    // Upload Short
    if (action === 'post' || (!action && post)) {
      if (!post.isShort || !post.videoKey) {
        return { statusCode: 200, skipped: true, reason: 'Not a Short with video' };
      }
      
      if (!settings?.accessToken) {
        return { statusCode: 400, error: 'YouTube not configured' };
      }
      
      const result = await uploadShort(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('YouTube Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
