const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const SETTINGS_TABLE = process.env.SETTINGS_TABLE_NAME;
const USERS_TABLE = process.env.USERS_TABLE_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const WEBSITE_URL = process.env.WEBSITE_URL;
const EMAIL_SETTINGS_ID = 'email-config';

// Helper: Load Email settings from DynamoDB
async function loadEmailSettings() {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingId: EMAIL_SETTINGS_ID }
    }));

    if (!result.Item || !result.Item.enabled) {
      console.log('Email notifications are disabled or not configured');
      return null;
    }

    if (!result.Item.senderPrefix) {
      console.log('Email sender prefix not configured');
      return null;
    }

    return {
      senderPrefix: result.Item.senderPrefix,
      senderDomain: result.Item.senderDomain,
      senderName: result.Item.senderName || 'Newsfeed'
    };
  } catch (error) {
    console.error('Error loading email settings:', error);
    return null;
  }
}

// Helper: Get all registered users from DynamoDB
async function getAllUsers() {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'email, #n',
      ExpressionAttributeNames: {
        '#n': 'name'
      }
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching users from DynamoDB:', error);
    return [];
  }
}

// Helper: Format post for email
function formatPostEmail(post, websiteUrl) {
  // Determine media URL and type
  let mediaHtml = '';
  
  if (post.imageKey) {
    // Show image directly
    const imageUrl = `https://${CDN_DOMAIN}/${post.imageKey}`;
    mediaHtml = `
      <div style="margin: 20px 0;">
        <img src="${imageUrl}" alt="${post.title}" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
      </div>
    `;
  } else if (post.videoKey && post.thumbnailKey) {
    // Show video thumbnail with play icon overlay
    const thumbnailUrl = `https://${CDN_DOMAIN}/${post.thumbnailKey}`;
    mediaHtml = `
      <div style="margin: 20px 0; position: relative; display: inline-block; width: 100%;">
        <img src="${thumbnailUrl}" alt="${post.title}" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 0; height: 0; border-left: 25px solid white; border-top: 15px solid transparent; border-bottom: 15px solid transparent; margin-left: 8px;"></div>
        </div>
        <p style="text-align: center; margin-top: 10px; color: #666;">
          <a href="${websiteUrl}/newsfeed" style="color: #FFC400; text-decoration: none; font-weight: bold;">▶ Video ansehen</a>
        </p>
      </div>
    `;
  } else if (post.videoKey) {
    // Video without thumbnail - show placeholder
    mediaHtml = `
      <div style="margin: 20px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 60px 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">🎬</div>
        <p style="color: white; font-size: 18px; margin: 0;">Video verfügbar</p>
        <p style="margin-top: 10px;">
          <a href="${websiteUrl}/newsfeed" style="color: #FFC400; text-decoration: none; font-weight: bold;">▶ Video ansehen</a>
        </p>
      </div>
    `;
  }

  const locationHtml = post.location
    ? `<p style="color: #666; margin: 10px 0;">
         📍 ${post.location}
         ${post.locationUrl ? `<br/><a href="${post.locationUrl}" style="color: #FFC400;">Auf Karte anzeigen</a>` : ''}
       </p>`
    : '';

  const externalLinkHtml = post.externalLink
    ? `<p style="margin: 10px 0;">
         <a href="${post.externalLink}" style="color: #FFC400; text-decoration: none;">🔗 Mehr erfahren</a>
       </p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FFC400 0%, #FFB700 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #000000; font-size: 24px;">Neuer Newsfeed Post</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 15px 0; color: #333333; font-size: 22px;">${post.title}</h2>
              
              ${mediaHtml}
              
              <p style="color: #666666; line-height: 1.6; margin: 15px 0;">
                ${post.description}
              </p>
              
              ${locationHtml}
              ${externalLinkHtml}
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                <a href="${websiteUrl}/newsfeed" style="display: inline-block; background-color: #FFC400; color: #000000; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold;">
                  Alle Posts ansehen
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px; text-align: center; color: #999999; font-size: 12px;">
              <p style="margin: 0 0 10px 0;">Du erhältst diese E-Mail, weil du auf ${websiteUrl} registriert bist.</p>
              <p style="margin: 0;">
                <a href="${websiteUrl}/settings" style="color: #FFC400; text-decoration: none;">Benachrichtigungen verwalten</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Helper: Send email to user
async function sendEmail(senderEmail, senderName, recipientEmail, subject, htmlBody) {
  const params = {
    Source: `${senderName} <${senderEmail}>`,
    Destination: {
      ToAddresses: [recipientEmail]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    console.log(`Email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${recipientEmail}:`, error);
    return false;
  }
}

// Main handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Load email settings
    const settings = await loadEmailSettings();
    if (!settings) {
      console.log('Email notifications not configured or disabled, skipping');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Email notifications not configured' })
      };
    }

    const senderEmail = `${settings.senderPrefix}@${settings.senderDomain}`;
    console.log('Sender email:', senderEmail);

    // Get all users
    const users = await getAllUsers();
    console.log(`Found ${users.length} registered users`);

    if (users.length === 0) {
      console.log('No users to notify');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No users to notify' })
      };
    }

    // Process DynamoDB Stream records
    let emailsSent = 0;
    let emailsFailed = 0;

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
          thumbnailKey: newImage.thumbnailKey?.S,
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

        // Format email
        const subject = `Neuer Post: ${post.title}`;
        const htmlBody = formatPostEmail(post, WEBSITE_URL);

        // Send to all users
        for (const user of users) {
          if (user.email) {
            const success = await sendEmail(
              senderEmail,
              settings.senderName,
              user.email,
              subject,
              htmlBody
            );

            if (success) {
              emailsSent++;
            } else {
              emailsFailed++;
            }
          }
        }

        console.log(`Emails sent: ${emailsSent}, failed: ${emailsFailed}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Email notifications sent',
        sent: emailsSent,
        failed: emailsFailed
      })
    };
  } catch (error) {
    console.error('Error processing records:', error);
    throw error;
  }
};
