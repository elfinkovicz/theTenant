/**
 * Mollie Payment Handlers for ViralTenant Billing
 * 
 * Verwendet SEPA-Mandates für flexible monatliche Abbuchungen:
 * - 30€ Grundgebühr + variable AWS-Kosten
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const BILLING_TABLE = process.env.BILLING_TABLE || 'viraltenant-billing-production';
const INVOICES_TABLE = process.env.INVOICES_TABLE || 'viraltenant-invoices-production';
const TENANTS_TABLE = process.env.TENANTS_TABLE || 'viraltenant-tenants-production';

// Mollie Configuration
const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY;
const MOLLIE_BASE_URL = 'https://api.mollie.com/v2';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Mollie API Request Helper
 */
async function mollieRequest(endpoint, method = 'GET', body = null) {
  if (!MOLLIE_API_KEY) {
    throw new Error('Mollie API Key nicht konfiguriert');
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${MOLLIE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${MOLLIE_BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    console.error('Mollie API Error:', error);
    throw new Error(error.detail || `Mollie API Error: ${response.status}`);
  }

  // DELETE returns 204 No Content
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

/**
 * Create or get Mollie Customer for Tenant
 */
async function getOrCreateMollieCustomer(tenantId) {
  // Check if customer already exists
  const billingRecord = await docClient.send(new GetCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId }
  }));

  if (billingRecord.Item?.mollie_customer_id) {
    // Verify customer still exists in Mollie
    try {
      const customer = await mollieRequest(`/customers/${billingRecord.Item.mollie_customer_id}`);
      return customer;
    } catch (error) {
      console.log('Mollie customer not found, creating new one');
    }
  }

  // Get tenant info for customer details
  const tenantRecord = await docClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  }));

  const tenant = tenantRecord.Item || {};

  // Build customer name from tenant data
  const customerName = tenant.company_name || 
    (tenant.first_name && tenant.last_name ? `${tenant.first_name} ${tenant.last_name}` : null) ||
    tenant.creator_name || 
    tenant.name || 
    tenantId;

  // Use creator_email as primary, then billing_email, then email field
  const customerEmail = tenant.creator_email || tenant.billing_email || tenant.email;

  if (!customerEmail) {
    throw new Error('Keine E-Mail-Adresse für den Tenant gefunden. Bitte aktualisiere deine Kontaktdaten.');
  }

  // Create new Mollie customer
  const customer = await mollieRequest('/customers', 'POST', {
    name: customerName,
    email: customerEmail,
    metadata: JSON.stringify({ tenantId })
  });

  // Save customer ID
  await docClient.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { user_id: tenantId },
    UpdateExpression: 'SET mollie_customer_id = :customerId, updated_at = :now',
    ExpressionAttributeValues: {
      ':customerId': customer.id,
      ':now': new Date().toISOString()
    }
  }));

  return customer;
}

/**
 * GET /billing/mollie/customer/{tenantId}
 * Get Mollie customer info and mandate status
 */
async function getMollieCustomer(tenantId) {
  try {
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.mollie_customer_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          hasCustomer: false,
          hasMandate: false,
          subscriptionStatus: 'inactive'
        })
      };
    }

    const customerId = billingRecord.Item.mollie_customer_id;
    const subscriptionStatus = billingRecord.Item.subscription_status || 'inactive';
    const subscriptionActivatedAt = billingRecord.Item.subscription_activated_at;
    
    // Get customer details
    const customer = await mollieRequest(`/customers/${customerId}`);
    
    // Get mandates
    const mandates = await mollieRequest(`/customers/${customerId}/mandates`);
    const validMandate = mandates._embedded?.mandates?.find(m => m.status === 'valid');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        hasCustomer: true,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        hasMandate: !!validMandate,
        subscriptionStatus: validMandate ? 'active' : subscriptionStatus,
        subscriptionActivatedAt: subscriptionActivatedAt,
        mandate: validMandate ? {
          id: validMandate.id,
          method: validMandate.method,
          status: validMandate.status,
          details: {
            // SEPA details
            consumerName: validMandate.details?.consumerName,
            consumerAccount: validMandate.details?.consumerAccount,
            consumerBic: validMandate.details?.consumerBic,
            // Card details
            cardNumber: validMandate.details?.cardNumber,
            cardHolder: validMandate.details?.cardHolder,
            cardLabel: validMandate.details?.cardLabel,
            cardFingerprint: validMandate.details?.cardFingerprint,
            cardExpiryDate: validMandate.details?.cardExpiryDate
          },
          createdAt: validMandate.createdAt
        } : null
      })
    };
  } catch (error) {
    console.error('Error getting Mollie customer:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/create-customer/{tenantId}
 * Create Mollie customer for tenant
 */
async function createMollieCustomer(tenantId, body) {
  try {
    const { name, email } = body;

    // Get tenant info for fallback values
    const tenantRecord = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    const tenant = tenantRecord.Item || {};

    // Build customer name - use provided name or fallback to tenant data
    const customerName = name || 
      tenant.company_name || 
      (tenant.first_name && tenant.last_name ? `${tenant.first_name} ${tenant.last_name}` : null) ||
      tenant.creator_name || 
      tenant.name || 
      tenantId;

    // Build customer email - use provided email or fallback to tenant data
    const customerEmail = email || tenant.creator_email || tenant.billing_email || tenant.email;

    if (!customerEmail) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'E-Mail-Adresse ist erforderlich' })
      };
    }

    // Check if already exists
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (billingRecord.Item?.mollie_customer_id) {
      // Update existing customer
      const customer = await mollieRequest(
        `/customers/${billingRecord.Item.mollie_customer_id}`,
        'PATCH',
        { name: customerName, email: customerEmail }
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          customerId: customer.id,
          message: 'Kunde aktualisiert'
        })
      };
    }

    // Create new customer
    const customer = await mollieRequest('/customers', 'POST', {
      name: customerName,
      email: customerEmail,
      metadata: JSON.stringify({ tenantId })
    });

    // Save to billing table - use UpdateCommand to preserve existing data
    // First check if record exists
    if (billingRecord.Item) {
      // Update existing record
      await docClient.send(new UpdateCommand({
        TableName: BILLING_TABLE,
        Key: { user_id: tenantId },
        UpdateExpression: 'SET mollie_customer_id = :customerId, updated_at = :now',
        ExpressionAttributeValues: {
          ':customerId': customer.id,
          ':now': new Date().toISOString()
        }
      }));
    } else {
      // Create new record
      await docClient.send(new PutCommand({
        TableName: BILLING_TABLE,
        Item: {
          user_id: tenantId,
          mollie_customer_id: customer.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        customerId: customer.id,
        message: 'Kunde erstellt'
      })
    };
  } catch (error) {
    console.error('Error creating Mollie customer:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/create-first-payment/{tenantId}
 * Create first payment to establish SEPA mandate
 * 
 * Der Kunde wird zu Mollie weitergeleitet um die Zahlung zu autorisieren.
 * Nach erfolgreicher Zahlung wird automatisch ein Mandat erstellt.
 */
async function createFirstPayment(tenantId, body) {
  try {
    const { redirectUrl, amount = '0.01' } = body;

    if (!redirectUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'redirectUrl ist erforderlich' })
      };
    }

    // Get or create customer
    const customer = await getOrCreateMollieCustomer(tenantId);

    // Create first payment (small amount to verify account)
    const payment = await mollieRequest('/payments', 'POST', {
      amount: {
        currency: 'EUR',
        value: amount // Kleiner Betrag für Verifizierung
      },
      description: `ViralTenant - Zahlungsmethode einrichten (${tenantId})`,
      redirectUrl: `${redirectUrl}?tenantId=${tenantId}`,
      webhookUrl: `${process.env.API_BASE_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production'}/billing/mollie/webhook`,
      customerId: customer.id,
      sequenceType: 'first', // Wichtig: Erstellt Mandat
      metadata: JSON.stringify({
        tenantId,
        type: 'mandate_setup'
      })
    });

    // Save payment reference
    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: 'SET mollie_setup_payment_id = :paymentId, updated_at = :now',
      ExpressionAttributeValues: {
        ':paymentId': payment.id,
        ':now': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentId: payment.id,
        checkoutUrl: payment._links.checkout.href,
        status: payment.status
      })
    };
  } catch (error) {
    console.error('Error creating first payment:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/charge/{tenantId}
 * Charge tenant using existing mandate (recurring payment)
 */
async function chargeTenant(tenantId, body) {
  try {
    const { amount, description, invoiceId } = body;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Gültiger Betrag erforderlich' })
      };
    }

    // Get customer and mandate
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.mollie_customer_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Kein Mollie-Kunde vorhanden. Bitte zuerst Zahlungsmethode einrichten.' })
      };
    }

    const customerId = billingRecord.Item.mollie_customer_id;

    // Check for valid mandate
    const mandates = await mollieRequest(`/customers/${customerId}/mandates`);
    const validMandate = mandates._embedded?.mandates?.find(m => m.status === 'valid');

    if (!validMandate) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Kein gültiges SEPA-Mandat vorhanden. Bitte Zahlungsmethode neu einrichten.' })
      };
    }

    // Create recurring payment
    const payment = await mollieRequest('/payments', 'POST', {
      amount: {
        currency: 'EUR',
        value: amount.toFixed(2)
      },
      description: description || `ViralTenant Abrechnung - ${tenantId}`,
      customerId: customerId,
      mandateId: validMandate.id,
      sequenceType: 'recurring',
      webhookUrl: `${process.env.API_BASE_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production'}/billing/mollie/webhook`,
      metadata: JSON.stringify({
        tenantId,
        invoiceId,
        type: 'monthly_billing'
      })
    });

    // Update invoice with payment ID
    if (invoiceId) {
      await docClient.send(new UpdateCommand({
        TableName: INVOICES_TABLE,
        Key: { invoice_id: invoiceId },
        UpdateExpression: 'SET mollie_payment_id = :paymentId, payment_status = :status, updated_at = :now',
        ExpressionAttributeValues: {
          ':paymentId': payment.id,
          ':status': 'pending',
          ':now': new Date().toISOString()
        }
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        message: 'Zahlung wurde initiiert'
      })
    };
  } catch (error) {
    console.error('Error charging tenant:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/webhook
 * Handle Mollie payment webhooks
 */
async function handleWebhook(body) {
  try {
    const { id: paymentId } = body;

    if (!paymentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment ID required' })
      };
    }

    // Get payment details from Mollie
    const payment = await mollieRequest(`/payments/${paymentId}`);
    
    console.log('Mollie Webhook - Payment:', JSON.stringify(payment, null, 2));

    const metadata = JSON.parse(payment.metadata || '{}');
    const tenantId = metadata.tenantId;
    const invoiceId = metadata.invoiceId;

    if (!tenantId) {
      console.error('No tenantId in payment metadata');
      return { statusCode: 200, headers: corsHeaders, body: 'OK' };
    }

    // Handle based on payment status
    switch (payment.status) {
      case 'paid':
        console.log(`Payment ${paymentId} successful for tenant ${tenantId}`);
        
        // Update billing record - set subscription as active
        await docClient.send(new UpdateCommand({
          TableName: BILLING_TABLE,
          Key: { user_id: tenantId },
          UpdateExpression: 'SET mollie_mandate_status = :status, subscription_status = :subStatus, subscription_activated_at = :now, last_payment_at = :now, updated_at = :now',
          ExpressionAttributeValues: {
            ':status': 'active',
            ':subStatus': 'active',
            ':now': new Date().toISOString()
          }
        }));

        // Update tenant status to active if it was pending
        try {
          await docClient.send(new UpdateCommand({
            TableName: TENANTS_TABLE,
            Key: { tenant_id: tenantId },
            UpdateExpression: 'SET #status = :status, billing_active = :billingActive, updated_at = :now',
            ConditionExpression: '#status <> :active',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'active',
              ':billingActive': true,
              ':active': 'active',
              ':now': new Date().toISOString()
            }
          }));
          console.log(`Tenant ${tenantId} activated after successful payment`);
        } catch (updateError) {
          // Ignore condition check failures (tenant already active)
          if (updateError.name !== 'ConditionalCheckFailedException') {
            console.error('Error updating tenant status:', updateError);
          }
        }

        // Update invoice if exists - include full payment details
        if (invoiceId) {
          await docClient.send(new UpdateCommand({
            TableName: INVOICES_TABLE,
            Key: { invoice_id: invoiceId },
            UpdateExpression: 'SET #status = :status, paid_at = :paidAt, payment_status = :paymentStatus, payment_method = :paymentMethod, mollie_payment_id = :molliePaymentId, mollie_payment_method = :mollieMethod, mollie_payment_details = :mollieDetails',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'paid',
              ':paymentStatus': 'completed',
              ':paidAt': payment.paidAt || new Date().toISOString(),
              ':paymentMethod': 'mollie',
              ':molliePaymentId': payment.id,
              ':mollieMethod': payment.method || 'directdebit',
              ':mollieDetails': {
                transactionId: payment.id,
                method: payment.method,
                paidAt: payment.paidAt,
                amount: payment.amount,
                settlementAmount: payment.settlementAmount,
                consumerName: payment.details?.consumerName,
                consumerAccount: payment.details?.consumerAccount,
                consumerBic: payment.details?.consumerBic
              }
            }
          }));
        }

        // If this was mandate setup, save mandate ID
        if (metadata.type === 'mandate_setup' && payment.mandateId) {
          await docClient.send(new UpdateCommand({
            TableName: BILLING_TABLE,
            Key: { user_id: tenantId },
            UpdateExpression: 'SET mollie_mandate_id = :mandateId',
            ExpressionAttributeValues: {
              ':mandateId': payment.mandateId
            }
          }));
          console.log(`Mandate ${payment.mandateId} saved for tenant ${tenantId} - Viral Fee subscription now active`);
        }
        break;

      case 'failed':
      case 'canceled':
      case 'expired':
        console.log(`Payment ${paymentId} ${payment.status} for tenant ${tenantId}`);
        
        // Update billing record - subscription not active
        await docClient.send(new UpdateCommand({
          TableName: BILLING_TABLE,
          Key: { user_id: tenantId },
          UpdateExpression: 'SET mollie_mandate_status = :status, subscription_status = :subStatus, updated_at = :now',
          ExpressionAttributeValues: {
            ':status': payment.status,
            ':subStatus': 'inactive',
            ':now': new Date().toISOString()
          }
        }));
        
        if (invoiceId) {
          await docClient.send(new UpdateCommand({
            TableName: INVOICES_TABLE,
            Key: { invoice_id: invoiceId },
            UpdateExpression: 'SET payment_status = :status, payment_error = :error, updated_at = :now',
            ExpressionAttributeValues: {
              ':status': payment.status,
              ':error': payment.details?.failureReason || payment.status,
              ':now': new Date().toISOString()
            }
          }));
        }
        break;

      case 'pending':
        console.log(`Payment ${paymentId} pending for tenant ${tenantId}`);
        break;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'OK'
    };
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Mollie from retrying
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'Error processed'
    };
  }
}

/**
 * GET /billing/mollie/payments/{tenantId}
 * Get payment history for tenant
 */
async function getPaymentHistory(tenantId) {
  try {
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.mollie_customer_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ payments: [] })
      };
    }

    const payments = await mollieRequest(
      `/customers/${billingRecord.Item.mollie_customer_id}/payments?limit=50`
    );

    const formattedPayments = (payments._embedded?.payments || []).map(p => ({
      id: p.id,
      amount: p.amount,
      description: p.description,
      status: p.status,
      method: p.method,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
      metadata: JSON.parse(p.metadata || '{}')
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ payments: formattedPayments })
    };
  } catch (error) {
    console.error('Error getting payment history:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * DELETE /billing/mollie/mandate/{tenantId}
 * Revoke mandate (customer wants to cancel)
 * Also cancels the subscription
 */
async function revokeMandate(tenantId) {
  try {
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!billingRecord.Item?.mollie_customer_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Kein Kunde vorhanden' })
      };
    }

    const customerId = billingRecord.Item.mollie_customer_id;

    // Get and revoke all mandates
    const mandates = await mollieRequest(`/customers/${customerId}/mandates`);
    
    for (const mandate of mandates._embedded?.mandates || []) {
      if (mandate.status === 'valid') {
        await mollieRequest(`/customers/${customerId}/mandates/${mandate.id}`, 'DELETE');
      }
    }

    // Update billing record - revoke mandate AND cancel subscription
    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: 'SET mollie_mandate_status = :status, mollie_mandate_id = :null, subscription_status = :subStatus, subscription_cancelled_at = :now, updated_at = :now',
      ExpressionAttributeValues: {
        ':status': 'revoked',
        ':null': null,
        ':subStatus': 'cancelled',
        ':now': new Date().toISOString()
      }
    }));

    console.log(`Mandate revoked and subscription cancelled for tenant ${tenantId}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Mandat widerrufen und Abonnement gekündigt' })
    };
  } catch (error) {
    console.error('Error revoking mandate:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/process-monthly
 * Process monthly billing for all tenants (called by cron)
 */
async function processMonthlyBilling() {
  try {
    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    // Get all tenants with active Mollie mandates
    const billingRecords = await docClient.send(new QueryCommand({
      TableName: BILLING_TABLE,
      IndexName: 'mollie-mandate-index', // Needs to be created
      KeyConditionExpression: 'mollie_mandate_status = :status',
      ExpressionAttributeValues: {
        ':status': 'active'
      }
    })).catch(async () => {
      // Fallback: Scan if index doesn't exist
      const scan = await docClient.send(new ScanCommand({
        TableName: BILLING_TABLE,
        FilterExpression: 'mollie_mandate_status = :status',
        ExpressionAttributeValues: { ':status': 'active' }
      }));
      return scan;
    });

    const tenants = billingRecords.Items || [];
    console.log(`Processing ${tenants.length} tenants with active Mollie mandates`);

    for (const tenant of tenants) {
      const tenantId = tenant.user_id;
      results.processed++;

      try {
        // Calculate billing amount
        const { calculateCurrentMonthEstimate } = require('./index');
        const estimate = await calculateCurrentMonthEstimate(tenantId);
        
        const totalAmount = estimate.estimatedTotal;

        if (totalAmount <= 0) {
          results.skipped++;
          results.details.push({ tenantId, status: 'skipped', reason: 'No charges' });
          continue;
        }

        // Create invoice
        const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        await docClient.send(new PutCommand({
          TableName: INVOICES_TABLE,
          Item: {
            invoice_id: invoiceId,
            user_id: tenantId,
            amount: totalAmount,
            base_fee: estimate.baseFee,
            aws_costs: estimate.awsCosts,
            aws_breakdown: estimate.awsBreakdown,
            status: 'pending',
            period: estimate.period,
            month: monthStr,
            created_at: now.toISOString(),
            payment_method: 'mollie'
          }
        }));

        // Charge via Mollie
        const chargeResult = await chargeTenant(tenantId, {
          amount: totalAmount,
          description: `ViralTenant ${monthStr} - Grundgebühr + Nutzung`,
          invoiceId
        });

        if (chargeResult.statusCode === 200) {
          results.success++;
          results.details.push({ tenantId, status: 'success', invoiceId, amount: totalAmount });
        } else {
          results.failed++;
          results.details.push({ tenantId, status: 'failed', error: JSON.parse(chargeResult.body).error });
        }

      } catch (error) {
        results.failed++;
        results.details.push({ tenantId, status: 'error', error: error.message });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(results)
    };
  } catch (error) {
    console.error('Error processing monthly billing:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

module.exports = {
  getMollieCustomer,
  createMollieCustomer,
  createFirstPayment,
  chargeTenant,
  handleWebhook,
  getPaymentHistory,
  revokeMandate,
  processMonthlyBilling
};
