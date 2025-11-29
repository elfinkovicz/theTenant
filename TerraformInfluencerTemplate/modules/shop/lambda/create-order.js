const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const body = JSON.parse(event.body);
        
        // Validierung
        if (!body.userId || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        // Produkte validieren und Gesamtpreis berechnen
        let totalAmount = 0;
        const orderItems = [];
        
        for (const item of body.items) {
            const product = await docClient.send(new GetCommand({
                TableName: process.env.PRODUCTS_TABLE,
                Key: { productId: item.productId }
            }));
            
            if (!product.Item) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: `Product ${item.productId} not found` })
                };
            }
            
            const quantity = item.quantity || 1;
            const itemTotal = product.Item.price * quantity;
            totalAmount += itemTotal;
            
            orderItems.push({
                productId: item.productId,
                name: product.Item.name,
                price: product.Item.price,
                quantity,
                total: itemTotal
            });
        }
        
        // Order-ID generieren
        const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Order erstellen
        const order = {
            orderId,
            userId: body.userId,
            items: orderItems,
            totalAmount,
            status: 'pending',
            shippingAddress: body.shippingAddress || {},
            createdAt: new Date().toISOString()
        };
        
        // In DynamoDB speichern
        await docClient.send(new PutCommand({
            TableName: process.env.ORDERS_TABLE,
            Item: order
        }));
        
        console.log('Order created:', orderId);
        
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                orderId,
                totalAmount,
                status: 'pending',
                message: 'Order created successfully'
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
