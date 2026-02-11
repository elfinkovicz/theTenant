const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, GetUserCommand, AdminAddUserToGroupCommand, AdminListGroupsForUserCommand, AdminGetUserCommand, ResendConfirmationCodeCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const TENANTS_TABLE = process.env.TENANTS_TABLE || 'viraltenant-tenants-production';
const USER_TENANTS_TABLE = process.env.USER_TENANTS_TABLE || 'viraltenant-user-tenants-production';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

// Response helper
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

// Extract subdomain from origin header
const extractSubdomain = (origin) => {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    // Match patterns like: subdomain.viraltenant.com or subdomain.localhost
    const match = hostname.match(/^([^.]+)\.(?:viraltenant\.com|localhost)/);
    if (match && match[1] !== 'www') {
      return match[1];
    }
  } catch (e) {
    console.error('Error parsing origin:', e);
  }
  return null;
};

// Find tenant by subdomain
const findTenantBySubdomain = async (subdomain) => {
  if (!subdomain) return null;
  
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: { ':subdomain': subdomain }
    }));
    
    if (result.Items && result.Items.length > 0) {
      return result.Items[0];
    }
  } catch (error) {
    console.error('Error finding tenant by subdomain:', error);
  }
  return null;
};

// Check if user is already registered for tenant
const isUserRegisteredForTenant = async (userId, tenantId) => {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    return !!result.Item;
  } catch (error) {
    console.error('Error checking user-tenant registration:', error);
    return false;
  }
};

// Register user for tenant
const registerUserForTenant = async (userId, tenantId, role = 'user') => {
  const now = new Date().toISOString();
  await dynamodb.send(new PutCommand({
    TableName: USER_TENANTS_TABLE,
    Item: {
      user_id: userId,
      tenant_id: tenantId,
      role: role,
      permissions: ['read'],
      joined_at: now,
      created_at: now
    }
  }));
};

// Get existing Cognito user
const getExistingCognitoUser = async (email) => {
  try {
    const result = await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email
    }));
    return result;
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return null;
    }
    throw error;
  }
};

// Error handler
const handleError = (error, defaultMessage = 'Internal server error') => {
  console.error('Error:', error);
  
  const errorName = error.name || error.code;
  if (errorName) {
    switch (errorName) {
      case 'UsernameExistsException':
        return response(400, { error: 'E-Mail-Adresse bereits registriert' });
      case 'InvalidPasswordException':
        return response(400, { error: 'Passwort entspricht nicht den Anforderungen' });
      case 'InvalidParameterException':
        return response(400, { error: 'Ungültige Parameter' });
      case 'CodeMismatchException':
        return response(400, { error: 'Ungültiger Bestätigungscode' });
      case 'ExpiredCodeException':
        return response(400, { error: 'Bestätigungscode ist abgelaufen' });
      case 'NotAuthorizedException':
        return response(401, { error: 'Ungültige Anmeldedaten' });
      case 'UserNotConfirmedException':
        return response(400, { error: 'E-Mail-Adresse noch nicht bestätigt' });
      case 'UserNotFoundException':
        return response(404, { error: 'Benutzer nicht gefunden' });
      case 'TooManyRequestsException':
        return response(429, { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
      default:
        return response(400, { error: error.message || defaultMessage });
    }
  }
  
  return response(500, { error: defaultMessage });
};

// Sign Up - with tenant isolation support
const signUp = async (body, origin, headers = {}) => {
  const { email, username, password, tenantId: bodyTenantId } = body;
  
  if (!email || !username || !password) {
    return response(400, { error: 'E-Mail, Username und Passwort sind erforderlich' });
  }
  
  // Validate username
  if (username.length < 3 || username.length > 20) {
    return response(400, { error: 'Username muss zwischen 3 und 20 Zeichen lang sein' });
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return response(400, { error: 'Username darf nur Buchstaben, Zahlen und Unterstriche enthalten' });
  }
  
  // Get tenant ID from multiple sources (priority: body > header > subdomain)
  const headerTenantId = headers['X-Creator-ID'] || headers['x-creator-id'];
  let tenant = null;
  
  // 1. Try tenant ID from body or header (UUID)
  const explicitTenantId = bodyTenantId || headerTenantId;
  if (explicitTenantId && explicitTenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    try {
      const result = await dynamodb.send(new GetCommand({
        TableName: TENANTS_TABLE,
        Key: { tenant_id: explicitTenantId }
      }));
      if (result.Item) {
        tenant = result.Item;
        console.log(`Tenant found by explicit ID: ${explicitTenantId}`);
      }
    } catch (error) {
      console.error('Error finding tenant by ID:', error);
    }
  }
  
  // 2. Fallback: Extract subdomain from origin
  if (!tenant) {
    const subdomain = extractSubdomain(origin);
    if (subdomain) {
      tenant = await findTenantBySubdomain(subdomain);
      console.log(`Subdomain: ${subdomain}, Tenant found:`, tenant ? tenant.tenant_id : 'none');
    }
  }
  
  try {
    // Check if user already exists in Cognito
    const existingUser = await getExistingCognitoUser(email);
    
    if (existingUser) {
      // User exists - check if they need to be added to this tenant
      const userId = existingUser.Username;
      console.log(`Existing user found: ${userId}`);
      
      if (tenant) {
        // Check if already registered for this tenant
        const alreadyRegistered = await isUserRegisteredForTenant(userId, tenant.tenant_id);
        
        if (alreadyRegistered) {
          return response(400, { 
            error: 'Du bist bereits für diesen Tenant registriert. Bitte melde dich an.',
            existingUser: true,
            tenantRegistered: true
          });
        }
        
        // Register user for this tenant
        await registerUserForTenant(userId, tenant.tenant_id, 'user');
        console.log(`User ${userId} registered for tenant ${tenant.tenant_id}`);
        
        return response(200, {
          message: 'Du wurdest erfolgreich für diesen Tenant registriert. Bitte melde dich mit deinem bestehenden Passwort an.',
          existingUser: true,
          tenantRegistered: true,
          tenantId: tenant.tenant_id,
          subdomain: tenant.subdomain
        });
      } else {
        // No tenant context - user already exists
        return response(400, { 
          error: 'E-Mail-Adresse bereits registriert. Bitte melde dich an.',
          existingUser: true
        });
      }
    }
    
    // New user - create in Cognito
    const result = await cognito.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'custom:username', Value: username }
      ]
    }));
    
    // Add user to default User group
    if (result.UserSub) {
      try {
        await cognito.send(new AdminAddUserToGroupCommand({
          GroupName: 'users',
          UserPoolId: USER_POOL_ID,
          Username: email
        }));
      } catch (groupError) {
        console.warn('Could not add user to group:', groupError);
      }
      
      // Register user for tenant if subdomain was provided
      if (tenant) {
        await registerUserForTenant(result.UserSub, tenant.tenant_id, 'user');
        console.log(`New user ${result.UserSub} registered for tenant ${tenant.tenant_id}`);
      }
    }
    
    return response(200, {
      userSub: result.UserSub,
      userConfirmed: result.UserConfirmed || false,
      message: 'Registrierung erfolgreich. Bitte bestätige deine E-Mail.',
      tenantId: tenant?.tenant_id,
      subdomain: tenant?.subdomain
    });
  } catch (error) {
    return handleError(error, 'Registrierung fehlgeschlagen');
  }
};

// Confirm Sign Up
const confirmSignUp = async (body) => {
  const { email, code } = body;
  
  if (!email || !code) {
    return response(400, { error: 'E-Mail und Bestätigungscode sind erforderlich' });
  }
  
  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    }));
    
    return response(200, { message: 'E-Mail erfolgreich bestätigt' });
  } catch (error) {
    return handleError(error, 'Bestätigung fehlgeschlagen');
  }
};

// Sign In
const signIn = async (body) => {
  const { email, password } = body;
  
  if (!email || !password) {
    return response(400, { error: 'E-Mail und Passwort sind erforderlich' });
  }
  
  try {
    const authResult = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    }));
    
    if (authResult.AuthenticationResult) {
      return response(200, {
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn
      });
    } else {
      return response(400, { error: 'Anmeldung fehlgeschlagen' });
    }
  } catch (error) {
    return handleError(error, 'Anmeldung fehlgeschlagen');
  }
};

// Get Current User
const getCurrentUser = async (accessToken) => {
  if (!accessToken) {
    return response(401, { error: 'Access Token erforderlich' });
  }
  
  try {
    const userResult = await cognito.send(new GetUserCommand({
      AccessToken: accessToken
    }));
    
    // Extract user attributes
    const attributes = {};
    userResult.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });
    
    // Get user groups
    let groups = [];
    try {
      const groupsResult = await cognito.send(new AdminListGroupsForUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userResult.Username
      }));
      groups = groupsResult.Groups.map(group => group.GroupName);
    } catch (groupError) {
      console.warn('Could not get user groups:', groupError);
    }
    
    return response(200, {
      username: attributes['custom:username'] || userResult.Username,
      email: attributes.email,
      sub: attributes.sub,
      emailVerified: attributes.email_verified === 'true',
      groups: groups
    });
  } catch (error) {
    return handleError(error, 'Benutzerinformationen konnten nicht abgerufen werden');
  }
};

// Resend Confirmation Code
const resendConfirmationCode = async (body) => {
  const { email } = body;
  
  if (!email) {
    return response(400, { error: 'E-Mail ist erforderlich' });
  }
  
  try {
    await cognito.send(new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email
    }));
    
    return response(200, { message: 'Bestätigungscode wurde erneut gesendet' });
  } catch (error) {
    return handleError(error, 'Fehler beim Senden des Codes');
  }
};

// Forgot Password
const forgotPassword = async (body) => {
  const { email } = body;
  
  if (!email) {
    return response(400, { error: 'E-Mail ist erforderlich' });
  }
  
  try {
    await cognito.send(new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email
    }));
    
    return response(200, { message: 'Reset-Code wurde an deine E-Mail gesendet' });
  } catch (error) {
    return handleError(error, 'Fehler beim Senden des Reset-Codes');
  }
};

// Confirm Forgot Password
const confirmForgotPassword = async (body) => {
  const { email, code, newPassword } = body;
  
  if (!email || !code || !newPassword) {
    return response(400, { error: 'E-Mail, Code und neues Passwort sind erforderlich' });
  }
  
  try {
    await cognito.send(new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword
    }));
    
    return response(200, { message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (error) {
    return handleError(error, 'Fehler beim Zurücksetzen des Passworts');
  }
};

// Refresh Token - erneuert Access Token mit Refresh Token
const refreshToken = async (body) => {
  const { refreshToken } = body;
  
  if (!refreshToken) {
    return response(400, { error: 'Refresh Token ist erforderlich' });
  }
  
  try {
    const authResult = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    }));
    
    if (authResult.AuthenticationResult) {
      return response(200, {
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn
      });
    } else {
      return response(400, { error: 'Token refresh fehlgeschlagen' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    // Bei ungültigem Refresh Token -> User muss sich neu einloggen
    if (error.name === 'NotAuthorizedException') {
      return response(401, { error: 'Refresh Token ungültig oder abgelaufen. Bitte erneut anmelden.' });
    }
    return handleError(error, 'Token refresh fehlgeschlagen');
  }
};

// Main handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, { message: 'CORS preflight' });
  }
  
  try {
    const path = event.path;
    const method = event.httpMethod;
    const origin = event.headers?.origin || event.headers?.Origin;
    
    // Decode Base64-encoded body if necessary
    let rawBody = event.body || '{}';
    if (event.isBase64Encoded && event.body) {
      rawBody = Buffer.from(event.body, 'base64').toString('utf-8');
    }
    const body = JSON.parse(rawBody);
    
    // Extract access token from Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');
    
    // Route requests
    if (method === 'POST') {
      switch (path) {
        case '/api/signup':
          return await signUp(body, origin, event.headers || {});
        case '/api/signin':
          return await signIn(body);
        case '/api/confirm':
          return await confirmSignUp(body);
        case '/api/resend-code':
          return await resendConfirmationCode(body);
        case '/api/forgot-password':
          return await forgotPassword(body);
        case '/api/confirm-forgot-password':
          return await confirmForgotPassword(body);
        case '/api/refresh':
          return await refreshToken(body);
        default:
          return response(404, { error: 'Endpoint nicht gefunden' });
      }
    } else if (method === 'GET' && path === '/me') {
      return await getCurrentUser(accessToken);
    }
    
    return response(404, { error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('Handler error:', error);
    return response(500, { error: 'Interner Serverfehler' });
  }
};
