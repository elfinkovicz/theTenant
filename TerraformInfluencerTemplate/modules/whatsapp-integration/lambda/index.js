const { SocialMessagingClient, SendWhatsAppMessageCommand } = require('@aws-sdk/client-socialmessaging');

const client = new SocialMessagingClient({ region: process.env.AWS_REGION || 'eu-central-1' });

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID;
const CDN_DOMAIN = process.env.CDN_DOMAIN;

// Helper: Format post for WhatsApp
function formatPostMessage(post) {
  let message = `*${post.title}*\n\n`;
  message += `${post.description}\n\n`;
  
  if (post.location) {
    message += `📍 ${post.location}\n`;
  }
  
  if (post.externalLink) {
    message += `🔗 ${post.externalLink}\n`;
  }
  
  return message;
}

// Helper: Send WhatsApp message
async function sendWhatsAppMessage(message, mediaUrl = null, mediaType = null) {
  try {
    const params = {
      originationPhoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      destinationPhoneNumber: WHATSAPP_GROUP_ID,
      message: message
    };

    // If media is provided, send as media message
    if (mediaUrl && mediaType) {
      params.mediaUrl = mediaUrl;
      params.mediaType = mediaType; // 'image' or 'video'
    }

    const command = new SendWhatsAppMessageCommand(params);
    const response = await client.send(command);
    
    console.log('WhatsApp message sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    throw error;
  }
}

// Main handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
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
        if (post.videoKey) {
          const videoUrl = `https://${CDN_DOMAIN}/${post.videoKey}`;
          await sendWhatsAppMessage(message, videoUrl, 'video');
        } else if (post.imageKey) {
          const imageUrl = `https://${CDN_DOMAIN}/${post.imageKey}`;
          await sendWhatsAppMessage(message, imageUrl, 'image');
        } else {
          // Send text-only message
          await sendWhatsAppMessage(message);
        }

        console.log('Successfully sent post to WhatsApp:', post.postId);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'WhatsApp notifications sent successfully' })
    };
  } catch (error) {
    console.error('Error processing records:', error);
    throw error;
  }
};
