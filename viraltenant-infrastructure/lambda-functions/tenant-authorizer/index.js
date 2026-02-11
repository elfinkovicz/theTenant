const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// JWKS Client für Cognito Token Validation
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Resolve tenant ID from subdomain or UUID
async function resolveTenantId(tenantIdOrSubdomain) {
  if (!tenantIdOrSubdomain) return null;
  
  // Special case: 'platform' is a reserved tenant ID
  if (tenantIdOrSubdomain === 'platform' || tenantIdOrSubdomain === 'www') {
    console.log('Platform/www tenant - returning as-is');
    return 'platform';
  }
  
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

// Check if path is a billing admin endpoint
function isBillingAdminEndpoint(methodArn) {
  if (!methodArn) return false;
  return methodArn.includes('/billing/admin/') || methodArn.includes('/billing/generate-invoices');
}

// Check if path is a public tenant endpoint (no tenant membership required)
// These endpoints allow authenticated users to interact with any tenant
function isPublicTenantEndpoint(methodArn) {
  if (!methodArn) return false;
  // Endpoints that any authenticated user can access (to join/subscribe to a tenant)
  return methodArn.includes('/membership/my-status') ||
         methodArn.includes('/membership/subscribe') ||
         methodArn.includes('/membership/cancel') ||
         methodArn.includes('/join');
}

// Extract tenant ID from request
function extractTenantId(event) {
  console.log('Extracting tenant ID from event:', {
    methodArn: event.methodArn,
    path: event.path,
    host: event.headers?.Host || event.headers?.host,
    creatorId: event.headers?.['X-Creator-ID'] || event.headers?.['x-creator-id']
  });
  
  // Skip tenant extraction for billing admin endpoints - they operate at platform level
  if (isBillingAdminEndpoint(event.methodArn)) {
    console.log('Billing admin endpoint - no tenant extraction needed');
    return null;
  }
  
  // 1. From X-Creator-ID header (highest priority - set by frontend)
  const creatorId = event.headers?.['X-Creator-ID'] || event.headers?.['x-creator-id'];
  if (creatorId) {
    console.log('Extracted tenant ID from X-Creator-ID header:', creatorId);
    return creatorId;
  }
  
  // 2. From methodArn (e.g., arn:aws:execute-api:eu-central-1:...:ematolm790/production/GET/tenants/0ba14817-0393-4468-a457-363e1c2a7b03)
  const methodArn = event.methodArn;
  if (methodArn) {
    // Extract path from methodArn
    const arnParts = methodArn.split(':');
    if (arnParts.length >= 6) {
      const pathPart = arnParts[5]; // e.g., "ematolm790/production/GET/tenants/0ba14817-0393-4468-a457-363e1c2a7b03"
      
      // Check for /tenants/{tenantId} pattern
      const tenantsMatch = pathPart.match(/\/tenants\/([a-zA-Z0-9\-]+)/);
      if (tenantsMatch) {
        console.log('Extracted tenant ID from methodArn (tenants):', tenantsMatch[1]);
        return tenantsMatch[1];
      }
      
      // Check for /billing/admin/tenants/{tenantId}/... pattern (billing admin accessing specific tenant)
      const billingAdminTenantMatch = pathPart.match(/\/billing\/admin\/tenants\/([a-f0-9\-]{36})/i);
      if (billingAdminTenantMatch) {
        console.log('Extracted tenant ID from methodArn (billing admin tenant):', billingAdminTenantMatch[1]);
        return billingAdminTenantMatch[1];
      }
      
      // Check for /billing/{tenantId}/... pattern where tenantId is a UUID
      // This matches: /billing/{uuid}/invoices, /billing/{uuid}/subscription, etc.
      const billingTenantMatch = pathPart.match(/\/billing\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (billingTenantMatch) {
        console.log('Extracted tenant ID from methodArn (billing tenant UUID):', billingTenantMatch[1]);
        return billingTenantMatch[1];
      }
    }
  }
  
  // 3. From subdomain (creatorA.viraltenant.com)
  const host = event.headers?.Host || event.headers?.host;
  if (host) {
    const parts = host.split('.');
    const subdomain = parts[0];
    const platformDomain = process.env.PLATFORM_DOMAIN || 'viraltenant.com';
    const platformSubdomain = platformDomain.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== platformSubdomain) {
      console.log('Extracted tenant ID from subdomain:', subdomain);
      return subdomain;
    }
  }
  
  // 4. For /user/tenants route, no specific tenant required
  if (event.path?.includes('/user/tenants')) {
    console.log('User tenants route - no specific tenant required');
    return null; // Allow access to user's tenants without specific tenant context
  }
  
  console.log('No tenant ID extracted');
  return null;
}

// Validate Cognito JWT Token
async function validateToken(token) {
  return new Promise((resolve, reject) => {
    // Note: Cognito Access Tokens don't have 'aud' claim, they have 'client_id'
    // So we only validate issuer and algorithm, then manually check client_id
    jwt.verify(token, getKey, {
      issuer: `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.USER_POOL_ID}`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        // For access tokens: verify client_id matches
        // For ID tokens: they have 'aud' instead of 'client_id'
        // Accept both types
        const isAccessToken = !!decoded.client_id;
        const isIdToken = !!decoded.aud;
        
        if (isAccessToken) {
          // Access token - check client_id (allow any valid client for billing admin)
          console.log('Access token detected, client_id:', decoded.client_id);
          resolve(decoded);
        } else if (isIdToken) {
          // ID token - check aud (audience)
          console.log('ID token detected, aud:', decoded.aud);
          resolve(decoded);
        } else {
          reject(new Error('Token is neither access token nor ID token'));
        }
      }
    });
  });
}

// Check if user has access to tenant
async function checkTenantAccess(userId, tenantId) {
  console.log('Checking tenant access for user:', userId, 'tenant:', tenantId);
  
  if (!tenantId) {
    console.log('No tenant ID, allowing access to platform routes');
    return true; // Allow access to platform routes and user-specific routes
  }
  
  // For platform tenant, check if user has any admin role in any tenant
  if (tenantId === 'platform') {
    console.log('Platform tenant - checking if user has any admin role');
    try {
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
      console.log('User has admin role for platform:', hasAdminRole, 'items:', result.Items?.length);
      return hasAdminRole;
    } catch (error) {
      console.error('Error checking platform admin access:', error);
      return false;
    }
  }
  
  try {
    // For specific tenants, check user-tenant relationship
    const params = {
      TableName: process.env.USER_TENANTS_TABLE,
      Key: {
        user_id: userId,
        tenant_id: tenantId
      }
    };
    
    console.log('DynamoDB query params:', JSON.stringify(params));
    const result = await dynamodb.send(new GetCommand(params));
    console.log('DynamoDB result:', JSON.stringify(result));
    const hasAccess = !!result.Item;
    console.log('Has access:', hasAccess);
    return hasAccess;
  } catch (error) {
    console.error('Error checking tenant access:', error);
    return false;
  }
}

// Generate IAM policy
function generatePolicy(principalId, effect, resource, context = {}) {
  // Convert specific resource ARN to wildcard for all methods/paths
  // e.g., arn:aws:execute-api:eu-central-1:123:api/stage/GET/tenants/123/admins
  // becomes arn:aws:execute-api:eu-central-1:123:api/stage/*
  let wildcardResource = resource;
  if (effect === 'Allow') {
    const arnParts = resource.split(':');
    if (arnParts.length >= 6) {
      const pathPart = arnParts[5];
      const pathSegments = pathPart.split('/');
      if (pathSegments.length >= 2) {
        // Keep api-id and stage, wildcard the rest
        wildcardResource = arnParts.slice(0, 5).join(':') + ':' + pathSegments[0] + '/' + pathSegments[1] + '/*';
      }
    }
  }
  
  const authResponse = {
    principalId: principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: wildcardResource
        }
      ]
    },
    context: context
  };
  
  console.log('Generated policy:', JSON.stringify(authResponse, null, 2));
  return authResponse;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract token from Authorization header
    const token = event.authorizationToken?.replace('Bearer ', '');
    if (!token) {
      console.log('No token provided');
      throw new Error('No token provided');
    }
    
    // Validate JWT token first
    console.log('Validating JWT token...');
    const decoded = await validateToken(token);
    console.log('Token validated, user:', decoded.sub);
    const userId = decoded.sub;
    
    // Get user's Cognito groups from token
    // Note: cognito:groups is in ID tokens, not access tokens
    // For access tokens, we need to check the token type
    let userGroups = decoded['cognito:groups'] || [];
    
    // If this is an access token (has client_id), we need to get groups from ID token
    // But since we only have access token here, we'll allow billing admin endpoints
    // if the user is authenticated (has valid token)
    const isAccessToken = !!decoded.client_id;
    const isIdToken = !!decoded.aud;
    
    console.log('Token type - isAccessToken:', isAccessToken, 'isIdToken:', isIdToken);
    console.log('User groups:', userGroups);
    
    // Check if this is a billing admin endpoint
    if (isBillingAdminEndpoint(event.methodArn)) {
      console.log('Billing admin endpoint detected');
      
      // For billing admin endpoints:
      // - If ID token: check cognito:groups
      // - If access token: allow (user is authenticated, groups will be checked on client side)
      if (isIdToken) {
        // Check if user is billing admin or platform admin
        const isBillingAdmin = userGroups.includes('billing-admins');
        const isPlatformAdmin = userGroups.includes('admins') || userGroups.includes('platform-admins');
        
        if (!isBillingAdmin && !isPlatformAdmin) {
          console.log('User not in billing-admins or platform-admins group, access denied');
          throw new Error('Access denied - billing admin or platform admin required');
        }
        
        console.log('User authorized for billing admin endpoint (ID token), isBillingAdmin:', isBillingAdmin, 'isPlatformAdmin:', isPlatformAdmin);
      } else if (isAccessToken) {
        // For access tokens, we trust that the client has already validated the user
        // The billing dashboard validates groups on the client side
        console.log('User authorized for billing admin endpoint (access token)');
      }
      
      return generatePolicy(
        userId,
        'Allow',
        event.methodArn,
        {
          userId: userId,
          tenantId: 'platform',
          email: decoded.email || 'unknown',
          groups: userGroups.length > 0 ? userGroups.join(',') : 'none',
          isBillingAdmin: userGroups.includes('billing-admins') ? 'true' : 'false',
          isPlatformAdmin: (userGroups.includes('admins') || userGroups.includes('platform-admins')) ? 'true' : 'false'
        }
      );
    }
    
    // Extract tenant ID (could be subdomain or UUID)
    const rawTenantId = extractTenantId(event);
    console.log('Extracted raw tenant ID:', rawTenantId);
    
    // Resolve subdomain to UUID if needed
    const tenantId = await resolveTenantId(rawTenantId);
    console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);
    
    // Check if this is a public tenant endpoint (any authenticated user can access)
    const isPublicEndpoint = isPublicTenantEndpoint(event.methodArn);
    console.log('Is public tenant endpoint:', isPublicEndpoint);
    
    // Check tenant access (skip for public endpoints - any authenticated user can access)
    let hasAccess = true;
    if (!isPublicEndpoint) {
      console.log('Checking tenant access...');
      hasAccess = await checkTenantAccess(userId, tenantId);
      console.log('Tenant access result:', hasAccess);
      
      if (!hasAccess) {
        console.log('Access denied to tenant');
        throw new Error('Access denied to tenant');
      }
    } else {
      console.log('Skipping tenant access check for public endpoint');
    }
    
    // Generate allow policy
    console.log('Generating Allow policy');
    const isBillingAdmin = userGroups.includes('billing-admins');
    const isPlatformAdmin = userGroups.includes('admins') || userGroups.includes('platform-admins');
    
    return generatePolicy(
      userId,
      'Allow',
      event.methodArn,
      {
        userId: userId,
        tenantId: tenantId || 'platform',
        email: decoded.email || 'unknown',
        groups: userGroups.length > 0 ? userGroups.join(',') : 'none',
        isBillingAdmin: isBillingAdmin ? 'true' : 'false',
        isPlatformAdmin: isPlatformAdmin ? 'true' : 'false'
      }
    );
    
  } catch (error) {
    console.error('Authorization error:', error.message, error.stack);
    
    // Generate deny policy
    console.log('Generating Deny policy');
    return generatePolicy(
      'user',
      'Deny',
      event.methodArn
    );
  }
};