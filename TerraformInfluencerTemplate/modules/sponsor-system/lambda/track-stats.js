const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const sponsorId = event.pathParameters?.sponsorId;
        const eventType = event.path.includes('/view') ? 'view' : 'click';
        
        if (!sponsorId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing sponsorId' })
            };
        }
        
        // Counter in Sponsors Table erhöhen
        const updateExpression = eventType === 'view' 
            ? 'ADD #views :inc' 
            : 'ADD #clicks :inc';
        
        const expressionAttributeNames = eventType === 'view'
            ? { '#views': 'views' }
            : { '#clicks': 'clicks' };
        
        await docClient.send(new UpdateCommand({
            TableName: process.env.SPONSORS_TABLE,
            Key: { sponsorId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: {
                ':inc': 1
            }
        }));
        
        // Event in Stats Table speichern
        await docClient.send(new PutCommand({
            TableName: process.env.STATS_TABLE,
            Item: {
                sponsorId,
                timestamp: Date.now(),
                eventType,
                userAgent: event.headers?.['user-agent'] || 'unknown',
                ip: event.requestContext?.http?.sourceIp || 'unknown'
            }
        }));
        
        console.log(`Tracked ${eventType} for sponsor:`, sponsorId);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ message: 'Event tracked successfully' })
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
