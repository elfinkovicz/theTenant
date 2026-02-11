const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand, GetScheduleCommand } = require('@aws-sdk/client-scheduler');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });
const lambda = new LambdaClient({ region: process.env.REGION });
const ses = new SESClient({ region: process.env.REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const scheduler = new SchedulerClient({ region: process.env.REGION });

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
  // Always check the user_tenants table for admin role
  // No special treatment for platform tenant - strict tenant isolation
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
  posts: [],
  settings: { postsPerPage: 10, allowComments: true, moderationEnabled: false },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  if (data.posts) {
    data.posts = data.posts.map(post => ({
      ...post,
      imageUrl: post.imageKey ? `https://${cfDomain}/${post.imageKey}` : post.imageUrl,
      videoUrl: post.videoKey ? `https://${cfDomain}/${post.videoKey}` : post.videoUrl,
      // Multi-image support
      imageUrls: post.imageKeys?.map(k => `https://${cfDomain}/${k}`) || post.imageUrls,
      mediaUrls: post.mediaKeys?.map(k => `https://${cfDomain}/${k}`) || post.mediaUrls
    }));
  }
  return data;
};

async function getNewsfeed(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_NEWSFEED_TABLE, Key: { tenant_id: tenantId }
    }));
    
    // Also fetch scheduled posts for this tenant
    const scheduledPosts = await getScheduledPosts(tenantId);
    
    const data = enrichWithUrls(result.Item || getDefaultData(tenantId));
    data.scheduledPosts = scheduledPosts;
    
    return data;
  } catch (error) { 
    return { ...getDefaultData(tenantId), scheduledPosts: [] }; 
  }
}

// Get all scheduled posts for a tenant
async function getScheduledPosts(tenantId) {
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.SCHEDULED_POSTS_TABLE,
      IndexName: 'tenant-scheduled-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      }
    }));
    
    return (result.Items || []).map(item => enrichWithUrls(item));
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return [];
  }
}

// Create EventBridge Schedule for a post
async function createSchedule(tenantId, post, scheduledAt) {
  const scheduleId = `${process.env.PLATFORM_NAME || 'viraltenant'}-post-${post.postId}`;
  const scheduledDate = new Date(scheduledAt);
  
  // EventBridge Scheduler uses cron format: at(yyyy-mm-ddThh:mm:ss)
  const scheduleExpression = `at(${scheduledDate.toISOString().slice(0, 19)})`;
  
  console.log('Creating EventBridge Schedule:', scheduleId, 'at', scheduleExpression);
  
  // Get current Lambda function ARN from context (will be passed in handler)
  const lambdaArn = `arn:aws:lambda:${process.env.REGION}:${process.env.AWS_ACCOUNT_ID || await getAccountId()}:function:${process.env.PLATFORM_NAME}-tenant-newsfeed-${process.env.ENVIRONMENT || 'production'}`;
  
  try {
    await scheduler.send(new CreateScheduleCommand({
      Name: scheduleId,
      ScheduleExpression: scheduleExpression,
      FlexibleTimeWindow: { Mode: 'OFF' },
      Target: {
        Arn: lambdaArn,
        RoleArn: process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          source: 'eventbridge.scheduler',
          action: 'publish-scheduled-post',
          tenantId,
          postId: post.postId,
          scheduleId: post.postId
        })
      },
      State: 'ENABLED'
    }));
    
    console.log('EventBridge Schedule created successfully:', scheduleId);
    return scheduleId;
  } catch (error) {
    console.error('Error creating EventBridge Schedule:', error);
    throw error;
  }
}

// Helper to get AWS Account ID from STS
async function getAccountId() {
  try {
    const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
    const sts = new STSClient({ region: process.env.REGION });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return identity.Account;
  } catch (error) {
    console.error('Error getting account ID:', error);
    // Fallback: extract from role ARN if available
    return null;
  }
}

// Delete EventBridge Schedule
async function deleteSchedule(scheduleId) {
  const fullScheduleId = `${process.env.PLATFORM_NAME || 'viraltenant'}-post-${scheduleId}`;
  
  try {
    await scheduler.send(new DeleteScheduleCommand({
      Name: fullScheduleId
    }));
    console.log('EventBridge Schedule deleted:', fullScheduleId);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log('Schedule not found (already deleted):', fullScheduleId);
    } else {
      console.error('Error deleting EventBridge Schedule:', error);
      throw error;
    }
  }
}

// Save scheduled post to DynamoDB
async function saveScheduledPost(tenantId, post, scheduledAt) {
  const scheduleId = post.postId;
  const scheduledDate = new Date(scheduledAt);
  
  // TTL: 7 days after scheduled time (for cleanup)
  const ttl = Math.floor(scheduledDate.getTime() / 1000) + (7 * 24 * 60 * 60);
  
  const item = {
    schedule_id: scheduleId,
    tenant_id: tenantId,
    scheduled_at: scheduledAt,
    post: post,
    status: 'pending',
    created_at: new Date().toISOString(),
    ttl
  };
  
  await dynamodb.send(new PutCommand({
    TableName: process.env.SCHEDULED_POSTS_TABLE,
    Item: item
  }));
  
  console.log('Scheduled post saved to DynamoDB:', scheduleId);
}

// Delete scheduled post from DynamoDB
async function deleteScheduledPost(scheduleId) {
  try {
    await dynamodb.send(new DeleteCommand({
      TableName: process.env.SCHEDULED_POSTS_TABLE,
      Key: { schedule_id: scheduleId }
    }));
    console.log('Scheduled post deleted from DynamoDB:', scheduleId);
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
  }
}

// Publish a scheduled post (called by EventBridge)
async function publishScheduledPost(tenantId, scheduleId) {
  console.log('Publishing scheduled post:', scheduleId, 'for tenant:', tenantId);
  
  try {
    // Get scheduled post from DynamoDB
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.SCHEDULED_POSTS_TABLE,
      Key: { schedule_id: scheduleId }
    }));
    
    if (!result.Item) {
      console.error('Scheduled post not found:', scheduleId);
      return;
    }
    
    const scheduledPost = result.Item;
    const post = scheduledPost.post;
    
    // Add post to newsfeed
    const newsfeedData = await getNewsfeed(tenantId);
    const newPost = {
      ...post,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await updateNewsfeed(tenantId, {
      posts: [newPost, ...newsfeedData.posts],
      settings: newsfeedData.settings
    });
    
    // Send crossposting notifications
    await sendCrosspostingNotifications(tenantId, newPost);
    
    // Update scheduled post status
    await dynamodb.send(new PutCommand({
      TableName: process.env.SCHEDULED_POSTS_TABLE,
      Item: {
        ...scheduledPost,
        status: 'published',
        published_at: new Date().toISOString()
      }
    }));
    
    console.log('Scheduled post published successfully:', scheduleId);
  } catch (error) {
    console.error('Error publishing scheduled post:', error);
    
    // Update status to failed
    try {
      await dynamodb.send(new PutCommand({
        TableName: process.env.SCHEDULED_POSTS_TABLE,
        Item: {
          schedule_id: scheduleId,
          tenant_id: tenantId,
          status: 'failed',
          error: error.message,
          failed_at: new Date().toISOString()
        }
      }));
    } catch (e) {
      console.error('Error updating failed status:', e);
    }
  }
}

async function updateNewsfeed(tenantId, updates) {
  const existing = await getNewsfeed(tenantId);
  const item = { ...existing, ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_NEWSFEED_TABLE, Item: item }));
  return enrichWithUrls(item);
}

async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const ext = fileName.split('.').pop();
  const key = `tenants/${tenantId}/newsfeed/${uploadType}-${Date.now()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, key, publicUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}` };
}

async function deleteFile(key) {
  if (!key) return;
  try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key })); } catch (e) {}
}

// Get crossposting settings for a tenant
async function getCrosspostingSettings(tenantId) {
  try {
    const [whatsappSettings, telegramSettings, emailSettings, discordSettings, slackSettings, facebookSettings, instagramSettings, signalSettings, xTwitterSettings, linkedInSettings, youtubeSettings] = await Promise.all([
      dynamodb.send(new GetCommand({ TableName: process.env.WHATSAPP_SETTINGS_TABLE, Key: { tenant_id: tenantId } })),
      dynamodb.send(new GetCommand({ TableName: process.env.TELEGRAM_SETTINGS_TABLE, Key: { tenant_id: tenantId } })),
      dynamodb.send(new GetCommand({ TableName: process.env.EMAIL_SETTINGS_TABLE, Key: { tenant_id: tenantId } })),
      dynamodb.send(new GetCommand({ TableName: process.env.DISCORD_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.SLACK_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.FACEBOOK_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.INSTAGRAM_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.SIGNAL_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.XTWITTER_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.LINKEDIN_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null })),
      dynamodb.send(new GetCommand({ TableName: process.env.YOUTUBE_SETTINGS_TABLE, Key: { tenant_id: tenantId } })).catch(() => ({ Item: null }))
    ]);

    return {
      whatsapp: whatsappSettings.Item || { enabled: false },
      telegram: telegramSettings.Item || { enabled: false },
      email: emailSettings.Item || { enabled: false },
      discord: discordSettings.Item || { enabled: false },
      slack: slackSettings.Item || { enabled: false },
      facebook: facebookSettings.Item || { enabled: false },
      instagram: instagramSettings.Item || { enabled: false },
      signal: signalSettings.Item || { enabled: false },
      xtwitter: xTwitterSettings.Item || { enabled: false },
      linkedin: linkedInSettings.Item || { enabled: false },
      youtube: youtubeSettings.Item || { enabled: false }
    };
  } catch (error) {
    console.error('Error getting crossposting settings:', error);
    return {
      whatsapp: { enabled: false }, telegram: { enabled: false }, email: { enabled: false },
      discord: { enabled: false }, slack: { enabled: false }, facebook: { enabled: false },
      instagram: { enabled: false }, signal: { enabled: false }, xtwitter: { enabled: false }, 
      linkedin: { enabled: false }, youtube: { enabled: false }
    };
  }
}

// Send crossposting notifications for a new post via Dispatcher Lambda
async function sendCrosspostingNotifications(tenantId, post) {
  try {
    console.log('Dispatching crossposting for post:', post.postId);
    
    // Check if dispatcher is configured
    const dispatcherLambda = process.env.CROSSPOST_DISPATCHER_LAMBDA;
    
    if (dispatcherLambda) {
      // Use the modular dispatcher system
      console.log('Using modular crosspost dispatcher:', dispatcherLambda);
      
      const command = new InvokeCommand({
        FunctionName: dispatcherLambda,
        InvocationType: 'Event', // Async invocation - don't wait for response
        Payload: JSON.stringify({
          tenantId,
          post
        })
      });
      
      await lambda.send(command);
      console.log('Crosspost dispatcher invoked successfully');
      return;
    }
    
    // Fallback to legacy inline crossposting if dispatcher not configured
    console.log('Dispatcher not configured, using legacy inline crossposting');
    await sendCrosspostingNotificationsLegacy(tenantId, post);
  } catch (error) {
    console.error('Error dispatching crossposting:', error);
    // Don't fail the main request if crossposting fails
  }
}

// Legacy inline crossposting (fallback)
async function sendCrosspostingNotificationsLegacy(tenantId, post) {
  try {
    const settings = await getCrosspostingSettings(tenantId);
    const promises = [];

    // WhatsApp crossposting
    if (settings.whatsapp.enabled && settings.whatsapp.phoneNumberId && settings.whatsapp.groupId) {
      console.log('Sending WhatsApp notification');
      promises.push(sendWhatsAppNotification(tenantId, post, settings.whatsapp));
    }

    // Telegram crossposting
    if (settings.telegram.enabled && settings.telegram.botToken && settings.telegram.chatId) {
      console.log('Sending Telegram notification');
      promises.push(sendTelegramNotification(tenantId, post, settings.telegram));
    }

    // Email crossposting
    if (settings.email.enabled && settings.email.senderPrefix) {
      console.log('Sending Email notification');
      promises.push(sendEmailNotification(tenantId, post, settings.email));
    }

    // Discord crossposting
    if (settings.discord.enabled && settings.discord.webhookUrl) {
      console.log('Sending Discord notification');
      promises.push(sendDiscordNotification(tenantId, post, settings.discord));
    }

    // Slack crossposting
    if (settings.slack.enabled && settings.slack.webhookUrl) {
      console.log('Sending Slack notification');
      promises.push(sendSlackNotification(tenantId, post, settings.slack));
    }

    // Facebook crossposting
    if (settings.facebook.enabled && settings.facebook.pageAccessToken && settings.facebook.pageId) {
      console.log('Sending Facebook notification');
      promises.push(sendFacebookNotification(tenantId, post, settings.facebook));
    }

    // Instagram crossposting
    if (settings.instagram.enabled && settings.instagram.accessToken && settings.instagram.accountId) {
      console.log('Sending Instagram notification');
      promises.push(sendInstagramNotification(tenantId, post, settings.instagram));
    }

    // Signal crossposting
    if (settings.signal.enabled && settings.signal.apiUrl && settings.signal.phoneNumber) {
      console.log('Sending Signal notification');
      promises.push(sendSignalNotification(tenantId, post, settings.signal));
    }

    // X (Twitter) crossposting - support both OAuth 2.0 and legacy OAuth 1.0a
    if (settings.xtwitter.enabled && (settings.xtwitter.oauth2AccessToken || (settings.xtwitter.apiKey && settings.xtwitter.accessToken))) {
      console.log('Sending X notification');
      promises.push(sendXTwitterNotification(tenantId, post, settings.xtwitter));
    }

    // LinkedIn crossposting
    if (settings.linkedin.enabled && settings.linkedin.accessToken) {
      console.log('Sending LinkedIn notification');
      promises.push(sendLinkedInNotification(tenantId, post, settings.linkedin));
    }

    // YouTube crossposting (Shorts for isShort posts)
    if (settings.youtube.enabled && settings.youtube.accessToken && post.isShort && post.videoKey) {
      console.log('Uploading YouTube Short');
      promises.push(sendYouTubeShort(tenantId, post, settings.youtube));
    }

    // Execute all crossposting in parallel
    if (promises.length > 0) {
      await Promise.allSettled(promises);
      console.log('Crossposting notifications sent');
    } else {
      console.log('No crossposting channels enabled');
    }
  } catch (error) {
    console.error('Error sending crossposting notifications:', error);
  }
}

// Send WhatsApp notification
async function sendWhatsAppNotification(tenantId, post, settings) {
  try {
    // Format message for WhatsApp
    let message = `📢 *${post.title}*\n\n${post.description}`;
    
    if (post.location) {
      message += `\n📍 ${post.location}`;
    }
    
    if (post.externalLink) {
      message += `\n🔗 ${post.externalLink}`;
    }

    // Note: This would require AWS End User Messaging or WhatsApp Business API
    // For now, we'll log the message that would be sent
    console.log('WhatsApp message would be sent:', message);
    console.log('To group:', settings.groupId);
    console.log('Phone Number ID:', settings.phoneNumberId);
    
    // TODO: Implement actual WhatsApp API integration with AWS End User Messaging
    // This requires:
    // 1. AWS End User Messaging service configured
    // 2. WhatsApp Business Account linked
    // 3. Phone Number ID and Access Token
    
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
  }
}

// Send Telegram notification
async function sendTelegramNotification(tenantId, post, settings) {
  try {
    // Format message for Telegram with HTML
    let message = `📢 <b>${post.title}</b>\n\n${post.description}`;
    
    if (post.location) {
      message += `\n📍 ${post.location}`;
    }
    
    if (post.externalLink) {
      message += `\n🔗 <a href="${post.externalLink}">Mehr lesen</a>`;
    }

    // Send via Telegram Bot API
    const response = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      }
    );
    
    const data = await response.json();
    console.log('Telegram notification sent successfully:', data.ok);
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

// Send Email notification
async function sendEmailNotification(tenantId, post, settings) {
  try {
    console.log('Sending email notification for post:', post.postId);
    
    // Get all users for this tenant
    const users = await getTenantUsers(tenantId);
    console.log('Found', users.length, 'users for tenant', tenantId);
    
    if (users.length === 0) {
      console.log('No users found for tenant, skipping email notification');
      return;
    }
    
    // Get email settings to find the sender email
    const emailSettings = await getEmailSettings(tenantId);
    
    if (!emailSettings.enabled || !emailSettings.senderPrefix) {
      console.log('Email not configured for tenant', tenantId);
      return;
    }
    
    // Build sender email from prefix and domain
    const senderDomain = emailSettings.senderDomain || process.env.PLATFORM_DOMAIN || 'viraltenant.com';
    const fromEmail = `${emailSettings.senderPrefix}@${senderDomain}`;
    const senderName = emailSettings.senderName || emailSettings.senderPrefix;
    
    // Ensure image URL is set from imageKey if not already present
    // For Shorts: use thumbnail (imageKey) as the display image
    const postWithImage = {
      ...post,
      imageUrl: post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null),
      videoUrl: post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null)
    };
    
    // For Shorts without thumbnail, we can't show video in email - log warning
    if (post.isShort && !postWithImage.imageUrl) {
      console.log('Short without thumbnail - email will have no image preview');
    }
    
    console.log('Post image URL:', postWithImage.imageUrl);
    
    // Build email content
    const subject = post.title;
    
    // Send email to all users (each with personalized unsubscribe link)
    const emailPromises = users.map(user => {
      const htmlBody = buildEmailTemplate(postWithImage, senderName, tenantId, user.email);
      return sendEmailToUser(user.email, subject, htmlBody, fromEmail, tenantId);
    });
    
    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Email notification sent: ${successful} successful, ${failed} failed`);
  } catch (error) {
    console.error('Error sending Email notification:', error);
  }
}

// Get all users for a tenant
async function getTenantUsers(tenantId) {
  try {
    // For platform tenant, get ALL users from Cognito (broadcast to everyone)
    if (tenantId === 'platform') {
      console.log('Platform tenant - fetching ALL users from Cognito');
      return await getAllCognitoUsers();
    }
    
    // For regular tenants, query using the tenant-users-index GSI
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      IndexName: 'tenant-users-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      }
    }));
    
    const userIds = result.Items?.map(item => item.user_id) || [];
    console.log('Found user IDs for tenant:', userIds.length);
    
    if (userIds.length === 0) {
      return [];
    }
    
    // Get user emails from Cognito
    const usersWithEmails = await Promise.all(
      userIds.map(async (userId) => {
        try {
          const command = new AdminGetUserCommand({
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId
          });
          const response = await cognito.send(command);
          const emailAttr = response.UserAttributes?.find(attr => attr.Name === 'email');
          return {
            userId: userId,
            email: emailAttr?.Value || null
          };
        } catch (error) {
          console.error('Error getting user from Cognito:', userId, error.message);
          return { userId: userId, email: null };
        }
      })
    );
    
    // Filter out users without email
    const validUsers = usersWithEmails.filter(u => u.email);
    console.log('Found', validUsers.length, 'users with valid emails');
    
    return validUsers;
  } catch (error) {
    console.error('Error getting tenant users:', error);
    return [];
  }
}

// Get ALL users from Cognito User Pool (for platform-wide broadcasts)
async function getAllCognitoUsers() {
  const { ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
  
  try {
    const users = [];
    let paginationToken = null;
    
    do {
      const command = new ListUsersCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Limit: 60,
        PaginationToken: paginationToken
      });
      
      const response = await cognito.send(command);
      
      for (const user of response.Users || []) {
        const emailAttr = user.Attributes?.find(attr => attr.Name === 'email');
        const emailVerified = user.Attributes?.find(attr => attr.Name === 'email_verified');
        
        // Only include users with verified emails
        if (emailAttr?.Value && emailVerified?.Value === 'true') {
          users.push({
            userId: user.Username,
            email: emailAttr.Value
          });
        }
      }
      
      paginationToken = response.PaginationToken;
    } while (paginationToken);
    
    console.log('Found', users.length, 'users with verified emails in Cognito');
    return users;
  } catch (error) {
    console.error('Error listing Cognito users:', error);
    return [];
  }
}

// Get tenant subdomain for email prefix
async function getTenantSubdomain(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    return result.Item?.subdomain || null;
  } catch (error) {
    console.error('Error getting tenant subdomain:', error);
    return null;
  }
}

// Get email settings for a tenant
async function getEmailSettings(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.EMAIL_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    let settings = result.Item || { enabled: false };
    
    // If senderPrefix is not set, use tenant subdomain
    if (settings.enabled && !settings.senderPrefix) {
      const subdomain = await getTenantSubdomain(tenantId);
      if (subdomain) {
        settings.senderPrefix = subdomain;
        settings.senderName = subdomain.charAt(0).toUpperCase() + subdomain.slice(1) + ' News';
      }
    }
    
    return settings;
  } catch (error) {
    console.error('Error getting email settings:', error);
    return { enabled: false };
  }
}

// Build HTML email template
function buildEmailTemplate(post, senderName, tenantId, userEmail) {
  const baseUrl = process.env.WEBSITE_URL || 'https://viraltenant.com';
  const apiUrl = process.env.API_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production';
  
  // Generate unsubscribe token (base64 encoded email + tenant)
  const unsubscribeData = Buffer.from(JSON.stringify({ email: userEmail, tenantId: tenantId })).toString('base64');
  const unsubscribeUrl = `${apiUrl}/email/unsubscribe?token=${encodeURIComponent(unsubscribeData)}`;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .image-container { margin: 20px 0; text-align: center; }
          .post-image { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .description { margin: 15px 0; white-space: pre-wrap; font-size: 16px; }
          .meta { color: #666; font-size: 14px; margin: 10px 0; }
          .button { display: inline-block; background: #667eea; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
          .unsubscribe { color: #999; font-size: 11px; margin-top: 15px; }
          .unsubscribe a { color: #666; }
          .tenant-id { font-size: 10px; color: #ccc; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">${escapeHtml(post.title)}</div>
          </div>
          <div class="content">
            ${post.imageUrl ? `
              <div class="image-container">
                <img src="${post.imageUrl}" alt="${escapeHtml(post.title)}" class="post-image">
              </div>
            ` : ''}
            
            <div class="description">${escapeHtml(post.description)}</div>
            
            ${post.location ? `<div class="meta">📍 ${escapeHtml(post.location)}</div>` : ''}
            
            ${post.externalLink ? `<a href="${post.externalLink}" class="button">Mehr erfahren →</a>` : ''}
            
            <div class="footer">
              <p>Diese E-Mail wurde an ${escapeHtml(userEmail)} gesendet.</p>
              <p><small>© ${new Date().getFullYear()} ${escapeHtml(senderName)}. Alle Rechte vorbehalten.</small></p>
              <p class="unsubscribe"><a href="${unsubscribeUrl}">Newsletter abmelden</a></p>
              <p class="tenant-id">Tenant-ID: ${tenantId}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Check if user has unsubscribed from a tenant's emails
async function isUserUnsubscribed(email, tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.EMAIL_OPTOUT_TABLE,
      Key: { email: email.toLowerCase(), tenant_id: tenantId }
    }));
    return !!result.Item;
  } catch (error) {
    console.error('Error checking opt-out status:', error);
    return false; // Default to not unsubscribed if error
  }
}

// Send email to a single user (with opt-out check)
async function sendEmailToUser(toEmail, subject, htmlBody, fromEmail, tenantId) {
  try {
    // Check if user has unsubscribed
    const isUnsubscribed = await isUserUnsubscribed(toEmail, tenantId);
    if (isUnsubscribed) {
      console.log('User has unsubscribed, skipping:', toEmail);
      return { skipped: true, reason: 'unsubscribed' };
    }
    
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [toEmail]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          }
        }
      }
    });
    
    const response = await ses.send(command);
    console.log('Email sent to', toEmail, 'MessageId:', response.MessageId);
    return response;
  } catch (error) {
    console.error('Error sending email to', toEmail, ':', error);
    throw error;
  }
}

// Escape HTML special characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Send Discord notification via Webhook
async function sendDiscordNotification(tenantId, post, settings) {
  try {
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    
    // Build description with tags for Shorts
    let description = post.description;
    if (post.isShort && post.tags && post.tags.length > 0) {
      description += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
    }
    
    const embed = {
      title: post.title,
      description: description,
      color: post.isShort ? 0xFF0080 : 0x5865F2, // Pink for Shorts, Discord blurple for regular
      timestamp: new Date().toISOString(),
      fields: []
    };
    
    if (post.isShort) {
      embed.fields.push({ name: '📱 Typ', value: 'Short', inline: true });
    }
    if (post.location) {
      embed.fields.push({ name: '📍 Ort', value: post.location, inline: true });
    }
    if (post.externalLink) {
      embed.fields.push({ name: '🔗 Link', value: post.externalLink, inline: true });
    }
    
    // For Shorts with video, use thumbnail as image and add video link
    if (post.isShort && videoUrl) {
      if (imageUrl) {
        embed.image = { url: imageUrl };
      }
      embed.fields.push({ name: '🎬 Video', value: `[Video ansehen](${videoUrl})`, inline: false });
    } else if (imageUrl) {
      embed.image = { url: imageUrl };
    }
    
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: post.isShort ? '📱 Neuer Short!' : '📢 Neuer Beitrag!',
        embeds: [embed]
      })
    });
    
    console.log('Discord notification sent successfully');
  } catch (error) {
    console.error('Error sending Discord notification:', error.message);
  }
}

// Send Slack notification via Incoming Webhook
async function sendSlackNotification(tenantId, post, settings) {
  try {
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    
    // Build description with tags for Shorts
    let description = post.description;
    if (post.isShort && post.tags && post.tags.length > 0) {
      description += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
    }
    
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: post.isShort ? `📱 ${post.title}` : `📢 ${post.title}`, emoji: true }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: description }
      }
    ];
    
    if (post.location) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `📍 ${post.location}` }]
      });
    }
    
    // For Shorts, show thumbnail and video link
    if (post.isShort && videoUrl) {
      if (imageUrl) {
        blocks.push({
          type: 'image',
          image_url: imageUrl,
          alt_text: post.title
        });
      }
      blocks.push({
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: '🎬 Video ansehen', emoji: true },
          url: videoUrl
        }]
      });
    } else if (imageUrl) {
      blocks.push({
        type: 'image',
        image_url: imageUrl,
        alt_text: post.title
      });
    }
    
    if (post.externalLink) {
      blocks.push({
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: 'Mehr erfahren →', emoji: true },
          url: post.externalLink
        }]
      });
    }
    
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks })
    });
    console.log('Slack notification sent successfully');
  } catch (error) {
    console.error('Error sending Slack notification:', error.message);
  }
}

// Send Facebook Page post
async function sendFacebookNotification(tenantId, post, settings) {
  try {
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    
    // Build message with tags for Shorts
    let message = `📢 ${post.title}\n\n${post.description}`;
    if (post.isShort && post.tags && post.tags.length > 0) {
      message += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
    }
    if (post.location) message += `\n\n📍 ${post.location}`;
    if (post.externalLink) message += `\n\n🔗 ${post.externalLink}`;
    
    // For Shorts with video, upload as Reel
    if (post.isShort && videoUrl) {
      console.log('Facebook: Uploading Short as Reel');
      
      // Step 1: Initialize video upload
      const initResponse = await fetch(
        `https://graph.facebook.com/v18.0/${settings.pageId}/video_reels?upload_phase=start&access_token=${settings.pageAccessToken}`,
        { method: 'POST' }
      );
      const initData = await initResponse.json();
      
      if (!initData.video_id) {
        console.log('Facebook Reels init failed, falling back to regular video');
        // Fallback to regular video upload
        const videoResponse = await fetch(
          `https://graph.facebook.com/v18.0/${settings.pageId}/videos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_url: videoUrl,
              description: message,
              access_token: settings.pageAccessToken
            })
          }
        );
        const videoData = await videoResponse.json();
        console.log('Facebook video uploaded:', videoData.id);
        return;
      }
      
      // Step 2: Upload video file
      const uploadResponse = await fetch(
        `https://rupload.facebook.com/video-upload/v18.0/${initData.video_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `OAuth ${settings.pageAccessToken}`,
            'file_url': videoUrl
          }
        }
      );
      
      // Step 3: Finish upload and publish
      const finishResponse = await fetch(
        `https://graph.facebook.com/v18.0/${settings.pageId}/video_reels?upload_phase=finish&video_id=${initData.video_id}&video_state=PUBLISHED&description=${encodeURIComponent(message)}&access_token=${settings.pageAccessToken}`,
        { method: 'POST' }
      );
      const finishData = await finishResponse.json();
      console.log('Facebook Reel uploaded:', finishData);
      return;
    }
    
    // Regular post (image or text)
    const endpoint = imageUrl 
      ? `https://graph.facebook.com/v18.0/${settings.pageId}/photos`
      : `https://graph.facebook.com/v18.0/${settings.pageId}/feed`;
    
    const payload = imageUrl 
      ? { url: imageUrl, caption: message, access_token: settings.pageAccessToken }
      : { message, access_token: settings.pageAccessToken };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log('Facebook notification sent successfully:', data.id);
  } catch (error) {
    console.error('Error sending Facebook notification:', error.message);
  }
}

// Send Instagram post (requires image or video for Reels)
async function sendInstagramNotification(tenantId, post, settings) {
  try {
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    
    // Build caption with tags
    let caption = `📢 ${post.title}\n\n${post.description}`;
    if (post.isShort && post.tags && post.tags.length > 0) {
      caption += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
    }
    if (post.location) caption += `\n\n📍 ${post.location}`;
    
    // For Shorts with video, upload as Reel
    if (post.isShort && videoUrl) {
      console.log('Instagram: Uploading Short as Reel');
      
      // Step 1: Create Reel container
      const containerResponse = await fetch(
        `https://graph.facebook.com/v18.0/${settings.accountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'REELS',
            video_url: videoUrl,
            caption: caption,
            access_token: settings.accessToken
          })
        }
      );
      
      const containerData = await containerResponse.json();
      
      if (containerData.error) {
        console.error('Instagram Reel container error:', containerData.error);
        return;
      }
      
      const containerId = containerData.id;
      console.log('Instagram Reel container created:', containerId);
      
      // Step 2: Wait for video processing (poll status)
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 30; // Max 5 minutes (10s intervals)
      
      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const statusResponse = await fetch(
          `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${settings.accessToken}`
        );
        const statusData = await statusResponse.json();
        status = statusData.status_code;
        attempts++;
        console.log(`Instagram Reel status: ${status} (attempt ${attempts})`);
      }
      
      if (status !== 'FINISHED') {
        console.error('Instagram Reel processing failed or timed out:', status);
        return;
      }
      
      // Step 3: Publish the Reel
      const publishResponse = await fetch(
        `https://graph.facebook.com/v18.0/${settings.accountId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: settings.accessToken
          })
        }
      );
      
      const publishData = await publishResponse.json();
      console.log('Instagram Reel published successfully:', publishData.id);
      return;
    }
    
    // Regular image post
    if (!imageUrl) {
      console.log('Instagram requires an image or video, skipping post');
      return;
    }
    
    // Step 1: Create media container
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${settings.accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: settings.accessToken
        })
      }
    );
    
    const containerData = await containerResponse.json();
    const containerId = containerData.id;
    
    // Step 2: Publish the container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${settings.accountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: settings.accessToken
        })
      }
    );
    
    const publishData = await publishResponse.json();
    console.log('Instagram notification sent successfully:', publishData.id);
  } catch (error) {
    console.error('Error sending Instagram notification:', error.message);
  }
}

// Send Signal notification via signal-cli-rest-api
async function sendSignalNotification(tenantId, post, settings) {
  try {
    let message = `📢 *${post.title}*\n\n${post.description}`;
    if (post.location) message += `\n\n📍 ${post.location}`;
    if (post.externalLink) message += `\n\n🔗 ${post.externalLink}`;
    
    const response = await fetch(`${settings.apiUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        number: settings.phoneNumber,
        recipients: [settings.groupId]
      })
    });
    
    console.log('Signal notification sent successfully');
  } catch (error) {
    console.error('Error sending Signal notification:', error.message);
  }
}

// Send X (Twitter) post
async function sendXTwitterNotification(tenantId, post, settings) {
  try {
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    
    // Get tenant subdomain for newsfeed link
    let newsfeedUrl = '';
    try {
      const tenantResult = await dynamodb.send(new GetCommand({
        TableName: process.env.TENANTS_TABLE,
        Key: { tenant_id: tenantId }
      }));
      const subdomain = tenantResult.Item?.subdomain || tenantId;
      newsfeedUrl = `https://${subdomain}.viraltenant.com/newsfeed`;
    } catch (e) {
      newsfeedUrl = `https://viraltenant.com/newsfeed`;
    }
    
    // Build tweet text with tags for Shorts
    let tweetText = `📢 ${post.title}\n${post.description}`;
    if (post.isShort && post.tags && post.tags.length > 0) {
      tweetText += '\n' + post.tags.map(t => `#${t}`).join(' ');
    }
    
    // For Shorts, add link to newsfeed
    if (post.isShort) {
      tweetText += `\n🎬 ${newsfeedUrl}`;
    } else if (post.externalLink) {
      tweetText += `\n${post.externalLink}`;
    }
    
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
    }
    
    // Helper function to upload media via OAuth 1.0a
    const uploadMediaOAuth1 = async (imgBase64) => {
      if (!settings.apiKey || !settings.apiSecret || !settings.accessToken || !settings.accessTokenSecret) {
        console.log('X: OAuth 1.0a credentials not available for media upload');
        return null;
      }
      
      const crypto = require('crypto');
      
      const oauth = {
        oauth_consumer_key: settings.apiKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: settings.accessToken,
        oauth_version: '1.0'
      };
      
      // For media upload, only OAuth params go in the signature base string
      const sortedOAuthParams = Object.keys(oauth).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
      const baseString = `POST&${encodeURIComponent('https://upload.twitter.com/1.1/media/upload.json')}&${encodeURIComponent(sortedOAuthParams)}`;
      const signingKey = `${encodeURIComponent(settings.apiSecret)}&${encodeURIComponent(settings.accessTokenSecret)}`;
      oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
      
      const authHeader = 'OAuth ' + Object.keys(oauth).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`).join(', ');
      
      const mediaResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `media_data=${encodeURIComponent(imgBase64)}`
      });
      
      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        console.log('X: Thumbnail uploaded, media_id:', mediaData.media_id_string);
        return mediaData.media_id_string;
      } else {
        const errorText = await mediaResponse.text();
        console.log('X: Media upload failed:', mediaResponse.status, errorText);
        return null;
      }
    };
    
    // Upload thumbnail image for Shorts (if available)
    let mediaId = null;
    if (post.isShort && imageUrl) {
      try {
        console.log('X: Downloading thumbnail from:', imageUrl);
        const imgResponse = await fetch(imageUrl);
        if (imgResponse.ok) {
          const imgBuffer = await imgResponse.arrayBuffer();
          const imgBase64 = Buffer.from(imgBuffer).toString('base64');
          console.log('X: Thumbnail downloaded, size:', imgBuffer.byteLength, 'bytes');
          mediaId = await uploadMediaOAuth1(imgBase64);
        } else {
          console.log('X: Failed to download thumbnail:', imgResponse.status);
        }
      } catch (imgError) {
        console.log('X: Could not upload thumbnail:', imgError.message);
      }
    }
    
    // Use OAuth 2.0 if available (preferred for posting)
    if (settings.oauth2AccessToken) {
      // Post tweet (with or without media)
      const tweetPayload = { text: tweetText };
      if (mediaId) {
        tweetPayload.media = { media_ids: [mediaId] };
      }
      
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${settings.oauth2AccessToken}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(tweetPayload)
      });
      
      if (!response.ok) {
        // Try to refresh token if expired
        if (response.status === 401 && settings.oauth2RefreshToken && settings.clientId && settings.clientSecret) {
          console.log('X token expired, attempting refresh...');
          const credentials = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
          const refreshParams = new URLSearchParams();
          refreshParams.append('refresh_token', settings.oauth2RefreshToken);
          refreshParams.append('grant_type', 'refresh_token');
          
          const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${credentials}`
            },
            body: refreshParams.toString()
          });
          
          if (refreshResponse.ok) {
            const tokenData = await refreshResponse.json();
            // Retry with new token
            const retryResponse = await fetch('https://api.twitter.com/2/tweets', {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${tokenData.access_token}`, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify(tweetPayload)
            });
            
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              console.log('X notification sent successfully (after token refresh):', data.data?.id);
              
              // Update stored tokens
              try {
                await dynamodb.send(new PutCommand({
                  TableName: process.env.XTWITTER_SETTINGS_TABLE,
                  Item: {
                    ...settings,
                    tenant_id: tenantId,
                    oauth2AccessToken: tokenData.access_token,
                    oauth2RefreshToken: tokenData.refresh_token || settings.oauth2RefreshToken,
                    updated_at: new Date().toISOString()
                  }
                }));
              } catch (e) {
                console.error('Failed to update X tokens:', e.message);
              }
              return;
            }
          }
          throw new Error('Token refresh failed');
        }
        throw new Error(`X API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('X notification sent successfully:', data.data?.id);
      return;
    }
    
    // Fallback to OAuth 1.0a (legacy)
    const crypto = require('crypto');
    
    const oauth = {
      oauth_consumer_key: settings.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: settings.accessToken,
      oauth_version: '1.0'
    };
    
    const params = { ...oauth, status: tweetText };
    const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
    const baseString = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(settings.apiSecret)}&${encodeURIComponent(settings.accessTokenSecret)}`;
    oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    
    const authHeader = 'OAuth ' + Object.keys(oauth).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`).join(', ');
    
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tweetText })
    });
    
    const data = await response.json();
    console.log('X notification sent successfully:', data.data?.id);
  } catch (error) {
    console.error('Error sending X notification:', error.message);
  }
}

// Send LinkedIn post
async function sendLinkedInNotification(tenantId, post, settings) {
  try {
    const imageUrl = post.imageUrl || (post.imageKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.imageKey}` : null);
    
    let text = `📢 ${post.title}\n\n${post.description}`;
    if (post.location) text += `\n\n📍 ${post.location}`;
    if (post.externalLink) text += `\n\n🔗 ${post.externalLink}`;
    
    // Use stored person URN or try to get it from /v2/me
    let personUrn = settings.personUrn;
    
    if (!personUrn) {
      try {
        const meResponse = await fetch('https://api.linkedin.com/v2/me', {
          headers: { 
            'Authorization': `Bearer ${settings.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
        
        if (meResponse.ok) {
          const meData = await meResponse.json();
          personUrn = `urn:li:person:${meData.id}`;
          console.log('LinkedIn person URN from /v2/me:', personUrn);
        }
      } catch (e) {
        console.log('Could not get person URN from /v2/me:', e.message);
      }
    }
    
    if (!personUrn) {
      console.error('LinkedIn: No person URN available, cannot post');
      return;
    }
    
    console.log('LinkedIn person URN:', personUrn);
    
    // Use the UGC Posts API
    const postData = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };
    
    // If there's an external link, add it as an article
    if (post.externalLink) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        originalUrl: post.externalLink,
        title: { text: post.title },
        description: { text: post.description.substring(0, 200) }
      }];
    }
    
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('LinkedIn post error:', response.status, errorData);
      return;
    }
    
    const responseData = await response.json().catch(() => ({}));
    console.log('LinkedIn notification sent successfully:', responseData.id);
  } catch (error) {
    console.error('Error sending LinkedIn notification:', error.message);
  }
}

// Upload YouTube Short
async function sendYouTubeShort(tenantId, post, settings) {
  try {
    const videoUrl = post.videoUrl || (post.videoKey ? `https://${process.env.CLOUDFRONT_DOMAIN}/${post.videoKey}` : null);
    
    if (!videoUrl) {
      console.log('YouTube Short: No video URL available');
      return;
    }
    
    // Download video from S3/CloudFront
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoSize = videoBuffer.byteLength;
    
    console.log(`YouTube Short: Downloaded video, size: ${videoSize} bytes`);
    
    // Build description with tags
    let description = post.description;
    if (post.tags && post.tags.length > 0) {
      description += '\n\n' + post.tags.map(t => `#${t}`).join(' ');
    }
    if (post.location) description += `\n📍 ${post.location}`;
    
    // Step 1: Initialize resumable upload
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': 'video/mp4'
        },
        body: JSON.stringify({
          snippet: {
            title: post.title,
            description: description,
            categoryId: '22' // People & Blogs
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false
          }
        })
      }
    );
    
    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      
      // Try to refresh token if expired
      if (initResponse.status === 401 && settings.refreshToken && settings.clientId && settings.clientSecret) {
        console.log('YouTube token expired, attempting refresh...');
        const refreshParams = new URLSearchParams();
        refreshParams.append('client_id', settings.clientId);
        refreshParams.append('client_secret', settings.clientSecret);
        refreshParams.append('refresh_token', settings.refreshToken);
        refreshParams.append('grant_type', 'refresh_token');
        
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: refreshParams.toString()
        });
        
        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          settings.accessToken = tokenData.access_token;
          
          // Update stored token
          try {
            await dynamodb.send(new PutCommand({
              TableName: process.env.YOUTUBE_SETTINGS_TABLE,
              Item: {
                ...settings,
                tenant_id: tenantId,
                accessToken: tokenData.access_token,
                updated_at: new Date().toISOString()
              }
            }));
          } catch (e) {
            console.error('Failed to update YouTube tokens:', e.message);
          }
          
          // Retry upload initialization
          return sendYouTubeShort(tenantId, post, settings);
        }
        throw new Error('YouTube token refresh failed');
      }
      
      throw new Error(`YouTube init error: ${initResponse.status} - ${JSON.stringify(errorData)}`);
    }
    
    const uploadUrl = initResponse.headers.get('location');
    if (!uploadUrl) {
      throw new Error('No upload URL returned from YouTube');
    }
    
    console.log('YouTube Short: Got upload URL, uploading video...');
    
    // Step 2: Upload the video
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoSize.toString()
      },
      body: videoBuffer
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      throw new Error(`YouTube upload error: ${uploadResponse.status} - ${JSON.stringify(errorData)}`);
    }
    
    const uploadData = await uploadResponse.json();
    console.log('YouTube Short uploaded successfully! Video ID:', uploadData.id);
    
  } catch (error) {
    console.error('Error uploading YouTube Short:', error.message);
  }
}

// Check if a post was newly published
function isNewlyPublished(oldPosts, newPosts) {
  const newlyPublished = [];
  
  for (const newPost of newPosts) {
    if (newPost.status === 'published') {
      const oldPost = oldPosts.find(p => p.postId === newPost.postId);
      
      // If post is new or was just changed from draft to published
      if (!oldPost || (oldPost.status === 'draft' && newPost.status === 'published')) {
        newlyPublished.push(newPost);
      }
    }
  }
  
  return newlyPublished;
}

// ============================================================
// POSTING SLOTS MANAGEMENT
// ============================================================

// Get posting slots for a tenant
async function getPostingSlots(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.POSTING_SLOTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    return result.Item || {
      tenant_id: tenantId,
      slots: [],
      timezone: 'Europe/Berlin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error loading posting slots:', error);
    return { 
      tenant_id: tenantId, 
      slots: [], 
      timezone: 'Europe/Berlin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

// Update posting slots
async function updatePostingSlots(tenantId, slots, timezone) {
  const item = {
    tenant_id: tenantId,
    slots,
    timezone: timezone || 'Europe/Berlin',
    updated_at: new Date().toISOString()
  };
  
  // Add created_at if this is a new record
  const existing = await getPostingSlots(tenantId);
  if (!existing.created_at) {
    item.created_at = new Date().toISOString();
  } else {
    item.created_at = existing.created_at;
  }
  
  await dynamodb.send(new PutCommand({
    TableName: process.env.POSTING_SLOTS_TABLE,
    Item: item
  }));
  
  console.log('Posting slots updated for tenant:', tenantId);
  return item;
}

// Calculate next available slot
async function calculateNextSlot(tenantId) {
  const slotsData = await getPostingSlots(tenantId);
  
  if (!slotsData.slots || slotsData.slots.length === 0) {
    return null;
  }
  
  // Get current time
  const now = new Date();
  const timezone = slotsData.timezone || 'Europe/Berlin';
  
  // Find all enabled slots
  const enabledSlots = slotsData.slots.filter(s => s.enabled);
  
  if (enabledSlots.length === 0) {
    return null;
  }
  
  // Try to find a free slot in the next 8 weeks (to handle edge cases)
  const maxWeeksToCheck = 8;
  
  for (let weekOffset = 0; weekOffset < maxWeeksToCheck; weekOffset++) {
    // Calculate next occurrence for each slot with week offset
    const nextOccurrences = enabledSlots.map(slot => {
      const nextDate = getNextOccurrence(slot.day, slot.time, timezone, now, weekOffset);
      return {
        slot,
        datetime: nextDate,
        timestamp: nextDate.getTime()
      };
    });
    
    // Sort by timestamp
    nextOccurrences.sort((a, b) => a.timestamp - b.timestamp);
    
    // Check if any slot in this week is free
    for (const occurrence of nextOccurrences) {
      const isOccupied = await isSlotOccupied(tenantId, occurrence.datetime);
      if (!isOccupied) {
        return {
          slot_id: occurrence.slot.id,
          datetime: occurrence.datetime.toISOString(),
          day_name: getDayName(occurrence.slot.day),
          date: formatDate(occurrence.datetime),
          time: occurrence.slot.time,
          label: occurrence.slot.label
        };
      }
    }
  }
  
  return null; // All slots occupied for the next 8 weeks
}

// Get next occurrence of a slot (day of week + time)
function getNextOccurrence(dayOfWeek, time, timezone, fromDate = new Date(), weekOffset = 0) {
  const [hours, minutes] = time.split(':').map(Number);
  
  // Get current date/time in the target timezone
  const nowInTz = new Date(fromDate.toLocaleString('en-US', { timeZone: timezone }));
  const currentDay = nowInTz.getDay();
  
  let daysUntil = dayOfWeek - currentDay;
  
  if (daysUntil < 0) {
    daysUntil += 7; // Next week
  } else if (daysUntil === 0) {
    // Same day - check if time has passed in the target timezone
    const slotTimeInTz = new Date(nowInTz);
    slotTimeInTz.setHours(hours, minutes, 0, 0);
    
    if (slotTimeInTz <= nowInTz) {
      daysUntil = 7; // Next week
    }
  }
  
  // Add week offset (for checking multiple weeks ahead)
  daysUntil += (weekOffset * 7);
  
  // Calculate the target date in the timezone
  const targetDateInTz = new Date(nowInTz);
  targetDateInTz.setDate(nowInTz.getDate() + daysUntil);
  targetDateInTz.setHours(hours, minutes, 0, 0);
  
  // Build a date string that represents the local time in the target timezone
  const year = targetDateInTz.getFullYear();
  const month = String(targetDateInTz.getMonth() + 1).padStart(2, '0');
  const day = String(targetDateInTz.getDate()).padStart(2, '0');
  const hourStr = String(hours).padStart(2, '0');
  const minuteStr = String(minutes).padStart(2, '0');
  
  // Create a local date string (YYYY-MM-DDTHH:MM:SS)
  const localDateStr = `${year}-${month}-${day}T${hourStr}:${minuteStr}:00`;
  
  // Convert local time in target timezone to UTC
  // Method: Create a date object and use toLocaleString to interpret it in the target timezone
  // Then calculate the offset and apply it
  
  // Parse the local date string as if it were in the target timezone
  // We'll use a trick: format a known UTC time in the target timezone to find the offset
  const tempDate = new Date(`${localDateStr}Z`); // Interpret as UTC first
  
  // Get what this UTC time looks like in the target timezone
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const tzParts = tzFormatter.formatToParts(tempDate);
  const tzValues = {};
  tzParts.forEach(part => {
    if (part.type !== 'literal') {
      tzValues[part.type] = part.value;
    }
  });
  
  // Build the timezone representation
  const tzDateStr = `${tzValues.year}-${tzValues.month}-${tzValues.day}T${tzValues.hour}:${tzValues.minute}:${tzValues.second}`;
  
  // Calculate the offset between what we want (localDateStr) and what UTC gives us in TZ (tzDateStr)
  const wantedTime = new Date(localDateStr).getTime();
  const tzTime = new Date(tzDateStr).getTime();
  const offset = wantedTime - tzTime;
  
  // Apply the offset to get the correct UTC time
  const correctUtcDate = new Date(tempDate.getTime() + offset);
  
  console.log('getNextOccurrence:', {
    timezone,
    slotTime: time,
    dayOfWeek,
    localDateStr,
    tzDateStr,
    offset,
    resultUtc: correctUtcDate.toISOString(),
    fromDate: fromDate.toISOString()
  });
  
  return correctUtcDate;
}

// Check if a slot is already occupied
async function isSlotOccupied(tenantId, datetime) {
  // Normalize to remove milliseconds for comparison
  const normalizedDate = new Date(datetime);
  normalizedDate.setMilliseconds(0);
  const dateStr = normalizedDate.toISOString();
  
  console.log('Checking if slot is occupied:', { tenantId, dateStr, originalDatetime: datetime.toISOString() });
  
  // Get all scheduled posts for this tenant and check in code
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.SCHEDULED_POSTS_TABLE,
      IndexName: 'tenant-scheduled-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      }
    }));
    
    // Check if any post has the same scheduled_at time (normalized to ignore milliseconds)
    const matchingPosts = (result.Items || []).filter(item => {
      const scheduledDate = new Date(item.scheduled_at);
      scheduledDate.setMilliseconds(0);
      const normalizedScheduledAt = scheduledDate.toISOString();
      return normalizedScheduledAt === dateStr;
    });
    
    const isOccupied = matchingPosts.length > 0;
    console.log('Slot occupation check result:', { 
      dateStr, 
      isOccupied, 
      totalPosts: result.Items?.length || 0,
      matchingPosts: matchingPosts.length,
      allScheduledTimes: result.Items?.map(i => {
        const d = new Date(i.scheduled_at);
        d.setMilliseconds(0);
        return d.toISOString();
      }).slice(0, 10) // First 10 for debugging
    });
    
    return isOccupied;
  } catch (error) {
    console.error('Error checking slot occupation:', error);
    return false;
  }
}

// Get day name from day number (0=Sunday, 1=Monday, etc.)
function getDayName(day) {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return days[day] || 'Unbekannt';
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('de-DE', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle EventBridge Scheduler invocations
  if (event.source === 'eventbridge.scheduler' && event.action === 'publish-scheduled-post') {
    console.log('EventBridge Scheduler triggered for scheduled post');
    await publishScheduledPost(event.tenantId, event.scheduleId);
    return { statusCode: 200, body: JSON.stringify({ message: 'Scheduled post published' }) };
  }
  
  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const rawTenantId = authorizerTenantId || pathParameters?.tenantId;
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(rawTenantId);
  console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);

  if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  try {
    // Get posting slots
    if (httpMethod === 'GET' && path.includes('/slots/next')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const nextSlot = await calculateNextSlot(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify(nextSlot)
      };
    }
    
    if (httpMethod === 'GET' && path.includes('/slots')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const slots = await getPostingSlots(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify(slots)
      };
    }
    
    // Update posting slots
    if (httpMethod === 'PUT' && path.includes('/slots')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const { slots, timezone } = JSON.parse(event.body || '{}');
      
      if (!slots || !Array.isArray(slots)) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'slots array erforderlich' }) };
      }
      
      const updated = await updatePostingSlots(tenantId, slots, timezone);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify(updated)
      };
    }

    if (httpMethod === 'GET' && !path.includes('/upload-url') && !path.includes('/slots')) {
      const data = await getNewsfeed(tenantId);
      
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

    if (httpMethod === 'PUT' && !path.includes('/upload-url') && !path.includes('/slots')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const requestData = JSON.parse(event.body || '{}');
      const existingData = await getNewsfeed(tenantId);
      
      // Check for newly published posts
      const newlyPublishedPosts = isNewlyPublished(existingData.posts || [], requestData.posts || []);
      
      // Update the newsfeed
      const updated = await updateNewsfeed(tenantId, requestData);
      
      // Send crossposting notifications for newly published posts
      if (newlyPublishedPosts.length > 0) {
        console.log('Found newly published posts:', newlyPublishedPosts.length);
        for (const post of newlyPublishedPosts) {
          await sendCrosspostingNotifications(tenantId, post);
        }
      }
      
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
    
    // Schedule a post
    if (httpMethod === 'POST' && path.includes('/schedule')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const { post, scheduledAt } = JSON.parse(event.body || '{}');
      
      if (!post || !scheduledAt) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'post und scheduledAt erforderlich' }) };
      }
      
      // Validate scheduled time is in the future
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Geplante Zeit muss in der Zukunft liegen' }) };
      }
      
      // Create EventBridge Schedule
      await createSchedule(tenantId, post, scheduledAt);
      
      // Save to DynamoDB
      await saveScheduledPost(tenantId, post, scheduledAt);
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ 
          message: 'Post erfolgreich geplant',
          scheduleId: post.postId,
          scheduledAt
        })
      };
    }
    
    // Cancel a scheduled post
    if (httpMethod === 'DELETE' && path.includes('/schedule/')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const scheduleId = pathParameters?.scheduleId;
      if (!scheduleId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'scheduleId erforderlich' }) };
      }
      
      // Delete EventBridge Schedule
      await deleteSchedule(scheduleId);
      
      // Delete from DynamoDB
      await deleteScheduledPost(scheduleId);
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ message: 'Geplanter Post abgebrochen' })
      };
    }

    // Update a scheduled post
    if (httpMethod === 'PUT' && path.includes('/schedule/')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const scheduleId = pathParameters?.scheduleId;
      if (!scheduleId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'scheduleId erforderlich' }) };
      }
      
      const { post, scheduledAt } = JSON.parse(event.body || '{}');
      if (!post || !scheduledAt) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'post und scheduledAt erforderlich' }) };
      }
      
      // Remove undefined values from post object
      const cleanPost = JSON.parse(JSON.stringify(post));
      
      // Delete old EventBridge Schedule
      await deleteSchedule(scheduleId);
      
      // Create new EventBridge Schedule with updated time
      await createSchedule(scheduleId, tenantId, scheduledAt);
      
      // Update in DynamoDB
      await dynamodb.send(new PutCommand({
        TableName: process.env.SCHEDULED_POSTS_TABLE,
        Item: {
          schedule_id: scheduleId,
          tenant_id: tenantId,
          scheduled_at: scheduledAt,
          post: cleanPost,
          status: 'pending',
          updated_at: new Date().toISOString()
        }
      }));
      
      console.log('Scheduled post updated:', scheduleId);
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ message: 'Geplanter Post aktualisiert', scheduleId })
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
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'post')) };
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
