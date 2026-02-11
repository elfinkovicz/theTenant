/**
 * Snapchat Crosspost Lambda
 * Posts content to Snapchat via Public Profile API
 * Supports: Stories (24h), Spotlight (permanent), Saved Stories (permanent)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const https = require('https')
const crypto = require('crypto')

const dynamoClient = new DynamoDBClient({ region: process.env.REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const s3Client = new S3Client({ region: process.env.REGION })

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

function httpsUpload(options, buffer) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: data ? JSON.parse(data) : {} })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data })
        }
      })
    })
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

async function refreshAccessToken(settings) {
  console.log('Refreshing Snapchat access token...')
  
  const tokenData = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.SNAPCHAT_CLIENT_ID,
    client_secret: process.env.SNAPCHAT_CLIENT_SECRET,
    refresh_token: settings.refreshToken
  }).toString()

  const response = await httpsRequest({
    hostname: 'accounts.snapchat.com',
    path: '/login/oauth2/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(tokenData)
    }
  }, tokenData)

  if (response.statusCode !== 200) {
    throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`)
  }

  const { access_token, refresh_token, expires_in } = response.data
  const expiresAt = Date.now() + (expires_in * 1000)

  await docClient.send(new PutCommand({
    TableName: process.env.SNAPCHAT_SETTINGS_TABLE,
    Item: {
      ...settings,
      accessToken: access_token,
      refreshToken: refresh_token || settings.refreshToken,
      expiresAt,
      updatedAt: new Date().toISOString()
    }
  }))

  return access_token
}

async function getValidAccessToken(tenantId) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.SNAPCHAT_SETTINGS_TABLE,
    Key: { tenant_id: tenantId }
  }))

  if (!result.Item) {
    throw new Error('Snapchat not configured for this tenant')
  }

  const settings = result.Item

  if (settings.expiresAt < Date.now() + 300000) {
    return { token: await refreshAccessToken(settings), settings }
  }

  return { token: settings.accessToken, settings }
}

async function downloadFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.CREATOR_ASSETS_BUCKET,
    Key: key
  })

  const response = await s3Client.send(command)
  const chunks = []
  
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }
  
  return Buffer.concat(chunks)
}

// Encrypt media for Snapchat upload (AES-256-CBC)
function encryptMedia(buffer) {
  const key = crypto.randomBytes(32) // 256-bit key
  const iv = crypto.randomBytes(16)  // 128-bit IV
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  
  return {
    encryptedBuffer: encrypted,
    key: key.toString('base64'),
    iv: iv.toString('base64')
  }
}

// Upload media to Snapchat Public Profile API
async function uploadMediaToSnapchat(accessToken, profileId, mediaBuffer, mediaType) {
  console.log('Uploading media to Snapchat Public Profile...')

  // Step 1: Encrypt the media
  const { encryptedBuffer, key, iv } = encryptMedia(mediaBuffer)
  
  // Step 2: Create media container
  const createMediaResponse = await httpsRequest({
    hostname: 'businessapi.snapchat.com',
    path: `/v1/public_profiles/${profileId}/media`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({
    type: mediaType === 'video' ? 'VIDEO' : 'IMAGE',
    name: `upload_${Date.now()}`,
    key: key,
    iv: iv
  }))

  console.log('Create media response:', JSON.stringify(createMediaResponse, null, 2))

  if (createMediaResponse.statusCode !== 200) {
    throw new Error(`Failed to create media: ${JSON.stringify(createMediaResponse.data)}`)
  }

  const mediaId = createMediaResponse.data.media_id
  const addPath = createMediaResponse.data.add_path

  // Step 3: Upload encrypted media (multipart if > 32MB)
  const CHUNK_SIZE = 32 * 1024 * 1024 // 32MB
  const totalParts = Math.ceil(encryptedBuffer.length / CHUNK_SIZE)

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const start = (partNumber - 1) * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, encryptedBuffer.length)
    const chunk = encryptedBuffer.slice(start, end)

    const uploadUrl = new URL(addPath)
    const boundary = `----WebKitFormBoundary${Date.now()}`
    
    // Build multipart form data
    const formData = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="action"\r\n\r\nADD\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="part_number"\r\n\r\n${partNumber}\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="media.bin"\r\n`),
      Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`),
      chunk,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])

    const uploadResponse = await httpsUpload({
      hostname: uploadUrl.hostname,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length
      }
    }, formData)

    console.log(`Upload part ${partNumber}/${totalParts} response:`, uploadResponse.statusCode)

    if (uploadResponse.statusCode !== 200) {
      throw new Error(`Failed to upload media part ${partNumber}: ${JSON.stringify(uploadResponse.data)}`)
    }
  }

  // Step 4: Finalize upload
  const finalizeUrl = new URL(addPath)
  const finalizeResponse = await httpsRequest({
    hostname: finalizeUrl.hostname,
    path: finalizeUrl.pathname + finalizeUrl.search,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({ action: 'FINALIZE' }))

  console.log('Finalize response:', JSON.stringify(finalizeResponse, null, 2))

  if (finalizeResponse.statusCode !== 200) {
    throw new Error(`Failed to finalize media: ${JSON.stringify(finalizeResponse.data)}`)
  }

  return mediaId
}

// Post Story (24h visibility)
async function postStory(accessToken, profileId, mediaId) {
  console.log('Posting Story to Snapchat...')

  const response = await httpsRequest({
    hostname: 'businessapi.snapchat.com',
    path: `/v1/public_profiles/${profileId}/stories`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({ media_id: mediaId }))

  console.log('Post Story response:', JSON.stringify(response, null, 2))

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Failed to post story: ${JSON.stringify(response.data)}`)
  }

  return { type: 'story', ...response.data }
}

// Post Spotlight (permanent, TikTok-like)
async function postSpotlight(accessToken, profileId, mediaId, description, locale = 'en_US') {
  console.log('Posting Spotlight to Snapchat...')

  const body = {
    media_id: mediaId,
    locale: locale
  }

  // Description can include hashtags, max 160 chars
  if (description) {
    body.description = description.substring(0, 160)
  }

  const response = await httpsRequest({
    hostname: 'businessapi.snapchat.com',
    path: `/v1/public_profiles/${profileId}/spotlights`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify(body))

  console.log('Post Spotlight response:', JSON.stringify(response, null, 2))

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Failed to post spotlight: ${JSON.stringify(response.data)}`)
  }

  return { type: 'spotlight', ...response.data }
}

// Create Saved Story (permanent highlight)
async function createSavedStory(accessToken, profileId, mediaId, title) {
  console.log('Creating Saved Story on Snapchat...')

  const response = await httpsRequest({
    hostname: 'businessapi.snapchat.com',
    path: `/v1/public_profiles/${profileId}/saved_stories`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({
    saved_stories: [{
      snap_sources: [{ media_id: mediaId }],
      title: title ? title.substring(0, 45) : 'New Post'
    }]
  }))

  console.log('Create Saved Story response:', JSON.stringify(response, null, 2))

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Failed to create saved story: ${JSON.stringify(response.data)}`)
  }

  return { type: 'saved_story', ...response.data }
}

exports.handler = async (event) => {
  console.log('Snapchat Crosspost Event:', JSON.stringify(event, null, 2))

  try {
    const { tenantId, post, settings } = event
    
    const title = post?.title || event.title
    const description = post?.description || event.description
    const imageKey = post?.imageKey || event.imageKey
    const videoKey = post?.videoKey || event.videoKey
    const isShort = post?.isShort || event.isShort
    // Post type: 'story' (24h), 'spotlight' (permanent), 'saved_story' (highlight)
    const postType = post?.snapchatPostType || event.snapchatPostType || 'spotlight'

    if (!tenantId) {
      throw new Error('tenantId is required')
    }

    // Get settings from event or DB
    let snapchatSettings = settings
    if (!snapchatSettings) {
      const settingsResult = await docClient.send(new GetCommand({
        TableName: process.env.SNAPCHAT_SETTINGS_TABLE,
        Key: { tenant_id: tenantId }
      }))
      snapchatSettings = settingsResult.Item
    }

    if (!snapchatSettings || !snapchatSettings.enabled) {
      console.log('Snapchat not enabled for tenant:', tenantId)
      return { success: false, reason: 'Snapchat not enabled' }
    }

    if (!snapchatSettings.profileId) {
      console.log('Snapchat Public Profile ID not configured')
      return { success: false, reason: 'Public Profile ID not configured' }
    }

    // Get valid access token
    const { token: accessToken } = await getValidAccessToken(tenantId)

    // Determine media
    let mediaKey = videoKey || imageKey
    let mediaType = videoKey ? 'video' : 'image'

    // Shorts are always video
    if (isShort && videoKey) {
      mediaKey = videoKey
      mediaType = 'video'
    }

    if (!mediaKey) {
      console.log('No media to post to Snapchat')
      return { success: false, reason: 'No media provided' }
    }

    // Download media from S3
    const mediaBuffer = await downloadFromS3(mediaKey)
    console.log(`Downloaded media: ${mediaKey}, size: ${mediaBuffer.length} bytes`)

    // Validate media constraints
    // Story: Video 3-60s, max 32MB, 9:16 aspect ratio
    // Spotlight: Video 5-60s, max 32MB, 9:16 aspect ratio
    if (mediaBuffer.length > 32 * 1024 * 1024) {
      console.log('Media too large for Snapchat (max 32MB)')
      return { success: false, reason: 'Media exceeds 32MB limit' }
    }

    // Upload media to Snapchat
    const mediaId = await uploadMediaToSnapchat(
      accessToken,
      snapchatSettings.profileId,
      mediaBuffer,
      mediaType
    )

    console.log('Media uploaded, ID:', mediaId)

    // Post based on type
    let result
    switch (postType) {
      case 'story':
        result = await postStory(accessToken, snapchatSettings.profileId, mediaId)
        break
      case 'saved_story':
        result = await createSavedStory(accessToken, snapchatSettings.profileId, mediaId, title)
        break
      case 'spotlight':
      default:
        // Spotlight is the default - permanent like TikTok
        result = await postSpotlight(accessToken, snapchatSettings.profileId, mediaId, description)
        break
    }

    console.log('Snapchat post successful:', result)

    return {
      success: true,
      platform: 'snapchat',
      postType,
      result
    }
  } catch (error) {
    console.error('Snapchat crosspost error:', error)
    return {
      success: false,
      platform: 'snapchat',
      error: error.message
    }
  }
}
