const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

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
  botToken: '',
  chatId: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

async function getTelegramSettings(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TELEGRAM_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || getDefaultSettings(tenantId);
  } catch (error) { 
    console.error('Error getting Telegram settings:', error);
    return getDefaultSettings(tenantId); 
  }
}

async function updateTelegramSettings(tenantId, settings) {
  const existing = await getTelegramSettings(tenantId);
  const item = { 
    ...existing, 
    ...settings, 
    tenant_id: tenantId, 
    updated_at: new Date().toISOString() 
  };
  
  await dynamodb.send(new PutCommand({ 
    TableName: process.env.TELEGRAM_SETTINGS_TABLE, 
    Item: item 
  }));
  
  return item;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, pathParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  
  // Get tenant ID from authorizer (required for /telegram/settings endpoint)
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

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if (httpMethod === 'GET') {
      const settings = await getTelegramSettings(tenantId);
      
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
      const updated = await updateTelegramSettings(tenantId, settings);
      
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
      
      // Test Telegram functionality
      const settings = await getTelegramSettings(tenantId);
      
      if (!settings.enabled || !settings.botToken || !settings.chatId) {
        return { 
          statusCode: 400, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Telegram nicht konfiguriert' }) 
        };
      }
      
      try {
        // Send test message via Telegram API
        const message = '🧪 <b>Test-Nachricht</b>\n\nDeine Telegram-Integration funktioniert! ✅';
        const response = await axios.post(
          `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
          {
            chat_id: settings.chatId,
            text: message,
            parse_mode: 'HTML'
          }
        );
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'Test-Nachricht erfolgreich gesendet!',
            telegramResponse: response.data,
            resolvedTenantId: tenantId
          })
        };
      } catch (telegramError) {
        console.error('Telegram API error:', telegramError);
        return { 
          statusCode: 400, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'Fehler beim Senden der Test-Nachricht',
            error: telegramError.response?.data || telegramError.message,
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