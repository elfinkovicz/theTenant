const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const HERO_TABLE = process.env.HERO_TABLE_NAME;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

const HERO_ID = 'home-hero'; // Fixed ID for hero section

// Helper: Check if user is admin
function isAdmin(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  
  if (!claims) return false;
  
  let groups = claims['cognito:groups'];
  if (!groups) return false;
  
  if (typeof groups === 'string') {
    if (groups.startsWith('[') && groups.endsWith(']')) {
      groups = groups.slice(1, -1).split(',').map(g => g.trim());
    } else {
      groups = [groups];
    }
  }
  
  return groups.includes(ADMIN_GROUP);
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
    // GET /hero - Get hero content (public)
    if (method === 'GET' && path === '/hero') {
      const result = await docClient.send(new GetCommand({
        TableName: HERO_TABLE,
        Key: { heroId: HERO_ID }
      }));

      if (!result.Item) {
        return response(200, { 
          hero: {
            heroId: HERO_ID,
            logoUrl: null,
            title: 'Your Brand',
            subtitle: 'Deine moderne Creator-Plattform für Live-Streaming, Events und Community',
            logoSize: 160,
            navbarLogoUrl: null,
            navbarTitle: 'Your Brand',
            heroHeight: 70,
            heroWidth: 'full',
            heroBackground: {
              type: 'gradient',
              value: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))'
            },
            // Default theme
            themeId: 'default',
            themeName: 'Honigwabe (Standard)',
            themeColors: {
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
            designSettings: {
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
            updatedAt: new Date().toISOString()
          }
        });
      }

      const hero = {
        ...result.Item,
        logoUrl: result.Item.logoKey ? `https://${CDN_DOMAIN}/${result.Item.logoKey}` : null,
        navbarLogoUrl: result.Item.navbarLogoKey ? `https://${CDN_DOMAIN}/${result.Item.navbarLogoKey}` : null
      };

      return response(200, { hero });
    }

    // All other routes require admin authentication
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    // PUT /hero - Update hero content
    if (method === 'PUT' && path === '/hero') {
      const body = JSON.parse(event.body);

      const hero = {
        heroId: HERO_ID,
        logoKey: body.logoKey !== undefined ? body.logoKey : null,
        title: body.title || 'Your Brand',
        subtitle: body.subtitle || '',
        logoSize: body.logoSize !== undefined ? body.logoSize : 160,
        navbarLogoKey: body.navbarLogoKey !== undefined ? body.navbarLogoKey : null,
        navbarTitle: body.navbarTitle || 'Your Brand',
        // Hero section settings
        heroHeight: body.heroHeight || 70,
        heroWidth: body.heroWidth || 'full',
        heroBackground: body.heroBackground || {
          type: 'gradient',
          value: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))'
        },
        // Theme data
        themeId: body.themeId || 'default',
        themeName: body.themeName || 'Honigwabe (Standard)',
        themeColors: body.themeColors || {
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
        // Design settings
        designSettings: body.designSettings || {
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
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: HERO_TABLE,
        Item: hero
      }));

      return response(200, { 
        message: 'Hero content updated',
        hero: {
          ...hero,
          logoUrl: hero.logoKey ? `https://${CDN_DOMAIN}/${hero.logoKey}` : null,
          navbarLogoUrl: hero.navbarLogoKey ? `https://${CDN_DOMAIN}/${hero.navbarLogoKey}` : null
        }
      });
    }

    // POST /hero/upload-url - Generate presigned URL for logo upload
    if (method === 'POST' && path === '/hero/upload-url') {
      const body = JSON.parse(event.body);
      const { fileName, fileType, logoType } = body;

      let folder = 'hero';
      if (logoType === 'navbar') {
        folder = 'hero/navbar';
      } else if (logoType === 'background-image') {
        folder = 'hero/backgrounds/images';
      } else if (logoType === 'background-video') {
        folder = 'hero/backgrounds/videos';
      }
      
      const logoKey = `${folder}/${Date.now()}_${fileName}`;
      const command = new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: logoKey,
        ContentType: fileType
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return response(200, {
        uploadUrl,
        logoKey,
        logoUrl: `https://${CDN_DOMAIN}/${logoKey}`
      });
    }

    // DELETE /hero/logo - Delete hero logo
    if (method === 'DELETE' && path.startsWith('/hero/logo')) {
      const queryParams = event.queryStringParameters || {};
      const logoType = queryParams.type || 'hero';
      
      const result = await docClient.send(new GetCommand({
        TableName: HERO_TABLE,
        Key: { heroId: HERO_ID }
      }));

      if (result.Item) {
        const keyToDelete = logoType === 'navbar' ? result.Item.navbarLogoKey : result.Item.logoKey;
        
        if (keyToDelete) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: IMAGES_BUCKET,
            Key: keyToDelete
          }));

          const updatedItem = { ...result.Item };
          if (logoType === 'navbar') {
            updatedItem.navbarLogoKey = null;
          } else {
            updatedItem.logoKey = null;
          }
          updatedItem.updatedAt = new Date().toISOString();

          await docClient.send(new PutCommand({
            TableName: HERO_TABLE,
            Item: updatedItem
          }));
        }
      }

      return response(200, { message: `${logoType === 'navbar' ? 'Navbar' : 'Hero'} logo deleted` });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
