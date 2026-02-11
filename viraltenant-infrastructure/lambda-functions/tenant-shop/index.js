const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});
const s3 = new S3Client({ region: process.env.REGION });
const ses = new SESClient({ region: process.env.REGION });

// ============================================================
// EMAIL NOTIFICATION
// ============================================================

// Format shipping address for display
function formatShippingAddress(address) {
  if (!address) return '';
  return `${address.firstName} ${address.lastName}
${address.street}
${address.postalCode} ${address.city}
${address.country}
${address.phone ? `Tel: ${address.phone}` : ''}`.trim();
}

function formatShippingAddressHtml(address) {
  if (!address) return '';
  return `
    <p style="margin: 0;"><strong>${address.firstName} ${address.lastName}</strong></p>
    <p style="margin: 0;">${address.street}</p>
    <p style="margin: 0;">${address.postalCode} ${address.city}</p>
    <p style="margin: 0;">${address.country}</p>
    ${address.phone ? `<p style="margin: 0;">Tel: ${address.phone}</p>` : ''}
  `;
}

// Send notification to shop owner
async function sendOrderNotificationEmail(toEmail, order, shopSettings) {
  if (!toEmail) {
    console.log('No notification email configured, skipping email');
    return;
  }

  const itemsList = order.items.map(item => 
    `• ${item.name} x${item.quantity} - ${order.currency} ${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');

  const htmlItemsList = order.items.map(item => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${order.currency} ${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const subject = `Neue Bestellung #${order.orderId.slice(-8).toUpperCase()}`;
  
  const shippingText = order.shippingAddress ? `\nLieferadresse:\n${formatShippingAddress(order.shippingAddress)}\n` : '';
  
  const textBody = `
Neue Bestellung eingegangen!

Bestellnummer: ${order.orderId}
Datum: ${new Date().toLocaleString('de-DE')}
Zahlungsanbieter: ${order.provider.toUpperCase()}
${order.customerEmail ? `Kunde E-Mail: ${order.customerEmail}` : ''}
${shippingText}
Bestellte Artikel:
${itemsList}

Gesamtsumme: ${order.currency} ${order.total.toFixed(2)}

---
Diese E-Mail wurde automatisch generiert.
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .order-info { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .shipping-box { background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px; background: #f0f0f0; }
    .total { font-size: 1.2em; font-weight: bold; color: #667eea; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🛒 Neue Bestellung</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">#${order.orderId.slice(-8).toUpperCase()}</p>
    </div>
    <div class="content">
      <div class="order-info">
        <p><strong>Datum:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <p><strong>Zahlungsanbieter:</strong> ${order.provider.toUpperCase()}</p>
        ${order.customerEmail ? `<p><strong>Kunde E-Mail:</strong> ${order.customerEmail}</p>` : ''}
      </div>
      
      ${order.shippingAddress ? `
      <div class="shipping-box">
        <h4 style="margin: 0 0 10px 0;">📦 Lieferadresse</h4>
        ${formatShippingAddressHtml(order.shippingAddress)}
      </div>
      ` : ''}
      
      <h3>Bestellte Artikel</h3>
      <table>
        <thead>
          <tr>
            <th>Artikel</th>
            <th style="text-align: center;">Menge</th>
            <th style="text-align: right;">Preis</th>
          </tr>
        </thead>
        <tbody>
          ${htmlItemsList}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 12px 8px; text-align: right;"><strong>Gesamtsumme:</strong></td>
            <td style="padding: 12px 8px; text-align: right;" class="total">${order.currency} ${order.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const command = new SendEmailCommand({
      Source: `Shop <noreply@${process.env.SES_DOMAIN || 'viraltenant.com'}>`,
      Destination: {
        ToAddresses: [toEmail]
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: textBody, Charset: 'UTF-8' },
          Html: { Data: htmlBody, Charset: 'UTF-8' }
        }
      }
    });

    await ses.send(command);
    console.log('Order notification email sent to shop owner:', toEmail);
  } catch (error) {
    console.error('Failed to send order notification email:', error);
    // Don't throw - email failure shouldn't break the order flow
  }
}

// Send order confirmation to customer
async function sendCustomerConfirmationEmail(order, shopSettings) {
  const customerEmail = order.customerEmail || order.shippingAddress?.email;
  
  if (!customerEmail) {
    console.log('No customer email, skipping customer confirmation');
    return;
  }

  const itemsList = order.items.map(item => 
    `• ${item.name} x${item.quantity} - ${order.currency} ${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');

  const htmlItemsList = order.items.map(item => 
    `<tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${order.currency} ${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const subject = `Bestellbestätigung #${order.orderId.slice(-8).toUpperCase()}`;
  
  const shippingText = order.shippingAddress ? `\nLieferadresse:\n${formatShippingAddress(order.shippingAddress)}\n` : '';
  const customerName = order.shippingAddress ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}` : 'Kunde';
  
  const textBody = `
Hallo ${customerName},

vielen Dank für deine Bestellung!

Bestellnummer: ${order.orderId.slice(-8).toUpperCase()}
Datum: ${new Date().toLocaleString('de-DE')}
${shippingText}
Deine bestellten Artikel:
${itemsList}

Gesamtsumme: ${order.currency} ${order.total.toFixed(2)}

Wir werden deine Bestellung schnellstmöglich bearbeiten und versenden.

Bei Fragen zu deiner Bestellung kannst du dich jederzeit an uns wenden.

Vielen Dank für dein Vertrauen!

---
Diese E-Mail wurde automatisch generiert.
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-icon { font-size: 48px; margin-bottom: 10px; }
    .order-number { background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; display: inline-block; margin-top: 10px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .info-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .shipping-box { background: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 12px; background: #f0f0f0; font-weight: 600; }
    .total-row { background: #667eea; color: white; }
    .total-row td { padding: 15px 12px; font-weight: bold; font-size: 1.1em; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    .thank-you { background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">✅</div>
      <h1 style="margin: 0;">Bestellung bestätigt!</h1>
      <div class="order-number">#${order.orderId.slice(-8).toUpperCase()}</div>
    </div>
    <div class="content">
      <p class="greeting">Hallo ${customerName},</p>
      <p>vielen Dank für deine Bestellung! Wir haben deine Zahlung erhalten und werden deine Bestellung schnellstmöglich bearbeiten.</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>Bestelldatum:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <p style="margin: 5px 0 0 0;"><strong>Zahlungsmethode:</strong> ${order.provider.toUpperCase()}</p>
      </div>
      
      ${order.shippingAddress ? `
      <div class="shipping-box">
        <h4 style="margin: 0 0 10px 0;">📦 Lieferadresse</h4>
        ${formatShippingAddressHtml(order.shippingAddress)}
      </div>
      ` : ''}
      
      <h3 style="margin-bottom: 10px;">Deine Bestellung</h3>
      <table>
        <thead>
          <tr>
            <th>Artikel</th>
            <th style="text-align: center;">Menge</th>
            <th style="text-align: right;">Preis</th>
          </tr>
        </thead>
        <tbody>
          ${htmlItemsList}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2" style="text-align: right;">Gesamtsumme:</td>
            <td style="text-align: right;">${order.currency} ${order.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      
      <div class="thank-you">
        <strong>🙏 Vielen Dank für dein Vertrauen!</strong>
      </div>
    </div>
    <div class="footer">
      <p>Bei Fragen zu deiner Bestellung kannst du dich jederzeit an uns wenden.</p>
      <p style="color: #999; font-size: 12px;">Diese E-Mail wurde automatisch generiert.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const command = new SendEmailCommand({
      Source: `Shop <noreply@${process.env.SES_DOMAIN || 'viraltenant.com'}>`,
      Destination: {
        ToAddresses: [customerEmail]
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: textBody, Charset: 'UTF-8' },
          Html: { Data: htmlBody, Charset: 'UTF-8' }
        }
      }
    });

    await ses.send(command);
    console.log('Customer confirmation email sent to:', customerEmail);
  } catch (error) {
    console.error('Failed to send customer confirmation email:', error);
    // Don't throw - email failure shouldn't break the order flow
  }
}

// ============================================================
// PAYMENT PROVIDER INTEGRATIONS
// ============================================================

// PayPal API Integration
async function createPayPalOrder(paypalConfig, orderData) {
  const { clientId, clientSecret, sandbox } = paypalConfig;
  const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  
  console.log('PayPal config:', { clientId: clientId?.substring(0, 10) + '...', sandbox, baseUrl });
  
  // Get access token
  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error('PayPal auth error:', authResponse.status, errorText);
    throw new Error(`PayPal authentication failed: ${authResponse.status} - ${errorText}`);
  }
  
  const { access_token } = await authResponse.json();
  
  // Create order
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: orderData.currency,
          value: orderData.total.toFixed(2)
        },
        description: orderData.description
      }],
      application_context: {
        return_url: orderData.returnUrl,
        cancel_url: orderData.cancelUrl
      }
    })
  });
  
  if (!orderResponse.ok) {
    const error = await orderResponse.json();
    throw new Error(`PayPal order creation failed: ${JSON.stringify(error)}`);
  }
  
  return await orderResponse.json();
}

async function capturePayPalOrder(paypalConfig, orderId) {
  const { clientId, clientSecret, sandbox } = paypalConfig;
  const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  
  // Get access token
  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });
  
  const { access_token } = await authResponse.json();
  
  // Capture order
  const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    }
  });
  
  if (!captureResponse.ok) {
    const error = await captureResponse.json();
    throw new Error(`PayPal capture failed: ${JSON.stringify(error)}`);
  }
  
  return await captureResponse.json();
}

// Stripe API Integration
async function createStripeCheckoutSession(stripeConfig, orderData) {
  const { secretKey } = stripeConfig;
  
  // Build URL-encoded body for Stripe API
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${orderData.returnUrl}?session_id={CHECKOUT_SESSION_ID}&orderId=${orderData.orderId}`);
  params.append('cancel_url', orderData.cancelUrl);
  
  // Add customer email if available
  if (orderData.customerEmail) {
    params.append('customer_email', orderData.customerEmail);
  }
  
  // Add line items
  orderData.items.forEach((item, i) => {
    params.append(`line_items[${i}][price_data][currency]`, orderData.currency.toLowerCase());
    params.append(`line_items[${i}][price_data][product_data][name]`, item.name);
    params.append(`line_items[${i}][price_data][unit_amount]`, Math.round(item.price * 100).toString());
    params.append(`line_items[${i}][quantity]`, item.quantity.toString());
  });
  
  // Add metadata for order tracking
  params.append('metadata[orderId]', orderData.orderId);
  params.append('metadata[tenantId]', orderData.tenantId);
  
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${secretKey}`
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('Stripe session creation error:', error);
    throw new Error(`Stripe session creation failed: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
}

// Verify Stripe session and get payment status
async function verifyStripeSession(stripeConfig, sessionId) {
  const { secretKey } = stripeConfig;
  
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${secretKey}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stripe session verification failed: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
}

async function verifyStripeWebhook(stripeConfig, payload, signature) {
  const { webhookSecret } = stripeConfig;
  
  const timestamp = signature.split(',').find(s => s.startsWith('t='))?.split('=')[1];
  const sig = signature.split(',').find(s => s.startsWith('v1='))?.split('=')[1];
  
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
  
  return sig === expectedSig;
}

// Mollie API Integration
async function createMolliePayment(mollieConfig, orderData) {
  const { apiKey } = mollieConfig;
  
  const response = await fetch('https://api.mollie.com/v2/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      amount: {
        currency: orderData.currency,
        value: orderData.total.toFixed(2)
      },
      description: orderData.description,
      redirectUrl: orderData.returnUrl,
      cancelUrl: orderData.cancelUrl,
      webhookUrl: orderData.webhookUrl,
      metadata: {
        orderId: orderData.orderId,
        tenantId: orderData.tenantId
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Mollie payment creation failed: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
}

async function getMolliePayment(mollieConfig, paymentId) {
  const { apiKey } = mollieConfig;
  
  const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Mollie payment fetch failed: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS'
};

// Resolve tenant ID from subdomain or UUID
async function resolveTenantId(tenantIdOrSubdomain) {
  // If it looks like a UUID, return as-is
  if (tenantIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantIdOrSubdomain;
  }
  
  // Otherwise, treat as subdomain and look up the tenant
  try {
    const params = {
      TableName: process.env.TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: {
        ':subdomain': tenantIdOrSubdomain
      }
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    if (result.Items && result.Items.length > 0) {
      console.log('Resolved subdomain', tenantIdOrSubdomain, 'to tenant ID', result.Items[0].tenant_id);
      return result.Items[0].tenant_id;
    }
  } catch (error) {
    console.error('Error resolving subdomain:', error);
  }
  
  // Return original value if not found
  return tenantIdOrSubdomain;
}

async function isUserTenantAdmin(userId, tenantId) {
  // Always check the user_tenants table - strict tenant isolation
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    const isAdmin = result.Item && result.Item.role === 'admin';
    console.log(`Admin check for user ${userId} on tenant ${tenantId}: ${isAdmin}`);
    return isAdmin;
  } catch (error) { 
    console.error('Error checking admin:', error);
    return false; 
  }
}

const getDefaultData = (tenantId) => ({
  tenant_id: tenantId,
  products: [],
  categories: [],
  settings: { 
    currency: 'EUR', 
    taxRate: 19, 
    shippingEnabled: true,
    paymentProvider: null, // 'paypal', 'stripe', 'mollie'
    paymentConfig: {
      paypal: {
        enabled: false,
        clientId: '',
        clientSecret: '',
        sandbox: true
      },
      stripe: {
        enabled: false,
        publishableKey: '',
        secretKey: '',
        webhookSecret: ''
      },
      mollie: {
        enabled: false,
        apiKey: '',
        profileId: ''
      }
    }
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  if (data.products) {
    data.products = data.products.map(product => ({
      ...product,
      imageUrl: product.imageKey ? `https://${cfDomain}/${product.imageKey}` : product.imageUrl,
      images: product.imageKeys?.map(k => `https://${cfDomain}/${k}`) || product.images
    }));
  }
  return data;
};

async function getShop(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_SHOP_TABLE, Key: { tenant_id: tenantId }
    }));
    return enrichWithUrls(result.Item || getDefaultData(tenantId));
  } catch (error) { return getDefaultData(tenantId); }
}

async function updateShop(tenantId, updates) {
  const existing = await getShop(tenantId);
  const item = { ...existing, ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_SHOP_TABLE, Item: item }));
  return enrichWithUrls(item);
}

async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const ext = fileName.split('.').pop();
  const key = `tenants/${tenantId}/shop/${uploadType}-${Date.now()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, key, publicUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}` };
}

async function deleteFile(key) {
  if (!key) return;
  try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key })); } catch (e) {}
}

// ============================================================
// ORDER MANAGEMENT - Separate Orders Table
// ============================================================

async function storeOrder(tenantId, order) {
  const orderItem = {
    tenant_id: tenantId,
    order_id: order.orderId,
    ...order,
    created_at: order.created_at || new Date().toISOString()
  };
  
  console.log('Storing order in separate table:', orderItem.order_id);
  
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_ORDERS_TABLE,
    Item: orderItem
  }));
  
  return orderItem;
}

async function getOrder(tenantId, orderId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_ORDERS_TABLE,
      Key: { tenant_id: tenantId, order_id: orderId }
    }));
    return result.Item;
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
}

async function getOrders(tenantId) {
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.TENANT_ORDERS_TABLE,
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      },
      ScanIndexForward: false // newest first
    }));
    return result.Items || [];
  } catch (error) {
    console.error('Error getting orders:', error);
    return [];
  }
}

async function updateOrderStatus(tenantId, orderId, status, additionalData = {}) {
  const order = await getOrder(tenantId, orderId);
  if (!order) {
    console.error('Order not found for update:', orderId);
    return null;
  }
  
  const updatedOrder = {
    ...order,
    status,
    ...additionalData,
    updated_at: new Date().toISOString()
  };
  
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_ORDERS_TABLE,
    Item: updatedOrder
  }));
  
  console.log('Order status updated:', orderId, status);
  return updatedOrder;
}

async function updateOrderByProviderRef(tenantId, provider, providerRef, status, additionalData = {}) {
  // Query all orders for tenant and find by provider ref
  const orders = await getOrders(tenantId);
  const refField = provider === 'stripe' ? 'providerSessionId' : provider === 'mollie' ? 'providerPaymentId' : 'providerOrderId';
  
  const order = orders.find(o => o[refField] === providerRef);
  if (order) {
    return await updateOrderStatus(tenantId, order.order_id, status, additionalData);
  }
  console.log('Order not found for provider ref:', provider, providerRef);
  return null;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext.authorizer?.userId;
  const authorizerTenantId = requestContext.authorizer?.tenantId;
  const rawTenantId = authorizerTenantId || pathParameters?.tenantId;
  
  // Resolve tenant ID (could be UUID or subdomain)
  const tenantId = await resolveTenantId(rawTenantId);
  console.log('Resolved tenant ID:', rawTenantId, '->', tenantId);

  if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  try {
    // GET /tenants/{tenantId}/shop/payment-config - Get public payment config (for frontend)
    // MUST be before the general GET handler!
    if (httpMethod === 'GET' && path.includes('/payment-config')) {
      const shopData = await getShop(tenantId);
      const { paymentConfig } = shopData.settings;
      
      // Return only public keys (no secrets!)
      const publicConfig = {
        paypal: paymentConfig?.paypal?.enabled ? {
          enabled: true,
          clientId: paymentConfig.paypal.clientId,
          sandbox: paymentConfig.paypal.sandbox
        } : { enabled: false },
        stripe: paymentConfig?.stripe?.enabled ? {
          enabled: true,
          publishableKey: paymentConfig.stripe.publishableKey
        } : { enabled: false },
        mollie: paymentConfig?.mollie?.enabled ? {
          enabled: true,
          profileId: paymentConfig.mollie.profileId
        } : { enabled: false }
      };
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(publicConfig)
      };
    }

    // GET /tenants/{tenantId}/shop/orders - Get orders (admin only)
    // MUST be before the general GET handler!
    if (httpMethod === 'GET' && path.includes('/orders')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      // Get orders from separate orders table
      const orders = await getOrders(tenantId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ orders })
      };
    }

    // General GET /tenants/{tenantId}/shop - Get shop data
    if (httpMethod === 'GET' && !path.includes('/upload-url')) {
      const data = await getShop(tenantId);
      
      // Return the resolved tenant ID so frontend knows where data is stored
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...data,
          resolvedTenantId: tenantId // Use the actual resolved tenant ID (UUID)
        })
      };
    }

    if (httpMethod === 'PUT' && !path.includes('/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const updated = await updateShop(tenantId, JSON.parse(event.body || '{}'));
      
      // Return the resolved tenant ID so frontend knows where data is stored
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...updated,
          resolvedTenantId: tenantId // Use the actual resolved tenant ID (UUID)
        })
      };
    }

    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich', debug: { userId, tenantId } }) };
      }
      
      console.log('Checking admin access for user:', userId, 'tenant:', tenantId);
      const isAdmin = await isUserTenantAdmin(userId, tenantId);
      console.log('Admin check result:', isAdmin);
      
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung', debug: { userId, tenantId, isAdmin } }) };
      }
      
      const { fileName, fileType, uploadType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'product')) };
    }

    if (httpMethod === 'DELETE' && path.includes('/asset')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      await deleteFile(JSON.parse(event.body || '{}').key);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Asset gelöscht' }) };
    }

    // ============================================================
    // CHECKOUT & PAYMENT ENDPOINTS
    // ============================================================

    // POST /tenants/{tenantId}/shop/checkout - Create checkout session
    if (httpMethod === 'POST' && path.includes('/checkout')) {
      const body = JSON.parse(event.body || '{}');
      const { items, returnUrl, cancelUrl, customerEmail, shippingAddress, provider: requestedProvider } = body;
      
      if (!items || !items.length) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Artikel im Warenkorb' }) };
      }
      
      const shopData = await getShop(tenantId);
      const { settings } = shopData;
      const { paymentConfig, currency } = settings;
      
      // Use requested provider if specified and enabled, otherwise find first active
      let activeProvider = null;
      if (requestedProvider) {
        // Check if requested provider is enabled
        if (requestedProvider === 'paypal' && paymentConfig?.paypal?.enabled) activeProvider = 'paypal';
        else if (requestedProvider === 'stripe' && paymentConfig?.stripe?.enabled) activeProvider = 'stripe';
        else if (requestedProvider === 'mollie' && paymentConfig?.mollie?.enabled) activeProvider = 'mollie';
      }
      
      // Fallback to first enabled provider if requested one is not available
      if (!activeProvider) {
        if (paymentConfig?.paypal?.enabled) activeProvider = 'paypal';
        else if (paymentConfig?.stripe?.enabled) activeProvider = 'stripe';
        else if (paymentConfig?.mollie?.enabled) activeProvider = 'mollie';
      }
      
      if (!activeProvider) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Kein Zahlungsanbieter konfiguriert' }) };
      }
      
      console.log('Using payment provider:', activeProvider, 'requested:', requestedProvider);
      
      // Calculate total
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get customer email from shipping address if not provided directly
      const finalCustomerEmail = customerEmail || shippingAddress?.email;
      
      // Build webhook URL - use API_URL env var or construct from API Gateway ID
      const apiUrl = process.env.API_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production';
      const platformUrl = process.env.PLATFORM_URL || 'https://viraltenant.com';
      
      const orderData = {
        orderId,
        tenantId,
        items,
        total,
        currency: currency || 'EUR',
        description: `Bestellung ${orderId}`,
        returnUrl: returnUrl || `${platformUrl}/shop/success?orderId=${orderId}`,
        cancelUrl: cancelUrl || `${platformUrl}/shop/cancel`,
        webhookUrl: `${apiUrl}/tenants/${tenantId}/shop/webhook`,
        customerEmail: finalCustomerEmail,
        shippingAddress
      };
      
      console.log('Order data webhookUrl:', orderData.webhookUrl);
      
      try {
        let checkoutResult;
        
        switch (activeProvider) {
          case 'paypal':
            checkoutResult = await createPayPalOrder(paymentConfig.paypal, orderData);
            // Store order with shipping address
            await storeOrder(tenantId, {
              orderId,
              provider: 'paypal',
              providerOrderId: checkoutResult.id,
              status: 'pending',
              items,
              total,
              currency: currency || 'EUR',
              customerEmail: finalCustomerEmail,
              shippingAddress,
              created_at: new Date().toISOString()
            });
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                provider: 'paypal',
                orderId,
                providerOrderId: checkoutResult.id,
                approvalUrl: checkoutResult.links.find(l => l.rel === 'approve')?.href
              })
            };
            
          case 'stripe':
            checkoutResult = await createStripeCheckoutSession(paymentConfig.stripe, orderData);
            await storeOrder(tenantId, {
              orderId,
              provider: 'stripe',
              providerSessionId: checkoutResult.id,
              status: 'pending',
              items,
              total,
              currency: currency || 'EUR',
              customerEmail: finalCustomerEmail,
              shippingAddress,
              created_at: new Date().toISOString()
            });
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                provider: 'stripe',
                orderId,
                sessionId: checkoutResult.id,
                checkoutUrl: checkoutResult.url
              })
            };
            
          case 'mollie':
            checkoutResult = await createMolliePayment(paymentConfig.mollie, orderData);
            await storeOrder(tenantId, {
              orderId,
              provider: 'mollie',
              providerPaymentId: checkoutResult.id,
              status: 'pending',
              items,
              total,
              currency: currency || 'EUR',
              customerEmail: finalCustomerEmail,
              shippingAddress,
              created_at: new Date().toISOString()
            });
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                provider: 'mollie',
                orderId,
                paymentId: checkoutResult.id,
                checkoutUrl: checkoutResult._links.checkout.href
              })
            };
        }
      } catch (error) {
        console.error('Checkout error:', error);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: `Checkout fehlgeschlagen: ${error.message}` }) };
      }
    }

    // POST /tenants/{tenantId}/shop/capture - Capture PayPal payment OR verify Stripe payment
    if (httpMethod === 'POST' && path.includes('/capture')) {
      const body = JSON.parse(event.body || '{}');
      const { orderId, providerOrderId, sessionId, customerEmail, provider } = body;
      
      const shopData = await getShop(tenantId);
      const { paymentConfig, orderNotificationEmail } = shopData.settings;
      
      // Handle Stripe verification
      if (sessionId || provider === 'stripe') {
        if (!paymentConfig?.stripe?.enabled) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Stripe nicht konfiguriert' }) };
        }
        
        try {
          console.log('Verifying Stripe session:', sessionId);
          const session = await verifyStripeSession(paymentConfig.stripe, sessionId);
          
          if (session.payment_status !== 'paid') {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Zahlung nicht abgeschlossen', status: session.payment_status }) };
          }
          
          // Get orderId from session metadata or from request
          const stripeOrderId = orderId || session.metadata?.orderId;
          
          // Update order status
          const updatedOrder = await updateOrderStatus(tenantId, stripeOrderId, 'completed', {
            stripeSessionId: sessionId,
            stripePaymentIntent: session.payment_intent,
            completedAt: new Date().toISOString()
          });
          
          if (updatedOrder) {
            const orderWithEmail = {
              ...updatedOrder,
              customerEmail: customerEmail || session.customer_email || updatedOrder.customerEmail
            };
            
            console.log('Stripe order completed, sending emails:', stripeOrderId);
            
            // Send notification to shop owner
            if (orderNotificationEmail) {
              console.log('Sending order notification to shop owner:', orderNotificationEmail);
              await sendOrderNotificationEmail(orderNotificationEmail, orderWithEmail, shopData.settings);
            }
            
            // Send confirmation to customer
            const customerEmailAddress = orderWithEmail.customerEmail || orderWithEmail.shippingAddress?.email;
            if (customerEmailAddress) {
              console.log('Sending confirmation to customer:', customerEmailAddress);
              await sendCustomerConfirmationEmail(orderWithEmail, shopData.settings);
            }
          }
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              status: 'completed',
              orderId: stripeOrderId
            })
          };
        } catch (error) {
          console.error('Stripe verification error:', error);
          return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: `Stripe Verifizierung fehlgeschlagen: ${error.message}` }) };
        }
      }
      
      // Handle PayPal capture (existing logic)
      if (!paymentConfig?.paypal?.enabled) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'PayPal nicht konfiguriert' }) };
      }
      
      try {
        const captureResult = await capturePayPalOrder(paymentConfig.paypal, providerOrderId);
        
        // Update order status in separate orders table
        const updatedOrder = await updateOrderStatus(tenantId, orderId, 'completed', {
          captureId: captureResult.purchase_units[0]?.payments?.captures[0]?.id,
          capturedAt: new Date().toISOString()
        });
        
        if (updatedOrder) {
          // Merge customer email if provided
          const orderWithEmail = {
            ...updatedOrder,
            customerEmail: customerEmail || updatedOrder.customerEmail
          };
          
          console.log('Order found for email notifications:', orderId, 'customerEmail:', orderWithEmail.customerEmail);
          
          // Send notification to shop owner
          if (orderNotificationEmail) {
            console.log('Sending order notification to shop owner:', orderNotificationEmail);
            await sendOrderNotificationEmail(orderNotificationEmail, orderWithEmail, shopData.settings);
          } else {
            console.log('No shop owner notification email configured');
          }
          
          // Send confirmation to customer
          const customerEmailAddress = orderWithEmail.customerEmail || orderWithEmail.shippingAddress?.email;
          console.log('Sending confirmation to customer:', customerEmailAddress);
          if (customerEmailAddress) {
            await sendCustomerConfirmationEmail(orderWithEmail, shopData.settings);
          } else {
            console.log('No customer email available for confirmation');
          }
        } else {
          console.log('Order not found for email notifications:', orderId);
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            status: captureResult.status,
            orderId
          })
        };
      } catch (error) {
        console.error('Capture error:', error);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: `Zahlung fehlgeschlagen: ${error.message}` }) };
      }
    }

    // POST /tenants/{tenantId}/shop/webhook - Payment webhooks
    if (httpMethod === 'POST' && path.includes('/webhook')) {
      const body = event.body;
      const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
      
      const shopData = await getShop(tenantId);
      const { paymentConfig } = shopData.settings;
      
      // Handle Stripe webhook
      if (signature && paymentConfig?.stripe?.enabled) {
        try {
          const isValid = await verifyStripeWebhook(paymentConfig.stripe, body, signature);
          if (!isValid) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Invalid signature' }) };
          }
          
          const webhookEvent = JSON.parse(body);
          
          if (webhookEvent.type === 'checkout.session.completed') {
            const session = webhookEvent.data.object;
            // Find and update order by session ID
            await updateOrderByProviderRef(tenantId, 'stripe', session.id, 'completed');
          }
          
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ received: true }) };
        } catch (error) {
          console.error('Stripe webhook error:', error);
          return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
        }
      }
      
      // Handle Mollie webhook
      // Mollie sends webhook data as application/x-www-form-urlencoded with just "id=tr_xxx"
      if (paymentConfig?.mollie?.enabled) {
        try {
          let paymentId;
          
          // Mollie sends data as form-urlencoded: "id=tr_xxx"
          if (body && body.includes('id=')) {
            // Parse URL-encoded body
            const params = new URLSearchParams(body);
            paymentId = params.get('id');
          } else if (body) {
            // Try JSON parse as fallback
            try {
              const parsed = JSON.parse(body);
              paymentId = parsed.id;
            } catch (e) {
              // Body might be just the ID
              paymentId = body.trim();
            }
          }
          
          if (!paymentId) {
            console.error('Mollie webhook: No payment ID found in body:', body);
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'No payment ID' }) };
          }
          
          console.log('Mollie webhook received for payment:', paymentId);
          
          const payment = await getMolliePayment(paymentConfig.mollie, paymentId);
          console.log('Mollie payment status:', payment.status, 'for payment:', paymentId);
          
          if (payment.status === 'paid') {
            const updatedOrder = await updateOrderByProviderRef(tenantId, 'mollie', paymentId, 'completed', {
              molliePaymentId: paymentId,
              completedAt: new Date().toISOString()
            });
            
            // Send email notifications if order was found and updated
            if (updatedOrder) {
              console.log('Mollie order completed, sending emails for order:', updatedOrder.orderId);
              
              const { orderNotificationEmail } = shopData.settings;
              
              // Send notification to shop owner
              if (orderNotificationEmail) {
                console.log('Sending order notification to shop owner:', orderNotificationEmail);
                await sendOrderNotificationEmail(orderNotificationEmail, updatedOrder, shopData.settings);
              }
              
              // Send confirmation to customer
              const customerEmailAddress = updatedOrder.customerEmail || updatedOrder.shippingAddress?.email;
              if (customerEmailAddress) {
                console.log('Sending confirmation to customer:', customerEmailAddress);
                await sendCustomerConfirmationEmail(updatedOrder, shopData.settings);
              }
            }
          } else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
            await updateOrderByProviderRef(tenantId, 'mollie', paymentId, payment.status);
          }
          
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ received: true }) };
        } catch (error) {
          console.error('Mollie webhook error:', error);
          return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
        }
      }
      
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ received: true }) };
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
  }
};
