/**
 * Discord Crosspost Lambda
 * 
 * Posts content to Discord via webhooks.
 * Supports embeds with images, videos, and rich formatting.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.DISCORD_SETTINGS_TABLE;

// ============================================
// POSTING FUNCTIONS
// ============================================

// Resolve all image URLs from post - prioritize imageKeys (S3 keys → CloudFront) over imageUrls
function resolveImageUrls(post) {
  const urls = [];
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (post.imageKeys && post.imageKeys.length > 0) {
    // Best source: S3 keys resolved via CloudFront
    urls.push(...post.imageKeys.map(k => `https://${cfDomain}/${k}`));
    console.log('Discord: Resolved', post.imageKeys.length, 'images from imageKeys via CloudFront');
  } else if (post.imageUrls && post.imageUrls.length > 0) {
    // Fallback: pre-resolved URLs
    urls.push(...post.imageUrls);
    console.log('Discord: Using', post.imageUrls.length, 'pre-resolved imageUrls');
  } else if (post.imageKey) {
    urls.push(`https://${cfDomain}/${post.imageKey}`);
    console.log('Discord: Using single imageKey');
  } else if (post.imageUrl) {
    urls.push(post.imageUrl);
    console.log('Discord: Using single imageUrl');
  }
  return urls;
}

async function postToDiscord(tenantId, post, settings) {
  const imageUrls = resolveImageUrls(post);
  const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
  
  console.log('Discord post - imageUrls:', imageUrls.length, '| videoUrl:', !!videoUrl);
  
  // Build description with tags for Shorts
  let description = post.description;
  if (post.isShort && post.tags && post.tags.length > 0) {
    description += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  const embed = {
    title: post.title,
    description: description,
    color: post.isShort ? 0xFF0080 : 0x5865F2,
    timestamp: new Date().toISOString(),
    fields: []
  };
  
  if (post.location) {
    embed.fields.push({ name: '📍 Ort', value: post.location, inline: true });
  }
  if (post.externalLink) {
    embed.fields.push({ name: '🔗 Link', value: post.externalLink, inline: true });
  }
  
  // If video exists, upload as attachment via multipart/form-data
  if (videoUrl) {
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      console.log(`Discord: Video download failed (${videoResponse.status}), falling back to images`);
      if (imageUrls.length > 0) {
        // Use multiple embeds for multiple images (Discord supports up to 10 embeds)
        const embeds = [embed];
        embeds[0].image = { url: imageUrls[0] };
        for (let i = 1; i < Math.min(imageUrls.length, 10); i++) {
          embeds.push({ url: embed.url, image: { url: imageUrls[i] } });
        }
        embed.fields.push({ name: '🎬 Video', value: `[Video ansehen](${videoUrl})`, inline: false });
        
        const response = await fetch(settings.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
            embeds
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Discord post failed: ${response.status} - ${error}`);
        }
        return { success: true, note: 'Video download failed, posted images with link' };
      }
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const videoSizeMB = videoBuffer.length / (1024 * 1024);
    
    // Discord limit is 25MB for regular webhooks
    if (videoSizeMB > 25) {
      embed.fields.push({ name: '🎬 Video', value: `[Video ansehen](${videoUrl})`, inline: false });
      if (imageUrls.length > 0) {
        embed.image = { url: imageUrls[0] };
      }
      
      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
          embeds: [embed]
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Discord post failed: ${response.status} - ${error}`);
      }
      return { success: true, note: 'Video too large, posted as link' };
    }
    
    // Build multipart form data with video + images
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const videoFilename = videoUrl.split('/').pop() || 'video.mp4';
    const attachments = [{ id: 0, filename: videoFilename }];
    
    // Also attach images alongside video (Discord supports multiple file attachments)
    const imageBuffers = [];
    for (let i = 0; i < Math.min(imageUrls.length, 9); i++) {
      try {
        const imgResp = await fetch(imageUrls[i]);
        if (imgResp.ok) {
          const imgBuf = Buffer.from(await imgResp.arrayBuffer());
          if (imgBuf.length / (1024 * 1024) <= 25) {
            imageBuffers.push({ buffer: imgBuf, filename: `image${i}.jpg` });
            attachments.push({ id: i + 1, filename: `image${i}.jpg` });
          }
        }
      } catch (e) { console.log(`Discord: Failed to download image ${i}:`, e.message); }
    }
    
    const payloadJson = JSON.stringify({
      content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
      embeds: [embed],
      attachments
    });
    
    // Build multipart body parts
    const parts = [];
    
    // Payload JSON part
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${payloadJson}\r\n`,
      'utf-8'
    ));
    
    // Video file part
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="${videoFilename}"\r\nContent-Type: video/mp4\r\n\r\n`,
      'utf-8'
    ));
    parts.push(videoBuffer);
    parts.push(Buffer.from('\r\n', 'utf-8'));
    
    // Image file parts
    for (let i = 0; i < imageBuffers.length; i++) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files[${i + 1}]"; filename="${imageBuffers[i].filename}"\r\nContent-Type: image/jpeg\r\n\r\n`,
        'utf-8'
      ));
      parts.push(imageBuffers[i].buffer);
      parts.push(Buffer.from('\r\n', 'utf-8'));
    }
    
    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));
    const fullBody = Buffer.concat(parts);
    
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: fullBody
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord post failed: ${response.status} - ${error}`);
    }
    
    return { success: true, imageCount: imageBuffers.length, hasVideo: true };
  }
  
  // No video - post with multiple images
  if (imageUrls.length > 1) {
    // Discord supports up to 10 embeds per message, each with an image
    // Use same URL trick: all embeds share the same url so images display together
    const dummyUrl = `https://viraltenant.com/post/${post.postId || Date.now()}`;
    const embeds = [{ ...embed, url: dummyUrl, image: { url: imageUrls[0] } }];
    for (let i = 1; i < Math.min(imageUrls.length, 10); i++) {
      embeds.push({ url: dummyUrl, image: { url: imageUrls[i] } });
    }
    
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
        embeds
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord post failed: ${response.status} - ${error}`);
    }
    
    return { success: true, imageCount: Math.min(imageUrls.length, 10) };
  }
  
  // Single image or no image
  if (imageUrls.length === 1) {
    embed.image = { url: imageUrls[0] };
  }
  
  const response = await fetch(settings.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
      embeds: [embed]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord post failed: ${response.status} - ${error}`);
  }
  
  return { success: true };
}

async function testWebhook(settings) {
  const response = await fetch(settings.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '🧪 **Test-Nachricht**\n\nDeine Discord-Integration funktioniert! ✅',
      embeds: [{
        title: 'Crossposting Test',
        description: 'Diese Nachricht wurde von deiner Newsfeed-Integration gesendet.',
        color: 0x5865F2
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Discord test failed: ${response.status}`);
  }
  
  return { success: true };
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
  console.log('Discord Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // Post to Discord
    if (action === 'post' || (!action && post)) {
      if (!settings?.webhookUrl) {
        return { statusCode: 400, error: 'Discord webhook not configured' };
      }
      
      const result = await postToDiscord(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    // Test webhook
    if (action === 'test') {
      const testSettings = settings || await getSettings(tenantId);
      const result = await testWebhook(testSettings);
      return { statusCode: 200, ...result };
    }
    
    // Save settings
    if (action === 'save_settings') {
      const result = await updateSettings(tenantId, settings);
      return { statusCode: 200, settings: result };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('Discord Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
