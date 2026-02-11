const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const transcribe = new TranscribeClient({ region: process.env.REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// Pricing constants (in EUR)
const TRANSCRIBE_PRICE_PER_MINUTE = 0.024;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

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
    // Don't fail the main operation if billing tracking fails
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  const tenantId = pathParameters?.tenantId;

  if (!userId) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Nicht autorisiert' }) };
  }

  try {
    // POST /tenants/{tenantId}/podcasts/ai-transcribe - Start transcription
    if (httpMethod === 'POST' && path.includes('/ai-transcribe')) {
      const { podcastId, audioKey } = JSON.parse(event.body || '{}');
      
      if (!podcastId || !audioKey) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'podcastId und audioKey erforderlich' }) };
      }

      const jobName = `podcast-${tenantId}-${podcastId}-${Date.now()}`;
      const s3Uri = `s3://${process.env.ASSETS_BUCKET}/${audioKey}`;

      // Start Transcribe job
      const transcribeParams = {
        TranscriptionJobName: jobName,
        LanguageCode: 'de-DE',
        MediaFormat: audioKey.split('.').pop() || 'mp3',
        Media: { MediaFileUri: s3Uri },
        OutputBucketName: process.env.TRANSCRIPTS_BUCKET,
        OutputKey: `transcripts/${tenantId}/${podcastId}.json`,
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 10
        }
      };

      await transcribe.send(new StartTranscriptionJobCommand(transcribeParams));

      // Get audio duration for billing estimate (from podcast data)
      const podcastData = await dynamodb.send(new GetCommand({
        TableName: process.env.TENANT_PODCASTS_TABLE,
        Key: { tenant_id: tenantId }
      }));
      
      const podcast = podcastData.Item?.podcasts?.find(p => p.podcastId === podcastId);
      const durationMinutes = podcast?.duration ? Math.ceil(podcast.duration / 60) : 0;
      const estimatedCost = durationMinutes * TRANSCRIBE_PRICE_PER_MINUTE;

      // Track usage for billing
      await trackAiUsage(tenantId, 'transcribe', {
        podcast_id: podcastId,
        job_name: jobName,
        duration_minutes: durationMinutes,
        estimated_cost: estimatedCost,
        status: 'started',
        service: 'AWS Transcribe'
      });

      // Update podcast status in DynamoDB
      await updatePodcastAiStatus(tenantId, podcastId, 'transcribing', jobName);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Transkription gestartet',
          jobName,
          status: 'transcribing'
        })
      };
    }

    // GET /tenants/{tenantId}/podcasts/ai-status/{podcastId} - Check status
    if (httpMethod === 'GET' && path.includes('/ai-status')) {
      const podcastId = path.split('/ai-status/')[1];
      
      const result = await dynamodb.send(new GetCommand({
        TableName: process.env.TENANT_PODCASTS_TABLE,
        Key: { tenant_id: tenantId }
      }));

      const podcast = result.Item?.podcasts?.find(p => p.podcastId === podcastId);
      
      if (!podcast) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Podcast nicht gefunden' }) };
      }

      // If transcribing, check Transcribe job status
      if (podcast.aiStatus === 'transcribing' && podcast.transcribeJobName) {
        const jobResult = await transcribe.send(new GetTranscriptionJobCommand({
          TranscriptionJobName: podcast.transcribeJobName
        }));
        
        const jobStatus = jobResult.TranscriptionJob?.TranscriptionJobStatus;
        
        if (jobStatus === 'COMPLETED') {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
              status: 'transcribed',
              message: 'Transkription abgeschlossen, Beschreibung wird generiert...'
            })
          };
        } else if (jobStatus === 'FAILED') {
          await updatePodcastAiStatus(tenantId, podcastId, 'failed');
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ status: 'failed', message: 'Transkription fehlgeschlagen' })
          };
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: podcast.aiStatus || 'none',
          description: podcast.aiDescription
        })
      };
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

async function updatePodcastAiStatus(tenantId, podcastId, status, jobName = null) {
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
        ...(jobName && { transcribeJobName: jobName })
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
