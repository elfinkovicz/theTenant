/**
 * Stripe Webhook Handler for Tenant Billing
 * 
 * Handles Stripe events for:
 * - Subscription lifecycle (created, updated, deleted)
 * - Invoice events (paid, payment_failed)
 * - Payment method updates
 * 
 * TENANT ISOLATION: Each webhook event is validated against tenant metadata
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({ region: process.env.REGION || 'eu-central-1' });

const BILLING_TABLE = process.env.BILLING_TABLE;
const INVOICES_TABLE = process.env.INVOICES_TABLE;
const TENANTS_TABLE = process.env.TENANTS_TABLE;
const STRIPE_SECRET_ID = process.env.STRIPE_SECRET_ID;

let stripeSecrets = null;
let stripe = null;

// Load Stripe secrets from Secrets Manager
async function loadStripeSecrets() {
  if (stripeSecrets) return stripeSecrets;
  
  const response = await secretsClient.send(new GetSecretValueCommand({
    SecretId: STRIPE_SECRET_ID
  }));
  
  stripeSecrets = JSON.parse(response.SecretString);
  stripe = require('stripe')(stripeSecrets.secret_key);
  return stripeSecrets;
}

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

exports.handler = async (event) => {
  console.log('Stripe Webhook Event received');
  
  try {
    await loadStripeSecrets();
    
    const sig = event.headers['Stripe-Signature'] || event.headers['stripe-signature'];
    const body = event.body;

    // Verify webhook signature
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(body, sig, stripeSecrets.webhook_secret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Webhook signature verification failed' })
      };
    }

    console.log('Stripe Event Type:', stripeEvent.type);
    console.log('Stripe Event Data:', JSON.stringify(stripeEvent.data.object, null, 2));

    // Handle different event types
    switch (stripeEvent.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;
      
      case 'invoice.paid':
        await handleInvoicePaid(stripeEvent.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripeEvent.data.object);
        break;
      
      case 'payment_method.attached':
        await handlePaymentMethodAttached(stripeEvent.data.object);
        break;
      
      case 'payment_method.detached':
        await handlePaymentMethodDetached(stripeEvent.data.object);
        break;
      
      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(stripeEvent.data.object);
        break;
      
      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Webhook handler failed' })
    };
  }
};

// Get tenant ID from Stripe customer metadata
async function getTenantIdFromCustomer(customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.metadata?.tenantId || null;
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) {
    console.error('No tenantId found for customer:', subscription.customer);
    return;
  }

  console.log('Subscription created for tenant:', tenantId);

  // Update billing record
  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: 'SET stripe_subscription_id = :subId, stripe_subscription_status = :status, subscription_current_period_end = :periodEnd, updated_at = :now',
    ExpressionAttributeValues: {
      ':subId': subscription.id,
      ':status': subscription.status,
      ':periodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
      ':now': new Date().toISOString()
    }
  }));

  // Update tenant status to active
  await docClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET billing_status = :status, updated_at = :now',
    ExpressionAttributeValues: {
      ':status': 'active',
      ':now': new Date().toISOString()
    }
  }));
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) return;

  console.log('Subscription updated for tenant:', tenantId, 'Status:', subscription.status);

  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: 'SET stripe_subscription_status = :status, subscription_current_period_end = :periodEnd, updated_at = :now',
    ExpressionAttributeValues: {
      ':status': subscription.status,
      ':periodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
      ':now': new Date().toISOString()
    }
  }));

  // Handle subscription status changes
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: 'SET billing_status = :status, status_reason = :reason, updated_at = :now',
      ExpressionAttributeValues: {
        ':status': 'payment_overdue',
        ':reason': 'Zahlung überfällig',
        ':now': new Date().toISOString()
      }
    }));
  }
}

// Handle subscription deleted/cancelled
async function handleSubscriptionDeleted(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) return;

  console.log('Subscription deleted for tenant:', tenantId);

  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: 'SET stripe_subscription_status = :status, subscription_cancelled_at = :now, updated_at = :now',
    ExpressionAttributeValues: {
      ':status': 'cancelled',
      ':now': new Date().toISOString()
    }
  }));

  // Suspend tenant after grace period (handled by cron)
  await docClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET billing_status = :status, status_reason = :reason, updated_at = :now',
    ExpressionAttributeValues: {
      ':status': 'subscription_cancelled',
      ':reason': 'Abonnement gekündigt',
      ':now': new Date().toISOString()
    }
  }));
}

// Handle invoice paid
async function handleInvoicePaid(invoice) {
  const tenantId = await getTenantIdFromCustomer(invoice.customer);
  if (!tenantId) return;

  console.log('Invoice paid for tenant:', tenantId, 'Amount:', invoice.amount_paid);

  // Create invoice record in our system
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await docClient.send(new PutCommand({
    TableName: INVOICES_TABLE,
    Item: {
      invoice_id: invoiceId,
      user_id: tenantId,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number,
      amount: invoice.amount_paid / 100, // Convert from cents
      base_fee: 30,
      aws_costs: (invoice.amount_paid / 100) - 30,
      status: 'paid',
      period: {
        start: new Date(invoice.period_start * 1000).toISOString(),
        end: new Date(invoice.period_end * 1000).toISOString()
      },
      created_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      stripe_hosted_invoice_url: invoice.hosted_invoice_url,
      stripe_invoice_pdf: invoice.invoice_pdf
    }
  }));

  // Update tenant billing status
  await docClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET billing_status = :status, last_payment_at = :now, updated_at = :now',
    ExpressionAttributeValues: {
      ':status': 'active',
      ':now': new Date().toISOString()
    }
  }));
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice) {
  const tenantId = await getTenantIdFromCustomer(invoice.customer);
  if (!tenantId) return;

  console.log('Invoice payment failed for tenant:', tenantId);

  // Update tenant status
  await docClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET billing_status = :status, status_reason = :reason, payment_failed_at = :now, updated_at = :now',
    ExpressionAttributeValues: {
      ':status': 'payment_failed',
      ':reason': 'Zahlung fehlgeschlagen - bitte Zahlungsmethode aktualisieren',
      ':now': new Date().toISOString()
    }
  }));
}

// Handle payment method attached
async function handlePaymentMethodAttached(paymentMethod) {
  const customerId = paymentMethod.customer;
  if (!customerId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Payment method attached for tenant:', tenantId);

  const updateData = {
    ':pmId': paymentMethod.id,
    ':pmType': paymentMethod.type,
    ':now': new Date().toISOString()
  };

  let updateExpression = 'SET payment_method_id = :pmId, payment_method_type = :pmType, updated_at = :now';

  // Add card details if available
  if (paymentMethod.card) {
    updateData[':last4'] = paymentMethod.card.last4;
    updateData[':brand'] = paymentMethod.card.brand;
    updateData[':expMonth'] = paymentMethod.card.exp_month;
    updateData[':expYear'] = paymentMethod.card.exp_year;
    updateExpression += ', payment_method_last4 = :last4, payment_method_brand = :brand, payment_method_exp_month = :expMonth, payment_method_exp_year = :expYear';
  }

  // Add SEPA details if available
  if (paymentMethod.sepa_debit) {
    updateData[':last4'] = paymentMethod.sepa_debit.last4;
    updateData[':brand'] = 'sepa';
    updateData[':bankCode'] = paymentMethod.sepa_debit.bank_code;
    updateExpression += ', payment_method_last4 = :last4, payment_method_brand = :brand, payment_method_bank_code = :bankCode';
  }

  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: updateData
  }));
}

// Handle payment method detached
async function handlePaymentMethodDetached(paymentMethod) {
  // Find tenant by payment method ID
  const result = await docClient.send(new QueryCommand({
    TableName: BILLING_TABLE,
    IndexName: 'payment-method-index',
    KeyConditionExpression: 'payment_method_id = :pmId',
    ExpressionAttributeValues: { ':pmId': paymentMethod.id }
  }));

  if (result.Items && result.Items.length > 0) {
    const tenantId = result.Items[0].user_id;
    console.log('Payment method detached for tenant:', tenantId);

    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: 'REMOVE payment_method_id, payment_method_type, payment_method_last4, payment_method_brand SET updated_at = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() }
    }));
  }
}

// Handle setup intent succeeded (payment method saved)
async function handleSetupIntentSucceeded(setupIntent) {
  const customerId = setupIntent.customer;
  const paymentMethodId = setupIntent.payment_method;
  
  if (!customerId || !paymentMethodId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Setup intent succeeded for tenant:', tenantId);

  // Set as default payment method for the customer
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  });

  // Get payment method details
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  
  const updateData = {
    ':pmId': paymentMethodId,
    ':pmType': paymentMethod.type,
    ':now': new Date().toISOString()
  };

  let updateExpression = 'SET payment_method_id = :pmId, payment_method_type = :pmType, updated_at = :now';

  if (paymentMethod.card) {
    updateData[':last4'] = paymentMethod.card.last4;
    updateData[':brand'] = paymentMethod.card.brand;
    updateExpression += ', payment_method_last4 = :last4, payment_method_brand = :brand';
  }

  if (paymentMethod.sepa_debit) {
    updateData[':last4'] = paymentMethod.sepa_debit.last4;
    updateData[':brand'] = 'sepa';
    updateExpression += ', payment_method_last4 = :last4, payment_method_brand = :brand';
  }

  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: updateData
  }));
}
