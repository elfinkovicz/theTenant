/**
 * Telegram Crosspost Lambda
 * 
 * Posts content to Telegram channels/groups via Bot API.
 * Supports text, images, and videos.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.TELEGRAM_SETTINGS_TABLE;

// ============================================
// POSTING FUNCTIONS
// ============================================

async function postToTelegram(tenantId, post, settings) {
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
  
  // Build message with HTML formatting
  let message = `📢 <b>${escapeHtml(post.title)}</b>\n\n${escapeHtml(post.description)}`;
  
  if (post.location) {
    message += `\n\n📍 ${escapeHtml(post.location)}`;
  }
  
  if (post.externalLink) {
    message += `\n\n🔗 <a href="${post.externalLink}">Mehr lesen</a>`;
  }
  
  if (post.tags && post.tags.length > 0) {
    message += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
  }
  
  const baseUrl = `https://api.telegram.org/bot${settings.botToken}`;
  
  // For Shorts with video, send video
  if (post.isShort && videoUrl) {
    const response = await fetch(`${baseUrl}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        video: videoUrl,
        caption: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Telegram video send failed');
    }
    
    const data = await response.json();
    return { success: true, messageId: data.result?.message_id };
  }
  
  // Multiple media items - use sendMediaGroup
  const hasMultipleMedia = (videoUrl ? 1 : 0) + imageUrls.length > 1;
  
  if (hasMultipleMedia) {
    const media = [];
    
    // Add video first if present
    if (videoUrl) {
      media.push({
        type: 'video',
        media: videoUrl,
        caption: message,
        parse_mode: 'HTML'
      });
    }
    
    // Add images
    imageUrls.forEach((url, index) => {
      media.push({
        type: 'photo',
        media: url,
        // Only first item gets caption if no video
        ...(index === 0 && !videoUrl ? { caption: message, parse_mode: 'HTML' } : {})
      });
    });
    
    const response = await fetch(`${baseUrl}/sendMediaGroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        media: media
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('Telegram sendMediaGroup failed:', error.description);
      // Fallback to single media
    } else {
      const data = await response.json();
      return { success: true, messageId: data.result?.[0]?.message_id, mediaCount: media.length };
    }
  }
  
  // For regular videos (16:9), send as video
  if (videoUrl) {
    const response = await fetch(`${baseUrl}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        video: videoUrl,
        caption: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      // Fallback to photo if video fails
      console.log('Telegram video send failed, trying photo fallback');
      if (imageUrls.length > 0) {
        const photoResponse = await fetch(`${baseUrl}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.chatId,
            photo: imageUrls[0],
            caption: message,
            parse_mode: 'HTML'
          })
        });
        
        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          return { success: true, messageId: photoData.result?.message_id, note: 'Video failed, posted thumbnail' };
        }
      }
      const error = await response.json();
      throw new Error(error.description || 'Telegram video send failed');
    }
    
    const data = await response.json();
    return { success: true, messageId: data.result?.message_id };
  }
  
  // Send photo if available
  if (imageUrls.length > 0) {
    const response = await fetch(`${baseUrl}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        photo: imageUrls[0],
        caption: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Telegram photo send failed');
    }
    
    const data = await response.json();
    return { success: true, messageId: data.result?.message_id };
  }
  
  // Send text message
  const response = await fetch(`${baseUrl}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: settings.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.description || 'Telegram message send failed');
  }
  
  const data = await response.json();
  return { success: true, messageId: data.result?.message_id };
}

async function testBot(settings) {
  const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/getMe`);
  
  if (!response.ok) {
    throw new Error('Invalid bot token');
  }
  
  const data = await response.json();
  return { success: true, botName: data.result?.username };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  console.log('Telegram Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // Post to Telegram
    if (action === 'post' || (!action && post)) {
      if (!settings?.botToken || !settings?.chatId) {
        return { statusCode: 400, error: 'Telegram not configured' };
      }
      
      const result = await postToTelegram(tenantId, post, settings);
      return { statusCode: 200, ...result };
    }
    
    // Test bot
    if (action === 'test') {
      const testSettings = settings || await getSettings(tenantId);
      const result = await testBot(testSettings);
      return { statusCode: 200, ...result };
    }
    
    // Save settings
    if (action === 'save_settings') {
      const result = await updateSettings(tenantId, settings);
      return { statusCode: 200, settings: result };
    }
    
    return { statusCode: 400, error: 'Unknown action' };
    
  } catch (error) {
    console.error('Telegram Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
