/**
 * Snapchat OAuth Callback Lambda
 * Exchanges authorization code for access token and stores in DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb')
const https = require('https')

const dynamoClient = new DynamoDBClient({ region: process.env.REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data })
        }
      })
    })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

exports.handler = async (event) => {
  console.log('Snapchat OAuth Callback:', JSON.stringify(event, null, 2))

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { code, tenantId, redirectUri } = body

    if (!code || !tenantId || !redirectUri) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      }
    }

    // Exchange code for access token
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.SNAPCHAT_CLIENT_ID,
      client_secret: process.env.SNAPCHAT_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri
    }).toString()

    const tokenResponse = await httpsRequest({
      hostname: 'accounts.snapchat.com',
      path: '/login/oauth2/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    }, tokenData)

    if (tokenResponse.statusCode !== 200) {
      console.error('Token exchange failed:', tokenResponse)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Token exchange failed', 
          details: tokenResponse.data 
        })
      }
    }

    const { access_token, refresh_token, expires_in } = tokenResponse.data

    // Get user profile
    const profileResponse = await httpsRequest({
      hostname: 'kit.snapchat.com',
      path: '/v1/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    let displayName = 'Snapchat User'
    let externalId = ''

    if (profileResponse.statusCode === 200 && profileResponse.data.data) {
      displayName = profileResponse.data.data.me?.display_name || displayName
      externalId = profileResponse.data.data.me?.external_id || ''
    }

    // Get Public Profile ID (needed for posting)
    // Note: User must have a Public Profile enabled on Snapchat
    let profileId = ''
    const publicProfileResponse = await httpsRequest({
      hostname: 'businessapi.snapchat.com',
      path: '/v1/me/public_profiles',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    console.log('Public Profile Response:', JSON.stringify(publicProfileResponse, null, 2))

    if (publicProfileResponse.statusCode === 200 && publicProfileResponse.data.public_profiles?.length > 0) {
      profileId = publicProfileResponse.data.public_profiles[0].id
      console.log('Found Public Profile ID:', profileId)
    }

    // Store in DynamoDB
    const expiresAt = Date.now() + (expires_in * 1000)

    await docClient.send(new PutCommand({
      TableName: process.env.SNAPCHAT_SETTINGS_TABLE,
      Item: {
        tenant_id: tenantId,
        enabled: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        profileId,
        externalId,
        displayName,
        expiresAt,
        postAsStory: false,
        updatedAt: new Date().toISOString()
      }
    }))

    console.log('Snapchat OAuth successful for tenant:', tenantId)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        displayName,
        profileId,
        hasPublicProfile: !!profileId
      })
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
