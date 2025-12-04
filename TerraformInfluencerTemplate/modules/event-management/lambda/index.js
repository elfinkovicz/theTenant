const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const EVENTS_TABLE = process.env.EVENTS_TABLE_NAME;
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
    // GET /events - List all published events (public)
    if (method === 'GET' && path === '/events') {
      const result = await docClient.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        IndexName: 'StatusDateIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'published'
        },
        ScanIndexForward: true // oldest first (upcoming events)
      }));

      const events = (result.Items || []).map(evt => ({
        ...evt,
        imageUrl: evt.imageKey ? `https://${CDN_DOMAIN}/${evt.imageKey}` : null
      }));

      return response(200, { events });
    }

    // GET /events/{eventId} - Get single event (public)
    if (method === 'GET' && path.startsWith('/events/')) {
      const eventId = path.split('/')[2];

      const result = await docClient.send(new GetCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));

      if (!result.Item) {
        return response(404, { error: 'Event not found' });
      }

      const evt = {
        ...result.Item,
        imageUrl: result.Item.imageKey ? `https://${CDN_DOMAIN}/${result.Item.imageKey}` : null
      };

      return response(200, { event: evt });
    }

    // All other routes require admin authentication (checked by API Gateway JWT Authorizer)
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    // POST /events - Create new event
    if (method === 'POST' && path === '/events') {
      const body = JSON.parse(event.body);
      const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const evt = {
        eventId,
        title: body.title,
        description: body.description,
        eventDate: body.eventDate,
        eventTime: body.eventTime || null,
        location: body.location || null,
        locationUrl: body.locationUrl || null,
        imageKey: body.imageKey || null,
        ticketUrl: body.ticketUrl || null,
        status: body.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: EVENTS_TABLE,
        Item: evt
      }));

      return response(201, { event: evt });
    }

    // PUT /events/{eventId} - Update event
    if (method === 'PUT' && path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      const body = JSON.parse(event.body);

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      if (body.title !== undefined) {
        updateExpression.push('title = :title');
        expressionAttributeValues[':title'] = body.title;
      }
      if (body.description !== undefined) {
        updateExpression.push('description = :description');
        expressionAttributeValues[':description'] = body.description;
      }
      if (body.eventDate !== undefined) {
        updateExpression.push('eventDate = :eventDate');
        expressionAttributeValues[':eventDate'] = body.eventDate;
      }
      if (body.eventTime !== undefined) {
        updateExpression.push('eventTime = :eventTime');
        expressionAttributeValues[':eventTime'] = body.eventTime;
      }
      if (body.location !== undefined) {
        updateExpression.push('#location = :location');
        expressionAttributeNames['#location'] = 'location';
        expressionAttributeValues[':location'] = body.location;
      }
      if (body.locationUrl !== undefined) {
        updateExpression.push('locationUrl = :locationUrl');
        expressionAttributeValues[':locationUrl'] = body.locationUrl;
      }
      if (body.imageKey !== undefined) {
        updateExpression.push('imageKey = :imageKey');
        expressionAttributeValues[':imageKey'] = body.imageKey;
      }
      if (body.ticketUrl !== undefined) {
        updateExpression.push('ticketUrl = :ticketUrl');
        expressionAttributeValues[':ticketUrl'] = body.ticketUrl;
      }
      if (body.status !== undefined) {
        updateExpression.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = body.status;
      }

      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      return response(200, { message: 'Event updated' });
    }

    // DELETE /events/{eventId} - Delete event
    if (method === 'DELETE' && path.startsWith('/events/')) {
      const eventId = path.split('/')[2];

      // Get event to delete image
      const result = await docClient.send(new GetCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));

      if (result.Item && result.Item.imageKey) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: IMAGES_BUCKET,
          Key: result.Item.imageKey
        }));
      }

      await docClient.send(new DeleteCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));

      return response(200, { message: 'Event deleted' });
    }

    // POST /events/upload-url - Generate presigned URL for image upload
    if (method === 'POST' && path === '/events/upload-url') {
      const body = JSON.parse(event.body);
      const { fileName, fileType } = body;

      const imageKey = `events/${Date.now()}_${fileName}`;
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
