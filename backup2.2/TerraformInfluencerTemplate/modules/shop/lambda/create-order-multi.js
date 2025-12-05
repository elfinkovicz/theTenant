// Create Order with Multi-Provider Support (PayPal, Stripe, Mollie)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const kmsClient = new KMSClient({});

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;

// Payment Provider Clients
const PayPalClient = require('./providers/paypal');
const StripeClient = require('./providers/stripe');
const MollieClient = require('./providers/mollie');

// Helper: Decrypt KMS encrypted value
async function decryptValue(ciphertext) {
  if (!ciphertext) return '';
  
  try {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, 'base64')
    });
    const result = await kmsClient.send(command);
    return Buffer.from(result.Plaintext).toString('utf-8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt credentials');
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { items, paymentProvider = 'paypal' } = body;

    // Get user from Cognito authorizer
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || 'guest';
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email || '';

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return response(400, { error: 'Items are required' });
    }

    // Validate stock and calculate total
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const productResult = await docClient.send(new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId: item.productId }
      }));

      if (!productResult.Item) {
        return response(404, { error: `Product ${item.productId} not found` });
      }

      const product = productResult.Item;

      // Check stock
      if (product.stock < item.quantity) {
        return response(400, { 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl || null
      });
    }

    // Create order ID
    const orderId = `ord_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Get payment settings
    const settingsResult = await docClient.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: 'payment-config' }
    }));

    if (!settingsResult.Item) {
      return response(500, { error: 'Payment settings not configured' });
    }

    const settings = settingsResult.Item;

    // Create payment with selected provider
    let paymentResult;
    
    try {
      switch (paymentProvider) {
        case 'paypal':
          if (!settings.paypalEnabled) {
            return response(400, { error: 'PayPal is not enabled' });
          }
          // Decrypt PayPal credentials
          const paypalConfig = {
            clientId: await decryptValue(settings.paypal.clientId),
            clientSecret: await decryptValue(settings.paypal.clientSecret)
          };
          const paypal = new PayPalClient(paypalConfig);
          paymentResult = await paypal.createOrder(totalAmount, 'EUR', orderItems, orderId);
          break;

        case 'stripe':
          if (!settings.stripeEnabled) {
            return response(400, { error: 'Stripe is not enabled' });
          }
          // Decrypt Stripe credentials
          const stripeConfig = {
            publishableKey: settings.stripe.publishableKey, // Not encrypted
            secretKey: await decryptValue(settings.stripe.secretKey),
            webhookSecret: await decryptValue(settings.stripe.webhookSecret)
          };
          const stripe = new StripeClient(stripeConfig);
          paymentResult = await stripe.createPaymentIntent(totalAmount, 'eur', orderId);
          break;

        case 'mollie':
          if (!settings.mollieEnabled) {
            return response(400, { error: 'Mollie is not enabled' });
          }
          // Decrypt Mollie credentials
          const mollieConfig = {
            apiKey: await decryptValue(settings.mollie.apiKey)
          };
          const mollie = new MollieClient(mollieConfig);
          paymentResult = await mollie.createPayment(totalAmount, 'EUR', orderId);
          break;

        default:
          return response(400, { error: `Unsupported payment provider: ${paymentProvider}` });
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      return response(500, { error: `Payment creation failed: ${error.message}` });
    }

    // Save order to DynamoDB
    const timestamp = Date.now();
    const order = {
      orderId,
      userId,
      email: userEmail,
      status: 'pending',
      paymentProvider,
      paymentId: paymentResult.id,
      items: orderItems,
      totalAmount,
      currency: 'EUR',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await docClient.send(new PutCommand({
      TableName: ORDERS_TABLE,
      Item: order
    }));

    console.log('Order created:', orderId);

    return response(200, {
      orderId,
      paymentId: paymentResult.id,
      approvalUrl: paymentResult.approvalUrl,
      clientSecret: paymentResult.clientSecret
    });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};

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
