const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const https = require('https');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const SETTINGS_TABLE = process.env.SETTINGS_TABLE_NAME;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

const WHATSAPP_SETTINGS_ID = 'whatsapp-config';
const TELEGRAM_SETTINGS_ID = 'telegram-config';
const EMAIL_SETTINGS_ID = 'email-config';

// Helper: Check if user is admin
function isAdmin(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  if (!claims) return false;
  
  let groups = claims['cognito:groups'];
  if (!groups) return false;
  
  if (typeof groups === 'string') {
    if (groups.startsWith('[') && groups.endsWith(']')) {
      groups = groups.slice(1, -1).split(',').map(g => g.trim());
    } else {
      groups = [groups];
    }
  }
  
  return groups.includes(ADMIN_GROUP);
}

// Helper: CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
}

// Helper: Response
function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

// Helper: Send Telegram test message
async function sendTelegramTest(botToken, chatId) {
  return new Promise((resolve, reject) => {
    const message = '🧪 <b>Test-Nachricht</b>\n\nDeine Telegram-Integration funktioniert! ✅';
    const postData = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            resolve(response);
          } else {
            reject(new Error(response.description || 'Telegram API error'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path || event.rawPath;

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  // Check admin access
  if (!isAdmin(event)) {
    return response(403, { error: 'Admin access required' });
  }

  try {
    // GET /whatsapp/settings
    if (method === 'GET' && path === '/whatsapp/settings') {
      const result = await docClient.send(new GetCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingId: WHATSAPP_SETTINGS_ID }
      }));

      const settings = result.Item || {
        enabled: false,
        phoneNumberId: '',
        groupId: '',
        groupName: ''
      };

      return response(200, { settings });
    }

    // PUT /whatsapp/settings
    if (method === 'PUT' && path === '/whatsapp/settings') {
      const body = JSON.parse(event.body);

      const settings = {
        settingId: WHATSAPP_SETTINGS_ID,
        enabled: body.enabled || false,
        phoneNumberId: body.phoneNumberId || '',
        groupId: body.groupId || '',
        groupName: body.groupName || '',
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: SETTINGS_TABLE,
        Item: settings
      }));

      return response(200, { message: 'Settings saved', settings });
    }

    // POST /whatsapp/test
    if (method === 'POST' && path === '/whatsapp/test') {
      // TODO: Implement WhatsApp test message
      return response(200, { message: 'WhatsApp test not yet implemented' });
    }

    // GET /telegram/settings
    if (method === 'GET' && path === '/telegram/settings') {
      const result = await docClient.send(new GetCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingId: TELEGRAM_SETTINGS_ID }
      }));

      const settings = result.Item || {
        enabled: false,
        botToken: '',
        chatId: '',
        chatName: ''
      };

      return response(200, { settings });
    }

    // PUT /telegram/settings
    if (method === 'PUT' && path === '/telegram/settings') {
      const body = JSON.parse(event.body);

      const settings = {
        settingId: TELEGRAM_SETTINGS_ID,
        enabled: body.enabled || false,
        botToken: body.botToken || '',
        chatId: body.chatId || '',
        chatName: body.chatName || '',
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: SETTINGS_TABLE,
        Item: settings
      }));

      return response(200, { message: 'Settings saved', settings });
    }

    // POST /telegram/test
    if (method === 'POST' && path === '/telegram/test') {
      // Load settings
      const result = await docClient.send(new GetCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingId: TELEGRAM_SETTINGS_ID }
      }));

      if (!result.Item || !result.Item.botToken || !result.Item.chatId) {
        return response(400, { error: 'Telegram settings not configured' });
      }

      // Send test message
      await sendTelegramTest(result.Item.botToken, result.Item.chatId);

      return response(200, { message: 'Test message sent successfully' });
    }

    // GET /email/settings
    if (method === 'GET' && path === '/email/settings') {
      const result = await docClient.send(new GetCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingId: EMAIL_SETTINGS_ID }
      }));

      const settings = result.Item || {
        enabled: false,
        senderPrefix: 'newsfeed',
        senderDomain: '',
        senderName: 'Newsfeed'
      };

      return response(200, { settings });
    }

    // PUT /email/settings
    if (method === 'PUT' && path === '/email/settings') {
      const body = JSON.parse(event.body);
      const { settings: inputSettings } = body;

      const settings = {
        settingId: EMAIL_SETTINGS_ID,
        enabled: inputSettings.enabled || false,
        senderPrefix: inputSettings.senderPrefix || 'newsfeed',
        senderDomain: inputSettings.senderDomain || '',
        senderName: inputSettings.senderName || 'Newsfeed',
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: SETTINGS_TABLE,
        Item: settings
      }));

      return response(200, { message: 'Email settings saved', settings });
    }

    // POST /email/test
    if (method === 'POST' && path === '/email/test') {
      const result = await docClient.send(new GetCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingId: EMAIL_SETTINGS_ID }
      }));

      if (!result.Item || !result.Item.senderPrefix) {
        return response(400, { error: 'Email settings not configured properly' });
      }
      
      // Use domain from environment variable
      const senderDomain = process.env.DOMAIN_NAME || result.Item.senderDomain;
      
      if (!senderDomain) {
        return response(400, { error: 'Domain not configured' });
      }

      // For now, use a hardcoded admin email
      // TODO: Get email from Cognito User Pool or make it configurable
      const adminEmail = 'email@nielsfink.de';
      
      console.log('Sending test email to:', adminEmail);

      const senderEmail = `${result.Item.senderPrefix}@${senderDomain}`;
      const senderName = result.Item.senderName || 'Newsfeed';

      // Send test email via SES
      try {
        const emailParams = {
          Source: `${senderName} <${senderEmail}>`,
          Destination: {
            ToAddresses: [adminEmail]
          },
          Message: {
            Subject: {
              Data: '🧪 Test-Email von deinem Newsfeed-System',
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                  </head>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 28px;">✅ Email-Test erfolgreich!</h1>
                    </div>
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                      <p style="font-size: 16px; margin-bottom: 20px;">
                        <strong>Glückwunsch!</strong> Deine Email-Benachrichtigungen sind korrekt konfiguriert.
                      </p>
                      <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
                        <p style="margin: 0; color: #666;">
                          <strong>Absender:</strong> ${senderName}<br>
                          <strong>Email:</strong> ${senderEmail}<br>
                          <strong>Empfänger:</strong> ${adminEmail}
                        </p>
                      </div>
                      <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                        Diese Test-Email wurde automatisch von deinem Newsfeed-System gesendet.
                      </p>
                    </div>
                  </body>
                  </html>
                `,
                Charset: 'UTF-8'
              },
              Text: {
                Data: `Test-Email erfolgreich!\n\nDeine Email-Benachrichtigungen sind korrekt konfiguriert.\n\nAbsender: ${senderName}\nEmail: ${senderEmail}\nEmpfänger: ${adminEmail}`,
                Charset: 'UTF-8'
              }
            }
          }
        };

        await sesClient.send(new SendEmailCommand(emailParams));

        return response(200, { 
          message: 'Test email sent successfully',
          senderEmail,
          recipientEmail: adminEmail
        });
      } catch (emailError) {
        console.error('SES Error:', emailError);
        return response(500, { 
          error: 'Failed to send test email',
          details: emailError.message
        });
      }
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
