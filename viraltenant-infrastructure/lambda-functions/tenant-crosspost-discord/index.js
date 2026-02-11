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

async function postToDiscord(tenantId, post, settings) {
  const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
  const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
  
  // Build description with tags for Shorts
  let description = post.description;
  if (post.isShort && post.tags && post.tags.length > 0) {
    description += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  const embed = {
    title: post.title,
    description: description,
    color: post.isShort ? 0xFF0080 : 0x5865F2, // Pink for Shorts, Discord blurple for regular
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
    // Download video from CloudFront
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      // Fallback to thumbnail if video download fails
      console.log(`Discord: Video download failed (${videoResponse.status}), falling back to thumbnail`);
      if (imageUrl) {
        embed.image = { url: imageUrl };
        embed.fields.push({ name: '🎬 Video', value: `[Video ansehen](${videoUrl})`, inline: false });
        
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
        return { success: true, note: 'Video download failed, posted thumbnail with link' };
      }
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const videoSizeMB = videoBuffer.length / (1024 * 1024);
    
    // Discord limit is 25MB for regular webhooks
    if (videoSizeMB > 25) {
      // Fallback to link if video too large
      embed.fields.push({ name: '🎬 Video', value: `[Video ansehen](${videoUrl})`, inline: false });
      if (imageUrl) {
        embed.image = { url: imageUrl };
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
    
    // Build multipart form data manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const videoFilename = videoUrl.split('/').pop() || 'video.mp4';
    
    // Payload JSON with attachment reference
    const payloadJson = JSON.stringify({
      content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
      embeds: [embed],
      attachments: [{ id: 0, filename: videoFilename }]
    });
    
    // Build multipart body
    let body = '';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="payload_json"\r\n';
    body += 'Content-Type: application/json\r\n\r\n';
    body += payloadJson + '\r\n';
    
    // Convert string part to buffer
    const stringPart = Buffer.from(body, 'utf-8');
    
    // File part header
    const fileHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files[0]"; filename="${videoFilename}"\r\n` +
      'Content-Type: video/mp4\r\n\r\n',
      'utf-8'
    );
    
    // File part footer
    const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    
    // Combine all parts
    const fullBody = Buffer.concat([stringPart, fileHeader, videoBuffer, fileFooter]);
    
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: fullBody
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord post failed: ${response.status} - ${error}`);
    }
    
    return { success: true };
  }
  
  // No video - just post with image if available
  if (imageUrl) {
    embed.image = { url: imageUrl };
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
