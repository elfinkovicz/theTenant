const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONTACT_INFO_TABLE = process.env.CONTACT_INFO_TABLE_NAME;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

// Helper: Check if user is admin
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
  
  if (typeof groups === 'string') {
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

// Helper: CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
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

// Default contact info
const DEFAULT_CONTACT_INFO = [
  {
    id: 'email',
    type: 'email',
    title: 'E-Mail',
    value: 'contact@yourbrand.com',
    icon: 'mail',
    enabled: true
  },
  {
    id: 'phone',
    type: 'phone',
    title: 'Telefon',
    value: '+49 123 456789',
    icon: 'phone',
    enabled: true
  },
  {
    id: 'address',
    type: 'address',
    title: 'Adresse',
    value: 'Musterstraße 123\n12345 Musterstadt\nDeutschland',
    icon: 'mapPin',
    enabled: true
  }
];

// Initialize table with default contact info
async function initializeContactInfo() {
  console.log('Initializing contact info table with defaults');
  
  for (const info of DEFAULT_CONTACT_INFO) {
    await docClient.send(new PutCommand({
      TableName: CONTACT_INFO_TABLE,
      Item: {
        infoId: info.id,
        ...info,
        updatedAt: new Date().toISOString()
      }
    }));
  }
  
  console.log('Contact info initialized successfully');
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || event.requestContext?.routeKey?.split(' ')[0];
  const path = event.requestContext?.http?.path || event.path || event.requestContext?.path || event.rawPath || event.requestContext?.resourcePath;
  
  console.log('Detected method:', method);
  console.log('Detected path:', path);

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  try {
    // GET /contact-info - List all contact info (public)
    if (method === 'GET' && path === '/contact-info') {
      const result = await docClient.send(new ScanCommand({
        TableName: CONTACT_INFO_TABLE
      }));

      // If no contact info exists, initialize with defaults
      if (!result.Items || result.Items.length === 0) {
        await initializeContactInfo();
        const newResult = await docClient.send(new ScanCommand({
          TableName: CONTACT_INFO_TABLE
        }));
        return response(200, { contactInfo: newResult.Items || [] });
      }

      return response(200, { contactInfo: result.Items || [] });
    }

    // PUT /contact-info - Update contact info (admin only)
    if (method === 'PUT' && path === '/contact-info') {
      if (!isAdmin(event)) {
        return response(403, { error: 'Admin access required' });
      }

      const body = JSON.parse(event.body);
      const { contactInfo } = body;

      if (!Array.isArray(contactInfo)) {
        return response(400, { error: 'Invalid request: contactInfo must be an array' });
      }

      // Update each contact info item
      for (const info of contactInfo) {
        await docClient.send(new PutCommand({
          TableName: CONTACT_INFO_TABLE,
          Item: {
            infoId: info.id,
            ...info,
            updatedAt: new Date().toISOString()
          }
        }));
      }

      return response(200, { message: 'Contact info updated successfully' });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
