const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const orderId = event.pathParameters?.orderId;
        const body = JSON.parse(event.body);
        
        if (!orderId || !body.paymentMethodId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        // Order abrufen
        const orderResult = await docClient.send(new GetCommand({
            TableName: process.env.ORDERS_TABLE,
            Key: { orderId, userId: body.userId }
        }));
        
        if (!orderResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Order not found' })
            };
        }
        
        const order = orderResult.Item;
        
        // Stripe Payment Intent erstellen (Placeholder - echte Stripe Integration benötigt)
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.create({
        //     amount: Math.round(order.totalAmount * 100), // in Cents
        //     currency: 'eur',
        //     payment_method: body.paymentMethodId,
        //     confirm: true
        // });
        
        // Für Demo: Payment als erfolgreich markieren
        const paymentId = `pi_${Date.now()}`;
        
        // Order-Status aktualisieren
        await docClient.send(new UpdateCommand({
            TableName: process.env.ORDERS_TABLE,
            Key: { orderId, userId: body.userId },
            UpdateExpression: 'SET #status = :status, paymentId = :paymentId, paidAt = :paidAt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'paid',
                ':paymentId': paymentId,
                ':paidAt': new Date().toISOString()
            }
        }));
        
        console.log('Payment processed for order:', orderId);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                orderId,
                paymentId,
                status: 'paid',
                message: 'Payment processed successfully'
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
