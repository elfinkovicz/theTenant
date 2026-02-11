exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const { httpMethod } = event;
    
    // CORS headers
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    };
    
    // Handle OPTIONS request
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'OK' })
        };
    }
    
    // For now, just return a simple response
    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
            message: 'Tenant registration endpoint is working',
            method: httpMethod,
            timestamp: new Date().toISOString()
        })
    };
};