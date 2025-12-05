const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const Stripe = require('stripe');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

let stripe;
let webhookSecret;

async function getStripeConfig() {
  if (!stripe) {
    const secret = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.STRIPE_SECRET_ARN })
    );
    const config = JSON.parse(secret.SecretString);
    stripe = new Stripe(config.secret_key);
    webhookSecret = config.webhook_secret;
  }
  return { stripe, webhookSecret };
}

exports.handler = async (event) => {
  console.log('Webhook received');

  try {
    const { stripe, webhookSecret } = await getStripeConfig();

    // Verify webhook signature
    const sig = event.headers['Stripe-Signature'] || event.headers['stripe-signature'];
    
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Webhook signature verification failed' })
      };
    }

    console.log('Event type:', stripeEvent.type);

    // Handle different event types
    switch (stripeEvent.type) {
      case 'invoice.paid':
        await handleInvoicePaid(stripeEvent.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripeEvent.data.object);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(stripeEvent.data.object);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(stripeEvent.data.object);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(stripeEvent.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleInvoicePaid(invoice) {
  console.log('Invoice paid:', invoice.id);

  const userId = invoice.metadata?.userId;
  const invoiceId = invoice.metadata?.invoiceId;

  if (!userId || !invoiceId) {
    console.warn('Missing userId or invoiceId in invoice metadata');
    return;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: process.env.BILLING_TABLE_NAME,
      Key: { userId, invoiceId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, paidAt = :paidAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'paid',
        ':updatedAt': Date.now(),
        ':paidAt': Date.now()
      }
    })
  );

  console.log(`Invoice ${invoiceId} marked as paid`);
}

async function handleInvoicePaymentFailed(invoice) {
  console.log('Invoice payment failed:', invoice.id);

  const userId = invoice.metadata?.userId;
  const invoiceId = invoice.metadata?.invoiceId;

  if (!userId || !invoiceId) {
    console.warn('Missing userId or invoiceId in invoice metadata');
    return;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: process.env.BILLING_TABLE_NAME,
      Key: { userId, invoiceId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, failureReason = :reason',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'payment_failed',
        ':updatedAt': Date.now(),
        ':reason': invoice.last_payment_error?.message || 'Unknown error'
      }
    })
  );

  console.log(`Invoice ${invoiceId} marked as payment_failed`);
}

async function handleCustomerUpdated(customer) {
  console.log('Customer updated:', customer.id);

  const userId = customer.metadata?.userId;
  if (!userId) {
    console.warn('Missing userId in customer metadata');
    return;
  }

  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

  await docClient.send(
    new UpdateCommand({
      TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
      Key: { userId },
      UpdateExpression: 'SET defaultPaymentMethod = :pm, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':pm': defaultPaymentMethod || null,
        ':updatedAt': Date.now()
      }
    })
  );

  console.log(`Customer ${userId} payment method updated`);
}

async function handleSetupIntentSucceeded(setupIntent) {
  console.log('SetupIntent succeeded:', setupIntent.id);

  const userId = setupIntent.metadata?.userId;
  const paymentMethod = setupIntent.payment_method;

  if (!userId || !paymentMethod) {
    console.warn('Missing userId or payment_method');
    return;
  }

  // Get payment method details
  const { stripe } = await getStripeConfig();
  const pm = await stripe.paymentMethods.retrieve(paymentMethod);

  await docClient.send(
    new UpdateCommand({
      TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
      Key: { userId },
      UpdateExpression: 'SET paymentMethod = :pm, paymentMethodType = :type, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':pm': paymentMethod,
        ':type': pm.type,
        ':updatedAt': Date.now()
      }
    })
  );

  console.log(`Payment method ${paymentMethod} saved for user ${userId}`);
}

async function handlePaymentMethodAttached(paymentMethod) {
  console.log('Payment method attached:', paymentMethod.id);
  
  const customerId = paymentMethod.customer;
  if (!customerId) return;

  // Get customer to find userId
  const { stripe } = await getStripeConfig();
  const customer = await stripe.customers.retrieve(customerId);
  const userId = customer.metadata?.userId;

  if (!userId) {
    console.warn('Missing userId in customer metadata');
    return;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: process.env.PAYMENT_METHODS_TABLE_NAME,
      Key: { userId },
      UpdateExpression: 'SET paymentMethod = :pm, paymentMethodType = :type, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':pm': paymentMethod.id,
        ':type': paymentMethod.type,
        ':updatedAt': Date.now()
      }
    })
  );

  console.log(`Payment method ${paymentMethod.id} attached for user ${userId}`);
}
