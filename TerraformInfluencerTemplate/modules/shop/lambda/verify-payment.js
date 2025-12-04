// Verify Payment and Send Confirmation Emails
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

const PayPalClient = require('./providers/paypal');
const StripeClient = require('./providers/stripe');
const MollieClient = require('./providers/mollie');

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { orderId, paymentId } = body;

    if (!orderId || !paymentId) {
      return response(400, { error: 'orderId and paymentId are required' });
    }

    // Get order
    const orderResult = await docClient.send(new GetCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId }
    }));

    if (!orderResult.Item) {
      return response(404, { error: 'Order not found' });
    }

    const order = orderResult.Item;

    if (order.status === 'completed') {
      return response(200, { message: 'Order already completed' });
    }

    // Get payment settings
    const settingsResult = await docClient.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: 'payment-config' }
    }));

    if (!settingsResult.Item) {
      return response(500, { error: 'Payment settings not configured' });
    }

    const settings = settingsResult.Item;

    // Verify payment with provider
    let paymentStatus;

    try {
      switch (order.paymentProvider) {
        case 'paypal':
          const paypal = new PayPalClient(settings.paypal);
          const captureResult = await paypal.captureOrder(paymentId);
          paymentStatus = captureResult.status === 'COMPLETED' ? 'completed' : 'failed';
          break;

        case 'stripe':
          const stripe = new StripeClient(settings.stripe);
          const stripeResult = await stripe.confirmPayment(paymentId);
          paymentStatus = stripeResult.status === 'succeeded' ? 'completed' : 'failed';
          break;

        case 'mollie':
          const mollie = new MollieClient(settings.mollie);
          const mollieResult = await mollie.getPayment(paymentId);
          paymentStatus = mollieResult.status === 'paid' ? 'completed' : 'failed';
          break;

        default:
          return response(400, { error: `Unsupported payment provider: ${order.paymentProvider}` });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      return response(500, { error: `Payment verification failed: ${error.message}` });
    }

    if (paymentStatus !== 'completed') {
      return response(400, { error: 'Payment not completed' });
    }

    // Update stock for each item
    for (const item of order.items) {
      await docClient.send(new UpdateCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId: item.productId },
        UpdateExpression: 'SET stock = stock - :qty',
        ExpressionAttributeValues: {
          ':qty': item.quantity
        }
      }));
    }

    // Update order status
    const timestamp = Date.now();
    await docClient.send(new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: 'SET #status = :status, completedAt = :time, updatedAt = :time',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':time': timestamp
      }
    }));

    // Send confirmation emails
    await Promise.all([
      sendCustomerEmail(order, settings),
      sendSellerEmail(order, settings)
    ]);

    console.log('Order completed:', orderId);

    return response(200, { success: true, orderId });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};

async function sendCustomerEmail(order, settings) {
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
        <p>deine Bestellung wurde erfolgreich abgeschlossen.</p>
        
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
        
        <p style="margin-top: 30px;">Bei Fragen zu deiner Bestellung kannst du uns jederzeit kontaktieren.</p>
        
        <p>Viele Grüße<br>${settings.sellerName || 'Dein Shop Team'}</p>
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

async function sendSellerEmail(order, settings) {
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
          <p style="margin: 5px 0 0 0;"><strong>Zahlungsanbieter:</strong> ${order.paymentProvider.toUpperCase()}</p>
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
      </div>
    </body>
    </html>
  `;

  const command = new SendEmailCommand({
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [settings.sellerEmail]
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
  console.log('Seller email sent to:', settings.sellerEmail);
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
