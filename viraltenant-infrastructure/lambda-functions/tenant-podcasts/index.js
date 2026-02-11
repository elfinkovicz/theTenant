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

async function resolveTenantId(tenantIdOrSubdomain) {
  if (tenantIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantIdOrSubdomain;
  }
  
  try {
    const params = {
      TableName: process.env.TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: { ':subdomain': tenantIdOrSubdomain }
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    if (result.Items && result.Items.length > 0) {
      return result.Items[0].tenant_id;
    }
  } catch (error) {
    console.error('Error resolving subdomain:', error);
  }
  
  return tenantIdOrSubdomain;
}

async function isUserTenantAdmin(userId, tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    return result.Item && result.Item.role === 'admin';
  } catch (error) {
    console.error('Error checking admin:', error);
    return false;
  }
}

const getDefaultData = (tenantId) => ({
  tenant_id: tenantId,
  podcasts: [],
  categories: [],
  settings: { autoplay: false },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (data.podcasts) {
    data.podcasts = data.podcasts.map(podcast => ({
      ...podcast,
      thumbnailUrl: podcast.thumbnailKey ? `https://${cfDomain}/${podcast.thumbnailKey}` : podcast.thumbnailUrl,
      audioUrl: podcast.audioKey ? `https://${cfDomain}/${podcast.audioKey}` : podcast.audioUrl
    }));
  }
  return data;
};

async function getPodcasts(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_PODCASTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return enrichWithUrls(result.Item || getDefaultData(tenantId));
  } catch (error) {
    console.error('Error getting podcasts:', error);
    return getDefaultData(tenantId);
  }
}

async function updatePodcasts(tenantId, updates) {
  const existing = await getPodcasts(tenantId);
  const item = {
    ...existing,
    ...updates,
    tenant_id: tenantId,
    updated_at: new Date().toISOString()
  };
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_PODCASTS_TABLE, Item: item }));
  return enrichWithUrls(item);
}

async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const extension = fileName.split('.').pop();
  const timestamp = Date.now();
  const key = `tenants/${tenantId}/podcasts/${uploadType}-${timestamp}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  return { uploadUrl, key, publicUrl };
}

async function deleteFile(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key }));
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const rawTenantId = authorizerTenantId || pathParameters?.tenantId;
  
  const tenantId = await resolveTenantId(rawTenantId);

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // GET /tenants/{tenantId}/podcasts - Public
    if (httpMethod === 'GET' && !path.includes('/upload-url')) {
      const data = await getPodcasts(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ ...data, resolvedTenantId: tenantId })
      };
    }

    // PUT /tenants/{tenantId}/podcasts - Admin only
    if (httpMethod === 'PUT' && !path.includes('/upload-url')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const body = JSON.parse(event.body || '{}');
      const updated = await updatePodcasts(tenantId, body);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ ...updated, resolvedTenantId: tenantId }) 
      };
    }

    // POST /tenants/{tenantId}/podcasts/upload-url - Admin only
    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const { fileName, fileType, uploadType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      const result = await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'audio');
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // DELETE /tenants/{tenantId}/podcasts/asset - Admin only
    if (httpMethod === 'DELETE' && path.includes('/asset')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const { key } = JSON.parse(event.body || '{}');
      await deleteFile(key);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Asset gelöscht' }) };
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
  }
};
