const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const VIDEOS_TABLE = process.env.VIDEOS_TABLE_NAME;
const VIDEOS_BUCKET = process.env.VIDEOS_BUCKET_NAME;
const THUMBNAILS_BUCKET = process.env.THUMBNAILS_BUCKET_NAME;
const THUMBNAILS_CDN_URL = process.env.THUMBNAILS_CDN_URL;
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
  
  // API Gateway JWT Authorizer returns groups as a string like "[admins]" or "admins"
  // We need to parse it
  if (typeof groups === 'string') {
    // Remove brackets and split by comma if it's in format "[group1,group2]"
    if (groups.startsWith('[') && groups.endsWith(']')) {
      // Remove brackets and split
      const groupsStr = groups.slice(1, -1);
      groups = groupsStr.split(',').map(g => g.trim());
      console.log('isAdmin - extracted groups from brackets:', groups);
    } else {
      // Single group without brackets
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

// GET /videos - List all published videos (public)
async function listVideos(event) {
  try {
    const command = new QueryCommand({
      TableName: VIDEOS_TABLE,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'published'
      },
      ScanIndexForward: false // newest first
    });

    const result = await dynamodb.send(command);
    
    // Generate signed URLs for videos (1 hour expiry)
    const videos = await Promise.all(result.Items.map(async (video) => {
      const getObjectCommand = new GetObjectCommand({
        Bucket: VIDEOS_BUCKET,
        Key: video.s3Key
      });
      
      const videoUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });

      return {
        ...video,
        videoUrl,
        thumbnailUrl: video.thumbnailKey 
          ? `${THUMBNAILS_CDN_URL}/${video.thumbnailKey}`
          : null
      };
    }));

    return response(200, { videos });
  } catch (error) {
    console.error('Error listing videos:', error);
    return response(500, { error: 'Failed to list videos' });
  }
}

// GET /videos/{videoId} - Get single video
async function getVideo(event) {
  try {
    const videoId = event.pathParameters?.videoId;
    
    const getCommand = new GetCommand({
      TableName: VIDEOS_TABLE,
      Key: { videoId }
    });

    const result = await dynamodb.send(getCommand);
    
    if (!result.Item) {
      return response(404, { error: 'Video not found' });
    }

    const video = result.Item;

    // Only return published videos to non-admins
    if (video.status !== 'published' && !isAdmin(event)) {
      return response(404, { error: 'Video not found' });
    }

    // Generate signed URL
    const getObjectCommand = new GetObjectCommand({
      Bucket: VIDEOS_BUCKET,
      Key: video.s3Key
    });
    const videoUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });

    // Increment view count
    const updateCommand = new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { videoId },
      UpdateExpression: 'SET #views = if_not_exists(#views, :zero) + :inc',
      ExpressionAttributeNames: {
        '#views': 'views'
      },
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1
      }
    });
    await dynamodb.send(updateCommand);

    return response(200, {
      video: {
        ...video,
        videoUrl,
        thumbnailUrl: video.thumbnailKey 
          ? `${THUMBNAILS_CDN_URL}/${video.thumbnailKey}`
          : null
      }
    });
  } catch (error) {
    console.error('Error getting video:', error);
    return response(500, { error: 'Failed to get video' });
  }
}

// POST /videos/upload-url - Generate presigned upload URL (admin only)
async function generateUploadUrl(event) {
  if (!isAdmin(event)) {
    return response(403, { error: 'Forbidden: Admin access required' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { fileName, fileType, contentType, videoId: existingVideoId } = body;

    if (!fileName || !contentType) {
      return response(400, { error: 'fileName and contentType required' });
    }

    // If uploading thumbnail for existing video, use existing videoId
    // Otherwise generate new videoId for video upload
    const videoId = (fileType === 'thumbnail' && existingVideoId) ? existingVideoId : uuidv4();
    
    let uploadUrl, s3Key, thumbnailKey;

    if (fileType === 'thumbnail') {
      // Thumbnail upload
      const fileExtension = fileName.split('.').pop();
      thumbnailKey = `thumbnails/${videoId}.${fileExtension}`;
      const thumbnailPutCommand = new PutObjectCommand({
        Bucket: THUMBNAILS_BUCKET,
        Key: thumbnailKey,
        ContentType: contentType
      });
      uploadUrl = await getSignedUrl(s3Client, thumbnailPutCommand, { expiresIn: 900 });
      
      return response(200, {
        videoId,
        uploadUrl,
        thumbnailKey
      });
    } else {
      // Video upload
      const fileExtension = fileName.split('.').pop();
      s3Key = `videos/${videoId}.${fileExtension}`;
      const putObjectCommand = new PutObjectCommand({
        Bucket: VIDEOS_BUCKET,
        Key: s3Key,
        ContentType: contentType
      });
      uploadUrl = await getSignedUrl(s3Client, putObjectCommand, { expiresIn: 900 });

      return response(200, {
        videoId,
        uploadUrl,
        s3Key
      });
    }
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return response(500, { error: 'Failed to generate upload URL' });
  }
}

// POST /videos - Create video metadata (admin only)
async function createVideo(event) {
  if (!isAdmin(event)) {
    return response(403, { error: 'Forbidden: Admin access required' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { videoId, title, description, category, s3Key, thumbnailKey, duration, fileSize, status } = body;

    if (!videoId || !title || !s3Key) {
      return response(400, { error: 'videoId, title, and s3Key required' });
    }

    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const uploadedBy = claims?.sub || 'unknown';

    const video = {
      videoId,
      title,
      description: description || '',
      category: category || 'Uncategorized',
      s3Key,
      thumbnailKey: thumbnailKey || null,
      duration: duration || 0,
      fileSize: fileSize || 0,
      views: 0,
      status: status || 'draft',
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const putCommand = new PutCommand({
      TableName: VIDEOS_TABLE,
      Item: video
    });
    await dynamodb.send(putCommand);

    return response(201, { video });
  } catch (error) {
    console.error('Error creating video:', error);
    return response(500, { error: 'Failed to create video' });
  }
}

// PUT /videos/{videoId} - Update video (admin only)
async function updateVideo(event) {
  if (!isAdmin(event)) {
    return response(403, { error: 'Forbidden: Admin access required' });
  }

  try {
    const videoId = event.pathParameters?.videoId;
    const body = JSON.parse(event.body || '{}');
    const { title, description, category, thumbnailKey, status } = body;

    // Build update expression
    const updates = [];
    const attributeNames = {};
    const attributeValues = {};

    if (title) {
      updates.push('#title = :title');
      attributeNames['#title'] = 'title';
      attributeValues[':title'] = title;
    }
    if (description !== undefined) {
      updates.push('#description = :description');
      attributeNames['#description'] = 'description';
      attributeValues[':description'] = description;
    }
    if (category) {
      updates.push('#category = :category');
      attributeNames['#category'] = 'category';
      attributeValues[':category'] = category;
    }
    if (thumbnailKey !== undefined) {
      updates.push('#thumbnailKey = :thumbnailKey');
      attributeNames['#thumbnailKey'] = 'thumbnailKey';
      attributeValues[':thumbnailKey'] = thumbnailKey;
    }
    if (status) {
      updates.push('#status = :status');
      attributeNames['#status'] = 'status';
      attributeValues[':status'] = status;
    }

    updates.push('#updatedAt = :updatedAt');
    attributeNames['#updatedAt'] = 'updatedAt';
    attributeValues[':updatedAt'] = new Date().toISOString();

    const updateCommand = new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { videoId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamodb.send(updateCommand);

    return response(200, { video: result.Attributes });
  } catch (error) {
    console.error('Error updating video:', error);
    return response(500, { error: 'Failed to update video' });
  }
}

// DELETE /videos/{videoId} - Delete video (admin only)
async function deleteVideo(event) {
  if (!isAdmin(event)) {
    return response(403, { error: 'Forbidden: Admin access required' });
  }

  try {
    const videoId = event.pathParameters?.videoId;

    // Get video to find S3 keys
    const getCommand = new GetCommand({
      TableName: VIDEOS_TABLE,
      Key: { videoId }
    });

    const result = await dynamodb.send(getCommand);
    
    if (!result.Item) {
      return response(404, { error: 'Video not found' });
    }

    const video = result.Item;

    // Delete from S3
    if (video.s3Key) {
      const deleteVideoCommand = new DeleteObjectCommand({
        Bucket: VIDEOS_BUCKET,
        Key: video.s3Key
      });
      await s3Client.send(deleteVideoCommand);
    }

    if (video.thumbnailKey) {
      const deleteThumbnailCommand = new DeleteObjectCommand({
        Bucket: THUMBNAILS_BUCKET,
        Key: video.thumbnailKey
      });
      await s3Client.send(deleteThumbnailCommand);
    }

    // Delete from DynamoDB
    const deleteCommand = new DeleteCommand({
      TableName: VIDEOS_TABLE,
      Key: { videoId }
    });
    await dynamodb.send(deleteCommand);

    return response(200, { message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    return response(500, { error: 'Failed to delete video' });
  }
}

// Main handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Request Context:', JSON.stringify(event.requestContext, null, 2));

  // Support both API Gateway v1 and v2 formats
  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || event.requestContext?.routeKey?.split(' ')[0];
  const path = event.requestContext?.http?.path || event.path || event.requestContext?.path || event.rawPath || event.requestContext?.resourcePath;
  
  console.log('Detected method:', method);
  console.log('Detected path:', path);

  try {
    // Route requests
    if (method === 'GET' && path === '/videos') {
      return await listVideos(event);
    }
    
    if (method === 'GET' && path.match(/^\/videos\/[^/]+$/)) {
      return await getVideo(event);
    }
    
    if (method === 'POST' && path === '/videos/upload-url') {
      return await generateUploadUrl(event);
    }
    
    if (method === 'POST' && path === '/videos') {
      return await createVideo(event);
    }
    
    if (method === 'PUT' && path.match(/^\/videos\/[^/]+$/)) {
      return await updateVideo(event);
    }
    
    if (method === 'DELETE' && path.match(/^\/videos\/[^/]+$/)) {
      return await deleteVideo(event);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Unhandled error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
