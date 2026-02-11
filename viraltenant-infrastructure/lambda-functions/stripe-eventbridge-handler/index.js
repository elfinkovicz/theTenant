/**
 * Stripe EventBridge Handler
 * 
 * Processes Stripe events received via Amazon EventBridge.
 * Benefits over traditional webhooks:
 * - No signature verification needed (AWS handles authentication)
 * - Built-in retry with exponential backoff
 * - Dead letter queue for failed events
 * - Event filtering at AWS level
 * 
 * TENANT ISOLATION: Each event is validated against tenant metadata
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

// Load Stripe secrets
async function loadStripe() {
  if (stripe) return stripe;
  
  const response = await secretsClient.send(new GetSecretValueCommand({
    SecretId: STRIPE_SECRET_ID
  }));
  
  stripeSecrets = JSON.parse(response.SecretString);
  stripe = require('stripe')(stripeSecrets.secret_key);
  return stripe;
}

exports.handler = async (event) => {
  console.log('Stripe EventBridge Event:', JSON.stringify(event, null, 2));
  
  try {
    await loadStripe();
    
    // Stripe Partner Events have the Stripe event directly in 'detail'
    // The event type is in 'detail-type' field
    const stripeEventData = event.detail;
    const eventType = event['detail-type'];
    
    // For partner events, the actual Stripe object is in detail.data.object
    const eventObject = stripeEventData?.data?.object || stripeEventData;

    console.log('Processing event type:', eventType);
    console.log('Event object:', JSON.stringify(eventObject, null, 2));

    // Route to appropriate handler
    switch (eventType) {
      // Subscription events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(eventObject);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(eventObject);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(eventObject);
        break;
      case 'customer.subscription.paused':
        await handleSubscriptionPaused(eventObject);
        break;
      case 'customer.subscription.resumed':
        await handleSubscriptionResumed(eventObject);
        break;

      // Invoice events
      case 'invoice.paid':
        await handleInvoicePaid(eventObject);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(eventObject);
        break;
      case 'invoice.payment_action_required':
        await handlePaymentActionRequired(eventObject);
        break;
      case 'invoice.finalized':
        await handleInvoiceFinalized(eventObject);
        break;

      // Payment method events
      case 'payment_method.attached':
        await handlePaymentMethodAttached(eventObject);
        break;
      case 'payment_method.detached':
        await handlePaymentMethodDetached(eventObject);
        break;
      case 'payment_method.updated':
        await handlePaymentMethodUpdated(eventObject);
        break;

      // Setup intent events
      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(eventObject);
        break;
      case 'setup_intent.setup_failed':
        await handleSetupIntentFailed(eventObject);
        break;

      // Charge events
      case 'charge.succeeded':
        await handleChargeSucceeded(eventObject);
        break;
      case 'charge.failed':
        await handleChargeFailed(eventObject);
        break;

      default:
        console.log('Unhandled event type:', eventType);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('EventBridge handler error:', error);
    throw error; // Rethrow to trigger retry/DLQ
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getTenantIdFromCustomer(customerId) {
  if (!customerId) return null;
  
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.metadata?.tenantId || null;
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
}

async function updateBillingRecord(tenantId, updates) {
  const updateParts = [];
  const expressionValues = { ':now': new Date().toISOString() };
  
  Object.entries(updates).forEach(([key, value]) => {
    updateParts.push(`${key} = :${key}`);
    expressionValues[`:${key}`] = value;
  });
  
  updateParts.push('updated_at = :now');

  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionValues
  }));
}

async function updateTenantStatus(tenantId, billingStatus, reason = null) {
  const updates = {
    ':billing_status': billingStatus,
    ':now': new Date().toISOString()
  };
  
  let updateExpr = 'SET billing_status = :billing_status, updated_at = :now';
  
  // Auto-unlock: If billing status is active, set tenant status to active
  if (billingStatus === 'active') {
    updates[':status'] = 'active';
    updates[':subscription_status'] = 'active';
    updateExpr += ', #status = :status, subscription_status = :subscription_status';
    // Remove any suspension reason
    updateExpr += ' REMOVE status_reason';
  }
  
  if (reason) {
    updates[':reason'] = reason;
    updateExpr += ', status_reason = :reason';
  }

  await docClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: updateExpr,
    ExpressionAttributeNames: billingStatus === 'active' ? { '#status': 'status' } : undefined,
    ExpressionAttributeValues: updates
  }));
  
  console.log(`Tenant ${tenantId} status updated: billing_status=${billingStatus}${billingStatus === 'active' ? ', status=active (auto-unlocked)' : ''}`);
}

// ============================================================
// SUBSCRIPTION HANDLERS
// ============================================================

async function handleSubscriptionCreated(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) {
    console.error('No tenantId for customer:', subscription.customer);
    return;
  }

  console.log('Subscription created for tenant:', tenantId);

  await updateBillingRecord(tenantId, {
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: subscription.status,
    subscription_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
  });

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    await updateTenantStatus(tenantId, 'active');
  }
}

async function handleSubscriptionUpdated(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) return;

  console.log('Subscription updated for tenant:', tenantId, 'Status:', subscription.status);

  await updateBillingRecord(tenantId, {
    stripe_subscription_status: subscription.status,
    subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    subscription_cancel_at_period_end: subscription.cancel_at_period_end
  });

  // Update tenant status based on subscription status
  const statusMap = {
    'active': 'active',
    'trialing': 'active',
    'past_due': 'payment_overdue',
    'unpaid': 'payment_overdue',
    'canceled': 'subscription_cancelled',
    'incomplete': 'payment_pending',
    'incomplete_expired': 'subscription_expired'
  };

  const billingStatus = statusMap[subscription.status] || 'unknown';
  const reason = subscription.status === 'past_due' ? 'Zahlung überfällig' : 
                 subscription.status === 'canceled' ? 'Abonnement gekündigt' : null;

  await updateTenantStatus(tenantId, billingStatus, reason);
}

async function handleSubscriptionDeleted(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) return;

  console.log('Subscription deleted for tenant:', tenantId);

  await updateBillingRecord(tenantId, {
    stripe_subscription_status: 'cancelled',
    subscription_cancelled_at: new Date().toISOString()
  });

  await updateTenantStatus(tenantId, 'subscription_cancelled', 'Abonnement beendet');
}

async function handleSubscriptionPaused(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) return;

  console.log('Subscription paused for tenant:', tenantId);

  await updateBillingRecord(tenantId, {
    stripe_subscription_status: 'paused'
  });

  await updateTenantStatus(tenantId, 'subscription_paused', 'Abonnement pausiert');
}

async function handleSubscriptionResumed(subscription) {
  const tenantId = await getTenantIdFromCustomer(subscription.customer);
  if (!tenantId) return;

  console.log('Subscription resumed for tenant:', tenantId);

  await updateBillingRecord(tenantId, {
    stripe_subscription_status: subscription.status
  });

  await updateTenantStatus(tenantId, 'active');
}

// ============================================================
// INVOICE HANDLERS
// ============================================================

async function handleInvoicePaid(invoice) {
  const tenantId = await getTenantIdFromCustomer(invoice.customer);
  if (!tenantId) return;

  console.log('Invoice paid for tenant:', tenantId, 'Amount:', invoice.amount_paid);

  // Create invoice record
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate base fee and usage costs
  const totalAmount = invoice.amount_paid / 100;
  const baseFee = 30;
  const usageCosts = Math.max(0, totalAmount - baseFee);

  await docClient.send(new PutCommand({
    TableName: INVOICES_TABLE,
    Item: {
      invoice_id: invoiceId,
      user_id: tenantId,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number,
      amount: totalAmount,
      base_fee: baseFee,
      aws_costs: usageCosts,
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

  // Update tenant status
  await updateBillingRecord(tenantId, {
    last_payment_at: new Date().toISOString(),
    last_payment_amount: totalAmount
  });

  await updateTenantStatus(tenantId, 'active');
}

async function handleInvoicePaymentFailed(invoice) {
  const tenantId = await getTenantIdFromCustomer(invoice.customer);
  if (!tenantId) return;

  console.log('Invoice payment failed for tenant:', tenantId);

  await updateBillingRecord(tenantId, {
    payment_failed_at: new Date().toISOString(),
    payment_failure_reason: invoice.last_payment_error?.message || 'Unknown error'
  });

  await updateTenantStatus(tenantId, 'payment_failed', 'Zahlung fehlgeschlagen - bitte Zahlungsmethode prüfen');
}

async function handlePaymentActionRequired(invoice) {
  const tenantId = await getTenantIdFromCustomer(invoice.customer);
  if (!tenantId) return;

  console.log('Payment action required for tenant:', tenantId);

  await updateTenantStatus(tenantId, 'payment_action_required', 'Zahlungsbestätigung erforderlich (3D Secure)');
}

async function handleInvoiceFinalized(invoice) {
  const tenantId = await getTenantIdFromCustomer(invoice.customer);
  if (!tenantId) return;

  console.log('Invoice finalized for tenant:', tenantId, 'Amount:', invoice.amount_due / 100);
  
  // Log for monitoring
  await updateBillingRecord(tenantId, {
    last_invoice_amount: invoice.amount_due / 100,
    last_invoice_date: new Date().toISOString()
  });
}

// ============================================================
// PAYMENT METHOD HANDLERS
// ============================================================

async function handlePaymentMethodAttached(paymentMethod) {
  const customerId = paymentMethod.customer;
  if (!customerId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Payment method attached for tenant:', tenantId);

  const updates = {
    payment_method_id: paymentMethod.id,
    payment_method_type: paymentMethod.type
  };

  if (paymentMethod.card) {
    updates.payment_method_last4 = paymentMethod.card.last4;
    updates.payment_method_brand = paymentMethod.card.brand;
    updates.payment_method_exp_month = paymentMethod.card.exp_month;
    updates.payment_method_exp_year = paymentMethod.card.exp_year;
  }

  if (paymentMethod.sepa_debit) {
    updates.payment_method_last4 = paymentMethod.sepa_debit.last4;
    updates.payment_method_brand = 'sepa';
    updates.payment_method_bank_code = paymentMethod.sepa_debit.bank_code;
  }

  await updateBillingRecord(tenantId, updates);
}

async function handlePaymentMethodDetached(paymentMethod) {
  // Find tenant by querying billing table
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

async function handlePaymentMethodUpdated(paymentMethod) {
  const customerId = paymentMethod.customer;
  if (!customerId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Payment method updated for tenant:', tenantId);

  // Re-sync payment method details
  await handlePaymentMethodAttached(paymentMethod);
}

// ============================================================
// SETUP INTENT HANDLERS
// ============================================================

async function handleSetupIntentSucceeded(setupIntent) {
  const customerId = setupIntent.customer;
  const paymentMethodId = setupIntent.payment_method;
  
  if (!customerId || !paymentMethodId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Setup intent succeeded for tenant:', tenantId);

  // Set as default payment method
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId }
  });

  // Get and store payment method details
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  await handlePaymentMethodAttached(pm);
  
  // Auto-unlock tenant when payment method is added
  // This handles the case where trial expired and user adds payment method
  await unlockTenantWithPaymentMethod(tenantId);
}

// Unlock tenant when payment method is successfully added
async function unlockTenantWithPaymentMethod(tenantId) {
  try {
    // Get current tenant status
    const result = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    const tenant = result.Item;
    if (!tenant) return;
    
    // If tenant is suspended due to trial expiry or missing payment, unlock them
    if (tenant.status === 'suspended' || tenant.status === 'trial_expired') {
      console.log(`Auto-unlocking tenant ${tenantId} - payment method added`);
      
      await docClient.send(new UpdateCommand({
        TableName: TENANTS_TABLE,
        Key: { tenant_id: tenantId },
        UpdateExpression: 'SET #status = :status, subscription_status = :sub_status, updated_at = :now REMOVE status_reason',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'active',
          ':sub_status': 'payment_method_added',
          ':now': new Date().toISOString()
        }
      }));
      
      console.log(`Tenant ${tenantId} unlocked successfully`);
    }
  } catch (error) {
    console.error('Error unlocking tenant:', error);
  }
}

async function handleSetupIntentFailed(setupIntent) {
  const customerId = setupIntent.customer;
  if (!customerId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Setup intent failed for tenant:', tenantId);
  
  await updateBillingRecord(tenantId, {
    setup_failed_at: new Date().toISOString(),
    setup_failure_reason: setupIntent.last_setup_error?.message || 'Unknown error'
  });
}

// ============================================================
// CHARGE HANDLERS
// ============================================================

async function handleChargeSucceeded(charge) {
  const customerId = charge.customer;
  if (!customerId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Charge succeeded for tenant:', tenantId, 'Amount:', charge.amount / 100);
}

async function handleChargeFailed(charge) {
  const customerId = charge.customer;
  if (!customerId) return;

  const tenantId = await getTenantIdFromCustomer(customerId);
  if (!tenantId) return;

  console.log('Charge failed for tenant:', tenantId, 'Reason:', charge.failure_message);

  await updateBillingRecord(tenantId, {
    last_charge_failure: new Date().toISOString(),
    last_charge_failure_reason: charge.failure_message || 'Unknown error'
  });
}
