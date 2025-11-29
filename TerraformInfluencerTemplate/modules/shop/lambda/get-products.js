const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const category = event.queryStringParameters?.category;
        
        let result;
        
        if (category) {
            // Produkte nach Kategorie filtern
            result = await docClient.send(new QueryCommand({
                TableName: process.env.PRODUCTS_TABLE,
                IndexName: 'CategoryIndex',
                KeyConditionExpression: 'category = :category',
                ExpressionAttributeValues: {
                    ':category': category
                }
            }));
        } else {
            // Alle Produkte abrufen
            result = await docClient.send(new ScanCommand({
                TableName: process.env.PRODUCTS_TABLE
            }));
        }
        
        const products = result.Items || [];
        
        console.log(`Found ${products.length} products`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'max-age=300'
            },
            body: JSON.stringify({ products })
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
