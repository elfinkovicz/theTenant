const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });

// CORS headers
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

// Default hero content
const getDefaultHeroContent = (tenantId) => ({
  tenant_id: tenantId,
  hero_id: 'home-hero',
  logo_url: null,
  logo_key: null,
  title: 'Your Brand',
  subtitle: 'Deine moderne Creator-Plattform für Live-Streaming, Events und Community',
  logo_size: 160,
  navbar_logo_url: null,
  navbar_logo_key: null,
  navbar_title: 'Your Brand',
  hero_height: 70,
  hero_width: 'full',
  hero_background: {
    type: 'gradient',
    value: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))'
  },
  theme_id: 'default',
  theme_name: 'ViralTenant (Standard)',
  theme_colors: {
    primary: '#f59e0b',
    primaryHover: '#d97706',
    secondary: '#1f2937',
    secondaryHover: '#374151',
    background: '#030712',
    backgroundLight: '#111827',
    text: '#ffffff',
    textSecondary: '#9ca3af',
    border: '#374151',
    accent: '#f59e0b'
  },
  design_settings: {
    buttonSize: 'medium',
    buttonRoundness: 8,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 16,
    spacing: 1,
    cardRoundness: 12,
    cardPadding: 24,
    borderWidth: 1,
    animations: {
      speed: 'normal',
      hoverScale: 1.05,
      hoverEnabled: true,
      transitionType: 'ease-in-out',
      pageTransitions: true,
      scrollAnimations: true
    }
  },
  stream_title: 'Live Stream',
  stream_description: 'Welcome to the stream!',
  auto_save_stream: false,
  auto_publish_to_newsfeed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Convert DB format to API format
const toApiFormat = (dbItem) => {
  if (!dbItem) return null;
  
  // Generate logo URLs from keys if not already set
  const logoUrl = dbItem.logo_url || (dbItem.logo_key ? `https://${process.env.CLOUDFRONT_DOMAIN}/${dbItem.logo_key}` : null);
  const navbarLogoUrl = dbItem.navbar_logo_url || (dbItem.navbar_logo_key ? `https://${process.env.CLOUDFRONT_DOMAIN}/${dbItem.navbar_logo_key}` : null);
  
  return {
    heroId: dbItem.hero_id,
    logoKey: dbItem.logo_key,
    logoUrl: logoUrl,
    title: dbItem.title,
    subtitle: dbItem.subtitle,
    logoSize: dbItem.logo_size,
    navbarLogoKey: dbItem.navbar_logo_key,
    navbarLogoUrl: navbarLogoUrl,
    navbarTitle: dbItem.navbar_title,
    heroHeight: dbItem.hero_height,
    heroWidth: dbItem.hero_width,
    heroBackground: dbItem.hero_background,
    themeId: dbItem.theme_id,
    themeName: dbItem.theme_name,
    themeColors: dbItem.theme_colors,
    designSettings: dbItem.design_settings,
    navSettings: dbItem.nav_settings,
    streamTitle: dbItem.stream_title,
    streamDescription: dbItem.stream_description,
    autoSaveStream: dbItem.auto_save_stream,
    autoPublishToNewsfeed: dbItem.auto_publish_to_newsfeed,
    featuresTitle: dbItem.features_title,
    featuresSubtitle: dbItem.features_subtitle,
    ctaTitle: dbItem.cta_title,
    ctaSubtitle: dbItem.cta_subtitle,
    ctaButtonText: dbItem.cta_button_text,
    featureCards: dbItem.feature_cards,
    updatedAt: dbItem.updated_at
  };
};

// Check if user is tenant admin
async function isUserTenantAdmin(userId, tenantId) {
  // For platform tenant, check if user has any admin role
  if (tenantId === 'platform') {
    console.log('Platform tenant - checking if user has any admin role');
    try {
      // Try to query by user_id using the primary key pattern
      const params = {
        TableName: process.env.USER_TENANTS_TABLE,
        KeyConditionExpression: 'user_id = :userId',
        FilterExpression: '#role = :adminRole',
        ExpressionAttributeNames: {
          '#role': 'role'
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':adminRole': 'admin'
        }
      };

      const result = await dynamodb.send(new QueryCommand(params));
      const hasAdminRole = result.Items && result.Items.length > 0;
      console.log('User has admin role for platform:', hasAdminRole);
      return hasAdminRole;
    } catch (error) {
      console.error('Error checking platform admin access:', error);
      // Fallback: allow if user is authenticated (for now)
      console.log('Fallback: allowing platform access for authenticated user');
      return true;
    }
  }

  const params = {
    TableName: process.env.USER_TENANTS_TABLE,
    Key: {
      user_id: userId,
      tenant_id: tenantId
    }
  };

  try {
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item && result.Item.role === 'admin';
  } catch (error) {
    console.error('Error checking user tenant admin:', error);
    return false;
  }
}

// Get hero content for tenant
async function getHeroContent(tenantId) {
  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Key: { tenant_id: tenantId }
  };

  try {
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item || getDefaultHeroContent(tenantId);
  } catch (error) {
    console.error('Error getting hero content:', error);
    return getDefaultHeroContent(tenantId);
  }
}

// Update hero content
async function updateHeroContent(tenantId, updates) {
  // Get existing content first
  const existing = await getHeroContent(tenantId);
  
  console.log('updateHeroContent called with updates:', JSON.stringify(updates, null, 2));
  console.log('Existing nav_settings:', JSON.stringify(existing.nav_settings, null, 2));
  
  // Handle navSettings - merge with existing if provided
  let navSettings = existing.nav_settings;
  if (updates.navSettings !== undefined) {
    navSettings = updates.navSettings;
    console.log('New nav_settings to save:', JSON.stringify(navSettings, null, 2));
  }
  
  const item = {
    ...existing,
    tenant_id: tenantId,
    hero_id: updates.heroId || existing.hero_id || 'home-hero',
    logo_key: updates.logoKey !== undefined ? updates.logoKey : existing.logo_key,
    logo_url: updates.logoUrl !== undefined ? updates.logoUrl : existing.logo_url,
    title: updates.title || existing.title,
    subtitle: updates.subtitle !== undefined ? updates.subtitle : existing.subtitle,
    logo_size: updates.logoSize || existing.logo_size,
    navbar_logo_key: updates.navbarLogoKey !== undefined ? updates.navbarLogoKey : existing.navbar_logo_key,
    navbar_logo_url: updates.navbarLogoUrl !== undefined ? updates.navbarLogoUrl : existing.navbar_logo_url,
    navbar_title: updates.navbarTitle || existing.navbar_title,
    hero_height: updates.heroHeight || existing.hero_height,
    hero_width: updates.heroWidth || existing.hero_width,
    hero_background: updates.heroBackground || existing.hero_background,
    theme_id: updates.themeId || existing.theme_id,
    theme_name: updates.themeName || existing.theme_name,
    theme_colors: updates.themeColors || existing.theme_colors,
    design_settings: updates.designSettings || existing.design_settings,
    nav_settings: navSettings,
    stream_title: updates.streamTitle || existing.stream_title,
    stream_description: updates.streamDescription || existing.stream_description,
    auto_save_stream: updates.autoSaveStream !== undefined ? updates.autoSaveStream : existing.auto_save_stream,
    auto_publish_to_newsfeed: updates.autoPublishToNewsfeed !== undefined ? updates.autoPublishToNewsfeed : existing.auto_publish_to_newsfeed,
    features_title: updates.featuresTitle !== undefined ? updates.featuresTitle : existing.features_title,
    features_subtitle: updates.featuresSubtitle !== undefined ? updates.featuresSubtitle : existing.features_subtitle,
    cta_title: updates.ctaTitle !== undefined ? updates.ctaTitle : existing.cta_title,
    cta_subtitle: updates.ctaSubtitle !== undefined ? updates.ctaSubtitle : existing.cta_subtitle,
    cta_button_text: updates.ctaButtonText !== undefined ? updates.ctaButtonText : existing.cta_button_text,
    feature_cards: updates.featureCards !== undefined ? updates.featureCards : existing.feature_cards,
    updated_at: new Date().toISOString()
  };

  console.log('Final item nav_settings:', JSON.stringify(item.nav_settings, null, 2));

  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Item: item
  };

  await dynamodb.send(new PutCommand(params));
  return item;
}

// Generate presigned URL for upload
async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const extension = fileName.split('.').pop();
  const timestamp = Date.now();
  
  let key;
  switch (uploadType) {
    case 'hero':
      key = `tenants/${tenantId}/hero/logo-${timestamp}.${extension}`;
      break;
    case 'navbar':
      key = `tenants/${tenantId}/navbar/logo-${timestamp}.${extension}`;
      break;
    case 'background-image':
      key = `tenants/${tenantId}/hero/background-${timestamp}.${extension}`;
      break;
    case 'background-video':
      key = `tenants/${tenantId}/hero/background-video-${timestamp}.${extension}`;
      break;
    default:
      key = `tenants/${tenantId}/assets/${timestamp}-${fileName}`;
  }

  const command = new PutObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  return {
    uploadUrl,
    logoKey: key,
    logoUrl: publicUrl
  };
}

// Delete file from S3
async function deleteFile(key) {
  if (!key) return;
  
  const command = new DeleteObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: key
  });

  try {
    await s3.send(command);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}

// ============================================================================
// ADVERTISEMENT FUNCTIONS
// ============================================================================

// Default advertisement content
const getDefaultAdvertisement = (tenantId, position) => ({
  tenant_id: tenantId,
  ad_id: `${position}-banner`,
  position: position,
  image_key: null,
  image_url: null,
  link_url: null,
  enabled: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Get advertisements for tenant
async function getAdvertisements(tenantId) {
  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Key: { tenant_id: tenantId }
  };

  try {
    const result = await dynamodb.send(new GetCommand(params));
    const item = result.Item || {};
    
    // Extract advertisement data from the tenant frontend record
    const topBanner = item.top_banner || getDefaultAdvertisement(tenantId, 'top');
    const bottomBanner = item.bottom_banner || getDefaultAdvertisement(tenantId, 'bottom');
    
    return { topBanner, bottomBanner };
  } catch (error) {
    console.error('Error getting advertisements:', error);
    return {
      topBanner: getDefaultAdvertisement(tenantId, 'top'),
      bottomBanner: getDefaultAdvertisement(tenantId, 'bottom')
    };
  }
}

// Convert advertisement DB format to API format
const adToApiFormat = (dbItem, position) => {
  if (!dbItem) return null;
  
  // Generate image URL from key if not already set
  const imageUrl = dbItem.image_url || (dbItem.image_key ? `https://${process.env.CLOUDFRONT_DOMAIN}/${dbItem.image_key}` : null);
  
  return {
    adId: dbItem.ad_id || `${position}-banner`,
    position: position,
    imageKey: dbItem.image_key,
    imageUrl: imageUrl,
    linkUrl: dbItem.link_url,
    enabled: dbItem.enabled || false,
    updatedAt: dbItem.updated_at
  };
};

// Update advertisement
async function updateAdvertisement(tenantId, position, updates) {
  // Get existing content first
  const existing = await getHeroContent(tenantId);
  const existingAd = position === 'top' ? existing.top_banner : existing.bottom_banner;
  const defaultAd = getDefaultAdvertisement(tenantId, position);
  
  const adData = {
    ad_id: updates.adId || existingAd?.ad_id || defaultAd.ad_id,
    position: position,
    image_key: updates.imageKey !== undefined ? updates.imageKey : (existingAd?.image_key || null),
    image_url: updates.imageUrl !== undefined ? updates.imageUrl : (existingAd?.image_url || null),
    link_url: updates.linkUrl !== undefined ? updates.linkUrl : (existingAd?.link_url || null),
    enabled: updates.enabled !== undefined ? updates.enabled : (existingAd?.enabled || false),
    updated_at: new Date().toISOString()
  };

  // Update the tenant frontend record with the new ad data
  const updateField = position === 'top' ? 'top_banner' : 'bottom_banner';
  
  const item = {
    ...existing,
    tenant_id: tenantId,
    [updateField]: adData,
    updated_at: new Date().toISOString()
  };

  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Item: item
  };

  await dynamodb.send(new PutCommand(params));
  return adData;
}

// Generate presigned URL for advertisement upload
async function generateAdUploadUrl(tenantId, fileName, fileType, position) {
  const extension = fileName.split('.').pop();
  const timestamp = Date.now();
  const key = `tenants/${tenantId}/ads/${position}-banner-${timestamp}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  return {
    uploadUrl,
    imageKey: key,
    imageUrl: publicUrl
  };
}

// ============================================================================
// LEGAL DOCUMENTS FUNCTIONS
// ============================================================================

// Default legal documents
const getDefaultLegalDocs = () => [
  {
    id: 'impressum',
    title: 'Impressum',
    content: `# Impressum

## Angaben gemäß § 5 TMG

**Firmenname**
Musterstraße 1
12345 Musterstadt
Deutschland

## Kontakt
E-Mail: kontakt@example.com

## Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
Max Mustermann
Musterstraße 1
12345 Musterstadt

## Haftungsausschluss
Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.`,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'datenschutz',
    title: 'Datenschutzerklärung',
    content: `# Datenschutzerklärung

## 1. Datenschutz auf einen Blick

### Allgemeine Hinweise
Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.

### Datenerfassung auf dieser Website
**Wer ist verantwortlich für die Datenerfassung auf dieser Website?**
Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber.

**Wie erfassen wir Ihre Daten?**
Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Andere Daten werden automatisch beim Besuch der Website durch unsere IT-Systeme erfasst.

## 2. Hosting
Wir hosten die Inhalte unserer Website bei Amazon Web Services (AWS).`,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'agb',
    title: 'AGB',
    content: `# Allgemeine Geschäftsbedingungen

## § 1 Geltungsbereich
Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge, die über diese Plattform geschlossen werden.

## § 2 Vertragspartner
Der Kaufvertrag kommt zustande mit dem jeweiligen Creator/Anbieter.

## § 3 Vertragsschluss
Die Darstellung der Produkte im Online-Shop stellt kein rechtlich bindendes Angebot, sondern einen unverbindlichen Online-Katalog dar.

## § 4 Preise und Zahlungsbedingungen
Die angegebenen Preise sind Endpreise. Die Zahlung erfolgt über die angebotenen Zahlungsmethoden.

## § 5 Widerrufsrecht
Verbraucher haben ein 14-tägiges Widerrufsrecht.`,
    lastUpdated: new Date().toISOString()
  }
];

// Get legal documents for tenant
async function getLegalDocs(tenantId) {
  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Key: { tenant_id: tenantId }
  };

  try {
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item?.legal_docs || getDefaultLegalDocs();
  } catch (error) {
    console.error('Error getting legal docs:', error);
    return getDefaultLegalDocs();
  }
}

// Update legal documents
async function updateLegalDocs(tenantId, legalDocs) {
  const existing = await getHeroContent(tenantId);
  
  // Update lastUpdated for each doc
  const updatedDocs = legalDocs.map(doc => ({
    ...doc,
    lastUpdated: new Date().toISOString()
  }));
  
  const item = {
    ...existing,
    tenant_id: tenantId,
    legal_docs: updatedDocs,
    updated_at: new Date().toISOString()
  };

  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Item: item
  };

  await dynamodb.send(new PutCommand(params));
  return updatedDocs;
}

// ============================================================================
// PAGE BANNER FUNCTIONS
// ============================================================================

// Get all page banners for tenant
async function getPageBanners(tenantId) {
  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Key: { tenant_id: tenantId }
  };

  try {
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item?.page_banners || {};
  } catch (error) {
    console.error('Error getting page banners:', error);
    return {};
  }
}

// Convert banner DB format to API format
const bannerToApiFormat = (dbItem, pageId) => {
  if (!dbItem) return null;
  
  const bannerUrl = dbItem.banner_url || (dbItem.banner_key ? `https://${process.env.CLOUDFRONT_DOMAIN}/${dbItem.banner_key}` : null);
  
  return {
    pageId: pageId,
    bannerKey: dbItem.banner_key,
    bannerUrl: bannerUrl,
    title: dbItem.title,
    subtitle: dbItem.subtitle,
    height: dbItem.height || 200,
    overlay: dbItem.overlay !== false,
    overlayOpacity: dbItem.overlay_opacity ?? 0.5,
    blur: dbItem.blur ?? 0,
    updatedAt: dbItem.updated_at
  };
};

// Update page banner
async function updatePageBanner(tenantId, pageId, updates) {
  console.log('updatePageBanner called with:', { tenantId, pageId, updates });
  
  const existing = await getHeroContent(tenantId);
  console.log('Existing hero content:', JSON.stringify(existing, null, 2));
  
  const existingBanners = existing.page_banners || {};
  const existingBanner = existingBanners[pageId] || {};
  console.log('Existing banner for pageId', pageId, ':', existingBanner);
  
  const bannerData = {
    page_id: pageId,
    banner_key: updates.bannerKey !== undefined ? updates.bannerKey : existingBanner.banner_key,
    banner_url: updates.bannerUrl !== undefined ? updates.bannerUrl : existingBanner.banner_url,
    title: updates.title !== undefined ? updates.title : existingBanner.title,
    subtitle: updates.subtitle !== undefined ? updates.subtitle : existingBanner.subtitle,
    height: updates.height !== undefined ? updates.height : (existingBanner.height || 200),
    overlay: updates.overlay !== undefined ? updates.overlay : (existingBanner.overlay !== false),
    overlay_opacity: updates.overlayOpacity !== undefined ? updates.overlayOpacity : (existingBanner.overlay_opacity ?? 0.5),
    blur: updates.blur !== undefined ? updates.blur : (existingBanner.blur ?? 0),
    updated_at: new Date().toISOString()
  };
  
  console.log('Banner data before cleanup:', bannerData);

  // Only remove undefined values, keep null and empty strings
  Object.keys(bannerData).forEach(key => {
    if (bannerData[key] === undefined) {
      delete bannerData[key];
    }
  });
  
  console.log('Banner data after cleanup:', bannerData);

  const updatedBanners = {
    ...existingBanners,
    [pageId]: bannerData
  };

  const item = {
    ...existing,
    tenant_id: tenantId,
    page_banners: updatedBanners,
    updated_at: new Date().toISOString()
  };

  // Remove undefined values from item
  Object.keys(item).forEach(key => {
    if (item[key] === undefined) {
      delete item[key];
    }
  });
  
  console.log('Final item to save:', JSON.stringify(item, null, 2));

  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Item: item
  };

  await dynamodb.send(new PutCommand(params));
  console.log('Banner saved successfully');
  return bannerData;
}

// Generate presigned URL for banner upload
async function generateBannerUploadUrl(tenantId, pageId, fileName, fileType) {
  console.log('generateBannerUploadUrl called:', { tenantId, pageId, fileName, fileType });
  
  const extension = fileName.split('.').pop();
  const timestamp = Date.now();
  const key = `tenants/${tenantId}/banners/${pageId}-${timestamp}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ASSETS_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  console.log('Generated upload URL, now saving banner data:', { key, publicUrl });
  
  // Save banner data to DynamoDB
  try {
    const result = await updatePageBanner(tenantId, pageId, {
      bannerKey: key,
      bannerUrl: publicUrl
    });
    console.log('Banner data saved successfully:', result);
  } catch (error) {
    console.error('Error saving banner data to DynamoDB:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    // Don't throw - let the upload continue, but log the error
  }

  return {
    uploadUrl,
    bannerKey: key,
    bannerUrl: publicUrl
  };
}

// Delete page banner
async function deletePageBanner(tenantId, pageId) {
  const existing = await getHeroContent(tenantId);
  const existingBanners = existing.page_banners || {};
  const banner = existingBanners[pageId];
  
  if (banner?.banner_key) {
    await deleteFile(banner.banner_key);
  }
  
  delete existingBanners[pageId];
  
  const item = {
    ...existing,
    tenant_id: tenantId,
    page_banners: existingBanners,
    updated_at: new Date().toISOString()
  };

  const params = {
    TableName: process.env.TENANT_FRONTEND_TABLE,
    Item: item
  };

  await dynamodb.send(new PutCommand(params));
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path, pathParameters, queryStringParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const rawTenantId = authorizerTenantId || pathParameters?.tenantId;
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(rawTenantId);
  console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);

  try {
    // ========================================================================
    // PAGE BANNER ENDPOINTS (must come before legal to handle /banners/legal)
    // ========================================================================

    // GET /tenants/{tenantId}/banners - Get all page banners (public)
    if (httpMethod === 'GET' && path.match(/\/banners\/?$/) && !path.includes('/upload-url')) {
      const banners = await getPageBanners(tenantId);
      const formattedBanners = {};
      
      for (const [pageId, banner] of Object.entries(banners)) {
        formattedBanners[pageId] = bannerToApiFormat(banner, pageId);
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          banners: formattedBanners,
          resolvedTenantId: tenantId  // Return resolved UUID for frontend to use
        })
      };
    }

    // PUT /tenants/{tenantId}/banners/{pageId} - Update page banner (admin only)
    // This handles /banners/legal as a page banner, not as legal docs
    if (httpMethod === 'PUT' && path.match(/\/banners\/[^/]+$/) && !path.includes('/upload-url')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const pageId = path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const updated = await updatePageBanner(tenantId, pageId, body);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Banner erfolgreich aktualisiert',
          banner: bannerToApiFormat(updated, pageId),
          resolvedTenantId: tenantId  // Return resolved UUID for frontend to use
        })
      };
    }

    // POST /tenants/{tenantId}/banners/{pageId}/upload-url - Get presigned upload URL (admin only)
    if (httpMethod === 'POST' && path.includes('/banners/') && path.includes('/upload-url')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      // Extract pageId from path: /tenants/{tenantId}/banners/{pageId}/upload-url
      const pathParts = path.split('/');
      const uploadUrlIndex = pathParts.indexOf('upload-url');
      const pageId = pathParts[uploadUrlIndex - 1];
      
      const body = JSON.parse(event.body || '{}');
      const { fileName, fileType } = body;

      if (!fileName || !fileType) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'fileName und fileType erforderlich' })
        };
      }

      try {
        const result = await generateBannerUploadUrl(tenantId, pageId, fileName, fileType);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            ...result,
            resolvedTenantId: tenantId  // Return resolved UUID for frontend to use
          })
        };
      } catch (error) {
        console.error('Error generating banner upload URL:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Generieren der Upload-URL', error: error.message })
        };
      }
    }

    // DELETE /tenants/{tenantId}/banners/{pageId} - Delete page banner (admin only)
    if (httpMethod === 'DELETE' && path.match(/\/banners\/[^/]+$/)) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const pageId = path.split('/').pop();
      await deletePageBanner(tenantId, pageId);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Banner erfolgreich gelöscht' })
      };
    }

    // ========================================================================
    // LEGAL DOCUMENTS ENDPOINTS
    // ========================================================================

    // GET /tenants/{tenantId}/legal - Get legal documents (public)
    if (httpMethod === 'GET' && path.match(/\/tenants\/[^/]+\/legal\/?$/)) {
      const legalDocs = await getLegalDocs(tenantId);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ legalDocs })
      };
    }

    // PUT /tenants/{tenantId}/legal - Update legal documents (admin only)
    if (httpMethod === 'PUT' && path.match(/\/tenants\/[^/]+\/legal\/?$/)) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { legalDocs } = body;

      if (!legalDocs || !Array.isArray(legalDocs)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'legalDocs Array erforderlich' })
        };
      }

      const updated = await updateLegalDocs(tenantId, legalDocs);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Rechtliche Dokumente erfolgreich aktualisiert',
          legalDocs: updated
        })
      };
    }

    // ========================================================================
    // ADVERTISEMENT ENDPOINTS
    // ========================================================================

    // GET /tenants/{tenantId}/advertisement - Get advertisements (public)
    if (httpMethod === 'GET' && path.includes('/advertisement') && !path.includes('/upload-url')) {
      const { topBanner, bottomBanner } = await getAdvertisements(tenantId);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          topBanner: adToApiFormat(topBanner, 'top'),
          bottomBanner: adToApiFormat(bottomBanner, 'bottom'),
          advertisement: adToApiFormat(topBanner, 'top') // Backward compatibility
        })
      };
    }

    // PUT /tenants/{tenantId}/advertisement - Update advertisement (admin only)
    if (httpMethod === 'PUT' && path.includes('/advertisement') && !path.includes('/upload-url') && !path.includes('/image')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const position = body.position || 'top';
      const updated = await updateAdvertisement(tenantId, position, body);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Werbebanner erfolgreich aktualisiert',
          advertisement: adToApiFormat(updated, position)
        })
      };
    }

    // POST /tenants/{tenantId}/advertisement/upload-url - Get presigned upload URL (admin only)
    if (httpMethod === 'POST' && path.includes('/advertisement/upload-url')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { fileName, fileType, position } = body;

      if (!fileName || !fileType) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'fileName und fileType erforderlich' })
        };
      }

      const result = await generateAdUploadUrl(tenantId, fileName, fileType, position || 'top');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      };
    }

    // DELETE /tenants/{tenantId}/advertisement/image - Delete ad image (admin only)
    if (httpMethod === 'DELETE' && path.includes('/advertisement/image')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const position = body.position || queryStringParameters?.position || 'top';
      const { topBanner, bottomBanner } = await getAdvertisements(tenantId);
      const banner = position === 'top' ? topBanner : bottomBanner;

      if (banner?.image_key) {
        await deleteFile(banner.image_key);
        await updateAdvertisement(tenantId, position, { imageKey: null, imageUrl: null });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Werbebanner-Bild erfolgreich gelöscht' })
      };
    }

    // ========================================================================
    // HERO ENDPOINTS
    // ========================================================================

    // GET /tenants/{tenantId}/hero - Get hero content (public for subdomain detection)
    if (httpMethod === 'GET' && path.includes('/hero') && !path.includes('/upload-url')) {
      const heroContent = await getHeroContent(tenantId);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ hero: toApiFormat(heroContent) })
      };
    }

    // PUT /tenants/{tenantId}/hero - Update hero content (admin only)
    if (httpMethod === 'PUT' && path.includes('/hero') && !path.includes('/upload-url') && !path.includes('/logo')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const updated = await updateHeroContent(tenantId, body);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Hero-Inhalt erfolgreich aktualisiert',
          hero: toApiFormat(updated)
        })
      };
    }

    // POST /tenants/{tenantId}/hero/upload-url - Get presigned upload URL (admin only)
    if (httpMethod === 'POST' && path.includes('/hero/upload-url')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { fileName, fileType, logoType } = body;

      if (!fileName || !fileType) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'fileName und fileType erforderlich' })
        };
      }

      const result = await generateUploadUrl(tenantId, fileName, fileType, logoType || 'hero');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      };
    }

    // DELETE /tenants/{tenantId}/hero/logo - Delete logo (admin only)
    if (httpMethod === 'DELETE' && path.includes('/hero/logo')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      const logoType = queryStringParameters?.type || 'hero';
      const heroContent = await getHeroContent(tenantId);

      if (logoType === 'hero' && heroContent.logo_key) {
        await deleteFile(heroContent.logo_key);
        await updateHeroContent(tenantId, { logoKey: null, logoUrl: null });
      } else if (logoType === 'navbar' && heroContent.navbar_logo_key) {
        await deleteFile(heroContent.navbar_logo_key);
        await updateHeroContent(tenantId, { navbarLogoKey: null, navbarLogoUrl: null });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Logo erfolgreich gelöscht' })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Endpoint nicht gefunden' })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Interner Serverfehler',
        error: error.message 
      })
    };
  }
};
