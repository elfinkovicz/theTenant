const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS'
};

// Table mapping for different providers
const PROVIDER_TABLES = {
  discord: process.env.DISCORD_SETTINGS_TABLE,
  slack: process.env.SLACK_SETTINGS_TABLE,
  facebook: process.env.FACEBOOK_SETTINGS_TABLE,
  instagram: process.env.INSTAGRAM_SETTINGS_TABLE,
  signal: process.env.SIGNAL_SETTINGS_TABLE,
  xtwitter: process.env.XTWITTER_SETTINGS_TABLE,
  linkedin: process.env.LINKEDIN_SETTINGS_TABLE,
  threads: process.env.THREADS_SETTINGS_TABLE,
  youtube: process.env.YOUTUBE_SETTINGS_TABLE,
  bluesky: process.env.BLUESKY_SETTINGS_TABLE,
  mastodon: process.env.MASTODON_SETTINGS_TABLE,
  tiktok: process.env.TIKTOK_SETTINGS_TABLE,
  snapchat: process.env.SNAPCHAT_SETTINGS_TABLE
};

// Default settings for each provider
const DEFAULT_SETTINGS = {
  discord: { enabled: false, webhookUrl: '', channelName: '' },
  slack: { enabled: false, webhookUrl: '', channelName: '' },
  facebook: { enabled: false, pageAccessToken: '', pageId: '', pageName: '' },
  instagram: { enabled: false, accessToken: '', accountId: '', accountName: '' },
  signal: { enabled: false, apiUrl: '', phoneNumber: '', groupId: '' },
  xtwitter: { enabled: false, apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', accountName: '', clientId: '', clientSecret: '', oauth2AccessToken: '', oauth2RefreshToken: '', userId: '' },
  linkedin: { enabled: false, accessToken: '', organizationId: '', organizationName: '', clientId: '', clientSecret: '' },
  threads: { enabled: false, accessToken: '', userId: '', username: '' },
  youtube: { enabled: false, accessToken: '', refreshToken: '', channelId: '', channelName: '', clientId: '', clientSecret: '' },
  bluesky: { enabled: false, handle: '', appPassword: '', displayName: '' },
  mastodon: { enabled: false, instanceUrl: '', accessToken: '', username: '' },
  tiktok: { enabled: false, accessToken: '', refreshToken: '', openId: '', displayName: '', avatarUrl: '', expiresAt: 0, postAsDraft: false, defaultPrivacy: 'PUBLIC_TO_EVERYONE', allowComment: false, allowDuet: false, allowStitch: false },
  snapchat: { enabled: false, accessToken: '', refreshToken: '', organizationId: '', displayName: '', expiresAt: 0, postAsStory: false }
};

// Instagram OAuth token exchange (via Instagram API with Instagram Login - NO Facebook Page required!)
async function exchangeInstagramCode(code, redirectUri, tenantId) {
  // Use Instagram App credentials from environment variables
  const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error('Instagram App nicht konfiguriert. Bitte Administrator kontaktieren.');
  }
  
  console.log('Instagram OAuth: Starting token exchange with Instagram Login API');
  
  // Step 1: Exchange code for short-lived access token via Instagram API
  const formData = new URLSearchParams();
  formData.append('client_id', appId);
  formData.append('client_secret', appSecret);
  formData.append('grant_type', 'authorization_code');
  formData.append('redirect_uri', redirectUri);
  formData.append('code', code);
  
  const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
  
  const tokenText = await tokenResponse.text();
  console.log('Instagram token response status:', tokenResponse.status);
  
  if (!tokenResponse.ok) {
    console.error('Instagram token exchange error:', tokenText);
    let errorData;
    try { errorData = JSON.parse(tokenText); } catch (e) { errorData = { error_message: tokenText }; }
    throw new Error(errorData.error_message || 'Token-Austausch fehlgeschlagen');
  }
  
  let tokenData;
  try { tokenData = JSON.parse(tokenText); } catch (e) { throw new Error('Ungültige Token-Antwort'); }
  
  // Handle both response formats (data array or direct object)
  const tokenInfo = tokenData.data ? tokenData.data[0] : tokenData;
  const shortLivedToken = tokenInfo.access_token;
  // Convert user_id to string to avoid BigInt issues with DynamoDB
  const userId = String(tokenInfo.user_id);
  
  if (!shortLivedToken) {
    throw new Error('Kein Access Token erhalten');
  }
  
  console.log('Instagram OAuth: Got short-lived token, user_id:', userId);
  
  // Step 2: Exchange for long-lived token (60 days) via Instagram Graph API
  const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`;
  
  const longLivedResponse = await fetch(longLivedUrl);
  let accessToken = shortLivedToken;
  
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
    console.log('Instagram OAuth: Got long-lived token, expires_in:', longLivedData.expires_in);
  } else {
    console.log('Instagram OAuth: Could not get long-lived token, using short-lived');
  }
  
  // Step 3: Get user profile info - IMPORTANT: Use 'id' from /me endpoint, not user_id from token
  // The 'id' is the Instagram Graph API ID needed for posting
  let username = null;
  let graphApiId = null;
  try {
    const profileResponse = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,user_id,username&access_token=${accessToken}`);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      username = profileData.username;
      graphApiId = profileData.id; // This is the correct ID for posting!
      console.log('Instagram OAuth: Got username:', username, 'graphApiId:', graphApiId, 'user_id:', profileData.user_id);
    }
  } catch (e) {
    console.log('Instagram OAuth: Could not get username:', e.message);
  }
  
  // Use graphApiId if available, otherwise fall back to userId from token
  const accountId = graphApiId || userId;
  
  return { 
    accessToken: accessToken, 
    accountId: accountId,
    username: username
  };
}

// Facebook Page OAuth token exchange
async function exchangeFacebookCode(code, redirectUri, tenantId) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error('Meta App nicht konfiguriert.');
  }
  
  // Exchange code for token
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
  
  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    throw new Error(errorData.error?.message || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await tokenResponse.json();
  let accessToken = tokenData.access_token;
  
  // Get long-lived token
  const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;
  const longLivedResponse = await fetch(longLivedUrl);
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
  }
  
  // Get user's pages
  const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
  if (!pagesResponse.ok) {
    throw new Error('Konnte Facebook-Seiten nicht abrufen');
  }
  
  const pagesData = await pagesResponse.json();
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('Keine Facebook-Seiten gefunden.');
  }
  
  // Use first page (could be extended to let user choose)
  const page = pagesData.data[0];
  
  return {
    pageAccessToken: page.access_token,
    pageId: page.id,
    pageName: page.name
  };
}

// Threads OAuth token exchange
async function exchangeThreadsCode(code, redirectUri, tenantId) {
  // Threads can use either dedicated Threads credentials or Instagram credentials
  // Priority: THREADS_APP_ID > INSTAGRAM_APP_ID > META_APP_ID
  const appId = process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  
  console.log('Threads OAuth: Using App ID:', appId ? appId.substring(0, 8) + '...' : 'NOT SET');
  
  if (!appId || !appSecret) {
    throw new Error('Threads App nicht konfiguriert. Bitte THREADS_APP_ID oder INSTAGRAM_APP_ID setzen.');
  }
  
  // Exchange code for short-lived token
  const tokenUrl = `https://graph.threads.net/oauth/access_token`;
  const params = new URLSearchParams();
  params.append('client_id', appId);
  params.append('client_secret', appSecret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri);
  params.append('code', code);
  
  console.log('Threads OAuth: Exchanging code at:', tokenUrl);
  
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  const tokenText = await tokenResponse.text();
  console.log('Threads OAuth: Token response:', tokenResponse.status, tokenText);
  
  if (!tokenResponse.ok) {
    let errorData;
    try { errorData = JSON.parse(tokenText); } catch (e) { errorData = { error_message: tokenText }; }
    throw new Error(errorData.error_message || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = JSON.parse(tokenText);
  const shortLivedToken = tokenData.access_token;
  
  console.log('Threads OAuth: Got short-lived token');
  
  // Exchange for long-lived token (60 days)
  const longLivedUrl = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`;
  const longLivedResponse = await fetch(longLivedUrl);
  
  let accessToken = shortLivedToken;
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
    console.log('Threads OAuth: Got long-lived token');
  } else {
    console.log('Threads OAuth: Could not get long-lived token, using short-lived');
  }
  
  // Get user profile - IMPORTANT: Get userId from /me endpoint to avoid BigInt precision loss
  // JSON.parse loses precision on large numbers, but /me returns id as string
  let userId = null;
  let username = null;
  try {
    const profileResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      userId = profileData.id; // This is returned as string, preserving precision
      username = profileData.username;
      console.log('Threads OAuth: Got userId:', userId, 'username:', username);
    }
  } catch (e) {
    console.log('Could not get Threads profile:', e.message);
  }
  
  if (!userId) {
    throw new Error('Konnte Threads User ID nicht abrufen');
  }
  
  return {
    accessToken,
    userId,
    username
  };
}

// Facebook Live OAuth - returns page info for livestreaming
async function exchangeFacebookLiveCode(code, redirectUri, tenantId, selectedPageId = null) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error('Meta App nicht konfiguriert.');
  }
  
  // Exchange code for token
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
  
  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    throw new Error(errorData.error?.message || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await tokenResponse.json();
  let accessToken = tokenData.access_token;
  
  // Get long-lived token
  const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;
  const longLivedResponse = await fetch(longLivedUrl);
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
  }
  
  // Get user's pages with live_video permission
  const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture&access_token=${accessToken}`);
  if (!pagesResponse.ok) {
    throw new Error('Konnte Facebook-Seiten nicht abrufen');
  }
  
  const pagesData = await pagesResponse.json();
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('Keine Facebook-Seiten gefunden. Du benötigst mindestens eine Facebook-Seite für Live-Streaming.');
  }
  
  // If multiple pages and no selection, return all pages for user to choose
  if (pagesData.data.length > 1 && !selectedPageId) {
    return {
      requiresPageSelection: true,
      pages: pagesData.data.map(p => ({
        id: p.id,
        name: p.name,
        picture: p.picture?.data?.url
      })),
      userAccessToken: accessToken // Needed for subsequent page selection
    };
  }
  
  // Use selected page or first page if only one
  const page = selectedPageId 
    ? pagesData.data.find(p => p.id === selectedPageId) || pagesData.data[0]
    : pagesData.data[0];
  
  return {
    pageAccessToken: page.access_token,
    pageId: page.id,
    pageName: page.name
  };
}

// Instagram Live OAuth - returns Instagram account info for livestreaming
async function exchangeInstagramLiveCode(code, redirectUri, tenantId) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error('Meta App nicht konfiguriert.');
  }
  
  // Exchange code for token
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
  
  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    throw new Error(errorData.error?.message || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await tokenResponse.json();
  let accessToken = tokenData.access_token;
  
  // Get long-lived token
  const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;
  const longLivedResponse = await fetch(longLivedUrl);
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
  }
  
  // Get Facebook Pages
  const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
  if (!pagesResponse.ok) {
    throw new Error('Konnte Facebook-Seiten nicht abrufen');
  }
  
  const pagesData = await pagesResponse.json();
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('Keine Facebook-Seiten gefunden.');
  }
  
  // Find Instagram Business Account
  let instagramAccountId = null;
  let instagramUsername = null;
  let pageAccessToken = null;
  
  for (const page of pagesData.data) {
    const igResponse = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
    if (igResponse.ok) {
      const igData = await igResponse.json();
      if (igData.instagram_business_account) {
        instagramAccountId = igData.instagram_business_account.id;
        pageAccessToken = page.access_token;
        
        // Get Instagram username
        const usernameResponse = await fetch(`https://graph.facebook.com/v18.0/${instagramAccountId}?fields=username&access_token=${pageAccessToken}`);
        if (usernameResponse.ok) {
          const usernameData = await usernameResponse.json();
          instagramUsername = usernameData.username;
        }
        break;
      }
    }
  }
  
  if (!instagramAccountId) {
    throw new Error('Kein Instagram Business Account gefunden.');
  }
  
  return { 
    accessToken: pageAccessToken, 
    accountId: instagramAccountId,
    username: instagramUsername
  };
}

// LinkedIn OAuth token exchange (with optional organization page selection)
async function exchangeLinkedInCode(code, redirectUri, tenantId, selectedOrgId = null) {
  // Use global LinkedIn credentials from environment variables
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn OAuth nicht konfiguriert. Bitte Administrator kontaktieren.');
  }
  
  console.log('LinkedIn OAuth: Starting token exchange for tenant:', tenantId);
  
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirectUri);
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('LinkedIn token exchange error:', errorData);
    throw new Error(errorData.error_description || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await response.json();
  const accessToken = tokenData.access_token;
  const idToken = tokenData.id_token;
  
  let personUrn = null;
  let displayName = null;
  
  // Try to extract person ID from id_token (JWT) if available
  if (idToken) {
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        console.log('LinkedIn ID token payload:', JSON.stringify(payload));
        if (payload.sub) {
          personUrn = `urn:li:person:${payload.sub}`;
          console.log('Got person URN from id_token:', personUrn);
        }
        if (payload.name) {
          displayName = payload.name;
        }
      }
    } catch (e) {
      console.log('Could not decode id_token:', e.message);
    }
  }
  
  // Fallback: Try /v2/userinfo endpoint (works with openid scope)
  if (!personUrn) {
    try {
      const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        console.log('LinkedIn userinfo:', JSON.stringify(userInfo));
        if (userInfo.sub) {
          personUrn = `urn:li:person:${userInfo.sub}`;
          displayName = userInfo.name || displayName;
        }
      }
    } catch (e) {
      console.log('Could not get userinfo:', e.message);
    }
  }
  
  // Last fallback: Try /v2/me
  if (!personUrn) {
    try {
      const meResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        personUrn = `urn:li:person:${meData.id}`;
        console.log('Got person URN from /v2/me:', personUrn);
      }
    } catch (e) {
      console.log('Could not get person URN from /v2/me:', e.message);
    }
  }
  
  // Fetch organization pages the user is admin of
  let organizationPages = [];
  try {
    const orgResponse = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,vanityName,logoV2(original~:playableStreams))))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      console.log('LinkedIn organizationAcls response:', JSON.stringify(orgData));
      if (orgData.elements && orgData.elements.length > 0) {
        organizationPages = orgData.elements.map(el => {
          const org = el['organization~'] || {};
          return {
            id: String(org.id),
            name: org.localizedName || 'Unbekannte Seite',
            vanityName: org.vanityName || null
          };
        }).filter(p => p.id);
      }
    } else {
      console.log('LinkedIn organizationAcls failed:', orgResponse.status, await orgResponse.text().catch(() => ''));
    }
  } catch (e) {
    console.log('Could not fetch organization pages:', e.message);
  }
  
  // If orgs found and no selection yet, return for page selection
  if (organizationPages.length > 0 && !selectedOrgId) {
    return {
      requiresPageSelection: true,
      pages: organizationPages,
      accessToken,
      personUrn,
      displayName
    };
  }
  
  // If a specific org was selected
  let selectedOrg = null;
  if (selectedOrgId && organizationPages.length > 0) {
    selectedOrg = organizationPages.find(p => p.id === selectedOrgId);
  }
  
  return { accessToken, personUrn, displayName, selectedOrg };
}

// YouTube OAuth token exchange
async function exchangeYouTubeCode(code, redirectUri, tenantId) {
  // Use global Google credentials from environment variables (same as frontend OAuth initiation)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth nicht konfiguriert. Bitte Administrator kontaktieren.');
  }
  
  console.log('YouTube OAuth: Starting token exchange for tenant:', tenantId);
  
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('redirect_uri', redirectUri);
  params.append('grant_type', 'authorization_code');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('YouTube token exchange error:', errorData);
    throw new Error(errorData.error_description || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = await response.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  
  // Get channel info
  const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!channelResponse.ok) {
    throw new Error('Konnte Kanal-Informationen nicht abrufen');
  }
  
  const channelData = await channelResponse.json();
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('Kein YouTube-Kanal gefunden');
  }
  
  const channel = channelData.items[0];
  
  return {
    accessToken,
    refreshToken,
    channelId: channel.id,
    channelName: channel.snippet.title
  };
}

// ============================================
// X (Twitter) OAuth 1.0a - 3-legged Flow
// ============================================

/**
 * Generate OAuth 1.0a signature for request signing
 */
function generateOAuth1SignatureForSettings(method, url, params, consumerKey, consumerSecret, tokenSecret = '') {
  const crypto = require('crypto');
  
  // Sort and encode parameters
  const sortedParams = Object.keys(params).sort().map(k => 
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  ).join('&');
  
  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');
  
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

/**
 * Step 1: Get OAuth 1.0a Request Token from X
 * Returns oauth_token + oauth_token_secret for the authorization redirect
 */
async function getOAuth1RequestToken(callbackUrl) {
  const crypto = require('crypto');
  const consumerKey = process.env.TWITTER_CONSUMER_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('X OAuth 1.0a nicht konfiguriert (Consumer Keys fehlen)');
  }
  
  const url = 'https://api.twitter.com/oauth/request_token';
  const oauthParams = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0'
  };
  
  oauthParams.oauth_signature = generateOAuth1SignatureForSettings('POST', url, oauthParams, consumerKey, consumerSecret);
  
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k => 
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  ).join(', ');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader }
  });
  
  const responseText = await response.text();
  
  if (!response.ok) {
    console.error('OAuth 1.0a request_token error:', response.status, responseText);
    throw new Error(`Request Token fehlgeschlagen: ${responseText}`);
  }
  
  const parsed = Object.fromEntries(new URLSearchParams(responseText));
  
  if (parsed.oauth_callback_confirmed !== 'true') {
    throw new Error('OAuth Callback nicht bestätigt');
  }
  
  return {
    oauthToken: parsed.oauth_token,
    oauthTokenSecret: parsed.oauth_token_secret
  };
}

/**
 * Step 3: Exchange OAuth 1.0a verifier for Access Token
 * Called after user authorizes on X and is redirected back
 */
async function exchangeOAuth1Verifier(oauthToken, oauthTokenSecret, oauthVerifier) {
  const crypto = require('crypto');
  const consumerKey = process.env.TWITTER_CONSUMER_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
  
  const url = 'https://api.twitter.com/oauth/access_token';
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
    oauth_version: '1.0'
  };
  
  oauthParams.oauth_signature = generateOAuth1SignatureForSettings('POST', url, oauthParams, consumerKey, consumerSecret, oauthTokenSecret);
  
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k => 
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  ).join(', ');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader }
  });
  
  const responseText = await response.text();
  
  if (!response.ok) {
    console.error('OAuth 1.0a access_token error:', response.status, responseText);
    throw new Error(`Access Token fehlgeschlagen: ${responseText}`);
  }
  
  const parsed = Object.fromEntries(new URLSearchParams(responseText));
  
  return {
    accessToken: parsed.oauth_token,
    accessTokenSecret: parsed.oauth_token_secret,
    userId: parsed.user_id,
    screenName: parsed.screen_name
  };
}

// ============================================
// X (Twitter) OAuth 2.0 - PKCE Flow (Fallback)
// ============================================

// X (Twitter) OAuth 2.0 token exchange with PKCE
async function exchangeXTwitterCode(code, redirectUri, codeVerifier, tenantId) {
  // Use global Twitter credentials from environment variables
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  
  console.log('X OAuth: Starting token exchange for tenant:', tenantId);
  console.log('X OAuth: Client ID present:', !!clientId);
  console.log('X OAuth: Client Secret present:', !!clientSecret);
  
  if (!clientId || !clientSecret) {
    throw new Error('X OAuth nicht konfiguriert. Bitte Administrator kontaktieren.');
  }
  
  // X OAuth 2.0 uses Basic Auth for confidential clients
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  console.log('X OAuth: Credentials encoded, length:', credentials.length);
  console.log('X OAuth: Client ID (first 10 chars):', clientId.substring(0, 10));
  
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri);
  params.append('code_verifier', codeVerifier);
  params.append('client_id', clientId); // Twitter sometimes requires this in body too
  
  console.log('X OAuth: Redirect URI:', redirectUri);
  console.log('X OAuth: Code verifier length:', codeVerifier?.length);
  
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: params.toString()
  });
  
  const responseText = await response.text();
  console.log('X OAuth: Response status:', response.status);
  console.log('X OAuth: Response body:', responseText);
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = JSON.parse(responseText);
    } catch (e) {
      errorData = { error: responseText };
    }
    console.error('X token exchange error:', errorData);
    throw new Error(errorData.error_description || errorData.error || 'Token-Austausch fehlgeschlagen');
  }
  
  const tokenData = JSON.parse(responseText);
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  
  // Get user info
  const userResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!userResponse.ok) {
    throw new Error('Konnte Benutzer-Informationen nicht abrufen');
  }
  
  const userData = await userResponse.json();
  
  return {
    accessToken,
    refreshToken,
    userId: userData.data.id,
    username: userData.data.username
  };
}

// TikTok OAuth token exchange with PKCE
async function exchangeTikTokCode(code, redirectUri, codeVerifier, tenantId) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  
  if (!clientKey || !clientSecret) {
    throw new Error('TikTok Client Key und Secret sind nicht konfiguriert');
  }
  
  const params = new URLSearchParams();
  params.append('client_key', clientKey);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri);
  params.append('code_verifier', codeVerifier);
  
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  
  const tokenData = await response.json();
  
  if (tokenData.error || !tokenData.access_token) {
    console.error('TikTok token exchange error:', tokenData);
    throw new Error(tokenData.error_description || tokenData.error || 'Token-Austausch fehlgeschlagen');
  }
  
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  const openId = tokenData.open_id;
  const expiresIn = tokenData.expires_in || 86400;
  
  // Get user info
  const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const userData = await userResponse.json();
  
  let displayName = 'TikTok User';
  let avatarUrl = '';
  
  if (userData.data?.user) {
    displayName = userData.data.user.display_name || displayName;
    avatarUrl = userData.data.user.avatar_url || '';
  }
  
  return {
    accessToken,
    refreshToken,
    openId,
    displayName,
    avatarUrl,
    expiresAt: Date.now() + (expiresIn * 1000)
  };
}

async function resolveTenantId(tenantIdOrSubdomain) {
  if (tenantIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantIdOrSubdomain;
  }
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: { ':subdomain': tenantIdOrSubdomain }
    }));
    if (result.Items?.length > 0) return result.Items[0].tenant_id;
  } catch (error) { console.error('Error resolving subdomain:', error); }
  return tenantIdOrSubdomain;
}

async function isUserTenantAdmin(userId, tenantId, isPlatformAdmin = false) {
  // Platform admins can manage platform-level settings
  if (tenantId === 'platform' && isPlatformAdmin) {
    console.log('Platform admin access granted for platform tenant');
    return true;
  }
  
  // Check the user_tenants table for tenant-specific access
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    return result.Item?.role === 'admin';
  } catch (error) { return false; }
}

async function getSettings(provider, tenantId) {
  const tableName = PROVIDER_TABLES[provider];
  if (!tableName) return DEFAULT_SETTINGS[provider] || { enabled: false };
  
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: tableName,
      Key: { tenant_id: tenantId }
    }));
    return result.Item || { ...DEFAULT_SETTINGS[provider], tenant_id: tenantId };
  } catch (error) {
    console.error(`Error getting ${provider} settings:`, error);
    return { ...DEFAULT_SETTINGS[provider], tenant_id: tenantId };
  }
}

async function updateSettings(provider, tenantId, settings) {
  const tableName = PROVIDER_TABLES[provider];
  if (!tableName) throw new Error(`Unknown provider: ${provider}`);
  
  const item = {
    ...settings,
    tenant_id: tenantId,
    updated_at: new Date().toISOString()
  };
  
  await dynamodb.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}


// Test functions for each provider
async function testDiscord(settings) {
  const response = await fetch(settings.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '🧪 **Test-Nachricht**\n\nDeine Discord-Integration funktioniert! ✅',
      embeds: [{
        title: 'Crossposting Test',
        description: 'Diese Nachricht wurde von deiner Newsfeed-Integration gesendet.',
        color: 0x5865F2
      }]
    })
  });
  if (!response.ok) throw new Error(`Discord test failed: ${response.status}`);
  return { success: true };
}

async function testSlack(settings) {
  const response = await fetch(settings.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🧪 Test-Nachricht', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: 'Deine Slack-Integration funktioniert! ✅' } }
      ]
    })
  });
  if (!response.ok) throw new Error(`Slack test failed: ${response.status}`);
  return { success: true };
}

async function testFacebook(settings) {
  // Create a real test post on the Facebook page
  const testMessage = '🧪 Test-Nachricht\n\nDeine Facebook-Integration funktioniert! ✅\n\nDiese Nachricht wurde automatisch von deiner Crossposting-Integration gesendet.';
  
  const response = await fetch(`https://graph.facebook.com/v18.0/${settings.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: testMessage,
      access_token: settings.pageAccessToken
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Facebook test failed: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, postId: data.id };
}

async function testInstagram(settings) {
  // Instagram requires an image for posts, so we just verify the connection
  // A real test post would need an image URL
  const response = await fetch(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${settings.accessToken}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Instagram test failed: ${response.status}`);
  }
  const data = await response.json();
  return { success: true, username: data.username, message: 'Verbindung erfolgreich! Instagram erfordert ein Bild für Posts.' };
}

async function testSignal(settings) {
  const response = await fetch(`${settings.apiUrl}/v2/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '🧪 Test-Nachricht\n\nDeine Signal-Integration funktioniert! ✅',
      number: settings.phoneNumber,
      recipients: [settings.groupId]
    })
  });
  if (!response.ok) throw new Error(`Signal test failed: ${response.status}`);
  return { success: true };
}

async function testXTwitter(settings, sendTweet = false) {
  // Test X connection - supports OAuth 1.0a (with platform consumer keys) and OAuth 2.0
  const crypto = require('crypto');
  
  // Resolve OAuth 1.0a credentials: Platform consumer keys + per-tenant access tokens
  const consumerKey = process.env.TWITTER_CONSUMER_KEY || settings.apiKey || '';
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || settings.apiSecret || '';
  const accessToken = settings.accessToken || '';
  const accessTokenSecret = settings.accessTokenSecret || '';
  const hasOAuth1 = consumerKey && consumerSecret && accessToken && accessTokenSecret;
  const hasOAuth2 = !!settings.oauth2AccessToken;
  
  if (!hasOAuth1 && !hasOAuth2) {
    throw new Error('X nicht verbunden. Bitte über "Mit X verbinden" Button verbinden.');
  }
  
  // Helper: Generate OAuth 1.0a signature
  function makeOAuth1Header(method, url) {
    const oauth = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0'
    };
    const sortedParams = Object.keys(oauth).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;
    oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    return 'OAuth ' + Object.keys(oauth).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`).join(', ');
  }
  
  // Verify credentials
  const verifyUrl = 'https://api.twitter.com/2/users/me';
  let verifyResponse;
  
  if (hasOAuth1) {
    const authHeader = makeOAuth1Header('GET', verifyUrl);
    verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });
  } else {
    verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${settings.oauth2AccessToken}` }
    });
    
    // Token expired? Try refresh
    if (verifyResponse.status === 401 && settings.oauth2RefreshToken) {
      const clientId = process.env.TWITTER_CLIENT_ID;
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const params = new URLSearchParams();
        params.append('refresh_token', settings.oauth2RefreshToken);
        params.append('grant_type', 'refresh_token');
        params.append('client_id', clientId);
        const refreshResp = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${creds}` },
          body: params.toString()
        });
        if (refreshResp.ok) {
          const tokenData = await refreshResp.json();
          verifyResponse = await fetch(verifyUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
          });
        }
      }
    }
  }
  
  if (!verifyResponse.ok) {
    const errorText = await verifyResponse.text();
    console.error('X verify error:', verifyResponse.status, errorText);
    if (verifyResponse.status === 401) {
      throw new Error('X Authentifizierung fehlgeschlagen. Bitte erneut verbinden.');
    }
    if (verifyResponse.status === 403) {
      throw new Error('X API Zugriff verweigert. Bitte App Permissions prüfen.');
    }
    throw new Error(`X API Fehler: ${verifyResponse.status}`);
  }
  
  const userData = await verifyResponse.json();
  const username = userData.data?.username;
  
  if (!sendTweet) {
    return { 
      success: true, 
      username: username,
      message: `Verbunden als @${username} ✅`
    };
  }
  
  // Send a test tweet
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const tweetText = `🧪 Test-Tweet von ViralTenant\n\nDiese Nachricht wurde automatisch gesendet um die X-Integration zu testen.\n\n✅ Crossposting funktioniert!\n\n#ViralTenant #Test`;
  const tweetBody = JSON.stringify({ text: tweetText });
  
  let tweetResponse;
  if (hasOAuth1) {
    const authHeader = makeOAuth1Header('POST', tweetUrl);
    tweetResponse = await fetch(tweetUrl, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: tweetBody
    });
  } else {
    tweetResponse = await fetch(tweetUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${settings.oauth2AccessToken}`, 'Content-Type': 'application/json' },
      body: tweetBody
    });
  }
  
  const tweetResponseText = await tweetResponse.text();
  console.log('X tweet response:', tweetResponse.status, tweetResponseText);
  
  if (!tweetResponse.ok) {
    let errorData;
    try { errorData = JSON.parse(tweetResponseText); } catch (e) { errorData = { detail: tweetResponseText }; }
    if (tweetResponse.status === 403) throw new Error('X API Zugriff verweigert. Bitte stelle sicher, dass deine App "Read and Write" Permissions hat.');
    if (tweetResponse.status === 429) throw new Error('X Rate Limit erreicht. Bitte warte einige Minuten.');
    throw new Error(errorData.detail || errorData.title || `Tweet fehlgeschlagen: ${tweetResponse.status}`);
  }
  
  const tweetData = JSON.parse(tweetResponseText);
  const tweetId = tweetData.data?.id;
  
  return { 
    success: true, 
    username: username,
    tweetId: tweetId,
    message: `Test-Tweet gesendet! 🎉 https://x.com/${username}/status/${tweetId}`
  };
}

async function testLinkedIn(settings) {
  // LinkedIn API - Test by posting a real test message
  // With w_member_social scope, we can post to the user's personal profile
  
  if (!settings.accessToken || settings.accessToken.length < 50) {
    throw new Error('Access Token scheint ungültig zu sein. Bitte generiere einen neuen Token.');
  }
  
  // Check if we have a stored person URN
  let personUrn = settings.personUrn;
  
  if (!personUrn) {
    // Try to get it from /v2/me (might work with some app configurations)
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
        console.log('Got person URN from /v2/me:', personUrn);
      } else {
        console.log('/v2/me failed with status:', meResponse.status);
      }
    } catch (e) {
      console.log('Could not get person URN from /v2/me:', e.message);
    }
  }
  
  if (!personUrn) {
    throw new Error('Person URN fehlt. Bitte trage deine LinkedIn Member ID in den Einstellungen ein (Format: urn:li:person:DEINE_ID). Du findest sie im LinkedIn Developer Portal unter OAuth Tools → Token Inspector.');
  }
  
  console.log('Using person URN:', personUrn);
  
  const testMessage = `🧪 Test-Nachricht von ViralTenant

Diese Nachricht wurde automatisch gesendet, um die LinkedIn-Integration zu testen. ✅

Gepostet am: ${new Date().toLocaleString('de-DE')}`;

  // Use UGC Posts API
  const postData = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: testMessage },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };
  
  const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postData)
  });
  
  if (!postResponse.ok) {
    const errorData = await postResponse.json().catch(() => ({}));
    console.error('LinkedIn post error:', postResponse.status, errorData);
    
    if (postResponse.status === 401) {
      throw new Error('Access Token ist ungültig oder abgelaufen. Bitte generiere einen neuen Token.');
    }
    if (postResponse.status === 403) {
      throw new Error('Keine Berechtigung zum Posten. Stelle sicher, dass "Share on LinkedIn" in deiner App aktiviert ist.');
    }
    
    throw new Error(errorData.message || `LinkedIn Post fehlgeschlagen: ${postResponse.status}`);
  }
  
  const postId = postResponse.headers.get('x-restli-id') || (await postResponse.json().catch(() => ({}))).id;
  console.log('LinkedIn test post created:', postId);
  
  return { 
    success: true, 
    postId: postId,
    message: 'Test-Post erfolgreich auf LinkedIn veröffentlicht! 🎉'
  };
}

async function testYouTube(settings) {
  if (!settings.accessToken || !settings.refreshToken) {
    throw new Error('YouTube nicht verbunden. Bitte verbinde deinen YouTube-Kanal.');
  }
  
  // Refresh token to ensure it's valid
  const params = new URLSearchParams();
  params.append('refresh_token', settings.refreshToken);
  params.append('client_id', settings.clientId);
  params.append('client_secret', settings.clientSecret);
  params.append('grant_type', 'refresh_token');
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  if (!tokenResponse.ok) {
    throw new Error('Token-Aktualisierung fehlgeschlagen. Bitte verbinde YouTube erneut.');
  }
  
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  
  // Get channel ID
  const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!channelResponse.ok) {
    throw new Error('Konnte Kanal-Informationen nicht abrufen.');
  }
  
  const channelData = await channelResponse.json();
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('Kein YouTube-Kanal gefunden.');
  }
  
  const channel = channelData.items[0];
  const channelId = channel.id;
  
  // Post a Community Post (Activity)
  // Note: YouTube Community Posts API requires channel to have Community tab enabled (1000+ subscribers)
  const testMessage = `🧪 Test-Nachricht von ViralTenant

Diese Nachricht wurde automatisch gesendet, um die YouTube-Integration zu testen. ✅

${new Date().toLocaleString('de-DE')}`;

  // Try to create a community post using the YouTube Data API
  // The activities.insert endpoint can create bulletin posts
  const postResponse = await fetch('https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      snippet: {
        description: testMessage
      },
      contentDetails: {
        bulletin: {
          resourceId: {
            kind: 'youtube#channel',
            channelId: channelId
          }
        }
      }
    })
  });
  
  if (!postResponse.ok) {
    const errorData = await postResponse.json().catch(() => ({}));
    console.error('YouTube post error:', postResponse.status, errorData);
    
    // If bulletin posting fails, try alternative method or show helpful message
    if (postResponse.status === 403) {
      // Check if it's a permission issue
      if (errorData.error?.message?.includes('community')) {
        throw new Error('Community Posts erfordern mindestens 500 Abonnenten. Dein Kanal ist aber erfolgreich verbunden! ✅');
      }
      throw new Error('Keine Berechtigung. Stelle sicher, dass die YouTube Data API aktiviert ist und die richtigen Scopes gewährt wurden.');
    }
    
    // Even if posting fails, the connection works - return success with info
    return { 
      success: true, 
      channelName: channel.snippet.title,
      message: `YouTube verbunden als "${channel.snippet.title}"! Community Posts erfordern 500+ Abonnenten.`
    };
  }
  
  const postData = await postResponse.json();
  
  return { 
    success: true, 
    channelName: channel.snippet.title,
    postId: postData.id,
    message: `Test-Post erfolgreich auf YouTube gepostet! 🎉`
  };
}

async function testBluesky(settings) {
  if (!settings.handle || !settings.appPassword) {
    throw new Error('Bluesky Handle und App Password erforderlich.');
  }
  
  // Create session with Bluesky
  const sessionResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: settings.handle,
      password: settings.appPassword
    })
  });
  
  if (!sessionResponse.ok) {
    const errorData = await sessionResponse.json().catch(() => ({}));
    throw new Error(errorData.message || 'Bluesky-Anmeldung fehlgeschlagen. Überprüfe Handle und App Password.');
  }
  
  const session = await sessionResponse.json();
  
  // Post a test message
  const testMessage = `🧪 Test-Nachricht von ViralTenant

Diese Nachricht wurde automatisch gesendet, um die Bluesky-Integration zu testen. ✅

${new Date().toLocaleString('de-DE')}`;

  const postResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.accessJwt}`
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        text: testMessage,
        createdAt: new Date().toISOString()
      }
    })
  });
  
  if (!postResponse.ok) {
    const errorData = await postResponse.json().catch(() => ({}));
    throw new Error(errorData.message || 'Bluesky-Post fehlgeschlagen.');
  }
  
  const postData = await postResponse.json();
  
  return { 
    success: true, 
    handle: settings.handle,
    postUri: postData.uri,
    message: 'Test-Post erfolgreich auf Bluesky gepostet! 🎉'
  };
}

async function testMastodon(settings) {
  if (!settings.instanceUrl || !settings.accessToken) {
    throw new Error('Mastodon Instanz-URL und Access Token erforderlich.');
  }
  
  // Normalize instance URL
  let instanceUrl = settings.instanceUrl.trim();
  if (!instanceUrl.startsWith('http')) {
    instanceUrl = `https://${instanceUrl}`;
  }
  instanceUrl = instanceUrl.replace(/\/$/, '');
  
  // Verify credentials first
  const verifyResponse = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
    headers: { 'Authorization': `Bearer ${settings.accessToken}` }
  });
  
  if (!verifyResponse.ok) {
    throw new Error('Mastodon-Authentifizierung fehlgeschlagen. Überprüfe Access Token.');
  }
  
  const account = await verifyResponse.json();
  
  // Post a test status
  const testMessage = `🧪 Test-Nachricht von ViralTenant

Diese Nachricht wurde automatisch gesendet, um die Mastodon-Integration zu testen. ✅

${new Date().toLocaleString('de-DE')}`;

  const postResponse = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${settings.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: testMessage,
      visibility: 'public'
    })
  });
  
  if (!postResponse.ok) {
    const errorData = await postResponse.json().catch(() => ({}));
    throw new Error(errorData.error || 'Mastodon-Post fehlgeschlagen.');
  }
  
  const postData = await postResponse.json();
  
  return { 
    success: true, 
    username: account.username,
    postId: postData.id,
    postUrl: postData.url,
    message: `Test-Post erfolgreich auf Mastodon gepostet! 🎉`
  };
}

async function testThreads(settings) {
  if (!settings.accessToken || !settings.userId) {
    throw new Error('Threads Access Token und User ID erforderlich.');
  }
  
  // Verify credentials by getting user profile
  const verifyResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=username&access_token=${settings.accessToken}`);
  
  if (!verifyResponse.ok) {
    const errorText = await verifyResponse.text();
    console.error('Threads verify failed:', errorText);
    throw new Error('Threads-Authentifizierung fehlgeschlagen. Überprüfe Access Token.');
  }
  
  const profile = await verifyResponse.json();
  
  // Post a test thread
  const testMessage = `🧪 Test-Nachricht von ViralTenant

Diese Nachricht wurde automatisch gesendet, um die Threads-Integration zu testen. ✅

${new Date().toLocaleString('de-DE')}`;

  // Step 1: Create container
  const createResponse = await fetch(`https://graph.threads.net/v1.0/${settings.userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: testMessage,
      media_type: 'TEXT',
      access_token: settings.accessToken
    })
  });
  
  const createText = await createResponse.text();
  console.log('Threads create response:', createResponse.status, createText);
  
  if (!createResponse.ok) {
    let error;
    try { error = JSON.parse(createText); } catch (e) { error = { error: { message: createText } }; }
    throw new Error(error.error?.message || 'Thread-Erstellung fehlgeschlagen.');
  }
  
  const createData = JSON.parse(createText);
  const containerId = createData.id;
  
  // Step 2: Publish thread
  const publishResponse = await fetch(`https://graph.threads.net/v1.0/${settings.userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: settings.accessToken
    })
  });
  
  const publishText = await publishResponse.text();
  console.log('Threads publish response:', publishResponse.status, publishText);
  
  if (!publishResponse.ok) {
    let error;
    try { error = JSON.parse(publishText); } catch (e) { error = { error: { message: publishText } }; }
    throw new Error(error.error?.message || 'Thread-Veröffentlichung fehlgeschlagen.');
  }
  
  const publishData = JSON.parse(publishText);
  
  return { 
    success: true, 
    username: profile.username,
    threadId: publishData.id,
    message: `Test-Thread erfolgreich auf Threads gepostet! 🎉`
  };
}

const TEST_FUNCTIONS = {
  discord: testDiscord,
  slack: testSlack,
  facebook: testFacebook,
  instagram: testInstagram,
  signal: testSignal,
  xtwitter: testXTwitter,
  linkedin: testLinkedIn,
  youtube: testYouTube,
  bluesky: testBluesky,
  mastodon: testMastodon,
  threads: testThreads
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, requestContext = {}, headers = {} } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const isPlatformAdmin = requestContext.authorizer?.isPlatformAdmin === 'true';
  
  // Use X-Creator-ID header if provided (for platform admins managing specific tenants)
  // Otherwise fall back to authorizer tenantId
  const creatorId = headers['X-Creator-ID'] || headers['x-creator-id'];
  const effectiveTenantId = creatorId || authorizerTenantId;
  
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  // Extract provider from path: /discord/settings, /slack/test, etc.
  const pathParts = path.split('/').filter(Boolean);
  const provider = pathParts[0]; // discord, slack, facebook, etc.
  const action = pathParts[1]; // settings, test, or oauth
  
  // Handle OAuth config endpoints (no auth required, public endpoints)
  if (httpMethod === 'GET' && action === 'oauth' && pathParts[2] === 'config') {
    if (provider === 'instagram') {
      const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
      if (!appId) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'Instagram OAuth nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ appId }) };
    }
    if (provider === 'threads') {
      // Threads uses its own App ID, fallback to Instagram or Meta
      const appId = process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
      console.log('Threads OAuth config: THREADS_APP_ID =', process.env.THREADS_APP_ID ? 'SET' : 'NOT SET');
      if (!appId) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'Threads OAuth nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ appId }) };
    }
    if (provider === 'meta') {
      const appId = process.env.META_APP_ID;
      if (!appId) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'Meta OAuth nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ appId }) };
    }
    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'Google OAuth nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ clientId }) };
    }
    if (provider === 'linkedin') {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'LinkedIn OAuth nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ clientId }) };
    }
    if (provider === 'twitter') {
      const clientId = process.env.TWITTER_CLIENT_ID;
      if (!clientId) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'X OAuth nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ clientId }) };
    }
    if (provider === 'tiktok') {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'TikTok nicht konfiguriert' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ clientKey }) };
    }
  }
  
  // Handle Meta OAuth callback BEFORE tenant check (it needs special handling)
  if (httpMethod === 'POST' && provider === 'meta' && path.includes('/oauth/callback')) {
    if (!effectiveTenantId) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Tenant ID erforderlich' }) };
    }
    const tenantId = await resolveTenantId(effectiveTenantId);
    const isPlatformAdmin = requestContext.authorizer?.isPlatformAdmin === 'true';
    
    if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
    }
    
    try {
      const body = JSON.parse(event.body || '{}');
      const { code, redirectUri, platform } = body;
      
      if (!code || !redirectUri || !platform) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Code, Redirect URI und Platform erforderlich' }) };
      }
      
      // Route to appropriate handler based on platform
      let result;
      switch (platform) {
        case 'instagram':
          result = await exchangeInstagramCode(code, redirectUri, tenantId);
          const igSettings = await getSettings('instagram', tenantId);
          await updateSettings('instagram', tenantId, {
            ...igSettings,
            accessToken: result.accessToken,
            accountId: result.accountId,
            accountName: result.username ? `@${result.username}` : igSettings.accountName,
            enabled: true
          });
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              message: 'Instagram erfolgreich verbunden!',
              accountName: result.username ? `@${result.username}` : 'Instagram Account',
              accountId: result.accountId
            }) 
          };
          
        case 'facebook':
          result = await exchangeFacebookCode(code, redirectUri, tenantId);
          const fbSettings = await getSettings('facebook', tenantId);
          await updateSettings('facebook', tenantId, {
            ...fbSettings,
            pageAccessToken: result.pageAccessToken,
            pageId: result.pageId,
            pageName: result.pageName,
            enabled: true
          });
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              message: 'Facebook erfolgreich verbunden!',
              pageName: result.pageName,
              pageId: result.pageId
            }) 
          };
          
        case 'threads':
          result = await exchangeThreadsCode(code, redirectUri, tenantId);
          const threadsSettings = await getSettings('threads', tenantId);
          await updateSettings('threads', tenantId, {
            ...threadsSettings,
            accessToken: result.accessToken,
            userId: result.userId,
            username: result.username,
            enabled: true
          });
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              message: 'Threads erfolgreich verbunden!',
              username: result.username,
              userId: result.userId
            }) 
          };
          
        case 'facebook-live':
          result = await exchangeFacebookLiveCode(code, redirectUri, tenantId, body.selectedPageId);
          
          // If multiple pages found, return them for selection
          if (result.requiresPageSelection) {
            return { 
              statusCode: 200, 
              headers: corsHeaders, 
              body: JSON.stringify({ 
                requiresPageSelection: true,
                pages: result.pages,
                userAccessToken: result.userAccessToken
              }) 
            };
          }
          
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              message: 'Facebook Live erfolgreich verbunden!',
              pageName: result.pageName,
              pageId: result.pageId,
              pageAccessToken: result.pageAccessToken
            }) 
          };
          
        case 'instagram-live':
          result = await exchangeInstagramLiveCode(code, redirectUri, tenantId);
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              message: 'Instagram Live erfolgreich verbunden!',
              username: result.username,
              accountId: result.accountId,
              accessToken: result.accessToken
            }) 
          };
          
        default:
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: `Unbekannte Platform: ${platform}` }) };
      }
    } catch (oauthError) {
      console.error('Meta OAuth error:', oauthError);
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
        message: 'OAuth fehlgeschlagen', 
        error: oauthError.message 
      }) };
    }
  }

  // Handle YouTube OAuth callback BEFORE tenant check (tenantId comes from request body)
  if (httpMethod === 'POST' && provider === 'youtube' && path.includes('/oauth/callback')) {
    try {
      const body = JSON.parse(event.body || '{}');
      const { code, redirectUri, tenantId: bodyTenantId } = body;
      
      // Use tenantId from body (passed via OAuth state parameter)
      const targetTenantId = bodyTenantId || effectiveTenantId;
      
      if (!code || !redirectUri || !targetTenantId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Code, Redirect URI und Tenant ID erforderlich' }) };
      }
      
      console.log('YouTube OAuth callback for tenant:', targetTenantId);
      
      const resolvedTenantId = await resolveTenantId(targetTenantId);
      const { accessToken, refreshToken, channelId, channelName } = await exchangeYouTubeCode(code, redirectUri, resolvedTenantId);
      
      // Auto-save the tokens and channel info to settings
      const currentSettings = await getSettings('youtube', resolvedTenantId);
      await updateSettings('youtube', resolvedTenantId, {
        ...currentSettings,
        accessToken: accessToken,
        refreshToken: refreshToken,
        channelId: channelId,
        channelName: channelName,
        enabled: true
      });
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ 
          message: 'YouTube erfolgreich verbunden!',
          channelId: channelId,
          channelName: channelName
        }) 
      };
    } catch (oauthError) {
      console.error('YouTube OAuth error:', oauthError);
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
        message: 'OAuth fehlgeschlagen', 
        error: oauthError.message 
      }) };
    }
  }

  if (!effectiveTenantId) {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Tenant ID erforderlich' }) };
  }
  
  const tenantId = await resolveTenantId(effectiveTenantId);
  
  // Skip provider check for meta routes (handled above) and google/linkedin/twitter/tiktok oauth config
  if (!PROVIDER_TABLES[provider] && provider !== 'meta' && provider !== 'google' && provider !== 'linkedin' && provider !== 'twitter' && provider !== 'tiktok') {
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: `Unknown provider: ${provider}` }) };
  }

  try {
    // GET settings
    if (httpMethod === 'GET' && action === 'settings') {
      const settings = await getSettings(provider, tenantId);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ...settings, resolvedTenantId: tenantId }) };
    }

    // PUT settings
    if (httpMethod === 'PUT' && action === 'settings') {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const settings = JSON.parse(event.body || '{}');
      const updated = await updateSettings(provider, tenantId, settings);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ...updated, resolvedTenantId: tenantId }) };
    }

    // POST test
    if (httpMethod === 'POST' && action === 'test') {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const settings = await getSettings(provider, tenantId);
      if (!settings.enabled) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: `${provider} nicht aktiviert` }) };
      }
      
      const testFn = TEST_FUNCTIONS[provider];
      if (!testFn) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: `Test für ${provider} nicht verfügbar` }) };
      }
      
      try {
        // Parse request body for additional options
        const body = JSON.parse(event.body || '{}');
        
        // For X Twitter, check if we should send a real tweet
        let result;
        if (provider === 'xtwitter') {
          const sendTweet = body.sendTweet === true;
          result = await testFn(settings, sendTweet);
        } else {
          result = await testFn(settings);
        }
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Test erfolgreich!', ...result }) };
      } catch (testError) {
        console.error(`${provider} test error:`, testError);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
          message: 'Test fehlgeschlagen', 
          error: testError.message 
        }) };
      }
    }

    // POST oauth/callback - Instagram OAuth token exchange
    // Path: /instagram/oauth/callback
    if (httpMethod === 'POST' && provider === 'instagram' && (action === 'oauth' || path.includes('/oauth/callback'))) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const body = JSON.parse(event.body || '{}');
        const { code, redirectUri } = body;
        
        if (!code || !redirectUri) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Code und Redirect URI erforderlich' }) };
        }
        
        const { accessToken, accountId, username } = await exchangeInstagramCode(code, redirectUri, tenantId);
        
        // Auto-save the token and account info to settings
        const currentSettings = await getSettings('instagram', tenantId);
        await updateSettings('instagram', tenantId, {
          ...currentSettings,
          accessToken: accessToken,
          accountId: accountId,
          accountName: username ? `@${username}` : currentSettings.accountName
        });
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'Instagram erfolgreich verknüpft!',
            accessToken: accessToken,
            accountId: accountId,
            username: username
          }) 
        };
      } catch (oauthError) {
        console.error('Instagram OAuth error:', oauthError);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
          message: 'OAuth fehlgeschlagen', 
          error: oauthError.message 
        }) };
      }
    }

    // POST oauth/callback - LinkedIn OAuth token exchange
    // Path: /linkedin/oauth/callback
    if (httpMethod === 'POST' && provider === 'linkedin' && (action === 'oauth' || path.includes('/oauth/callback'))) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const body = JSON.parse(event.body || '{}');
        const { code, redirectUri, selectedOrgId, selectPersonal } = body;
        
        if (!code || !redirectUri) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Code und Redirect URI erforderlich' }) };
        }
        
        const result = await exchangeLinkedInCode(code, redirectUri, tenantId, selectedOrgId);
        
        // If multiple org pages found, return them for selection (like Facebook Live pattern)
        if (result.requiresPageSelection) {
          // Auto-save token already so we don't lose it
          const currentSettings = await getSettings('linkedin', tenantId);
          await updateSettings('linkedin', tenantId, {
            ...currentSettings,
            accessToken: result.accessToken,
            personUrn: result.personUrn
          });
          
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              requiresPageSelection: true,
              pages: result.pages,
              personUrn: result.personUrn,
              displayName: result.displayName
            }) 
          };
        }
        
        // Save settings — either with selected org or personal profile
        const currentSettings = await getSettings('linkedin', tenantId);
        const updatedSettings = {
          ...currentSettings,
          accessToken: result.accessToken,
          personUrn: result.personUrn,
          organizationName: result.selectedOrg ? result.selectedOrg.name : (result.displayName || currentSettings.organizationName),
          organizationId: result.selectedOrg ? result.selectedOrg.id : '',
          postAsOrganization: !!result.selectedOrg
        };
        
        // If user explicitly chose personal profile
        if (selectPersonal) {
          updatedSettings.organizationId = '';
          updatedSettings.organizationName = result.displayName || currentSettings.organizationName;
          updatedSettings.postAsOrganization = false;
        }
        
        await updateSettings('linkedin', tenantId, updatedSettings);
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: result.selectedOrg 
              ? `LinkedIn Seite "${result.selectedOrg.name}" erfolgreich verbunden!`
              : 'LinkedIn Profil erfolgreich verknüpft!',
            accessToken: result.accessToken,
            personUrn: result.personUrn,
            organizationId: result.selectedOrg?.id || '',
            organizationName: result.selectedOrg?.name || result.displayName || '',
            postAsOrganization: !!result.selectedOrg,
            expiresIn: '60 Tage'
          }) 
        };
      } catch (oauthError) {
        console.error('LinkedIn OAuth error:', oauthError);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
          message: 'OAuth fehlgeschlagen', 
          error: oauthError.message 
        }) };
      }
    }

    // POST oauth/callback - X (Twitter) OAuth (1.0a + 2.0)
    // Path: /xtwitter/oauth/callback
    // Dispatches based on body params:
    //   { action: "request-token" } → OAuth 1.0a Step 1: get request token
    //   { oauthToken, oauthVerifier } → OAuth 1.0a Step 3: exchange verifier
    //   { code, redirectUri, codeVerifier } → OAuth 2.0 PKCE token exchange
    if (httpMethod === 'POST' && provider === 'xtwitter' && (action === 'oauth' || path.includes('/oauth/callback'))) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const body = JSON.parse(event.body || '{}');
        
        // OAuth 1.0a Step 1: Request Token
        if (body.action === 'request-token') {
          const callbackUrl = body.callbackUrl || 'https://viraltenant.com/x-callback';
          const { oauthToken, oauthTokenSecret } = await getOAuth1RequestToken(callbackUrl);
          
          // Store token secret in DynamoDB for step 3
          const currentSettings = await getSettings('xtwitter', tenantId);
          await updateSettings('xtwitter', tenantId, {
            ...currentSettings,
            _pendingOAuthToken: oauthToken,
            _pendingOAuthTokenSecret: oauthTokenSecret
          });
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              oauthToken,
              authorizeUrl: `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
            })
          };
        }
        
        // OAuth 1.0a Step 3: Exchange verifier for access token
        if (body.oauthToken && body.oauthVerifier) {
          const currentSettings = await getSettings('xtwitter', tenantId);
          const oauthTokenSecret = currentSettings._pendingOAuthTokenSecret || '';
          
          if (!oauthTokenSecret) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Kein ausstehender OAuth-Request gefunden. Bitte erneut verbinden.' }) };
          }
          
          const result = await exchangeOAuth1Verifier(body.oauthToken, oauthTokenSecret, body.oauthVerifier);
          
          await updateSettings('xtwitter', tenantId, {
            ...currentSettings,
            accessToken: result.accessToken,
            accessTokenSecret: result.accessTokenSecret,
            userId: result.userId,
            accountName: `@${result.screenName}`,
            enabled: true,
            _pendingOAuthToken: '',
            _pendingOAuthTokenSecret: '',
          });
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              message: 'X erfolgreich verbunden (OAuth 1.0a)!',
              userId: result.userId,
              username: result.screenName,
              accountName: `@${result.screenName}`
            })
          };
        }
        
        // OAuth 2.0 PKCE token exchange (fallback)
        const { code, redirectUri, codeVerifier } = body;
        if (!code || !redirectUri || !codeVerifier) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Code, Redirect URI und Code Verifier erforderlich' }) };
        }
        
        const { accessToken, refreshToken, userId: xUserId, username } = await exchangeXTwitterCode(code, redirectUri, codeVerifier, tenantId);
        
        const currentSettings = await getSettings('xtwitter', tenantId);
        await updateSettings('xtwitter', tenantId, {
          ...currentSettings,
          oauth2AccessToken: accessToken,
          oauth2RefreshToken: refreshToken,
          userId: xUserId,
          accountName: `@${username}`,
          enabled: true
        });
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'X erfolgreich verbunden!',
            userId: xUserId,
            username: username,
            accountName: `@${username}`
          }) 
        };
      } catch (oauthError) {
        console.error('X OAuth error:', oauthError);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
          message: 'OAuth fehlgeschlagen', 
          error: oauthError.message 
        }) };
      }
    }

    // POST oauth/callback - TikTok OAuth token exchange
    // Path: /tiktok/oauth/callback
    if (httpMethod === 'POST' && provider === 'tiktok' && (action === 'oauth' || path.includes('/oauth/callback'))) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const body = JSON.parse(event.body || '{}');
        const { code, redirectUri, codeVerifier } = body;
        
        if (!code || !redirectUri) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Code und Redirect URI erforderlich' }) };
        }
        
        const { accessToken, refreshToken, openId, displayName, avatarUrl, expiresAt } = await exchangeTikTokCode(code, redirectUri, codeVerifier, tenantId);
        
        // Auto-save the tokens and user info to settings
        const currentSettings = await getSettings('tiktok', tenantId);
        await updateSettings('tiktok', tenantId, {
          ...currentSettings,
          accessToken: accessToken,
          refreshToken: refreshToken,
          openId: openId,
          displayName: displayName,
          avatarUrl: avatarUrl,
          expiresAt: expiresAt,
          enabled: true
        });
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            message: 'TikTok erfolgreich verbunden!',
            openId: openId,
            displayName: displayName
          }) 
        };
      } catch (oauthError) {
        console.error('TikTok OAuth error:', oauthError);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
          message: 'OAuth fehlgeschlagen', 
          error: oauthError.message 
        }) };
      }
    }

    // POST /meta/verify-permissions - Verify all Meta API permissions for App Review
    // This endpoint calls all required Meta Graph API endpoints to satisfy Meta's app review requirements
    if (httpMethod === 'POST' && provider === 'meta' && action === 'verify-permissions') {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId, isPlatformAdmin))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const results = [];
      
      try {
        // Get Facebook settings for page access token
        const fbSettings = await getSettings('facebook', tenantId);
        const igSettings = await getSettings('instagram', tenantId);
        const threadsSettings = await getSettings('threads', tenantId);
        
        if (!fbSettings.pageAccessToken && !igSettings.accessToken && !threadsSettings.accessToken) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ 
            success: false,
            message: 'Keine Meta-Verbindung vorhanden. Bitte zuerst Facebook, Instagram oder Threads verbinden.',
            results: []
          }) };
        }
        
        const pageToken = fbSettings.pageAccessToken;
        const pageId = fbSettings.pageId;
        const igToken = igSettings.accessToken;
        const igAccountId = igSettings.accountId;
        const threadsToken = threadsSettings.accessToken;
        const threadsUserId = threadsSettings.userId;
        
        // 1. public_profile - GET /me (works with page token, returns page info)
        if (pageToken) {
          try {
            const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${pageToken}`);
            const meData = await meResponse.json();
            results.push({ permission: 'public_profile', status: meResponse.ok ? 'success' : 'error', message: meResponse.ok ? `User: ${meData.name || meData.id}` : meData.error?.message });
          } catch (e) { results.push({ permission: 'public_profile', status: 'error', message: e.message }); }
        }
        
        // 2. pages_show_list - For page tokens, we verify by checking page info instead
        // Page tokens can't call /me/accounts, but we can verify the page exists
        if (pageToken && pageId) {
          try {
            const pageInfoResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=id,name,category&access_token=${pageToken}`);
            const pageInfoData = await pageInfoResponse.json();
            results.push({ permission: 'pages_show_list', status: pageInfoResponse.ok ? 'success' : 'error', message: pageInfoResponse.ok ? `Page: ${pageInfoData.name}` : pageInfoData.error?.message });
          } catch (e) { results.push({ permission: 'pages_show_list', status: 'error', message: e.message }); }
        }
        
        // 3. pages_read_engagement - GET /{page-id}?fields=engagement,fan_count
        if (pageToken && pageId) {
          try {
            const engagementResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=engagement,fan_count,followers_count&access_token=${pageToken}`);
            const engagementData = await engagementResponse.json();
            results.push({ permission: 'pages_read_engagement', status: engagementResponse.ok ? 'success' : 'error', message: engagementResponse.ok ? `Fans: ${engagementData.fan_count || 0}` : engagementData.error?.message });
          } catch (e) { results.push({ permission: 'pages_read_engagement', status: 'error', message: e.message }); }
        }
        
        // 4. pages_manage_posts - POST /{page-id}/feed (create and delete test post)
        if (pageToken && pageId) {
          try {
            const postResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: '🔧 ViralTenant API Verification Test - wird automatisch gelöscht', access_token: pageToken })
            });
            const postData = await postResponse.json();
            if (postResponse.ok && postData.id) {
              // Delete the test post immediately
              await fetch(`https://graph.facebook.com/v18.0/${postData.id}?access_token=${pageToken}`, { method: 'DELETE' });
              results.push({ permission: 'pages_manage_posts', status: 'success', message: 'Post erstellt und gelöscht' });
            } else {
              results.push({ permission: 'pages_manage_posts', status: 'error', message: postData.error?.message || 'Post fehlgeschlagen' });
            }
          } catch (e) { results.push({ permission: 'pages_manage_posts', status: 'error', message: e.message }); }
        }
        
        // 5. publish_video - Check video upload capability (just verify endpoint exists)
        if (pageToken && pageId) {
          try {
            // We just check if the endpoint is accessible, not actually upload
            const videoCheckResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/videos?access_token=${pageToken}`);
            results.push({ permission: 'publish_video', status: videoCheckResponse.ok ? 'success' : 'error', message: videoCheckResponse.ok ? 'Video-Upload verfügbar' : 'Video-Upload nicht verfügbar' });
          } catch (e) { results.push({ permission: 'publish_video', status: 'error', message: e.message }); }
        }
        
        // 6. Live Video API - GET /{page-id}/live_videos to check access (less intrusive than POST)
        if (pageToken && pageId) {
          try {
            const liveResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/live_videos?access_token=${pageToken}`);
            const liveData = await liveResponse.json();
            if (liveResponse.ok) {
              results.push({ permission: 'Live Video API', status: 'success', message: `Live Videos: ${liveData.data?.length || 0}` });
            } else {
              results.push({ permission: 'Live Video API', status: 'error', message: liveData.error?.message || 'Live Video nicht verfügbar' });
            }
          } catch (e) { results.push({ permission: 'Live Video API', status: 'error', message: e.message }); }
        }
        
        // 7. instagram_basic - Use Instagram Graph API (graph.instagram.com) for Instagram Login tokens
        if (igToken && igAccountId) {
          try {
            // Instagram Login API uses graph.instagram.com, not graph.facebook.com
            const igBasicResponse = await fetch(`https://graph.instagram.com/v21.0/me?fields=user_id,username,account_type,media_count&access_token=${igToken}`);
            const igBasicData = await igBasicResponse.json();
            if (igBasicResponse.ok) {
              results.push({ permission: 'instagram_basic', status: 'success', message: `@${igBasicData.username}, ${igBasicData.media_count || 0} Posts` });
            } else {
              // Fallback: Try Facebook Graph API for business accounts
              const igFbResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,media_count&access_token=${igToken}`);
              const igFbData = await igFbResponse.json();
              results.push({ permission: 'instagram_basic', status: igFbResponse.ok ? 'success' : 'error', message: igFbResponse.ok ? `@${igFbData.username}, ${igFbData.media_count} Posts` : igBasicData.error?.message || igFbData.error?.message });
            }
          } catch (e) { results.push({ permission: 'instagram_basic', status: 'error', message: e.message }); }
        } else if (pageToken && pageId) {
          // Fallback: Try to get Instagram account via Facebook Page
          try {
            const igFromPageResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account{id,username,media_count}&access_token=${pageToken}`);
            const igFromPageData = await igFromPageResponse.json();
            if (igFromPageResponse.ok && igFromPageData.instagram_business_account) {
              const ig = igFromPageData.instagram_business_account;
              results.push({ permission: 'instagram_basic', status: 'success', message: `@${ig.username}, ${ig.media_count} Posts (via Page)` });
            } else {
              results.push({ permission: 'instagram_basic', status: 'error', message: 'Kein Instagram Account verbunden' });
            }
          } catch (e) { results.push({ permission: 'instagram_basic', status: 'error', message: e.message }); }
        }
        
        // 8. instagram_content_publish - Check media endpoint via Instagram Graph API
        if (igToken && igAccountId) {
          try {
            // Instagram Login API: GET /me/media for content publish check
            const igPublishResponse = await fetch(`https://graph.instagram.com/v21.0/me/media?access_token=${igToken}`);
            const igPublishData = await igPublishResponse.json();
            if (igPublishResponse.ok) {
              results.push({ permission: 'instagram_content_publish', status: 'success', message: `Content Publish verfügbar (${igPublishData.data?.length || 0} Posts)` });
            } else {
              // Fallback: Try Facebook Graph API
              const igFbPublishResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media?access_token=${igToken}`);
              results.push({ permission: 'instagram_content_publish', status: igFbPublishResponse.ok ? 'success' : 'error', message: igFbPublishResponse.ok ? 'Content Publish verfügbar' : igPublishData.error?.message || 'Content Publish nicht verfügbar' });
            }
          } catch (e) { results.push({ permission: 'instagram_content_publish', status: 'error', message: e.message }); }
        } else if (pageToken && pageId) {
          // Fallback: Check via Facebook Page's Instagram account
          try {
            const igFromPageResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
            const igFromPageData = await igFromPageResponse.json();
            if (igFromPageResponse.ok && igFromPageData.instagram_business_account) {
              const igId = igFromPageData.instagram_business_account.id;
              const igMediaResponse = await fetch(`https://graph.facebook.com/v18.0/${igId}/media?access_token=${pageToken}`);
              results.push({ permission: 'instagram_content_publish', status: igMediaResponse.ok ? 'success' : 'error', message: igMediaResponse.ok ? 'Content Publish verfügbar (via Page)' : 'Content Publish nicht verfügbar' });
            } else {
              results.push({ permission: 'instagram_content_publish', status: 'error', message: 'Kein Instagram Account verbunden' });
            }
          } catch (e) { results.push({ permission: 'instagram_content_publish', status: 'error', message: e.message }); }
        }
        
        // 9. threads_basic - GET /me/threads_publishing_limit
        if (threadsToken) {
          try {
            const threadsBasicResponse = await fetch(`https://graph.threads.net/v1.0/me/threads_publishing_limit?access_token=${threadsToken}`);
            const threadsBasicData = await threadsBasicResponse.json();
            results.push({ permission: 'threads_basic', status: threadsBasicResponse.ok ? 'success' : 'error', message: threadsBasicResponse.ok ? `Limit: ${threadsBasicData.data?.[0]?.quota_usage || 0}/${threadsBasicData.data?.[0]?.config?.quota_total || 250}` : threadsBasicData.error?.message });
          } catch (e) { results.push({ permission: 'threads_basic', status: 'error', message: e.message }); }
        }
        
        // 10. threads_content_publish - POST /{threads-user-id}/threads (text only, then delete)
        if (threadsToken && threadsUserId) {
          try {
            // Create a text-only thread container
            const createResponse = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `media_type=TEXT&text=${encodeURIComponent('🔧 ViralTenant API Verification - wird nicht veröffentlicht')}&access_token=${threadsToken}`
            });
            const createData = await createResponse.json();
            if (createResponse.ok && createData.id) {
              // Don't publish, just verify we can create containers
              results.push({ permission: 'threads_content_publish', status: 'success', message: 'Thread Container erstellt' });
            } else {
              results.push({ permission: 'threads_content_publish', status: 'error', message: createData.error?.message || 'Thread fehlgeschlagen' });
            }
          } catch (e) { results.push({ permission: 'threads_content_publish', status: 'error', message: e.message }); }
        }
        
        const successCount = results.filter(r => r.status === 'success').length;
        const totalCount = results.length;
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ 
            success: successCount === totalCount,
            message: `${successCount}/${totalCount} Berechtigungen erfolgreich verifiziert`,
            results 
          }) 
        };
        
      } catch (verifyError) {
        console.error('Meta API verification error:', verifyError);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ 
          success: false,
          message: 'Verification fehlgeschlagen',
          error: verifyError.message,
          results 
        }) };
      }
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
  }
};
