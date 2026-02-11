/**
 * WhatsApp Worker Lambda
 * 
 * Processes messages from SQS queue and sends them via AWS End User Messaging Social.
 * Handles rate limiting and retries.
 */

const { SocialMessagingClient, SendWhatsAppMessageCommand } = require('@aws-sdk/client-socialmessaging');

const socialMessaging = new SocialMessagingClient({ region: process.env.REGION });
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Send WhatsApp message
 */
async function sendWhatsAppMessage(to, text, mediaUrl, mediaType) {
  let message;

  if (mediaUrl) {
    // Send media message
    message = {
      messaging_product: 'whatsapp',
      to: to,
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
      to: to,
      type: 'text',
      text: { body: text }
    };
  }

  const command = new SendWhatsAppMessageCommand({
    originationPhoneNumberId: PHONE_NUMBER_ID,
    message: Buffer.from(JSON.stringify(message)),
    metaApiVersion: 'v20.0'
  });

  return await socialMessaging.send(command);
}

/**
 * Lambda Handler - processes SQS messages
 */
exports.handler = async (event) => {
  console.log('WhatsApp Worker received:', JSON.stringify(event));

  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const record of event.Records || []) {
    try {
      const body = JSON.parse(record.body);
      const { to, text, mediaUrl, mediaType } = body;

      console.log(`Sending message to ${to}`);

      await sendWhatsAppMessage(to, text, mediaUrl, mediaType);
      results.successful++;

      // Rate limiting: wait between messages
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('Error processing message:', error);
      results.failed++;
      results.errors.push({
        messageId: record.messageId,
        error: error.message
      });

      // Don't throw - let SQS handle retries via visibility timeout
    }
  }

  console.log('Worker results:', results);

  // Return batch item failures for partial batch response
  const batchItemFailures = results.errors.map(e => ({
    itemIdentifier: e.messageId
  }));

  return {
    batchItemFailures
  };
};
