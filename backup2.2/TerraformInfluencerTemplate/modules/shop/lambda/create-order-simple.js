// Simple Create Order - Works without payment settings configured
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { items, paymentProvider = 'paypal' } = body;

    // Get user from Cognito authorizer (or guest)
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

    // For now, create a mock payment URL
    // In production, this would integrate with actual payment providers
    const mockPaymentId = `pay_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const approvalUrl = `${process.env.FRONTEND_URL}/checkout?orderId=${orderId}&provider=${paymentProvider}`;

    // Save order to DynamoDB
    const timestamp = Date.now();
    const order = {
      orderId,
      userId,
      email: userEmail,
      status: 'pending',
      paymentProvider,
      paymentId: mockPaymentId,
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
      paymentId: mockPaymentId,
      approvalUrl,
      message: 'Order created successfully. Payment integration pending.'
    });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
