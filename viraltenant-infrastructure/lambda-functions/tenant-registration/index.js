const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminGetUserCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const ses = new SESClient({ region: process.env.REGION });

// Generate a random 6-digit code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store verification code temporarily (in DynamoDB with TTL)
async function storeVerificationCode(email, code, tenantData = {}) {
  const params = {
    TableName: process.env.VERIFICATION_CODES_TABLE,
    Item: {
      email,
      code,
      firstName: tenantData.firstName || '',
      lastName: tenantData.lastName || '',
      phone: tenantData.phone || '',
      subdomain: tenantData.subdomain || '',
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour TTL
    }
  };

  try {
    await dynamodb.send(new PutCommand(params));
  } catch (error) {
    console.error('Error storing verification code:', error);
    throw new Error('Fehler beim Speichern des Verifizierungscodes');
  }
}

// Check if subdomain is already taken
async function checkSubdomainAvailable(subdomain) {
  if (!subdomain) {
    return true; // Subdomain is optional
  }

  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: { ':subdomain': subdomain }
    }));
    
    if (result.Items && result.Items.length > 0) {
      throw new Error(`Subdomain "${subdomain}" ist bereits vergeben`);
    }
    
    return true;
  } catch (error) {
    if (error.message.includes('ist bereits vergeben')) {
      throw error;
    }
    console.error('Error checking subdomain:', error);
    throw new Error('Fehler bei der Subdomain-Prüfung');
  }
}

// Check if email is already registered in Cognito - returns user if exists, null if not
async function getExistingUser(email) {
  try {
    const result = await cognito.send(new AdminGetUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email
    }));
    console.log('Existing user found:', result.Username);
    return result.Username; // Return the userId
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return null; // User doesn't exist
    }
    console.error('Error checking email:', error);
    throw new Error('Fehler bei der E-Mail-Prüfung');
  }
}

// Check if user has reached tenant limit (max 3 tenants as admin)
async function checkUserTenantLimit(userId, maxTenants = 3) {
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      IndexName: 'user-role-index',
      KeyConditionExpression: 'user_id = :userId AND #role = :role',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { 
        ':userId': userId,
        ':role': 'admin'
      }
    }));
    
    const adminTenantCount = result.Items ? result.Items.length : 0;
    
    if (adminTenantCount >= maxTenants) {
      throw new Error(`Sie können maximal ${maxTenants} Tenants als Admin verwalten. Sie sind bereits Admin von ${adminTenantCount} Tenants.`);
    }
    
    return true;
  } catch (error) {
    if (error.message.includes('maximal')) {
      throw error;
    }
    console.error('Error checking tenant limit:', error);
    throw new Error('Fehler bei der Tenant-Limit-Prüfung');
  }
}

// Verify code and get stored tenant data
async function verifyCodeAndGetTenantData(email, code) {
  // Get verification code from DynamoDB
  const codeParams = {
    TableName: process.env.VERIFICATION_CODES_TABLE,
    Key: { email }
  };

  try {
    const codeResult = await dynamodb.send(new GetCommand(codeParams));
    
    if (!codeResult.Item || codeResult.Item.code !== code) {
      throw new Error('Ungültiger oder abgelaufener Code');
    }

    // Code is valid, return stored tenant data
    return {
      valid: true,
      firstName: codeResult.Item.firstName || '',
      lastName: codeResult.Item.lastName || '',
      phone: codeResult.Item.phone || '',
      subdomain: codeResult.Item.subdomain || ''
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    throw new Error('Fehler bei der Verifizierung');
  }
}

// Create tenant in DynamoDB
async function createTenant(tenantData) {
  const tenantId = crypto.randomUUID();
  
  const params = {
    TableName: process.env.TENANTS_TABLE,
    Item: {
      tenant_id: tenantId,
      creator_name: `${tenantData.firstName} ${tenantData.lastName}`,
      creator_email: tenantData.creatorEmail,
      first_name: tenantData.firstName || '',
      last_name: tenantData.lastName || '',
      phone: tenantData.phone || '',
      subdomain: tenantData.subdomain || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };

  try {
    await dynamodb.send(new PutCommand(params));
    return tenantId;
  } catch (error) {
    console.error('Error creating tenant:', error);
    throw new Error('Fehler beim Erstellen des Tenants');
  }
}

// Create user in Cognito
async function createCognitoUser(email, password) {
  const params = {
    UserPoolId: process.env.USER_POOL_ID,
    Username: email,
    TemporaryPassword: password,
    MessageAction: 'SUPPRESS'
  };

  try {
    const result = await cognito.send(new AdminCreateUserCommand(params));
    const userId = result.User.Username;

    // Set permanent password
    const passwordParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId,
      Password: password,
      Permanent: true
    };

    await cognito.send(new AdminSetUserPasswordCommand(passwordParams));
    return userId;
  } catch (error) {
    console.error('Error creating Cognito user:', error);
    throw new Error('Fehler beim Erstellen des Benutzerkontos');
  }
}

// Link user to tenant in DynamoDB
async function linkUserToTenant(userId, tenantId, role = 'admin') {
  const params = {
    TableName: process.env.USER_TENANTS_TABLE,
    Item: {
      user_id: userId,
      tenant_id: tenantId,
      role: role,
      permissions: ['read', 'write', 'delete'],
      created_at: new Date().toISOString(),
      joined_at: new Date().toISOString()
    }
  };

  try {
    console.log('Linking user to tenant:', { userId, tenantId, role });
    await dynamodb.send(new PutCommand(params));
    console.log('Successfully linked user to tenant');
  } catch (error) {
    console.error('Error linking user to tenant:', error);
    throw new Error('Fehler beim Verknüpfen des Benutzers mit dem Tenant');
  }
}

// Delete Cognito user (for cleanup on error)
async function deleteCognitoUser(email) {
  try {
    await cognito.send(new AdminDeleteUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email
    }));
    console.log('Cognito user deleted:', email);
  } catch (error) {
    console.error('Error deleting Cognito user:', error);
    // Don't throw - this is cleanup
  }
}

// Send email with login credentials
async function sendLoginEmail(email, password, tenantId, subdomain) {
  const loginUrl = subdomain ? `https://${subdomain}.viraltenant.com/login` : 'https://viraltenant.com/login';
  
  console.log('Sending login email to:', email, 'with URL:', loginUrl);
  
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Willkommen bei ViralTenant - Ihre Login-Daten'
      },
      Body: {
        Html: {
          Data: `
            <h2>Willkommen bei ViralTenant!</h2>
            <p>Ihr Tenant wurde erfolgreich erstellt.</p>
            <h3>Login-Daten:</h3>
            <p><strong>E-Mail:</strong> ${email}</p>
            <p><strong>Passwort:</strong> ${password}</p>
            <p><strong>Login-URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
            <p>Bitte ändern Sie Ihr Passwort nach dem ersten Login.</p>
          `
        }
      }
    }
  };

  try {
    const result = await ses.send(new SendEmailCommand(params));
    console.log('Login email sent successfully:', result.MessageId);
  } catch (error) {
    console.error('Error sending login email:', error);
    // Don't throw - email failure shouldn't block tenant creation
  }
}

// Send notification email for existing users about new tenant
async function sendNewTenantNotification(email, tenantId, subdomain) {
  const tenantUrl = subdomain ? `https://${subdomain}.viraltenant.com` : 'https://viraltenant.com';
  
  console.log('Sending new tenant notification to:', email);
  
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Neuer Tenant erstellt - ViralTenant'
      },
      Body: {
        Html: {
          Data: `
            <h2>Neuer Tenant erstellt!</h2>
            <p>Ein neuer Tenant wurde Ihrem Konto hinzugefügt.</p>
            <h3>Tenant-Informationen:</h3>
            <p><strong>Tenant-ID:</strong> ${tenantId}</p>
            <p><strong>URL:</strong> <a href="${tenantUrl}">${tenantUrl}</a></p>
            <p>Sie können sich mit Ihren bestehenden Zugangsdaten einloggen und den neuen Tenant im Tenant-Wechsler auswählen.</p>
          `
        }
      }
    }
  };

  try {
    const result = await ses.send(new SendEmailCommand(params));
    console.log('New tenant notification sent successfully:', result.MessageId);
  } catch (error) {
    console.error('Error sending new tenant notification:', error);
    // Don't throw - email failure shouldn't block tenant creation
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path, body } = event;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  try {
    // Send verification code
    if (httpMethod === 'POST' && path.includes('/send-code')) {
      const data = JSON.parse(body || '{}');
      const { creatorEmail, firstName, lastName, phone, subdomain } = data;

      if (!creatorEmail) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'E-Mail erforderlich' })
        };
      }

      const code = generateVerificationCode();
      await storeVerificationCode(creatorEmail, code, { firstName, lastName, phone, subdomain });

      // Send email with code
      const emailParams = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [creatorEmail] },
        Message: {
          Subject: { Data: 'ViralTenant - Verifizierungscode' },
          Body: {
            Html: {
              Data: `<h2>Ihr Verifizierungscode:</h2><p style="font-size: 24px; font-weight: bold;">${code}</p><p>Dieser Code ist 1 Stunde gültig.</p>`
            }
          }
        }
      };

      try {
        console.log('Sending verification email to:', creatorEmail);
        const result = await ses.send(new SendEmailCommand(emailParams));
        console.log('Verification email sent successfully, MessageId:', result.MessageId);
      } catch (error) {
        console.error('Error sending verification email:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Senden der E-Mail' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Verifizierungscode gesendet', code: process.env.NODE_ENV === 'development' ? code : undefined })
      };
    }

    // Verify code and create tenant
    if (httpMethod === 'POST' && path.includes('/verify')) {
      const data = JSON.parse(body || '{}');
      const { email, code } = data;

      if (!email || !code) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'E-Mail und Code erforderlich' })
        };
      }

    // Verify code and get stored tenant data
      const tenantData = await verifyCodeAndGetTenantData(email, code);
      const { firstName, lastName, phone, subdomain } = tenantData;

      console.log('Creating tenant with data:', { email, firstName, lastName, phone, subdomain });

      // 1. Check if subdomain is available
      if (subdomain) {
        await checkSubdomainAvailable(subdomain);
      }

      // 2. Check if user already exists
      const existingUserId = await getExistingUser(email);
      let userId;
      let tempPassword = null;
      let isNewUser = false;

      if (existingUserId) {
        // User exists - use existing user
        userId = existingUserId;
        console.log('Using existing user:', userId);
        
        // Check tenant limit for existing user
        await checkUserTenantLimit(userId, 3);
      } else {
        // New user - create Cognito user
        isNewUser = true;
        tempPassword = crypto.randomBytes(12).toString('hex');
        userId = await createCognitoUser(email, tempPassword);
        console.log('Created new user:', userId);
        
        try {
          await checkUserTenantLimit(userId, 3);
        } catch (error) {
          console.error('Tenant limit check failed, cleaning up:', error);
          await deleteCognitoUser(email);
          throw error;
        }
      }

      // Create tenant
      const tenantId = await createTenant({
        firstName,
        lastName,
        phone,
        creatorEmail: email,
        subdomain
      });

      // Link user to tenant as admin
      await linkUserToTenant(userId, tenantId, 'admin');

      // Send appropriate email
      if (isNewUser) {
        // New user - send login credentials
        await sendLoginEmail(email, tempPassword, tenantId, subdomain);
      } else {
        // Existing user - send notification about new tenant
        await sendNewTenantNotification(email, tenantId, subdomain);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Tenant erfolgreich erstellt',
          tenantId,
          subdomain: subdomain || 'Keine Subdomain konfiguriert',
          url: subdomain ? `https://${subdomain}.viraltenant.com` : 'https://viraltenant.com'
        })
      };
    }

    // Resend verification code
    if (httpMethod === 'POST' && path.includes('/resend-code')) {
      const data = JSON.parse(body || '{}');
      const { email } = data;

      if (!email) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'E-Mail erforderlich' })
        };
      }

      const code = generateVerificationCode();
      await storeVerificationCode(email, code);

      const emailParams = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'ViralTenant - Neuer Verifizierungscode' },
          Body: {
            Html: {
              Data: `<h2>Ihr neuer Verifizierungscode:</h2><p style="font-size: 24px; font-weight: bold;">${code}</p><p>Dieser Code ist 1 Stunde gültig.</p>`
            }
          }
        }
      };

      try {
        await ses.send(new SendEmailCommand(emailParams));
      } catch (error) {
        console.error('Error sending verification email:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Fehler beim Senden der E-Mail' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Neuer Code gesendet' })
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
        message: error.message || 'Interner Serverfehler'
      })
    };
  }
};
