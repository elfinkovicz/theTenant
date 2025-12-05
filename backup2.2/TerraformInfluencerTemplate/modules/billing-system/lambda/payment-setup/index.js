const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const Stripe = require('stripe');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

let stripe;

async function getStripeClient() {
  if (!stripe) {
    const secret = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.STRIPE_SECRET_ARN })
    );
    const { secret_key } = JSON.parse(secret.SecretString);
    stripe = new Stripe(secret_key);
  }
  return stripe;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  
  // API Gateway v2 (HTTP API) with JWT authorizer
  // Claims are in event.requestContext.authorizer.claims (not .jwt.claims)
  const claims = event.requestContext?.authorizer?.claims;
  const userId = claims?.sub;
  
  if (!userId) {
    console.error('No userId found in claims:', JSON.stringify(event.requestContext, null, 2));
    return {
      statusCode: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  // Get email from Cognito if not in token
  let email = claims?.email;
  if (!email || !email.includes('@')) {
    // Fetch user from Cognito to get email
    const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
    const cognitoClient = new CognitoIdentityProviderClient({});
    
    try {
      const userResponse = await cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: userId
        })
      );
      
      const emailAttr = userResponse.UserAttributes?.find(attr => attr.Name === 'email');
      email = emailAttr?.Value;
      
      if (!email) {
        console.error('No email found for user:', userId);
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'User email not found' })
        };
      }
    } catch (error) {
      console.error('Error fetching user from Cognito:', error);
      return {
        statusCode: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Failed to fetch user information' })
      };
    }
  }

  try {
    const stripe = await getStripeClient();

    // POST /billing/setup-intent - Create SetupIntent
    if (httpMethod === 'POST') {
      // Get or create Stripe customer
      let customerId;
      
      const result = await docClient.send(
        new GetCommand({
          TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
          Key: { userId }
        })
      );

      if (result.Item && result.Item.stripeCustomerId) {
        customerId = result.Item.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email,
          metadata: { userId }
        });
        customerId = customer.id;

        await docClient.send(
          new PutCommand({
            TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
            Item: {
              userId,
              stripeCustomerId: customerId,
              email,
              createdAt: Date.now()
            }
          })
        );
      }

      // Create SetupIntent
      // automatic_payment_methods: Stripe zeigt automatisch alle aktivierten Zahlungsmethoden an
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'always'
        },
        metadata: { userId }
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          clientSecret: setupIntent.client_secret,
          customerId
        })
      };
    }

    // GET /billing/setup-intent - Get payment method status
    if (httpMethod === 'GET') {
      const result = await docClient.send(
        new GetCommand({
          TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
          Key: { userId }
        })
      );

      if (!result.Item) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            hasPaymentMethod: false
          })
        };
      }

      const customerId = result.Item.stripeCustomerId;
      const customer = await stripe.customers.retrieve(customerId);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          hasPaymentMethod: !!customer.invoice_settings?.default_payment_method,
          paymentMethod: result.Item.paymentMethod || null
        })
      };
    }

    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
