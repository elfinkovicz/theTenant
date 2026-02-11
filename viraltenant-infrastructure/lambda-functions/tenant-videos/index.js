const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });
const lambda = new LambdaClient({ region: process.env.REGION });

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

// Check if user is tenant admin
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

// Get default videos data
const getDefaultData = (tenantId) => ({
  tenant_id: tenantId,
  videos: [],
  categories: [],
  settings: { autoplay: false, defaultQuality: '720p' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Convert S3 keys to CloudFront URLs
const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (data.videos) {
    data.videos = data.videos.map(video => ({
      ...video,
      thumbnailUrl: video.thumbnailKey ? `https://${cfDomain}/${video.thumbnailKey}` : video.thumbnailUrl,
      videoUrl: video.s3Key ? `https://${cfDomain}/${video.s3Key}` : video.videoUrl
    }));
  }
  return data;
};

// Get videos data
async function getVideos(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_VIDEOS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return enrichWithUrls(result.Item || getDefaultData(tenantId));
  } catch (error) {
    console.error('Error getting videos:', error);
    return getDefaultData(tenantId);
  }
}

// Update videos data
async function updateVideos(tenantId, updates) {
  const existing = await getVideos(tenantId);
  const item = {
    ...existing,
    ...updates,
    tenant_id: tenantId,
    updated_at: new Date().toISOString()
  };
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_VIDEOS_TABLE, Item: item }));
  return enrichWithUrls(item);
}

// Generate presigned upload URL
async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const extension = fileName.split('.').pop();
  const timestamp = Date.now();
  const key = `tenants/${tenantId}/videos/${uploadType}-${timestamp}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  return { uploadUrl, key, publicUrl };
}

// Delete file from S3
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
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(rawTenantId);
  console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // GET /tenants/{tenantId}/videos - Public
    if (httpMethod === 'GET' && !path.includes('/upload-url')) {
      const data = await getVideos(tenantId);
      
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

    // PUT /tenants/{tenantId}/videos - Admin only
    if (httpMethod === 'PUT' && !path.includes('/upload-url')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' }) };
      }
      
      const body = JSON.parse(event.body || '{}');
      const updated = await updateVideos(tenantId, body);
      
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

    // POST /tenants/{tenantId}/videos/extract-frames - Admin only
    if (httpMethod === 'POST' && path.includes('/extract-frames')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' }) };
      }
      
      const { videoKey, interval = 5, maxFrames = 20 } = JSON.parse(event.body || '{}');
      if (!videoKey) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'videoKey erforderlich' }) };
      }
      
      // Invoke video-frame-extractor Lambda
      const invokeParams = {
        FunctionName: process.env.FRAME_EXTRACTOR_FUNCTION,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          videoKey,
          tenantId,
          interval,
          maxFrames,
          bucket: process.env.ASSETS_BUCKET,
          cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN
        })
      };
      
      const invokeResult = await lambda.send(new InvokeCommand(invokeParams));
      const payload = JSON.parse(Buffer.from(invokeResult.Payload).toString());
      
      if (payload.statusCode !== 200) {
        return { 
          statusCode: payload.statusCode || 500, 
          headers: corsHeaders, 
          body: payload.body || JSON.stringify({ message: 'Frame-Extraktion fehlgeschlagen' })
        };
      }
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: payload.body 
      };
    }

    // POST /tenants/{tenantId}/videos/upload-url - Admin only
    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' }) };
      }
      
      const { fileName, fileType, uploadType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      const result = await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'video');
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // DELETE /tenants/{tenantId}/videos/asset - Admin only
    if (httpMethod === 'DELETE' && path.includes('/asset')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' }) };
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
