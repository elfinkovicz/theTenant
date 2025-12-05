const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const Stripe = require('stripe');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const ceClient = new CostExplorerClient({});
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

// Service-Namen in generische Kategorien umwandeln
function categorizeService(serviceName) {
  const categories = {
    // Streaming
    'AWS Elemental MediaLive': 'Streaming',
    'Amazon Interactive Video Service': 'Streaming',
    'AWS Elemental MediaPackage': 'Streaming',
    'AWS Elemental MediaConvert': 'Streaming',
    
    // Storage
    'Amazon Simple Storage Service': 'Speicher',
    'Amazon Elastic File System': 'Speicher',
    
    // Database
    'Amazon DynamoDB': 'Datenbank',
    'Amazon RDS': 'Datenbank',
    'Amazon ElastiCache': 'Datenbank',
    
    // Compute
    'AWS Lambda': 'Serverless Computing',
    'Amazon Elastic Compute Cloud': 'Computing',
    'AWS Fargate': 'Computing',
    
    // Networking
    'Amazon CloudFront': 'Content Delivery',
    'Amazon Route 53': 'DNS & Routing',
    'Amazon API Gateway': 'API Management',
    'Elastic Load Balancing': 'Load Balancing',
    'Amazon Virtual Private Cloud': 'Netzwerk',
    
    // Messaging
    'Amazon Simple Notification Service': 'Messaging',
    'Amazon Simple Queue Service': 'Messaging',
    'Amazon Simple Email Service': 'E-Mail Service',
    
    // Security & Identity
    'AWS Key Management Service': 'Sicherheit',
    'AWS Secrets Manager': 'Sicherheit',
    'Amazon Cognito': 'Authentifizierung',
    'AWS Certificate Manager': 'Zertifikate',
    
    // Monitoring
    'Amazon CloudWatch': 'Monitoring',
    'AWS X-Ray': 'Monitoring',
    
    // Other
    'AWS Cost Explorer': 'Kostenanalyse',
    'AWS Support': 'Support'
  };
  
  return categories[serviceName] || 'Infrastruktur';
}

// AWS Kosten für letzten Monat abrufen
async function getMonthlyAWSCosts() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const startDate = lastMonth.toISOString().split('T')[0];
  const endDate = thisMonth.toISOString().split('T')[0];

  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: startDate,
      End: endDate
    },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE'
      }
    ]
  });

  const response = await ceClient.send(command);
  
  let totalCost = 0;
  const breakdown = {};

  if (response.ResultsByTime && response.ResultsByTime.length > 0) {
    const results = response.ResultsByTime[0];
    
    for (const group of results.Groups || []) {
      const service = group.Keys[0];
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      
      if (cost > 0) {
        // Verwende kategorisierten Namen
        const category = categorizeService(service);
        breakdown[category] = (breakdown[category] || 0) + cost;
        totalCost += cost;
      }
    }
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown,
    period: {
      start: startDate,
      end: endDate
    }
  };
}

// Stripe Customer erstellen oder abrufen
async function getOrCreateStripeCustomer(userId, email) {
  const stripe = await getStripeClient();
  
  // Check if customer exists in DynamoDB
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
      Key: { userId }
    })
  );

  if (result.Item && result.Item.stripeCustomerId) {
    return result.Item.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  });

  // Save to DynamoDB
  await docClient.send(
    new PutCommand({
      TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
      Item: {
        userId,
        stripeCustomerId: customer.id,
        email,
        createdAt: Date.now()
      }
    })
  );

  return customer.id;
}

// Invoice erstellen und Zahlung einziehen
async function createAndChargeInvoice(userId, email, awsCosts) {
  const stripe = await getStripeClient();
  const customerId = await getOrCreateStripeCustomer(userId, email);

  const baseFee = parseFloat(process.env.BASE_FEE || '20');
  const totalAmount = baseFee + awsCosts.totalCost;
  const amountInCents = Math.round(totalAmount * 100);

  const invoiceId = `inv_${Date.now()}_${userId}`;

  // Create Invoice Items
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: Math.round(baseFee * 100),
    currency: 'eur',
    description: 'Monatliche Grundgebühr'
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: Math.round(awsCosts.totalCost * 100),
    currency: 'eur',
    description: `Infrastrukturkosten (${awsCosts.period.start} - ${awsCosts.period.end})`
  });

  // Create Invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: 'charge_automatically',
    metadata: {
      userId,
      invoiceId,
      baseFee: baseFee.toString(),
      awsCosts: awsCosts.totalCost.toString()
    }
  });

  // Finalize and pay invoice
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  
  // Save to DynamoDB
  await docClient.send(
    new PutCommand({
      TableName: process.env.BILLING_TABLE_NAME,
      Item: {
        userId,
        invoiceId,
        stripeInvoiceId: finalizedInvoice.id,
        amount: totalAmount,
        baseFee,
        awsCosts: awsCosts.totalCost,
        awsBreakdown: awsCosts.breakdown,
        period: awsCosts.period,
        status: finalizedInvoice.status,
        currency: 'EUR',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    })
  );

  return {
    invoiceId,
    stripeInvoiceId: finalizedInvoice.id,
    amount: totalAmount,
    status: finalizedInvoice.status,
    hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
  };
}

// Get user invoices
async function getUserInvoices(userId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.BILLING_TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false,
      Limit: 12
    })
  );

  return result.Items || [];
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // EventBridge Scheduler Event
    if (event.action === 'calculate_and_invoice') {
      console.log('Running monthly billing calculation...');
      
      const awsCosts = await getMonthlyAWSCosts();
      console.log('AWS Costs:', awsCosts);

      // TODO: Get admin user from Cognito
      // For now, we'll skip automatic charging
      // In production, you'd query Cognito for admin users
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Monthly costs calculated',
          costs: awsCosts
        })
      };
    }

    // API Gateway Event
    const httpMethod = event.requestContext?.http?.method || event.httpMethod;
    const path = event.requestContext?.http?.path || event.path;
    
    // API Gateway v2 (HTTP API) with JWT authorizer
    // Claims are in event.requestContext.authorizer.claims (not .jwt.claims)
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims?.sub;
    const email = claims?.email || claims?.username;

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

    // GET /billing - Get invoices
    if (httpMethod === 'GET' && path.includes('/billing')) {
      const invoices = await getUserInvoices(userId);
      
      // Get current month costs preview
      const awsCosts = await getMonthlyAWSCosts();
      const baseFee = parseFloat(process.env.BASE_FEE || '20');
      const estimatedTotal = baseFee + awsCosts.totalCost;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          invoices,
          currentMonth: {
            baseFee,
            awsCosts: awsCosts.totalCost,
            awsBreakdown: awsCosts.breakdown,
            estimatedTotal,
            period: awsCosts.period
          }
        })
      };
    }

    // POST /billing/charge - Manual charge (admin only)
    if (httpMethod === 'POST' && path.includes('/billing/charge')) {
      const awsCosts = await getMonthlyAWSCosts();
      const result = await createAndChargeInvoice(userId, email, awsCosts);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not found' })
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
