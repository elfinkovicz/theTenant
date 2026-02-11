/**
 * X (Twitter) Crosspost Lambda
 * 
 * Handles posting to X/Twitter with OAuth 1.0a.
 * Supports images and videos (including Shorts) up to 512MB.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });

const SETTINGS_TABLE = process.env.XTWITTER_SETTINGS_TABLE;

// ============================================
// OAUTH FUNCTIONS
// ============================================

async function handleOAuthCallback(code, redirectUri, codeVerifier, tenantId) {
  const settings = await getSettings(tenantId);
  
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('X Client ID und Secret müssen zuerst in den Einstellungen hinterlegt werden');
  }
  
  const credentials = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
  
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri);
  params.append('code_verifier', codeVerifier);
  
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || errorData.error || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await response.json();
  
  // Get user info
  const userResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
  });
  
  if (!userResponse.ok) {
    throw new Error('Konnte Benutzer-Informationen nicht abrufen');
  }
  
  const userData = await userResponse.json();
  
  // Save tokens
  await updateSettings(tenantId, {
    ...settings,
    oauth2AccessToken: tokenData.access_token,
    oauth2RefreshToken: tokenData.refresh_token,
    userId: userData.data.id,
    accountName: userData.data.username,
    enabled: true
  });
  
  return {
    success: true,
    username: userData.data.username,
    userId: userData.data.id
  };
}

async function refreshToken(tenantId) {
  const settings = await getSettings(tenantId);
  
  if (!settings.oauth2RefreshToken || !settings.clientId || !settings.clientSecret) {
    console.log('X: Refresh token not available - missing credentials');
    throw new Error('Refresh token not available - User needs to re-authenticate');
  }
  
  console.log('X: Attempting token refresh...');
  console.log('X: Refresh token (first 20 chars):', settings.oauth2RefreshToken.substring(0, 20) + '...');
  console.log('X: Client ID:', settings.clientId.substring(0, 10) + '...');
  
  const credentials = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
  const params = new URLSearchParams();
  params.append('refresh_token', settings.oauth2RefreshToken);
  params.append('grant_type', 'refresh_token');
  params.append('client_id', settings.clientId); // Twitter sometimes requires this in body too
  
  console.log('X: Token refresh request - Authorization header present: true');
  
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: params.toString()
  });
  
  const responseText = await response.text();
  console.log('X: Token refresh response status:', response.status);
  console.log('X: Token refresh response:', responseText);
  
  if (!response.ok) {
    // Parse error for more details
    let errorDetail = 'Token refresh failed';
    try {
      const errorData = JSON.parse(responseText);
      errorDetail = errorData.error_description || errorData.error || errorDetail;
      console.log('X: Token refresh error detail:', errorDetail);
      
      // If refresh token is invalid/expired, user needs to re-authenticate
      if (errorData.error === 'invalid_grant' || errorData.error === 'invalid_request') {
        errorDetail = 'X-Verbindung abgelaufen - Bitte erneut mit X verbinden';
      }
    } catch (e) {
      // ignore parse error
    }
    throw new Error(errorDetail);
  }
  
  const tokenData = JSON.parse(responseText);
  console.log('X: Token refresh successful, new access token received');
  
  await updateSettings(tenantId, {
    ...settings,
    oauth2AccessToken: tokenData.access_token,
    oauth2RefreshToken: tokenData.refresh_token || settings.oauth2RefreshToken
  });
  
  return tokenData.access_token;
}

// ============================================
// POSTING FUNCTIONS
// ============================================

/**
 * Generate OAuth 1.0a signature for Twitter API
 */
function generateOAuth1Signature(method, url, params, settings) {
  const oauth = {
    oauth_consumer_key: settings.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: settings.accessToken,
    oauth_version: '1.0'
  };
  
  // Combine OAuth params with request params for signature
  const allParams = { ...oauth, ...params };
  
  // Sort and encode all parameters
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');
  
  // Create signature base string
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  
  // Create signing key
  const signingKey = `${encodeURIComponent(settings.apiSecret)}&${encodeURIComponent(settings.accessTokenSecret)}`;
  
  // Generate signature
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  
  console.log('X: OAuth Debug - Method:', method);
  console.log('X: OAuth Debug - URL:', url);
  console.log('X: OAuth Debug - Timestamp:', oauth.oauth_timestamp);
  console.log('X: OAuth Debug - Consumer Key:', settings.apiKey.substring(0, 8) + '...');
  console.log('X: OAuth Debug - Token:', settings.accessToken.substring(0, 15) + '...');
  
  // Build Authorization header (only oauth_ params, not request params)
  const authHeader = 'OAuth ' + Object.keys(oauth)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
    .join(', ');
  
  return authHeader;
}

async function uploadMediaOAuth1(settings, mediaBuffer, isVideo = false) {
  if (!settings.apiKey || !settings.apiSecret || !settings.accessToken || !settings.accessTokenSecret) {
    console.log('X: OAuth 1.0a credentials not available for media upload');
    return null;
  }
  
  const sizeMB = mediaBuffer.length / (1024 * 1024);
  console.log('X: Uploading media, size:', sizeMB.toFixed(2), 'MB, isVideo:', isVideo);
  
  // For videos or large files (>5MB), use chunked upload
  if (isVideo || sizeMB > 5) {
    return await chunkedMediaUpload(settings, mediaBuffer, isVideo);
  }
  
  // Simple upload for small images using base64
  const imgBase64 = mediaBuffer.toString('base64');
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  
  // For media_data uploads, the media_data is NOT included in signature
  // Only OAuth params are signed for multipart/form-data style uploads
  const authHeader = generateOAuth1Signature('POST', url, {}, settings);
  
  console.log('X: Attempting simple media upload...');
  
  const mediaResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `media_data=${encodeURIComponent(imgBase64)}`
  });
  
  if (mediaResponse.ok) {
    const mediaData = await mediaResponse.json();
    console.log('X: Media uploaded successfully, media_id:', mediaData.media_id_string);
    return mediaData.media_id_string;
  } else {
    const errorText = await mediaResponse.text();
    console.log('X: Media upload failed:', mediaResponse.status, errorText);
    
    // If 401, try with media in multipart form
    if (mediaResponse.status === 401 || mediaResponse.status === 400) {
      console.log('X: Trying multipart upload method...');
      return await uploadMediaMultipart(settings, mediaBuffer);
    }
    return null;
  }
}

async function uploadMediaMultipart(settings, mediaBuffer) {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const boundary = '----TwitterBoundary' + crypto.randomBytes(8).toString('hex');
  
  // For multipart, OAuth params only (no body params in signature)
  const authHeader = generateOAuth1Signature('POST', url, {}, settings);
  
  // Build multipart body
  const parts = [];
  parts.push(`--${boundary}\r\n`);
  parts.push(`Content-Disposition: form-data; name="media"\r\n\r\n`);
  
  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, mediaBuffer, footer]);
  
  const mediaResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  });
  
  if (mediaResponse.ok) {
    const mediaData = await mediaResponse.json();
    console.log('X: Multipart media uploaded, media_id:', mediaData.media_id_string);
    return mediaData.media_id_string;
  } else {
    const errorText = await mediaResponse.text();
    console.log('X: Multipart upload also failed:', mediaResponse.status, errorText);
    return null;
  }
}

// Chunked media upload for videos (up to 512MB)
async function chunkedMediaUpload(settings, mediaBuffer, isVideo) {
  const totalBytes = mediaBuffer.length;
  const sizeMB = totalBytes / (1024 * 1024);
  const mediaType = isVideo ? 'video/mp4' : 'image/jpeg';
  const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  
  console.log(`X: Starting chunked upload for ${isVideo ? 'video' : 'image'}: ${sizeMB.toFixed(1)}MB`);
  
  // Check size limit (512MB for videos)
  if (sizeMB > 512) {
    console.log('X: Media too large (max 512MB)');
    return null;
  }
  
  try {
    // INIT - params go in body AND signature
    const initParams = {
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: mediaType,
      media_category: mediaCategory
    };
    
    const initAuthHeader = generateOAuth1Signature('POST', url, initParams, settings);
    
    const initResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': initAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(initParams).toString()
    });
    
    if (!initResponse.ok) {
      const error = await initResponse.text();
      console.log('X: INIT failed:', initResponse.status, error);
      return null;
    }
    
    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;
    console.log('X: INIT success, media_id:', mediaId);
    
    // APPEND (in chunks of 5MB)
    const chunkSize = 5 * 1024 * 1024;
    let segmentIndex = 0;
    
    for (let offset = 0; offset < totalBytes; offset += chunkSize) {
      const chunk = mediaBuffer.slice(offset, Math.min(offset + chunkSize, totalBytes));
      const chunkBase64 = chunk.toString('base64');
      
      // For APPEND, media_data is NOT in signature (too large)
      const appendParams = {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: segmentIndex.toString()
      };
      
      const appendAuthHeader = generateOAuth1Signature('POST', url, appendParams, settings);
      
      const appendResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': appendAuthHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `command=APPEND&media_id=${mediaId}&segment_index=${segmentIndex}&media_data=${encodeURIComponent(chunkBase64)}`
      });
      
      if (!appendResponse.ok) {
        const error = await appendResponse.text();
        console.log(`X: APPEND segment ${segmentIndex} failed:`, appendResponse.status, error);
        return null;
      }
      
      console.log(`X: APPEND segment ${segmentIndex} success (${(chunk.length / 1024 / 1024).toFixed(1)}MB)`);
      segmentIndex++;
    }
    
    // FINALIZE
    const finalizeParams = {
      command: 'FINALIZE',
      media_id: mediaId
    };
    
    const finalizeAuthHeader = generateOAuth1Signature('POST', url, finalizeParams, settings);
    
    const finalizeResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': finalizeAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(finalizeParams).toString()
    });
    
    if (!finalizeResponse.ok) {
      const error = await finalizeResponse.text();
      console.log('X: FINALIZE failed:', finalizeResponse.status, error);
      return null;
    }
    
    const finalizeData = await finalizeResponse.json();
    console.log('X: FINALIZE success');
    
    // Check processing status for videos
    if (finalizeData.processing_info) {
      console.log('X: Video processing started...');
      let checkAfterSecs = finalizeData.processing_info.check_after_secs || 5;
      
      while (true) {
        await new Promise(resolve => setTimeout(resolve, checkAfterSecs * 1000));
        
        const statusParams = { command: 'STATUS', media_id: mediaId };
        const statusAuthHeader = generateOAuth1Signature('GET', url, statusParams, settings);
        
        const statusResponse = await fetch(`${url}?command=STATUS&media_id=${mediaId}`, {
          method: 'GET',
          headers: {
            'Authorization': statusAuthHeader
          }
        });
        
        if (!statusResponse.ok) {
          console.log('X: STATUS check failed');
          break;
        }
        
        const statusData = await statusResponse.json();
        const state = statusData.processing_info?.state;
        
        console.log(`X: Processing state: ${state}`);
        
        if (state === 'succeeded') {
          console.log('X: Video processing complete');
          return mediaId;
        } else if (state === 'failed') {
          console.log('X: Video processing failed:', statusData.processing_info?.error);
          return null;
        }
        
        checkAfterSecs = statusData.processing_info?.check_after_secs || 5;
        
        // Timeout after 5 minutes
        if (checkAfterSecs > 300) break;
      }
    }
    
    return mediaId;
  } catch (error) {
    console.error('X: Chunked upload error:', error.message);
    return null;
  }
}

async function postTweet(tenantId, post, settings) {
  // Get tenant subdomain for newsfeed link
  let newsfeedUrl = '';
  let subdomain = tenantId;
  try {
    const tenantResult = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    subdomain = tenantResult.Item?.subdomain || tenantId;
    newsfeedUrl = `https://${subdomain}.viraltenant.com`;
  } catch (e) {
    newsfeedUrl = `https://${tenantId}.viraltenant.com`;
  }
  
  // Build tweet text - simpler format
  let tweetText = post.title || '';
  if (post.description) {
    tweetText += `\n\n${post.description}`;
  }
  if (post.tags && post.tags.length > 0) {
    tweetText += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  // Always add newsfeed link
  tweetText += `\n\n${newsfeedUrl}`;
  
  if (tweetText.length > 280) {
    tweetText = tweetText.substring(0, 277) + '...';
  }
  
  // Get first image (X/Twitter Free tier only supports 1 image per tweet)
  let imageKey = null;
  let imageUrl = null;
  if (post.imageKeys && post.imageKeys.length > 0) {
    imageKey = post.imageKeys[0];
    imageUrl = post.imageUrls?.[0] || `https://${process.env.CLOUDFRONT_DOMAIN}/${imageKey}`;
  } else if (post.imageKey) {
    imageKey = post.imageKey;
    imageUrl = post.imageUrl || `https://${process.env.CLOUDFRONT_DOMAIN}/${imageKey}`;
  } else if (post.imageUrl) {
    imageUrl = post.imageUrl;
  }
  
  const imageCount = (post.imageUrls?.length || 0) || (post.imageKeys?.length || 0) || (post.imageUrl ? 1 : 0);
  if (imageCount > 1) {
    console.log(`X: Note - Only posting first image (${imageCount} images in post, X Free tier limitation)`);
  }
  
  console.log('X: Post data received:', JSON.stringify({ 
    hasVideoKey: !!post.videoKey, 
    hasVideoUrl: !!post.videoUrl,
    hasImageKey: !!imageKey,
    hasImageUrl: !!imageUrl,
    isShort: post.isShort,
    totalImages: imageCount
  }));
  
  // Upload media - prioritize video over thumbnail (like YouTube)
  let mediaId = null;
  
  // For Shorts/Videos: Try videoKey first, then videoUrl
  if (post.videoKey || post.videoUrl) {
    // Try S3 direct access first (if videoKey available)
    if (post.videoKey) {
      try {
        console.log('X: Loading video from S3:', post.videoKey);
        const s3Response = await s3.send(new GetObjectCommand({
          Bucket: process.env.ASSETS_BUCKET,
          Key: post.videoKey
        }));
        const videoBuffer = await streamToBuffer(s3Response.Body);
        console.log('X: Video loaded from S3, size:', (videoBuffer.length / (1024 * 1024)).toFixed(1), 'MB');
        mediaId = await uploadMediaOAuth1(settings, videoBuffer, true);
      } catch (videoError) {
        console.log('X: S3 video load error:', videoError.message);
      }
    }
    
    // Fallback to videoUrl (CloudFront URL)
    if (!mediaId) {
      const videoUrl = post.videoUrl || `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}`;
      try {
        console.log('X: Downloading video from URL:', videoUrl);
        const videoResponse = await fetch(videoUrl);
        if (videoResponse.ok) {
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          console.log('X: Video downloaded, size:', (videoBuffer.length / (1024 * 1024)).toFixed(1), 'MB');
          mediaId = await uploadMediaOAuth1(settings, videoBuffer, true);
        } else {
          console.log('X: Video download failed:', videoResponse.status);
        }
      } catch (e) {
        console.log('X: Video URL download failed:', e.message);
      }
    }
  }
  
  // If no video or video upload failed, try image
  if (!mediaId && (imageKey || imageUrl)) {
    // Try S3 direct access first
    if (imageKey) {
      try {
        console.log('X: Loading image from S3:', imageKey);
        const s3Response = await s3.send(new GetObjectCommand({
          Bucket: process.env.ASSETS_BUCKET,
          Key: imageKey
        }));
        const imgBuffer = await streamToBuffer(s3Response.Body);
        console.log('X: Image loaded from S3, size:', (imgBuffer.length / 1024).toFixed(1), 'KB');
        mediaId = await uploadMediaOAuth1(settings, imgBuffer, false);
      } catch (imgError) {
        console.log('X: S3 image load error:', imgError.message);
      }
    }
    
    // Fallback to imageUrl
    if (!mediaId && imageUrl) {
      try {
        console.log('X: Downloading image from URL:', imageUrl);
        const imgResponse = await fetch(imageUrl);
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          console.log('X: Image downloaded, size:', (imgBuffer.length / 1024).toFixed(1), 'KB');
          mediaId = await uploadMediaOAuth1(settings, imgBuffer, false);
        }
      } catch (e) {
        console.log('X: Image URL download failed:', e.message);
      }
    }
  }
  
  // Post tweet with OAuth 1.0a (always use this now)
  console.log('X: Posting tweet, hasMedia:', !!mediaId, 'isShort:', post.isShort);
  return await postTweetOAuth1(settings, tweetText, mediaId);
}

/**
 * Post tweet using OAuth 1.0a with v2 API - works with media
 */
async function postTweetOAuth1(settings, text, mediaId) {
  // Twitter Free Tier: Use v2 API for tweets, but with OAuth 1.0a auth
  const url = 'https://api.twitter.com/2/tweets';
  
  const tweetPayload = { text: text };
  if (mediaId) {
    tweetPayload.media = { media_ids: [mediaId] };
  }
  
  // Generate OAuth 1.0a signature for v2 endpoint (no body params in signature for JSON)
  const authHeader = generateOAuth1Signature('POST', url, {}, settings);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tweetPayload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log('X: OAuth 1.0a v2 tweet failed:', response.status, errorText);
    
    let errorMessage = `Tweet failed: ${response.status}`;
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.title || errorMessage;
      if (errorData.errors && errorData.errors.length > 0) {
        errorMessage = errorData.errors[0].message || errorMessage;
      }
    } catch (e) {
      // ignore parse error
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  console.log('X: Tweet posted successfully via OAuth 1.0a + v2 API, id:', data.data?.id);
  return { success: true, tweetId: data.data?.id };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert S3 stream to Buffer
 */
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
  console.log('X/Twitter Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // OAuth callback
    if (action === 'oauth_callback') {
      const { code, redirectUri, codeVerifier } = event;
      const result = await handleOAuthCallback(code, redirectUri, codeVerifier, tenantId);
      return { statusCode: 200, body: JSON.stringify(result) };
    }
    
    // Post to X
    if (action === 'post' || (!action && post)) {
      if (!settings?.oauth2AccessToken && !settings?.accessToken) {
        return { statusCode: 400, error: 'X not configured' };
      }
      
      const result = await postTweet(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    // Test connection
    if (action === 'test') {
      const testSettings = settings || await getSettings(tenantId);
      
      // Check if OAuth 1.0a credentials are configured
      if (!testSettings.apiKey || !testSettings.apiSecret || !testSettings.accessToken || !testSettings.accessTokenSecret) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ 
            error: 'X API Keys nicht vollständig konfiguriert. Bitte alle 4 Keys eingeben.' 
          }) 
        };
      }
      
      // Test by verifying credentials with Twitter API
      try {
        const url = 'https://api.twitter.com/2/users/me';
        const authHeader = generateOAuth1Signature('GET', url, {}, testSettings);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': authHeader }
        });
        
        if (response.ok) {
          const userData = await response.json();
          return { 
            statusCode: 200, 
            body: JSON.stringify({ 
              success: true, 
              message: `Verbunden als @${userData.data.username}`,
              username: userData.data.username
            }) 
          };
        } else {
          const errorText = await response.text();
          console.log('X: Test failed:', response.status, errorText);
          return { 
            statusCode: 400, 
            body: JSON.stringify({ 
              error: 'X API Authentifizierung fehlgeschlagen. Bitte Keys überprüfen.' 
            }) 
          };
        }
      } catch (error) {
        console.error('X: Test error:', error.message);
        return { 
          statusCode: 500, 
          body: JSON.stringify({ error: error.message }) 
        };
      }
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('X/Twitter Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
