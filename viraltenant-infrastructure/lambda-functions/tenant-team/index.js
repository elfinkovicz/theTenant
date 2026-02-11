const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });

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

const getDefaultData = (tenantId) => ({
  tenant_id: tenantId,
  members: [],
  roles: ['Admin', 'Moderator', 'Member'],
  settings: { showSocialLinks: true, displayOrder: 'role' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  if (data.members) {
    data.members = data.members.map(member => {
      // Generate imageUrl from imageKey or avatarKey
      const imageUrl = member.imageKey 
        ? `https://${cfDomain}/${member.imageKey}` 
        : member.avatarKey 
          ? `https://${cfDomain}/${member.avatarKey}`
          : member.imageUrl || member.avatarUrl || null;
      
      return {
        ...member,
        imageUrl: imageUrl,
        avatarUrl: imageUrl // Keep for backwards compatibility
      };
    });
  }
  return data;
};

async function getTeam(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_TEAM_TABLE, Key: { tenant_id: tenantId }
    }));
    return enrichWithUrls(result.Item || getDefaultData(tenantId));
  } catch (error) { return getDefaultData(tenantId); }
}

async function updateTeam(tenantId, updates) {
  const existing = await getTeam(tenantId);
  const item = { ...existing, ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_TEAM_TABLE, Item: item }));
  return enrichWithUrls(item);
}

async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const ext = fileName.split('.').pop();
  const key = `tenants/${tenantId}/team/${uploadType}-${Date.now()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, key, publicUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}` };
}

async function deleteFile(key) {
  if (!key) return;
  try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key })); } catch (e) {}
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const rawTenantId = authorizerTenantId || pathParameters?.tenantId;
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(rawTenantId);
  console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);

  if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  try {
    if (httpMethod === 'GET' && !path.includes('/upload-url')) {
      const data = await getTeam(tenantId);
      
      // Return the resolved tenant ID so frontend knows where data is stored
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...data,
          resolvedTenantId: tenantId // Use the actual resolved tenant ID (UUID)
        })
      };
    }

    if (httpMethod === 'PUT' && !path.includes('/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const updated = await updateTeam(tenantId, JSON.parse(event.body || '{}'));
      
      // Return the resolved tenant ID so frontend knows where data is stored
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...updated,
          resolvedTenantId: tenantId // Use the actual resolved tenant ID (UUID)
        })
      };
    }

    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const { fileName, fileType, uploadType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'avatar')) };
    }

    if (httpMethod === 'DELETE' && path.includes('/asset')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      await deleteFile(JSON.parse(event.body || '{}').key);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Asset gelöscht' }) };
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
  }
};
