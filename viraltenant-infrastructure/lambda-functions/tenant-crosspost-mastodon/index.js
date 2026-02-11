/**
 * Mastodon Crosspost Lambda
 * 
 * Posts content to Mastodon instances.
 * Supports text posts with images and media attachments.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// Upload media to Mastodon (images and videos)
async function uploadMedia(instanceUrl, accessToken, mediaUrl, description, isVideo = false) {
  try {
    console.log(`Downloading ${isVideo ? 'video' : 'image'} from:`, mediaUrl);
    
    // Download media
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      console.log('Failed to download media:', mediaResponse.status, mediaResponse.statusText);
      return null;
    }
    
    const contentType = mediaResponse.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');
    const buffer = await mediaResponse.arrayBuffer();
    const sizeMB = buffer.byteLength / (1024 * 1024);
    
    console.log(`Downloaded ${isVideo ? 'video' : 'image'}: ${sizeMB.toFixed(2)}MB, type: ${contentType}`);
    
    // Check size limit (40MB for most instances)
    if (sizeMB > 40) {
      console.log(`Media too large: ${sizeMB.toFixed(1)}MB (limit: 40MB)`);
      return null;
    }
    
    console.log(`Uploading ${isVideo ? 'video' : 'image'} to Mastodon: ${sizeMB.toFixed(2)}MB`);
    
    // Create multipart form data manually (no external dependency)
    const boundary = '----MastodonUpload' + Date.now();
    const filename = isVideo ? 'video.mp4' : 'image.jpg';
    
    // Build multipart body
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    body += `Content-Type: ${contentType}\r\n\r\n`;
    
    // Convert to buffer with binary data
    const headerBuffer = Buffer.from(body, 'utf8');
    const fileBuffer = Buffer.from(buffer);
    
    let footerBody = '\r\n';
    if (description) {
      footerBody += `--${boundary}\r\n`;
      footerBody += `Content-Disposition: form-data; name="description"\r\n\r\n`;
      footerBody += `${description}\r\n`;
    }
    footerBody += `--${boundary}--\r\n`;
    const footerBuffer = Buffer.from(footerBody, 'utf8');
    
    const fullBody = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);
    
    // Upload to Mastodon (v2 API for async processing)
    const uploadResponse = await fetch(`${instanceUrl}/api/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: fullBody
    });
    
    if (!uploadResponse.ok) {
      console.log('v2 API failed, trying v1 API...');
      // Try v1 API as fallback
      const uploadResponseV1 = await fetch(`${instanceUrl}/api/v1/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: fullBody
      });
      
      if (!uploadResponseV1.ok) {
        const error = await uploadResponseV1.text();
        console.log('Media upload failed (v1):', uploadResponseV1.status, error);
        return null;
      }
      
      const v1Data = await uploadResponseV1.json();
      console.log('Media uploaded via v1 API, ID:', v1Data.id);
      return v1Data;
    }
    
    const mediaData = await uploadResponse.json();
    console.log('Media uploaded via v2 API, ID:', mediaData.id, 'Status:', uploadResponse.status);
    
    // For videos, wait for processing (v2 API returns 202 for async)
    if (isVideo && uploadResponse.status === 202 && mediaData.id) {
      console.log('Video uploaded, waiting for processing...');
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s
        
        const statusResponse = await fetch(`${instanceUrl}/api/v1/media/${mediaData.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.url) {
            console.log('Video processing complete');
            return statusData;
          }
        }
        attempts++;
        console.log(`Video processing attempt ${attempts}/${maxAttempts}...`);
      }
      console.log('Video processing timeout, using anyway');
    }
    
    return mediaData;
  } catch (error) {
    console.error('Error uploading media:', error.message, error.stack);
    return null;
  }
}

// Create a status (toot) on Mastodon
async function createStatus(instanceUrl, accessToken, status, mediaIds = [], visibility = 'public') {
  const body = {
    status,
    visibility,
    media_ids: mediaIds
  };
  
  const response = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Post failed: ${response.status}`);
  }
  
  return response.json();
}

// Build post text with tags
function buildPostText(post, maxLength = 500) {
  let text = '';
  
  // Check if title and description are the same to avoid duplication
  const title = (post.title || '').trim();
  const description = (post.description || '').trim();
  
  if (!title && !description) {
    text = '📢 New post';
  } else if (!description || title === description || description.startsWith(title)) {
    text = `📢 ${title || description}`;
  } else if (!title || title === description.substring(0, title.length)) {
    text = `📢 ${description}`;
  } else {
    text = `📢 ${title}\n\n${description}`;
  }
  
  // Add external link if present
  if (post.externalLink) {
    text += `\n\n🔗 ${post.externalLink}`;
  }
  
  // Add location if present
  if (post.location) {
    text += `\n📍 ${post.location}`;
  }
  
  // Add tags as hashtags
  if (post.tags && post.tags.length > 0) {
    text += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  // Truncate if too long
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }
  
  return text;
}

// Normalize instance URL
function normalizeInstanceUrl(url) {
  let normalized = url.trim();
  
  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  // Add https if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  
  return normalized;
}

exports.handler = async (event) => {
  console.log('Mastodon crosspost received:', JSON.stringify(event));
  
  const { tenantId, post, settings } = event;
  
  if (!tenantId || !post || !settings) {
    console.error('Missing required fields');
    return { statusCode: 400, error: 'Missing required fields' };
  }
  
  if (!settings.instanceUrl || !settings.accessToken) {
    console.error('Mastodon credentials not configured');
    return { statusCode: 400, error: 'Mastodon not configured' };
  }
  
  try {
    const instanceUrl = normalizeInstanceUrl(settings.instanceUrl);
    console.log('Posting to Mastodon instance:', instanceUrl);
    
    // Build post text
    const text = buildPostText(post);
    
    // Upload media if available - prioritize video over image
    const mediaIds = [];
    
    // Get video URL
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    // Get image URL (thumbnail for shorts, or regular image)
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    
    // Try video first (16:9 or 9:16)
    if (videoUrl) {
      console.log('Uploading video to Mastodon...');
      const media = await uploadMedia(instanceUrl, settings.accessToken, videoUrl, post.title, true);
      
      if (media && media.id) {
        mediaIds.push(media.id);
        console.log('Video uploaded, media ID:', media.id);
      } else if (imageUrl) {
        // Fallback to thumbnail if video upload fails
        console.log('Video upload failed, falling back to thumbnail...');
        const imgMedia = await uploadMedia(instanceUrl, settings.accessToken, imageUrl, post.title, false);
        if (imgMedia && imgMedia.id) {
          mediaIds.push(imgMedia.id);
          console.log('Thumbnail uploaded, media ID:', imgMedia.id);
        }
      }
    } else if (imageUrl) {
      console.log('Uploading image to Mastodon...');
      const media = await uploadMedia(instanceUrl, settings.accessToken, imageUrl, post.title, false);
      
      if (media && media.id) {
        mediaIds.push(media.id);
        console.log('Image uploaded, media ID:', media.id);
        
        // Wait for media processing if needed
        if (media.url === null) {
          console.log('Waiting for media processing...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Create the status
    console.log('Creating Mastodon status...');
    const visibility = settings.visibility || 'public';
    const result = await createStatus(instanceUrl, settings.accessToken, text, mediaIds, visibility);
    console.log('Mastodon status created:', result.id);
    
    return {
      statusCode: 200,
      success: true,
      statusId: result.id,
      url: result.url
    };
    
  } catch (error) {
    console.error('Mastodon crosspost error:', error.message);
    return {
      statusCode: 500,
      error: error.message
    };
  }
};
