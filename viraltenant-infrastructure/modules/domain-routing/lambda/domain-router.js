/**
 * Lambda@Edge Function für Multi-Domain Routing
 * Mappt Custom Domains zu Creator IDs und fügt entsprechende Headers hinzu
 */

const AWS = require('aws-sdk');

// DynamoDB Client für Domain Lookups
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'eu-central-1'
});

// Default Creator für Platform Domain
const DEFAULT_CREATOR = 'platform';
const PLATFORM_DOMAINS = ['viraltenant.com', 'www.viraltenant.com', 'api.viraltenant.com'];

exports.handler = async (event, context, callback) => {
  console.log('Domain Router Event:', JSON.stringify(event, null, 2));
  
  const request = event.Records[0].cf.request;
  const headers = request.headers;
  
  try {
    // Extract domain from Host header
    const host = headers.host[0].value.toLowerCase();
    console.log('Processing request for host:', host);
    
    // Determine creator ID based on domain
    const creatorId = await getCreatorIdFromDomain(host);
    console.log('Resolved creator ID:', creatorId);
    
    // Add creator ID to request headers for cache isolation
    headers['x-creator-id'] = [{
      key: 'X-Creator-Id',
      value: creatorId
    }];
    
    // Add creator context for backend processing
    headers['x-creator-context'] = [{
      key: 'X-Creator-Context',
      value: JSON.stringify({
        creatorId: creatorId,
        domain: host,
        isPlatform: PLATFORM_DOMAINS.includes(host)
      })
    }];
    
    // Modify request URI for creator-specific content
    if (creatorId !== 'platform') {
      request.uri = modifyUriForCreator(request.uri, creatorId);
    }
    
    console.log('Modified request URI:', request.uri);
    console.log('Added creator context:', headers['x-creator-context'][0].value);
    
    callback(null, request);
    
  } catch (error) {
    console.error('Domain routing error:', error);
    
    // Fallback: Continue with platform default
    headers['x-creator-id'] = [{
      key: 'X-Creator-Id',
      value: DEFAULT_CREATOR
    }];
    
    callback(null, request);
  }
};

/**
 * Bestimmt Creator ID basierend auf Domain
 */
async function getCreatorIdFromDomain(host) {
  // 1. Check if it's a platform domain
  if (PLATFORM_DOMAINS.includes(host)) {
    return DEFAULT_CREATOR;
  }
  
  // 2. Check for subdomain pattern (creator.viraltenant.com)
  if (host.includes('.viraltenant.com')) {
    const subdomain = host.replace('.viraltenant.com', '');
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      // Verify subdomain exists in database
      const creatorExists = await verifyCreatorExists(subdomain);
      return creatorExists ? subdomain : DEFAULT_CREATOR;
    }
  }
  
  // 3. Lookup custom domains in DynamoDB
  try {
    const customCreator = await lookupCustomDomain(host);
    if (customCreator) {
      return customCreator;
    }
  } catch (error) {
    console.error('Custom domain lookup failed:', error);
  }
  
  // 4. Default to platform
  return DEFAULT_CREATOR;
}

/**
 * Modifiziert URI für Creator-spezifischen Content
 */
function modifyUriForCreator(uri, creatorId) {
  // Don't modify API calls
  if (uri.startsWith('/api/')) {
    return uri;
  }
  
  // Don't modify tenant asset paths (already have /tenants/ prefix)
  if (uri.startsWith('/tenants/')) {
    return uri;
  }
  
  // For root requests, serve tenant-specific index.html
  if (uri === '/' || uri === '/index.html') {
    return `/tenants/${creatorId}/index.html`;
  }
  
  // For static assets, try tenant-specific path first
  if (uri.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
    return `/tenants/${creatorId}${uri}`;
  }
  
  // For other requests, use tenant-specific path
  return `/tenants/${creatorId}${uri}`;
}

/**
 * DynamoDB Lookup für Custom Domains
 */
async function lookupCustomDomain(host) {
  try {
    const params = {
      TableName: 'creator-platform-domains-production',
      Key: {
        domain: host
      }
    };
    
    const result = await dynamodb.get(params).promise();
    return result.Item ? result.Item.creatorId : null;
    
  } catch (error) {
    console.error('DynamoDB lookup failed:', error);
    return null;
  }
}

/**
 * Verifiziert ob Creator existiert
 */
async function verifyCreatorExists(creatorId) {
  try {
    const params = {
      TableName: 'creator-platform-data-production',
      Key: {
        PK: `CREATOR#${creatorId}`,
        SK: 'PROFILE'
      }
    };
    
    const result = await dynamodb.get(params).promise();
    return !!result.Item;
    
  } catch (error) {
    console.error('Creator verification failed:', error);
    return false;
  }
}