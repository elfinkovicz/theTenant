const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });
const ses = new SESClient({ region: process.env.REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });

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
  // For platform tenant, check if user has any admin role
  if (tenantId === 'platform') {
    console.log('Platform tenant - checking if user has any admin role');
    try {
      const params = {
        TableName: process.env.USER_TENANTS_TABLE,
        IndexName: 'user-index', // Assuming there's a GSI on user_id
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

  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    return result.Item && result.Item.role === 'admin';
  } catch (error) { 
    console.error('Error checking admin:', error);
    return false; 
  }
}

const getDefaultData = (tenantId) => ({
  tenant_id: tenantId,
  email: '',
  phone: '',
  address: { street: '', city: '', zip: '', country: 'Deutschland' },
  socialLinks: { instagram: '', twitter: '', youtube: '', tiktok: '', discord: '' },
  formSettings: { enabled: true, recipientEmail: '', subjects: ['Allgemeine Anfrage', 'Support', 'Kooperation'] },
  mapSettings: { enabled: false, lat: null, lng: null },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  if (data.backgroundKey) {
    data.backgroundUrl = `https://${cfDomain}/${data.backgroundKey}`;
  }
  return data;
};

async function getContact(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_CONTACT_TABLE, Key: { tenant_id: tenantId }
    }));
    return enrichWithUrls(result.Item || getDefaultData(tenantId));
  } catch (error) { return getDefaultData(tenantId); }
}

async function updateContact(tenantId, updates) {
  const existing = await getContact(tenantId);
  const item = { ...existing, ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_CONTACT_TABLE, Item: item }));
  return enrichWithUrls(item);
}

async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const ext = fileName.split('.').pop();
  const key = `tenants/${tenantId}/contact/${uploadType}-${Date.now()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, key, publicUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}` };
}

async function deleteFile(key) {
  if (!key) return;
  try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key })); } catch (e) {}
}

// Escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Get tenant admin emails from Cognito
async function getTenantAdminEmails(tenantId) {
  try {
    // Query user-tenants table for admins of this tenant
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      IndexName: 'tenant-users-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      FilterExpression: '#role = :adminRole',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':adminRole': 'admin'
      }
    }));
    
    const admins = result.Items || [];
    console.log(`Found ${admins.length} admins for tenant ${tenantId}`);
    
    if (admins.length === 0) return [];
    
    // Get email addresses from Cognito for each admin
    const emails = [];
    for (const admin of admins) {
      try {
        const userResult = await cognito.send(new AdminGetUserCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: admin.user_id
        }));
        
        const emailAttr = userResult.UserAttributes?.find(attr => attr.Name === 'email');
        if (emailAttr?.Value) {
          emails.push(emailAttr.Value);
        }
      } catch (err) {
        console.warn('Could not get email for user:', admin.user_id, err.message);
      }
    }
    
    console.log('Admin emails:', emails);
    return emails;
  } catch (error) {
    console.error('Error getting tenant admin emails:', error);
    return [];
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const rawTenantId = authorizerTenantId || pathParameters?.tenantId;
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(rawTenantId);
  console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);

  if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  try {
    if (httpMethod === 'GET' && !path.includes('/upload-url')) {
      const data = await getContact(tenantId);
      
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

    if (httpMethod === 'PUT' && !path.includes('/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const updated = await updateContact(tenantId, JSON.parse(event.body || '{}'));
      
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

    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const { fileName, fileType, uploadType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'background')) };
    }

    if (httpMethod === 'DELETE' && path.includes('/asset')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      await deleteFile(JSON.parse(event.body || '{}').key);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Asset gelöscht' }) };
    }

    // POST /tenants/{tenantId}/contact/message - Send contact form message (no auth required)
    if (httpMethod === 'POST' && path.includes('/message')) {
      const body = JSON.parse(event.body || '{}');
      const { name, email, subject, message } = body;
      
      if (!name || !email || !message) {
        return { 
          statusCode: 400, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Name, E-Mail und Nachricht sind erforderlich' }) 
        };
      }
      
      // Get contact settings to find recipient email
      const contactData = await getContact(tenantId);
      
      // Priority: 1. formSettings.recipientEmail, 2. contactData.email, 3. Tenant admin emails, 4. ADMIN_EMAIL fallback
      let recipientEmails = [];
      
      // Platform tenant always goes to fixed email
      if (tenantId === 'platform') {
        recipientEmails = ['dertenant@gmail.com'];
        console.log('Platform tenant - using fixed email:', recipientEmails);
      } else if (contactData.formSettings?.recipientEmail) {
        recipientEmails = [contactData.formSettings.recipientEmail];
        console.log('Using configured recipient email:', recipientEmails);
      } else if (contactData.email) {
        recipientEmails = [contactData.email];
        console.log('Using contact email:', recipientEmails);
      } else {
        // Get tenant admin emails
        try {
          recipientEmails = await getTenantAdminEmails(tenantId);
          console.log('Using tenant admin emails:', recipientEmails);
        } catch (adminError) {
          console.error('Error getting admin emails:', adminError);
          recipientEmails = [];
        }
        
        // Fallback to ADMIN_EMAIL if no admins found
        if (recipientEmails.length === 0 && process.env.ADMIN_EMAIL) {
          recipientEmails = [process.env.ADMIN_EMAIL];
          console.log('Fallback to ADMIN_EMAIL:', recipientEmails);
        }
        
        // Final fallback to default email
        if (recipientEmails.length === 0) {
          recipientEmails = ['dertenant@gmail.com'];
          console.log('Final fallback to default email:', recipientEmails);
        }
      }
      
      // Log final recipient for debugging
      console.log('Final recipient emails:', recipientEmails);
      
      // Build email
      const emailSubject = subject ? `Kontaktanfrage: ${subject}` : 'Neue Kontaktanfrage';
      const htmlBody = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #666; }
              .value { margin-top: 5px; word-break: break-word; overflow-wrap: break-word; }
              .message-box { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>📬 Neue Kontaktanfrage</h2>
              </div>
              <div class="content">
                <div class="field">
                  <div class="label">Name:</div>
                  <div class="value">${escapeHtml(name)}</div>
                </div>
                <div class="field">
                  <div class="label">E-Mail:</div>
                  <div class="value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
                </div>
                ${subject ? `
                <div class="field">
                  <div class="label">Betreff:</div>
                  <div class="value">${escapeHtml(subject)}</div>
                </div>
                ` : ''}
                <div class="field">
                  <div class="label">Nachricht:</div>
                  <div class="message-box">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
                </div>
                <div class="footer">
                  <p>Diese Nachricht wurde über das Kontaktformular gesendet.</p>
                  <p><small>Tenant-ID: ${tenantId}</small></p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
      
      try {
        const command = new SendEmailCommand({
          Source: process.env.SES_FROM_EMAIL || 'noreply@viraltenant.com',
          Destination: {
            ToAddresses: recipientEmails
          },
          ReplyToAddresses: [email],
          Message: {
            Subject: {
              Data: emailSubject,
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
        
        await ses.send(command);
        console.log('Contact form email sent to:', recipientEmails);
        
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Nachricht erfolgreich gesendet' }) 
        };
      } catch (emailError) {
        console.error('Error sending contact form email:', emailError);
        return { 
          statusCode: 500, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Fehler beim Senden der Nachricht' }) 
        };
      }
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
  }
};
