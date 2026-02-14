/**
 * LinkedIn Crosspost Lambda
 * 
 * Handles OAuth authentication and posting to LinkedIn profiles.
 * Supports text posts with images.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.LINKEDIN_SETTINGS_TABLE;

// ============================================
// OAUTH FUNCTIONS
// ============================================

async function handleOAuthCallback(code, redirectUri, tenantId) {
  const settings = await getSettings(tenantId);
  
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('LinkedIn Client ID und Secret müssen zuerst in den Einstellungen hinterlegt werden');
  }
  
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirectUri);
  params.append('client_id', settings.clientId);
  params.append('client_secret', settings.clientSecret);
  
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await response.json();
  
  // Try to get person URN
  let personUrn = null;
  try {
    const meResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    if (meResponse.ok) {
      const meData = await meResponse.json();
      personUrn = `urn:li:person:${meData.id}`;
    }
  } catch (e) {
    console.log('Could not get person URN:', e.message);
  }
  
  // Save settings
  await updateSettings(tenantId, {
    ...settings,
    accessToken: tokenData.access_token,
    personUrn: personUrn || settings.personUrn,
    enabled: true
  });
  
  return {
    success: true,
    personUrn
  };
}

// ============================================
// POSTING FUNCTIONS
// ============================================

async function postToLinkedIn(tenantId, post, settings) {
  // Get first image URL (LinkedIn doesn't support multi-image posts via API)
  let imageUrl = null;
  if (post.imageUrls && post.imageUrls.length > 0) {
    imageUrl = post.imageUrls[0];
  } else if (post.imageKeys && post.imageKeys.length > 0) {
    imageUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKeys[0]}`;
  } else if (post.imageUrl) {
    imageUrl = post.imageUrl;
  } else if (post.imageKey) {
    imageUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}`;
  }
  
  const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
  
  // Note: LinkedIn API doesn't support multi-image posts, only single image or video
  const imageCount = (post.imageUrls?.length || 0) || (post.imageKeys?.length || 0) || (post.imageUrl ? 1 : 0);
  if (imageCount > 1) {
    console.log(`LinkedIn: Note - Only posting first image (${imageCount} images in post, LinkedIn API limitation)`);
  }
  
  // Build text with tags in description
  let text = `📢 ${post.title}\n\n${post.description}`;
  if (post.location) text += `\n\n📍 ${post.location}`;
  if (post.externalLink) text += `\n\n🔗 ${post.externalLink}`;
  if (post.tags && post.tags.length > 0) {
    text += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  let personUrn = settings.personUrn;
  
  if (!personUrn) {
    // Try to get it
    try {
      const meResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        personUrn = `urn:li:person:${meData.id}`;
      }
    } catch (e) {
      console.log('Could not get person URN:', e.message);
    }
  }
  
  // Determine author: organization page or personal profile
  let authorUrn;
  if (settings.postAsOrganization && settings.organizationId) {
    authorUrn = `urn:li:organization:${settings.organizationId}`;
    console.log('LinkedIn: Posting as organization:', authorUrn);
  } else if (personUrn) {
    authorUrn = personUrn;
    console.log('LinkedIn: Posting as person:', authorUrn);
  } else {
    throw new Error('LinkedIn: No person URN or organization available');
  }
  
  // Owner URN for media uploads (same as author)
  const ownerUrn = authorUrn;
  
  // Create post using UGC API
  const postData = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };
  
  // Try video upload first (16:9 or 9:16)
  if (videoUrl) {
    console.log('LinkedIn: Attempting video upload...');
    const videoAsset = await uploadLinkedInVideo(settings.accessToken, ownerUrn, videoUrl);
    
    if (videoAsset) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'VIDEO';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        media: videoAsset,
        title: { text: post.title }
      }];
      console.log('LinkedIn: Video asset ready');
    } else if (imageUrl) {
      // Fallback to image if video upload fails
      console.log('LinkedIn: Video upload failed, falling back to image...');
      const imageAsset = await uploadLinkedInImage(settings.accessToken, ownerUrn, imageUrl);
      if (imageAsset) {
        postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          media: imageAsset
        }];
      }
    }
  } else if (imageUrl) {
    // Upload image
    const imageAsset = await uploadLinkedInImage(settings.accessToken, ownerUrn, imageUrl);
    if (imageAsset) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        media: imageAsset
      }];
    }
  }
  
  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postData)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `LinkedIn post failed: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, postId: data.id };
}

// Upload video to LinkedIn
async function uploadLinkedInVideo(accessToken, personUrn, videoUrl) {
  try {
    // Download video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      console.log('Failed to download video:', videoResponse.status);
      return null;
    }
    
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const sizeMB = videoBuffer.length / (1024 * 1024);
    
    // Check size limit (200MB)
    if (sizeMB > 200) {
      console.log(`Video too large: ${sizeMB.toFixed(1)}MB (limit: 200MB)`);
      return null;
    }
    
    console.log(`Uploading video to LinkedIn: ${sizeMB.toFixed(1)}MB`);
    
    // Register video upload
    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
          owner: personUrn,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      })
    });
    
    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      console.log('LinkedIn video register failed:', error);
      return null;
    }
    
    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const asset = registerData.value?.asset;
    
    if (!uploadUrl || !asset) {
      console.log('LinkedIn: No upload URL received');
      return null;
    }
    
    // Upload video
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'video/mp4'
      },
      body: videoBuffer
    });
    
    if (!uploadResponse.ok) {
      console.log('LinkedIn video upload failed:', uploadResponse.status);
      return null;
    }
    
    // Wait for processing
    console.log('LinkedIn: Video uploaded, waiting for processing...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await fetch(`https://api.linkedin.com/v2/assets/${encodeURIComponent(asset)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const status = statusData.recipes?.[0]?.status;
        console.log(`LinkedIn video status: ${status}`);
        
        if (status === 'AVAILABLE') {
          return asset;
        } else if (status === 'PROCESSING_FAILED') {
          console.log('LinkedIn video processing failed');
          return null;
        }
      }
      attempts++;
    }
    
    console.log('LinkedIn video processing timeout');
    return null;
  } catch (error) {
    console.error('LinkedIn video upload error:', error.message);
    return null;
  }
}

// Upload image to LinkedIn
async function uploadLinkedInImage(accessToken, personUrn, imageUrl) {
  try {
    // Register upload
    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: personUrn,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      })
    });
    
    if (!registerResponse.ok) return null;
    
    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const asset = registerData.value?.asset;
    
    if (!uploadUrl || !asset) return null;
    
    // Download and upload image
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) return null;
    
    const imgBuffer = await imgResponse.arrayBuffer();
    
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg'
      },
      body: Buffer.from(imgBuffer)
    });
    
    return asset;
  } catch (error) {
    console.error('LinkedIn image upload error:', error.message);
    return null;
  }
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
  console.log('LinkedIn Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // OAuth callback
    if (action === 'oauth_callback') {
      const { code, redirectUri } = event;
      const result = await handleOAuthCallback(code, redirectUri, tenantId);
      return { statusCode: 200, body: JSON.stringify(result) };
    }
    
    // Post to LinkedIn
    if (action === 'post' || (!action && post)) {
      if (!settings?.accessToken) {
        return { statusCode: 400, error: 'LinkedIn not configured' };
      }
      
      const result = await postToLinkedIn(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('LinkedIn Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
