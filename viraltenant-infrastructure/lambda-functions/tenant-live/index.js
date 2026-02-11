const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { IvsClient, GetChannelCommand, GetStreamKeyCommand, GetStreamCommand, UpdateChannelCommand } = require('@aws-sdk/client-ivs');
const { IvschatClient, CreateChatTokenCommand } = require('@aws-sdk/client-ivschat');
const { MediaLiveClient, CreateChannelCommand, DeleteChannelCommand, StartChannelCommand, StopChannelCommand, DescribeChannelCommand, CreateInputCommand, DeleteInputCommand, DescribeInputCommand } = require('@aws-sdk/client-medialive');
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand, DeleteRuleCommand, RemoveTargetsCommand } = require('@aws-sdk/client-eventbridge');
const { IAMClient, CreateServiceLinkedRoleCommand } = require('@aws-sdk/client-iam');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: process.env.REGION });
const ivs = new IvsClient({ region: process.env.REGION });
const ivsChat = new IvschatClient({ region: process.env.REGION });
const mediaLive = new MediaLiveClient({ region: process.env.REGION });
const eventBridge = new EventBridgeClient({ region: process.env.REGION });
const iam = new IAMClient({ region: process.env.REGION });
const ssm = new SSMClient({ region: process.env.REGION });
const lambda = new LambdaClient({ region: process.env.REGION });

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS'
};

async function resolveTenantId(tenantIdOrSubdomain) {
  // Already a UUID - return as-is
  if (tenantIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantIdOrSubdomain;
  }
  
  // Map 'platform' to 'www' subdomain for lookup
  const subdomain = tenantIdOrSubdomain === 'platform' ? 'www' : tenantIdOrSubdomain;
  
  const params = {
    TableName: process.env.TENANTS_TABLE,
    IndexName: 'subdomain-index',
    KeyConditionExpression: 'subdomain = :subdomain',
    ExpressionAttributeValues: { ':subdomain': subdomain }
  };
  
  const result = await dynamodb.send(new QueryCommand(params));
  return result.Items?.[0]?.tenant_id || tenantIdOrSubdomain;
}

async function isUserTenantAdmin(userId, tenantId) {
  // Always check the user_tenants table - strict tenant isolation
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId }
    }));
    const isAdmin = result.Item && result.Item.role === 'admin';
    console.log(`Admin check for user ${userId} on tenant ${tenantId}: ${isAdmin}`);
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin:', error);
    return false;
  }
}

const getDefaultData = (tenantId) => ({
  tenant_id: tenantId,
  streamUrl: '',
  streamTitle: 'Live Stream',
  streamDescription: '',
  chatEnabled: true,
  viewerCount: 0,
  isLive: false,
  schedule: [],
  overlays: [],
  settings: { autoStart: false, lowLatency: true, dvr: false },
  autoSaveStream: false,
  autoPublishToNewsfeed: false,
  membersOnly: false,
  // AWS IVS Felder
  ivs_channel_arn: '',
  ivs_ingest_endpoint: '',
  ivs_stream_key: '',
  ivs_playback_url: '',
  ivs_chat_room_arn: '',
  ivs_recording_config_arn: '',
  ivs_recordings_bucket: '',
  // Multistreaming Destinations
  stream_destinations: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const enrichWithUrls = (data) => {
  if (!data) return data;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  if (data.thumbnailKey) data.thumbnailUrl = `https://${cfDomain}/${data.thumbnailKey}`;
  if (data.offlineImageKey) data.offlineImageUrl = `https://${cfDomain}/${data.offlineImageKey}`;
  if (data.overlays) {
    data.overlays = data.overlays.map(o => ({
      ...o,
      imageUrl: o.imageKey ? `https://${cfDomain}/${o.imageKey}` : o.imageUrl
    }));
  }
  return data;
};

// AWS IVS Integration Functions
async function getIVSChannelInfo(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    if (result.Item && result.Item.ivs_channel_arn) {
      // Format ingest endpoint as full RTMPS URL for OBS
      const rawEndpoint = result.Item.ivs_ingest_endpoint;
      const formattedIngestEndpoint = rawEndpoint 
        ? (rawEndpoint.startsWith('rtmps://') 
            ? rawEndpoint 
            : `rtmps://${rawEndpoint}:443/app/`)
        : null;
      
      return {
        channelArn: result.Item.ivs_channel_arn,
        ingestEndpoint: formattedIngestEndpoint,
        streamKey: result.Item.ivs_stream_key,
        playbackUrl: result.Item.ivs_playback_url,
        chatRoomArn: result.Item.ivs_chat_room_arn
      };
    }
    
    // Return null if no IVS channel is configured for this tenant
    return null;
  } catch (error) {
    console.error('Error getting IVS channel info:', error);
    return null;
  }
}

async function createChatToken(chatRoomArn, userId, username) {
  try {
    const command = new CreateChatTokenCommand({
      roomIdentifier: chatRoomArn,
      userId: userId,
      attributes: {
        username: username
      },
      capabilities: ['SEND_MESSAGE', 'DISCONNECT_USER']
    });
    
    const response = await ivsChat.send(command);
    return response.token;
  } catch (error) {
    console.error('Error creating chat token:', error);
    throw error;
  }
}

// Check if IVS stream is currently live
async function checkStreamStatus(channelArn) {
  try {
    const command = new GetStreamCommand({
      channelArn: channelArn
    });
    
    const response = await ivs.send(command);
    
    // Stream exists and is live
    return {
      isLive: response.stream?.state === 'LIVE',
      state: response.stream?.state || 'OFFLINE',
      viewerCount: response.stream?.viewerCount || 0,
      startTime: response.stream?.startTime || null,
      health: response.stream?.health || 'UNKNOWN'
    };
  } catch (error) {
    // ChannelNotBroadcasting means stream is offline (not an error)
    if (error.name === 'ChannelNotBroadcasting') {
      return {
        isLive: false,
        state: 'OFFLINE',
        viewerCount: 0,
        startTime: null,
        health: 'UNKNOWN'
      };
    }
    console.error('Error checking stream status:', error);
    return {
      isLive: false,
      state: 'ERROR',
      viewerCount: 0,
      startTime: null,
      health: 'UNKNOWN'
    };
  }
}

// ============================================
// MediaLive Restreaming Functions
// ============================================

// Erstellt einen MediaLive Input für den IVS Stream
async function createMediaLiveInput(tenantId, ivsPlaybackUrl) {
  const inputName = `${process.env.PLATFORM_NAME || 'viraltenant'}-${tenantId.substring(0, 8)}-input`;
  
  try {
    const command = new CreateInputCommand({
      Name: inputName,
      Type: 'URL_PULL',
      Sources: [
        { Url: ivsPlaybackUrl }
      ],
      Tags: {
        TenantId: tenantId,
        Platform: process.env.PLATFORM_NAME || 'viraltenant'
      }
    });
    
    const response = await mediaLive.send(command);
    console.log(`MediaLive Input created: ${response.Input.Id}`);
    return response.Input;
  } catch (error) {
    console.error('Error creating MediaLive input:', error);
    throw error;
  }
}

// Erstellt einen MediaLive Channel für eine Destination
async function createMediaLiveChannel(tenantId, destinationId, inputId, rtmpUrl, streamKey, platform) {
  const channelName = `${process.env.PLATFORM_NAME || 'viraltenant'}-${tenantId.substring(0, 8)}-${platform}`;
  
  // RTMP URL und StreamName müssen separat sein für MediaLive
  // rtmpUrl sollte das Basis-URL sein (z.B. rtmp://a.rtmp.youtube.com/live2)
  // streamKey ist der Stream Name/Key
  
  try {
    const command = new CreateChannelCommand({
      Name: channelName,
      ChannelClass: 'SINGLE_PIPELINE', // Kosteneffizient für Restreaming
      InputAttachments: [
        {
          InputId: inputId,
          InputAttachmentName: 'ivs-input'
        }
      ],
      Destinations: [
        {
          Id: 'destination1',
          Settings: [
            { 
              Url: rtmpUrl,
              StreamName: streamKey  // Stream Key muss als StreamName angegeben werden
            }
          ]
        }
      ],
      EncoderSettings: {
        AudioDescriptions: [
          {
            AudioSelectorName: 'default',
            Name: 'audio_1',
            CodecSettings: {
              AacSettings: {
                Bitrate: 128000,
                CodingMode: 'CODING_MODE_2_0',
                InputType: 'NORMAL',
                Profile: 'LC',
                RateControlMode: 'CBR',
                RawFormat: 'NONE',
                SampleRate: 48000,
                Spec: 'MPEG4'
              }
            }
          }
        ],
        VideoDescriptions: [
          {
            Name: 'video_1',
            CodecSettings: {
              H264Settings: {
                Bitrate: 5000000,
                FramerateControl: 'SPECIFIED',
                FramerateNumerator: 30,
                FramerateDenominator: 1,
                GopSize: 1,
                GopSizeUnits: 'SECONDS',
                Level: 'H264_LEVEL_4_1',
                Profile: 'HIGH',
                RateControlMode: 'CBR',
                ScanType: 'PROGRESSIVE'
              }
            },
            Height: 1080,
            Width: 1920,
            RespondToAfd: 'NONE',
            ScalingBehavior: 'DEFAULT',
            Sharpness: 50
          }
        ],
        OutputGroups: [
          {
            Name: 'RTMP Output',
            OutputGroupSettings: {
              RtmpGroupSettings: {
                AuthenticationScheme: 'COMMON',
                CacheLength: 30,
                RestartDelay: 15
              }
            },
            Outputs: [
              {
                OutputName: 'rtmp_output',
                AudioDescriptionNames: ['audio_1'],
                VideoDescriptionName: 'video_1',
                OutputSettings: {
                  RtmpOutputSettings: {
                    Destination: {
                      DestinationRefId: 'destination1'
                    },
                    CertificateMode: 'SELF_SIGNED'
                  }
                }
              }
            ]
          }
        ],
        TimecodeConfig: {
          Source: 'SYSTEMCLOCK'
        }
      },
      RoleArn: process.env.MEDIALIVE_ROLE_ARN,
      Tags: {
        TenantId: tenantId,
        DestinationId: destinationId,
        Platform: process.env.PLATFORM_NAME || 'viraltenant'
      }
    });
    
    const response = await mediaLive.send(command);
    console.log(`MediaLive Channel created: ${response.Channel.Id}`);
    return response.Channel;
  } catch (error) {
    console.error('Error creating MediaLive channel:', error);
    throw error;
  }
}

// Startet das Restreaming für eine Destination
async function startRestreaming(tenantId, destinationId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    throw new Error('Tenant nicht gefunden');
  }
  
  const destinations = result.Item.stream_destinations || [];
  const destIndex = destinations.findIndex(d => d.id === destinationId);
  
  if (destIndex === -1) {
    throw new Error('Destination nicht gefunden');
  }
  
  const destination = destinations[destIndex];
  
  // Prüfe ob bereits aktiv
  if (destination.status === 'active' || destination.status === 'starting') {
    return { message: 'Restreaming läuft bereits', destination };
  }
  
  // *** WICHTIG: Prüfe 7-Kanal-Limit ***
  const activeChannels = destinations.filter(d => 
    d.status === 'active' || 
    d.status === 'starting' || 
    d.status === 'creating' ||
    d.mediaLiveChannelId
  );
  
  if (activeChannels.length >= 7) {
    throw new Error('Maximale Anzahl von 7 aktiven Kanälen erreicht. Bitte stoppe zuerst einen anderen Stream.');
  }
  
  // Hole IVS Playback URL
  const ivsInfo = await getIVSChannelInfo(tenantId);
  if (!ivsInfo || !ivsInfo.playbackUrl) {
    throw new Error('IVS Channel nicht konfiguriert');
  }
  
  // Variables for RTMP URL and Stream Key
  let rtmpUrl = destination.rtmpUrl;
  let streamKey = destination.streamKey;
  let facebookLiveVideoId = null;
  
  try {
    // Status auf "creating" setzen
    destinations[destIndex].status = 'creating';
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
    }));
    
    // *** Facebook OAuth: Create Live Video via Graph API ***
    if (destination.platform === 'facebook-live' && destination.oauthConnected && destination.pageAccessToken && destination.pageId) {
      console.log('Facebook OAuth destination detected, creating live video via Graph API');
      
      // Get stream title from tenant live settings
      const streamTitle = result.Item.streamTitle || 'Live Stream';
      const streamDescription = result.Item.streamDescription || '';
      
      const fbLiveData = await createFacebookLiveVideo(
        destination.pageId,
        destination.pageAccessToken,
        streamTitle,
        streamDescription
      );
      
      rtmpUrl = fbLiveData.rtmpUrl;
      streamKey = fbLiveData.streamKey;
      facebookLiveVideoId = fbLiveData.liveVideoId;
      
      // Store the live video ID for later (to end the broadcast)
      destinations[destIndex].facebookLiveVideoId = facebookLiveVideoId;
      destinations[destIndex].currentRtmpUrl = rtmpUrl;
      destinations[destIndex].currentStreamKey = streamKey;
      
      console.log(`Facebook Live video created: ${facebookLiveVideoId}, RTMP: ${rtmpUrl}`);
      
      await dynamodb.send(new PutCommand({
        TableName: process.env.TENANT_LIVE_TABLE,
        Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
      }));
    }
    
    // Validate RTMP URL and Stream Key
    if (!rtmpUrl || !streamKey) {
      throw new Error('RTMP URL und Stream Key sind erforderlich');
    }
    
    // Erstelle oder verwende existierenden Input
    let inputId = result.Item.medialive_input_id;
    if (!inputId) {
      const input = await createMediaLiveInput(tenantId, ivsInfo.playbackUrl);
      inputId = input.Id;
      
      // Speichere Input ID
      await dynamodb.send(new PutCommand({
        TableName: process.env.TENANT_LIVE_TABLE,
        Item: { ...result.Item, medialive_input_id: inputId, stream_destinations: destinations, updated_at: new Date().toISOString() }
      }));
    }
    
    // Erstelle MediaLive Channel falls nicht vorhanden
    // For OAuth destinations, always create a new channel since stream key changes each time
    let channelId = destination.mediaLiveChannelId;
    const needsNewChannel = !channelId || (destination.oauthConnected && facebookLiveVideoId);
    
    if (needsNewChannel) {
      // Delete old channel if exists (for OAuth destinations with new stream key)
      if (channelId) {
        try {
          await mediaLive.send(new StopChannelCommand({ ChannelId: channelId }));
          await new Promise(resolve => setTimeout(resolve, 5000));
          await mediaLive.send(new DeleteChannelCommand({ ChannelId: channelId }));
          console.log(`Deleted old MediaLive channel ${channelId} for OAuth destination`);
        } catch (e) {
          console.log('Could not delete old channel:', e.message);
        }
      }
      
      const channel = await createMediaLiveChannel(
        tenantId,
        destinationId,
        inputId,
        rtmpUrl,
        streamKey,
        destination.platform
      );
      channelId = channel.Id;
      destinations[destIndex].mediaLiveChannelId = channelId;
      
      // Speichere Channel ID sofort
      await dynamodb.send(new PutCommand({
        TableName: process.env.TENANT_LIVE_TABLE,
        Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
      }));
    }
    
    // Warte bis Channel IDLE ist (max 60 Sekunden)
    let channelState = 'CREATING';
    let waitAttempts = 0;
    const maxWaitAttempts = 12; // 12 * 5 Sekunden = 60 Sekunden
    
    while (channelState === 'CREATING' && waitAttempts < maxWaitAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 Sekunden warten
      
      try {
        const channelInfo = await mediaLive.send(new DescribeChannelCommand({ ChannelId: channelId }));
        channelState = channelInfo.State;
        console.log(`Channel ${channelId} state: ${channelState} (attempt ${waitAttempts + 1})`);
      } catch (e) {
        console.error('Error checking channel state:', e);
      }
      waitAttempts++;
    }
    
    if (channelState !== 'IDLE') {
      throw new Error(`Channel ist noch nicht bereit (Status: ${channelState}). Bitte versuche es in ein paar Sekunden erneut.`);
    }
    
    // Status auf "starting" setzen
    destinations[destIndex].status = 'starting';
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
    }));
    
    // Starte den Channel
    await mediaLive.send(new StartChannelCommand({ ChannelId: channelId }));
    
    // Update Status
    destinations[destIndex].status = 'active';
    destinations[destIndex].startedAt = new Date().toISOString();
    
    // Prüfe ob Auto-Stopp Timer gesetzt werden soll
    // Nur wenn auto_stop_setting > 0 und noch kein Timer läuft
    const autoStopSetting = result.Item.auto_stop_setting;
    let autoDestroyAt = result.Item.auto_destroy_at;
    let autoDestroyTimer = result.Item.auto_destroy_timer;
    let eventbridgeRuleName = result.Item.eventbridge_rule_name;
    
    if (autoStopSetting && autoStopSetting > 0 && !autoDestroyAt) {
      // Setze den Auto-Stopp Timer mit EventBridge
      autoDestroyAt = new Date(Date.now() + autoStopSetting * 60 * 1000).toISOString();
      autoDestroyTimer = autoStopSetting;
      
      const ruleName = `${process.env.PLATFORM_NAME || 'viraltenant'}-autostop-${tenantId.substring(0, 8)}`;
      
      try {
        // Lösche alte Regel falls vorhanden
        try {
          await eventBridge.send(new RemoveTargetsCommand({
            Rule: ruleName,
            Ids: ['auto-stop-target']
          }));
          await eventBridge.send(new DeleteRuleCommand({ Name: ruleName }));
        } catch (e) {
          // Ignorieren wenn Regel nicht existiert
        }
        
        // Erstelle neue Regel mit Cron-Expression für einmalige Ausführung
        const scheduleDate = new Date(Date.now() + autoStopSetting * 60 * 1000);
        const cronExpression = `cron(${scheduleDate.getUTCMinutes()} ${scheduleDate.getUTCHours()} ${scheduleDate.getUTCDate()} ${scheduleDate.getUTCMonth() + 1} ? ${scheduleDate.getUTCFullYear()})`;
        
        await eventBridge.send(new PutRuleCommand({
          Name: ruleName,
          ScheduleExpression: cronExpression,
          State: 'ENABLED',
          Description: `Auto-stop restreaming for tenant ${tenantId}`
        }));
        
        // Füge Lambda als Target hinzu
        await eventBridge.send(new PutTargetsCommand({
          Rule: ruleName,
          Targets: [{
            Id: 'auto-stop-target',
            Arn: process.env.LAMBDA_ARN,
            Input: JSON.stringify({
              source: 'eventbridge-autostop',
              tenantId: tenantId,
              action: 'auto-stop-restreaming'
            })
          }]
        }));
        
        eventbridgeRuleName = ruleName;
        console.log(`Auto-Stopp Timer gesetzt: ${autoStopSetting} Minuten, endet um ${autoDestroyAt}, EventBridge Rule: ${ruleName}`);
      } catch (error) {
        console.error('Error creating EventBridge rule:', error);
        // Fahre trotzdem fort - Timer wird in DynamoDB gespeichert
      }
    }
    
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { 
        ...result.Item, 
        stream_destinations: destinations, 
        auto_destroy_at: autoDestroyAt,
        auto_destroy_timer: autoDestroyTimer,
        eventbridge_rule_name: eventbridgeRuleName,
        updated_at: new Date().toISOString() 
      }
    }));
    
    return {
      message: 'Restreaming gestartet',
      destination: destinations[destIndex],
      autoDestroyAt: autoDestroyAt,
      warning: '⚠️ Multistreaming verursacht laufende Kosten. Bitte stoppen Sie das Restreaming wenn Sie es nicht mehr benötigen!'
    };
  } catch (error) {
    // Bei Fehler Status zurücksetzen
    destinations[destIndex].status = 'error';
    destinations[destIndex].lastError = error.message;
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
    }));
    throw error;
  }
}

// Stoppt das Restreaming für eine Destination
async function stopRestreaming(tenantId, destinationId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    throw new Error('Tenant nicht gefunden');
  }
  
  const destinations = result.Item.stream_destinations || [];
  const destIndex = destinations.findIndex(d => d.id === destinationId);
  
  if (destIndex === -1) {
    throw new Error('Destination nicht gefunden');
  }
  
  const destination = destinations[destIndex];
  const channelId = destination.mediaLiveChannelId;
  
  if (!channelId) {
    destinations[destIndex].status = 'inactive';
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
    }));
    return { message: 'Kein aktiver Channel', destination: destinations[destIndex] };
  }
  
  try {
    // Status auf "stopping" setzen
    destinations[destIndex].status = 'stopping';
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
    }));
    
    // *** Facebook OAuth: End Live Video via Graph API ***
    if (destination.platform === 'facebook-live' && destination.oauthConnected && destination.facebookLiveVideoId && destination.pageAccessToken) {
      console.log(`Ending Facebook Live video ${destination.facebookLiveVideoId}`);
      try {
        await endFacebookLiveVideo(destination.facebookLiveVideoId, destination.pageAccessToken);
        console.log('Facebook Live video ended successfully');
      } catch (e) {
        console.error('Error ending Facebook Live video:', e.message);
        // Continue with stopping MediaLive channel
      }
    }
    
    // Stoppe den Channel
    try {
      await mediaLive.send(new StopChannelCommand({ ChannelId: channelId }));
      console.log(`MediaLive Channel ${channelId} stop requested`);
    } catch (e) {
      console.error('Error stopping channel:', e);
    }
    
    // Warte bis Channel gestoppt ist (max 60 Sekunden)
    let channelState = 'STOPPING';
    let waitAttempts = 0;
    const maxWaitAttempts = 12;
    
    while ((channelState === 'STOPPING' || channelState === 'RUNNING') && waitAttempts < maxWaitAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        const channelInfo = await mediaLive.send(new DescribeChannelCommand({ ChannelId: channelId }));
        channelState = channelInfo.State;
        console.log(`Channel ${channelId} state: ${channelState}`);
      } catch (e) {
        // Channel könnte bereits gelöscht sein
        channelState = 'DELETED';
        break;
      }
      waitAttempts++;
    }
    
    // Lösche den Channel
    try {
      await mediaLive.send(new DeleteChannelCommand({ ChannelId: channelId }));
      console.log(`MediaLive Channel ${channelId} deleted`);
    } catch (e) {
      console.error('Error deleting channel:', e);
    }
    
    // Update Status
    destinations[destIndex].status = 'inactive';
    destinations[destIndex].mediaLiveChannelId = null;
    destinations[destIndex].stoppedAt = new Date().toISOString();
    // Clear Facebook Live video data
    destinations[destIndex].facebookLiveVideoId = null;
    destinations[destIndex].currentRtmpUrl = null;
    destinations[destIndex].currentStreamKey = null;
    
    // Prüfe ob noch andere aktive Channels vorhanden sind
    const hasOtherActiveChannels = destinations.some((d, i) => 
      i !== destIndex && (d.status === 'active' || d.status === 'starting' || d.status === 'creating' || d.mediaLiveChannelId)
    );
    
    // Wenn keine anderen aktiven Channels, lösche auch den Input
    let updatedItem = { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() };
    
    if (!hasOtherActiveChannels && result.Item.medialive_input_id) {
      try {
        await mediaLive.send(new DeleteInputCommand({ InputId: result.Item.medialive_input_id }));
        console.log(`MediaLive Input ${result.Item.medialive_input_id} deleted`);
        updatedItem.medialive_input_id = null;
      } catch (e) {
        console.error('Error deleting input:', e);
      }
      
      // Lösche auch den Auto-Stopp Timer wenn keine Channels mehr aktiv
      updatedItem.auto_destroy_at = null;
      updatedItem.auto_destroy_timer = null;
    }
    
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: updatedItem
    }));
    
    return { message: 'Restreaming gestoppt', destination: destinations[destIndex] };
  } catch (error) {
    destinations[destIndex].status = 'error';
    destinations[destIndex].lastError = error.message;
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: { ...result.Item, stream_destinations: destinations, updated_at: new Date().toISOString() }
    }));
    throw error;
  }
}

// Setzt einen Auto-Destroy Timer für alle aktiven Restreaming Channels
// Verwendet EventBridge Scheduler für zuverlässige Backend-Ausführung
async function setAutoDestroyTimer(tenantId, minutes) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    throw new Error('Tenant nicht gefunden');
  }
  
  const ruleName = `${process.env.PLATFORM_NAME || 'viraltenant'}-autostop-${tenantId.substring(0, 8)}`;
  
  // Wenn minutes = 0, deaktiviere den Timer
  if (minutes === 0) {
    // Lösche EventBridge Regel falls vorhanden
    try {
      await eventBridge.send(new RemoveTargetsCommand({
        Rule: ruleName,
        Ids: ['auto-stop-target']
      }));
      await eventBridge.send(new DeleteRuleCommand({ Name: ruleName }));
      console.log(`EventBridge rule ${ruleName} deleted`);
    } catch (e) {
      // Regel existiert möglicherweise nicht
      console.log('No existing EventBridge rule to delete');
    }
    
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Item: {
        ...result.Item,
        auto_stop_setting: 0,
        auto_destroy_timer: null,
        auto_destroy_at: null,
        eventbridge_rule_name: null,
        updated_at: new Date().toISOString()
      }
    }));
    
    return {
      message: 'Auto-Stopp deaktiviert',
      destroyAt: null,
      autoStopSetting: 0
    };
  }
  
  if (minutes < 15 || minutes > 480) {
    throw new Error('Timer muss zwischen 15 und 480 Minuten (8 Stunden) sein');
  }
  
  // Prüfe ob aktive Streams vorhanden sind
  const destinations = result.Item.stream_destinations || [];
  const hasActiveStreams = destinations.some(d => d.status === 'active' || d.status === 'starting' || d.status === 'creating');
  
  // Speichere die Einstellung immer
  let destroyAt = null;
  let autoDestroyTimer = null;
  
  if (hasActiveStreams) {
    destroyAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    autoDestroyTimer = minutes;
    
    // Erstelle EventBridge Regel für den Auto-Stopp
    try {
      // Lösche alte Regel falls vorhanden
      try {
        await eventBridge.send(new RemoveTargetsCommand({
          Rule: ruleName,
          Ids: ['auto-stop-target']
        }));
        await eventBridge.send(new DeleteRuleCommand({ Name: ruleName }));
      } catch (e) {
        // Ignorieren wenn Regel nicht existiert
      }
      
      // Erstelle neue Regel mit Cron-Expression für einmalige Ausführung
      const scheduleDate = new Date(Date.now() + minutes * 60 * 1000);
      // EventBridge cron: cron(minute hour day month ? year)
      const cronExpression = `cron(${scheduleDate.getUTCMinutes()} ${scheduleDate.getUTCHours()} ${scheduleDate.getUTCDate()} ${scheduleDate.getUTCMonth() + 1} ? ${scheduleDate.getUTCFullYear()})`;
      
      await eventBridge.send(new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: cronExpression,
        State: 'ENABLED',
        Description: `Auto-stop restreaming for tenant ${tenantId}`
      }));
      
      // Füge Lambda als Target hinzu
      await eventBridge.send(new PutTargetsCommand({
        Rule: ruleName,
        Targets: [{
          Id: 'auto-stop-target',
          Arn: process.env.LAMBDA_ARN,
          Input: JSON.stringify({
            source: 'eventbridge-autostop',
            tenantId: tenantId,
            action: 'auto-stop-restreaming'
          })
        }]
      }));
      
      console.log(`EventBridge rule ${ruleName} created for ${destroyAt}`);
    } catch (error) {
      console.error('Error creating EventBridge rule:', error);
      // Fahre trotzdem fort - Timer wird in DynamoDB gespeichert
    }
  }
  
  // Speichere in DynamoDB
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Item: {
      ...result.Item,
      auto_stop_setting: minutes,
      auto_destroy_timer: autoDestroyTimer,
      auto_destroy_at: destroyAt,
      eventbridge_rule_name: hasActiveStreams ? ruleName : null,
      updated_at: new Date().toISOString()
    }
  }));
  
  return {
    message: hasActiveStreams 
      ? `Auto-Destroy Timer gesetzt auf ${minutes} Minuten` 
      : `Auto-Stopp Einstellung auf ${minutes} Minuten gespeichert`,
    destroyAt: destroyAt,
    autoStopSetting: minutes,
    warning: hasActiveStreams 
      ? '⚠️ Alle aktiven Restreaming-Channels werden automatisch gestoppt um Kosten zu vermeiden.'
      : null
  };
}

// ============================================
// IVS Recording End Handler - Auto-Publish to Newsfeed
// ============================================

// Findet den Tenant anhand der IVS Channel ARN
async function findTenantByChannelArn(channelArn) {
  try {
    // Scanne die tenant_live Tabelle nach der Channel ARN
    const result = await dynamodb.send(new ScanCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      FilterExpression: 'ivs_channel_arn = :channelArn',
      ExpressionAttributeValues: {
        ':channelArn': channelArn
      }
    }));
    
    if (result.Items && result.Items.length > 0) {
      return result.Items[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding tenant by channel ARN:', error);
    return null;
  }
}

// Erstellt einen Newsfeed-Post aus einer Stream-Aufnahme
async function createNewsfeedPostFromRecording(tenantId, recordingInfo, streamSettings) {
  try {
    const postId = `recording-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Baue die Video-URL aus dem S3-Pfad
    const s3Path = recordingInfo.recording_s3_key_prefix;
    const videoKey = `${s3Path}/media/hls/master.m3u8`; // HLS Playlist
    const thumbnailKey = recordingInfo.thumbnail_s3_key || `${s3Path}/thumbnails/thumb0.jpg`;
    
    const post = {
      postId,
      title: streamSettings.streamTitle || 'Stream-Aufzeichnung',
      description: streamSettings.streamDescription || 'Automatisch gespeicherte Stream-Aufzeichnung',
      videoKey: videoKey,
      imageKey: thumbnailKey,
      videoUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${videoKey}`,
      imageUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${thumbnailKey}`,
      type: 'video',
      isStreamRecording: true,
      streamStartTime: recordingInfo.stream_start_time,
      streamEndTime: recordingInfo.stream_end_time,
      recordingDurationMs: recordingInfo.recording_duration_ms,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Hole existierenden Newsfeed
    const newsfeedResult = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_NEWSFEED_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    const existingNewsfeed = newsfeedResult.Item || {
      tenant_id: tenantId,
      posts: [],
      settings: { postsPerPage: 10, allowComments: true, moderationEnabled: false },
      created_at: new Date().toISOString()
    };
    
    // Füge neuen Post am Anfang hinzu
    existingNewsfeed.posts = [post, ...(existingNewsfeed.posts || [])];
    existingNewsfeed.updated_at = new Date().toISOString();
    
    // Speichere aktualisierten Newsfeed
    await dynamodb.send(new PutCommand({
      TableName: process.env.TENANT_NEWSFEED_TABLE,
      Item: existingNewsfeed
    }));
    
    console.log(`Newsfeed post created: ${postId} for tenant ${tenantId}`);
    
    // Trigger Crossposting wenn Dispatcher konfiguriert
    if (process.env.CROSSPOST_DISPATCHER_LAMBDA) {
      try {
        await lambda.send(new InvokeCommand({
          FunctionName: process.env.CROSSPOST_DISPATCHER_LAMBDA,
          InvocationType: 'Event',
          Payload: JSON.stringify({ tenantId, post })
        }));
        console.log('Crosspost dispatcher invoked for recording post');
      } catch (crosspostError) {
        console.error('Error invoking crosspost dispatcher:', crosspostError);
      }
    }
    
    return post;
  } catch (error) {
    console.error('Error creating newsfeed post from recording:', error);
    throw error;
  }
}

// Handler für IVS Recording End Events
async function handleRecordingEnd(detail) {
  const channelArn = detail.channel_arn;
  
  console.log(`Recording ended for channel: ${channelArn}`);
  
  // Finde den Tenant für diesen Channel
  const tenantData = await findTenantByChannelArn(channelArn);
  
  if (!tenantData) {
    console.log('No tenant found for channel ARN:', channelArn);
    return { message: 'No tenant found for channel' };
  }
  
  const tenantId = tenantData.tenant_id;
  console.log(`Found tenant: ${tenantId}`);
  
  // Prüfe ob autoSaveStream und autoPublishToNewsfeed aktiviert sind
  if (!tenantData.autoSaveStream) {
    console.log('autoSaveStream not enabled for tenant:', tenantId);
    return { message: 'Auto-save not enabled' };
  }
  
  if (!tenantData.autoPublishToNewsfeed) {
    console.log('autoPublishToNewsfeed not enabled for tenant:', tenantId);
    return { message: 'Auto-publish to newsfeed not enabled' };
  }
  
  // Erstelle Newsfeed-Post
  const recordingInfo = {
    recording_s3_key_prefix: detail.recording_s3_key_prefix,
    stream_start_time: detail.stream_start_time,
    stream_end_time: detail.stream_end_time,
    recording_duration_ms: detail.recording_duration_ms,
    thumbnail_s3_key: detail.thumbnail_s3_key
  };
  
  const post = await createNewsfeedPostFromRecording(tenantId, recordingInfo, tenantData);
  
  return {
    message: 'Recording published to newsfeed',
    tenantId,
    postId: post.postId
  };
}

// Wird von EventBridge aufgerufen um Streams automatisch zu stoppen
async function handleAutoStopEvent(tenantId) {
  console.log(`Auto-stop triggered for tenant ${tenantId}`);
  
  try {
    // Stoppe alle aktiven Streams
    const result = await stopAllRestreaming(tenantId);
    console.log(`Auto-stop completed: ${result.message}`);
    
    // Lösche die EventBridge Regel
    const ruleName = `${process.env.PLATFORM_NAME || 'viraltenant'}-autostop-${tenantId.substring(0, 8)}`;
    try {
      await eventBridge.send(new RemoveTargetsCommand({
        Rule: ruleName,
        Ids: ['auto-stop-target']
      }));
      await eventBridge.send(new DeleteRuleCommand({ Name: ruleName }));
      console.log(`EventBridge rule ${ruleName} cleaned up`);
    } catch (e) {
      console.error('Error cleaning up EventBridge rule:', e);
    }
    
    return result;
  } catch (error) {
    console.error('Error in auto-stop:', error);
    throw error;
  }
}

// Stoppt alle aktiven Restreaming Channels für einen Tenant
async function stopAllRestreaming(tenantId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    return { message: 'Tenant nicht gefunden' };
  }
  
  const destinations = result.Item.stream_destinations || [];
  const activeDestinations = destinations.filter(d => d.status === 'active' || d.status === 'starting' || d.status === 'creating' || d.mediaLiveChannelId);
  
  if (activeDestinations.length === 0) {
    return { message: 'Keine aktiven Streams gefunden' };
  }
  
  // Stoppe alle Channels und warte auf jeden
  const channelsToDelete = [];
  
  for (const dest of activeDestinations) {
    const destIndex = destinations.findIndex(d => d.id === dest.id);
    if (destIndex !== -1) {
      const channelId = destinations[destIndex].mediaLiveChannelId;
      
      if (channelId) {
        try {
          // Stoppe den Channel
          await mediaLive.send(new StopChannelCommand({ ChannelId: channelId }));
          console.log(`Stop requested for channel ${channelId}`);
          channelsToDelete.push(channelId);
        } catch (error) {
          console.error(`Error stopping channel ${channelId}:`, error);
          // Trotzdem zur Löschliste hinzufügen falls Channel existiert
          channelsToDelete.push(channelId);
        }
      }
      
      // Update Status
      destinations[destIndex].status = 'inactive';
      destinations[destIndex].mediaLiveChannelId = null;
      destinations[destIndex].stoppedAt = new Date().toISOString();
    }
  }
  
  // Warte bis alle Channels gestoppt sind (max 60 Sekunden)
  if (channelsToDelete.length > 0) {
    let waitAttempts = 0;
    const maxWaitAttempts = 12;
    
    while (waitAttempts < maxWaitAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      waitAttempts++;
      
      let allStopped = true;
      for (const channelId of channelsToDelete) {
        try {
          const channelInfo = await mediaLive.send(new DescribeChannelCommand({ ChannelId: channelId }));
          if (channelInfo.State === 'RUNNING' || channelInfo.State === 'STOPPING') {
            allStopped = false;
            console.log(`Channel ${channelId} still ${channelInfo.State}`);
          }
        } catch (e) {
          // Channel nicht gefunden = bereits gelöscht
          console.log(`Channel ${channelId} not found (already deleted?)`);
        }
      }
      
      if (allStopped) {
        console.log('All channels stopped');
        break;
      }
    }
    
    // Lösche alle Channels
    for (const channelId of channelsToDelete) {
      try {
        await mediaLive.send(new DeleteChannelCommand({ ChannelId: channelId }));
        console.log(`Deleted channel ${channelId}`);
      } catch (e) {
        console.error(`Error deleting channel ${channelId}:`, e);
      }
    }
  }
  
  // Lösche auch den Input wenn vorhanden
  let inputDeleted = false;
  if (result.Item.medialive_input_id) {
    try {
      await mediaLive.send(new DeleteInputCommand({ InputId: result.Item.medialive_input_id }));
      console.log(`Deleted input ${result.Item.medialive_input_id}`);
      inputDeleted = true;
    } catch (error) {
      console.error('Error deleting input:', error);
    }
  }
  
  // Speichere alle Änderungen
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Item: { 
      ...result.Item, 
      stream_destinations: destinations,
      medialive_input_id: inputDeleted ? null : result.Item.medialive_input_id,
      auto_destroy_timer: null,
      auto_destroy_at: null,
      updated_at: new Date().toISOString() 
    }
  }));
  
  return { message: `${activeDestinations.length} Restreaming-Channels gestoppt` };
}

// Holt den Restreaming Status
async function getRestreamingStatus(tenantId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    return { destinations: [], autoDestroyTimer: null, autoStopSetting: 120 };
  }
  
  const destinations = result.Item.stream_destinations || [];
  
  return {
    destinations: destinations.map(d => ({
      id: d.id,
      platform: d.platform,
      name: d.name,
      status: d.status,
      startedAt: d.startedAt,
      lastError: d.lastError,
      // OAuth info
      oauthConnected: d.oauthConnected || false,
      accountName: d.accountName || null
    })),
    autoDestroyTimer: result.Item.auto_destroy_timer,
    autoDestroyAt: result.Item.auto_destroy_at,
    autoStopSetting: result.Item.auto_stop_setting !== undefined ? result.Item.auto_stop_setting : 120,
    hasActiveChannels: destinations.some(d => d.status === 'active' || d.status === 'starting' || d.status === 'creating')
  };
}

// ============================================
// Facebook Live API Functions
// ============================================

// Creates a Facebook Live video and returns the stream URL/key
async function createFacebookLiveVideo(pageId, pageAccessToken, title, description) {
  console.log(`Creating Facebook Live video for page ${pageId}`);
  
  const params = new URLSearchParams();
  params.append('status', 'UNPUBLISHED'); // Start as unpublished, will go live when stream starts
  if (title) params.append('title', title);
  if (description) params.append('description', description);
  params.append('access_token', pageAccessToken);
  
  const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/live_videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  const data = await response.json();
  
  if (!response.ok || data.error) {
    console.error('Facebook Live API error:', data);
    throw new Error(data.error?.message || 'Facebook Live Video konnte nicht erstellt werden');
  }
  
  console.log('Facebook Live video created:', data.id);
  
  // The response contains:
  // - id: The live video ID
  // - stream_url: The RTMP URL with stream key (e.g., rtmps://live-api-s.facebook.com:443/rtmp/FB-123456789?s_bl=1&...)
  // - secure_stream_url: Same as stream_url but guaranteed RTMPS
  
  // Parse the stream URL to extract base URL and stream key
  const streamUrl = data.secure_stream_url || data.stream_url;
  
  if (!streamUrl) {
    throw new Error('Facebook hat keine Stream-URL zurückgegeben');
  }
  
  // Facebook stream URL format: rtmps://live-api-s.facebook.com:443/rtmp/STREAM_KEY
  // We need to split it into base URL and stream key for MediaLive
  const urlParts = streamUrl.match(/^(rtmps?:\/\/[^\/]+\/rtmp\/)(.+)$/);
  
  if (!urlParts) {
    throw new Error('Ungültiges Facebook Stream-URL Format');
  }
  
  return {
    liveVideoId: data.id,
    rtmpUrl: urlParts[1], // e.g., rtmps://live-api-s.facebook.com:443/rtmp/
    streamKey: urlParts[2], // The stream key part
    fullStreamUrl: streamUrl
  };
}

// Ends a Facebook Live video
async function endFacebookLiveVideo(liveVideoId, pageAccessToken) {
  console.log(`Ending Facebook Live video ${liveVideoId}`);
  
  const params = new URLSearchParams();
  params.append('end_live_video', 'true');
  params.append('access_token', pageAccessToken);
  
  const response = await fetch(`https://graph.facebook.com/v18.0/${liveVideoId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  const data = await response.json();
  
  if (!response.ok || data.error) {
    console.error('Error ending Facebook Live:', data);
    // Don't throw - the stream might have already ended
  }
  
  return data;
}

// Multistreaming Functions
async function createStreamDestination(tenantId, destination) {
  const destinationId = `dest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Map OAuth fields from frontend format to backend format
  // Frontend sends: oauthAccessToken, oauthChannelId, oauthChannelTitle
  // Backend expects: pageAccessToken, pageId, accountName
  const pageAccessToken = destination.pageAccessToken || destination.oauthAccessToken || '';
  const pageId = destination.pageId || destination.oauthChannelId || '';
  const accountName = destination.accountName || destination.oauthChannelTitle || '';
  
  // Determine platform for Facebook Live OAuth
  const platform = destination.platform || 'custom';
  const isFacebookLiveOAuth = (platform === 'facebook' || platform === 'facebook-live') && destination.oauthConnected && pageAccessToken;
  
  const newDestination = {
    id: destinationId,
    platform: isFacebookLiveOAuth ? 'facebook-live' : platform,
    name: destination.name || 'Unnamed',
    rtmpUrl: destination.rtmpUrl || '',
    streamKey: destination.streamKey || '', // TODO: Encrypt this
    enabled: destination.enabled === true,
    status: 'inactive',
    verticalMode: destination.verticalMode === true,
    // OAuth fields for Facebook/Instagram Live
    oauthConnected: destination.oauthConnected || false,
    pageAccessToken: pageAccessToken,
    pageId: pageId,
    accountName: accountName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Get current data
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  const currentData = result.Item || getDefaultData(tenantId);
  const destinations = currentData.stream_destinations || [];
  destinations.push(newDestination);
  
  // Update DynamoDB
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Item: {
      ...currentData,
      stream_destinations: destinations,
      updated_at: new Date().toISOString()
    }
  }));
  
  return newDestination;
}

async function updateStreamDestination(tenantId, destinationId, updates) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    throw new Error('Tenant live data not found');
  }
  
  const destinations = result.Item.stream_destinations || [];
  const destinationIndex = destinations.findIndex(d => d.id === destinationId);
  
  if (destinationIndex === -1) {
    throw new Error('Stream destination not found');
  }
  
  // Update destination - filter out undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
  );
  
  destinations[destinationIndex] = {
    ...destinations[destinationIndex],
    ...cleanUpdates,
    updatedAt: new Date().toISOString()
  };
  
  // Update DynamoDB
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Item: {
      ...result.Item,
      stream_destinations: destinations,
      updated_at: new Date().toISOString()
    }
  }));
  
  return destinations[destinationIndex];
}

async function deleteStreamDestination(tenantId, destinationId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Key: { tenant_id: tenantId }
  }));
  
  if (!result.Item) {
    throw new Error('Tenant live data not found');
  }
  
  const destinations = result.Item.stream_destinations || [];
  const filteredDestinations = destinations.filter(d => d.id !== destinationId);
  
  // Update DynamoDB
  await dynamodb.send(new PutCommand({
    TableName: process.env.TENANT_LIVE_TABLE,
    Item: {
      ...result.Item,
      stream_destinations: filteredDestinations,
      updated_at: new Date().toISOString()
    }
  }));
  
  return { success: true };
}

async function getLive(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_LIVE_TABLE, Key: { tenant_id: tenantId }
    }));
    const data = result.Item || getDefaultData(tenantId);
    console.log('[getLive] Raw data offlineImageKey:', data.offlineImageKey);
    const enriched = enrichWithUrls(data);
    console.log('[getLive] Enriched offlineImageUrl:', enriched.offlineImageUrl);
    return enriched;
  } catch (error) { 
    console.error('[getLive] Error:', error);
    return getDefaultData(tenantId); 
  }
}

// Aktiviert oder deaktiviert IVS Recording für einen Channel
async function updateIVSRecording(tenantId, enableRecording) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.TENANT_LIVE_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    if (!result.Item || !result.Item.ivs_channel_arn) {
      console.log('No IVS channel configured for tenant:', tenantId);
      return null;
    }
    
    const channelArn = result.Item.ivs_channel_arn;
    const recordingConfigArn = result.Item.ivs_recording_config_arn;
    
    if (!recordingConfigArn) {
      console.log('No recording configuration available for tenant:', tenantId);
      return null;
    }
    
    // Update IVS Channel mit oder ohne Recording Configuration
    const updateCommand = new UpdateChannelCommand({
      arn: channelArn,
      recordingConfigurationArn: enableRecording ? recordingConfigArn : ''
    });
    
    const response = await ivs.send(updateCommand);
    console.log(`IVS Recording ${enableRecording ? 'enabled' : 'disabled'} for tenant ${tenantId}`);
    
    return {
      channelArn: response.channel.arn,
      recordingEnabled: enableRecording,
      recordingConfigArn: enableRecording ? recordingConfigArn : null
    };
  } catch (error) {
    console.error('Error updating IVS recording:', error);
    throw error;
  }
}

async function updateLive(tenantId, updates) {
  const existing = await getLive(tenantId);
  console.log('[updateLive] Existing data:', JSON.stringify(existing));
  console.log('[updateLive] Updates:', JSON.stringify(updates));
  
  // Prüfe ob autoSaveStream geändert wurde
  if (updates.autoSaveStream !== undefined && updates.autoSaveStream !== existing.autoSaveStream) {
    try {
      await updateIVSRecording(tenantId, updates.autoSaveStream);
    } catch (error) {
      console.error('Failed to update IVS recording, continuing with settings update:', error);
    }
  }
  
  const item = { ...existing, ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };
  console.log('[updateLive] Saving item with offlineImageKey:', item.offlineImageKey);
  await dynamodb.send(new PutCommand({ TableName: process.env.TENANT_LIVE_TABLE, Item: item }));
  const result = enrichWithUrls(item);
  console.log('[updateLive] Result with offlineImageUrl:', result.offlineImageUrl);
  return result;
}

async function generateUploadUrl(tenantId, fileName, fileType, uploadType) {
  const ext = fileName.split('.').pop();
  const key = `tenants/${tenantId}/live/${uploadType}-${Date.now()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, key, publicUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}` };
}

async function deleteFile(key) {
  if (!key) return;
  try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSETS_BUCKET, Key: key })); } catch (e) {}
}

// ============================================
// YouTube OAuth Integration Functions
// ============================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl'
].join(' ');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData) {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption error:', e);
    return null;
  }
}

async function getYouTubeCredentials() {
  try {
    // First check if environment variables are set
    if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
      console.log('Using YouTube credentials from environment variables');
      return {
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET
      };
    }
    
    // Try to fetch from SSM Parameter Store
    console.log('Attempting to fetch YouTube credentials from SSM Parameter Store');
    const [clientIdParam, clientSecretParam] = await Promise.all([
      ssm.send(new GetParameterCommand({ Name: `/${process.env.PLATFORM_NAME}/youtube/client_id`, WithDecryption: true })),
      ssm.send(new GetParameterCommand({ Name: `/${process.env.PLATFORM_NAME}/youtube/client_secret`, WithDecryption: true }))
    ]);
    return {
      clientId: clientIdParam.Parameter.Value,
      clientSecret: clientSecretParam.Parameter.Value
    };
  } catch (error) {
    console.error('Error fetching YouTube credentials:', error.message);
    
    // Check if we have fallback environment variables
    if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
      console.log('Falling back to environment variables');
      return {
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET
      };
    }
    
    // If no credentials available, throw a proper error
    throw new Error('YouTube credentials not configured. Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables or SSM parameters.');
  }
}

async function saveOAuthTokens(tenantId, tokens, channelInfo) {
  const item = {
    tenant_id: tenantId,
    platform: 'youtube',
    access_token: encrypt(tokens.access_token),
    refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
    scope: tokens.scope,
    channel_id: channelInfo.id,
    channel_title: channelInfo.title,
    channel_thumbnail: channelInfo.thumbnail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await dynamodb.send(new PutCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Item: item
  }));
  
  return item;
}

async function getOAuthTokens(tenantId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Key: { tenant_id: tenantId, platform: 'youtube' }
  }));
  
  if (!result.Item) return null;
  
  return {
    ...result.Item,
    access_token: result.Item.access_token ? decrypt(result.Item.access_token) : null,
    refresh_token: result.Item.refresh_token ? decrypt(result.Item.refresh_token) : null
  };
}

async function deleteOAuthTokens(tenantId) {
  await dynamodb.send(new DeleteCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Key: { tenant_id: tenantId, platform: 'youtube' }
  }));
}

async function refreshAccessToken(tenantId, refreshToken) {
  const { clientId, clientSecret } = await getYouTubeCredentials();
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
  }
  
  const tokens = await response.json();
  
  const existing = await dynamodb.send(new GetCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Key: { tenant_id: tenantId, platform: 'youtube' }
  }));
  
  if (existing.Item) {
    await dynamodb.send(new PutCommand({
      TableName: process.env.OAUTH_TOKENS_TABLE,
      Item: {
        ...existing.Item,
        access_token: encrypt(tokens.access_token),
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      }
    }));
  }
  
  return tokens.access_token;
}

async function getValidAccessToken(tenantId) {
  const tokens = await getOAuthTokens(tenantId);
  if (!tokens) return null;
  
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    if (!tokens.refresh_token) {
      throw new Error('Token expired and no refresh token available');
    }
    return await refreshAccessToken(tenantId, tokens.refresh_token);
  }
  
  return tokens.access_token;
}

async function getYouTubeChannelInfo(accessToken) {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get channel info: ${error.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  const channel = data.items?.[0];
  
  if (!channel) {
    throw new Error('No YouTube channel found for this account');
  }
  
  return {
    id: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url,
    subscriberCount: channel.statistics?.subscriberCount
  };
}

async function createYouTubeBroadcast(accessToken, metadata) {
  const scheduledStartTime = metadata.scheduledStartTime || new Date(Date.now() + 60000).toISOString();
  
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,contentDetails,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description || '',
          scheduledStartTime
        },
        contentDetails: {
          enableAutoStart: metadata.enableAutoStart !== false,
          enableAutoStop: metadata.enableAutoStop !== false,
          enableDvr: metadata.enableDvr !== false,
          enableEmbed: metadata.enableEmbed !== false,
          recordFromStart: metadata.recordFromStart !== false
        },
        status: {
          privacyStatus: metadata.privacyStatus || 'public',
          selfDeclaredMadeForKids: false
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create broadcast: ${error.error?.message || 'Unknown error'}`);
  }
  
  return response.json();
}

async function createYouTubeStream(accessToken, title) {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,contentDetails,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: { title: `${title} - Stream` },
        cdn: {
          frameRate: '30fps',
          ingestionType: 'rtmp',
          resolution: '1080p'
        },
        contentDetails: { isReusable: true }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create stream: ${error.error?.message || 'Unknown error'}`);
  }
  
  return response.json();
}

async function bindBroadcastToStream(accessToken, broadcastId, streamId) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&part=id,contentDetails&streamId=${streamId}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to bind broadcast: ${error.error?.message || 'Unknown error'}`);
  }
  
  return response.json();
}

async function updateYouTubeBroadcast(accessToken, broadcastId, metadata) {
  const getResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&id=${broadcastId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!getResponse.ok) throw new Error('Failed to get broadcast');
  
  const current = await getResponse.json();
  const broadcast = current.items?.[0];
  
  if (!broadcast) throw new Error('Broadcast not found');
  
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status',
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: broadcastId,
        snippet: {
          ...broadcast.snippet,
          title: metadata.title || broadcast.snippet.title,
          description: metadata.description !== undefined ? metadata.description : broadcast.snippet.description
        },
        status: {
          privacyStatus: metadata.privacyStatus || broadcast.status?.privacyStatus || 'public',
          selfDeclaredMadeForKids: false
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update broadcast: ${error.error?.message || 'Unknown error'}`);
  }
  
  return response.json();
}

// ============================================
// Twitch OAuth Integration Functions
// ============================================

async function getTwitchCredentials() {
  try {
    // First check if environment variables are set
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
      console.log('Using Twitch credentials from environment variables');
      return {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
      };
    }
    
    // Try to fetch from SSM Parameter Store
    console.log('Attempting to fetch Twitch credentials from SSM Parameter Store');
    const [clientIdParam, clientSecretParam] = await Promise.all([
      ssm.send(new GetParameterCommand({ Name: `/${process.env.PLATFORM_NAME}/twitch/client_id`, WithDecryption: true })),
      ssm.send(new GetParameterCommand({ Name: `/${process.env.PLATFORM_NAME}/twitch/client_secret`, WithDecryption: true }))
    ]);
    return {
      clientId: clientIdParam.Parameter.Value,
      clientSecret: clientSecretParam.Parameter.Value
    };
  } catch (error) {
    console.error('Error fetching Twitch credentials:', error.message);
    
    // Check if we have fallback environment variables
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
      console.log('Falling back to environment variables');
      return {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
      };
    }
    
    throw new Error('Twitch credentials not configured. Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables or SSM parameters.');
  }
}

async function saveTwitchOAuthTokens(tenantId, tokens, userInfo) {
  const item = {
    tenant_id: tenantId,
    platform: 'twitch',
    access_token: encrypt(tokens.access_token),
    refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
    scope: Array.isArray(tokens.scope) ? tokens.scope.join(' ') : tokens.scope,
    user_id: userInfo.id,
    username: userInfo.login,
    display_name: userInfo.display_name,
    profile_image_url: userInfo.profile_image_url,
    stream_key: userInfo.stream_key ? encrypt(userInfo.stream_key) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await dynamodb.send(new PutCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Item: item
  }));
  
  return item;
}

async function getTwitchOAuthTokens(tenantId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Key: { tenant_id: tenantId, platform: 'twitch' }
  }));
  
  if (!result.Item) return null;
  
  return {
    ...result.Item,
    access_token: result.Item.access_token ? decrypt(result.Item.access_token) : null,
    refresh_token: result.Item.refresh_token ? decrypt(result.Item.refresh_token) : null,
    stream_key: result.Item.stream_key ? decrypt(result.Item.stream_key) : null
  };
}

async function deleteTwitchOAuthTokens(tenantId) {
  await dynamodb.send(new DeleteCommand({
    TableName: process.env.OAUTH_TOKENS_TABLE,
    Key: { tenant_id: tenantId, platform: 'twitch' }
  }));
}

async function getTwitchUserInfo(accessToken, clientId) {
  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get Twitch user info: ${error.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.data?.[0];
}

async function getTwitchStreamKey(accessToken, clientId, broadcasterId) {
  const response = await fetch(`https://api.twitch.tv/helix/streams/key?broadcaster_id=${broadcasterId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get Twitch stream key: ${error.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.data?.[0]?.stream_key;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // ============================================
  // IVS Recording End Event Handler
  // ============================================
  // Wird von EventBridge aufgerufen wenn eine IVS Stream-Aufnahme endet
  if (event.source === 'aws.ivs' && event['detail-type'] === 'IVS Recording State Change') {
    const detail = event.detail;
    
    if (detail.recording_status === 'Recording End') {
      console.log('IVS Recording ended:', detail);
      
      try {
        const result = await handleRecordingEnd(detail);
        console.log('Recording end handled:', result);
        return { statusCode: 200, body: JSON.stringify(result) };
      } catch (error) {
        console.error('Error handling recording end:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      }
    }
    
    return { statusCode: 200, body: 'Recording event ignored' };
  }
  
  // ============================================
  // EventBridge Auto-Stop Handler
  // ============================================
  // EventBridge Events haben eine andere Struktur als API Gateway Events
  if (event.source === 'eventbridge-autostop' || (event.detail && event.detail.action === 'auto-stop-restreaming')) {
    const tenantId = event.tenantId || event.detail?.tenantId;
    if (!tenantId) {
      console.error('EventBridge auto-stop: No tenantId provided');
      return { statusCode: 400, body: 'No tenantId provided' };
    }
    
    console.log(`EventBridge auto-stop triggered for tenant: ${tenantId}`);
    try {
      const result = await handleAutoStopEvent(tenantId);
      console.log('Auto-stop completed successfully:', result);
      return { statusCode: 200, body: JSON.stringify(result) };
    } catch (error) {
      console.error('Auto-stop failed:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }
  
  // ============================================
  // API Gateway Handler
  // ============================================
  const { httpMethod, path, pathParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  const rawTenantId = pathParameters?.tenantId;
  const tenantId = rawTenantId ? await resolveTenantId(rawTenantId) : null;

  if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  try {
    // GET /tenants/{tenantId}/live/ivs-info - Hole AWS IVS Channel Info (Public)
    if (httpMethod === 'GET' && path.includes('/ivs-info')) {
      const ivsInfo = await getIVSChannelInfo(tenantId);
      
      // Also check stream status if channel exists
      let streamStatus = { isLive: false, state: 'NO_CHANNEL', viewerCount: 0 };
      if (ivsInfo && ivsInfo.channelArn) {
        streamStatus = await checkStreamStatus(ivsInfo.channelArn);
      }
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ivsInfo,
          streamStatus,
          resolvedTenantId: tenantId
        })
      };
    }

    // GET /tenants/{tenantId}/live/stream-status - Check if stream is live (Public)
    if (httpMethod === 'GET' && path.includes('/stream-status')) {
      const ivsInfo = await getIVSChannelInfo(tenantId);
      
      if (!ivsInfo || !ivsInfo.channelArn) {
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({
            isLive: false,
            state: 'NO_CHANNEL',
            viewerCount: 0,
            resolvedTenantId: tenantId
          })
        };
      }
      
      const streamStatus = await checkStreamStatus(ivsInfo.channelArn);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...streamStatus,
          resolvedTenantId: tenantId
        })
      };
    }

    // GET /tenants/{tenantId}/live - Hole Live-Settings (Public)
    // WICHTIG: Muss alle anderen GET-Routen ausschließen!
    if (httpMethod === 'GET' && !path.includes('/upload-url') && !path.includes('/chat-token') && !path.includes('/destinations') && !path.includes('/ivs-info') && !path.includes('/restreaming') && !path.includes('/stream-status')) {
      const data = await getLive(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...data,
          resolvedTenantId: tenantId
        })
      };
    }

    // POST /tenants/{tenantId}/live/chat-token - Erstelle Chat Token (Authenticated)
    if (httpMethod === 'POST' && path.includes('/chat-token')) {
      if (!userId) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Authentifizierung erforderlich' }) };
      }
      
      const { username } = JSON.parse(event.body || '{}');
      const ivsInfo = await getIVSChannelInfo(tenantId);
      
      if (!ivsInfo || !ivsInfo.chatRoomArn) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Chat Room nicht gefunden' }) };
      }
      
      const chatToken = await createChatToken(ivsInfo.chatRoomArn, userId, username || 'Anonymous');
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          chatToken,
          chatRoomArn: ivsInfo.chatRoomArn,
          resolvedTenantId: tenantId
        })
      };
    }

    // GET /tenants/{tenantId}/live/destinations - Hole Stream Destinations (Admin)
    if (httpMethod === 'GET' && path.includes('/destinations')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const data = await getLive(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          destinations: data.stream_destinations || [],
          resolvedTenantId: tenantId
        })
      };
    }

    // POST /tenants/{tenantId}/live/destinations - Erstelle Stream Destination (Admin)
    if (httpMethod === 'POST' && path.includes('/destinations')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const destination = JSON.parse(event.body || '{}');
      const newDestination = await createStreamDestination(tenantId, destination);
      return { 
        statusCode: 201, 
        headers: corsHeaders, 
        body: JSON.stringify({
          destination: newDestination,
          resolvedTenantId: tenantId
        })
      };
    }

    // PUT /tenants/{tenantId}/live/destinations/{destinationId} - Update Stream Destination (Admin)
    if (httpMethod === 'PUT' && path.includes('/destinations/')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const destinationId = path.split('/destinations/')[1];
      const updates = JSON.parse(event.body || '{}');
      const updatedDestination = await updateStreamDestination(tenantId, destinationId, updates);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          destination: updatedDestination,
          resolvedTenantId: tenantId
        })
      };
    }

    // DELETE /tenants/{tenantId}/live/destinations/{destinationId} - Lösche Stream Destination (Admin)
    if (httpMethod === 'DELETE' && path.includes('/destinations/')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const destinationId = path.split('/destinations/')[1];
      await deleteStreamDestination(tenantId, destinationId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          message: 'Stream Destination gelöscht',
          resolvedTenantId: tenantId
        })
      };
    }

    // PUT /tenants/{tenantId}/live - Update Live-Settings (Admin)
    if (httpMethod === 'PUT' && !path.includes('/upload-url') && !path.includes('/destinations') && !path.includes('/restreaming')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const updated = await updateLive(tenantId, JSON.parse(event.body || '{}'));
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...updated,
          resolvedTenantId: tenantId
        })
      };
    }

    // POST /tenants/{tenantId}/live/upload-url - Generiere S3 Upload URL (Admin)
    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const { fileName, fileType, uploadType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      const uploadInfo = await generateUploadUrl(tenantId, fileName, fileType, uploadType || 'thumbnail');
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...uploadInfo,
          resolvedTenantId: tenantId
        })
      };
    }

    // DELETE /tenants/{tenantId}/live/asset - Lösche Asset (Admin)
    if (httpMethod === 'DELETE' && path.includes('/asset')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      await deleteFile(JSON.parse(event.body || '{}').key);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          message: 'Asset gelöscht',
          resolvedTenantId: tenantId
        })
      };
    }

    // ============================================
    // Offline Image Endpoints
    // ============================================

    // POST /tenants/{tenantId}/live/offline-image/upload-url - Generiere Upload URL für Offline-Bild (Admin)
    if (httpMethod === 'POST' && path.includes('/offline-image/upload-url')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      const { fileName, fileType } = JSON.parse(event.body || '{}');
      if (!fileName || !fileType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'fileName und fileType erforderlich' }) };
      }
      const uploadInfo = await generateUploadUrl(tenantId, fileName, fileType, 'offline-image');
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          uploadUrl: uploadInfo.uploadUrl,
          imageKey: uploadInfo.key,
          imageUrl: uploadInfo.publicUrl,
          resolvedTenantId: tenantId
        })
      };
    }

    // DELETE /tenants/{tenantId}/live/offline-image - Lösche Offline-Bild (Admin)
    if (httpMethod === 'DELETE' && path.endsWith('/offline-image')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      // Hole aktuelle Settings um den Key zu bekommen
      const currentData = await getLive(tenantId);
      if (currentData.offlineImageKey) {
        await deleteFile(currentData.offlineImageKey);
      }
      
      // Lösche die Referenz in den Settings
      await updateLive(tenantId, { offlineImageKey: null, offlineImageUrl: null });
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          message: 'Offline-Bild gelöscht',
          resolvedTenantId: tenantId
        })
      };
    }

    // ============================================
    // Restreaming Endpoints
    // ============================================

    // POST /tenants/{tenantId}/live/restreaming/stop-all - Stoppe alle Restreaming Channels (Admin)
    // WICHTIG: Muss VOR den anderen /stop Routen stehen!
    if (httpMethod === 'POST' && path.endsWith('/restreaming/stop-all')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const result = await stopAllRestreaming(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...result,
          resolvedTenantId: tenantId
        })
      };
    }

    // POST /tenants/{tenantId}/live/restreaming/{destinationId}/start - Starte Restreaming (Admin)
    if (httpMethod === 'POST' && path.includes('/restreaming/') && path.endsWith('/start')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      // Extrahiere destinationId zwischen /restreaming/ und /start
      const match = path.match(/\/restreaming\/([^\/]+)\/start$/);
      const destinationId = match ? match[1] : null;
      if (!destinationId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Ungültige Destination ID' }) };
      }
      
      const result = await startRestreaming(tenantId, destinationId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...result,
          resolvedTenantId: tenantId
        })
      };
    }

    // POST /tenants/{tenantId}/live/restreaming/{destinationId}/stop - Stoppe Restreaming (Admin)
    if (httpMethod === 'POST' && path.includes('/restreaming/') && path.endsWith('/stop')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      // Extrahiere destinationId zwischen /restreaming/ und /stop
      const match = path.match(/\/restreaming\/([^\/]+)\/stop$/);
      const destinationId = match ? match[1] : null;
      if (!destinationId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Ungültige Destination ID' }) };
      }
      
      const result = await stopRestreaming(tenantId, destinationId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...result,
          resolvedTenantId: tenantId
        })
      };
    }

    // GET /tenants/{tenantId}/live/restreaming/status - Hole Restreaming Status (Admin)
    if (httpMethod === 'GET' && path.includes('/restreaming/status')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const status = await getRestreamingStatus(tenantId);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...status,
          resolvedTenantId: tenantId
        })
      };
    }

    // PUT /tenants/{tenantId}/live/restreaming/auto-destroy - Setze Auto-Destroy Timer (Admin)
    if (httpMethod === 'PUT' && path.includes('/restreaming/auto-destroy')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const { minutes } = JSON.parse(event.body || '{}');
      if (minutes === undefined || minutes === null) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'minutes erforderlich (0 zum Deaktivieren, 15-480 zum Aktivieren)' }) };
      }
      
      const result = await setAutoDestroyTimer(tenantId, minutes);
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({
          ...result,
          resolvedTenantId: tenantId
        })
      };
    }

    // ============================================
    // YouTube OAuth Endpoints
    // ============================================

    // GET /tenants/{tenantId}/youtube/oauth/callback - OAuth Callback (Public)
    if (httpMethod === 'GET' && path.includes('/youtube/oauth/callback')) {
      const { code, state, error: oauthError } = event.queryStringParameters || {};
      
      if (oauthError) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: `<html><body><script>window.opener?.postMessage({ type: 'youtube-oauth-error', error: '${oauthError}' }, '*');window.close();</script><p>Fehler: ${oauthError}. Dieses Fenster kann geschlossen werden.</p></body></html>`
        };
      }
      
      if (!code || !state) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Missing code or state' }) };
      }
      
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      } catch (e) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Invalid state' }) };
      }
      
      const { tenantId: stateTenantId, redirectUri, originUrl } = stateData;
      const { clientId, clientSecret } = await getYouTubeCredentials();
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        console.error('Token exchange failed:', error);
        // Sende postMessage mit '*' damit es von jeder Origin empfangen werden kann
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: `<html><body><script>window.opener?.postMessage({ type: 'youtube-oauth-error', error: 'Token exchange failed' }, '*');window.close();</script><p>Fehler beim Token-Austausch. Dieses Fenster kann geschlossen werden.</p></body></html>`
        };
      }
      
      const tokens = await tokenResponse.json();
      const channelInfo = await getYouTubeChannelInfo(tokens.access_token);
      await saveOAuthTokens(stateTenantId, tokens, channelInfo);
      
      // Sende postMessage mit '*' damit es von jeder Origin empfangen werden kann
      // Die Sicherheit wird durch den State-Parameter gewährleistet
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `<html><body><script>window.opener?.postMessage({ type: 'youtube-oauth-success', channelTitle: '${channelInfo.title}' }, '*');window.close();</script><p>Erfolgreich verbunden mit ${channelInfo.title}! Dieses Fenster kann geschlossen werden.</p></body></html>`
      };
    }

    // POST /tenants/{tenantId}/youtube/oauth/initiate - Start OAuth flow (Admin)
    if (httpMethod === 'POST' && path.includes('/youtube/oauth/initiate')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const { clientId } = await getYouTubeCredentials();
        
        if (!clientId) {
          return { 
            statusCode: 500, 
            headers: corsHeaders, 
            body: JSON.stringify({ message: 'YouTube OAuth nicht konfiguriert. Bitte kontaktiere den Administrator.' }) 
          };
        }
        
        // Parse request body for redirectUri and originUrl from frontend
        let requestBody = {};
        if (event.body) {
          try {
            requestBody = JSON.parse(event.body);
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        // Zentrale Redirect-URI über viraltenant.com für alle Tenants
        const redirectUri = requestBody.redirectUri || `https://viraltenant.com/youtube/oauth/callback`;
        // originUrl ist die ursprüngliche Domain des Tenants für postMessage
        const originUrl = requestBody.originUrl || null;
        
        const state = Buffer.from(JSON.stringify({
          tenantId,
          userId,
          redirectUri,
          originUrl,
          timestamp: Date.now()
        })).toString('base64');
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: YOUTUBE_SCOPES,
          access_type: 'offline',
          prompt: 'consent',
          state
        }).toString();
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ authUrl, state })
        };
      } catch (error) {
        console.error('Error initiating OAuth:', error);
        return { 
          statusCode: 500, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: 'Fehler beim Starten des OAuth-Flows: ' + error.message }) 
        };
      }
    }

    // GET /tenants/{tenantId}/youtube/oauth/status - Get OAuth status (Admin)
    if (httpMethod === 'GET' && path.includes('/youtube/oauth/status')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const tokens = await getOAuthTokens(tenantId);
        
        if (!tokens) {
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ connected: false }) };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            connected: true,
            channelId: tokens.channel_id,
            channelTitle: tokens.channel_title,
            channelThumbnail: tokens.channel_thumbnail,
            expiresAt: tokens.expires_at,
            scopes: tokens.scope?.split(' ')
          })
        };
      } catch (error) {
        console.error('Error getting OAuth status:', error);
        return { 
          statusCode: 200, 
          headers: corsHeaders, 
          body: JSON.stringify({ connected: false, error: error.message }) 
        };
      }
    }

    // DELETE /tenants/{tenantId}/youtube/oauth/disconnect - Disconnect OAuth (Admin)
    if (httpMethod === 'DELETE' && path.includes('/youtube/oauth/disconnect')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      await deleteOAuthTokens(tenantId);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Disconnected successfully' }) };
    }

    // POST /tenants/{tenantId}/youtube/broadcast - Create broadcast (Admin)
    if (httpMethod === 'POST' && path.endsWith('/youtube/broadcast')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const accessToken = await getValidAccessToken(tenantId);
      if (!accessToken) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'YouTube nicht verbunden' }) };
      }
      
      const metadata = JSON.parse(event.body || '{}');
      const broadcast = await createYouTubeBroadcast(accessToken, metadata);
      const stream = await createYouTubeStream(accessToken, metadata.title);
      await bindBroadcastToStream(accessToken, broadcast.id, stream.id);
      
      await dynamodb.send(new PutCommand({
        TableName: process.env.YOUTUBE_BROADCASTS_TABLE,
        Item: {
          tenant_id: tenantId,
          broadcast_id: broadcast.id,
          stream_id: stream.id,
          title: metadata.title,
          description: metadata.description,
          privacy_status: metadata.privacyStatus || 'public',
          rtmp_url: stream.cdn?.ingestionInfo?.ingestionAddress,
          stream_key: stream.cdn?.ingestionInfo?.streamName,
          status: 'created',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }));
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          id: broadcast.id,
          title: broadcast.snippet.title,
          description: broadcast.snippet.description,
          status: broadcast.status.lifeCycleStatus,
          boundStreamId: stream.id,
          rtmpUrl: stream.cdn?.ingestionInfo?.ingestionAddress,
          streamKey: stream.cdn?.ingestionInfo?.streamName
        })
      };
    }

    // PUT /tenants/{tenantId}/youtube/broadcast/{broadcastId} - Update broadcast (Admin)
    if (httpMethod === 'PUT' && path.includes('/youtube/broadcast/') && !path.includes('/current')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const broadcastId = path.split('/youtube/broadcast/')[1];
      const accessToken = await getValidAccessToken(tenantId);
      if (!accessToken) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'YouTube nicht verbunden' }) };
      }
      
      const metadata = JSON.parse(event.body || '{}');
      const updated = await updateYouTubeBroadcast(accessToken, broadcastId, metadata);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: updated.id,
          title: updated.snippet.title,
          description: updated.snippet.description,
          status: updated.status.lifeCycleStatus
        })
      };
    }

    // GET /tenants/{tenantId}/youtube/broadcast/current - Get current broadcast (Admin)
    if (httpMethod === 'GET' && path.includes('/youtube/broadcast/current')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const result = await dynamodb.send(new GetCommand({
        TableName: process.env.YOUTUBE_BROADCASTS_TABLE,
        Key: { tenant_id: tenantId }
      }));
      
      if (!result.Item) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'No broadcast found' }) };
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: result.Item.broadcast_id,
          title: result.Item.title,
          description: result.Item.description,
          status: result.Item.status,
          rtmpUrl: result.Item.rtmp_url,
          streamKey: result.Item.stream_key
        })
      };
    }

    // GET /tenants/{tenantId}/youtube/stream-credentials - Get stream credentials (Admin)
    if (httpMethod === 'GET' && path.includes('/youtube/stream-credentials')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      const result = await dynamodb.send(new GetCommand({
        TableName: process.env.YOUTUBE_BROADCASTS_TABLE,
        Key: { tenant_id: tenantId }
      }));
      
      if (!result.Item || !result.Item.rtmp_url) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'No stream credentials found' }) };
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          rtmpUrl: result.Item.rtmp_url,
          streamKey: result.Item.stream_key,
          broadcastId: result.Item.broadcast_id
        })
      };
    }

    // ============================================
    // Twitch OAuth Endpoints
    // ============================================

    // GET /twitch/oauth/config - Get Twitch Client ID (Public)
    if (httpMethod === 'GET' && path === '/twitch/oauth/config') {
      try {
        const { clientId } = await getTwitchCredentials();
        if (!clientId) {
          return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'Twitch OAuth nicht konfiguriert' }) };
        }
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ clientId }) };
      } catch (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'Twitch OAuth nicht konfiguriert' }) };
      }
    }

    // POST /twitch/oauth/callback - Twitch OAuth Callback
    if (httpMethod === 'POST' && path === '/twitch/oauth/callback') {
      const body = JSON.parse(event.body || '{}');
      const { code, tenantId: callbackTenantId, redirectUri } = body;
      
      if (!code || !callbackTenantId || !redirectUri) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Missing code, tenantId or redirectUri' }) };
      }
      
      try {
        const { clientId, clientSecret } = await getTwitchCredentials();
        
        // Exchange code for token
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
          })
        });
        
        if (!tokenResponse.ok) {
          const error = await tokenResponse.json();
          console.error('Twitch token exchange failed:', error);
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Token exchange failed', error: error.message }) };
        }
        
        const tokens = await tokenResponse.json();
        
        // Get user info
        const userInfo = await getTwitchUserInfo(tokens.access_token, clientId);
        if (!userInfo) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Failed to get Twitch user info' }) };
        }
        
        // Get stream key
        let streamKey = null;
        try {
          streamKey = await getTwitchStreamKey(tokens.access_token, clientId, userInfo.id);
        } catch (e) {
          console.error('Failed to get stream key:', e);
        }
        
        // Save tokens
        const resolvedTenantId = await resolveTenantId(callbackTenantId);
        await saveTwitchOAuthTokens(resolvedTenantId, tokens, { ...userInfo, stream_key: streamKey });
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            connected: true,
            userId: userInfo.id,
            username: userInfo.login,
            displayName: userInfo.display_name,
            profileImageUrl: userInfo.profile_image_url,
            streamKey: streamKey
          })
        };
      } catch (error) {
        console.error('Twitch OAuth error:', error);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'OAuth fehlgeschlagen', error: error.message }) };
      }
    }

    // GET /tenants/{tenantId}/twitch/oauth/status - Get Twitch OAuth status (Admin)
    if (httpMethod === 'GET' && path.includes('/twitch/oauth/status')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      try {
        const tokens = await getTwitchOAuthTokens(tenantId);
        
        if (!tokens) {
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ connected: false }) };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            connected: true,
            userId: tokens.user_id,
            username: tokens.username,
            displayName: tokens.display_name,
            profileImageUrl: tokens.profile_image_url,
            streamKey: tokens.stream_key,
            expiresAt: tokens.expires_at
          })
        };
      } catch (error) {
        console.error('Error getting Twitch OAuth status:', error);
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ connected: false, error: error.message }) };
      }
    }

    // DELETE /tenants/{tenantId}/twitch/oauth/disconnect - Disconnect Twitch OAuth (Admin)
    if (httpMethod === 'DELETE' && path.includes('/twitch/oauth/disconnect')) {
      if (!userId || !(await isUserTenantAdmin(userId, tenantId))) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: 'Keine Berechtigung' }) };
      }
      
      await deleteTwitchOAuthTokens(tenantId);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Disconnected successfully' }) };
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Endpoint nicht gefunden' }) };
  } catch (error) {
    console.error('Error:', error);
    return { 
      statusCode: 500, 
      headers: corsHeaders, 
      body: JSON.stringify({ 
        message: error.message,
        resolvedTenantId: tenantId
      })
    };
  }
};
