// Shop Settings Management (Admin Only)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const kmsClient = new KMSClient({});

const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

const ADMIN_GROUP = 'admins'; // Note: Cognito group is 'admins' not 'admin'

function isAdmin(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  console.log('isAdmin check - claims:', JSON.stringify(claims));
  
  if (!claims) {
    console.log('isAdmin: No claims found');
    return false;
  }
  
  let groups = claims['cognito:groups'];
  console.log('isAdmin - raw groups:', groups, 'type:', typeof groups);
  
  if (!groups) {
    console.log('isAdmin: No groups found');
    return false;
  }
  
  // Handle different group formats
  if (typeof groups === 'string') {
    // Groups might be a string like "[admin]" or "admin"
    if (groups.startsWith('[') && groups.endsWith(']')) {
      const groupsStr = groups.slice(1, -1);
      groups = groupsStr.split(',').map(g => g.trim());
      console.log('isAdmin - extracted groups from brackets:', groups);
    } else {
      groups = [groups];
      console.log('isAdmin - single group:', groups);
    }
  }
  
  const result = groups.includes(ADMIN_GROUP);
  console.log('isAdmin result:', result, 'groups:', groups, 'looking for:', ADMIN_GROUP);
  return result;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Check admin authorization
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    const method = event.httpMethod || event.requestContext?.httpMethod;

    if (method === 'GET') {
      return await getSettings();
    } else if (method === 'PUT') {
      return await updateSettings(event);
    }

    return response(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};

async function getSettings() {
  const result = await docClient.send(new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: 'payment-config' }
  }));

  const settings = result.Item || {};

  // Return settings for admin (secrets are masked but IDs are shown)
  const safeSettings = {
    // PayPal
    paypalEnabled: settings.paypalEnabled || false,
    paypalClientId: settings.paypalClientId || '',
    paypalClientSecret: settings.paypalSecret ? '***' + settings.paypalSecret.slice(-4) : '',
    paypalMode: settings.paypalMode || 'live',
    
    // Stripe
    stripeEnabled: settings.stripeEnabled || false,
    stripePublishableKey: settings.stripe?.publishableKey || '',
    stripeSecretKey: settings.stripe?.secretKey ? '***' : '',
    stripeWebhookSecret: settings.stripe?.webhookSecret ? '***' : '',
    
    // Mollie
    mollieEnabled: settings.mollieEnabled || false,
    mollieApiKey: settings.mollie?.apiKey ? '***' : '',
    
    // General
    sellerEmail: settings.sellerEmail || '',
    sellerName: settings.sellerName || ''
  };

  return response(200, safeSettings);
}

async function updateSettings(event) {
  const body = JSON.parse(event.body);
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email || '';

  // Get existing settings to preserve secrets if not provided
  const existingResult = await docClient.send(new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: 'payment-config' }
  }));
  const existing = existingResult.Item || {};

  // Prepare settings - keep existing secrets if new ones are empty
  const settings = {
    settingKey: 'payment-config',
    
    // PayPal
    paypalEnabled: body.paypalEnabled || false,
    paypalClientId: body.paypalEnabled ? body.paypalClientId : '',
    paypalSecret: body.paypalEnabled ? 
      ((body.paypalSecret || body.paypalClientSecret) || existing.paypalSecret || '') : '',
    paypalMode: body.paypalMode || 'live',
    
    // Stripe
    stripeEnabled: body.stripeEnabled || false,
    stripe: body.stripeEnabled ? {
      publishableKey: body.stripePublishableKey,
      secretKey: body.stripeSecretKey ? await encryptValue(body.stripeSecretKey) : (existing.stripe?.secretKey || ''),
      webhookSecret: body.stripeWebhookSecret ? await encryptValue(body.stripeWebhookSecret) : (existing.stripe?.webhookSecret || '')
    } : null,
    
    // Mollie
    mollieEnabled: body.mollieEnabled || false,
    mollie: body.mollieEnabled ? {
      apiKey: body.mollieApiKey ? await encryptValue(body.mollieApiKey) : (existing.mollie?.apiKey || '')
    } : null,
    
    // General
    sellerEmail: body.sellerEmail,
    sellerName: body.sellerName,
    updatedAt: Date.now(),
    updatedBy: userEmail
  };

  await docClient.send(new PutCommand({
    TableName: SETTINGS_TABLE,
    Item: settings
  }));

  console.log('Settings updated by:', userEmail);

  return response(200, { success: true });
}

async function encryptValue(plaintext) {
  if (!plaintext) return '';

  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext)
  });

  const result = await kmsClient.send(command);
  return Buffer.from(result.CiphertextBlob).toString('base64');
}

async function decryptValue(ciphertext) {
  if (!ciphertext) return '';

  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64')
  });

  const result = await kmsClient.send(command);
  return Buffer.from(result.Plaintext).toString('utf-8');
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
