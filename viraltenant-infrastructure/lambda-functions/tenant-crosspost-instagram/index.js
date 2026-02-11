/**
 * Instagram Crosspost Lambda
 * 
 * Handles posting to Instagram Business/Creator accounts.
 * Supports image posts and Reels for Shorts.
 * 
 * Now uses Instagram API with Instagram Login (no Facebook Page required!)
 */

const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Helper function to make HTTPS requests (more reliable than fetch in Lambda)
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}



const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.INSTAGRAM_SETTINGS_TABLE;

// ============================================
// POSTING FUNCTIONS (Instagram Graph API)
// ============================================

async function postToInstagram(tenantId, post, settings) {
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
  
  // Build caption with tags
  let caption = `📢 ${post.title}\n\n${post.description}`;
  if (post.tags && post.tags.length > 0) {
    caption += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  if (post.location) {
    caption += `\n\n📍 ${post.location}`;
  }
  
  console.log('Instagram: Posting with accountId:', settings.accountId);
  console.log('Instagram: Image URLs:', imageUrls.length);
  console.log('Instagram: Video URL:', videoUrl);
  
  // For Shorts or videos, upload as Reel
  if (post.isShort && videoUrl) {
    return await uploadReel(settings, caption, videoUrl);
  }
  
  // For regular videos (16:9), also try as Reel
  if (videoUrl) {
    try {
      console.log('Instagram: Attempting to upload video as Reel...');
      return await uploadReel(settings, caption, videoUrl);
    } catch (error) {
      console.log('Instagram: Video upload failed, falling back to carousel/image:', error.message);
    }
  }
  
  // Multiple images - create Carousel post (2-10 images)
  if (imageUrls.length >= 2) {
    console.log('Instagram: Creating carousel with', imageUrls.length, 'images');
    return await uploadCarousel(settings, caption, imageUrls.slice(0, 10)); // Max 10 items
  }
  
  // Single image post
  if (imageUrls.length === 0) {
    throw new Error('Instagram requires an image');
  }
  
  // Step 1: Create media container with retry
  const createUrl = `https://graph.instagram.com/v21.0/${settings.accountId}/media`;
  console.log('Instagram: Creating media container at:', createUrl);
  
  const createResponse = await httpsRequest(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrls[0],
      caption: caption,
      access_token: settings.accessToken
    })
  });
  
  const createText = await createResponse.text();
  console.log('Instagram: Create response:', createResponse.status, createText);
  
  if (!createResponse.ok) {
    let error;
    try { error = JSON.parse(createText); } catch (e) { error = { error: { message: createText } }; }
    throw new Error(error.error?.message || 'Media creation failed');
  }
  
  const createData = JSON.parse(createText);
  const containerId = createData.id;
  console.log('Instagram: Container created:', containerId);
  
  // Step 2: Wait for container to be ready
  await waitForContainer(containerId, settings.accessToken);
  
  // Step 3: Publish media
  return await publishMedia(settings, containerId);
}

/**
 * Upload Instagram Carousel (2-10 images)
 */
async function uploadCarousel(settings, caption, imageUrls) {
  console.log('Instagram: Creating carousel with', imageUrls.length, 'images');
  
  // Step 1: Create child containers for each image
  const childIds = [];
  
  for (const imageUrl of imageUrls) {
    const createResponse = await httpsRequest(`https://graph.instagram.com/v21.0/${settings.accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: settings.accessToken
      })
    });
    
    const createText = await createResponse.text();
    console.log('Instagram: Carousel item response:', createResponse.status);
    
    if (!createResponse.ok) {
      let error;
      try { error = JSON.parse(createText); } catch (e) { error = { error: { message: createText } }; }
      throw new Error(error.error?.message || 'Carousel item creation failed');
    }
    
    const createData = JSON.parse(createText);
    childIds.push(createData.id);
    
    // Wait for each item to be ready
    await waitForContainer(createData.id, settings.accessToken);
  }
  
  console.log('Instagram: Created', childIds.length, 'carousel items');
  
  // Step 2: Create carousel container
  const carouselResponse = await httpsRequest(`https://graph.instagram.com/v21.0/${settings.accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: caption,
      access_token: settings.accessToken
    })
  });
  
  const carouselText = await carouselResponse.text();
  console.log('Instagram: Carousel container response:', carouselResponse.status, carouselText);
  
  if (!carouselResponse.ok) {
    let error;
    try { error = JSON.parse(carouselText); } catch (e) { error = { error: { message: carouselText } }; }
    throw new Error(error.error?.message || 'Carousel creation failed');
  }
  
  const carouselData = JSON.parse(carouselText);
  const carouselId = carouselData.id;
  
  // Wait for carousel to be ready
  await waitForContainer(carouselId, settings.accessToken);
  
  // Step 3: Publish carousel
  const result = await publishMedia(settings, carouselId);
  return { ...result, type: 'carousel', imageCount: imageUrls.length };
}

/**
 * Wait for media container to be ready
 */
async function waitForContainer(containerId, accessToken) {
  let status = 'IN_PROGRESS';
  let attempts = 0;
  const maxAttempts = 15;
  
  while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await httpsRequest(`https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      status = statusData.status_code || 'FINISHED';
      console.log('Instagram: Container status:', status);
    }
    attempts++;
  }
  
  return status;
}

/**
 * Publish media container
 */
async function publishMedia(settings, containerId) {
  const publishUrl = `https://graph.instagram.com/v21.0/${settings.accountId}/media_publish`;
  console.log('Instagram: Publishing media at:', publishUrl);
  
  const publishResponse = await httpsRequest(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: settings.accessToken
    })
  });
  
  const publishText = await publishResponse.text();
  console.log('Instagram: Publish response:', publishResponse.status, publishText);
  
  if (!publishResponse.ok) {
    let error;
    try { error = JSON.parse(publishText); } catch (e) { error = { error: { message: publishText } }; }
    throw new Error(error.error?.message || 'Media publish failed');
  }
  
  const publishData = JSON.parse(publishText);
  return { success: true, mediaId: publishData.id };
}

async function uploadReel(settings, caption, videoUrl) {
  console.log('Instagram: Uploading Reel...');
  console.log('Instagram: Video URL:', videoUrl);
  
  // Create Reel container with retry for transient errors
  const createUrl = `https://graph.instagram.com/v21.0/${settings.accountId}/media`;
  
  let createResponse;
  let createText;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    createResponse = await httpsRequest(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption,
        access_token: settings.accessToken
      })
    });
    
    createText = await createResponse.text();
    console.log('Instagram: Reel create response:', createResponse.status, createText);
    
    // Check for transient error (code 2) and retry
    if (!createResponse.ok) {
      let error;
      try { error = JSON.parse(createText); } catch (e) { error = {}; }
      
      if (error.error?.is_transient || error.error?.code === 2) {
        retryCount++;
        console.log(`Instagram: Transient error, retrying (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
        continue;
      }
    }
    break;
  }
  
  if (!createResponse.ok) {
    let error;
    try { error = JSON.parse(createText); } catch (e) { error = { error: { message: createText } }; }
    throw new Error(error.error?.message || 'Reel creation failed');
  }
  
  const createData = JSON.parse(createText);
  const containerId = createData.id;
  console.log('Instagram: Reel container created:', containerId);
  
  // Wait for processing
  let status = 'IN_PROGRESS';
  let attempts = 0;
  const maxAttempts = 30;
  
  while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await httpsRequest(`https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${settings.accessToken}`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      status = statusData.status_code || 'IN_PROGRESS';
      console.log('Instagram: Reel processing status:', status);
    }
    attempts++;
  }
  
  if (status !== 'FINISHED') {
    throw new Error(`Reel processing failed: ${status}`);
  }
  
  // Publish Reel with retry
  const publishUrl = `https://graph.instagram.com/v21.0/${settings.accountId}/media_publish`;
  
  const publishResponse = await httpsRequest(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: settings.accessToken
    })
  });
  
  const publishText = await publishResponse.text();
  console.log('Instagram: Reel publish response:', publishResponse.status, publishText);
  
  if (!publishResponse.ok) {
    let error;
    try { error = JSON.parse(publishText); } catch (e) { error = { error: { message: publishText } }; }
    throw new Error(error.error?.message || 'Reel publish failed');
  }
  
  const publishData = JSON.parse(publishText);
  return { success: true, reelId: publishData.id };
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

// ============================================
// HANDLER
// ============================================

exports.handler = async (event) => {
  console.log('Instagram Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // Post to Instagram
    if (action === 'post' || (!action && post)) {
      if (!settings?.accessToken || !settings?.accountId) {
        return { statusCode: 400, error: 'Instagram not configured' };
      }
      
      const result = await postToInstagram(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    // Test connection
    if (action === 'test') {
      const testSettings = settings || await getSettings(tenantId);
      const response = await httpsRequest(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${testSettings.accessToken}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Instagram test failed:', errorText);
        throw new Error('Instagram test failed');
      }
      const data = await response.json();
      return { statusCode: 200, success: true, username: data.username };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('Instagram Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
