/**
 * WhatsApp Crosspost Lambda
 * 
 * Sends newsfeed posts to WhatsApp subscribers using AWS End User Messaging Social.
 * Uses SQS for rate limiting and reliable delivery.
 * 
 * Invoked by the crosspost dispatcher when a new post is published.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs');
const { SocialMessagingClient, SendWhatsAppMessageCommand } = require('@aws-sdk/client-socialmessaging');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const sqs = new SQSClient({ region: process.env.REGION });
const socialMessaging = new SocialMessagingClient({ region: process.env.REGION });

const SUBSCRIBERS_TABLE = process.env.SUBSCRIBERS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const TENANTS_TABLE = process.env.TENANTS_TABLE;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

/**
 * Get tenant settings
 */
async function getTenantSettings(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || { enabled: false };
  } catch (error) {
    console.error('Error getting tenant settings:', error);
    return { enabled: false };
  }
}

/**
 * Get tenant info
 */
async function getTenantInfo(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || {};
  } catch (error) {
    console.error('Error getting tenant info:', error);
    return {};
  }
}

/**
 * Get all subscribers for a tenant
 */
async function getSubscribers(tenantId) {
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: SUBSCRIBERS_TABLE,
      KeyConditionExpression: 'tenant_id = :tenantId',
      FilterExpression: '#status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':active': 'active'
      }
    }));
    return result.Items || [];
  } catch (error) {
    console.error('Error getting subscribers:', error);
    return [];
  }
}

/**
 * Build WhatsApp message from post
 */
function buildMessage(post, tenantName) {
  const title = post.title || 'Neuer Beitrag';
  const description = post.description || '';
  
  let message = `📢 *${tenantName}*\n\n`;
  message += `*${title}*\n`;
  
  if (description) {
    // Truncate description if too long
    const maxDescLength = 500;
    const truncatedDesc = description.length > maxDescLength 
      ? description.substring(0, maxDescLength) + '...'
      : description;
    message += `\n${truncatedDesc}\n`;
  }

  // Add tags as hashtags
  if (post.tags && post.tags.length > 0) {
    message += `\n${post.tags.map(t => `#${t}`).join(' ')}\n`;
  }

  // Add link if available
  if (post.link) {
    message += `\n🔗 ${post.link}`;
  }

  return message;
}

/**
 * Build media URLs from post - supports multiple images
 */
function getMediaUrls(post) {
  const urls = [];
  
  // Check for multiple images first (imageUrls array)
  if (post.imageUrls && post.imageUrls.length > 0) {
    urls.push(...post.imageUrls.map(url => ({ url, type: 'image' })));
  } else if (post.imageKeys && post.imageKeys.length > 0) {
    urls.push(...post.imageKeys.map(key => ({ url: `https://${CLOUDFRONT_DOMAIN}/${key}`, type: 'image' })));
  } else if (post.imageUrl) {
    urls.push({ url: post.imageUrl, type: 'image' });
  } else if (post.imageKey) {
    urls.push({ url: `https://${CLOUDFRONT_DOMAIN}/${post.imageKey}`, type: 'image' });
  }
  
  // Add video if present
  if (post.videoUrl) {
    urls.unshift({ url: post.videoUrl, type: 'video' }); // Video first
  } else if (post.videoKey) {
    urls.unshift({ url: `https://${CLOUDFRONT_DOMAIN}/${post.videoKey}`, type: 'video' });
  }
  
  return urls;
}

/**
 * Send messages to SQS for processing
 */
async function queueMessages(subscribers, post, tenantName, mediaUrls) {
  const batches = [];
  const batchSize = 10; // SQS max batch size
  
  // For each subscriber, create messages for text + all media
  const allMessages = [];
  
  for (const sub of subscribers) {
    // First message: text with first media (or just text)
    const firstMedia = mediaUrls[0];
    allMessages.push({
      to: sub.phone_number,
      text: buildMessage(post, tenantName),
      mediaUrl: firstMedia?.url || null,
      mediaType: firstMedia?.type || 'image'
    });
    
    // Additional messages for remaining media (WhatsApp doesn't support multi-media in one message)
    for (let i = 1; i < mediaUrls.length; i++) {
      allMessages.push({
        to: sub.phone_number,
        text: null, // No text for additional media
        mediaUrl: mediaUrls[i].url,
        mediaType: mediaUrls[i].type
      });
    }
  }

  for (let i = 0; i < allMessages.length; i += batchSize) {
    const batch = allMessages.slice(i, i + batchSize);
    const entries = batch.map((msg, index) => ({
      Id: `msg-${i + index}`,
      MessageBody: JSON.stringify(msg),
      MessageGroupId: msg.to // For FIFO queues
    }));

    batches.push(entries);
  }

  let totalSent = 0;
  for (const entries of batches) {
    try {
      await sqs.send(new SendMessageBatchCommand({
        QueueUrl: SQS_QUEUE_URL,
        Entries: entries
      }));
      totalSent += entries.length;
    } catch (error) {
      console.error('Error sending to SQS:', error);
    }
  }

  return totalSent;
}

/**
 * Send WhatsApp message directly (for small subscriber counts)
 */
async function sendDirectMessage(to, text, mediaUrl, mediaType) {
  // Ensure phone number has + prefix for international format
  const formattedTo = to.startsWith('+') ? to : `+${to}`;
  
  let message;

  if (mediaUrl) {
    // Send media message
    message = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: mediaType || 'image'
    };

    if (mediaType === 'video') {
      message.video = {
        link: mediaUrl,
        caption: text
      };
    } else {
      message.image = {
        link: mediaUrl,
        caption: text
      };
    }
  } else {
    // Send text message
    message = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: 'text',
      text: { body: text }
    };
  }

  try {
    const command = new SendWhatsAppMessageCommand({
      originationPhoneNumberId: PHONE_NUMBER_ID,
      message: Buffer.from(JSON.stringify(message)),
      metaApiVersion: 'v20.0'
    });

    const response = await socialMessaging.send(command);
    console.log(`Message sent to ${to}:`, response.messageId);
    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error(`Error sending to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Lambda Handler
 */
exports.handler = async (event) => {
  console.log('WhatsApp Crosspost received:', JSON.stringify(event));

  const { tenantId, post, action } = event;

  // Handle test action
  if (action === 'test') {
    return await handleTest(tenantId);
  }

  if (!tenantId || !post) {
    console.error('Missing required fields');
    return { statusCode: 400, error: 'Missing tenantId or post' };
  }

  try {
    // Check if WhatsApp is enabled for this tenant
    const settings = await getTenantSettings(tenantId);
    
    if (!settings.enabled) {
      console.log(`WhatsApp not enabled for tenant ${tenantId}`);
      return { statusCode: 200, skipped: true, reason: 'WhatsApp not enabled' };
    }

    // Get tenant info for name
    const tenantInfo = await getTenantInfo(tenantId);
    const tenantName = tenantInfo.name || tenantInfo.subdomain || 'Updates';

    // Get subscribers
    const subscribers = await getSubscribers(tenantId);
    
    if (subscribers.length === 0) {
      console.log(`No subscribers for tenant ${tenantId}`);
      return { statusCode: 200, skipped: true, reason: 'No subscribers' };
    }

    console.log(`Sending to ${subscribers.length} subscribers for tenant ${tenantId}`);

    // Build message and get all media URLs
    const text = buildMessage(post, tenantName);
    const mediaUrls = getMediaUrls(post);
    
    console.log(`Post has ${mediaUrls.length} media items`);

    // For small subscriber counts, send directly
    // For larger counts, use SQS queue
    const DIRECT_SEND_THRESHOLD = 50;

    if (subscribers.length <= DIRECT_SEND_THRESHOLD) {
      // Send directly with rate limiting
      let successCount = 0;
      let failCount = 0;

      for (const sub of subscribers) {
        // Send first message with text + first media
        const firstMedia = mediaUrls[0];
        const result = await sendDirectMessage(
          sub.phone_number, 
          text, 
          firstMedia?.url || null, 
          firstMedia?.type || 'image'
        );
        
        if (result.success) {
          successCount++;
          
          // Send additional media as separate messages
          for (let i = 1; i < mediaUrls.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 50));
            await sendDirectMessage(
              sub.phone_number,
              null, // No text for additional media
              mediaUrls[i].url,
              mediaUrls[i].type
            );
          }
        } else {
          failCount++;
        }

        // Rate limit: ~20 messages per second
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        statusCode: 200,
        success: true,
        sent: successCount,
        failed: failCount,
        total: subscribers.length,
        mediaCount: mediaUrls.length
      };
    } else {
      // Queue messages for async processing
      const queued = await queueMessages(subscribers, post, tenantName, mediaUrls);

      return {
        statusCode: 200,
        success: true,
        queued: queued,
        total: subscribers.length,
        mediaCount: mediaUrls.length,
        message: 'Messages queued for delivery'
      };
    }

  } catch (error) {
    console.error('WhatsApp crosspost error:', error);
    return { statusCode: 500, error: error.message };
  }
};

/**
 * Handle test action
 */
async function handleTest(tenantId) {
  try {
    const settings = await getTenantSettings(tenantId);
    const subscribers = await getSubscribers(tenantId);

    return {
      statusCode: 200,
      success: true,
      enabled: settings.enabled,
      subscriberCount: subscribers.length,
      message: settings.enabled 
        ? `WhatsApp aktiv mit ${subscribers.length} Abonnenten`
        : 'WhatsApp nicht aktiviert'
    };
  } catch (error) {
    return { statusCode: 500, error: error.message };
  }
}
