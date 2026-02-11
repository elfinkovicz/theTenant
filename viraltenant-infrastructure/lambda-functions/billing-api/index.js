const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand, UpdateCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region: process.env.REGION || 'eu-central-1' });

const INVOICES_TABLE = process.env.INVOICES_TABLE || 'viraltenant-invoices-production';
const BILLING_TABLE = process.env.BILLING_TABLE || 'viraltenant-billing-production';
const INVOICES_BUCKET = process.env.INVOICES_BUCKET || 'viraltenant-invoices-production';

// PayPal Configuration - Viral Tenant Abrechnung
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AeAVZaj5oBv2PhyZfPRe5xk486slL181VeEuB1gHP71lS8fCVJTu6I3pO5wlRlM3KoSL5US2o4mBipCU';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'EDM0kqDuvwBMP2pg7jZQ7ua7w4flFAgHfSr47GuznEoRmxOV5h3c2aSovuH5RauX9RG5R17EkXHosrLu';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'live'; // 'sandbox' or 'live'
const PAYPAL_BASE_URL = PAYPAL_MODE === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

// Paddle Configuration
const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const PADDLE_BASE_URL = 'https://api.paddle.com';

// Tenants Table for subscription mapping
const TENANTS_TABLE = process.env.TENANTS_TABLE || 'viraltenant-tenants-production';

// Get PayPal access token
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal auth error:', error);
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Helper function to normalize path (remove stage prefix like /production, /staging, /dev)
function normalizePath(path) {
  if (!path) return '/';
  // Remove stage prefix
  const normalized = path.replace(/^\/(production|staging|dev|prod|stage)/i, '');
  return normalized || '/';
}

exports.handler = async (event) => {
  console.log('Billing API Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path: rawPath, pathParameters, queryStringParameters } = event;
  
  // Normalize path to remove stage prefix
  const path = normalizePath(rawPath);
  console.log('Normalized path:', path, 'from raw:', rawPath);

  try {
    // OPTIONS requests (CORS preflight)
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'OK' })
      };
    }

    // GET /billing/invoices/{tenantId}
    if (httpMethod === 'GET' && path.match(/\/billing\/invoices\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      return await getInvoices(tenantId);
    }

    // GET /billing/invoices/{tenantId}/{invoiceId}/pdf (tenant-specific, NOT admin)
    if (httpMethod === 'GET' && path.match(/\/billing\/invoices\/[^\/]+\/[^\/]+\/pdf$/) && !path.includes('/admin/')) {
      // Extract from path if pathParameters not available
      const pathParts = path.split('/').filter(p => p);
      const tenantId = pathParameters?.tenantId || pathParts[2];
      const invoiceId = pathParameters?.invoiceId || pathParts[3];
      console.log('PDF request - tenantId:', tenantId, 'invoiceId:', invoiceId, 'pathParts:', pathParts);
      return await getInvoicePDF(tenantId, invoiceId);
    }

    // GET /billing/payment-method/{tenantId}
    if (httpMethod === 'GET' && path.match(/\/billing\/payment-method\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      return await getPaymentMethodStatus(tenantId);
    }

    // POST /billing/setup-intent/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/setup-intent\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      return await createSetupIntent(tenantId);
    }

    // POST /billing/charge/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/charge\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      return await createManualCharge(tenantId);
    }

    // POST /billing/paypal/create-order/{tenantId} - Create PayPal order for billing
    if (httpMethod === 'POST' && path.match(/\/billing\/paypal\/create-order\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      const body = JSON.parse(event.body || '{}');
      console.log('PayPal create-order request body:', JSON.stringify(body));
      console.log('PayPal create-order event.body raw:', event.body);
      return await createPayPalBillingOrder(tenantId, body.invoiceId, body.returnBaseUrl);
    }

    // POST /billing/paypal/capture/{tenantId} - Capture PayPal payment
    if (httpMethod === 'POST' && path.match(/\/billing\/paypal\/capture\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      const body = JSON.parse(event.body || '{}');
      return await capturePayPalBillingPayment(tenantId, body.orderId, body.invoiceId);
    }

    // GET /billing/payment-methods/{tenantId} - Get available payment methods
    if (httpMethod === 'GET' && path.match(/\/billing\/payment-methods\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      return await getAvailablePaymentMethods(tenantId);
    }

    // POST /billing/paddle/create-transaction/{tenantId} - Create Paddle transaction
    if (httpMethod === 'POST' && path.match(/\/billing\/paddle\/create-transaction\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      const body = JSON.parse(event.body || '{}');
      return await createPaddleTransaction(tenantId, body.invoiceId, body.returnBaseUrl);
    }

    // POST /billing/paddle/verify/{tenantId} - Verify Paddle payment
    if (httpMethod === 'POST' && path.match(/\/billing\/paddle\/verify\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      const body = JSON.parse(event.body || '{}');
      return await verifyPaddlePayment(tenantId, body.transactionId, body.invoiceId);
    }

    // POST /billing/paddle/add-aws-costs/{tenantId} - Add AWS costs to subscription
    if (httpMethod === 'POST' && path.match(/\/billing\/paddle\/add-aws-costs\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      const body = JSON.parse(event.body || '{}');
      return await addAwsCostsToSubscription(tenantId, body.subscriptionId, body.amount, body.description);
    }

    // POST /billing/paddle/process-monthly - Process monthly billing for all tenants (cron job)
    if (httpMethod === 'POST' && path.match(/\/billing\/paddle\/process-monthly$/)) {
      return await processMonthlyBilling();
    }

    // PUT /billing/paddle/subscription/{tenantId} - Set/Update Paddle subscription for tenant
    if (httpMethod === 'PUT' && path.match(/\/billing\/paddle\/subscription\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      const body = JSON.parse(event.body || '{}');
      return await setTenantSubscription(tenantId, body.subscriptionId, body.customerId);
    }

    // GET /billing/paddle/subscription/{tenantId} - Get Paddle subscription for tenant
    if (httpMethod === 'GET' && path.match(/\/billing\/paddle\/subscription\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId;
      return await getTenantSubscription(tenantId);
    }

    // GET /billing/estimate/{tenantId}
    if (httpMethod === 'GET' && path.includes('/estimate')) {
      const tenantId = pathParameters?.tenantId;
      const month = queryStringParameters?.month;
      return await getBillingEstimate(tenantId, month);
    }

    // ============================================================
    // ADMIN ENDPOINTS - For Billing Dashboard
    // ============================================================

    // GET /billing/admin/tenants - Get all tenants with billing overview
    if (httpMethod === 'GET' && path === '/billing/admin/tenants') {
      return await getAdminTenantsOverview();
    }

    // GET /billing/admin/invoices - Get all invoices from all tenants
    if (httpMethod === 'GET' && path === '/billing/admin/invoices') {
      return await getAdminAllInvoices();
    }

    // GET /billing/admin/invoices/{invoiceId}/pdf - Get PDF for any invoice (admin only)
    if (httpMethod === 'GET' && path.match(/\/billing\/admin\/invoices\/[^\/]+\/pdf$/)) {
      const invoiceId = path.split('/')[4];
      return await getAdminInvoicePDF(invoiceId);
    }

    // GET /billing/admin/aws-costs - Get total AWS costs for the account
    if (httpMethod === 'GET' && path === '/billing/admin/aws-costs') {
      return await getAdminAwsCosts();
    }

    // GET /billing/admin/tenants/{tenantId} - Get detailed tenant info
    if (httpMethod === 'GET' && path.match(/\/billing\/admin\/tenants\/[^\/]+$/)) {
      const tenantId = path.split('/')[4];
      return await getAdminTenantDetails(tenantId);
    }

    // PUT /billing/admin/tenants/{tenantId}/status - Update tenant status (suspend/activate)
    if (httpMethod === 'PUT' && path.match(/\/billing\/admin\/tenants\/[^\/]+\/status$/)) {
      const tenantId = path.split('/')[4];
      const body = JSON.parse(event.body || '{}');
      return await updateTenantStatus(tenantId, body.status, body.reason);
    }

    // DELETE /billing/admin/tenants/{tenantId} - Delete tenant and all resources
    if (httpMethod === 'DELETE' && path.match(/\/billing\/admin\/tenants\/[^\/]+$/)) {
      const tenantId = path.split('/')[4];
      return await deleteTenantAndResources(tenantId);
    }

    // POST /billing/generate-invoices - Generate monthly invoices (admin only)
    if (httpMethod === 'POST' && path === '/billing/generate-invoices') {
      return await generateMonthlyInvoices();
    }

    // ============================================================
    // STRIPE ENDPOINTS - Tenant Billing
    // ============================================================

    // GET /billing/stripe/subscription/{tenantId}
    if (httpMethod === 'GET' && path.match(/\/billing\/stripe\/subscription\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.getStripeSubscription(tenantId);
    }

    // POST /billing/stripe/create-subscription/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/stripe\/create-subscription\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.createStripeSubscription(tenantId, body);
    }

    // POST /billing/stripe/cancel-subscription/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/stripe\/cancel-subscription\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.cancelStripeSubscription(tenantId, body);
    }

    // GET /billing/stripe/payment-method/{tenantId}
    if (httpMethod === 'GET' && path.match(/\/billing\/stripe\/payment-method\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.getStripePaymentMethod(tenantId);
    }

    // POST /billing/stripe/payment-method/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/stripe\/payment-method\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.addStripePaymentMethod(tenantId, body);
    }

    // DELETE /billing/stripe/payment-method/{tenantId}
    if (httpMethod === 'DELETE' && path.match(/\/billing\/stripe\/payment-method\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.deleteStripePaymentMethod(tenantId, body);
    }

    // POST /billing/stripe/add-usage/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/stripe\/add-usage\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.addStripeUsage(tenantId, body);
    }

    // GET /billing/stripe/invoices/{tenantId}
    if (httpMethod === 'GET' && path.match(/\/billing\/stripe\/invoices\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.getStripeInvoices(tenantId);
    }

    // POST /billing/stripe/setup-intent/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/stripe\/setup-intent\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/').pop();
      const stripeHandlers = require('./stripe-handlers');
      return await stripeHandlers.createStripeSetupIntent(tenantId);
    }

    // ============================================================
    // MOLLIE ENDPOINTS - SEPA Mandate Billing
    // ============================================================

    // GET /billing/mollie/customer/{tenantId} - Get customer and mandate status
    if (httpMethod === 'GET' && path.match(/\/billing\/mollie\/customer\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.getMollieCustomer(tenantId);
    }

    // POST /billing/mollie/create-customer/{tenantId} - Create Mollie customer
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/create-customer\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const body = JSON.parse(event.body || '{}');
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.createMollieCustomer(tenantId, body);
    }

    // POST /billing/mollie/create-first-payment/{tenantId} - Create first payment for mandate
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/create-first-payment\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const body = JSON.parse(event.body || '{}');
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.createFirstPayment(tenantId, body);
    }

    // POST /billing/mollie/charge/{tenantId} - Charge tenant via mandate
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/charge\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const body = JSON.parse(event.body || '{}');
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.chargeTenant(tenantId, body);
    }

    // POST /billing/mollie/webhook - Mollie payment webhook
    if (httpMethod === 'POST' && path === '/billing/mollie/webhook') {
      const body = JSON.parse(event.body || '{}');
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.handleWebhook(body);
    }

    // GET /billing/mollie/payments/{tenantId} - Get payment history
    if (httpMethod === 'GET' && path.match(/\/billing\/mollie\/payments\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.getPaymentHistory(tenantId);
    }

    // DELETE /billing/mollie/mandate/{tenantId} - Revoke mandate
    if (httpMethod === 'DELETE' && path.match(/\/billing\/mollie\/mandate\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.revokeMandate(tenantId);
    }

    // POST /billing/mollie/process-monthly - Process monthly billing (cron)
    if (httpMethod === 'POST' && path === '/billing/mollie/process-monthly') {
      const mollieHandlers = require('./mollie-handlers');
      return await mollieHandlers.processMonthlyBilling();
    }

    // ============================================================
    // MOLLIE CONNECT ENDPOINTS - Creator Mitglieder-Abrechnung
    // ============================================================

    // POST /billing/mollie/connect/authorize/{tenantId} - Get OAuth URL
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/connect\/authorize\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.getConnectAuthorizeUrl(tenantId, body);
    }

    // GET /billing/mollie/connect/callback - OAuth Callback
    if (httpMethod === 'GET' && path === '/billing/mollie/connect/callback') {
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.handleConnectCallback(queryStringParameters || {});
    }

    // GET /billing/mollie/connect/status/{tenantId} - Check connection status
    if (httpMethod === 'GET' && path.match(/\/billing\/mollie\/connect\/status\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[5];
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.getConnectStatus(tenantId);
    }

    // DELETE /billing/mollie/connect/{tenantId} - Disconnect Mollie
    if (httpMethod === 'DELETE' && path.match(/\/billing\/mollie\/connect\/[^\/]+$/) && !path.includes('subscription')) {
      const tenantId = pathParameters?.tenantId || path.split('/')[4];
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.disconnectMollie(tenantId);
    }

    // POST /billing/mollie/connect/create-member-customer/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/connect\/create-member-customer\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.createMemberCustomer(tenantId, body);
    }

    // POST /billing/mollie/connect/create-member-mandate/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/connect\/create-member-mandate\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.createMemberMandate(tenantId, body);
    }

    // POST /billing/mollie/connect/create-member-subscription/{tenantId}
    if (httpMethod === 'POST' && path.match(/\/billing\/mollie\/connect\/create-member-subscription\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.createMemberSubscription(tenantId, body);
    }

    // GET /billing/mollie/connect/member-subscriptions/{tenantId}
    if (httpMethod === 'GET' && path.match(/\/billing\/mollie\/connect\/member-subscriptions\/[^\/]+$/)) {
      const tenantId = pathParameters?.tenantId || path.split('/')[5];
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.getMemberSubscriptions(tenantId);
    }

    // DELETE /billing/mollie/connect/member-subscription/{tenantId}/{subscriptionId}
    if (httpMethod === 'DELETE' && path.match(/\/billing\/mollie\/connect\/member-subscription\/[^\/]+\/[^\/]+$/)) {
      const pathParts = path.split('/');
      const tenantId = pathParts[5];
      const subscriptionId = pathParts[6];
      const body = JSON.parse(event.body || '{}');
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.cancelMemberSubscription(tenantId, subscriptionId, body.customerId);
    }

    // POST /billing/mollie/connect/webhook - Webhook for member payments
    if (httpMethod === 'POST' && path === '/billing/mollie/connect/webhook') {
      const body = JSON.parse(event.body || '{}');
      const mollieConnect = require('./mollie-connect-handlers');
      return await mollieConnect.handleConnectWebhook(body);
    }

    // GET /billing - Get billing info
    if (httpMethod === 'GET' && path === '/billing') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Billing API',
          endpoints: {
            invoices: 'GET /billing/invoices/{tenantId}',
            paymentMethod: 'GET /billing/payment-method/{tenantId}',
            setupIntent: 'POST /billing/setup-intent/{tenantId}',
            charge: 'POST /billing/charge/{tenantId}',
            estimate: 'GET /billing/estimate/{tenantId}?month=YYYY-MM',
            mollie: {
              customer: 'GET /billing/mollie/customer/{tenantId}',
              createCustomer: 'POST /billing/mollie/create-customer/{tenantId}',
              createFirstPayment: 'POST /billing/mollie/create-first-payment/{tenantId}',
              charge: 'POST /billing/mollie/charge/{tenantId}',
              payments: 'GET /billing/mollie/payments/{tenantId}',
              revokeMandate: 'DELETE /billing/mollie/mandate/{tenantId}',
              processMonthly: 'POST /billing/mollie/process-monthly',
              connect: {
                authorize: 'POST /billing/mollie/connect/authorize/{tenantId}',
                callback: 'GET /billing/mollie/connect/callback',
                status: 'GET /billing/mollie/connect/status/{tenantId}',
                disconnect: 'DELETE /billing/mollie/connect/{tenantId}',
                createMemberCustomer: 'POST /billing/mollie/connect/create-member-customer/{tenantId}',
                createMemberMandate: 'POST /billing/mollie/connect/create-member-mandate/{tenantId}',
                createMemberSubscription: 'POST /billing/mollie/connect/create-member-subscription/{tenantId}',
                memberSubscriptions: 'GET /billing/mollie/connect/member-subscriptions/{tenantId}',
                cancelMemberSubscription: 'DELETE /billing/mollie/connect/member-subscription/{tenantId}/{subscriptionId}',
                webhook: 'POST /billing/mollie/connect/webhook'
              }
            },
            stripe: {
              subscription: 'GET /billing/stripe/subscription/{tenantId}',
              createSubscription: 'POST /billing/stripe/create-subscription/{tenantId}',
              cancelSubscription: 'POST /billing/stripe/cancel-subscription/{tenantId}',
              paymentMethod: 'GET/POST/DELETE /billing/stripe/payment-method/{tenantId}',
              addUsage: 'POST /billing/stripe/add-usage/{tenantId}',
              invoices: 'GET /billing/stripe/invoices/{tenantId}',
              setupIntent: 'POST /billing/stripe/setup-intent/{tenantId}'
            }
          }
        })
      };
    }

    // Default 404
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Endpoint not found', path, method: httpMethod })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

// GET /billing/invoices/{tenantId}
async function getInvoices(tenantId) {
  console.log('Getting invoices for tenant:', tenantId);

  try {
    // Query invoices from DynamoDB (using tenant_id as secondary index)
    const command = new QueryCommand({
      TableName: INVOICES_TABLE,
      IndexName: 'user-id-index',
      KeyConditionExpression: 'user_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      },
      ScanIndexForward: false // newest first
    });

    const result = await docClient.send(command);
    const invoices = (result.Items || []).map(item => ({
      invoiceId: item.invoice_id,
      invoiceNumber: item.invoice_number,
      tenantId: item.user_id,
      amount: item.amount || 0,
      baseFee: item.base_fee || 30,
      awsCosts: item.aws_costs || 0,
      awsBreakdown: item.aws_breakdown || {},
      status: item.status || 'draft',
      period: item.period || { start: '', end: '' },
      createdAt: item.created_at,
      paidAt: item.paid_at,
      stripeInvoiceId: item.stripe_invoice_id,
      pdfUrl: item.pdf_url
    }));

    // Calculate current month estimate
    const now = new Date();
    const currentMonth = await calculateCurrentMonthEstimate(tenantId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        invoices,
        currentMonth
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

// Calculate current month estimate
async function calculateCurrentMonthEstimate(tenantId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  // Try to get AWS costs from Cost Explorer
  let awsCosts = 0;
  let awsBreakdown = {};

  try {
    const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
    const ce = new CostExplorerClient({ region: process.env.REGION || 'eu-central-1' });

    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0]; // up to today

    const command = new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      Filter: {
        Tags: { Key: 'TenantId', Values: [tenantId] }
      }
    });

    const response = await ce.send(command);
    
    if (response.ResultsByTime?.[0]?.Groups) {
      response.ResultsByTime[0].Groups.forEach(group => {
        const service = group.Keys[0];
        const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
        if (cost > 0) {
          awsBreakdown[service] = cost;
          awsCosts += cost;
        }
      });
    }
  } catch (error) {
    console.log('Cost Explorer not available or no costs:', error.message);
  }

  const baseFee = 30;
  return {
    baseFee,
    awsCosts: parseFloat(awsCosts.toFixed(2)),
    awsBreakdown,
    estimatedTotal: parseFloat((baseFee + awsCosts).toFixed(2)),
    period: {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    }
  };
}

// GET /billing/payment-method/{tenantId}
async function getPaymentMethodStatus(tenantId) {
  console.log('Getting payment method status for tenant:', tenantId);

  try {
    const command = new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    });

    const result = await docClient.send(command);
    
    if (result.Item && result.Item.stripe_customer_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          hasPaymentMethod: !!result.Item.payment_method_id,
          paymentMethod: result.Item.payment_method_id ? {
            type: result.Item.payment_method_type || 'card',
            last4: result.Item.payment_method_last4,
            brand: result.Item.payment_method_brand
          } : null
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ hasPaymentMethod: false })
    };
  } catch (error) {
    console.error('Error getting payment method:', error);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ hasPaymentMethod: false })
    };
  }
}

// POST /billing/setup-intent/{tenantId}
async function createSetupIntent(tenantId) {
  console.log('Creating setup intent for tenant:', tenantId);

  // Check if Stripe is configured
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Stripe not configured' })
    };
  }

  try {
    const stripe = require('stripe')(stripeKey);

    // Get or create Stripe customer
    let customerId;
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (billingRecord.Item?.stripe_customer_id) {
      customerId = billingRecord.Item.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        metadata: { tenantId }
      });
      customerId = customer.id;

      await docClient.send(new PutCommand({
        TableName: BILLING_TABLE,
        Item: {
          user_id: tenantId,
          stripe_customer_id: customerId,
          created_at: new Date().toISOString()
        }
      }));
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card', 'sepa_debit']
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ clientSecret: setupIntent.client_secret })
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

// POST /billing/charge/{tenantId}
async function createManualCharge(tenantId) {
  console.log('Creating manual charge for tenant:', tenantId);

  try {
    const currentMonth = await calculateCurrentMonthEstimate(tenantId);
    const amount = Math.round(currentMonth.estimatedTotal * 100); // cents

    // Create invoice record
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    await docClient.send(new PutCommand({
      TableName: INVOICES_TABLE,
      Item: {
        invoice_id: invoiceId,
        user_id: tenantId,
        amount: currentMonth.estimatedTotal,
        base_fee: currentMonth.baseFee,
        aws_costs: currentMonth.awsCosts,
        aws_breakdown: currentMonth.awsBreakdown,
        status: 'open',
        period: currentMonth.period,
        created_at: now.toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        invoiceId,
        amount: currentMonth.estimatedTotal,
        status: 'open'
      })
    };
  } catch (error) {
    console.error('Error creating manual charge:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create charge', message: error.message })
    };
  }
}

// GET /billing/invoices/{tenantId}/{invoiceId}/pdf
async function getInvoicePDF(tenantId, invoiceId) {
  console.log('Getting invoice PDF:', tenantId, invoiceId);

  try {
    // First try to find by invoice_id
    let result = await docClient.send(new GetCommand({
      TableName: INVOICES_TABLE,
      Key: { invoice_id: invoiceId }
    }));
    
    // If not found, try to find by invoice_number (scan)
    if (!result.Item) {
      console.log('Invoice not found by invoice_id, searching by invoice_number...');
      const scanResult = await docClient.send(new ScanCommand({
        TableName: INVOICES_TABLE,
        FilterExpression: 'invoice_number = :num AND user_id = :tenantId',
        ExpressionAttributeValues: { ':num': invoiceId, ':tenantId': tenantId }
      }));
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        result = { Item: scanResult.Items[0] };
        console.log('Found invoice by invoice_number:', result.Item.invoice_id);
      }
    }
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invoice not found' })
      };
    }

    // Check if PDF key exists and file actually exists in S3
    if (result.Item.pdf_key) {
      try {
        // Check if file exists by doing a HEAD request
        const { HeadObjectCommand } = require('@aws-sdk/client-s3');
        await s3Client.send(new HeadObjectCommand({
          Bucket: INVOICES_BUCKET,
          Key: result.Item.pdf_key
        }));
        
        // File exists, generate presigned URL
        const s3Command = new GetObjectCommand({
          Bucket: INVOICES_BUCKET,
          Key: result.Item.pdf_key,
          ResponseContentDisposition: `attachment; filename="Rechnung_${result.Item.invoice_number || invoiceId}.pdf"`
        });
        
        const presignedUrl = await getSignedUrl(s3Client, s3Command, { expiresIn: 3600 });
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ url: presignedUrl })
        };
      } catch (headError) {
        // File doesn't exist in S3, will regenerate below
        console.log('PDF file not found in S3, will regenerate:', headError.message);
      }
    }

    // PDF not found or doesn't exist - generate it on-demand
    console.log('PDF not found, generating on-demand...');
    
    try {
      const pdfResult = await generateInvoicePDFOnDemand(result.Item, tenantId);
      if (pdfResult.url) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ url: pdfResult.url })
        };
      }
    } catch (pdfError) {
      console.error('Error generating PDF on-demand:', pdfError);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'PDF not available. Please try again later.' })
    };
  } catch (error) {
    console.error('Error getting invoice PDF:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get PDF', message: error.message })
    };
  }
}

// Generate PDF on-demand if not exists - Premium Design
async function generateInvoicePDFOnDemand(invoice, tenantId) {
  const PDFDocument = require('pdfkit');
  
  // Get tenant info
  const tenantResult = await docClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  }));
  const tenant = tenantResult.Item || { tenant_id: tenantId };

  // Load billing config from S3 (use invoices bucket for config)
  let config;
  try {
    const configCommand = new GetObjectCommand({
      Bucket: INVOICES_BUCKET,
      Key: 'config/billing-config.json'
    });
    const configResponse = await s3Client.send(configCommand);
    const configBody = await configResponse.Body.transformToString();
    config = JSON.parse(configBody);
  } catch (e) {
    console.log('Using default billing config');
    config = {
      company: {
        name: 'Viral Tenant GmbH',
        address: { street: 'Bahnhofstrasse 59', zip: '6312', city: 'Steinhausen', country: 'Schweiz' },
        contact: { email: 'billing@viraltenant.com', website: 'https://viraltenant.com', phone: '+41 76 361 28 39' },
        managing_director: 'Niels Fink'
      },
      tax: { vat_rate: 7.7 },
      banking: { bank_name: 'Zuger Kantonalbank', iban: 'CH2000787786265727503', bic: 'KBZGCH22XXX', account_holder: 'Niels Fink' },
      invoice: { footer_text: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.', thank_you_text: 'Vielen Dank für Ihr Vertrauen!' },
      logo: { s3_key: 'assets/viraltenant-logo.png' }
    };
  }

  // Load logo from S3
  let logoBuffer = null;
  try {
    const logoKey = config.logo?.s3_key || 'assets/viraltenant-logo.png';
    const logoResponse = await s3Client.send(new GetObjectCommand({
      Bucket: INVOICES_BUCKET,
      Key: logoKey
    }));
    logoBuffer = Buffer.from(await logoResponse.Body.transformToByteArray());
    console.log('Logo loaded successfully');
  } catch (e) {
    console.log('Logo not found, using text fallback:', e.message);
  }

  // Generate Premium PDF
  const pdfBuffer = await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Premium Colors
      const primaryColor = '#7c3aed';    // Vibrant Purple
      const accentColor = '#a78bfa';     // Light Purple
      const goldColor = '#d4af37';       // Premium Gold
      const darkColor = '#1e1b4b';       // Deep Indigo
      const textColor = '#374151';       // Gray 700
      const lightText = '#6b7280';       // Gray 500
      const bgLight = '#faf5ff';         // Purple 50
      const white = '#ffffff';

      const pageWidth = 595.28;
      const pageHeight = 841.89;

      // === PREMIUM HEADER ===
      // Top bar
      doc.rect(0, 0, pageWidth, 100).fill(darkColor);
      
      // Decorative accent line
      doc.rect(0, 100, pageWidth, 3).fill(goldColor);

      // Logo area (left side) - smaller, elegant
      if (logoBuffer) {
        doc.image(logoBuffer, 50, 20, { width: 100 });
      } else {
        // Elegant text logo fallback
        doc.fontSize(22).fillColor(white).font('Times-Bold');
        doc.text('VIRALTENANT', 50, 30);
        doc.fontSize(9).fillColor(accentColor).font('Times-Roman');
        doc.text('Content Creator Platform', 50, 55);
      }

      // Company info (right side) - elegant styling
      doc.fontSize(10).fillColor(white).font('Times-Bold');
      doc.text(config.company.name, 350, 25, { align: 'right', width: 195 });
      doc.fontSize(9).fillColor(accentColor).font('Times-Roman');
      doc.text(config.company.address.street, 350, 42, { align: 'right', width: 195 });
      doc.text(`${config.company.address.zip} ${config.company.address.city}`, 350, 55, { align: 'right', width: 195 });
      doc.text(config.company.address.country, 350, 68, { align: 'right', width: 195 });
      doc.fillColor(goldColor);
      doc.text(config.company.contact.website, 350, 83, { align: 'right', width: 195 });

      // === INVOICE TITLE SECTION ===
      doc.fontSize(26).fillColor(darkColor).font('Times-Bold');
      doc.text('RECHNUNG', 50, 125);
      
      // Elegant underline
      doc.rect(50, 158, 60, 3).fill(primaryColor);
      doc.rect(110, 158, 30, 3).fill(accentColor);
      doc.rect(140, 158, 15, 3).fill(goldColor);

      // === INVOICE META INFO (right side) - Card style ===
      const metaBoxX = 350;
      const metaBoxY = 120;
      const metaBoxWidth = 195;
      const metaBoxHeight = 80;
      
      // Subtle background for meta info
      doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 6).fill(bgLight);
      doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 6).lineWidth(1).stroke(accentColor);
      
      doc.fontSize(7).fillColor(lightText).font('Times-Roman');
      doc.text('RECHNUNGSNUMMER', metaBoxX + 12, metaBoxY + 10);
      doc.text('DATUM', metaBoxX + 12, metaBoxY + 33);
      doc.text('LEISTUNGSZEITRAUM', metaBoxX + 12, metaBoxY + 56);
      
      doc.fontSize(10).fillColor(darkColor).font('Times-Bold');
      doc.text(invoice.invoice_number || invoice.invoice_id, metaBoxX + 12, metaBoxY + 20, { width: metaBoxWidth - 24 });
      doc.font('Times-Roman').fontSize(9).fillColor(textColor);
      doc.text(new Date(invoice.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), metaBoxX + 12, metaBoxY + 43);
      const periodStart = invoice.period?.start ? new Date(invoice.period.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : '-';
      doc.text(periodStart, metaBoxX + 12, metaBoxY + 66);

      // === CUSTOMER INFO - Elegant Card ===
      const customerY = 215;
      doc.roundedRect(50, customerY, 250, 70, 6).fill(bgLight);
      doc.roundedRect(50, customerY, 250, 70, 6).lineWidth(1).stroke(accentColor);
      
      doc.fontSize(7).fillColor(primaryColor).font('Times-Bold');
      doc.text('RECHNUNGSEMPFÄNGER', 62, customerY + 10);
      
      doc.fontSize(13).fillColor(darkColor).font('Times-Bold');
      doc.text(tenant.creator_name || tenant.name || 'Kunde', 62, customerY + 24);
      doc.font('Times-Roman').fontSize(8).fillColor(lightText);
      if (tenant.subdomain) {
        doc.text(`${tenant.subdomain}.viraltenant.com`, 62, customerY + 42);
      }
      doc.fontSize(7).fillColor(lightText);
      doc.text(`Tenant-ID: ${tenantId}`, 62, customerY + 54);

      // === LINE ITEMS TABLE - Premium Design ===
      const tableTop = 310;
      const tableWidth = 495;
      const tableLeft = 50;
      
      // Table header
      doc.rect(tableLeft, tableTop, tableWidth, 35).fill(darkColor);
      
      // Header text
      doc.fontSize(10).fillColor(white).font('Times-Bold');
      doc.text('Beschreibung', tableLeft + 18, tableTop + 12);
      doc.text('Betrag', tableLeft + tableWidth - 95, tableTop + 12, { align: 'right', width: 75 });

      let yPos = tableTop + 48;
      let rowIndex = 0;
      
      const addRow = (description, amount, isSubItem = false, isLast = false) => {
        const rowHeight = 28;
        
        // Alternating row backgrounds
        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos - 6, tableWidth, rowHeight).fill(bgLight);
        } else {
          doc.rect(tableLeft, yPos - 6, tableWidth, rowHeight).fill(white);
        }
        
        // Row border
        doc.moveTo(tableLeft, yPos + rowHeight - 6).lineTo(tableLeft + tableWidth, yPos + rowHeight - 6).lineWidth(0.5).stroke('#e5e7eb');
        
        // Text
        doc.fillColor(isSubItem ? lightText : textColor);
        doc.fontSize(isSubItem ? 8 : 9).font(isSubItem ? 'Times-Roman' : 'Times-Bold');
        doc.text(isSubItem ? `    ${description}` : description, tableLeft + 18, yPos);
        
        doc.fillColor(isSubItem ? lightText : darkColor);
        doc.fontSize(isSubItem ? 8 : 9).font('Times-Roman');
        doc.text(`${amount.toFixed(2)} €`, tableLeft + tableWidth - 95, yPos, { align: 'right', width: 75 });
        
        yPos += rowHeight;
        rowIndex++;
      };
      
      // Base fee
      addRow('Monatliche Grundgebühr ViralTenant Platform', invoice.base_fee || 30);

      // AWS costs breakdown
      if (invoice.aws_breakdown && Object.keys(invoice.aws_breakdown).length > 0) {
        const labels = {
          dynamodb: 'DynamoDB Datenbank', s3: 'S3 Speicher', lambda: 'Lambda Funktionen',
          cloudfront: 'CloudFront CDN', apigateway: 'API Gateway', mediaconvert: 'MediaConvert Video',
          ses: 'E-Mail Service (SES)', other: 'Sonstige AWS Services'
        };
        for (const [key, cost] of Object.entries(invoice.aws_breakdown)) {
          if (cost > 0) addRow(labels[key] || key, cost, true);
        }
      } else if (invoice.aws_costs > 0) {
        addRow('AWS Infrastrukturkosten', invoice.aws_costs, true);
      }

      // AI costs if present
      if (invoice.ai_costs > 0) {
        addRow('KI Services (Transcribe & Bedrock)', invoice.ai_costs, true);
      }

      // === TOTALS SECTION - Premium Card ===
      yPos += 15;
      const totalsX = 320;
      const totalsWidth = 225;
      
      doc.roundedRect(totalsX, yPos, totalsWidth, 90, 6).fill(bgLight);
      doc.roundedRect(totalsX, yPos, totalsWidth, 90, 6).lineWidth(1).stroke(accentColor);

      const totalAmount = invoice.amount || invoice.base_fee || 30;
      const vatRate = config.tax?.vat_rate || 7.7;
      const netAmount = totalAmount / (1 + vatRate / 100);
      const vatAmount = totalAmount - netAmount;
      
      doc.fontSize(9).fillColor(lightText).font('Times-Roman');
      doc.text('Nettobetrag:', totalsX + 12, yPos + 12);
      doc.fillColor(textColor);
      doc.text(`${netAmount.toFixed(2)} €`, totalsX + totalsWidth - 90, yPos + 12, { align: 'right', width: 75 });
      
      doc.fillColor(lightText);
      doc.text(`MwSt. (${vatRate}%):`, totalsX + 12, yPos + 30);
      doc.fillColor(textColor);
      doc.text(`${vatAmount.toFixed(2)} €`, totalsX + totalsWidth - 90, yPos + 30, { align: 'right', width: 75 });
      
      // Separator line
      doc.moveTo(totalsX + 12, yPos + 50).lineTo(totalsX + totalsWidth - 12, yPos + 50).lineWidth(1).stroke(accentColor);

      // Total amount - highlighted
      doc.fontSize(11).fillColor(darkColor).font('Times-Bold');
      doc.text('Gesamtbetrag:', totalsX + 12, yPos + 62);
      doc.fillColor(primaryColor).fontSize(12);
      doc.text(`${totalAmount.toFixed(2)} €`, totalsX + totalsWidth - 90, yPos + 62, { align: 'right', width: 75 });

      // === PAYMENT STATUS SECTION (if paid) ===
      const isPaid = invoice.status === 'paid' && invoice.paid_at;
      let paymentY = yPos + 110;
      
      if (isPaid) {
        // PAID stamp/banner
        doc.roundedRect(50, paymentY, 250, 70, 6).fill('#dcfce7'); // Green background
        doc.roundedRect(50, paymentY, 250, 70, 6).lineWidth(2).stroke('#16a34a');
        
        doc.fontSize(16).fillColor('#16a34a').font('Times-Bold');
        doc.text('✓ BEZAHLT', 62, paymentY + 12);
        
        doc.fontSize(8).fillColor('#166534').font('Times-Roman');
        const paidDate = new Date(invoice.paid_at);
        const paidDateStr = paidDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
        const paidTimeStr = paidDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        doc.text(`Bezahlt am: ${paidDateStr} um ${paidTimeStr} Uhr`, 62, paymentY + 34);
        
        // Payment method details
        if (invoice.payment_method === 'mollie' || invoice.mollie_payment_id) {
          doc.text(`Zahlungsart: SEPA-Lastschrift (Mollie)`, 62, paymentY + 46);
          doc.text(`Transaktions-ID: ${invoice.mollie_payment_id || '-'}`, 62, paymentY + 58);
        } else if (invoice.payment_method === 'paypal') {
          doc.text(`Zahlungsart: PayPal`, 62, paymentY + 46);
          doc.text(`Transaktions-ID: ${invoice.paypal_capture_id || '-'}`, 62, paymentY + 58);
        } else if (invoice.payment_method) {
          doc.text(`Zahlungsart: ${invoice.payment_method}`, 62, paymentY + 46);
        }
        
        paymentY += 80; // Move down for banking/contact cards
      }

      // === PAYMENT INFO SECTION - Compact ===
      const cardHeight = 85;
      
      // Banking info card (only show if not paid)
      if (!isPaid) {
        doc.roundedRect(50, paymentY, 235, cardHeight, 6).lineWidth(1).stroke('#e5e7eb');
        
        doc.fontSize(9).fillColor(primaryColor).font('Times-Bold');
        doc.text('BANKVERBINDUNG', 62, paymentY + 10);
        
        doc.fontSize(8).fillColor(textColor).font('Times-Roman');
        doc.text(`Bank: ${config.banking?.bank_name || '-'}`, 62, paymentY + 26);
        doc.text(`IBAN: ${config.banking?.iban || '-'}`, 62, paymentY + 40);
        doc.text(`BIC: ${config.banking?.bic || '-'}`, 62, paymentY + 54);
        doc.text(`Inhaber: ${config.banking?.account_holder || '-'}`, 62, paymentY + 68);
      }

      // Contact info card
      const contactCardX = isPaid ? 50 : 310;
      const contactCardWidth = isPaid ? 495 : 235;
      doc.roundedRect(contactCardX, paymentY, contactCardWidth, cardHeight, 6).lineWidth(1).stroke('#e5e7eb');
      
      doc.fontSize(9).fillColor(primaryColor).font('Times-Bold');
      doc.text('KONTAKT', contactCardX + 12, paymentY + 10);
      
      doc.fontSize(8).fillColor(textColor).font('Times-Roman');
      doc.text(config.company.contact?.email || '-', contactCardX + 12, paymentY + 26);
      doc.text(config.company.contact?.phone || '-', contactCardX + 12, paymentY + 40);
      doc.text(config.company.contact?.website || '-', contactCardX + 12, paymentY + 54);
      if (config.company.managing_director) {
        doc.text(`Geschäftsführer: ${config.company.managing_director}`, contactCardX + 12, paymentY + 68);
      }

      // === PREMIUM FOOTER ===
      // Footer background
      doc.rect(0, pageHeight - 50, pageWidth, 50).fill(darkColor);
      
      // Footer text - different for paid vs unpaid
      doc.fontSize(8).fillColor(accentColor).font('Times-Roman');
      if (isPaid) {
        doc.text('Diese Rechnung wurde bereits beglichen. Vielen Dank für Ihre Zahlung!', 0, pageHeight - 38, { align: 'center', width: pageWidth });
      } else {
        doc.text(config.invoice?.footer_text || 'Zahlbar innerhalb von 14 Tagen ohne Abzug.', 0, pageHeight - 38, { align: 'center', width: pageWidth });
      }
      
      doc.fontSize(9).fillColor(goldColor).font('Times-Bold');
      doc.text(config.invoice?.thank_you_text || 'Vielen Dank für Ihr Vertrauen!', 0, pageHeight - 22, { align: 'center', width: pageWidth });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

  // Upload to S3 invoices bucket - use invoice_number for better readability
  const pdfKey = `invoices/${tenantId}/${invoice.invoice_number || invoice.invoice_id}.pdf`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: INVOICES_BUCKET,
    Key: pdfKey,
    Body: pdfBuffer,
    ContentType: 'application/pdf'
  }));

  // Update invoice with pdf_key
  await docClient.send(new UpdateCommand({
    TableName: INVOICES_TABLE,
    Key: { invoice_id: invoice.invoice_id },
    UpdateExpression: 'SET pdf_key = :pdfKey',
    ExpressionAttributeValues: { ':pdfKey': pdfKey }
  }));

  // Generate presigned URL
  const s3Command = new GetObjectCommand({
    Bucket: INVOICES_BUCKET,
    Key: pdfKey,
    ResponseContentDisposition: `attachment; filename="Rechnung_${invoice.invoice_number || invoice.invoice_id}.pdf"`
  });
  
  const presignedUrl = await getSignedUrl(s3Client, s3Command, { expiresIn: 3600 });
  
  return { url: presignedUrl };
}

// GET /billing/estimate/{tenantId}
async function getBillingEstimate(tenantId, month) {
  console.log('Getting billing estimate for tenant:', tenantId, 'month:', month);

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'tenantId is required' })
    };
  }

  try {
    const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
    const ce = new CostExplorerClient({ region: process.env.REGION || 'eu-central-1' });

    let currentMonth = month;
    if (!currentMonth) {
      const now = new Date();
      currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [year, monthNum] = currentMonth.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];

    const command = new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'TAG', Key: 'BillingGroup' }],
      Filter: { Tags: { Key: 'TenantId', Values: [tenantId] } }
    });

    const response = await ce.send(command);
    
    const costs = { multistream: 0, videohost: 0, domain: 0, crosspost: 0 };

    if (response.ResultsByTime?.[0]?.Groups) {
      response.ResultsByTime[0].Groups.forEach(group => {
        const billingGroup = group.Keys[0];
        const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
        if (costs.hasOwnProperty(billingGroup)) {
          costs[billingGroup] = cost;
        }
      });
    }

    const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
    const baseFee = 30.00;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        month: currentMonth,
        baseFee,
        breakdown: {
          multistream: { label: 'Multistreaming', cost: parseFloat(costs.multistream.toFixed(2)), usage: 'N/A' },
          videohost: { label: 'Videohosting', cost: parseFloat(costs.videohost.toFixed(2)), usage: 'N/A' },
          domain: { label: 'Domain', cost: parseFloat(costs.domain.toFixed(2)), usage: 'N/A' },
          crosspost: { label: 'Crossposting', cost: parseFloat(costs.crosspost.toFixed(2)), usage: 'N/A' }
        },
        estimatedTotal: parseFloat((baseFee + totalCost).toFixed(2)),
        lastUpdated: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error fetching costs:', error);
    
    // Return default estimate on error
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        month: month || new Date().toISOString().slice(0, 7),
        baseFee: 30.00,
        breakdown: {
          multistream: { label: 'Multistreaming', cost: 0, usage: 'N/A' },
          videohost: { label: 'Videohosting', cost: 0, usage: 'N/A' },
          domain: { label: 'Domain', cost: 0, usage: 'N/A' },
          crosspost: { label: 'Crossposting', cost: 0, usage: 'N/A' }
        },
        estimatedTotal: 30.00,
        lastUpdated: new Date().toISOString(),
        note: 'Cost data not available'
      })
    };
  }
}

// ============================================================
// PayPal Billing Functions
// ============================================================

// GET /billing/payment-methods/{tenantId} - Get available payment methods
async function getAvailablePaymentMethods(tenantId) {
  console.log('Getting available payment methods for tenant:', tenantId);

  const methods = {
    paypal: {
      enabled: true,
      name: 'PayPal',
      description: 'Bezahlen Sie sicher mit PayPal'
    },
    paddle: {
      enabled: true,
      name: 'Kreditkarte / Paddle',
      description: 'Bezahlen Sie mit Kreditkarte, Apple Pay, Google Pay und mehr'
    },
    stripe: {
      enabled: !!process.env.STRIPE_SECRET_KEY,
      name: 'Kreditkarte / SEPA',
      description: 'Bezahlen Sie mit Karte oder Lastschrift'
    }
  };

  // Check if tenant has saved payment method
  try {
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (billingRecord.Item) {
      methods.savedPaymentMethod = {
        type: billingRecord.Item.payment_method_type || null,
        last4: billingRecord.Item.payment_method_last4 || null,
        brand: billingRecord.Item.payment_method_brand || null
      };
    }
  } catch (error) {
    console.error('Error checking saved payment method:', error);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(methods)
  };
}

// POST /billing/paypal/create-order/{tenantId} - Create PayPal order for invoice payment
async function createPayPalBillingOrder(tenantId, invoiceId, returnBaseUrl) {
  console.log('Creating PayPal billing order for tenant:', tenantId, 'invoice:', invoiceId, 'returnBaseUrl:', returnBaseUrl);

  try {
    let amount;
    let description;

    if (invoiceId) {
      // Get invoice details
      const invoiceResult = await docClient.send(new GetCommand({
        TableName: INVOICES_TABLE,
        Key: { invoice_id: invoiceId }
      }));

      if (!invoiceResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Rechnung nicht gefunden' })
        };
      }

      amount = invoiceResult.Item.amount;
      description = `Viral Tenant Rechnung ${invoiceId}`;
    } else {
      // Calculate current month estimate
      const currentMonth = await calculateCurrentMonthEstimate(tenantId);
      amount = currentMonth.estimatedTotal;
      description = `Viral Tenant Abrechnung - ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Use provided returnBaseUrl or fallback to default
    const baseUrl = returnBaseUrl || 'https://viraltenant.com';
    const returnUrl = `${baseUrl}/tenant?payment=success&provider=paypal`;
    const cancelUrl = `${baseUrl}/tenant?payment=cancelled`;

    console.log('PayPal return URLs:', { returnUrl, cancelUrl });

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: invoiceId || `billing_${tenantId}_${Date.now()}`,
          description: description,
          custom_id: tenantId,
          amount: {
            currency_code: 'EUR',
            value: amount.toFixed(2)
          }
        }],
        application_context: {
          brand_name: 'Viral Tenant',
          locale: 'de-DE',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      })
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error('PayPal create order error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Fehler beim Erstellen der PayPal-Bestellung' })
      };
    }

    const orderData = await orderResponse.json();
    const approvalUrl = orderData.links.find(link => link.rel === 'approve')?.href;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        orderId: orderData.id,
        approvalUrl: approvalUrl,
        amount: amount
      })
    };
  } catch (error) {
    console.error('Error creating PayPal billing order:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Fehler beim Erstellen der PayPal-Bestellung', message: error.message })
    };
  }
}

// POST /billing/paypal/capture/{tenantId} - Capture PayPal payment
async function capturePayPalBillingPayment(tenantId, orderId, invoiceId) {
  console.log('Capturing PayPal billing payment:', tenantId, orderId, invoiceId);

  try {
    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the payment
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!captureResponse.ok) {
      const error = await captureResponse.text();
      console.error('PayPal capture error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Fehler beim Erfassen der PayPal-Zahlung' })
      };
    }

    const captureData = await captureResponse.json();
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const amount = parseFloat(captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);

    // If we have an invoice ID, update it
    if (invoiceId) {
      await docClient.send(new UpdateCommand({
        TableName: INVOICES_TABLE,
        Key: { invoice_id: invoiceId },
        UpdateExpression: 'SET #status = :status, paid_at = :paidAt, paypal_capture_id = :captureId, payment_method = :method',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'paid',
          ':paidAt': new Date().toISOString(),
          ':captureId': captureId,
          ':method': 'paypal'
        }
      }));
    } else {
      // Create a new invoice record for this payment
      const newInvoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const currentMonth = await calculateCurrentMonthEstimate(tenantId);

      await docClient.send(new PutCommand({
        TableName: INVOICES_TABLE,
        Item: {
          invoice_id: newInvoiceId,
          user_id: tenantId,
          amount: amount,
          base_fee: currentMonth.baseFee,
          aws_costs: currentMonth.awsCosts,
          aws_breakdown: currentMonth.awsBreakdown,
          status: 'paid',
          period: currentMonth.period,
          created_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
          paypal_order_id: orderId,
          paypal_capture_id: captureId,
          payment_method: 'paypal'
        }
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        captureId: captureId,
        status: captureData.status,
        amount: amount
      })
    };
  } catch (error) {
    console.error('Error capturing PayPal billing payment:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Fehler beim Erfassen der Zahlung', message: error.message })
    };
  }
}


// ============================================================
// Paddle Functions
// ============================================================

// POST /billing/paddle/create-transaction/{tenantId} - Create Paddle transaction
async function createPaddleTransaction(tenantId, invoiceId, returnBaseUrl) {
  console.log('Creating Paddle transaction for tenant:', tenantId, 'invoice:', invoiceId, 'returnBaseUrl:', returnBaseUrl);

  try {
    let amount;
    let description;

    if (invoiceId) {
      // Get invoice details
      const invoiceResult = await docClient.send(new GetCommand({
        TableName: INVOICES_TABLE,
        Key: { invoice_id: invoiceId }
      }));

      if (!invoiceResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Rechnung nicht gefunden' })
        };
      }

      amount = invoiceResult.Item.amount;
      description = `Viral Tenant Rechnung ${invoiceId}`;
    } else {
      // Calculate current month estimate
      const currentMonth = await calculateCurrentMonthEstimate(tenantId);
      amount = currentMonth.estimatedTotal;
      description = `Viral Tenant Abrechnung - ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
    }

    // Use provided returnBaseUrl or fallback to default
    const baseUrl = returnBaseUrl || 'https://viraltenant.com';
    const checkoutSuccessUrl = `${baseUrl}/tenant?payment=success&provider=paddle`;

    console.log('Paddle checkout URL:', checkoutSuccessUrl);

    // Create Paddle transaction using the Paddle API
    const transactionResponse = await fetch(`${PADDLE_BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          price: {
            description: description,
            name: 'Viral Tenant Abrechnung',
            unit_price: {
              amount: Math.round(amount * 100).toString(), // Paddle expects cents as string
              currency_code: 'EUR'
            },
            product: {
              name: 'Viral Tenant Abrechnung',
              description: description,
              tax_category: 'standard'
            }
          },
          quantity: 1
        }],
        custom_data: {
          tenant_id: tenantId,
          invoice_id: invoiceId || `billing_${tenantId}_${Date.now()}`
        },
        checkout: {
          url: checkoutSuccessUrl
        }
      })
    });

    if (!transactionResponse.ok) {
      const error = await transactionResponse.text();
      console.error('Paddle create transaction error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Fehler beim Erstellen der Paddle-Transaktion', details: error })
      };
    }

    const transactionData = await transactionResponse.json();
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        transactionId: transactionData.data.id,
        checkoutUrl: transactionData.data.checkout?.url,
        amount: amount,
        status: transactionData.data.status
      })
    };
  } catch (error) {
    console.error('Error creating Paddle transaction:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Fehler beim Erstellen der Paddle-Transaktion', message: error.message })
    };
  }
}

// POST /billing/paddle/verify/{tenantId} - Verify Paddle payment status
async function verifyPaddlePayment(tenantId, transactionId, invoiceId) {
  console.log('Verifying Paddle payment:', tenantId, transactionId, invoiceId);

  try {
    // Get transaction status from Paddle
    const transactionResponse = await fetch(`${PADDLE_BASE_URL}/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!transactionResponse.ok) {
      const error = await transactionResponse.text();
      console.error('Paddle get transaction error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Fehler beim Prüfen der Zahlung' })
      };
    }

    const transactionData = await transactionResponse.json();
    const status = transactionData.data.status;
    
    // Check if payment is completed
    const isCompleted = status === 'completed' || status === 'paid';
    const isPending = status === 'pending' || status === 'billed';
    const amount = parseFloat(transactionData.data.details?.totals?.total || 0) / 100; // Convert from cents

    if (isCompleted) {
      // Update invoice if provided
      if (invoiceId) {
        await docClient.send(new UpdateCommand({
          TableName: INVOICES_TABLE,
          Key: { invoice_id: invoiceId },
          UpdateExpression: 'SET #status = :status, paid_at = :paidAt, paddle_transaction_id = :transactionId, payment_method = :method',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'paid',
            ':paidAt': new Date().toISOString(),
            ':transactionId': transactionId,
            ':method': 'paddle'
          }
        }));
      } else {
        // Create a new invoice record for this payment
        const newInvoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const currentMonth = await calculateCurrentMonthEstimate(tenantId);

        await docClient.send(new PutCommand({
          TableName: INVOICES_TABLE,
          Item: {
            invoice_id: newInvoiceId,
            user_id: tenantId,
            amount: amount,
            base_fee: currentMonth.baseFee,
            aws_costs: currentMonth.awsCosts,
            aws_breakdown: currentMonth.awsBreakdown,
            status: 'paid',
            period: currentMonth.period,
            created_at: new Date().toISOString(),
            paid_at: new Date().toISOString(),
            paddle_transaction_id: transactionId,
            payment_method: 'paddle'
          }
        }));
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: isCompleted,
        status: status,
        isPending: isPending,
        amount: amount,
        transactionId: transactionId
      })
    };
  } catch (error) {
    console.error('Error verifying Paddle payment:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Fehler beim Prüfen der Zahlung', message: error.message })
    };
  }
}


// ============================================================
// Paddle Subscription Billing Functions
// ============================================================

// PUT /billing/paddle/subscription/{tenantId} - Set Paddle subscription for tenant
async function setTenantSubscription(tenantId, subscriptionId, customerId) {
  console.log('Setting Paddle subscription for tenant:', tenantId, subscriptionId, customerId);

  if (!subscriptionId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'subscriptionId is required' })
    };
  }

  try {
    // Update tenant record with Paddle subscription info
    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: 'SET paddle_subscription_id = :subId, paddle_customer_id = :custId, paddle_updated_at = :updatedAt',
      ExpressionAttributeValues: {
        ':subId': subscriptionId,
        ':custId': customerId || null,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // Also store in billing table for quick access
    await docClient.send(new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId },
      UpdateExpression: 'SET paddle_subscription_id = :subId, paddle_customer_id = :custId, updated_at = :updatedAt',
      ExpressionAttributeValues: {
        ':subId': subscriptionId,
        ':custId': customerId || null,
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        tenantId,
        subscriptionId,
        customerId
      })
    };
  } catch (error) {
    console.error('Error setting tenant subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to set subscription', message: error.message })
    };
  }
}

// GET /billing/paddle/subscription/{tenantId} - Get Paddle subscription for tenant
async function getTenantSubscription(tenantId) {
  console.log('Getting Paddle subscription for tenant:', tenantId);

  try {
    const result = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));

    if (!result.Item || !result.Item.paddle_subscription_id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          hasSubscription: false,
          tenantId
        })
      };
    }

    // Get subscription details from Paddle
    const subscriptionId = result.Item.paddle_subscription_id;
    const subscriptionResponse = await fetch(`${PADDLE_BASE_URL}/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let paddleSubscription = null;
    if (subscriptionResponse.ok) {
      const data = await subscriptionResponse.json();
      paddleSubscription = {
        id: data.data.id,
        status: data.data.status,
        nextBilledAt: data.data.next_billed_at,
        currentBillingPeriod: data.data.current_billing_period,
        items: data.data.items
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        hasSubscription: true,
        tenantId,
        subscriptionId,
        customerId: result.Item.paddle_customer_id,
        paddleSubscription
      })
    };
  } catch (error) {
    console.error('Error getting tenant subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get subscription', message: error.message })
    };
  }
}

// POST /billing/paddle/add-aws-costs/{tenantId} - Add AWS costs as one-time charge to subscription
async function addAwsCostsToSubscription(tenantId, subscriptionId, amount, description) {
  console.log('Adding AWS costs to subscription:', tenantId, subscriptionId, amount, description);

  try {
    // If no subscriptionId provided, get it from tenant record
    let subId = subscriptionId;
    if (!subId) {
      const billingRecord = await docClient.send(new GetCommand({
        TableName: BILLING_TABLE,
        Key: { user_id: tenantId }
      }));

      if (!billingRecord.Item?.paddle_subscription_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Tenant has no Paddle subscription' })
        };
      }
      subId = billingRecord.Item.paddle_subscription_id;
    }

    // If no amount provided, calculate current AWS costs
    let awsCosts = amount;
    let costDescription = description;
    
    if (!awsCosts) {
      const currentMonth = await calculateCurrentMonthEstimate(tenantId);
      awsCosts = currentMonth.awsCosts;
      const now = new Date();
      costDescription = description || `AWS Infrastruktur ${now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
    }

    if (awsCosts <= 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'No AWS costs to add',
          amount: 0
        })
      };
    }

    // Add one-time charge to subscription using Paddle API
    // This will be added to the next billing period
    const chargeResponse = await fetch(`${PADDLE_BASE_URL}/subscriptions/${subId}/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        effective_from: 'next_billing_period',
        items: [{
          price: {
            description: costDescription,
            name: 'AWS Infrastrukturkosten',
            billing_cycle: null, // One-time charge
            unit_price: {
              amount: Math.round(awsCosts * 100).toString(), // Paddle expects cents as string
              currency_code: 'EUR'
            },
            product: {
              name: 'AWS Infrastruktur',
              description: costDescription,
              tax_category: 'standard'
            }
          },
          quantity: 1
        }]
      })
    });

    if (!chargeResponse.ok) {
      const error = await chargeResponse.text();
      console.error('Paddle add charge error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Fehler beim Hinzufügen der AWS-Kosten', details: error })
      };
    }

    const chargeData = await chargeResponse.json();

    // Log the charge in our billing table
    const chargeId = `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await docClient.send(new PutCommand({
      TableName: INVOICES_TABLE,
      Item: {
        invoice_id: chargeId,
        user_id: tenantId,
        type: 'aws_charge',
        amount: awsCosts,
        description: costDescription,
        paddle_subscription_id: subId,
        status: 'pending', // Will be 'paid' when subscription renews
        created_at: new Date().toISOString(),
        effective_from: 'next_billing_period'
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        chargeId,
        subscriptionId: subId,
        amount: awsCosts,
        description: costDescription,
        effectiveFrom: 'next_billing_period',
        paddleResponse: chargeData.data
      })
    };
  } catch (error) {
    console.error('Error adding AWS costs to subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Fehler beim Hinzufügen der AWS-Kosten', message: error.message })
    };
  }
}

// POST /billing/paddle/process-monthly - Process monthly billing for all tenants
async function processMonthlyBilling() {
  console.log('Processing monthly billing for all tenants');

  const results = {
    processed: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  try {
    // Get all tenants with Paddle subscriptions from billing table
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const scanResult = await docClient.send(new ScanCommand({
      TableName: BILLING_TABLE,
      FilterExpression: 'attribute_exists(paddle_subscription_id)'
    }));

    const tenantsWithSubscriptions = scanResult.Items || [];
    console.log(`Found ${tenantsWithSubscriptions.length} tenants with Paddle subscriptions`);

    for (const tenant of tenantsWithSubscriptions) {
      const tenantId = tenant.user_id;
      const subscriptionId = tenant.paddle_subscription_id;

      try {
        // Calculate AWS costs for this tenant
        const currentMonth = await calculateCurrentMonthEstimate(tenantId);
        const awsCosts = currentMonth.awsCosts;

        if (awsCosts <= 0) {
          results.skipped++;
          results.details.push({
            tenantId,
            status: 'skipped',
            reason: 'No AWS costs'
          });
          continue;
        }

        // Add AWS costs to subscription
        const now = new Date();
        const description = `AWS Infrastruktur ${now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;

        const chargeResponse = await fetch(`${PADDLE_BASE_URL}/subscriptions/${subscriptionId}/charge`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PADDLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            effective_from: 'next_billing_period',
            items: [{
              price: {
                description: description,
                name: 'AWS Infrastrukturkosten',
                billing_cycle: null,
                unit_price: {
                  amount: Math.round(awsCosts * 100).toString(),
                  currency_code: 'EUR'
                },
                product: {
                  name: 'AWS Infrastruktur',
                  description: description,
                  tax_category: 'standard'
                }
              },
              quantity: 1
            }]
          })
        });

        if (!chargeResponse.ok) {
          const error = await chargeResponse.text();
          results.errors.push({
            tenantId,
            error: error
          });
          continue;
        }

        // Log the charge
        const chargeId = `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await docClient.send(new PutCommand({
          TableName: INVOICES_TABLE,
          Item: {
            invoice_id: chargeId,
            user_id: tenantId,
            type: 'aws_charge',
            amount: awsCosts,
            aws_costs: awsCosts,
            aws_breakdown: currentMonth.awsBreakdown,
            description: description,
            paddle_subscription_id: subscriptionId,
            status: 'pending',
            period: currentMonth.period,
            created_at: new Date().toISOString(),
            effective_from: 'next_billing_period'
          }
        }));

        results.processed++;
        results.details.push({
          tenantId,
          status: 'success',
          amount: awsCosts,
          chargeId
        });

      } catch (tenantError) {
        console.error(`Error processing tenant ${tenantId}:`, tenantError);
        results.errors.push({
          tenantId,
          error: tenantError.message
        });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        summary: {
          totalTenants: tenantsWithSubscriptions.length,
          processed: results.processed,
          skipped: results.skipped,
          errors: results.errors.length
        },
        details: results.details,
        errors: results.errors
      })
    };
  } catch (error) {
    console.error('Error processing monthly billing:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to process monthly billing', message: error.message })
    };
  }
}

// ============================================================
// ADMIN FUNCTIONS - For Billing Dashboard
// ============================================================

// GET /billing/admin/tenants - Get all tenants with billing overview
async function getAdminTenantsOverview() {
  console.log('Getting admin tenants overview');

  try {
    // Get all tenants
    const tenantsResult = await docClient.send(new ScanCommand({
      TableName: TENANTS_TABLE
    }));
    
    const tenants = tenantsResult.Items || [];
    
    // Get all invoices for aggregation
    const invoicesResult = await docClient.send(new ScanCommand({
      TableName: INVOICES_TABLE
    }));
    
    const invoices = invoicesResult.Items || [];
    
    // Calculate billing stats per tenant (without Cost Explorer calls)
    const tenantsWithBilling = tenants.map((tenant) => {
      const tenantId = tenant.tenant_id;
      
      // Filter invoices for this tenant
      const tenantInvoices = invoices.filter(inv => inv.user_id === tenantId);
      
      // Calculate totals
      const openInvoices = tenantInvoices.filter(inv => inv.status === 'open');
      const paidInvoices = tenantInvoices.filter(inv => inv.status === 'paid');
      
      const openInvoicesAmount = openInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const paidTotal = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      // Get current month estimate (base fee + estimated AWS costs from invoices)
      const currentMonthInvoices = tenantInvoices.filter(inv => {
        if (!inv.created_at) return false;
        const invDate = new Date(inv.created_at);
        const now = new Date();
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      });
      
      const currentMonthTotal = currentMonthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 30;
      
      return {
        tenant_id: tenantId,
        creator_name: tenant.creator_name,
        creator_email: tenant.creator_email || tenant.admin_email,
        subdomain: tenant.subdomain,
        status: tenant.status,
        created_at: tenant.created_at,
        currentMonthTotal: parseFloat(currentMonthTotal.toFixed(2)),
        awsCosts: 0,
        awsBreakdown: {},
        openInvoicesCount: openInvoices.length,
        openInvoicesAmount: parseFloat(openInvoicesAmount.toFixed(2)),
        paidInvoicesCount: paidInvoices.length,
        paidTotal: parseFloat(paidTotal.toFixed(2)),
        totalInvoices: tenantInvoices.length
      };
    });
    
    // Sort by current month total descending
    tenantsWithBilling.sort((a, b) => b.currentMonthTotal - a.currentMonthTotal);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        tenants: tenantsWithBilling,
        summary: {
          totalTenants: tenants.length,
          activeTenants: tenants.filter(t => t.status === 'active').length,
          totalOpenAmount: tenantsWithBilling.reduce((sum, t) => sum + t.openInvoicesAmount, 0),
          totalPaidAmount: tenantsWithBilling.reduce((sum, t) => sum + t.paidTotal, 0),
          totalCurrentMonth: tenantsWithBilling.reduce((sum, t) => sum + t.currentMonthTotal, 0)
        }
      })
    };
  } catch (error) {
    console.error('Error getting admin tenants overview:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get tenants overview', message: error.message })
    };
  }
}
async function getAdminAllInvoices() {
  console.log('Getting all invoices for admin');

  try {
    // Get all invoices
    const invoicesResult = await docClient.send(new ScanCommand({
      TableName: INVOICES_TABLE
    }));
    
    const invoices = (invoicesResult.Items || []).map(item => ({
      invoice_id: item.invoice_id,
      invoice_number: item.invoice_number,
      user_id: item.user_id,
      tenant_id: item.tenant_id || item.user_id,
      amount: item.amount || 0,
      base_fee: item.base_fee || 30,
      aws_costs: item.aws_costs || 0,
      aws_breakdown: item.aws_breakdown || {},
      status: item.status || 'draft',
      period: item.period || {},
      created_at: item.created_at,
      paid_at: item.paid_at,
      payment_method: item.payment_method,
      pdf_key: item.pdf_key,
      email_sent: item.email_sent
    }));
    
    // Sort by created_at descending
    invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Calculate summary
    const openInvoices = invoices.filter(inv => inv.status === 'open');
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        invoices,
        summary: {
          totalInvoices: invoices.length,
          openCount: openInvoices.length,
          paidCount: paidInvoices.length,
          openAmount: openInvoices.reduce((sum, inv) => sum + inv.amount, 0),
          paidAmount: paidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
        }
      })
    };
  } catch (error) {
    console.error('Error getting all invoices:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get invoices', message: error.message })
    };
  }
}

// GET /billing/admin/invoices/{invoiceId}/pdf - Get PDF for any invoice (admin only)
async function getAdminInvoicePDF(invoiceId) {
  console.log('Getting admin invoice PDF:', invoiceId);

  try {
    // First try to find by invoice_id
    let result = await docClient.send(new GetCommand({
      TableName: INVOICES_TABLE,
      Key: { invoice_id: invoiceId }
    }));
    
    // If not found, try to find by invoice_number (scan)
    if (!result.Item) {
      console.log('Invoice not found by invoice_id, searching by invoice_number...');
      const scanResult = await docClient.send(new ScanCommand({
        TableName: INVOICES_TABLE,
        FilterExpression: 'invoice_number = :num',
        ExpressionAttributeValues: { ':num': invoiceId }
      }));
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        result = { Item: scanResult.Items[0] };
        console.log('Found invoice by invoice_number:', result.Item.invoice_id);
      }
    }
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invoice not found' })
      };
    }

    // Check if PDF key exists and file actually exists in S3
    if (result.Item.pdf_key) {
      try {
        // Check if file exists by doing a HEAD request
        const { HeadObjectCommand } = require('@aws-sdk/client-s3');
        await s3Client.send(new HeadObjectCommand({
          Bucket: INVOICES_BUCKET,
          Key: result.Item.pdf_key
        }));
        
        // File exists, generate presigned URL
        const s3Command = new GetObjectCommand({
          Bucket: INVOICES_BUCKET,
          Key: result.Item.pdf_key,
          ResponseContentDisposition: `attachment; filename="Rechnung_${result.Item.invoice_number || invoiceId}.pdf"`
        });
        
        const presignedUrl = await getSignedUrl(s3Client, s3Command, { expiresIn: 3600 });
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ url: presignedUrl })
        };
      } catch (headError) {
        // File doesn't exist in S3, will regenerate below
        console.log('PDF file not found in S3, will regenerate:', headError.message);
      }
    }

    // PDF not found or doesn't exist - generate it on-demand
    console.log('Generating PDF on-demand for admin request...');
    
    try {
      const tenantId = result.Item.user_id || result.Item.tenant_id;
      const pdfResult = await generateInvoicePDFOnDemand(result.Item, tenantId);
      if (pdfResult.url) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ url: pdfResult.url })
        };
      }
    } catch (pdfError) {
      console.error('Error generating PDF on-demand for admin:', pdfError);
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to generate PDF' })
    };
  } catch (error) {
    console.error('Error getting admin invoice PDF:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get PDF', message: error.message })
    };
  }
}

// POST /billing/generate-invoices - Generate monthly invoices by invoking billing-cron Lambda
async function generateMonthlyInvoices() {
  console.log('Generating monthly invoices via billing-cron Lambda');

  try {
    const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
    const lambdaClient = new LambdaClient({ region: process.env.REGION || 'eu-central-1' });

    const command = new InvokeCommand({
      FunctionName: 'viraltenant-billing-cron-production',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ source: 'manual', time: 'monthly' })
    });

    const response = await lambdaClient.send(command);
    const payload = JSON.parse(Buffer.from(response.Payload).toString());
    
    // Parse the body if it exists
    let result = payload;
    if (payload.body) {
      result = JSON.parse(payload.body);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error generating monthly invoices:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to generate invoices', message: error.message })
    };
  }
}

// GET /billing/admin/aws-costs - Get total AWS costs for the account
async function getAdminAwsCosts() {
  console.log('Getting admin AWS costs');

  try {
    const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
    const ce = new CostExplorerClient({ region: 'us-east-1' }); // Cost Explorer is only in us-east-1

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Get total costs grouped by service
    const command = new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }]
    });

    const response = await ce.send(command);
    
    let totalCost = 0;
    const serviceBreakdown = {};

    if (response.ResultsByTime?.[0]?.Groups) {
      response.ResultsByTime[0].Groups.forEach(group => {
        const service = group.Keys[0];
        const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
        if (cost > 0.01) { // Only include services with costs > 1 cent
          serviceBreakdown[service] = parseFloat(cost.toFixed(2));
          totalCost += cost;
        }
      });
    }

    // Also get previous month for comparison
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const prevCommand = new GetCostAndUsageCommand({
      TimePeriod: { 
        Start: prevMonthStart.toISOString().split('T')[0], 
        End: prevMonthEnd.toISOString().split('T')[0] 
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost']
    });

    let previousMonthTotal = 0;
    try {
      const prevResponse = await ce.send(prevCommand);
      if (prevResponse.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount) {
        previousMonthTotal = parseFloat(prevResponse.ResultsByTime[0].Total.UnblendedCost.Amount);
      }
    } catch (e) {
      console.log('Could not get previous month costs:', e.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        currentMonth: {
          total: parseFloat(totalCost.toFixed(2)),
          period: {
            start: startDate,
            end: endDate
          },
          serviceBreakdown
        },
        previousMonth: {
          total: parseFloat(previousMonthTotal.toFixed(2))
        },
        lastUpdated: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting AWS costs:', error);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        currentMonth: {
          total: 0,
          period: {
            start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          },
          serviceBreakdown: {}
        },
        previousMonth: {
          total: 0
        },
        error: error.message,
        lastUpdated: new Date().toISOString()
      })
    };
  }
}


// ============================================================
// TENANT MANAGEMENT FUNCTIONS
// ============================================================

// GET /billing/admin/tenants/{tenantId} - Get detailed tenant info
async function getAdminTenantDetails(tenantId) {
  console.log('Getting admin tenant details:', tenantId);

  try {
    // Get tenant from DynamoDB
    const tenantResult = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    if (!tenantResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Tenant not found' })
      };
    }

    const tenant = tenantResult.Item;

    // Get IVS resources from tenant-live table
    let ivsResources = {};
    const TENANT_LIVE_TABLE = process.env.TENANT_LIVE_TABLE || 'viraltenant-tenant-live-production';
    console.log('Looking for IVS resources in table:', TENANT_LIVE_TABLE, 'for tenant:', tenantId);
    
    try {
      const liveResult = await docClient.send(new GetCommand({
        TableName: TENANT_LIVE_TABLE,
        Key: { tenant_id: tenantId }
      }));
      console.log('Tenant-live result:', JSON.stringify(liveResult.Item || 'not found'));
      
      if (liveResult.Item) {
        ivsResources = {
          ivs_channel_arn: liveResult.Item.ivs_channel_arn || null,
          ivs_chat_room_arn: liveResult.Item.ivs_chat_room_arn || null,
          ivs_playback_url: liveResult.Item.ivs_playback_url || null
        };
      }
    } catch (e) {
      console.log('Could not get IVS resources:', e.message);
    }

    // Count S3 objects
    let s3ObjectsCount = 0;
    const CREATOR_ASSETS_BUCKET = process.env.CREATOR_ASSETS_BUCKET || 'viraltenant-creator-assets-production';
    console.log('Counting S3 objects in bucket:', CREATOR_ASSETS_BUCKET, 'prefix:', `tenants/${tenantId}/`);
    
    try {
      const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: process.env.REGION || 'eu-central-1' });
      
      const listResult = await s3.send(new ListObjectsV2Command({
        Bucket: CREATOR_ASSETS_BUCKET,
        Prefix: `tenants/${tenantId}/`,
        MaxKeys: 1000
      }));
      s3ObjectsCount = listResult.KeyCount || 0;
      console.log('S3 objects count:', s3ObjectsCount);
    } catch (e) {
      console.log('Could not count S3 objects:', e.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ...tenant,
        ...ivsResources,
        s3_objects_count: s3ObjectsCount
      })
    };
  } catch (error) {
    console.error('Error getting tenant details:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get tenant details', message: error.message })
    };
  }
}

// PUT /billing/admin/tenants/{tenantId}/status - Update tenant status
async function updateTenantStatus(tenantId, newStatus, reason) {
  console.log('Updating tenant status:', tenantId, newStatus, reason);

  if (!['active', 'suspended', 'pending'].includes(newStatus)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid status. Must be: active, suspended, or pending' })
    };
  }

  try {
    // Update tenant status
    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: 'SET #status = :status, status_reason = :reason, status_updated_at = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': newStatus,
        ':reason': reason || '',
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        tenant_id: tenantId,
        status: newStatus,
        reason: reason
      })
    };
  } catch (error) {
    console.error('Error updating tenant status:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update tenant status', message: error.message })
    };
  }
}

// DELETE /billing/admin/tenants/{tenantId} - Delete tenant and all resources
async function deleteTenantAndResources(tenantId) {
  console.log('Deleting tenant and all resources:', tenantId);

  const results = {
    tenant_id: tenantId,
    deleted: [],
    errors: []
  };

  try {
    // 1. Get tenant info first
    const tenantResult = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    if (!tenantResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Tenant not found' })
      };
    }

    const tenant = tenantResult.Item;
    const subdomain = tenant.subdomain;

    // 2. Delete IVS resources
    try {
      const TENANT_LIVE_TABLE = process.env.TENANT_LIVE_TABLE || 'viraltenant-tenant-live-production';
      const liveResult = await docClient.send(new GetCommand({
        TableName: TENANT_LIVE_TABLE,
        Key: { tenant_id: tenantId }
      }));

      if (liveResult.Item) {
        const { IvsClient, DeleteChannelCommand } = require('@aws-sdk/client-ivs');
        const { IvschatClient, DeleteRoomCommand } = require('@aws-sdk/client-ivschat');
        const ivs = new IvsClient({ region: process.env.REGION || 'eu-central-1' });
        const ivschat = new IvschatClient({ region: process.env.REGION || 'eu-central-1' });

        // Delete IVS Channel
        if (liveResult.Item.ivs_channel_arn) {
          try {
            await ivs.send(new DeleteChannelCommand({ arn: liveResult.Item.ivs_channel_arn }));
            results.deleted.push('IVS Channel');
          } catch (e) {
            if (e.name !== 'ResourceNotFoundException') {
              results.errors.push(`IVS Channel: ${e.message}`);
            }
          }
        }

        // Delete IVS Chat Room
        if (liveResult.Item.ivs_chat_room_arn) {
          try {
            await ivschat.send(new DeleteRoomCommand({ identifier: liveResult.Item.ivs_chat_room_arn }));
            results.deleted.push('IVS Chat Room');
          } catch (e) {
            if (e.name !== 'ResourceNotFoundException') {
              results.errors.push(`IVS Chat Room: ${e.message}`);
            }
          }
        }

        // Delete tenant-live record
        await docClient.send(new DeleteCommand({
          TableName: TENANT_LIVE_TABLE,
          Key: { tenant_id: tenantId }
        }));
        results.deleted.push('Tenant Live Record');
      }
    } catch (e) {
      results.errors.push(`IVS Resources: ${e.message}`);
    }

    // 3. Delete S3 objects
    try {
      const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: process.env.REGION || 'eu-central-1' });
      const CREATOR_ASSETS_BUCKET = process.env.CREATOR_ASSETS_BUCKET || 'viraltenant-creator-assets-production';

      let continuationToken;
      let totalDeleted = 0;

      do {
        const listResult = await s3.send(new ListObjectsV2Command({
          Bucket: CREATOR_ASSETS_BUCKET,
          Prefix: `tenants/${tenantId}/`,
          ContinuationToken: continuationToken
        }));

        if (listResult.Contents && listResult.Contents.length > 0) {
          await s3.send(new DeleteObjectsCommand({
            Bucket: CREATOR_ASSETS_BUCKET,
            Delete: {
              Objects: listResult.Contents.map(obj => ({ Key: obj.Key }))
            }
          }));
          totalDeleted += listResult.Contents.length;
        }

        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);

      if (totalDeleted > 0) {
        results.deleted.push(`S3 Objects (${totalDeleted})`);
      }
    } catch (e) {
      results.errors.push(`S3 Objects: ${e.message}`);
    }

    // 4. Delete Route 53 subdomain
    if (subdomain) {
      try {
        const { Route53Client, ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
        const route53 = new Route53Client({ region: 'us-east-1' });
        const HOSTED_ZONE_ID = process.env.HOSTED_ZONE_ID || 'Z038248814K1ECJCOM0GL';
        const PLATFORM_DOMAIN = 'viraltenant.com';
        const recordName = `${subdomain}.${PLATFORM_DOMAIN}.`;

        // Find the record
        const listResult = await route53.send(new ListResourceRecordSetsCommand({
          HostedZoneId: HOSTED_ZONE_ID,
          StartRecordName: recordName,
          StartRecordType: 'A',
          MaxItems: '1'
        }));

        if (listResult.ResourceRecordSets?.[0]?.Name === recordName) {
          await route53.send(new ChangeResourceRecordSetsCommand({
            HostedZoneId: HOSTED_ZONE_ID,
            ChangeBatch: {
              Changes: [{
                Action: 'DELETE',
                ResourceRecordSet: listResult.ResourceRecordSets[0]
              }]
            }
          }));
          results.deleted.push('Route 53 Subdomain');
        }
      } catch (e) {
        results.errors.push(`Route 53: ${e.message}`);
      }
    }

    // 5. Delete invoices
    try {
      const invoicesResult = await docClient.send(new ScanCommand({
        TableName: INVOICES_TABLE,
        FilterExpression: 'user_id = :tid',
        ExpressionAttributeValues: { ':tid': tenantId }
      }));

      const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
      for (const invoice of (invoicesResult.Items || [])) {
        await docClient.send(new DeleteCommand({
          TableName: INVOICES_TABLE,
          Key: { invoice_id: invoice.invoice_id }
        }));
      }

      if (invoicesResult.Items?.length > 0) {
        results.deleted.push(`Invoices (${invoicesResult.Items.length})`);
      }
    } catch (e) {
      results.errors.push(`Invoices: ${e.message}`);
    }

    // 6. Delete user-tenant relations
    try {
      const USER_TENANTS_TABLE = process.env.USER_TENANTS_TABLE || 'viraltenant-user-tenants-production';
      const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
      
      // Scan for all relations with this tenant
      const relationsResult = await docClient.send(new ScanCommand({
        TableName: USER_TENANTS_TABLE,
        FilterExpression: 'tenant_id = :tid',
        ExpressionAttributeValues: { ':tid': tenantId }
      }));

      for (const relation of (relationsResult.Items || [])) {
        await docClient.send(new DeleteCommand({
          TableName: USER_TENANTS_TABLE,
          Key: { user_id: relation.user_id, tenant_id: tenantId }
        }));
      }

      if (relationsResult.Items?.length > 0) {
        results.deleted.push(`User-Tenant Relations (${relationsResult.Items.length})`);
      }
    } catch (e) {
      results.errors.push(`User-Tenant Relations: ${e.message}`);
    }

    // 7. Finally delete the tenant record
    try {
      const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
      await docClient.send(new DeleteCommand({
        TableName: TENANTS_TABLE,
        Key: { tenant_id: tenantId }
      }));
      results.deleted.push('Tenant Record');
    } catch (e) {
      results.errors.push(`Tenant Record: ${e.message}`);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: results.errors.length === 0,
        ...results
      })
    };
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to delete tenant', 
        message: error.message,
        ...results
      })
    };
  }
}
