const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Use us-west-2 for Stability AI models
const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-west-2' });

const STYLE_PROMPTS = {
  lustig: {
    prompt: 'Using the provided reference image from the video as the main visual base, generate a humorous YouTube thumbnail. Enhance playful and exaggerated facial expressions while keeping the person recognizable. From the provided title, derive a short, funny, and catchy thumbnail text (2–4 words) that matches the meaning of the title and increases curiosity. Place the text large, bold, and clearly readable. Bright lighting, vibrant colors, energetic mood, expressive emotions, bold YouTube thumbnail style, optimized for small screens.',
    negative: 'long sentences, unreadable text, clutter, watermark, logo, blur, dark lighting, distorted face, bad anatomy'
  },
  reisserisch: {
    prompt: 'Using the provided reference image as a visual anchor, create a highly dramatic and attention-grabbing YouTube thumbnail. Intensify emotions such as shock, disbelief, fear, or excitement while preserving identity. Generate a short, powerful, clickbait-style thumbnail text (2–5 words) that accurately reflects and amplifies the provided title. The text should create urgency or mystery without being misleading. Strong contrast, cinematic lighting, bold colors, dramatic shadows, large readable typography, designed for maximum click-through rate.',
    negative: 'misleading text, long phrases, dull colors, flat lighting, watermark, logo, low resolution, chaotic composition'
  },
  seriös: {
    prompt: 'Using the provided reference image from the video, generate a clean and professional YouTube thumbnail. The subject should appear confident, calm, and trustworthy. Create a short, clear thumbnail text (2–4 words) that summarizes the core message of the provided title in a factual and credible way. The text should be subtle, highly readable, and supportive rather than sensational. Neutral studio lighting, balanced composition, modern professional aesthetic, realistic colors, high clarity.',
    negative: 'clickbait exaggeration, slang, emojis, cartoon style, long text, watermark, logo, cluttered background'
  }
};

// Supported aspect ratios for Stability AI Image Services
const ASPECT_RATIOS = {
  '16:9': '16:9',   // Standard YouTube thumbnail
  '9:16': '9:16'    // Shorts/Reels vertical format
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    const body = JSON.parse(event.body);
    const { frameBase64, title, style, tenantId, aspectRatio } = body;
    
    if (!frameBase64 || !title || !style || !tenantId) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ error: 'frameBase64, title, style, and tenantId required' })
      };
    }
    
    if (!STYLE_PROMPTS[style]) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ error: 'Invalid style. Use: lustig, reisserisch, or seriös' })
      };
    }
    
    // Determine aspect ratio (default to 16:9)
    const selectedAspectRatio = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['16:9'];
    const isVertical = aspectRatio === '9:16';
    
    console.log(`Using aspect ratio: ${aspectRatio || '16:9'}`);
    
    // Frame is already base64 encoded from frontend
    console.log('Using frame from frontend (base64)');
    
    // Prepare Bedrock request for Stability AI Control Structure
    // This service maintains the structure of the input image while applying style transformations
    const stylePrompt = STYLE_PROMPTS[style];
    
    // Adjust prompt for vertical format
    const formatHint = isVertical 
      ? 'vertical mobile format, TikTok/YouTube Shorts style, centered composition for portrait view'
      : 'horizontal widescreen format';
    
    const mainPrompt = `Video title: "${title}". ${stylePrompt.prompt}`;
    
    // Stability AI SD3.5 Large payload for image-to-image
    const payload = {
      prompt: mainPrompt,
      negative_prompt: stylePrompt.negative,
      mode: "image-to-image",
      image: frameBase64,
      strength: 0.65,  // How much to transform (0 = no change, 1 = complete change)
      output_format: "jpeg"
    };
    
    console.log('Invoking Bedrock Stability AI SD3.5 Large with style:', style, 'aspect:', aspectRatio || '16:9');
    
    const command = new InvokeModelCommand({
      modelId: 'stability.sd3-5-large-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });
    
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.images || responseBody.images.length === 0) {
      throw new Error('No image generated by Bedrock');
    }
    
    const enhancedImageBase64 = responseBody.images[0];
    
    console.log('Thumbnail generated successfully with Stability AI');
    
    // Return base64 image directly to frontend (no S3 upload yet)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        imageBase64: enhancedImageBase64,
        style,
        aspectRatio: aspectRatio || '16:9',
        prompt: mainPrompt
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ 
        error: error.message,
        details: error.stack
      })
    };
  }
};
