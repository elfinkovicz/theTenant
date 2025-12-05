const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const now = new Date().toISOString();
        
        // Aktive Sponsoren abrufen
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.SPONSORS_TABLE,
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :status',
            FilterExpression: 'startDate <= :now AND endDate >= :now',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'active',
                ':now': now
            }
        }));
        
        // Nach Slot gruppieren
        const sponsors = {
            top: null,
            bottom: null,
            left: null,
            right: null,
            creator: null
        };
        
        result.Items?.forEach(item => {
            if (!sponsors[item.slot]) {
                sponsors[item.slot] = {
                    sponsorId: item.sponsorId,
                    company: item.company,
                    imageUrl: item.imageUrl,
                    targetUrl: item.targetUrl,
                    slot: item.slot,
                    startDate: item.startDate,
                    endDate: item.endDate
                };
            }
        });
        
        console.log('Active sponsors:', sponsors);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'max-age=300' // 5 Minuten Cache
            },
            body: JSON.stringify({ sponsors })
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
