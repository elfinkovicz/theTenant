const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const bedrock = new BedrockRuntimeClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// Bedrock Claude Haiku pricing (per 1000 tokens)
const BEDROCK_INPUT_PRICE_PER_1K = 0.00025;
const BEDROCK_OUTPUT_PRICE_PER_1K = 0.00125;

// Track AI usage for billing
async function trackAiUsage(tenantId, usageType, details) {
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageId = `${usageType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    await dynamodb.send(new PutCommand({
      TableName: process.env.AI_USAGE_TABLE,
      Item: {
        tenant_id: tenantId,
        usage_id: usageId,
        billing_month: billingMonth,
        usage_type: usageType,
        ...details,
        created_at: now.toISOString()
      }
    }));
    console.log(`AI usage tracked: ${usageType} for tenant ${tenantId}`);
  } catch (error) {
    console.error('Error tracking AI usage:', error);
  }
}

// Triggered by EventBridge when Transcribe job completes
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Extract job details from EventBridge event
    const jobName = event.detail?.TranscriptionJobName;
    const jobStatus = event.detail?.TranscriptionJobStatus;

    if (!jobName || jobStatus !== 'COMPLETED') {
      console.log('Job not completed or no job name:', jobStatus);
      return { statusCode: 200, body: 'Skipped' };
    }

    // Parse tenant and podcast ID from job name: podcast-{tenantId}-{podcastId (UUID)}-{timestamp}
    // Example: podcast-platform-6c4da574-9510-491f-8e13-a0ba045b4964-1767820018447
    const match = jobName.match(/^podcast-([^-]+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d+)$/i);
    if (!match) {
      console.log('Not a valid podcast transcription job name:', jobName);
      return { statusCode: 200, body: 'Not a podcast job' };
    }

    const tenantId = match[1];
    const podcastId = match[2];

    console.log(`Processing transcript for tenant: ${tenantId}, podcast: ${podcastId}`);

    // Get transcript from S3
    const transcriptKey = `transcripts/${tenantId}/${podcastId}.json`;
    const transcriptResponse = await s3.send(new GetObjectCommand({
      Bucket: process.env.TRANSCRIPTS_BUCKET,
      Key: transcriptKey
    }));

    const transcriptData = JSON.parse(await transcriptResponse.Body.transformToString());
    const transcript = transcriptData.results?.transcripts?.[0]?.transcript || '';

    if (!transcript) {
      console.error('No transcript found');
      await updatePodcastDescription(tenantId, podcastId, null, 'failed');
      return { statusCode: 400, body: 'No transcript' };
    }

    // Truncate transcript if too long (Bedrock has token limits)
    const maxChars = 50000;
    const truncatedTranscript = transcript.length > maxChars 
      ? transcript.substring(0, maxChars) + '...' 
      : transcript;

    // Generate description with Bedrock Claude
    const prompt = `Du bist ein Podcast-Beschreibungs-Generator. Analysiere das folgende Transkript eines Podcasts und erstelle eine ansprechende, informative Beschreibung auf Deutsch.

Die Beschreibung soll:
- Maximal 500 Zeichen lang sein
- Die Hauptthemen zusammenfassen
- Neugierig auf den Inhalt machen
- In einem professionellen aber zugänglichen Ton geschrieben sein
- Keine Spoiler enthalten

Transkript:
${truncatedTranscript}

Erstelle nur die Beschreibung, ohne Einleitung oder Erklärung:`;

    const bedrockResponse = await bedrock.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const description = responseBody.content?.[0]?.text?.trim() || '';

    // Calculate token usage and cost
    const inputTokens = responseBody.usage?.input_tokens || Math.ceil(truncatedTranscript.length / 4);
    const outputTokens = responseBody.usage?.output_tokens || Math.ceil(description.length / 4);
    const bedrockCost = (inputTokens / 1000 * BEDROCK_INPUT_PRICE_PER_1K) + (outputTokens / 1000 * BEDROCK_OUTPUT_PRICE_PER_1K);

    // Track Bedrock usage for billing
    await trackAiUsage(tenantId, 'bedrock', {
      podcast_id: podcastId,
      model: 'claude-3-haiku',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: parseFloat(bedrockCost.toFixed(4)),
      service: 'Amazon Bedrock'
    });

    if (!description) {
      console.error('No description generated');
      await updatePodcastDescription(tenantId, podcastId, null, 'failed');
      return { statusCode: 400, body: 'No description generated' };
    }

    // Save description to DynamoDB
    await updatePodcastDescription(tenantId, podcastId, description, 'completed');

    console.log('Description generated successfully for podcast:', podcastId);
    return { statusCode: 200, body: 'Success' };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: error.message };
  }
};

async function updatePodcastDescription(tenantId, podcastId, description, status) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_PODCASTS_TABLE,
    Key: { tenant_id: tenantId }
  }));

  if (!result.Item) return;

  const podcasts = result.Item.podcasts.map(p => {
    if (p.podcastId === podcastId) {
      return { 
        ...p, 
        aiStatus: status,
        ...(description && { description, aiDescription: true })
      };
    }
    return p;
  });

  await dynamodb.send(new UpdateCommand({
    TableName: process.env.TENANT_PODCASTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: 'SET podcasts = :podcasts, updated_at = :updated',
    ExpressionAttributeValues: {
      ':podcasts': podcasts,
      ':updated': new Date().toISOString()
    }
  }));
}
