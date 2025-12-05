const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const ADS_TABLE = process.env.ADS_TABLE_NAME;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

const AD_TOP_ID = 'live-page-ad-top'; // Top banner
const AD_BOTTOM_ID = 'live-page-ad-bottom'; // Bottom banner

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

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Request Context:', JSON.stringify(event.requestContext, null, 2));

  // Support both API Gateway v1 and v2 formats
  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || event.requestContext?.routeKey?.split(' ')[0];
  const path = event.requestContext?.http?.path || event.path || event.requestContext?.path || event.rawPath || event.requestContext?.resourcePath;
  
  console.log('Detected method:', method);
  console.log('Detected path:', path);

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  try {
    // GET /advertisement - Get both ads (public)
    if (method === 'GET' && path === '/advertisement') {
      // Get top banner
      const topResult = await docClient.send(new GetCommand({
        TableName: ADS_TABLE,
        Key: { adId: AD_TOP_ID }
      }));

      // Get bottom banner
      const bottomResult = await docClient.send(new GetCommand({
        TableName: ADS_TABLE,
        Key: { adId: AD_BOTTOM_ID }
      }));

      const topAd = topResult.Item ? {
        ...topResult.Item,
        imageUrl: topResult.Item.imageKey ? `https://${CDN_DOMAIN}/${topResult.Item.imageKey}` : null
      } : {
        adId: AD_TOP_ID,
        imageUrl: null,
        linkUrl: null,
        enabled: false
      };

      const bottomAd = bottomResult.Item ? {
        ...bottomResult.Item,
        imageUrl: bottomResult.Item.imageKey ? `https://${CDN_DOMAIN}/${bottomResult.Item.imageKey}` : null
      } : {
        adId: AD_BOTTOM_ID,
        imageUrl: null,
        linkUrl: null,
        enabled: false
      };

      return response(200, { 
        topBanner: topAd,
        bottomBanner: bottomAd,
        // Backward compatibility
        advertisement: topAd
      });
    }

    // All other routes require admin authentication
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    // PUT /advertisement - Update ad (supports position parameter)
    if (method === 'PUT' && path === '/advertisement') {
      const body = JSON.parse(event.body);
      const position = body.position || 'top'; // 'top' or 'bottom'
      const adId = position === 'bottom' ? AD_BOTTOM_ID : AD_TOP_ID;

      const ad = {
        adId,
        position,
        imageKey: body.imageKey || null,
        linkUrl: body.linkUrl || null,
        enabled: body.enabled !== undefined ? body.enabled : true,
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: ADS_TABLE,
        Item: ad
      }));

      return response(200, { 
        message: 'Advertisement updated',
        advertisement: {
          ...ad,
          imageUrl: ad.imageKey ? `https://${CDN_DOMAIN}/${ad.imageKey}` : null
        }
      });
    }

    // POST /advertisement/upload-url - Generate presigned URL for image upload
    if (method === 'POST' && path === '/advertisement/upload-url') {
      const body = JSON.parse(event.body);
      const { fileName, fileType, position } = body;
      const positionPrefix = position || 'top';

      const imageKey = `advertisements/${positionPrefix}/${Date.now()}_${fileName}`;
      const command = new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: imageKey,
        ContentType: fileType
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return response(200, {
        uploadUrl,
        imageKey,
        imageUrl: `https://${CDN_DOMAIN}/${imageKey}`
      });
    }

    // DELETE /advertisement/image - Delete ad image (supports position parameter)
    if (method === 'DELETE' && path === '/advertisement/image') {
      const body = event.body ? JSON.parse(event.body) : {};
      const position = body.position || 'top';
      const adId = position === 'bottom' ? AD_BOTTOM_ID : AD_TOP_ID;

      const result = await docClient.send(new GetCommand({
        TableName: ADS_TABLE,
        Key: { adId }
      }));

      if (result.Item && result.Item.imageKey) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: IMAGES_BUCKET,
          Key: result.Item.imageKey
        }));

        await docClient.send(new UpdateCommand({
          TableName: ADS_TABLE,
          Key: { adId },
          UpdateExpression: 'SET imageKey = :null, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':null': null,
            ':updatedAt': new Date().toISOString()
          }
        }));
      }

      return response(200, { message: 'Advertisement image deleted' });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
