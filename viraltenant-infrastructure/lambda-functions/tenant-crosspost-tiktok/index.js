/**
 * TikTok Crosspost Lambda
 * 
 * Posts videos AND photos to TikTok using the Content Posting API.
 * Supports OAuth 2.0 authentication and media upload via PULL_FROM_URL.
 * 
 * TikTok API: 
 * - Videos: https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
 * - Photos: https://developers.tiktok.com/doc/content-posting-api-get-started (photo_images)
 * 
 * Photo Post Requirements:
 * - Minimum 2 images, maximum 35 images
 * - Supported formats: JPEG, WebP (PNG not directly supported)
 * - Recommended resolution: 1080x1920 (9:16 vertical)
 * - Max file size: 20MB per image
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const TIKTOK_API = 'https://open.tiktokapis.com/v2';
const TIKTOK_AUTH_API = 'https://open.tiktokapis.com/v2/oauth';

// TikTok Photo Post limits
const MIN_PHOTOS = 2;
const MAX_PHOTOS = 35;

// Refresh access token if expired
async function refreshAccessToken(settings) {
  if (!settings.refreshToken) {
    throw new Error('No refresh token available');
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error('TikTok client credentials not configured');
  }

  const response = await fetch(`${TIKTOK_AUTH_API}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: settings.refreshToken
    })
  });

  const data = await response.json();

  if (data.error || !data.access_token) {
    console.error('Token refresh failed:', data);
    throw new Error(data.error_description || 'Failed to refresh token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || settings.refreshToken,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };
}

// Update tokens in DynamoDB
async function updateTokens(tenantId, tokens) {
  await dynamodb.send(new UpdateCommand({
    TableName: process.env.TIKTOK_SETTINGS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET accessToken = :at, refreshToken = :rt, expiresAt = :ea, updated_at = :ua',
    ExpressionAttributeValues: {
      ':at': tokens.accessToken,
      ':rt': tokens.refreshToken,
      ':ea': tokens.expiresAt,
      ':ua': new Date().toISOString()
    }
  }));
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(tenantId, settings) {
  // Check if token is expired or will expire in next 5 minutes
  const expiresAt = settings.expiresAt || 0;
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (Date.now() + bufferTime >= expiresAt) {
    console.log('Access token expired or expiring soon, refreshing...');
    const newTokens = await refreshAccessToken(settings);
    await updateTokens(tenantId, newTokens);
    return newTokens.accessToken;
  }

  return settings.accessToken;
}

// Initialize video upload using PULL_FROM_URL
async function initializeVideoUpload(accessToken, videoUrl, postInfo) {
  console.log('Initializing TikTok video upload from URL:', videoUrl);

  const body = {
    post_info: {
      title: postInfo.title.substring(0, 150), // TikTok title limit
      privacy_level: postInfo.privacyLevel || 'SELF_ONLY',
      disable_duet: !postInfo.allowDuet,
      disable_comment: !postInfo.allowComment,
      disable_stitch: !postInfo.allowStitch,
      // Commercial Content Disclosure
      ...(postInfo.commercialContentEnabled && {
        brand_content_toggle: true,
        brand_organic_toggle: postInfo.brandOrganic || false,
        is_branded_content: postInfo.brandedContent || false
      })
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl
    }
  };

  // Use direct post endpoint for immediate posting
  const response = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error?.code !== 'ok') {
    console.error('TikTok upload init failed:', data);
    throw new Error(data.error?.message || `Upload init failed: ${data.error?.code}`);
  }

  return data.data;
}

// Initialize video upload to inbox (draft)
async function initializeInboxUpload(accessToken, videoUrl) {
  console.log('Initializing TikTok inbox upload from URL:', videoUrl);

  const body = {
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl
    }
  };

  const response = await fetch(`${TIKTOK_API}/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error?.code !== 'ok') {
    console.error('TikTok inbox upload init failed:', data);
    throw new Error(data.error?.message || `Inbox upload failed: ${data.error?.code}`);
  }

  return data.data;
}

// Initialize photo carousel upload using PULL_FROM_URL
// TikTok requires minimum 2 images, maximum 35 images
async function initializePhotoUpload(accessToken, imageUrls, postInfo) {
  console.log('Initializing TikTok photo carousel upload with', imageUrls.length, 'images');

  if (imageUrls.length < MIN_PHOTOS) {
    throw new Error(`TikTok benötigt mindestens ${MIN_PHOTOS} Bilder für einen Foto-Post`);
  }

  if (imageUrls.length > MAX_PHOTOS) {
    console.log(`Limiting to ${MAX_PHOTOS} images (had ${imageUrls.length})`);
    imageUrls = imageUrls.slice(0, MAX_PHOTOS);
  }

  const body = {
    post_info: {
      title: postInfo.title.substring(0, 150), // TikTok title limit
      description: postInfo.description?.substring(0, 2200) || '', // TikTok description limit
      privacy_level: postInfo.privacyLevel || 'SELF_ONLY',
      disable_comment: !postInfo.allowComment,
      auto_add_music: true // TikTok can add background music to photo posts
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_cover_index: 0, // First image as cover
      photo_images: imageUrls
    },
    post_mode: 'DIRECT_POST',
    media_type: 'PHOTO'
  };

  console.log('Photo post request body:', JSON.stringify(body, null, 2));

  const response = await fetch(`${TIKTOK_API}/post/publish/content/init/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error?.code !== 'ok') {
    console.error('TikTok photo upload init failed:', data);
    throw new Error(data.error?.message || `Photo upload failed: ${data.error?.code}`);
  }

  return data.data;
}

// Check publish status
async function checkPublishStatus(accessToken, publishId) {
  const response = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify({ publish_id: publishId })
  });

  const data = await response.json();
  return data;
}

// Build post text
function buildPostText(post, maxLength = 150) {
  const title = (post.title || '').trim();
  const description = (post.description || '').trim();

  let text = '';
  if (!title && !description) {
    text = 'New video';
  } else if (!description || title === description) {
    text = title || description;
  } else {
    text = `${title} - ${description}`;
  }

  // Add hashtags
  if (post.tags && post.tags.length > 0) {
    const hashtags = post.tags.map(t => `#${t}`).join(' ');
    if (text.length + hashtags.length + 1 <= maxLength) {
      text += ' ' + hashtags;
    }
  }

  // Truncate if too long
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }

  return text;
}

exports.handler = async (event) => {
  console.log('TikTok crosspost received:', JSON.stringify(event));

  const { tenantId, post, settings, action } = event;

  // Handle different actions
  if (action === 'test') {
    return await handleTest(tenantId, settings);
  }

  if (!tenantId || !post || !settings) {
    console.error('Missing required fields');
    return { statusCode: 400, error: 'Missing required fields' };
  }

  if (!settings.accessToken) {
    console.error('TikTok not connected');
    return { statusCode: 400, error: 'TikTok not connected' };
  }

  // Determine media type: Video or Photo
  // Use viraltenant.com domain (verified in TikTok) instead of CloudFront domain
  const videoUrl = post.videoUrl || (post.videoKey ? `https://viraltenant.com/${post.videoKey}` : null);
  
  // Collect image URLs for photo posts
  // Support multiple image formats: imageUrls array, images array, or single imageKey/imageUrl
  let imageUrls = [];
  if (post.imageUrls && Array.isArray(post.imageUrls)) {
    imageUrls = post.imageUrls.map(url => url.startsWith('http') ? url : `https://viraltenant.com/${url}`);
  } else if (post.images && Array.isArray(post.images)) {
    imageUrls = post.images.map(img => {
      const url = img.url || img.key || img;
      return url.startsWith('http') ? url : `https://viraltenant.com/${url}`;
    });
  } else if (post.imageKey) {
    // Single image - not enough for TikTok photo post (needs min 2)
    imageUrls = [`https://viraltenant.com/${post.imageKey}`];
  } else if (post.imageUrl) {
    imageUrls = [post.imageUrl.startsWith('http') ? post.imageUrl : `https://viraltenant.com/${post.imageUrl}`];
  }

  // Determine post type
  const isVideoPost = !!videoUrl;
  const isPhotoPost = imageUrls.length >= MIN_PHOTOS;

  if (!isVideoPost && !isPhotoPost) {
    if (imageUrls.length === 1) {
      console.log('Only 1 image - TikTok requires minimum 2 images for photo posts');
      return { 
        statusCode: 200, 
        skipped: true, 
        reason: `TikTok benötigt mindestens ${MIN_PHOTOS} Bilder für einen Foto-Post (nur 1 Bild vorhanden)` 
      };
    }
    console.log('No video or photos - TikTok requires video or 2+ images');
    return { statusCode: 200, skipped: true, reason: 'TikTok benötigt ein Video oder mindestens 2 Bilder' };
  }

  const mediaType = isVideoPost ? 'VIDEO' : 'PHOTO';
  console.log(`TikTok post type: ${mediaType}`, isVideoPost ? `URL: ${videoUrl}` : `Images: ${imageUrls.length}`);

  try {
    // Get valid access token (refresh if needed)
    let accessToken;
    try {
      accessToken = await getValidAccessToken(tenantId, settings);
    } catch (tokenError) {
      console.error('Token refresh failed:', tokenError.message);
      return {
        statusCode: 401,
        error: `Token-Fehler: ${tokenError.message}. Bitte TikTok neu verbinden.`
      };
    }

    // First, check creator info to verify permissions
    console.log('Checking TikTok creator info...');
    const creatorInfoResponse = await fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({})
    });

    const creatorInfo = await creatorInfoResponse.json();
    console.log('Creator info response:', JSON.stringify(creatorInfo));

    if (creatorInfo.error?.code !== 'ok') {
      console.error('Failed to get creator info:', creatorInfo);
      return {
        statusCode: 403,
        error: `TikTok API Fehler: ${creatorInfo.error?.message || creatorInfo.error?.code}. Möglicherweise fehlen Berechtigungen oder kein Business-Account.`
      };
    }

    // Check if user can post publicly
    const privacyOptions = creatorInfo.data?.privacy_level_options || [];
    console.log('Available privacy options:', privacyOptions);

    // Extract creator_info data for compliance (store in DB for frontend)
    const creatorInfoData = {
      privacyLevelOptions: privacyOptions,
      maxVideoDuration: creatorInfo.data?.max_video_post_duration_sec || 600,
      commentDisabledByCreator: creatorInfo.data?.comment_disabled || false,
      duetDisabledByCreator: creatorInfo.data?.duet_disabled || false,
      stitchDisabledByCreator: creatorInfo.data?.stitch_disabled || false
    };

    // Update creator_info in DynamoDB for frontend access
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.TIKTOK_SETTINGS_TABLE,
        Key: { tenant_id: tenantId },
        UpdateExpression: 'SET privacyLevelOptions = :plo, maxVideoDuration = :mvd, commentDisabledByCreator = :cdc, duetDisabledByCreator = :ddc, stitchDisabledByCreator = :sdc, creatorInfoUpdatedAt = :ciu',
        ExpressionAttributeValues: {
          ':plo': creatorInfoData.privacyLevelOptions,
          ':mvd': creatorInfoData.maxVideoDuration,
          ':cdc': creatorInfoData.commentDisabledByCreator,
          ':ddc': creatorInfoData.duetDisabledByCreator,
          ':sdc': creatorInfoData.stitchDisabledByCreator,
          ':ciu': new Date().toISOString()
        }
      }));
      console.log('Updated creator_info in DB:', creatorInfoData);
    } catch (dbError) {
      console.error('Failed to update creator_info in DB:', dbError);
      // Don't fail the request, just log the error
    }

    // Check if account has posting permissions (Business/Creator account required)
    if (!privacyOptions || privacyOptions.length === 0) {
      console.error('No privacy options available - likely not a Business/Creator account');
      return {
        statusCode: 403,
        error: 'Keine Posting-Berechtigung. TikTok erfordert einen Business- oder Creator-Account. Bitte in der TikTok-App zu einem Business-Account wechseln.'
      };
    }

    // Check posting limits from creator_info
    const maxPostsPerDay = 10; // TikTok limit (konservativ)
    const today = new Date().toISOString().split('T')[0];
    const postsToday = settings.postsToday || 0;
    const postsLastReset = settings.postsLastReset || '';

    // Reset counter if it's a new day
    let currentPostsToday = postsToday;
    if (postsLastReset !== today) {
      currentPostsToday = 0;
      console.log('New day - resetting post counter');
    }

    // Check if posting limit reached
    if (currentPostsToday >= maxPostsPerDay) {
      console.log(`Posting limit reached: ${currentPostsToday}/${maxPostsPerDay}`);
      return {
        statusCode: 429,
        error: `TikTok Posting-Limit erreicht (${currentPostsToday}/${maxPostsPerDay} Posts heute). Bitte versuche es morgen erneut.`,
        postsToday: currentPostsToday,
        limitReached: true
      };
    }

    // Build post info with all settings
    const postInfo = {
      title: buildPostText(post),
      description: post.description || '',
      privacyLevel: settings.defaultPrivacy || 'PUBLIC_TO_EVERYONE',
      // Interaction settings (default to false = disabled per TikTok guidelines)
      allowComment: settings.allowComment || false,
      allowDuet: settings.allowDuet || false,
      allowStitch: settings.allowStitch || false,
      // Commercial content
      commercialContentEnabled: settings.commercialContentEnabled || false,
      brandOrganic: settings.brandOrganic || false,
      brandedContent: settings.brandedContent || false
    };

    // Branded content cannot be private
    if (postInfo.brandedContent && postInfo.privacyLevel === 'SELF_ONLY') {
      console.log('Branded content cannot be private, switching to PUBLIC');
      postInfo.privacyLevel = 'PUBLIC_TO_EVERYONE';
    }

    // If requested privacy level is not available, fall back to what's available
    if (!privacyOptions.includes(postInfo.privacyLevel)) {
      console.log(`Privacy level ${postInfo.privacyLevel} not available, falling back to ${privacyOptions[0] || 'SELF_ONLY'}`);
      postInfo.privacyLevel = privacyOptions[0] || 'SELF_ONLY';
    }

    // Initialize upload based on media type
    let result;
    
    if (isVideoPost) {
      // VIDEO POST
      console.log('Starting TikTok video upload with privacy:', postInfo.privacyLevel);
      
      if (settings.postAsDraft) {
        // Upload to inbox (user must manually post)
        result = await initializeInboxUpload(accessToken, videoUrl);
        console.log('TikTok inbox upload initiated:', result.publish_id);
      } else {
        // Direct publish
        result = await initializeVideoUpload(accessToken, videoUrl, postInfo);
        console.log('TikTok direct publish initiated:', result.publish_id);
      }
    } else {
      // PHOTO POST (Carousel)
      console.log('Starting TikTok photo carousel upload with', imageUrls.length, 'images');
      result = await initializePhotoUpload(accessToken, imageUrls, postInfo);
      console.log('TikTok photo post initiated:', result.publish_id);
    }

    // Check initial status
    if (result.publish_id) {
      const statusCheck = await checkPublishStatus(accessToken, result.publish_id);
      console.log('Initial publish status:', JSON.stringify(statusCheck));
    }

    // Update posting counter in DynamoDB
    const newPostsToday = currentPostsToday + 1;
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.TIKTOK_SETTINGS_TABLE,
        Key: { tenant_id: tenantId },
        UpdateExpression: 'SET postsToday = :pt, postsLastReset = :plr, updated_at = :ua',
        ExpressionAttributeValues: {
          ':pt': newPostsToday,
          ':plr': today,
          ':ua': new Date().toISOString()
        }
      }));
      console.log(`Updated post counter: ${newPostsToday}/${maxPostsPerDay}`);
    } catch (counterError) {
      console.error('Failed to update post counter:', counterError);
      // Don't fail the request, just log the error
    }

    return {
      statusCode: 200,
      success: true,
      publishId: result.publish_id,
      mediaType: mediaType,
      privacyLevel: postInfo.privacyLevel,
      postsToday: newPostsToday,
      postsRemaining: maxPostsPerDay - newPostsToday,
      message: isVideoPost
        ? (settings.postAsDraft 
            ? 'Video sent to TikTok inbox - user must complete posting in TikTok app'
            : `Video upload initiated (${postInfo.privacyLevel})`)
        : `Foto-Carousel mit ${imageUrls.length} Bildern gepostet (${postInfo.privacyLevel})`
    };

  } catch (error) {
    console.error('TikTok crosspost error:', error.message);
    console.error('Full error:', error);
    return {
      statusCode: 500,
      error: error.message
    };
  }
};

// Handle test action
async function handleTest(tenantId, settings) {
  if (!settings?.accessToken) {
    return { statusCode: 400, error: 'TikTok not connected' };
  }

  try {
    // Verify token by fetching user info (include is_verified for business check)
    const response = await fetch(`${TIKTOK_API}/user/info/?fields=open_id,display_name,avatar_url,is_verified,follower_count`, {
      headers: { 'Authorization': `Bearer ${settings.accessToken}` }
    });

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(data.error?.message || 'Failed to verify connection');
    }

    // Also check creator info for posting permissions
    const creatorResponse = await fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({})
    });

    const creatorData = await creatorResponse.json();
    console.log('Creator info for test:', JSON.stringify(creatorData));

    // Check if account has posting permissions (Business/Creator account required)
    let postingStatus = 'Posting-Berechtigungen nicht verfügbar';
    let isBusinessAccount = false;
    let accountWarning = null;
    let creatorInfoData = {};

    if (creatorData.error?.code === 'ok' && creatorData.data) {
      const privacyOptions = creatorData.data.privacy_level_options || [];
      const canPostPublic = privacyOptions.includes('PUBLIC_TO_EVERYONE');
      isBusinessAccount = privacyOptions.length > 0; // Has posting permissions = Business/Creator
      
      // Extract creator_info data for compliance
      creatorInfoData = {
        privacyLevelOptions: privacyOptions,
        maxVideoDuration: creatorData.data?.max_video_post_duration_sec || 600,
        commentDisabledByCreator: creatorData.data?.comment_disabled || false,
        duetDisabledByCreator: creatorData.data?.duet_disabled || false,
        stitchDisabledByCreator: creatorData.data?.stitch_disabled || false
      };

      // Update creator_info in DynamoDB for frontend access
      try {
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.TIKTOK_SETTINGS_TABLE,
          Key: { tenant_id: tenantId },
          UpdateExpression: 'SET privacyLevelOptions = :plo, maxVideoDuration = :mvd, commentDisabledByCreator = :cdc, duetDisabledByCreator = :ddc, stitchDisabledByCreator = :sdc, creatorInfoUpdatedAt = :ciu',
          ExpressionAttributeValues: {
            ':plo': creatorInfoData.privacyLevelOptions,
            ':mvd': creatorInfoData.maxVideoDuration,
            ':cdc': creatorInfoData.commentDisabledByCreator,
            ':ddc': creatorInfoData.duetDisabledByCreator,
            ':sdc': creatorInfoData.stitchDisabledByCreator,
            ':ciu': new Date().toISOString()
          }
        }));
        console.log('Updated creator_info in DB from test:', creatorInfoData);
      } catch (dbError) {
        console.error('Failed to update creator_info in DB:', dbError);
      }
      
      if (!isBusinessAccount || privacyOptions.length === 0) {
        accountWarning = 'Kein Business/Creator-Account. Bitte in TikTok-App zu Business-Account wechseln.';
        postingStatus = 'Keine Posting-Berechtigung (Business-Account erforderlich)';
      } else {
        postingStatus = canPostPublic 
          ? 'Öffentliches Posten möglich' 
          : `Nur eingeschränkt: ${privacyOptions.join(', ') || 'Keine Optionen'}`;
      }
    } else {
      accountWarning = 'Konnte Posting-Berechtigungen nicht prüfen. Möglicherweise kein Business-Account.';
    }

    return {
      statusCode: 200,
      success: true,
      message: `Verbunden als ${data.data?.user?.display_name || 'TikTok User'}`,
      postingStatus,
      isBusinessAccount,
      accountWarning,
      privacyOptions: creatorData.data?.privacy_level_options || [],
      creatorInfo: creatorInfoData,
      followerCount: data.data?.user?.follower_count || 0
    };
  } catch (error) {
    return { statusCode: 500, error: error.message };
  }
}
