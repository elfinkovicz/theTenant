const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const ses = new SESClient({ region: process.env.REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });

// Get user email from Cognito
async function getUserEmail(userId) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId
    });
    const response = await cognito.send(command);
    const emailAttr = response.UserAttributes?.find(attr => attr.Name === 'email');
    return emailAttr?.Value || null;
  } catch (error) {
    console.error('Error getting user email from Cognito:', error);
    return null;
  }
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS'
};

// Resolve tenant ID from subdomain or UUID
async function resolveTenantId(tenantIdOrSubdomain) {
  // If it looks like a UUID, return as-is
  if (tenantIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantIdOrSubdomain;
  }
  
  // Otherwise, treat as subdomain and look up the tenant
  try {
    const params = {
      TableName: process.env.TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: {
        ':subdomain': tenantIdOrSubdomain
      }
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    if (result.Items && result.Items.length > 0) {
      console.log('Resolved subdomain', tenantIdOrSubdomain, 'to tenant ID', result.Items[0].tenant_id);
      return result.Items[0].tenant_id;
    }
  } catch (error) {
    console.error('Error resolving subdomain:', error);
  }
  
  // Return original value if not found
  return tenantIdOrSubdomain;
}

async function isUserTenantAdmin(userId, tenantId) {
  // Always check the user_tenants table - strict tenant isolation
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    const isAdmin = result.Item && result.Item.role === 'admin';
    console.log(`Admin check for user ${userId} on tenant ${tenantId}: ${isAdmin}`);
    return isAdmin;
  } catch (error) { 
    console.error('Error checking admin:', error);
    return false; 
  }
}

const getDefaultSettings = (tenantId) => ({
  tenant_id: tenantId,
  enabled: false,
  senderPrefix: '', // Will be set from tenant subdomain
  senderDomain: process.env.PLATFORM_DOMAIN || 'viraltenant.com',
  senderName: 'Newsfeed',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Get tenant subdomain for email prefix
async function getTenantSubdomain(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item?.subdomain || null;
  } catch (error) {
    console.error('Error getting tenant subdomain:', error);
    return null;
  }
}

async function getEmailSettings(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.EMAIL_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    let settings = result.Item || getDefaultSettings(tenantId);
    
    // If senderPrefix is not set, use tenant subdomain
    if (!settings.senderPrefix) {
      const subdomain = await getTenantSubdomain(tenantId);
      if (subdomain) {
        settings.senderPrefix = subdomain;
        settings.senderName = subdomain.charAt(0).toUpperCase() + subdomain.slice(1) + ' News';
      }
    }
    
    return settings;
  } catch (error) { 
    console.error('Error getting Email settings:', error);
    return getDefaultSettings(tenantId); 
  }
}

async function updateEmailSettings(tenantId, settings) {
  const existing = await getEmailSettings(tenantId);
  const item = { 
    ...existing, 
    ...settings, 
    tenant_id: tenantId, 
    updated_at: new Date().toISOString() 
  };
  
  await dynamodb.send(new PutCommand({ 
    TableName: process.env.EMAIL_SETTINGS_TABLE, 
    Item: item 
  }));
  
  return item;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, pathParameters, requestContext, queryStringParameters } = event;
  const userId = requestContext?.authorizer?.userId;
  const authorizerTenantId = requestContext?.authorizer?.tenantId;
  
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Handle unsubscribe endpoint (no auth required)
  if (path?.includes('/unsubscribe')) {
    return handleUnsubscribe(queryStringParameters);
  }
  
  // Handle resubscribe endpoint (no auth required)
  if (path?.includes('/resubscribe')) {
    return handleResubscribe(queryStringParameters);
  }
  
  // All other endpoints require tenant ID
  if (!authorizerTenantId) {
    console.error('No tenant ID in authorizer');
    return { 
      statusCode: 403, 
      headers: corsHeaders, 
      body: JSON.stringify({ message: 'Keine Berechtigung - Tenant ID erforderlich' }) 
    };
  }
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(authorizerTenantId);
  console.log('Resolved tenant ID:', authorizerTenantId, '->', tenantId);

  try {
    if (httpMethod === 'GET') {
      const settings = await getEmailSettings(tenantId);
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...settings,
          resolvedTenantId: tenantId
        })
      };
    }

    if (httpMethod === 'PUT') {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { 
          statusCode: 403, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Keine Berechtigung' }) 
        };
      }
      
      const settings = JSON.parse(event.body || '{}');
      const updated = await updateEmailSettings(tenantId, settings);
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...updated,
          resolvedTenantId: tenantId
        })
      };
    }

    if (httpMethod === 'POST') {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { 
          statusCode: 403, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Keine Berechtigung' }) 
        };
      }
      
      // Test Email functionality
      const settings = await getEmailSettings(tenantId);
      console.log('Email settings for test:', JSON.stringify(settings, null, 2));
      
      // Allow test if senderPrefix is set (don't require enabled flag for testing)
      if (!settings.senderPrefix) {
        console.log('Email not configured - senderPrefix missing');
        return { 
          statusCode: 400, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'Email nicht konfiguriert - Sender-Prefix erforderlich',
            error: 'Sender-Prefix erforderlich',
            senderPrefix: settings.senderPrefix
          }) 
        };
      }
      
      try {
        // Get user email from Cognito for test email recipient
        const userEmail = await getUserEmail(userId);
        if (!userEmail) {
          console.log('Could not get user email from Cognito');
          return { 
            statusCode: 400, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              message: 'Benutzer-E-Mail konnte nicht ermittelt werden',
              error: 'Benutzer-E-Mail nicht gefunden'
            }) 
          };
        }
        
        // Build sender email from prefix and domain
        const senderDomain = settings.senderDomain || process.env.PLATFORM_DOMAIN || 'viraltenant.com';
        const fromEmail = `${settings.senderPrefix}@${senderDomain}`;
        const senderName = settings.senderName || settings.senderPrefix;
        
        const subject = `${senderName} - Test-E-Mail`;
        const body = `
          <h2>🧪 Test-E-Mail</h2>
          <p>Deine E-Mail-Integration funktioniert! ✅</p>
          <p>Diese Test-E-Mail wurde erfolgreich gesendet.</p>
          <hr>
          <p><small>Gesendet von: ${fromEmail}</small></p>
        `;
        
        console.log('Sending test email from:', fromEmail, 'to:', userEmail);
        
        const command = new SendEmailCommand({
          Source: fromEmail,
          Destination: {
            ToAddresses: [userEmail]
          },
          Message: {
            Subject: {
              Data: subject,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: body,
                Charset: 'UTF-8'
              }
            }
          }
        });
        
        console.log('Sending SES command:', JSON.stringify(command.input, null, 2));
        const response = await ses.send(command);
        console.log('SES response:', JSON.stringify(response, null, 2));
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'Test-E-Mail erfolgreich gesendet!',
            messageId: response.MessageId,
            sentTo: userEmail,
            resolvedTenantId: tenantId
          })
        };
      } catch (emailError) {
        console.error('SES error:', emailError);
        return { 
          statusCode: 400, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'Fehler beim Senden der Test-E-Mail',
            error: emailError.message,
            code: emailError.code,
            resolvedTenantId: tenantId
          })
        };
      }
    }

    return { 
      statusCode: 404, 
      headers: corsHeaders, 
      body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) 
    };
  } catch (error) {
    console.error('Error:', error);
    return { 
      statusCode: 500, 
      headers: corsHeaders, 
      body: JSON.stringify({ message: error.message }) 
    };
  }
};

// Handle newsletter unsubscribe
async function handleUnsubscribe(queryParams) {
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' };
  
  try {
    const token = queryParams?.token;
    if (!token) {
      return {
        statusCode: 400,
        headers: htmlHeaders,
        body: buildUnsubscribePage('Fehler', 'Ungültiger Abmelde-Link.', false)
      };
    }
    
    // Decode token
    const decoded = JSON.parse(Buffer.from(decodeURIComponent(token), 'base64').toString('utf-8'));
    const { email, tenantId } = decoded;
    
    if (!email || !tenantId) {
      return {
        statusCode: 400,
        headers: htmlHeaders,
        body: buildUnsubscribePage('Fehler', 'Ungültiger Abmelde-Link.', false)
      };
    }
    
    // Save opt-out to DynamoDB
    await dynamodb.send(new PutCommand({
      TableName: process.env.EMAIL_OPTOUT_TABLE,
      Item: {
        email: email.toLowerCase(),
        tenant_id: tenantId,
        unsubscribed_at: new Date().toISOString()
      }
    }));
    
    console.log('User unsubscribed:', email, 'from tenant:', tenantId);
    
    // Generate resubscribe link
    const resubscribeToken = Buffer.from(JSON.stringify({ email, tenantId })).toString('base64');
    
    return {
      statusCode: 200,
      headers: htmlHeaders,
      body: buildUnsubscribePage(
        'Erfolgreich abgemeldet',
        `Du erhältst keine E-Mails mehr von diesem Newsletter.<br><br>E-Mail: ${email}`,
        true,
        resubscribeToken
      )
    };
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return {
      statusCode: 500,
      headers: htmlHeaders,
      body: buildUnsubscribePage('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', false)
    };
  }
}

// Handle newsletter resubscribe
async function handleResubscribe(queryParams) {
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' };
  
  try {
    const token = queryParams?.token;
    if (!token) {
      return {
        statusCode: 400,
        headers: htmlHeaders,
        body: buildUnsubscribePage('Fehler', 'Ungültiger Link.', false)
      };
    }
    
    // Decode token
    const decoded = JSON.parse(Buffer.from(decodeURIComponent(token), 'base64').toString('utf-8'));
    const { email, tenantId } = decoded;
    
    if (!email || !tenantId) {
      return {
        statusCode: 400,
        headers: htmlHeaders,
        body: buildUnsubscribePage('Fehler', 'Ungültiger Link.', false)
      };
    }
    
    // Remove opt-out from DynamoDB
    await dynamodb.send(new DeleteCommand({
      TableName: process.env.EMAIL_OPTOUT_TABLE,
      Key: {
        email: email.toLowerCase(),
        tenant_id: tenantId
      }
    }));
    
    console.log('User resubscribed:', email, 'to tenant:', tenantId);
    
    return {
      statusCode: 200,
      headers: htmlHeaders,
      body: buildUnsubscribePage(
        'Erfolgreich angemeldet',
        `Du erhältst wieder E-Mails von diesem Newsletter.<br><br>E-Mail: ${email}`,
        true
      )
    };
  } catch (error) {
    console.error('Resubscribe error:', error);
    return {
      statusCode: 500,
      headers: htmlHeaders,
      body: buildUnsubscribePage('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', false)
    };
  }
}

// Build HTML page for unsubscribe/resubscribe
function buildUnsubscribePage(title, message, success, resubscribeToken = null) {
  const apiUrl = process.env.API_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
          .icon { font-size: 60px; margin-bottom: 20px; }
          h1 { color: ${success ? '#4CAF50' : '#f44336'}; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .button:hover { background: #5a6fd6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">${success ? '✅' : '❌'}</div>
          <h1>${title}</h1>
          <p>${message}</p>
          ${resubscribeToken ? `<a href="${apiUrl}/email/resubscribe?token=${encodeURIComponent(resubscribeToken)}" class="button">Wieder anmelden</a>` : ''}
        </div>
      </body>
    </html>
  `;
}
