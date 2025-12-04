const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TEAM_TABLE = process.env.TEAM_TABLE_NAME;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

// Helper: Check if user is admin (from JWT claims provided by API Gateway)
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
  
  // API Gateway JWT Authorizer returns groups as a string like "[admins]" or "admins"
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
    // GET /team - List all team members (public)
    if (method === 'GET' && path === '/team') {
      const result = await docClient.send(new ScanCommand({
        TableName: TEAM_TABLE
      }));

      const members = (result.Items || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(member => ({
          ...member,
          imageUrl: member.imageKey ? `https://${CDN_DOMAIN}/${member.imageKey}` : null
        }));

      return response(200, { members });
    }

    // All other routes require admin authentication (checked by API Gateway JWT Authorizer)
    // Just verify the user is in the admin group
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    // POST /team - Create new team member
    if (method === 'POST' && path === '/team') {
      const body = JSON.parse(event.body);
      const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const member = {
        memberId,
        name: body.name,
        role: body.role,
        bio: body.bio,
        imageKey: body.imageKey || null,
        socials: body.socials || {},
        order: body.order || 999,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: TEAM_TABLE,
        Item: member
      }));

      return response(201, { member });
    }

    // PUT /team/{memberId} - Update team member
    if (method === 'PUT' && path.startsWith('/team/')) {
      const memberId = path.split('/')[2];
      const body = JSON.parse(event.body);

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      if (body.name !== undefined) {
        updateExpression.push('#name = :name');
        expressionAttributeNames['#name'] = 'name';
        expressionAttributeValues[':name'] = body.name;
      }
      if (body.role !== undefined) {
        updateExpression.push('#role = :role');
        expressionAttributeNames['#role'] = 'role';
        expressionAttributeValues[':role'] = body.role;
      }
      if (body.bio !== undefined) {
        updateExpression.push('bio = :bio');
        expressionAttributeValues[':bio'] = body.bio;
      }
      if (body.imageKey !== undefined) {
        updateExpression.push('imageKey = :imageKey');
        expressionAttributeValues[':imageKey'] = body.imageKey;
      }
      if (body.socials !== undefined) {
        updateExpression.push('socials = :socials');
        expressionAttributeValues[':socials'] = body.socials;
      }
      if (body.order !== undefined) {
        updateExpression.push('#order = :order');
        expressionAttributeNames['#order'] = 'order';
        expressionAttributeValues[':order'] = body.order;
      }

      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: TEAM_TABLE,
        Key: { memberId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      return response(200, { message: 'Team member updated' });
    }

    // DELETE /team/{memberId} - Delete team member
    if (method === 'DELETE' && path.startsWith('/team/')) {
      const memberId = path.split('/')[2];

      // Get member to delete image
      const result = await docClient.send(new GetCommand({
        TableName: TEAM_TABLE,
        Key: { memberId }
      }));

      if (result.Item && result.Item.imageKey) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: IMAGES_BUCKET,
          Key: result.Item.imageKey
        }));
      }

      await docClient.send(new DeleteCommand({
        TableName: TEAM_TABLE,
        Key: { memberId }
      }));

      return response(200, { message: 'Team member deleted' });
    }

    // POST /team/upload-url - Generate presigned URL for image upload
    if (method === 'POST' && path === '/team/upload-url') {
      const body = JSON.parse(event.body);
      const { fileName, fileType } = body;

      const imageKey = `team/${Date.now()}_${fileName}`;
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

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
