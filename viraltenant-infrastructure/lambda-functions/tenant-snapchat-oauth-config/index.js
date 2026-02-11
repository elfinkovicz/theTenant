/**
 * Snapchat OAuth Config Lambda
 * Returns the Snapchat Client ID for OAuth flow
 */

exports.handler = async (event) => {
  console.log('Snapchat OAuth Config Request:', JSON.stringify(event, null, 2))

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    const clientId = process.env.SNAPCHAT_CLIENT_ID

    if (!clientId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Snapchat OAuth not configured' })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientId })
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
