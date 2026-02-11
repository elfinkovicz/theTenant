/**
 * Facebook Crosspost Lambda
 * 
 * Handles OAuth authentication and posting to Facebook Pages.
 * Supports regular posts and Reels for Shorts.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.FACEBOOK_SETTINGS_TABLE;
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

// ============================================
// OAUTH FUNCTIONS
// ============================================

async function handleOAuthCallback(code, redirectUri, tenantId) {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('Meta App nicht konfiguriert.');
  }
  
  // Exchange code for token
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`;
  
  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    throw new Error(errorData.error?.message || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await tokenResponse.json();
  let accessToken = tokenData.access_token;
  
  // Get long-lived token
  const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${accessToken}`;
  const longLivedResponse = await fetch(longLivedUrl);
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
  }
  
  // Get user's pages
  const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
  if (!pagesResponse.ok) {
    throw new Error('Konnte Facebook-Seiten nicht abrufen');
  }
  
  const pagesData = await pagesResponse.json();
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('Keine Facebook-Seiten gefunden.');
  }
  
  const page = pagesData.data[0];
  
  // Save settings
  const settings = await getSettings(tenantId);
  await updateSettings(tenantId, {
    ...settings,
    pageAccessToken: page.access_token,
    pageId: page.id,
    pageName: page.name,
    enabled: true
  });
  
  return {
    success: true,
    pageId: page.id,
    pageName: page.name
  };
}

// ============================================
// POSTING FUNCTIONS
// ============================================

async function postToFacebook(tenantId, post, settings) {
  // Get all media URLs
  const imageUrls = [];
  if (post.imageUrls && post.imageUrls.length > 0) {
    imageUrls.push(...post.imageUrls);
  } else if (post.imageKeys && post.imageKeys.length > 0) {
    imageUrls.push(...post.imageKeys.map(key => `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`));
  } else if (post.imageUrl) {
    imageUrls.push(post.imageUrl);
  } else if (post.imageKey) {
    imageUrls.push(`https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}`);
  }
  
  const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
  
  // Build message with tags
  let message = `📢 ${post.title}\n\n${post.description}`;
  if (post.tags && post.tags.length > 0) {
    message += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  if (post.location) {
    message += `\n\n📍 ${post.location}`;
  }
  if (post.externalLink) {
    message += `\n\n🔗 ${post.externalLink}`;
  }
  
  console.log('Facebook: Image URLs:', imageUrls.length);
  console.log('Facebook: Video URL:', videoUrl);
  
  // For Shorts, try to upload as Reel
  if (post.isShort && videoUrl) {
    return await uploadReel(settings, message, videoUrl, post.title);
  }
  
  // For regular videos (16:9), upload as Facebook Video
  if (videoUrl) {
    try {
      console.log('Facebook: Uploading 16:9 video...');
      return await uploadVideo(settings, message, videoUrl);
    } catch (error) {
      console.log('Facebook: Video upload failed, falling back to images:', error.message);
      // Fall through to image post
    }
  }
  
  // Multiple images - create multi-photo post
  if (imageUrls.length >= 2) {
    console.log('Facebook: Creating multi-photo post with', imageUrls.length, 'images');
    return await uploadMultiPhoto(settings, message, imageUrls);
  }
  
  // Regular post with single image or link
  let endpoint = `https://graph.facebook.com/v18.0/${settings.pageId}/feed`;
  let body = { message, access_token: settings.pageAccessToken };
  
  if (imageUrls.length === 1) {
    endpoint = `https://graph.facebook.com/v18.0/${settings.pageId}/photos`;
    body.url = imageUrls[0];
  } else if (post.externalLink) {
    body.link = post.externalLink;
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Facebook post failed: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, postId: data.id || data.post_id };
}

/**
 * Upload multiple photos as a single Facebook post
 */
async function uploadMultiPhoto(settings, message, imageUrls) {
  // Step 1: Upload each photo as unpublished
  const photoIds = [];
  
  for (const imageUrl of imageUrls) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${settings.pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrl,
        published: false, // Don't publish individually
        access_token: settings.pageAccessToken
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('Facebook: Photo upload failed:', error.error?.message);
      continue; // Skip failed uploads
    }
    
    const data = await response.json();
    photoIds.push(data.id);
    console.log('Facebook: Uploaded photo:', data.id);
  }
  
  if (photoIds.length === 0) {
    throw new Error('No photos could be uploaded');
  }
  
  // Step 2: Create post with attached photos
  const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
  
  const response = await fetch(`https://graph.facebook.com/v18.0/${settings.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      attached_media: attachedMedia,
      access_token: settings.pageAccessToken
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Multi-photo post failed');
  }
  
  const data = await response.json();
  return { success: true, postId: data.id, type: 'multi-photo', imageCount: photoIds.length };
}

async function uploadReel(settings, description, videoUrl, title) {
  console.log('Uploading Facebook Reel...');
  
  // Initialize upload
  const initResponse = await fetch(`https://graph.facebook.com/v18.0/${settings.pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'start',
      access_token: settings.pageAccessToken
    })
  });
  
  if (!initResponse.ok) {
    // Fallback to regular video post
    console.log('Reels not available, falling back to video post');
    return await uploadVideo(settings, description, videoUrl);
  }
  
  const initData = await initResponse.json();
  const videoId = initData.video_id;
  
  // Upload video
  const uploadResponse = await fetch(`https://rupload.facebook.com/video-upload/v18.0/${videoId}`, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${settings.pageAccessToken}`,
      'file_url': videoUrl
    }
  });
  
  if (!uploadResponse.ok) {
    throw new Error('Video upload failed');
  }
  
  // Finish upload
  const finishResponse = await fetch(`https://graph.facebook.com/v18.0/${settings.pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'finish',
      video_id: videoId,
      video_state: 'PUBLISHED',
      description: description,
      access_token: settings.pageAccessToken
    })
  });
  
  if (!finishResponse.ok) {
    const error = await finishResponse.json();
    throw new Error(error.error?.message || 'Reel publish failed');
  }
  
  const data = await finishResponse.json();
  return { success: true, reelId: data.id || videoId };
}

async function uploadVideo(settings, description, videoUrl) {
  const response = await fetch(`https://graph.facebook.com/v18.0/${settings.pageId}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_url: videoUrl,
      description: description,
      access_token: settings.pageAccessToken
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Video upload failed');
  }
  
  const data = await response.json();
  return { success: true, videoId: data.id };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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
  console.log('Facebook Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // OAuth callback
    if (action === 'oauth_callback') {
      const { code, redirectUri } = event;
      const result = await handleOAuthCallback(code, redirectUri, tenantId);
      return { statusCode: 200, body: JSON.stringify(result) };
    }
    
    // Post to Facebook
    if (action === 'post' || (!action && post)) {
      if (!settings?.pageAccessToken || !settings?.pageId) {
        return { statusCode: 400, error: 'Facebook not configured' };
      }
      
      const result = await postToFacebook(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    // Test connection
    if (action === 'test') {
      const testSettings = settings || await getSettings(tenantId);
      const response = await fetch(`https://graph.facebook.com/v18.0/${testSettings.pageId}?access_token=${testSettings.pageAccessToken}`);
      if (!response.ok) throw new Error('Facebook test failed');
      const data = await response.json();
      return { statusCode: 200, success: true, pageName: data.name };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('Facebook Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
