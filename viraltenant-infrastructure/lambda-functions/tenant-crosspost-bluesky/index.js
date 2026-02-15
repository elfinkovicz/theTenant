/**
 * Bluesky Crosspost Lambda
 * 
 * Posts content to Bluesky (AT Protocol).
 * Supports text posts with images and links.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const BLUESKY_API = 'https://bsky.social/xrpc';

// Create a Bluesky session (login)
async function createSession(handle, appPassword) {
  const response = await fetch(`${BLUESKY_API}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: handle,
      password: appPassword
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Login failed: ${response.status}`);
  }
  
  return response.json();
}

// Upload an image blob to Bluesky
async function uploadBlob(session, mediaUrl, isVideo = false) {
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
    
    // Check size limit (50MB for videos, 976KB for images per Bluesky docs)
    const maxSize = isVideo ? 50 : 0.976;
    if (sizeMB > maxSize) {
      console.log(`Media too large: ${sizeMB.toFixed(2)}MB (limit: ${maxSize}MB)`);
      // For images, we could try to compress but for now just log
      if (!isVideo) {
        console.log('Image exceeds Bluesky 1MB limit - consider compressing images before upload');
      }
      return null;
    }
    
    console.log(`Uploading ${isVideo ? 'video' : 'image'} to Bluesky: ${sizeMB.toFixed(2)}MB`);
    
    // Upload to Bluesky
    const uploadResponse = await fetch(`${BLUESKY_API}/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessJwt}`,
        'Content-Type': contentType
      },
      body: Buffer.from(buffer)
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log('Blob upload failed:', uploadResponse.status, errorText);
      return null;
    }
    
    const blobData = await uploadResponse.json();
    console.log('Blob uploaded successfully:', JSON.stringify(blobData.blob).substring(0, 100));
    return { blob: blobData.blob, isVideo };
  } catch (error) {
    console.error('Error uploading blob:', error.message, error.stack);
    return null;
  }
}

// Create a post on Bluesky
async function createPost(session, text, embed = null) {
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString()
  };
  
  // Add embed if provided (image or external link)
  if (embed) {
    record.embed = embed;
  }
  
  // Parse facets (links, mentions, hashtags)
  const facets = parseFacets(text);
  if (facets.length > 0) {
    record.facets = facets;
  }
  
  const response = await fetch(`${BLUESKY_API}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Post failed: ${response.status}`);
  }
  
  return response.json();
}

// Parse text for facets (links, hashtags, mentions)
function parseFacets(text) {
  const facets = [];
  const encoder = new TextEncoder();
  
  // Find URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const byteStart = encoder.encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + encoder.encode(url).length;
    
    facets.push({
      index: { byteStart, byteEnd },
      features: [{
        $type: 'app.bsky.richtext.facet#link',
        uri: url
      }]
    });
  }
  
  // Find hashtags
  const hashtagRegex = /#(\w+)/g;
  while ((match = hashtagRegex.exec(text)) !== null) {
    const tag = match[0];
    const byteStart = encoder.encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + encoder.encode(tag).length;
    
    facets.push({
      index: { byteStart, byteEnd },
      features: [{
        $type: 'app.bsky.richtext.facet#tag',
        tag: match[1]
      }]
    });
  }
  
  return facets;
}

// Build post text with tags
function buildPostText(post, maxLength = 300) {
  let text = '';
  
  // Check if title and description are the same (or very similar) to avoid duplication
  const title = (post.title || '').trim();
  const description = (post.description || '').trim();
  
  if (!title && !description) {
    text = '📢 New post';
  } else if (!description || title === description || description.startsWith(title)) {
    // Only use title if description is empty, identical, or starts with title
    text = `📢 ${title || description}`;
  } else if (!title || title === description.substring(0, title.length)) {
    // Only use description if title is empty or description starts with title
    text = `📢 ${description}`;
  } else {
    // Both are different, use both
    text = `📢 ${title}\n\n${description}`;
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

// Resolve all image URLs from post - prioritize imageKeys (S3 keys → CloudFront) over imageUrls
function resolveImageUrls(post) {
  const urls = [];
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (post.imageKeys && post.imageKeys.length > 0) {
    // Best source: S3 keys resolved via CloudFront
    urls.push(...post.imageKeys.map(k => `https://${cfDomain}/${k}`));
    console.log('Bluesky: Resolved', post.imageKeys.length, 'images from imageKeys via CloudFront');
  } else if (post.imageUrls && post.imageUrls.length > 0) {
    // Fallback: pre-resolved URLs
    urls.push(...post.imageUrls);
    console.log('Bluesky: Using', post.imageUrls.length, 'pre-resolved imageUrls');
  } else if (post.imageKey) {
    urls.push(`https://${cfDomain}/${post.imageKey}`);
    console.log('Bluesky: Using single imageKey');
  } else if (post.imageUrl) {
    urls.push(post.imageUrl);
    console.log('Bluesky: Using single imageUrl');
  }
  return urls;
}

exports.handler = async (event) => {
  console.log('Bluesky crosspost received:', JSON.stringify(event));
  
  const { tenantId, post, settings } = event;
  
  if (!tenantId || !post || !settings) {
    console.error('Missing required fields');
    return { statusCode: 400, error: 'Missing required fields' };
  }
  
  if (!settings.handle || !settings.appPassword) {
    console.error('Bluesky credentials not configured');
    return { statusCode: 400, error: 'Bluesky not configured' };
  }
  
  try {
    // Create session (login)
    console.log('Creating Bluesky session for:', settings.handle);
    const session = await createSession(settings.handle, settings.appPassword);
    console.log('Session created, DID:', session.did);
    
    // Build post text
    const text = buildPostText(post);
    
    // Resolve all media URLs
    const imageUrls = resolveImageUrls(post);
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    
    console.log('Bluesky: imageUrls:', imageUrls.length, '| videoUrl:', !!videoUrl);
    
    // Prepare embed
    let embed = null;
    
    if (videoUrl) {
      // Try video upload first
      console.log('Uploading video to Bluesky...');
      const blobResult = await uploadBlob(session, videoUrl, true);
      
      if (blobResult && blobResult.blob) {
        embed = {
          $type: 'app.bsky.embed.video',
          video: blobResult.blob,
          alt: post.title
        };
        console.log('Video uploaded successfully');
        // Note: Bluesky video embed doesn't support additional images alongside
      } else {
        // Video upload failed - fall back to images (thumbnails)
        console.log('Video upload failed, falling back to images...');
        const images = [];
        for (let i = 0; i < Math.min(imageUrls.length, 4); i++) {
          const imgResult = await uploadBlob(session, imageUrls[i], false);
          if (imgResult && imgResult.blob) {
            images.push({ alt: post.title || `Image ${i + 1}`, image: imgResult.blob });
          }
        }
        if (images.length > 0) {
          embed = { $type: 'app.bsky.embed.images', images };
          console.log(`Uploaded ${images.length} fallback images`);
        }
      }
    } else if (imageUrls.length > 0) {
      // Upload multiple images (Bluesky supports up to 4 images per post)
      const images = [];
      for (let i = 0; i < Math.min(imageUrls.length, 4); i++) {
        console.log(`Uploading image ${i + 1}/${Math.min(imageUrls.length, 4)} to Bluesky...`);
        const blobResult = await uploadBlob(session, imageUrls[i], false);
        
        if (blobResult && blobResult.blob) {
          images.push({ alt: post.title || `Image ${i + 1}`, image: blobResult.blob });
          console.log(`Image ${i + 1} uploaded successfully`);
        }
      }
      
      if (images.length > 0) {
        embed = { $type: 'app.bsky.embed.images', images };
      }
    } else if (post.externalLink) {
      embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: post.externalLink,
          title: post.title,
          description: (post.description || '').substring(0, 200)
        }
      };
    }
    
    // Create the post
    console.log('Creating Bluesky post...');
    const result = await createPost(session, text, embed);
    console.log('Bluesky post created:', result.uri);
    
    return {
      statusCode: 200,
      success: true,
      uri: result.uri,
      cid: result.cid,
      imageCount: imageUrls.length
    };
    
  } catch (error) {
    console.error('Bluesky crosspost error:', error.message);
    return {
      statusCode: 500,
      error: error.message
    };
  }
};
