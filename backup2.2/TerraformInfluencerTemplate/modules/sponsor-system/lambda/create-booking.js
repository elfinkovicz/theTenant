const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const body = JSON.parse(event.body);
        
        // Validierung
        if (!body.company || !body.slot || !body.startDate || !body.duration) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        // Sponsor-ID generieren
        const sponsorId = `sponsor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // End-Datum berechnen
        const startDate = new Date(body.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (body.duration * 7)); // duration in Wochen
        
        // Preis berechnen
        const basePrices = {
            top: 199,
            bottom: 129,
            creator: 299
        };
        
        const discounts = {
            1: 0,
            2: 0.10,
            4: 0.20,
            8: 0.30
        };
        
        const basePrice = basePrices[body.slot] || 99;
        const discount = discounts[body.duration] || 0;
        const totalPrice = basePrice * body.duration * (1 - discount);
        
        // Sponsor-Objekt erstellen
        const sponsor = {
            sponsorId,
            company: body.company,
            email: body.email,
            slot: body.slot,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            duration: body.duration,
            basePrice,
            discount,
            totalPrice,
            imageUrl: body.imageUrl || '',
            targetUrl: body.targetUrl || '',
            status: 'pending',
            views: 0,
            clicks: 0,
            createdAt: new Date().toISOString(),
            ttl: Math.floor(endDate.getTime() / 1000) + (30 * 24 * 60 * 60) // 30 Tage nach Ende
        };
        
        // In DynamoDB speichern
        await docClient.send(new PutCommand({
            TableName: process.env.SPONSORS_TABLE,
            Item: sponsor
        }));
        
        console.log('Booking created:', sponsorId);
        
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                sponsorId,
                message: 'Booking created successfully',
                totalPrice,
                status: 'pending'
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
