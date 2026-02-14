/**
 * Crosspost Dispatcher Lambda
 * 
 * This Lambda is invoked asynchronously by the newsfeed Lambda when a post is created.
 * It dispatches crossposting to individual channel Lambdas in parallel.
 * 
 * Uses central dependencies from Lambda Layer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const lambda = new LambdaClient({ region: process.env.REGION });

// Channel configurations - each channel has its own Lambda
const CHANNELS = {
  telegram: {
    settingsTable: process.env.TELEGRAM_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_TELEGRAM,
    checkEnabled: (s) => s.enabled && s.botToken && s.chatId
  },
  discord: {
    settingsTable: process.env.DISCORD_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_DISCORD,
    checkEnabled: (s) => s.enabled && s.webhookUrl
  },
  slack: {
    settingsTable: process.env.SLACK_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_SLACK,
    checkEnabled: (s) => s.enabled && s.webhookUrl
  },
  facebook: {
    settingsTable: process.env.FACEBOOK_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_FACEBOOK,
    checkEnabled: (s) => s.enabled && s.pageAccessToken && s.pageId
  },
  instagram: {
    settingsTable: process.env.INSTAGRAM_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_INSTAGRAM,
    checkEnabled: (s) => s.enabled && s.accessToken && s.accountId
  },
  xtwitter: {
    settingsTable: process.env.XTWITTER_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_XTWITTER,
    checkEnabled: (s) => s.enabled && (s.oauth2AccessToken || (s.apiKey && s.accessToken))
  },
  linkedin: {
    settingsTable: process.env.LINKEDIN_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_LINKEDIN,
    checkEnabled: (s) => s.enabled && s.accessToken
  },
  youtube: {
    settingsTable: process.env.YOUTUBE_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_YOUTUBE,
    checkEnabled: (s) => s.enabled && s.accessToken,
    filter: (post) => post.isShort && post.videoKey // YouTube only for Shorts
  },
  bluesky: {
    settingsTable: process.env.BLUESKY_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_BLUESKY,
    checkEnabled: (s) => s.enabled && s.handle && s.appPassword
  },
  mastodon: {
    settingsTable: process.env.MASTODON_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_MASTODON,
    checkEnabled: (s) => s.enabled && s.instanceUrl && s.accessToken
  },
  tiktok: {
    settingsTable: process.env.TIKTOK_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_TIKTOK,
    checkEnabled: (s) => s.enabled && s.accessToken,
    // TikTok supports videos OR photo carousels (2+ images)
    filter: (post) => {
      const hasVideo = post.videoKey || post.videoUrl;
      const hasMultipleImages = (post.imageUrls && post.imageUrls.length >= 2) || 
                                (post.images && post.images.length >= 2);
      return hasVideo || hasMultipleImages;
    }
  },
  snapchat: {
    settingsTable: process.env.SNAPCHAT_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_SNAPCHAT,
    checkEnabled: (s) => s.enabled && s.accessToken && s.organizationId,
    filter: (post) => post.videoKey || post.imageKey // Snapchat needs media
  },
  threads: {
    settingsTable: process.env.THREADS_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_THREADS,
    checkEnabled: (s) => s.enabled && s.accessToken && s.userId
  },
  whatsapp: {
    settingsTable: process.env.WHATSAPP_SETTINGS_TABLE,
    lambdaName: process.env.LAMBDA_WHATSAPP,
    checkEnabled: (s) => s.enabled
  }
};

async function getChannelSettings(channel, tenantId) {
  const config = CHANNELS[channel];
  if (!config || !config.settingsTable) return null;
  
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: config.settingsTable,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || null;
  } catch (error) {
    console.error(`Error getting ${channel} settings:`, error.message);
    return null;
  }
}

async function invokeChannelLambda(channel, payload) {
  const config = CHANNELS[channel];
  if (!config || !config.lambdaName) {
    console.log(`No Lambda configured for ${channel}`);
    return null;
  }
  
  try {
    console.log(`Invoking ${channel} Lambda: ${config.lambdaName}`);
    
    const command = new InvokeCommand({
      FunctionName: config.lambdaName,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload)
    });
    
    await lambda.send(command);
    console.log(`${channel} Lambda invoked successfully`);
    return { channel, status: 'invoked' };
  } catch (error) {
    console.error(`Error invoking ${channel} Lambda:`, error.message);
    return { channel, status: 'error', error: error.message };
  }
}

// Increment postsToday counter in the channel's settings table
async function incrementPostCount(channel, tenantId) {
  const config = CHANNELS[channel];
  if (!config || !config.settingsTable) return;
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // First get current settings to check if we need to reset
    const result = await dynamodb.send(new GetCommand({
      TableName: config.settingsTable,
      Key: { tenant_id: tenantId }
    }));
    
    const settings = result.Item || {};
    const lastReset = settings.postsLastReset || '';
    const currentCount = lastReset === today ? (settings.postsToday || 0) : 0;
    
    await dynamodb.send(new UpdateCommand({
      TableName: config.settingsTable,
      Key: { tenant_id: tenantId },
      UpdateExpression: 'SET postsToday = :pt, postsLastReset = :plr',
      ExpressionAttributeValues: {
        ':pt': currentCount + 1,
        ':plr': today
      }
    }));
    
    console.log(`${channel}: Post count updated to ${currentCount + 1}`);
  } catch (error) {
    console.error(`Error updating post count for ${channel}:`, error.message);
  }
}

exports.handler = async (event) => {
  console.log('Crosspost Dispatcher received event:', JSON.stringify(event));
  
  const { tenantId, post } = event;
  
  if (!tenantId || !post) {
    console.error('Missing tenantId or post in event');
    return { statusCode: 400, error: 'Missing tenantId or post' };
  }
  
  console.log(`Processing crosspost for tenant ${tenantId}, post ${post.postId}`);
  
  const results = [];
  const promises = [];
  
  // Check each channel and invoke if enabled
  for (const [channel, config] of Object.entries(CHANNELS)) {
    // Check channel-specific filters (e.g., YouTube only for Shorts)
    if (config.filter && !config.filter(post)) {
      console.log(`${channel}: Skipped (filter not matched)`);
      continue;
    }
    
    const settings = await getChannelSettings(channel, tenantId);
    
    if (!settings) {
      console.log(`${channel}: No settings found`);
      continue;
    }
    
    if (!config.checkEnabled(settings)) {
      console.log(`${channel}: Not enabled or missing required fields`);
      continue;
    }
    
    console.log(`${channel}: Enabled, dispatching...`);
    
    const payload = {
      tenantId,
      post,
      settings,
      channel
    };
    
    promises.push(
      invokeChannelLambda(channel, payload)
        .then(async (result) => {
          results.push(result);
          // Increment post counter on successful dispatch
          if (result?.status === 'invoked') {
            await incrementPostCount(channel, tenantId);
          }
        })
        .catch(err => results.push({ channel, status: 'error', error: err.message }))
    );
  }
  
  // Wait for all invocations to complete
  await Promise.all(promises);
  
  console.log('Crosspost dispatch complete:', results);
  
  return {
    statusCode: 200,
    dispatched: results.filter(r => r?.status === 'invoked').length,
    results
  };
};
