// Create Order with Real PayPal Integration
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const FRONTEND_URL = process.env.FRONTEND_URL;

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

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

// Create PayPal Order
async function createPayPalOrder(orderId, totalAmount, items, accessToken, mode) {
  const PAYPAL_API = mode === 'live' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
    
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        amount: {
          currency_code: 'EUR',
          value: totalAmount.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: 'EUR',
              value: totalAmount.toFixed(2)
            }
          }
        },
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity.toString(),
          unit_amount: {
            currency_code: 'EUR',
            value: item.price.toFixed(2)
          }
        }))
      }],
      application_context: {
        return_url: `${FRONTEND_URL}/order-confirmation?orderId=${orderId}`,
        cancel_url: `${FRONTEND_URL}/cart`,
        brand_name: 'Honigwabe Shop',
        user_action: 'PAY_NOW'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal API Error:', error);
    throw new Error('Failed to create PayPal order');
  }

  return await response.json();
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { items, customerEmail } = body;

    // Get user from Cognito (if logged in)
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || 'guest';
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email || customerEmail || '';

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return response(400, { error: 'Items are required' });
    }

    // Validate email for guest checkout
    if (userId === 'guest' && !customerEmail) {
      return response(400, { error: 'Email is required for guest checkout' });
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
      if (product.stock !== undefined && product.stock < item.quantity) {
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

    // Get PayPal settings from DynamoDB
    const paypalSettings = await getPayPalSettings();

    // Create PayPal order
    const accessToken = await getPayPalAccessToken(
      paypalSettings.clientId, 
      paypalSettings.secret,
      paypalSettings.mode
    );
    const paypalOrder = await createPayPalOrder(
      orderId, 
      totalAmount, 
      orderItems, 
      accessToken,
      paypalSettings.mode
    );

    // Get approval URL
    const approvalUrl = paypalOrder.links.find(link => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('No approval URL from PayPal');
    }

    // Save order to DynamoDB
    const timestamp = Date.now();
    const order = {
      orderId,
      userId,
      email: userEmail,
      status: 'pending',
      paymentProvider: 'paypal',
      paymentId: paypalOrder.id,
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

    console.log('Order created:', orderId, 'PayPal ID:', paypalOrder.id);

    return response(200, {
      orderId,
      paymentId: paypalOrder.id,
      approvalUrl,
      totalAmount
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
