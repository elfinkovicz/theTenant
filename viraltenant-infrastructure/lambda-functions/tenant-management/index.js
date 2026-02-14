const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { Route53Client, ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { IvsClient, DeleteChannelCommand } = require('@aws-sdk/client-ivs');
const { IvschatClient, DeleteRoomCommand } = require('@aws-sdk/client-ivschat');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const route53 = new Route53Client({ region: process.env.REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });
const ivs = new IvsClient({ region: process.env.REGION });
const ivschat = new IvschatClient({ region: process.env.REGION });

// Blacklisted subdomains
const SUBDOMAIN_BLACKLIST = [
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn', 'assets',
  'support', 'help', 'blog', 'news', 'shop', 'store', 'payment',
  'secure', 'ssl', 'vpn', 'test', 'staging', 'dev', 'demo'
];

// Validate subdomain format
function isValidSubdomain(subdomain) {
  const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return pattern.test(subdomain) && 
         subdomain.length >= 3 && 
         subdomain.length <= 20 && 
         !SUBDOMAIN_BLACKLIST.includes(subdomain.toLowerCase());
}

// Check if subdomain is available
async function checkSubdomainAvailability(subdomain) {
  try {
    // Check in DynamoDB
    const dbParams = {
      TableName: process.env.TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: {
        ':subdomain': subdomain
      }
    };

    const dbResult = await dynamodb.send(new QueryCommand(dbParams));
    
    if (dbResult.Items && dbResult.Items.length > 0) {
      return { available: false, message: 'Subdomain bereits vergeben' };
    }

    // Optional: Check Route53 records
    try {
      const route53Params = {
        HostedZoneId: process.env.HOSTED_ZONE_ID,
        StartRecordName: `${subdomain}.${process.env.PLATFORM_DOMAIN}`,
        StartRecordType: 'CNAME'
      };

      const route53Result = await route53.send(new ListResourceRecordSetsCommand(route53Params));
      
      const existingRecord = route53Result.ResourceRecordSets.find(
        record => record.Name === `${subdomain}.${process.env.PLATFORM_DOMAIN}.`
      );

      if (existingRecord) {
        return { available: false, message: 'DNS-Eintrag bereits vorhanden' };
      }
    } catch (route53Error) {
      console.warn('Route53 check failed:', route53Error);
      // Continue without Route53 check
    }

    return { available: true, message: 'Subdomain verfügbar' };
  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    throw new Error('Fehler bei der Verfügbarkeitsprüfung');
  }
}

// Create subdomain in Route53 (uses UPSERT to handle both create and update)
async function createSubdomainRecord(subdomain) {
  const params = {
    HostedZoneId: process.env.HOSTED_ZONE_ID,
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: `${subdomain}.${process.env.PLATFORM_DOMAIN}`,
          Type: 'CNAME',
          TTL: 300,
          ResourceRecords: [{
            Value: process.env.CLOUDFRONT_DOMAIN_NAME
          }]
        }
      }]
    }
  };

  try {
    const result = await route53.send(new ChangeResourceRecordSetsCommand(params));
    return result.ChangeInfo;
  } catch (error) {
    console.error('Error creating Route53 record:', error);
    throw new Error('Fehler beim Erstellen des DNS-Eintrags');
  }
}

// Delete subdomain from Route53
async function deleteSubdomainFromRoute53(subdomain) {
  console.log('deleteSubdomainFromRoute53 called with:', subdomain);
  
  if (!subdomain) {
    console.log('No subdomain provided, skipping deletion');
    return;
  }
  
  const recordName = `${subdomain}.${process.env.PLATFORM_DOMAIN}`;
  console.log('Looking for Route53 record:', recordName);
  console.log('Using Hosted Zone ID:', process.env.HOSTED_ZONE_ID);
  
  try {
    // First, get the existing record
    const listResult = await route53.send(new ListResourceRecordSetsCommand({
      HostedZoneId: process.env.HOSTED_ZONE_ID,
      StartRecordName: recordName,
      StartRecordType: 'CNAME',
      MaxItems: '1'
    }));
    
    console.log('ListResourceRecordSets result:', JSON.stringify(listResult, null, 2));
    
    const records = listResult.ResourceRecordSets || [];
    const existingRecord = records.find(r => r.Name === `${recordName}.`);
    
    if (!existingRecord) {
      console.log('Route53 record does not exist:', recordName);
      console.log('Available records:', records.map(r => r.Name));
      return;
    }
    
    console.log('Found existing record to delete:', JSON.stringify(existingRecord, null, 2));
    
    // Delete the record
    const deleteResult = await route53.send(new ChangeResourceRecordSetsCommand({
      HostedZoneId: process.env.HOSTED_ZONE_ID,
      ChangeBatch: {
        Comment: `Delete subdomain ${subdomain}`,
        Changes: [{
          Action: 'DELETE',
          ResourceRecordSet: existingRecord
        }]
      }
    }));
    
    console.log('Route53 record deleted successfully:', recordName);
    console.log('Delete result:', JSON.stringify(deleteResult, null, 2));
  } catch (error) {
    console.error('Error deleting Route53 record:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    // Don't throw - this is a cleanup operation
  }
}

// Update tenant subdomain in DynamoDB (main tenants table)
async function updateTenantSubdomain(tenantId, subdomain) {
  const params = {
    TableName: process.env.TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET subdomain = :subdomain, updated_at = :updated_at',
    ExpressionAttributeValues: {
      ':subdomain': subdomain,
      ':updated_at': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamodb.send(new UpdateCommand(params));
    console.log('Updated tenant subdomain in main table:', tenantId, '->', subdomain);
    return result.Attributes;
  } catch (error) {
    console.error('Error updating tenant subdomain:', error);
    throw new Error('Fehler beim Aktualisieren der Tenant-Daten');
  }
}

// Update subdomain in all related DynamoDB tables that might cache it
async function updateSubdomainInRelatedTables(tenantId, subdomain) {
  const tablesToUpdate = [
    process.env.TENANT_FRONTEND_TABLE,
    process.env.TENANT_NEWSFEED_TABLE,
    process.env.TENANT_CONTACT_TABLE,
    process.env.TENANT_EVENTS_TABLE,
    process.env.TENANT_TEAM_TABLE,
    process.env.TENANT_CHANNELS_TABLE,
    process.env.TENANT_SHOP_TABLE,
    process.env.TENANT_VIDEOS_TABLE,
    process.env.TENANT_LIVE_TABLE
  ].filter(Boolean);

  const results = { updated: [], failed: [] };

  for (const tableName of tablesToUpdate) {
    try {
      // First check if record exists
      const getResult = await dynamodb.send(new GetCommand({
        TableName: tableName,
        Key: { tenant_id: tenantId }
      }));

      if (getResult.Item) {
        // Update subdomain if the table has this field
        await dynamodb.send(new UpdateCommand({
          TableName: tableName,
          Key: { tenant_id: tenantId },
          UpdateExpression: 'SET subdomain = :subdomain, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':subdomain': subdomain,
            ':updated_at': new Date().toISOString()
          }
        }));
        console.log(`Updated subdomain in ${tableName}`);
        results.updated.push(tableName);
      }
    } catch (error) {
      // Some tables might not have subdomain field - that's OK
      if (error.name !== 'ValidationException') {
        console.warn(`Could not update subdomain in ${tableName}:`, error.message);
        results.failed.push({ table: tableName, error: error.message });
      }
    }
  }

  return results;
}

// Get tenant by ID
async function getTenant(tenantId) {
  const params = {
    TableName: process.env.TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  };

  try {
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item;
  } catch (error) {
    console.error('Error getting tenant:', error);
    throw new Error('Fehler beim Laden der Tenant-Daten');
  }
}

// Get tenant by subdomain
async function getTenantBySubdomain(subdomain) {
  const params = {
    TableName: process.env.TENANTS_TABLE,
    IndexName: 'subdomain-index',
    KeyConditionExpression: 'subdomain = :subdomain',
    ExpressionAttributeValues: {
      ':subdomain': subdomain
    }
  };

  try {
    const result = await dynamodb.send(new QueryCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.error('Error getting tenant by subdomain:', error);
    throw new Error('Fehler beim Laden der Tenant-Daten');
  }
}

// Get tenant by custom domain
async function getTenantByCustomDomain(customDomain) {
  // Scan for custom_domain (no index needed for now, can add later for performance)
  const params = {
    TableName: process.env.TENANTS_TABLE,
    FilterExpression: 'custom_domain = :domain',
    ExpressionAttributeValues: {
      ':domain': customDomain.toLowerCase()
    }
  };

  try {
    const result = await dynamodb.send(new ScanCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.error('Error getting tenant by custom domain:', error);
    throw new Error('Fehler beim Laden der Tenant-Daten');
  }
}

// Check if user is tenant admin
async function isUserTenantAdmin(userId, tenantId) {
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

// ============================================================
// DELETE FUNCTIONS - Account & Tenant Deletion
// ============================================================

// Delete user's own account (removes from all tenants, deletes Cognito user)
async function deleteUserAccount(userId) {
  console.log('Deleting user account:', userId);
  const results = { success: true, errors: [] };
  
  try {
    // 1. Get all tenant memberships for this user
    const userTenantsResult = await dynamodb.send(new QueryCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      KeyConditionExpression: 'user_id = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    }));
    
    const memberships = userTenantsResult.Items || [];
    console.log(`Found ${memberships.length} tenant memberships for user`);
    
    // 2. Delete all user-tenant relationships
    for (const membership of memberships) {
      try {
        await dynamodb.send(new DeleteCommand({
          TableName: process.env.USER_TENANTS_TABLE,
          Key: { user_id: userId, tenant_id: membership.tenant_id }
        }));
        console.log(`Deleted membership for tenant: ${membership.tenant_id}`);
      } catch (err) {
        console.error(`Error deleting membership for tenant ${membership.tenant_id}:`, err);
        results.errors.push(`Membership ${membership.tenant_id}: ${err.message}`);
      }
    }
    
    // 3. Delete Cognito user
    try {
      await cognito.send(new AdminDeleteUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: userId
      }));
      console.log('Cognito user deleted');
    } catch (err) {
      if (err.name !== 'UserNotFoundException') {
        console.error('Error deleting Cognito user:', err);
        results.errors.push(`Cognito: ${err.message}`);
        results.success = false;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in deleteUserAccount:', error);
    return { success: false, errors: [error.message] };
  }
}

// Delete entire tenant (admin only) - deletes all associated data
async function deleteTenant(tenantId, userId) {
  console.log('Deleting tenant:', tenantId, 'by user:', userId);
  const results = { success: true, errors: [], deleted: {} };
  
  try {
    // 1. Get tenant data
    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return { success: false, errors: ['Tenant nicht gefunden'] };
    }
    
    const subdomain = tenant.subdomain;
    console.log('Tenant subdomain:', subdomain);
    
    // 2. Get IVS resources from tenant-live table
    let ivsResources = { channel_arn: null, chat_room_arn: null };
    try {
      const liveResult = await dynamodb.send(new GetCommand({
        TableName: process.env.TENANT_LIVE_TABLE,
        Key: { tenant_id: tenantId }
      }));
      if (liveResult.Item) {
        ivsResources.channel_arn = liveResult.Item.ivs_channel_arn;
        ivsResources.chat_room_arn = liveResult.Item.ivs_chat_room_arn;
      }
    } catch (err) {
      console.warn('Could not get IVS resources:', err.message);
    }
    
    // 3. Delete IVS Chat Room
    if (ivsResources.chat_room_arn) {
      try {
        await ivschat.send(new DeleteRoomCommand({ identifier: ivsResources.chat_room_arn }));
        console.log('IVS Chat Room deleted');
        results.deleted.ivsChatRoom = true;
      } catch (err) {
        if (err.name !== 'ResourceNotFoundException') {
          console.error('Error deleting IVS Chat Room:', err);
          results.errors.push(`IVS Chat Room: ${err.message}`);
        }
      }
    }
    
    // 4. Delete IVS Channel
    if (ivsResources.channel_arn) {
      try {
        await ivs.send(new DeleteChannelCommand({ arn: ivsResources.channel_arn }));
        console.log('IVS Channel deleted');
        results.deleted.ivsChannel = true;
      } catch (err) {
        if (err.name !== 'ResourceNotFoundException') {
          console.error('Error deleting IVS Channel:', err);
          results.errors.push(`IVS Channel: ${err.message}`);
        }
      }
    }
    
    // 5. Delete tenant-live record
    try {
      await dynamodb.send(new DeleteCommand({
        TableName: process.env.TENANT_LIVE_TABLE,
        Key: { tenant_id: tenantId }
      }));
      console.log('Tenant-live record deleted');
      results.deleted.tenantLive = true;
    } catch (err) {
      console.warn('Could not delete tenant-live record:', err.message);
    }
    
    // 6. Delete Route53 subdomain record
    if (subdomain) {
      try {
        await deleteSubdomainRecord(subdomain);
        console.log('Route53 record deleted');
        results.deleted.route53 = true;
      } catch (err) {
        console.error('Error deleting Route53 record:', err);
        results.errors.push(`Route53: ${err.message}`);
      }
    }
    
    // 7. Delete S3 folder for tenant
    try {
      await deleteS3Folder(tenantId);
      console.log('S3 folder deleted');
      results.deleted.s3 = true;
    } catch (err) {
      console.error('Error deleting S3 folder:', err);
      results.errors.push(`S3: ${err.message}`);
    }
    
    // 8. Get all users for this tenant and delete relationships
    try {
      const tenantUsersResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.USER_TENANTS_TABLE,
        IndexName: 'tenant-users-index',
        KeyConditionExpression: 'tenant_id = :tenantId',
        ExpressionAttributeValues: { ':tenantId': tenantId }
      }));
      
      const users = tenantUsersResult.Items || [];
      console.log(`Found ${users.length} users for tenant`);
      
      for (const user of users) {
        try {
          await dynamodb.send(new DeleteCommand({
            TableName: process.env.USER_TENANTS_TABLE,
            Key: { user_id: user.user_id, tenant_id: tenantId }
          }));
        } catch (err) {
          console.error(`Error deleting user-tenant relation for ${user.user_id}:`, err);
        }
      }
      results.deleted.userTenantRelations = users.length;
    } catch (err) {
      console.error('Error deleting user-tenant relations:', err);
      results.errors.push(`User-Tenant Relations: ${err.message}`);
    }
    
    // 9. Delete all tenant-specific DynamoDB records
    const tablesToClean = [
      { table: process.env.TENANT_NEWSFEED_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_FRONTEND_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_EVENTS_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_CONTACT_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_TEAM_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_SHOP_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_VIDEOS_TABLE, key: 'tenant_id' },
      { table: process.env.TENANT_CHANNELS_TABLE, key: 'tenant_id' }
    ];
    
    for (const { table, key } of tablesToClean) {
      if (table) {
        try {
          await dynamodb.send(new DeleteCommand({
            TableName: table,
            Key: { [key]: tenantId }
          }));
          console.log(`Deleted record from ${table}`);
        } catch (err) {
          // Ignore if record doesn't exist
          if (err.name !== 'ResourceNotFoundException') {
            console.warn(`Could not delete from ${table}:`, err.message);
          }
        }
      }
    }
    results.deleted.tenantData = true;
    
    // 10. Delete tenant record itself
    try {
      await dynamodb.send(new DeleteCommand({
        TableName: process.env.TENANTS_TABLE,
        Key: { tenant_id: tenantId }
      }));
      console.log('Tenant record deleted');
      results.deleted.tenant = true;
    } catch (err) {
      console.error('Error deleting tenant record:', err);
      results.errors.push(`Tenant Record: ${err.message}`);
      results.success = false;
    }
    
    return results;
  } catch (error) {
    console.error('Error in deleteTenant:', error);
    return { success: false, errors: [error.message] };
  }
}

// Delete Route53 subdomain record
async function deleteSubdomainRecord(subdomain) {
  const recordName = `${subdomain}.${process.env.PLATFORM_DOMAIN}`;
  
  // First, get the existing record
  const listResult = await route53.send(new ListResourceRecordSetsCommand({
    HostedZoneId: process.env.HOSTED_ZONE_ID,
    StartRecordName: recordName,
    StartRecordType: 'CNAME',
    MaxItems: '1'
  }));
  
  const records = listResult.ResourceRecordSets || [];
  const existingRecord = records.find(r => r.Name === `${recordName}.`);
  
  if (!existingRecord) {
    console.log('Route53 record does not exist:', recordName);
    return;
  }
  
  // Delete the record
  await route53.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: process.env.HOSTED_ZONE_ID,
    ChangeBatch: {
      Comment: `Delete subdomain ${subdomain}`,
      Changes: [{
        Action: 'DELETE',
        ResourceRecordSet: existingRecord
      }]
    }
  }));
}

// Delete S3 folder for tenant
async function deleteS3Folder(tenantId) {
  const prefix = `tenants/${tenantId}/`;
  let continuationToken = null;
  let totalDeleted = 0;
  
  do {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.ASSETS_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    
    const objects = listResult.Contents || [];
    
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: process.env.ASSETS_BUCKET,
        Delete: {
          Objects: objects.map(obj => ({ Key: obj.Key }))
        }
      }));
      totalDeleted += objects.length;
    }
    
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);
  
  console.log(`Deleted ${totalDeleted} S3 objects for tenant ${tenantId}`);
}

// Get all admins for a tenant
async function getTenantAdmins(tenantId) {
  const params = {
    TableName: process.env.USER_TENANTS_TABLE,
    IndexName: 'tenant-users-index',
    KeyConditionExpression: 'tenant_id = :tenantId',
    FilterExpression: '#role = :adminRole',
    ExpressionAttributeNames: {
      '#role': 'role'
    },
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
      ':adminRole': 'admin'
    }
  };

  try {
    console.log('Querying admins with params:', JSON.stringify(params, null, 2));
    const result = await dynamodb.send(new QueryCommand(params));
    console.log('Query result:', JSON.stringify(result, null, 2));
    const admins = result.Items || [];
    console.log(`Found ${admins.length} admins for tenant ${tenantId}`);
    
    // Fetch user details from Cognito for each admin
    const adminDetails = await Promise.all(admins.map(async (admin) => {
      try {
        const cognitoParams = {
          UserPoolId: process.env.USER_POOL_ID,
          Username: admin.user_id
        };
        const userResult = await cognito.send(new AdminGetUserCommand(cognitoParams));
        
        const emailAttr = userResult.UserAttributes?.find(attr => attr.Name === 'email');
        const nameAttr = userResult.UserAttributes?.find(attr => attr.Name === 'name');
        
        return {
          user_id: admin.user_id,
          email: emailAttr?.Value || 'Unbekannt',
          name: nameAttr?.Value || null,
          role: admin.role,
          permissions: admin.permissions || [],
          joined_at: admin.joined_at || admin.created_at
        };
      } catch (cognitoError) {
        console.warn('Could not fetch Cognito user details:', cognitoError);
        return {
          user_id: admin.user_id,
          email: admin.email || 'Unbekannt',
          name: null,
          role: admin.role,
          permissions: admin.permissions || [],
          joined_at: admin.joined_at || admin.created_at
        };
      }
    }));
    
    console.log('Returning admin details:', JSON.stringify(adminDetails, null, 2));
    return adminDetails;
  } catch (error) {
    console.error('Error getting tenant admins:', error);
    throw new Error('Fehler beim Laden der Admin-Liste');
  }
}

// Get all members (users) for a tenant - respects tenant isolation
async function getTenantMembers(tenantId) {
  const params = {
    TableName: process.env.USER_TENANTS_TABLE,
    IndexName: 'tenant-users-index',
    KeyConditionExpression: 'tenant_id = :tenantId',
    ExpressionAttributeValues: {
      ':tenantId': tenantId
    }
  };

  try {
    console.log('Querying members for tenant:', tenantId);
    const result = await dynamodb.send(new QueryCommand(params));
    const members = result.Items || [];
    console.log(`Found ${members.length} members for tenant ${tenantId}`);
    
    // Fetch user details from Cognito for each member
    const memberDetails = await Promise.all(members.map(async (member) => {
      try {
        const cognitoParams = {
          UserPoolId: process.env.USER_POOL_ID,
          Username: member.user_id
        };
        const userResult = await cognito.send(new AdminGetUserCommand(cognitoParams));
        
        const emailAttr = userResult.UserAttributes?.find(attr => attr.Name === 'email');
        const nameAttr = userResult.UserAttributes?.find(attr => attr.Name === 'name');
        const usernameAttr = userResult.UserAttributes?.find(attr => attr.Name === 'custom:username');
        const emailVerifiedAttr = userResult.UserAttributes?.find(attr => attr.Name === 'email_verified');
        
        // Use name if available, otherwise fall back to custom:username
        const displayName = nameAttr?.Value || usernameAttr?.Value || null;
        
        return {
          user_id: member.user_id,
          email: emailAttr?.Value || 'Unbekannt',
          name: displayName,
          role: member.role || 'user',
          email_verified: emailVerifiedAttr?.Value === 'true',
          status: userResult.UserStatus || 'UNKNOWN',
          joined_at: member.joined_at || member.created_at,
          last_login: userResult.UserLastModifiedDate?.toISOString() || null
        };
      } catch (cognitoError) {
        console.warn('Could not fetch Cognito user details for:', member.user_id, cognitoError.message);
        return {
          user_id: member.user_id,
          email: member.email || 'Unbekannt',
          name: null,
          role: member.role || 'user',
          email_verified: false,
          status: 'UNKNOWN',
          joined_at: member.joined_at || member.created_at,
          last_login: null
        };
      }
    }));
    
    // Sort by role (admins first) then by joined_at
    memberDetails.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return new Date(b.joined_at || 0) - new Date(a.joined_at || 0);
    });
    
    return memberDetails;
  } catch (error) {
    console.error('Error getting tenant members:', error);
    throw new Error('Fehler beim Laden der Mitglieder-Liste');
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path, pathParameters, queryStringParameters, requestContext } = event;
  
  // Decode body if Base64 encoded
  let rawBody = event.body;
  if (event.isBase64Encoded && rawBody) {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf-8');
  }

  // CORS headers for all responses
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  // Handle OPTIONS preflight requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // PUBLIC ENDPOINT: Domain routing - must be checked BEFORE authorizer access
    // GET /domain-routing/{domain} - Resolve tenant from custom domain (no auth required)
    if (httpMethod === 'GET' && path.includes('/domain-routing/')) {
      const domain = pathParameters?.domain || path.split('/domain-routing/')[1];
      
      if (!domain) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Domain erforderlich' })
        };
      }

      try {
        console.log('Domain routing lookup for:', domain);
        
        // Check if it's a viraltenant.com subdomain
        if (domain.includes('viraltenant.com')) {
          const subdomain = domain.split('.')[0];
          if (subdomain && subdomain !== 'www' && subdomain !== 'viraltenant') {
            const tenant = await getTenantBySubdomain(subdomain);
            if (tenant) {
              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                  tenantId: tenant.tenant_id,
                  subdomain: tenant.subdomain,
                  creatorName: tenant.creator_name,
                  source: 'subdomain'
                })
              };
            }
          }
          // Main domain - return platform
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              tenantId: 'platform',
              subdomain: 'platform',
              creatorName: 'ViralTenant',
              source: 'platform'
            })
          };
        }

        // Custom domain lookup
        const tenant = await getTenantByCustomDomain(domain);
        
        if (tenant) {
          console.log('Found tenant for custom domain:', tenant.tenant_id, 'status:', tenant.status);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              tenantId: tenant.tenant_id,
              subdomain: tenant.subdomain,
              creatorName: tenant.creator_name,
              source: 'custom_domain',
              status: tenant.status || 'active',
              status_reason: tenant.status_reason || ''
            })
          };
        }

        // No tenant found for this domain
        console.log('No tenant found for domain:', domain);
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Kein Tenant für diese Domain gefunden',
            tenantId: null
          })
        };
      } catch (error) {
        console.error('Error in domain routing:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Domain-Routing' })
        };
      }
    }

    // Extract user ID from authorizer context (if available)
    const userId = requestContext?.authorizer?.userId;

    // Route handling
    if (httpMethod === 'GET' && path.includes('/user/tenants')) {
      // GET /user/tenants - Get all tenants for the authenticated user
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      try {
        const params = {
          TableName: process.env.USER_TENANTS_TABLE,
          KeyConditionExpression: 'user_id = :user_id',
          ExpressionAttributeValues: {
            ':user_id': userId
          }
        };

        const userTenantsResult = await dynamodb.send(new QueryCommand(params));
        
        if (!userTenantsResult.Items || userTenantsResult.Items.length === 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }

        // Get tenant details for each tenant_id
        const tenantPromises = userTenantsResult.Items.map(async (userTenant) => {
          const tenantParams = {
            TableName: process.env.TENANTS_TABLE,
            Key: { tenant_id: userTenant.tenant_id }
          };
          
          const tenantResult = await dynamodb.send(new GetCommand(tenantParams));
          
          if (tenantResult.Item) {
            return {
              id: tenantResult.Item.tenant_id,
              subdomain: tenantResult.Item.subdomain,
              creator_name: tenantResult.Item.creator_name,
              status: tenantResult.Item.status,
              role: userTenant.role,
              permissions: userTenant.permissions
            };
          }
          return null;
        });

        const tenants = (await Promise.all(tenantPromises)).filter(Boolean);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(tenants)
        };
      } catch (error) {
        console.error('Error getting user tenants:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden der Tenant-Daten' })
        };
      }
    }

    if (httpMethod === 'GET' && path.includes('/tenants/by-subdomain/')) {
      // GET /tenants/by-subdomain/{subdomain}
      const subdomain = pathParameters.subdomain;
      const tenant = await getTenantBySubdomain(subdomain);
      
      if (!tenant) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Tenant nicht gefunden' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: tenant.tenant_id,
          tenant_id: tenant.tenant_id,
          subdomain: tenant.subdomain,
          creator_name: tenant.creator_name,
          status: tenant.status || 'active',
          status_reason: tenant.status_reason || ''
        })
      };
    }

    // GET /tenants/platform - Get the platform tenant (for main domain)
    if (httpMethod === 'GET' && path === '/tenants/platform') {
      try {
        const tenant = await getTenant('platform');
        
        if (!tenant) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Platform tenant nicht gefunden' })
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            id: tenant.tenant_id,
            subdomain: tenant.subdomain,
            creator_name: tenant.creator_name,
            status: tenant.status
          })
        };
      } catch (error) {
        console.error('Error getting platform tenant:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden des Platform-Tenants' })
        };
      }
    }

    if (httpMethod === 'GET' && path.includes('/subdomain/check')) {
      // GET /tenants/{tenantId}/subdomain/check?name=foo
      const tenantId = pathParameters.tenantId;
      const subdomainName = queryStringParameters?.name;

      if (!subdomainName) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Subdomain-Name erforderlich' })
        };
      }

      if (!isValidSubdomain(subdomainName)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            available: false, 
            message: 'Ungültiger Subdomain-Name' 
          })
        };
      }

      const availability = await checkSubdomainAvailability(subdomainName);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(availability)
      };
    }

    if (httpMethod === 'GET' && path.includes('/admins')) {
      // GET /tenants/{tenantId}/admins - Get all admins for a tenant
      const tenantId = pathParameters.tenantId;
      console.log('Processing GET /admins request for tenant:', tenantId);
      console.log('User ID from authorizer:', userId);

      if (!userId) {
        console.log('No userId found in authorizer');
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // Check if user is admin of this tenant
      console.log('Checking if user is admin of tenant...');
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      console.log('Is user admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('User is not admin of this tenant');
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      try {
        console.log('Fetching admins for tenant:', tenantId);
        const admins = await getTenantAdmins(tenantId);
        console.log('Successfully fetched admins:', admins);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ admins })
        };
      } catch (error) {
        console.error('Error getting tenant admins:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden der Admin-Liste' })
        };
      }
    }

    // GET /tenants/{tenantId}/members - Get all members for a tenant (admin only, respects tenant isolation)
    if (httpMethod === 'GET' && path.includes('/members')) {
      const tenantId = pathParameters.tenantId;
      console.log('Processing GET /members request for tenant:', tenantId);
      console.log('User ID from authorizer:', userId);

      if (!userId) {
        console.log('No userId found in authorizer');
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // STRICT TENANT ISOLATION: Only admins of THIS tenant can see members
      console.log('Checking if user is admin of tenant (strict isolation)...');
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      console.log('Is user admin of this specific tenant?', isAdmin);
      
      if (!isAdmin) {
        console.log('User is not admin of this tenant - access denied');
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung. Nur Admins dieses Tenants können Mitglieder sehen.' })
        };
      }

      try {
        console.log('Fetching members for tenant:', tenantId);
        const members = await getTenantMembers(tenantId);
        console.log(`Successfully fetched ${members.length} members`);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            members,
            total: members.length,
            tenant_id: tenantId
          })
        };
      } catch (error) {
        console.error('Error getting tenant members:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden der Mitglieder-Liste' })
        };
      }
    }

    // POST /tenants/{tenantId}/admins - Add a new admin to tenant
    if (httpMethod === 'POST' && path.includes('/admins')) {
      const tenantId = pathParameters.tenantId;
      const body = JSON.parse(rawBody || '{}');
      const { email } = body;

      console.log('POST /admins - tenantId:', tenantId, 'email:', email);

      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // Check if requesting user is admin of this tenant
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      if (!email || !email.includes('@')) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Gültige E-Mail-Adresse erforderlich' })
        };
      }

      try {
        // Find user by email in Cognito
        const { ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
        const listUsersResult = await cognito.send(new ListUsersCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Filter: `email = "${email}"`,
          Limit: 1
        }));

        if (!listUsersResult.Users || listUsersResult.Users.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Benutzer mit dieser E-Mail nicht gefunden. Der Benutzer muss sich zuerst registrieren.' })
          };
        }

        const newAdminUserId = listUsersResult.Users[0].Username;
        const nameAttr = listUsersResult.Users[0].Attributes?.find(a => a.Name === 'name');

        // Check if user is already admin of this tenant
        const existingAdmin = await isUserTenantAdmin(newAdminUserId, tenantId);
        if (existingAdmin) {
          return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Benutzer ist bereits Administrator dieses Tenants' })
          };
        }

        // Add user as admin to tenant
        const { PutCommand } = require('@aws-sdk/lib-dynamodb');
        await dynamodb.send(new PutCommand({
          TableName: process.env.USER_TENANTS_TABLE,
          Item: {
            user_id: newAdminUserId,
            tenant_id: tenantId,
            role: 'admin',
            permissions: ['manage_subdomain', 'manage_content', 'manage_billing', 'manage_users', 'view_analytics'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }));

        console.log(`Added user ${newAdminUserId} as admin to tenant ${tenantId}`);

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Administrator erfolgreich hinzugefügt',
            admin: {
              user_id: newAdminUserId,
              email: email,
              name: nameAttr?.Value || null,
              role: 'admin'
            }
          })
        };
      } catch (error) {
        console.error('Error adding admin:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Hinzufügen des Administrators' })
        };
      }
    }

    // DELETE /tenants/{tenantId}/admins/{adminUserId} - Remove admin from tenant
    if (httpMethod === 'DELETE' && path.includes('/admins/')) {
      const tenantId = pathParameters.tenantId;
      const adminUserId = pathParameters.adminUserId;

      console.log('DELETE /admins - tenantId:', tenantId, 'adminUserId:', adminUserId);

      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // Check if requesting user is admin of this tenant
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      // Prevent removing yourself
      if (adminUserId === userId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Sie können sich nicht selbst als Administrator entfernen' })
        };
      }

      // Check if target user is actually an admin of this tenant
      const targetIsAdmin = await isUserTenantAdmin(adminUserId, tenantId);
      if (!targetIsAdmin) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Benutzer ist kein Administrator dieses Tenants' })
        };
      }

      try {
        // Remove admin from tenant
        await dynamodb.send(new DeleteCommand({
          TableName: process.env.USER_TENANTS_TABLE,
          Key: {
            user_id: adminUserId,
            tenant_id: tenantId
          }
        }));

        console.log(`Removed user ${adminUserId} as admin from tenant ${tenantId}`);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Administrator erfolgreich entfernt' })
        };
      } catch (error) {
        console.error('Error removing admin:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Entfernen des Administrators' })
        };
      }
    }

    if (httpMethod === 'POST' && path.includes('/subdomain')) {
      // POST /tenants/{tenantId}/subdomain
      const tenantId = pathParameters.tenantId;
      const body = JSON.parse(rawBody || '{}');
      const subdomain = body.subdomain;
      
      console.log('POST /subdomain - tenantId:', tenantId, 'new subdomain:', subdomain);

      // Check if user is tenant admin
      if (!userId || !await isUserTenantAdmin(userId, tenantId)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      if (!subdomain || !isValidSubdomain(subdomain)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Ungültiger Subdomain-Name' })
        };
      }

      // Get current tenant to check for existing subdomain
      const currentTenant = await getTenant(tenantId);
      const oldSubdomain = currentTenant?.subdomain;
      
      console.log('Current tenant subdomain:', oldSubdomain, 'New subdomain:', subdomain);
      
      // If subdomain is the same, no change needed
      if (oldSubdomain === subdomain) {
        console.log('Subdomain unchanged, returning early');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Subdomain ist bereits gesetzt',
            tenant: {
              id: currentTenant.tenant_id,
              subdomain: currentTenant.subdomain,
              creator_name: currentTenant.creator_name,
              status: currentTenant.status
            }
          })
        };
      }

      // Check availability (skip if it's the tenant's own subdomain)
      const availability = await checkSubdomainAvailability(subdomain);
      if (!availability.available) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify(availability)
        };
      }

      // Delete old Route53 record if exists
      if (oldSubdomain && oldSubdomain !== subdomain) {
        console.log('Deleting old subdomain Route53 record:', oldSubdomain);
        try {
          await deleteSubdomainFromRoute53(oldSubdomain);
          console.log('Old subdomain deletion completed');
        } catch (deleteError) {
          console.error('Error during old subdomain deletion:', deleteError);
          // Continue anyway - don't block the new subdomain creation
        }
      } else {
        console.log('No old subdomain to delete (oldSubdomain:', oldSubdomain, ')');
      }

      // Create new Route53 record (UPSERT)
      console.log('Creating new Route53 record for:', subdomain);
      await createSubdomainRecord(subdomain);

      // Update tenant in DynamoDB (main table)
      const updatedTenant = await updateTenantSubdomain(tenantId, subdomain);
      console.log('Tenant updated successfully in main table');

      // Update subdomain in all related tables
      console.log('Updating subdomain in related tables...');
      const relatedUpdates = await updateSubdomainInRelatedTables(tenantId, subdomain);
      console.log('Related tables update results:', JSON.stringify(relatedUpdates));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: oldSubdomain ? 'Subdomain erfolgreich geändert' : 'Subdomain erfolgreich erstellt',
          oldSubdomain: oldSubdomain || null,
          tenant: {
            id: updatedTenant.tenant_id,
            subdomain: updatedTenant.subdomain,
            creator_name: updatedTenant.creator_name,
            status: updatedTenant.status
          },
          relatedUpdates: relatedUpdates
        })
      };
    }

    if (httpMethod === 'GET' && path.includes('/user/notifications')) {
      // GET /tenants/{tenantId}/user/notifications - Get user's notification settings
      const tenantId = pathParameters.tenantId;
      
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      try {
        // Get user's notification settings from user_tenants table
        const params = {
          TableName: process.env.USER_TENANTS_TABLE,
          Key: {
            user_id: userId,
            tenant_id: tenantId
          }
        };
        
        const result = await dynamodb.send(new GetCommand(params));
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            emailNotifications: result.Item?.email_notifications !== false // Default true
          })
        };
      } catch (error) {
        console.error('Error getting notification settings:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden der Einstellungen' })
        };
      }
    }

    if (httpMethod === 'PUT' && path.includes('/user/notifications')) {
      // PUT /tenants/{tenantId}/user/notifications - Update user's notification settings
      const tenantId = pathParameters.tenantId;
      const body = JSON.parse(rawBody || '{}');
      
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      try {
        // Update user's notification settings in user_tenants table
        const params = {
          TableName: process.env.USER_TENANTS_TABLE,
          Key: {
            user_id: userId,
            tenant_id: tenantId
          },
          UpdateExpression: 'SET email_notifications = :enabled, updated_at = :now',
          ExpressionAttributeValues: {
            ':enabled': body.emailNotifications === true,
            ':now': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.send(new UpdateCommand(params));
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            emailNotifications: result.Attributes?.email_notifications,
            message: 'Einstellungen gespeichert'
          })
        };
      } catch (error) {
        console.error('Error saving notification settings:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Speichern der Einstellungen' })
        };
      }
    }

    if (httpMethod === 'GET' && pathParameters?.tenantId && !path.includes('/custom-pages') && !path.includes('/admins') && !path.includes('/members') && !path.includes('/subdomain/check') && !path.includes('/user/notifications')) {
      // GET /tenants/{tenantId}
      const tenantId = pathParameters.tenantId;
      const tenant = await getTenant(tenantId);

      if (!tenant) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Tenant nicht gefunden' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: tenant.tenant_id,
          subdomain: tenant.subdomain,
          creator_name: tenant.creator_name,
          creator_email: tenant.creator_email,
          first_name: tenant.first_name || '',
          last_name: tenant.last_name || '',
          phone: tenant.phone || '',
          status: tenant.status
        })
      };
    }

    // PUT /tenants/{tenantId} - Update tenant profile data (admin only)
    if (httpMethod === 'PUT' && pathParameters?.tenantId && !path.includes('/user/notifications') && !path.includes('/custom-pages')) {
      const tenantId = pathParameters.tenantId;
      const body = JSON.parse(rawBody || '{}');
      const { firstName, lastName, phone } = body;

      console.log('PUT /tenants - tenantId:', tenantId, 'data:', { firstName, lastName, phone });

      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // Check if user is admin of this tenant
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Keine Berechtigung für diese Aktion' })
        };
      }

      try {
        // Build update expression dynamically
        const updateExpressions = ['updated_at = :updated_at'];
        const expressionAttributeValues = {
          ':updated_at': new Date().toISOString()
        };

        if (firstName !== undefined) {
          updateExpressions.push('first_name = :firstName');
          expressionAttributeValues[':firstName'] = firstName;
        }

        if (lastName !== undefined) {
          updateExpressions.push('last_name = :lastName');
          expressionAttributeValues[':lastName'] = lastName;
        }

        if (phone !== undefined) {
          updateExpressions.push('phone = :phone');
          expressionAttributeValues[':phone'] = phone;
        }

        // Update creator_name if firstName or lastName changed
        if (firstName !== undefined || lastName !== undefined) {
          const currentTenant = await getTenant(tenantId);
          const newFirstName = firstName !== undefined ? firstName : (currentTenant.first_name || '');
          const newLastName = lastName !== undefined ? lastName : (currentTenant.last_name || '');
          const newCreatorName = `${newFirstName} ${newLastName}`.trim();
          
          updateExpressions.push('creator_name = :creatorName');
          expressionAttributeValues[':creatorName'] = newCreatorName;
        }

        const params = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId },
          UpdateExpression: 'SET ' + updateExpressions.join(', '),
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW'
        };

        const result = await dynamodb.send(new UpdateCommand(params));
        const updatedTenant = result.Attributes;

        console.log('Tenant updated successfully:', tenantId);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Tenant erfolgreich aktualisiert',
            tenant: {
              id: updatedTenant.tenant_id,
              subdomain: updatedTenant.subdomain,
              creator_name: updatedTenant.creator_name,
              creator_email: updatedTenant.creator_email,
              first_name: updatedTenant.first_name || '',
              last_name: updatedTenant.last_name || '',
              phone: updatedTenant.phone || '',
              status: updatedTenant.status
            }
          })
        };
      } catch (error) {
        console.error('Error updating tenant:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Aktualisieren des Tenants' })
        };
      }
    }

    // ============================================================
    // DELETE ENDPOINTS
    // ============================================================

    // DELETE /user/account - Delete own user account
    if (httpMethod === 'DELETE' && path.includes('/user/account')) {
      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // Require confirmation in request body
      const body = JSON.parse(rawBody || '{}');
      if (body.confirm !== 'DELETE_MY_ACCOUNT') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Bestätigung erforderlich',
            hint: 'Sende { "confirm": "DELETE_MY_ACCOUNT" } im Request Body'
          })
        };
      }

      console.log('User requested account deletion:', userId);
      const result = await deleteUserAccount(userId);

      if (result.success) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Account erfolgreich gelöscht',
            details: result
          })
        };
      } else {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Fehler beim Löschen des Accounts',
            errors: result.errors
          })
        };
      }
    }

    // DELETE /tenants/{tenantId} - Delete entire tenant (admin only)
    if (httpMethod === 'DELETE' && pathParameters?.tenantId && !path.includes('/admins') && !path.includes('/custom-pages')) {
      const tenantId = pathParameters.tenantId;

      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      // Check if user is admin of this tenant
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Nur Admins können den Tenant löschen' })
        };
      }

      // Require confirmation in request body
      const body = JSON.parse(rawBody || '{}');
      if (body.confirm !== 'DELETE_TENANT') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Bestätigung erforderlich',
            hint: 'Sende { "confirm": "DELETE_TENANT" } im Request Body'
          })
        };
      }

      console.log('Admin requested tenant deletion:', tenantId, 'by user:', userId);
      const result = await deleteTenant(tenantId, userId);

      if (result.success) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Tenant erfolgreich gelöscht',
            deleted: result.deleted,
            warnings: result.errors.length > 0 ? result.errors : undefined
          })
        };
      } else {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Fehler beim Löschen des Tenants',
            errors: result.errors,
            partiallyDeleted: result.deleted
          })
        };
      }
    }

    // ============================================================
    // CUSTOM PAGES ENDPOINTS
    // ============================================================

    // Helper function to get or create tenant for custom pages
    async function getOrCreateTenantForCustomPages(tenantId) {
      const params = {
        TableName: process.env.TENANTS_TABLE,
        Key: { tenant_id: tenantId }
      };
      
      const result = await dynamodb.send(new GetCommand(params));
      
      if (result.Item) {
        // Ensure custom_pages array exists
        if (!result.Item.custom_pages) {
          result.Item.custom_pages = [];
        }
        return result.Item;
      }
      
      // For platform tenant, create a minimal entry if it doesn't exist
      if (tenantId === 'platform') {
        const platformTenant = {
          tenant_id: 'platform',
          subdomain: 'platform',
          creator_name: 'ViralTenant',
          status: 'active',
          custom_pages: [],
          created_at: new Date().toISOString()
        };
        
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: 'platform' },
          UpdateExpression: 'SET subdomain = :subdomain, creator_name = :name, #status = :status, custom_pages = if_not_exists(custom_pages, :pages), created_at = if_not_exists(created_at, :created)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':subdomain': 'platform',
            ':name': 'ViralTenant',
            ':status': 'active',
            ':pages': [],
            ':created': new Date().toISOString()
          }
        }));
        
        return platformTenant;
      }
      
      // For regular tenants that don't exist yet, initialize custom_pages
      // This handles the case where tenant exists in Cognito but not yet in DynamoDB
      console.log('Tenant not found in DynamoDB, attempting to initialize:', tenantId);
      return null;
    }

    // GET /tenants/{tenantId}/custom-pages - List all custom pages
    if (httpMethod === 'GET' && path.match(/\/tenants\/[^/]+\/custom-pages$/) && !path.includes('/by-slug/') && !path.includes('/upload-url')) {
      const pathMatch = path.match(/\/tenants\/([^/]+)\/custom-pages$/);
      const tenantId = pathParameters?.tenantId || (pathMatch ? pathMatch[1] : null);
      
      console.log('GET custom-pages for tenant:', tenantId, 'path:', path);
      
      try {
        // Direct DynamoDB query instead of helper function for reliability
        const params = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId }
        };
        
        console.log('Querying DynamoDB with params:', JSON.stringify(params));
        const result = await dynamodb.send(new GetCommand(params));
        console.log('DynamoDB result found:', !!result.Item, 'custom_pages count:', result.Item?.custom_pages?.length || 0);
        
        const customPages = result.Item?.custom_pages || [];
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ pages: customPages })
        };
      } catch (error) {
        console.error('Error loading custom pages:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden der Seiten' })
        };
      }
    }

    // GET /tenants/{tenantId}/custom-pages/by-slug/{slug} - Get page by slug (public)
    if (httpMethod === 'GET' && path.includes('/custom-pages/by-slug/')) {
      const pathMatch = path.match(/\/tenants\/([^/]+)\/custom-pages\/by-slug\/([^/]+)$/);
      const tenantId = pathParameters?.tenantId || (pathMatch ? pathMatch[1] : null);
      const slug = pathParameters?.slug || (pathMatch ? pathMatch[2] : null);
      
      try {
        const params = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId }
        };
        
        const result = await dynamodb.send(new GetCommand(params));
        const customPages = result.Item?.custom_pages || [];
        const page = customPages.find(p => p.slug === slug && p.isPublished);
        
        if (!page) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Seite nicht gefunden' })
          };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(page)
        };
      } catch (error) {
        console.error('Error loading custom page:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Laden der Seite' })
        };
      }
    }

    // POST /tenants/{tenantId}/custom-pages - Create custom page
    if (httpMethod === 'POST' && path.match(/\/tenants\/[^/]+\/custom-pages$/)) {
      const pathMatch = path.match(/\/tenants\/([^/]+)\/custom-pages$/);
      const tenantId = pathParameters?.tenantId || (pathMatch ? pathMatch[1] : null);
      
      console.log('POST custom-pages rawBody:', rawBody);
      console.log('POST custom-pages isBase64Encoded:', event.isBase64Encoded);
      
      let body;
      try {
        body = JSON.parse(rawBody || '{}');
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'rawBody:', rawBody);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Ungültiges JSON im Request-Body' })
        };
      }
      
      console.log('POST custom-pages for tenant:', tenantId, 'path:', path, 'body:', JSON.stringify(body));
      
      if (!body.title || !body.slug) {
        console.log('Missing title or slug. title:', body.title, 'slug:', body.slug);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Titel und Slug sind erforderlich', received: { title: body.title, slug: body.slug } })
        };
      }
      
      // Validate slug
      if (!/^[a-z0-9-]+$/.test(body.slug)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten' })
        };
      }
      
      try {
        // Get or create tenant (especially for platform)
        const tenant = await getOrCreateTenantForCustomPages(tenantId);
        
        // If tenant doesn't exist, try to create the custom_pages entry anyway
        // This handles the case where the tenant exists in Cognito but the DynamoDB entry
        // doesn't have custom_pages yet, or the tenant was created through a different flow
        let customPages = [];
        
        if (tenant) {
          customPages = tenant.custom_pages || [];
        } else {
          console.log('Tenant not found, will create custom_pages entry for:', tenantId);
        }
        
        // Limit: Max 3 custom pages per tenant
        const MAX_CUSTOM_PAGES = 3;
        if (customPages.length >= MAX_CUSTOM_PAGES) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: `Maximale Anzahl von ${MAX_CUSTOM_PAGES} Custom-Seiten erreicht` })
          };
        }
        
        // Check if slug already exists
        if (customPages.some(p => p.slug === body.slug)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Eine Seite mit diesem Slug existiert bereits' })
          };
        }
        
        const newPage = {
          pageId: `page-${Date.now()}`,
          title: body.title,
          slug: body.slug,
          blocks: body.blocks || [],
          isPublished: body.isPublished !== false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        customPages.push(newPage);
        
        // Use UpdateCommand with if_not_exists to handle both existing and new tenants
        const updateParams = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId },
          UpdateExpression: 'SET custom_pages = :pages',
          ExpressionAttributeValues: { ':pages': customPages }
        };
        
        await dynamodb.send(new UpdateCommand(updateParams));
        
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(newPage)
        };
      } catch (error) {
        console.error('Error creating custom page:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Erstellen der Seite', details: error.message })
        };
      }
    }

    // POST /tenants/{tenantId}/custom-pages/upload-url - Generate presigned URL for media upload
    if (httpMethod === 'POST' && path.match(/\/tenants\/[^/]+\/custom-pages\/upload-url$/)) {
      const pathMatch = path.match(/\/tenants\/([^/]+)\/custom-pages\/upload-url$/);
      const tenantId = pathParameters?.tenantId || (pathMatch ? pathMatch[1] : null);
      
      let body;
      try {
        body = JSON.parse(rawBody || '{}');
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Ungültiges JSON' })
        };
      }
      
      const { filename, contentType } = body;
      
      if (!filename || !contentType) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'filename und contentType sind erforderlich' })
        };
      }
      
      try {
        const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
        
        const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });
        const bucketName = process.env.ASSETS_BUCKET || 'viraltenant-creator-assets-production';
        
        // Generate unique key for the file
        // IMPORTANT: Key must start with 'tenants/' to match CloudFront cache behavior
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `tenants/${tenantId}/custom-pages/${timestamp}-${sanitizedFilename}`;
        
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          ContentType: contentType
        });
        
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        // Generate the public URL for the asset
        const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN_NAME || process.env.CLOUDFRONT_DOMAIN || 'df5r2od45h0ol.cloudfront.net';
        const publicUrl = `https://${cloudfrontDomain}/${key}`;
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            uploadUrl, 
            key,
            publicUrl
          })
        };
      } catch (error) {
        console.error('Error generating upload URL:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Generieren der Upload-URL', details: error.message })
        };
      }
    }

    // PUT /tenants/{tenantId}/custom-pages/{pageId} - Update custom page
    if (httpMethod === 'PUT' && path.match(/\/tenants\/[^/]+\/custom-pages\/[^/]+$/)) {
      const pathMatch = path.match(/\/tenants\/([^/]+)\/custom-pages\/([^/]+)$/);
      const tenantId = pathParameters?.tenantId || (pathMatch ? pathMatch[1] : null);
      const pageId = pathParameters?.pageId || (pathMatch ? pathMatch[2] : null);
      const body = JSON.parse(rawBody || '{}');
      
      try {
        const getParams = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId }
        };
        const result = await dynamodb.send(new GetCommand(getParams));
        const customPages = result.Item?.custom_pages || [];
        
        const pageIndex = customPages.findIndex(p => p.pageId === pageId);
        if (pageIndex === -1) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Seite nicht gefunden' })
          };
        }
        
        // Update page
        customPages[pageIndex] = {
          ...customPages[pageIndex],
          ...body,
          pageId: customPages[pageIndex].pageId, // Keep original ID
          slug: customPages[pageIndex].slug, // Keep original slug
          updatedAt: new Date().toISOString()
        };
        
        const updateParams = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId },
          UpdateExpression: 'SET custom_pages = :pages',
          ExpressionAttributeValues: { ':pages': customPages }
        };
        
        await dynamodb.send(new UpdateCommand(updateParams));
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(customPages[pageIndex])
        };
      } catch (error) {
        console.error('Error updating custom page:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Aktualisieren der Seite' })
        };
      }
    }

    // DELETE /tenants/{tenantId}/custom-pages/{pageId} - Delete custom page
    if (httpMethod === 'DELETE' && path.match(/\/tenants\/[^/]+\/custom-pages\/[^/]+$/)) {
      const pathMatch = path.match(/\/tenants\/([^/]+)\/custom-pages\/([^/]+)$/);
      const tenantId = pathParameters?.tenantId || (pathMatch ? pathMatch[1] : null);
      const pageId = pathParameters?.pageId || (pathMatch ? pathMatch[2] : null);
      
      try {
        const getParams = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId }
        };
        const result = await dynamodb.send(new GetCommand(getParams));
        const customPages = result.Item?.custom_pages || [];
        
        const filteredPages = customPages.filter(p => p.pageId !== pageId);
        
        if (filteredPages.length === customPages.length) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Seite nicht gefunden' })
          };
        }
        
        const updateParams = {
          TableName: process.env.TENANTS_TABLE,
          Key: { tenant_id: tenantId },
          UpdateExpression: 'SET custom_pages = :pages',
          ExpressionAttributeValues: { ':pages': filteredPages }
        };
        
        await dynamodb.send(new UpdateCommand(updateParams));
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Seite gelöscht' })
        };
      } catch (error) {
        console.error('Error deleting custom page:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Löschen der Seite' })
        };
      }
    }

    // POST /tenants/{tenantId}/join - User joins a tenant (auto-link on login/register)
    if (httpMethod === 'POST' && path.includes('/join')) {
      const tenantId = pathParameters.tenantId;
      console.log('Processing POST /join request for tenant:', tenantId);
      console.log('User ID from authorizer:', userId);

      if (!userId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Authentifizierung erforderlich' })
        };
      }

      try {
        // Check if tenant exists
        const tenant = await getTenant(tenantId);
        if (!tenant) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Tenant nicht gefunden' })
          };
        }

        // Check if user is already linked to this tenant
        const existingLink = await dynamodb.send(new GetCommand({
          TableName: process.env.USER_TENANTS_TABLE,
          Key: { user_id: userId, tenant_id: tenantId }
        }));

        if (existingLink.Item) {
          console.log('User already linked to tenant:', userId, tenantId);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
              message: 'Bereits Mitglied',
              role: existingLink.Item.role,
              joined_at: existingLink.Item.joined_at || existingLink.Item.created_at
            })
          };
        }

        // Link user to tenant as regular user
        const now = new Date().toISOString();
        await dynamodb.send(new PutCommand({
          TableName: process.env.USER_TENANTS_TABLE,
          Item: {
            user_id: userId,
            tenant_id: tenantId,
            role: 'user',
            permissions: ['read'],
            created_at: now,
            joined_at: now
          }
        }));

        console.log('User joined tenant:', userId, tenantId);

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Erfolgreich beigetreten',
            role: 'user',
            joined_at: now
          })
        };
      } catch (error) {
        console.error('Error joining tenant:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Beitreten' })
        };
      }
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
