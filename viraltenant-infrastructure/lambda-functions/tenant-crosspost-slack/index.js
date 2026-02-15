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

// Resolve all image URLs from post - prioritize imageKeys (S3 keys → CloudFront) over imageUrls
function resolveImageUrls(post) {
  const urls = [];
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (post.imageKeys && post.imageKeys.length > 0) {
    // Best source: S3 keys resolved via CloudFront
    urls.push(...post.imageKeys.map(k => `https://${cfDomain}/${k}`));
    console.log('Slack: Resolved', post.imageKeys.length, 'images from imageKeys via CloudFront');
  } else if (post.imageUrls && post.imageUrls.length > 0) {
    // Fallback: pre-resolved URLs
    urls.push(...post.imageUrls);
    console.log('Slack: Using', post.imageUrls.length, 'pre-resolved imageUrls');
  } else if (post.imageKey) {
    urls.push(`https://${cfDomain}/${post.imageKey}`);
    console.log('Slack: Using single imageKey');
  } else if (post.imageUrl) {
    urls.push(post.imageUrl);
    console.log('Slack: Using single imageUrl');
  }
  return urls;
}

async function postToSlack(tenantId, post, settings) {
  const imageUrls = resolveImageUrls(post);
  const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
  
  console.log('Slack post - imageUrls:', imageUrls.length, '| videoUrl:', !!videoUrl);
  
  // Check if title and description are the same to avoid duplication
  const title = (post.title || '').trim();
  const descriptionRaw = (post.description || '').trim();
  
  let description;
  if (!descriptionRaw || title === descriptionRaw || descriptionRaw.startsWith(title)) {
    description = '';
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
  
  // Video handling
  if (videoUrl) {
    // Show thumbnail(s) for video, then video link button
    // Slack webhooks don't support direct video upload, so show images + video link
    if (imageUrls.length > 0) {
      for (const imgUrl of imageUrls) {
        blocks.push({
          type: 'image',
          image_url: imgUrl,
          alt_text: title || 'Post image'
        });
      }
    }
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: '🎬 Video ansehen', emoji: true },
        url: videoUrl
      }]
    });
  } else if (imageUrls.length > 0) {
    // Multiple images - add each as an image block (Slack supports multiple image blocks)
    for (const imgUrl of imageUrls) {
      blocks.push({
        type: 'image',
        image_url: imgUrl,
        alt_text: title || 'Post image'
      });
    }
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
  
  console.log('Sending to Slack with', blocks.length, 'blocks');
  
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
  
  console.log('Slack post successful, images:', imageUrls.length);
  return { success: true, imageCount: imageUrls.length };
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
