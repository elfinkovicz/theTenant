const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.SETTINGS_TABLE_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const TELEGRAM_SETTINGS_ID = 'telegram-config';

// Helper: Format post for Telegram
function formatPostMessage(post) {
  let message = `<b>${escapeHtml(post.title)}</b>\n\n`;
  message += `${escapeHtml(post.description)}\n\n`;
  
  if (post.location) {
    message += `📍 ${escapeHtml(post.location)}\n`;
    if (post.locationUrl) {
      message += `🗺️ <a href="${post.locationUrl}">Auf Karte anzeigen</a>\n`;
    }
  }
  
  if (post.externalLink) {
    message += `🔗 <a href="${post.externalLink}">Mehr erfahren</a>\n`;
  }
  
  return message;
}

// Helper: Escape HTML for Telegram
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: Load Telegram settings from DynamoDB
async function loadTelegramSettings() {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingId: TELEGRAM_SETTINGS_ID }
    }));

    if (!result.Item || !result.Item.enabled) {
      console.log('Telegram integration is disabled or not configured');
      return null;
    }

    if (!result.Item.botToken || !result.Item.chatId) {
      console.log('Telegram bot token or chat ID not configured');
      return null;
    }

    return {
      botToken: result.Item.botToken,
      chatId: result.Item.chatId
    };
  } catch (error) {
    console.error('Error loading Telegram settings:', error);
    return null;
  }
}

// Helper: Send Telegram message
async function sendTelegramMessage(botToken, chatId, message, mediaUrl = null, mediaType = null) {
  return new Promise((resolve, reject) => {
    let method = 'sendMessage';
    let body = {
      chat_id: chatId,
      parse_mode: 'HTML'
    };

    // Determine method based on media type
    if (mediaUrl && mediaType === 'photo') {
      method = 'sendPhoto';
      body.photo = mediaUrl;
      body.caption = message;
    } else if (mediaUrl && mediaType === 'video') {
      method = 'sendVideo';
      body.video = mediaUrl;
      body.caption = message;
    } else {
      body.text = message;
    }

    const postData = JSON.stringify(body);
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            console.log('Telegram message sent successfully:', response);
            resolve(response);
          } else {
            console.error('Telegram API error:', response);
            reject(new Error(response.description || 'Unknown Telegram API error'));
          }
        } catch (error) {
          console.error('Failed to parse Telegram response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Main handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Load Telegram settings
    const settings = await loadTelegramSettings();
    if (!settings) {
      console.log('Telegram integration not configured or disabled, skipping');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Telegram integration not configured' })
      };
    }

    console.log('Telegram settings loaded, chatId:', settings.chatId);

    // Process DynamoDB Stream records
    for (const record of event.Records) {
      if (record.eventName === 'INSERT') {
        const newImage = record.dynamodb.NewImage;
        
        // Extract post data
        const post = {
          postId: newImage.postId?.S,
          title: newImage.title?.S,
          description: newImage.description?.S,
          status: newImage.status?.S,
          imageKey: newImage.imageKey?.S,
          videoKey: newImage.videoKey?.S,
          location: newImage.location?.S,
          locationUrl: newImage.locationUrl?.S,
          externalLink: newImage.externalLink?.S
        };

        console.log('Processing post:', post);

        // Only send if status is 'published'
        if (post.status !== 'published') {
          console.log('Post is not published, skipping');
          continue;
        }

        // Format message
        const message = formatPostMessage(post);

        // Send message with media if available
        if (post.imageKey) {
          const imageUrl = `https://${CDN_DOMAIN}/${post.imageKey}`;
          console.log('Sending photo to Telegram:', imageUrl);
          await sendTelegramMessage(settings.botToken, settings.chatId, message, imageUrl, 'photo');
        } else if (post.videoKey) {
          const videoUrl = `https://${CDN_DOMAIN}/${post.videoKey}`;
          console.log('Sending video to Telegram:', videoUrl);
          await sendTelegramMessage(settings.botToken, settings.chatId, message, videoUrl, 'video');
        } else {
          // Send text-only message
          console.log('Sending text message to Telegram');
          await sendTelegramMessage(settings.botToken, settings.chatId, message);
        }

        console.log('Successfully sent post to Telegram:', post.postId);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Telegram notifications sent successfully' })
    };
  } catch (error) {
    console.error('Error processing records:', error);
    throw error;
  }
};
