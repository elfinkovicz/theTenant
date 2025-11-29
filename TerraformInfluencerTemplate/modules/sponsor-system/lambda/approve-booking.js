const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const bookingId = event.pathParameters?.bookingId;
        
        if (!bookingId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing bookingId' })
            };
        }
        
        // Booking abrufen
        const getResult = await docClient.send(new GetCommand({
            TableName: process.env.SPONSORS_TABLE,
            Key: { sponsorId: bookingId }
        }));
        
        if (!getResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Booking not found' })
            };
        }
        
        // Status auf 'active' setzen
        await docClient.send(new UpdateCommand({
            TableName: process.env.SPONSORS_TABLE,
            Key: { sponsorId: bookingId },
            UpdateExpression: 'SET #status = :status, approvedAt = :approvedAt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'active',
                ':approvedAt': new Date().toISOString()
            }
        }));
        
        console.log('Booking approved:', bookingId);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Booking approved successfully',
                sponsorId: bookingId,
                status: 'active'
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
