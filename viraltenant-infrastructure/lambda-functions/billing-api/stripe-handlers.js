/**
 * Stripe Handlers for Tenant Billing
 * 
 * Handles:
 * - Subscription management (30€/month base fee)
 * - Usage-based billing (infrastructure costs)
 * - Payment method management
 * - Stripe Customer per Tenant (isolation)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({ region: process.env.REGION || 'eu-central-1' });

const BILLING_TABLE = process.env.BILLING_TABLE || 'viraltenant-billing-production';
const INVOICES_TABLE = process.env.INVOICES_TABLE || 'viraltenant-invoices-production';
const TENANTS_TABLE = process.env.TENANTS_TABLE || 'viraltenant-tenants-production';
const STRIPE_SECRET_ID = process.env.STRIPE_SECRET_ID;

let stripeSecrets = null;
let stripe = null;

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Load Stripe secrets from Secrets Manager
async function loadStripeSecrets() {
  if (stripeSecrets && stripe) return { stripeSecrets, stripe };
  
  // Try Secrets Manager first, then fall back to env var
  if (STRIPE_SECRET_ID) {
    try {
      const response = await secretsClient.send(new GetSecretValueCommand({
        SecretId: STRIPE_SECRET_ID
      }));
      stripeSecrets = JSON.parse(response.SecretString);
      stripe = require('stripe')(stripeSecrets.secret_key);
      return { stripeSecrets, stripe };
    } catch (error) {
      console.log('Secrets Manager not available, trying env var');
    }
  }
  
  // Fallback to environment variable
  if (process.env.STRIPE_SECRET_KEY) {
    stripeSecrets = { secret_key: process.env.STRIPE_SECRET_KEY };
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return { stripeSecrets, stripe };
  }
  
  throw new Error('Stripe not configured');
}

// Get or create Stripe customer for tenant
async function getOrCreateStripeCustomer(tenantId) {
  const { stripe } = await loadStripeSecrets();
  
  // Check if customer exists in billing table
  const billingRecord = await docClient.send(new GetCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId }
  }));

  if (billingRecord.Item?.stripe_customer_id) {
    // Verify customer still exists in Stripe
    try {
      const customer = await stripe.customers.retrieve(billingRecord.Item.stripe_customer_id);
      if (!customer.deleted) {
        return customer;
      }
    } catch (error) {
      console.log('Customer not found in Stripe, creating new one');
    }
  }

  // Get tenant info for customer creation
  const tenantRecord = await docClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  }));

  const tenant = tenantRecord.Item || {};

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: tenant.creator_name || tenant.subdomain || tenantId,
    email: tenant.creator_email,
    metadata: {
      tenantId: tenantId,
      subdomain: tenant.subdomain || '',
      platform: 'viraltenant'
    }
  });

  // Save customer ID to billing table
  await docClient.send(new PutCommand({
    TableName: BILLING_TABLE,
    Item: {
      user_id: tenantId,
      stripe_customer_id: customer.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }));

  return customer;
}

// GET /billing/stripe/subscription/{tenantId}
async function getStripeSubscription(tenantId) {
  console.log('Getting Stripe subscription for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();

    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.stripe_subscription_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          hasSubscription: false,
          subscription: null
        })
      };
    }

    const subscription = await stripe.subscriptions.retrieve(billingRecord.Item.stripe_subscription_id);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null
        }
      })
    };
  } catch (error) {
    console.error('Error getting subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get subscription', message: error.message })
    };
  }
}

// POST /billing/stripe/create-subscription/{tenantId}
async function createStripeSubscription(tenantId, body) {
  console.log('Creating Stripe subscription for tenant:', tenantId);

  try {
    const { stripe, stripeSecrets } = await loadStripeSecrets();
    const { paymentMethodId } = body;

    // Get or create customer
    const customer = await getOrCreateStripeCustomer(tenantId);

    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      // Get payment method details for storage
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      const updateData = {
        ':pmId': paymentMethodId,
        ':pmType': pm.type,
        ':now': new Date().toISOString()
      };
      let updateExpr = 'SET payment_method_id = :pmId, payment_method_type = :pmType, updated_at = :now';

      if (pm.card) {
        updateData[':last4'] = pm.card.last4;
        updateData[':brand'] = pm.card.brand;
        updateExpr += ', payment_method_last4 = :last4, payment_method_brand = :brand';
      } else if (pm.sepa_debit) {
        updateData[':last4'] = pm.sepa_debit.last4;
        updateData[':brand'] = 'sepa';
        updateExpr += ', payment_method_last4 = :last4, payment_method_brand = :brand';
      }

      await docClient.send(new UpdateCommand({
        TableName: BILLING_TABLE,
        Key: { user_id: tenantId },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: updateData
      }));
    }

    // Get price ID from secrets or env
    const priceId = stripeSecrets.price_id || process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Stripe price not configured' })
      };
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        tenantId: tenantId
      }
    });

    // Update billing record
    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: 'SET stripe_subscription_id = :subId, stripe_subscription_status = :status, updated_at = :now',
      ExpressionAttributeValues: {
        ':subId': subscription.id,
        ':status': subscription.status,
        ':now': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        subscriptionId: subscription.id,
        status: subscription.status,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret
      })
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create subscription', message: error.message })
    };
  }
}

// POST /billing/stripe/cancel-subscription/{tenantId}
async function cancelStripeSubscription(tenantId, body) {
  console.log('Cancelling Stripe subscription for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();
    const { immediately = false } = body || {};

    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.stripe_subscription_id) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No subscription found' })
      };
    }

    let subscription;
    if (immediately) {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(billingRecord.Item.stripe_subscription_id);
    } else {
      // Cancel at period end
      subscription = await stripe.subscriptions.update(billingRecord.Item.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }

    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: 'SET stripe_subscription_status = :status, subscription_cancel_at_period_end = :cancelEnd, updated_at = :now',
      ExpressionAttributeValues: {
        ':status': subscription.status,
        ':cancelEnd': subscription.cancel_at_period_end,
        ':now': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
      })
    };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to cancel subscription', message: error.message })
    };
  }
}

// GET /billing/stripe/payment-method/{tenantId}
async function getStripePaymentMethod(tenantId) {
  console.log('Getting Stripe payment method for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();

    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.stripe_customer_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ hasPaymentMethod: false, paymentMethods: [] })
      };
    }

    // Get all payment methods for customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: billingRecord.Item.stripe_customer_id,
      type: 'card'
    });

    const sepaPaymentMethods = await stripe.paymentMethods.list({
      customer: billingRecord.Item.stripe_customer_id,
      type: 'sepa_debit'
    });

    const allMethods = [...paymentMethods.data, ...sepaPaymentMethods.data];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        hasPaymentMethod: allMethods.length > 0,
        defaultPaymentMethodId: billingRecord.Item.payment_method_id,
        paymentMethods: allMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          isDefault: pm.id === billingRecord.Item.payment_method_id,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year
          } : null,
          sepaDebit: pm.sepa_debit ? {
            last4: pm.sepa_debit.last4,
            bankCode: pm.sepa_debit.bank_code,
            country: pm.sepa_debit.country
          } : null
        }))
      })
    };
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get payment methods', message: error.message })
    };
  }
}

// POST /billing/stripe/payment-method/{tenantId} - Add/Update payment method
async function addStripePaymentMethod(tenantId, body) {
  console.log('Adding Stripe payment method for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();
    const { paymentMethodId, setAsDefault = true } = body;

    if (!paymentMethodId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'paymentMethodId is required' })
      };
    }

    // Get or create customer
    const customer = await getOrCreateStripeCustomer(tenantId);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id
    });

    // Set as default if requested
    if (setAsDefault) {
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    // Get payment method details
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Update billing record
    const updateData = {
      ':pmId': paymentMethodId,
      ':pmType': pm.type,
      ':now': new Date().toISOString()
    };
    let updateExpr = 'SET payment_method_id = :pmId, payment_method_type = :pmType, updated_at = :now';

    if (pm.card) {
      updateData[':last4'] = pm.card.last4;
      updateData[':brand'] = pm.card.brand;
      updateData[':expMonth'] = pm.card.exp_month;
      updateData[':expYear'] = pm.card.exp_year;
      updateExpr += ', payment_method_last4 = :last4, payment_method_brand = :brand, payment_method_exp_month = :expMonth, payment_method_exp_year = :expYear';
    } else if (pm.sepa_debit) {
      updateData[':last4'] = pm.sepa_debit.last4;
      updateData[':brand'] = 'sepa';
      updateExpr += ', payment_method_last4 = :last4, payment_method_brand = :brand';
    }

    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: updateData
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        paymentMethod: {
          id: pm.id,
          type: pm.type,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year
          } : null,
          sepaDebit: pm.sepa_debit ? {
            last4: pm.sepa_debit.last4,
            bankCode: pm.sepa_debit.bank_code
          } : null
        }
      })
    };
  } catch (error) {
    console.error('Error adding payment method:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to add payment method', message: error.message })
    };
  }
}

// DELETE /billing/stripe/payment-method/{tenantId}
async function deleteStripePaymentMethod(tenantId, body) {
  console.log('Deleting Stripe payment method for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();
    const { paymentMethodId } = body || {};

    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    const pmIdToDelete = paymentMethodId || billingRecord.Item?.payment_method_id;
    if (!pmIdToDelete) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No payment method to delete' })
      };
    }

    // Detach payment method from customer
    await stripe.paymentMethods.detach(pmIdToDelete);

    // Update billing record if it was the default
    if (pmIdToDelete === billingRecord.Item?.payment_method_id) {
      await docClient.send(new UpdateCommand({
        TableName: BILLING_TABLE,
        Key: { user_id: tenantId },
        UpdateExpression: 'REMOVE payment_method_id, payment_method_type, payment_method_last4, payment_method_brand SET updated_at = :now',
        ExpressionAttributeValues: { ':now': new Date().toISOString() }
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete payment method', message: error.message })
    };
  }
}

// POST /billing/stripe/add-usage/{tenantId} - Add usage-based charges
async function addStripeUsage(tenantId, body) {
  console.log('Adding Stripe usage for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();
    const { amount, description, invoiceItemDescription } = body;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid amount is required' })
      };
    }

    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.stripe_customer_id) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No Stripe customer found for tenant' })
      };
    }

    // Create invoice item for usage-based charge
    const invoiceItem = await stripe.invoiceItems.create({
      customer: billingRecord.Item.stripe_customer_id,
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'eur',
      description: invoiceItemDescription || description || 'Infrastrukturkosten'
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        invoiceItemId: invoiceItem.id,
        amount: amount,
        description: invoiceItem.description
      })
    };
  } catch (error) {
    console.error('Error adding usage:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to add usage', message: error.message })
    };
  }
}

// GET /billing/stripe/invoices/{tenantId} - Get Stripe invoices
async function getStripeInvoices(tenantId) {
  console.log('Getting Stripe invoices for tenant:', tenantId);

  try {
    const { stripe } = await loadStripeSecrets();

    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.stripe_customer_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ invoices: [] })
      };
    }

    const invoices = await stripe.invoices.list({
      customer: billingRecord.Item.stripe_customer_id,
      limit: 24 // Last 2 years of monthly invoices
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        invoices: invoices.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount: inv.amount_due / 100,
          amountPaid: inv.amount_paid / 100,
          currency: inv.currency,
          periodStart: new Date(inv.period_start * 1000).toISOString(),
          periodEnd: new Date(inv.period_end * 1000).toISOString(),
          created: new Date(inv.created * 1000).toISOString(),
          paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf
        }))
      })
    };
  } catch (error) {
    console.error('Error getting invoices:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get invoices', message: error.message })
    };
  }
}

// POST /billing/stripe/setup-intent/{tenantId} - Create setup intent for saving payment method
async function createStripeSetupIntent(tenantId) {
  console.log('Creating Stripe setup intent for tenant:', tenantId);

  try {
    const { stripe, stripeSecrets } = await loadStripeSecrets();

    // Get or create customer
    const customer = await getOrCreateStripeCustomer(tenantId);

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        tenantId: tenantId
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        clientSecret: setupIntent.client_secret,
        publishableKey: stripeSecrets.publishable_key || process.env.STRIPE_PUBLISHABLE_KEY
      })
    };
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create setup intent', message: error.message })
    };
  }
}

// Export all handlers
module.exports = {
  getStripeSubscription,
  createStripeSubscription,
  cancelStripeSubscription,
  getStripePaymentMethod,
  addStripePaymentMethod,
  deleteStripePaymentMethod,
  addStripeUsage,
  getStripeInvoices,
  createStripeSetupIntent,
  getOrCreateStripeCustomer,
  loadStripeSecrets
};
