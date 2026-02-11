const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { Route53Client, ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { IvsClient, CreateChannelCommand } = require('@aws-sdk/client-ivs');
const { IvschatClient, CreateRoomCommand } = require('@aws-sdk/client-ivschat');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const route53 = new Route53Client({ region: process.env.REGION });
const ses = new SESClient({ region: process.env.REGION });
const ivs = new IvsClient({ region: process.env.REGION });
const ivschat = new IvschatClient({ region: process.env.REGION });

const SUBDOMAIN_BLACKLIST = [
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn', 'assets',
  'support', 'help', 'blog', 'news', 'shop', 'store', 'payment',
  'secure', 'ssl', 'vpn', 'test', 'staging', 'dev', 'demo', 'billing'
];

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const special = '!@#$%';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 3; i++) pw += upper[Math.floor(Math.random() * upper.length)];
  for (let i = 0; i < 2; i++) pw += nums[Math.floor(Math.random() * nums.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

function isValidSubdomain(subdomain) {
  const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return pattern.test(subdomain) && 
         subdomain.length >= 3 && 
         subdomain.length <= 20 && 
         !SUBDOMAIN_BLACKLIST.includes(subdomain.toLowerCase());
}

async function checkEmailAvailability(email) {
  const params = {
    TableName: process.env.TENANTS_TABLE,
    IndexName: 'creator-email-index',
    KeyConditionExpression: 'creator_email = :email',
    ExpressionAttributeValues: { ':email': email }
  };
  const result = await dynamodb.send(new QueryCommand(params));
  return !(result.Items && result.Items.length > 0);
}

async function checkSubdomainAvailability(subdomain) {
  const params = {
    TableName: process.env.TENANTS_TABLE,
    IndexName: 'subdomain-index',
    KeyConditionExpression: 'subdomain = :subdomain',
    ExpressionAttributeValues: { ':subdomain': subdomain }
  };
  const result = await dynamodb.send(new QueryCommand(params));
  return !(result.Items && result.Items.length > 0);
}

async function sendVerificationEmail(email, code) {
  const params = {
    Source: 'noreply@' + process.env.PLATFORM_DOMAIN,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Ihr Verifizierungscode für ViralTenant', Charset: 'UTF-8' },
      Body: {
        Html: {
          Data: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px;">
    <h1 style="color: #818cf8; margin-bottom: 24px;">E-Mail Verifizierung</h1>
    <p style="font-size: 16px; line-height: 1.6;">Vielen Dank für Ihre Registrierung bei ViralTenant!</p>
    <p style="font-size: 16px; line-height: 1.6;">Ihr Verifizierungscode lautet:</p>
    <div style="background: #0f172a; border: 2px solid #818cf8; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #818cf8;">${code}</span>
    </div>
    <p style="font-size: 14px; color: #94a3b8;">Dieser Code ist 15 Minuten gültig.</p>
    <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">
    <p style="font-size: 12px; color: #64748b;">Falls Sie diese E-Mail nicht angefordert haben, ignorieren Sie sie bitte.</p>
  </div>
</body>
</html>`,
          Charset: 'UTF-8'
        }
      }
    }
  };
  await ses.send(new SendEmailCommand(params));
}

async function sendWelcomeEmail(email, creatorName, subdomain, tenantId, password, ivsData) {
  const tenantUrl = `https://${subdomain}.${process.env.PLATFORM_DOMAIN}`;
  const params = {
    Source: 'noreply@' + process.env.PLATFORM_DOMAIN,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Willkommen bei ViralTenant - Ihre Zugangsdaten', Charset: 'UTF-8' },
      Body: {
        Html: {
          Data: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px;">
    <h1 style="color: #818cf8; margin-bottom: 24px;">🎉 Willkommen bei ViralTenant!</h1>
    <p style="font-size: 16px; line-height: 1.6;">Hallo <strong>${creatorName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.6;">Ihr Tenant wurde erfolgreich erstellt! Hier sind Ihre Zugangsdaten:</p>
    
    <div style="background: #0f172a; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="color: #818cf8; margin-top: 0;">Ihre Tenant-Informationen</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #94a3b8;">Subdomain:</td><td style="padding: 8px 0;"><a href="${tenantUrl}" style="color: #818cf8;">${subdomain}.viraltenant.com</a></td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8;">Tenant-ID:</td><td style="padding: 8px 0; font-family: monospace;">${tenantId}</td></tr>
      </table>
    </div>
    
    <div style="background: #0f172a; border: 2px solid #22c55e; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="color: #22c55e; margin-top: 0;">🔐 Ihre Login-Daten</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #94a3b8;">E-Mail:</td><td style="padding: 8px 0; font-weight: bold;">${email}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8;">Passwort:</td><td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #22c55e;">${password}</td></tr>
      </table>
      <p style="font-size: 12px; color: #f59e0b; margin-top: 16px; margin-bottom: 0;">⚠️ Bitte ändern Sie Ihr Passwort nach dem ersten Login!</p>
    </div>
    
    <div style="background: #0f172a; border: 2px solid #8b5cf6; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="color: #8b5cf6; margin-top: 0;">📺 Ihr Livestreaming-Channel</h3>
      <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">Ihr persönlicher AWS IVS Livestreaming-Channel wurde automatisch erstellt:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #94a3b8;">RTMP URL:</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px; word-break: break-all;">${ivsData.ingestEndpoint}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8;">Stream Key:</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px; word-break: break-all;">${ivsData.streamKey}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8;">Playback URL:</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px; word-break: break-all;">${ivsData.playbackUrl}</td></tr>
      </table>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 16px; margin-bottom: 0;">💡 Diese Daten finden Sie auch in Ihren Stream-Einstellungen im Dashboard.</p>
    </div>
    
    <a href="${tenantUrl}/login" style="display: inline-block; background: #818cf8; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">Jetzt einloggen →</a>
    
    <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0;">
    <p style="font-size: 12px; color: #64748b;">Bei Fragen wenden Sie sich an support@viraltenant.com</p>
  </div>
</body>
</html>`,
          Charset: 'UTF-8'
        }
      }
    }
  };
  await ses.send(new SendEmailCommand(params));
}

async function storeVerificationCode(email, code, tenantData) {
  const params = {
    TableName: process.env.VERIFICATION_TABLE,
    Item: {
      email: email,
      code: code,
      tenant_data: tenantData,
      created_at: new Date().toISOString(),
      expires_at: Math.floor(Date.now() / 1000) + 900
    }
  };
  await dynamodb.send(new PutCommand(params));
}

async function getVerificationData(email, code) {
  const params = {
    TableName: process.env.VERIFICATION_TABLE,
    Key: { email: email }
  };
  const result = await dynamodb.send(new GetCommand(params));
  if (!result.Item) return null;
  if (result.Item.code !== code) return null;
  if (result.Item.expires_at < Math.floor(Date.now() / 1000)) return null;
  return result.Item;
}

async function deleteVerificationCode(email) {
  await dynamodb.send(new DeleteCommand({
    TableName: process.env.VERIFICATION_TABLE,
    Key: { email: email }
  }));
}

async function createIVSChannel(tenantId, creatorName) {
  try {
    // IVS Channel erstellen
    const channelParams = {
      name: `${process.env.PLATFORM_NAME}-${tenantId}-live`,
      type: 'STANDARD',
      latencyMode: 'LOW',
      tags: {
        TenantId: tenantId,
        CreatorName: creatorName,
        Platform: process.env.PLATFORM_NAME || 'ViralTenant'
      }
    };
    
    const channelResult = await ivs.send(new CreateChannelCommand(channelParams));
    
    // IVS Chat Room erstellen
    const chatParams = {
      name: `${process.env.PLATFORM_NAME}-${tenantId}-chat`,
      tags: {
        TenantId: tenantId,
        CreatorName: creatorName,
        Platform: process.env.PLATFORM_NAME || 'ViralTenant'
      }
    };
    
    const chatResult = await ivschat.send(new CreateRoomCommand(chatParams));
    
    return {
      channelArn: channelResult.channel.arn,
      ingestEndpoint: channelResult.channel.ingestEndpoint,
      playbackUrl: channelResult.channel.playbackUrl,
      streamKey: channelResult.streamKey.value,
      chatRoomArn: chatResult.arn
    };
  } catch (error) {
    console.error('Error creating IVS resources:', error);
    throw new Error(`Failed to create IVS resources: ${error.message}`);
  }
}

async function createTenantLiveRecord(tenantId, ivsData) {
  try {
    const now = new Date().toISOString();
    const params = {
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: {
        tenant_id: tenantId,
        ivs_channel_arn: ivsData.channelArn,
        ivs_ingest_endpoint: ivsData.ingestEndpoint,
        ivs_stream_key: ivsData.streamKey,
        ivs_playback_url: ivsData.playbackUrl,
        ivs_chat_room_arn: ivsData.chatRoomArn,
        created_at: now,
        updated_at: now
      }
    };
    
    await dynamodb.send(new PutCommand(params));
    console.log(`Tenant Live record created for tenant: ${tenantId}`);
  } catch (error) {
    console.error('Error creating tenant live record:', error);
    throw new Error(`Failed to create tenant live record: ${error.message}`);
  }
}
async function createTenantS3Structure(tenantId) {
  const folders = ['videos', 'images', 'thumbnails', 'assets', 'config'];
  for (const folder of folders) {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CREATOR_ASSETS_BUCKET,
      Key: `tenants/${tenantId}/${folder}/.keep`,
      Body: '',
      ContentType: 'text/plain'
    }));
  }
  await s3.send(new PutObjectCommand({
    Bucket: process.env.CREATOR_ASSETS_BUCKET,
    Key: `tenants/${tenantId}/config.json`,
    Body: JSON.stringify({
      tenantId, theme: { primaryColor: '#6366f1', secondaryColor: '#8b5cf6', backgroundColor: '#0f172a' },
      features: { chat: true, donations: true, subscriptions: true },
      social: { twitter: '', instagram: '', youtube: '', twitch: '' },
      createdAt: new Date().toISOString()
    }, null, 2),
    ContentType: 'application/json'
  }));
}

async function createSubdomainRecord(subdomain) {
  const params = {
    HostedZoneId: process.env.HOSTED_ZONE_ID,
    ChangeBatch: {
      Comment: `Create subdomain ${subdomain} for tenant`,
      Changes: [{
        Action: 'CREATE',
        ResourceRecordSet: {
          Name: `${subdomain}.${process.env.PLATFORM_DOMAIN}`,
          Type: 'A',
          AliasTarget: {
            DNSName: process.env.CLOUDFRONT_DOMAIN_NAME,
            EvaluateTargetHealth: false,
            HostedZoneId: 'Z2FDTNDATAQYW2'
          }
        }
      }]
    }
  };
  await route53.send(new ChangeResourceRecordSetsCommand(params));
}

async function createCognitoUser(email, creatorName, password) {
  try {
    // First check if user already exists
    try {
      const existingUser = await cognito.send(new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email
      }));
      
      // User exists - get their sub and add to admins group
      console.log(`User ${email} already exists in Cognito, using existing account`);
      const userId = existingUser.UserAttributes.find(attr => attr.Name === 'sub')?.Value;
      
      // Make sure they're in the admins group
      try {
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: email,
          GroupName: 'admins'
        }));
      } catch (groupError) {
        // Ignore if already in group
        console.log('User may already be in admins group:', groupError.message);
      }
      
      return userId;
    } catch (getUserError) {
      // User doesn't exist - this is expected for new users
      if (getUserError.name !== 'UserNotFoundException') {
        throw getUserError;
      }
    }
    
    // Create new user
    console.log(`Creating new Cognito user: ${email}`);
    const createParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: creatorName }
      ],
      MessageAction: 'SUPPRESS'
    };
    const createResult = await cognito.send(new AdminCreateUserCommand(createParams));
    
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    }));
    
    await cognito.send(new AdminAddUserToGroupCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      GroupName: 'admins'
    }));
    
    return createResult.User.Attributes.find(attr => attr.Name === 'sub')?.Value;
  } catch (error) {
    console.error('Error in createCognitoUser:', error);
    throw error;
  }
}

async function createTenant(tenantData, userId) {
  const tenantId = uuidv4();
  const now = new Date().toISOString();
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANTS_TABLE,
    Item: {
      tenant_id: tenantId,
      subdomain: tenantData.subdomain,
      creator_name: tenantData.creatorName,
      creator_email: tenantData.creatorEmail,
      description: tenantData.description,
      category: tenantData.category,
      status: 'active',
      settings: { theme: 'default', features: ['chat', 'donations', 'subscriptions'] },
      created_at: now,
      updated_at: now,
      created_by: userId
    }
  }));
  await dynamodb.send(new PutCommand({
    TableName: process.env.USER_TENANTS_TABLE,
    Item: {
      user_id: userId,
      tenant_id: tenantId,
      role: 'admin',
      permissions: ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
      joined_at: now,
      invited_by: userId
    }
  }));
  return tenantId;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

const respond = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) });

exports.handler = async (event) => {
  console.log('Tenant Registration Event:', JSON.stringify(event, null, 2));
  const { httpMethod, body, resource } = event;

  if (httpMethod === 'OPTIONS') return respond(200, { message: 'OK' });

  try {
    const data = JSON.parse(body || '{}');
    
    // Route: POST /admin/tenants/send-code
    if (resource === '/admin/tenants/send-code' && httpMethod === 'POST') {
      const { creatorEmail, creatorName, firstName, lastName, phone, subdomain, description, category } = data;
      
      // Support both old format (creatorName) and new format (firstName + lastName)
      const finalCreatorName = creatorName || (firstName && lastName ? `${firstName} ${lastName}` : null);
      const finalDescription = description || `Creator Space von ${finalCreatorName}`;
      
      if (!creatorEmail || !finalCreatorName || !subdomain) {
        return respond(400, { message: 'Alle Pflichtfelder müssen ausgefüllt werden' });
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorEmail)) {
        return respond(400, { message: 'Ungültige E-Mail-Adresse' });
      }
      
      if (!isValidSubdomain(subdomain)) {
        return respond(400, { message: 'Ungültiges Subdomain-Format (3-20 Zeichen, nur Kleinbuchstaben, Zahlen, Bindestriche)' });
      }
      
      if (!(await checkEmailAvailability(creatorEmail))) {
        return respond(409, { message: 'Diese E-Mail-Adresse hat bereits einen Tenant erstellt' });
      }
      if (!(await checkSubdomainAvailability(subdomain))) {
        return respond(409, { message: 'Diese Subdomain ist bereits vergeben' });
      }
      
      const code = generateVerificationCode();
      await storeVerificationCode(creatorEmail, code, { 
        creatorName: finalCreatorName, 
        creatorEmail, 
        subdomain, 
        description: finalDescription, 
        category: category || 'creator',
        phone: phone || null,
        firstName: firstName || null,
        lastName: lastName || null
      });
      await sendVerificationEmail(creatorEmail, code);
      
      return respond(200, { success: true, message: 'Verifizierungscode wurde an Ihre E-Mail gesendet' });
    }
    
    // Route: POST /admin/tenants/verify
    if (resource === '/admin/tenants/verify' && httpMethod === 'POST') {
      const { email, code } = data;
      
      if (!email || !code) {
        return respond(400, { message: 'E-Mail und Verifizierungscode sind erforderlich' });
      }
      
      const verificationData = await getVerificationData(email, code);
      if (!verificationData) {
        return respond(400, { message: 'Ungültiger oder abgelaufener Verifizierungscode' });
      }
      
      const tenantData = verificationData.tenant_data;
      
      if (!(await checkEmailAvailability(tenantData.creatorEmail))) {
        await deleteVerificationCode(email);
        return respond(409, { message: 'Diese E-Mail-Adresse hat bereits einen Tenant erstellt' });
      }
      if (!(await checkSubdomainAvailability(tenantData.subdomain))) {
        await deleteVerificationCode(email);
        return respond(409, { message: 'Diese Subdomain ist bereits vergeben' });
      }
      
      const password = generatePassword();
      const userId = await createCognitoUser(tenantData.creatorEmail, tenantData.creatorName, password);
      const tenantId = await createTenant(tenantData, userId);
      
      // IVS Channel und Chat Room erstellen
      console.log(`Creating IVS resources for tenant: ${tenantId}`);
      const ivsData = await createIVSChannel(tenantId, tenantData.creatorName);
      await createTenantLiveRecord(tenantId, ivsData);
      
      await createTenantS3Structure(tenantId);
      await createSubdomainRecord(tenantData.subdomain);
      await sendWelcomeEmail(tenantData.creatorEmail, tenantData.creatorName, tenantData.subdomain, tenantId, password, ivsData);
      await deleteVerificationCode(email);
      
      return respond(201, {
        success: true,
        message: 'Tenant erfolgreich erstellt! Ihre Zugangsdaten und Livestreaming-Informationen wurden per E-Mail gesendet.',
        tenantId,
        subdomain: tenantData.subdomain,
        url: `https://${tenantData.subdomain}.${process.env.PLATFORM_DOMAIN}`,
        ivsChannel: {
          ingestEndpoint: ivsData.ingestEndpoint,
          playbackUrl: ivsData.playbackUrl
        }
      });
    }
    
    // Route: POST /admin/tenants/resend-code
    if (resource === '/admin/tenants/resend-code' && httpMethod === 'POST') {
      const { email } = data;
      if (!email) return respond(400, { message: 'E-Mail ist erforderlich' });
      
      const existing = await dynamodb.send(new GetCommand({
        TableName: process.env.VERIFICATION_TABLE,
        Key: { email }
      }));
      
      if (!existing.Item) {
        return respond(404, { message: 'Keine ausstehende Verifizierung gefunden. Bitte starten Sie die Registrierung erneut.' });
      }
      
      const code = generateVerificationCode();
      await storeVerificationCode(email, code, existing.Item.tenant_data);
      await sendVerificationEmail(email, code);
      
      return respond(200, { success: true, message: 'Neuer Verifizierungscode wurde gesendet' });
    }
    
    return respond(404, { message: 'Endpoint nicht gefunden' });
    
  } catch (error) {
    console.error('Tenant registration error:', error);
    return respond(500, { message: 'Interner Serverfehler', error: error.message });
  }
};