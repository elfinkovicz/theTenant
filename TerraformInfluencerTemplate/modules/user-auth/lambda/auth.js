const { 
  CognitoIdentityProviderClient, 
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  GetUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");

const cognitoClient = new CognitoIdentityProviderClient();

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;

// CORS Headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Handle OPTIONS preflight
  if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // API Gateway V2 HTTP API format
    const path = event.requestContext?.http?.path || event.path || event.rawPath || '';
    const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || '';
    
    console.log('Path:', path, 'Method:', method);
    
    // Route handling
    if (path.includes('/signup') && method === 'POST') {
      return await handleSignUp(event);
    } else if (path.includes('/signin') && method === 'POST') {
      return await handleSignIn(event);
    } else if (path.includes('/confirm') && method === 'POST') {
      return await handleConfirmSignUp(event);
    } else if (path.includes('/resend-code') && method === 'POST') {
      return await handleResendCode(event);
    } else if (path.includes('/me') && method === 'GET') {
      return await handleGetUser(event);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Route not found',
          path: path,
          method: method,
          debug: {
            requestContext: event.requestContext,
            rawPath: event.rawPath,
            path: event.path
          }
        })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};

// Sign Up
async function handleSignUp(event) {
  try {
    const body = JSON.parse(event.body);
    const { email, username, password } = body;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email und password sind erforderlich' })
      };
    }

    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username ist erforderlich' })
      };
    }

    // Validiere Username
    if (username.length < 3 || username.length > 20) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username muss zwischen 3 und 20 Zeichen lang sein' })
      };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username darf nur Buchstaben, Zahlen und Unterstriche enthalten' })
      };
    }

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email
        },
        {
          Name: 'preferred_username',
          Value: username
        }
      ]
    });

    const response = await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Registrierung erfolgreich',
        userSub: response.UserSub,
        userConfirmed: response.UserConfirmed
      })
    };
  } catch (error) {
    console.error('SignUp error:', error);
    
    let errorMessage = 'Registrierung fehlgeschlagen';
    if (error.name === 'UsernameExistsException') {
      errorMessage = 'Diese E-Mail ist bereits registriert';
    } else if (error.name === 'InvalidPasswordException') {
      errorMessage = 'Passwort erfüllt nicht die Anforderungen (min. 8 Zeichen)';
    } else if (error.name === 'InvalidParameterException') {
      errorMessage = 'Ungültige Parameter';
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.message 
      })
    };
  }
}

// Sign In
async function handleSignIn(event) {
  try {
    const body = JSON.parse(event.body);
    const { email, password } = body;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email und password sind erforderlich' })
      };
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Login fehlgeschlagen' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Login erfolgreich',
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      })
    };
  } catch (error) {
    console.error('SignIn error:', error);
    
    let errorMessage = 'Login fehlgeschlagen';
    if (error.name === 'NotAuthorizedException') {
      errorMessage = 'Falsche E-Mail oder Passwort';
    } else if (error.name === 'UserNotConfirmedException') {
      errorMessage = 'Bitte bestätige zuerst deine E-Mail';
    } else if (error.name === 'UserNotFoundException') {
      errorMessage = 'Benutzer nicht gefunden';
    }

    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.message 
      })
    };
  }
}

// Confirm Sign Up
async function handleConfirmSignUp(event) {
  try {
    const body = JSON.parse(event.body);
    const { email, code } = body;

    if (!email || !code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email und code sind erforderlich' })
      };
    }

    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    });

    await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'E-Mail erfolgreich bestätigt' })
    };
  } catch (error) {
    console.error('ConfirmSignUp error:', error);
    
    let errorMessage = 'Bestätigung fehlgeschlagen';
    if (error.name === 'CodeMismatchException') {
      errorMessage = 'Ungültiger Bestätigungscode';
    } else if (error.name === 'ExpiredCodeException') {
      errorMessage = 'Code ist abgelaufen';
    } else if (error.name === 'NotAuthorizedException') {
      errorMessage = 'Benutzer ist bereits bestätigt';
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.message 
      })
    };
  }
}

// Resend Confirmation Code
async function handleResendCode(event) {
  try {
    const body = JSON.parse(event.body);
    const { email } = body;

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email ist erforderlich' })
      };
    }

    const command = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email
    });

    await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Bestätigungscode wurde erneut gesendet' })
    };
  } catch (error) {
    console.error('ResendCode error:', error);
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Fehler beim Senden des Codes',
        details: error.message 
      })
    };
  }
}

// Get Current User
async function handleGetUser(event) {
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const accessToken = authHeader.substring(7);

    const command = new GetUserCommand({
      AccessToken: accessToken
    });

    const response = await cognitoClient.send(command);

    // Parse user attributes
    const attributes = {};
    response.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        username: attributes.preferred_username || response.Username,
        email: attributes.email,
        sub: attributes.sub,
        emailVerified: attributes.email_verified === 'true',
        attributes
      })
    };
  } catch (error) {
    console.error('GetUser error:', error);
    
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ 
        error: 'Unauthorized',
        details: error.message 
      })
    };
  }
}
