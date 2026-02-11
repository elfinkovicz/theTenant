/**
 * WhatsApp Settings API Lambda
 * 
 * Handles WhatsApp settings and subscriber management for tenants.
 * 
 * Endpoints:
 * - GET /tenants/{tenantId}/whatsapp/settings - Get settings
 * - PUT /tenants/{tenantId}/whatsapp/settings - Update settings
 * - GET /tenants/{tenantId}/whatsapp/subscribers - Get subscriber list
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const SUBSCRIBERS_TABLE = process.env.SUBSCRIBERS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const TENANTS_TABLE = process.env.TENANTS_TABLE;
const USER_TENANTS_TABLE = process.env.USER_TENANTS_TABLE;
const WHATSAPP_PHONE_NUMBER = process.env.WHATSAPP_PHONE_NUMBER;
const WHATSAPP_DISPLAY_NAME = process.env.WHATSAPP_DISPLAY_NAME;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
};

/**
 * Resolve tenant ID from subdomain or UUID
 */
async function resolveTenantId(tenantIdOrSubdomain) {
  if (tenantIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantIdOrSubdomain;
  }

  const subdomain = tenantIdOrSubdomain === 'platform' ? 'www' : tenantIdOrSubdomain;

  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: { ':subdomain': subdomain }
    }));

    return result.Items?.[0]?.tenant_id || tenantIdOrSubdomain;
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return tenantIdOrSubdomain;
  }
}

/**
 * Check if user is tenant admin
 */
async function isUserTenantAdmin(userId, tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    return result.Item?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin:', error);
    return false;
  }
}

/**
 * Get default settings
 */
function getDefaultSettings(tenantId) {
  return {
    tenant_id: tenantId,
    enabled: false,
    subscribeCode: null, // Will use subdomain by default
    welcomeMessage: null, // Custom welcome message
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Get tenant settings
 */
async function getSettings(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || getDefaultSettings(tenantId);
  } catch (error) {
    console.error('Error getting settings:', error);
    return getDefaultSettings(tenantId);
  }
}

/**
 * Update tenant settings
 */
async function updateSettings(tenantId, settings) {
  const existing = await getSettings(tenantId);
  const item = {
    ...existing,
    ...settings,
    tenant_id: tenantId,
    updated_at: new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({
    TableName: SETTINGS_TABLE,
    Item: item
  }));

  return item;
}

/**
 * Get subscribers for tenant
 */
async function getSubscribers(tenantId) {
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: SUBSCRIBERS_TABLE,
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: { ':tenantId': tenantId }
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error getting subscribers:', error);
    return [];
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
    console.error('Error getting tenant:', error);
    return {};
  }
}

/**
 * Lambda Handler
 */
exports.handler = async (event) => {
  console.log('WhatsApp Settings API:', JSON.stringify(event));

  const { httpMethod, pathParameters, requestContext, path } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (!authorizerTenantId) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Keine Berechtigung - Tenant ID erforderlich' })
    };
  }

  const tenantId = await resolveTenantId(authorizerTenantId);

  try {
    // Determine endpoint from path
    const isSubscribersEndpoint = path?.includes('/subscribers');
    const isTestEndpoint = path?.includes('/test');

    // POST /tenants/{tenantId}/whatsapp/test
    if (httpMethod === 'POST' && isTestEndpoint) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung' })
        };
      }

      // For now, just return success - actual test message sending requires AWS End User Messaging setup
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'WhatsApp Test-Funktion ist noch nicht verfügbar. Das WhatsApp Broadcast-System muss zuerst in der AWS Console konfiguriert werden.',
          info: 'Bitte konfiguriere die Event Destination in AWS End User Messaging Social.'
        })
      };
    }

    // GET /tenants/{tenantId}/whatsapp/subscribers
    if (httpMethod === 'GET' && isSubscribersEndpoint) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung' })
        };
      }

      const subscribers = await getSubscribers(tenantId);

      // Mask phone numbers for privacy
      const maskedSubscribers = subscribers.map(s => ({
        ...s,
        phone_number: s.phone_number.replace(/(\+\d{2})\d+(\d{4})/, '$1****$2')
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          subscribers: maskedSubscribers,
          total: subscribers.length
        })
      };
    }

    // GET /tenants/{tenantId}/whatsapp/settings
    if (httpMethod === 'GET') {
      const settings = await getSettings(tenantId);
      const tenantInfo = await getTenantInfo(tenantId);
      const subscribers = await getSubscribers(tenantId);

      // Generate subscribe code:
      // - Platform tenant (subdomain 'www'): use "VIRALTENANT"
      // - All other tenants: use their subdomain
      // - Fallback: first 8 chars of tenantId
      let subscribeCode;
      if (tenantInfo.subdomain === 'www') {
        subscribeCode = 'VIRALTENANT';
      } else if (tenantInfo.subdomain) {
        subscribeCode = tenantInfo.subdomain;
      } else {
        subscribeCode = tenantId.substring(0, 8);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...settings,
          subscriberCount: subscribers.length,
          subscribeCode: subscribeCode,
          tenantSubdomain: tenantInfo.subdomain || null,
          whatsappNumber: WHATSAPP_PHONE_NUMBER,
          whatsappDisplayName: WHATSAPP_DISPLAY_NAME,
          subscribeInstructions: `Sende "START ${subscribeCode}" an ${WHATSAPP_PHONE_NUMBER}`,
          unsubscribeInstructions: `Sende "STOP ${subscribeCode}" an ${WHATSAPP_PHONE_NUMBER}`
        })
      };
    }

    // PUT /tenants/{tenantId}/whatsapp/settings
    if (httpMethod === 'PUT') {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung' })
        };
      }

      const body = JSON.parse(event.body || '{}');

      // Only allow certain fields to be updated
      const allowedFields = ['enabled', 'welcomeMessage'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      const updated = await updateSettings(tenantId, updates);
      const subscribers = await getSubscribers(tenantId);
      const tenantInfo = await getTenantInfo(tenantId);
      
      // Same logic: Platform tenant = VIRALTENANT, others = subdomain
      let subscribeCode;
      if (tenantInfo.subdomain === 'www') {
        subscribeCode = 'VIRALTENANT';
      } else if (tenantInfo.subdomain) {
        subscribeCode = tenantInfo.subdomain;
      } else {
        subscribeCode = tenantId.substring(0, 8);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...updated,
          subscriberCount: subscribers.length,
          subscribeCode: subscribeCode,
          whatsappNumber: WHATSAPP_PHONE_NUMBER,
          whatsappDisplayName: WHATSAPP_DISPLAY_NAME
        })
      };
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
