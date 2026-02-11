/**
 * Slack Crosspost Lambda
 * 
 * Posts content to Slack via incoming webhooks.
 * Supports blocks with images and buttons.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = process.env.SLACK_SETTINGS_TABLE;

// ============================================
// POSTING FUNCTIONS
// ============================================

async function postToSlack(tenantId, post, settings) {
  const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
  const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
  
  console.log('Slack post - imageUrl:', imageUrl);
  console.log('Slack post - videoUrl:', videoUrl);
  
  // Check if title and description are the same to avoid duplication
  const title = (post.title || '').trim();
  const descriptionRaw = (post.description || '').trim();
  
  let description;
  if (!descriptionRaw || title === descriptionRaw || descriptionRaw.startsWith(title)) {
    description = ''; // Don't repeat in description section
  } else {
    description = descriptionRaw;
  }
  
  // Add tags for Shorts
  if (post.isShort && post.tags && post.tags.length > 0) {
    description += (description ? '\n\n' : '') + post.tags.map(t => `#${t}`).join(' ');
  }
  
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: post.isShort ? `📱 ${title}` : `📢 ${title}`, emoji: true }
    }
  ];
  
  // Only add description section if there's content
  if (description) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: description }
    });
  }
  
  if (post.location) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `📍 ${post.location}` }]
    });
  }
  
  // For Shorts, show thumbnail and video link
  if (post.isShort && videoUrl) {
    if (imageUrl) {
      console.log('Adding image block for Short thumbnail');
      blocks.push({
        type: 'image',
        image_url: imageUrl,
        alt_text: title || 'Short thumbnail'
      });
    }
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: '🎬 Video ansehen', emoji: true },
        url: videoUrl
      }]
    });
  } else if (videoUrl) {
    // For regular videos (16:9), show thumbnail and video link
    // Note: Slack webhooks don't support direct video upload
    if (imageUrl) {
      console.log('Adding image block for video thumbnail');
      blocks.push({
        type: 'image',
        image_url: imageUrl,
        alt_text: title || 'Video thumbnail'
      });
    }
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: '🎬 Video ansehen', emoji: true },
        url: videoUrl
      }]
    });
  } else if (imageUrl) {
    console.log('Adding image block');
    blocks.push({
      type: 'image',
      image_url: imageUrl,
      alt_text: title || 'Post image'
    });
  }
  
  if (post.externalLink) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'Mehr erfahren →', emoji: true },
        url: post.externalLink
      }]
    });
  }
  
  console.log('Sending to Slack with blocks:', JSON.stringify(blocks).substring(0, 500));
  
  const response = await fetch(settings.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Slack post failed:', response.status, error);
    throw new Error(`Slack post failed: ${response.status} - ${error}`);
  }
  
  console.log('Slack post successful');
  return { success: true };
}

async function testWebhook(settings) {
  const response = await fetch(settings.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🧪 Test-Nachricht', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: 'Deine Slack-Integration funktioniert! ✅' } }
      ]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Slack test failed: ${response.status}`);
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
  console.log('Slack Lambda received:', JSON.stringify(event));
  
  const { action, tenantId, post, settings } = event;
  
  try {
    // Post to Slack
    if (action === 'post' || (!action && post)) {
      if (!settings?.webhookUrl) {
        return { statusCode: 400, error: 'Slack webhook not configured' };
      }
      
      const result = await postToSlack(tenantId, post, settings);
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
    console.error('Slack Lambda error:', error.message);
    return { statusCode: 500, error: error.message };
  }
};
