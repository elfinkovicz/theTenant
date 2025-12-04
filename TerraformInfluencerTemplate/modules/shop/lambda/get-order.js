// Get Order Details
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ORDERS_TABLE = process.env.ORDERS_TABLE;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const orderId = event.pathParameters?.orderId;

    if (!orderId) {
      return response(400, { error: 'orderId is required' });
    }

    // Get user info
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || '';
    const groups = event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'] || '';
    const isAdmin = groups.includes('admin');

    // Get order
    const result = await docClient.send(new GetCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId }
    }));

    if (!result.Item) {
      return response(404, { error: 'Order not found' });
    }

    const order = result.Item;

    // Check authorization (owner or admin)
    if (!isAdmin && order.userId !== userId) {
      return response(403, { error: 'Unauthorized' });
    }

    return response(200, order);

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
