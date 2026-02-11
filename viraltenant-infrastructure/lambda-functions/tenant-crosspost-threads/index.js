/**
 * Threads Crosspost Lambda
 * 
 * Handles posting to Threads accounts.
 * Supports text posts, image posts, and video posts.
 * 
 * Uses Threads API (graph.threads.net)
 */

const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

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

const SETTINGS_TABLE = process.env.THREADS_SETTINGS_TABLE;

// ============================================
// POSTING FUNCTIONS (Threads API)
// ============================================

async function postToThreads(tenantId, post, settings) {
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
  
  // Build text content
  let text = `${post.title}\n\n${post.description}`;
  if (post.tags && post.tags.length > 0) {
    text += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  // Threads has a 500 character limit
  if (text.length > 500) {
    text = text.substring(0, 497) + '...';
  }
  
  console.log('Threads: Posting with userId:', settings.userId);
  console.log('Threads: Image URLs:', imageUrls.length);
  console.log('Threads: Video URL:', videoUrl);
  
  // Multiple images - create Carousel (2-20 items)
  if (imageUrls.length >= 2) {
    console.log('Threads: Creating carousel with', imageUrls.length, 'images');
    return await uploadCarousel(settings, text, imageUrls.slice(0, 20));
  }
  
  // Determine media type for single media
  let mediaType = 'TEXT';
  let mediaUrl = null;
  
  if (videoUrl) {
    mediaType = 'VIDEO';
    mediaUrl = videoUrl;
  } else if (imageUrls.length === 1) {
    mediaType = 'IMAGE';
    mediaUrl = imageUrls[0];
  }
  
  // Step 1: Create media container
  const createUrl = `https://graph.threads.net/v1.0/${settings.userId}/threads`;
  console.log('Threads: Creating container at:', createUrl);
  
  const createBody = {
    text: text,
    media_type: mediaType,
    access_token: settings.accessToken
  };
  
  if (mediaUrl) {
    if (mediaType === 'IMAGE') {
      createBody.image_url = mediaUrl;
    } else if (mediaType === 'VIDEO') {
      createBody.video_url = mediaUrl;
    }
  }
  
  const createResponse = await httpsRequest(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody)
  });
  
  const createText = await createResponse.text();
  console.log('Threads: Create response:', createResponse.status, createText);
  
  if (!createResponse.ok) {
    let error;
    try { error = JSON.parse(createText); } catch (e) { error = { error: { message: createText } }; }
    throw new Error(error.error?.message || 'Thread creation failed');
  }
  
  const createData = JSON.parse(createText);
  const containerId = createData.id;
  console.log('Threads: Container created:', containerId);
  
  // Step 2: Wait for container to be ready (for video/image)
  if (mediaType !== 'TEXT') {
    await waitForContainer(containerId, settings.accessToken, mediaType === 'VIDEO' ? 30 : 15);
  }
  
  // Step 3: Publish thread
  return await publishThread(settings, containerId);
}

/**
 * Upload Threads Carousel (2-20 images)
 */
async function uploadCarousel(settings, text, imageUrls) {
  console.log('Threads: Creating carousel with', imageUrls.length, 'images');
  
  // Step 1: Create child containers for each image
  const childIds = [];
  
  for (const imageUrl of imageUrls) {
    const createResponse = await httpsRequest(`https://graph.threads.net/v1.0/${settings.userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'IMAGE',
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: settings.accessToken
      })
    });
    
    const createText = await createResponse.text();
    console.log('Threads: Carousel item response:', createResponse.status);
    
    if (!createResponse.ok) {
      let error;
      try { error = JSON.parse(createText); } catch (e) { error = { error: { message: createText } }; }
      console.log('Threads: Carousel item failed:', error.error?.message);
      continue; // Skip failed items
    }
    
    const createData = JSON.parse(createText);
    childIds.push(createData.id);
    
    // Wait for each item to be ready
    await waitForContainer(createData.id, settings.accessToken, 15);
  }
  
  if (childIds.length < 2) {
    throw new Error('Need at least 2 images for carousel');
  }
  
  console.log('Threads: Created', childIds.length, 'carousel items');
  
  // Step 2: Create carousel container
  const carouselResponse = await httpsRequest(`https://graph.threads.net/v1.0/${settings.userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      text: text,
      access_token: settings.accessToken
    })
  });
  
  const carouselText = await carouselResponse.text();
  console.log('Threads: Carousel container response:', carouselResponse.status, carouselText);
  
  if (!carouselResponse.ok) {
    let error;
    try { error = JSON.parse(carouselText); } catch (e) { error = { error: { message: carouselText } }; }
    throw new Error(error.error?.message || 'Carousel creation failed');
  }
  
  const carouselData = JSON.parse(carouselText);
  const carouselId = carouselData.id;
  
  // Wait for carousel to be ready
  await waitForContainer(carouselId, settings.accessToken, 15);
  
  // Step 3: Publish carousel
  const result = await publishThread(settings, carouselId);
  return { ...result, type: 'carousel', imageCount: childIds.length };
}

/**
 * Wait for container to be ready
 */
async function waitForContainer(containerId, accessToken, maxAttempts = 15) {
  let status = 'IN_PROGRESS';
  let attempts = 0;
  
  while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await httpsRequest(
      `https://graph.threads.net/v1.0/${containerId}?fields=status&access_token=${accessToken}`
    );
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      status = statusData.status || 'FINISHED';
      console.log('Threads: Container status:', status);
    }
    attempts++;
  }
  
  if (status === 'ERROR') {
    throw new Error('Thread media processing failed');
  }
  
  return status;
}

/**
 * Publish thread
 */
async function publishThread(settings, containerId) {
  const publishUrl = `https://graph.threads.net/v1.0/${settings.userId}/threads_publish`;
  console.log('Threads: Publishing at:', publishUrl);
  
  const publishResponse = await httpsRequest(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: settings.accessToken
    })
  });
  
  const publishText = await publishResponse.text();
  console.log('Threads: Publish response:', publishResponse.status, publishText);
  
  if (!publishResponse.ok) {
    let error;
    try { error = JSON.parse(publishText); } catch (e) { error = { error: { message: publishText } }; }
    throw new Error(error.error?.message || 'Thread publish failed');
  }
  
  const publishData = JSON.parse(publishText);
  return { success: true, threadId: publishData.id };
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
  console.log('Threads Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // Post to Threads
    if (action === 'post' || (!action && post)) {
      if (!settings?.accessToken || !settings?.userId) {
        return { statusCode: 400, error: 'Threads not configured' };
      }
      
      const result = await postToThreads(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    // Test connection
    if (action === 'test') {
      const testSettings = settings || await getSettings(tenantId);
      const response = await httpsRequest(
        `https://graph.threads.net/v1.0/me?fields=username&access_token=${testSettings.accessToken}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Threads test failed:', errorText);
        throw new Error('Threads test failed');
      }
      const data = await response.json();
      return { statusCode: 200, success: true, username: data.username };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('Threads Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
