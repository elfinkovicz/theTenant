const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CHANNELS_TABLE = process.env.CHANNELS_TABLE_NAME;
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

// Default channels configuration
const DEFAULT_CHANNELS = [
  { id: 'spotify', name: '@yourchannel', platform: 'Spotify', url: 'https://open.spotify.com/artist/yourchannel', followers: '50K', description: 'Listen to our music and playlists', color: '#1DB954', iconType: 'spotify', category: 'Musik-Streaming', enabled: true },
  { id: 'youtube', name: '@YourChannel', platform: 'YouTube', url: 'https://youtube.com/@yourchannel', followers: '100K', description: 'Subscribe for videos and live streams', color: '#FF0000', iconType: 'youtube', category: 'Video & Livestreaming', enabled: true },
  { id: 'tiktok', name: '@yourchannel', platform: 'TikTok', url: 'https://tiktok.com/@yourchannel', followers: '200K', description: 'Short videos and trending content', color: '#000000', iconType: 'tiktok', category: 'Social Media', enabled: true },
  { id: 'instagram', name: '@yourchannel', platform: 'Instagram', url: 'https://instagram.com/yourchannel', followers: '75K', description: 'Photos, Reels and Stories', color: '#E4405F', iconType: 'instagram', category: 'Social Media', enabled: true },
  { id: 'twitch', name: 'YourChannel', platform: 'Twitch', url: 'https://twitch.tv/yourchannel', followers: '50K', description: 'Watch live streams', color: '#9146FF', iconType: 'twitch', category: 'Video & Livestreaming', enabled: true },
  { id: 'discord', name: 'Your Server', platform: 'Discord', url: 'https://discord.gg/yourchannel', followers: '25K', description: 'Community chat and voice', color: '#5865F2', iconType: 'discord', category: 'Gaming & Interactive', enabled: true },
  { id: 'twitter', name: '@yourchannel', platform: 'X (Twitter)', url: 'https://x.com/yourchannel', followers: '45K', description: 'Latest updates and news', color: '#000000', iconType: 'twitter', category: 'Social Media', enabled: true },
  { id: 'facebook', name: 'Your Channel', platform: 'Facebook', url: 'https://facebook.com/yourchannel', followers: '60K', description: 'Community and updates', color: '#1877F2', iconType: 'facebook', category: 'Social Media', enabled: true },
];

// Initialize table with default channels
async function initializeChannels() {
  console.log('Initializing channels table with defaults');
  
  const putRequests = DEFAULT_CHANNELS.map(channel => ({
    PutRequest: {
      Item: {
        channelId: channel.id,
        ...channel,
        updatedAt: new Date().toISOString()
      }
    }
  }));

  // DynamoDB BatchWrite can handle max 25 items at once
  for (let i = 0; i < putRequests.length; i += 25) {
    const batch = putRequests.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [CHANNELS_TABLE]: batch
      }
    }));
  }
  
  console.log('Channels initialized successfully');
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
    // GET /channels - List all channels (public)
    if (method === 'GET' && path === '/channels') {
      const result = await docClient.send(new ScanCommand({
        TableName: CHANNELS_TABLE
      }));

      // If no channels exist, initialize with defaults
      if (!result.Items || result.Items.length === 0) {
        await initializeChannels();
        const newResult = await docClient.send(new ScanCommand({
          TableName: CHANNELS_TABLE
        }));
        return response(200, { channels: newResult.Items || [] });
      }

      return response(200, { channels: result.Items || [] });
    }

    // PUT /channels - Update channels (admin only)
    if (method === 'PUT' && path === '/channels') {
      if (!isAdmin(event)) {
        return response(403, { error: 'Admin access required' });
      }

      const body = JSON.parse(event.body);
      const { channels } = body;

      if (!Array.isArray(channels)) {
        return response(400, { error: 'Invalid request: channels must be an array' });
      }

      // Update each channel
      for (const channel of channels) {
        await docClient.send(new PutCommand({
          TableName: CHANNELS_TABLE,
          Item: {
            channelId: channel.id,
            ...channel,
            updatedAt: new Date().toISOString()
          }
        }));
      }

      return response(200, { message: 'Channels updated successfully' });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
