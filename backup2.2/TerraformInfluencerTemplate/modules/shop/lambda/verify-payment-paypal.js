// Verify Payment with PayPal and Send Confirmation Emails
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SHOP_OWNER_EMAIL = process.env.SHOP_OWNER_EMAIL;

// Get PayPal Settings from DynamoDB
async function getPayPalSettings() {
  const result = await docClient.send(new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: 'payment-config' }
  }));

  if (!result.Item || !result.Item.paypalEnabled) {
    throw new Error('PayPal is not enabled');
  }

  return {
    clientId: result.Item.paypalClientId,
    secret: result.Item.paypalSecret,
    mode: result.Item.paypalMode || 'live'
  };
}

// Get PayPal Access Token
async function getPayPalAccessToken(clientId, secret, mode) {
  const PAYPAL_API = mode === 'live' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
    
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

// Capture PayPal Payment
async function capturePayPalPayment(paymentId, accessToken, mode) {
  const PAYPAL_API = mode === 'live' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
    
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${paymentId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal Capture Error:', error);
    throw new Error('Failed to capture PayPal payment');
  }

  return await response.json();
}

// Send Customer Confirmation Email
async function sendCustomerEmail(order) {
  const itemsList = order.items.map(item => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">€${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bestellbestätigung</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #FFC400;">Vielen Dank für deine Bestellung!</h1>
        
        <p>Hallo,</p>
        <p>deine Bestellung wurde erfolgreich abgeschlossen und bezahlt.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Bestellnummer:</strong> ${order.orderId}</p>
          <p style="margin: 5px 0 0 0;"><strong>Datum:</strong> ${new Date(order.createdAt).toLocaleDateString('de-DE')}</p>
        </div>
        
        <h2>Bestellte Artikel</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;">Artikel</th>
              <th style="padding: 8px; text-align: center;">Menge</th>
              <th style="padding: 8px; text-align: right;">Preis</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold;">
              <td colspan="2" style="padding: 12px 8px; text-align: right;">Gesamt:</td>
              <td style="padding: 12px 8px; text-align: right; color: #FFC400;">€${order.totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        <p style="margin-top: 30px;">Deine Bestellung wird in Kürze bearbeitet und versendet.</p>
        
        <p>Viele Grüße<br>Honigwabe Shop Team</p>
      </div>
    </body>
    </html>
  `;

  const command = new SendEmailCommand({
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [order.email]
    },
    Message: {
      Subject: {
        Data: `Bestellbestätigung - ${order.orderId}`,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: emailHtml,
          Charset: 'UTF-8'
        }
      }
    }
  });

  await sesClient.send(command);
  console.log('Customer email sent to:', order.email);
}

// Send Shop Owner Notification Email
async function sendShopOwnerEmail(order) {
  const itemsList = order.items.map(item => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">€${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Neue Bestellung</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #FFC400;">Neue Bestellung eingegangen!</h1>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Bestellnummer:</strong> ${order.orderId}</p>
          <p style="margin: 5px 0 0 0;"><strong>Datum:</strong> ${new Date(order.createdAt).toLocaleDateString('de-DE')}</p>
          <p style="margin: 5px 0 0 0;"><strong>Kunde:</strong> ${order.email}</p>
          <p style="margin: 5px 0 0 0;"><strong>User ID:</strong> ${order.userId}</p>
          <p style="margin: 5px 0 0 0;"><strong>PayPal Transaction:</strong> ${order.paymentId}</p>
        </div>
        
        <h2>Bestellte Artikel</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;">Artikel</th>
              <th style="padding: 8px; text-align: center;">Menge</th>
              <th style="padding: 8px; text-align: right;">Preis</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold;">
              <td colspan="2" style="padding: 12px 8px; text-align: right;">Gesamt:</td>
              <td style="padding: 12px 8px; text-align: right; color: #FFC400;">€${order.totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        <p style="margin-top: 30px;"><strong>Bitte Bestellung bearbeiten und versenden.</strong></p>
      </div>
    </body>
    </html>
  `;

  const command = new SendEmailCommand({
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [SHOP_OWNER_EMAIL]
    },
    Message: {
      Subject: {
        Data: `Neue Bestellung - ${order.orderId}`,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: emailHtml,
          Charset: 'UTF-8'
        }
      }
    }
  });

  await sesClient.send(command);
  console.log('Shop owner email sent to:', SHOP_OWNER_EMAIL);
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { orderId, paymentId } = body;

    if (!orderId || !paymentId) {
      return response(400, { error: 'orderId and paymentId are required' });
    }

    // Get order from DynamoDB
    const orderResult = await docClient.send(new GetCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId, userId: body.userId || 'guest' }
    }));

    if (!orderResult.Item) {
      return response(404, { error: 'Order not found' });
    }

    const order = orderResult.Item;

    // Check if already paid
    if (order.status === 'paid' || order.status === 'completed') {
      return response(200, {
        orderId,
        status: order.status,
        message: 'Order already processed'
      });
    }

    // Get PayPal settings from DynamoDB
    const paypalSettings = await getPayPalSettings();

    // Verify and capture payment with PayPal
    const accessToken = await getPayPalAccessToken(
      paypalSettings.clientId,
      paypalSettings.secret,
      paypalSettings.mode
    );
    const captureResult = await capturePayPalPayment(paymentId, accessToken, paypalSettings.mode);

    console.log('PayPal capture result:', JSON.stringify(captureResult, null, 2));

    // Check capture status
    if (captureResult.status !== 'COMPLETED') {
      return response(400, { 
        error: 'Payment not completed',
        status: captureResult.status
      });
    }

    // Update order status
    await docClient.send(new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId, userId: order.userId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, paymentCaptured = :captured, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'paid',
        ':updatedAt': Date.now(),
        ':captured': true,
        ':completedAt': Date.now()
      }
    }));

    console.log('Order status updated to paid');

    // Send confirmation emails
    try {
      await Promise.all([
        sendCustomerEmail(order),
        sendShopOwnerEmail(order)
      ]);
      console.log('Confirmation emails sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the whole request if emails fail
    }

    return response(200, {
      orderId,
      status: 'paid',
      message: 'Payment verified and confirmed'
    });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
