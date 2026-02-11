const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Simple frame extraction using sharp (no FFmpeg needed)
// We'll extract frames by downloading video and using MediaInfo
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  try {
    const body = JSON.parse(event.body);
    const { videoKey, tenantId } = body;
    
    if (!videoKey || !tenantId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'videoKey and tenantId required' })
      };
    }
    
    // For now, return a simple response that triggers client-side frame extraction
    // The client will use HTML5 Video API to extract frames
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Use client-side frame extraction',
        videoUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${videoKey}`,
        videoKey
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
