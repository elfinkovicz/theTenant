import json
import boto3
import os
import uuid
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
medialive = boto3.client('medialive')
table = dynamodb.Table(os.environ['DESTINATIONS_TABLE'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': cors_headers(),
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    # EventBridge Event (IVS Stream State Change)
    if event.get('source') == 'aws.ivs' and event.get('detail-type') == 'IVS Stream State Change':
        return handle_ivs_stream_state_change(event)
    
    # API Gateway v2 format
    http_method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))
    raw_path = event.get('rawPath', event.get('path', ''))
    path = event.get('requestContext', {}).get('http', {}).get('path', raw_path)
    
    print(f"Method: {http_method}, Path: {path}")
    
    # OPTIONS für CORS
    if http_method == 'OPTIONS':
        return response(200, {})
    
    # Route zu entsprechender Funktion
    try:
        if http_method == 'GET' and path == '/stream-destinations':
            return get_destinations(event)
        elif http_method == 'POST' and path == '/stream-destinations':
            return create_destination(event)
        elif http_method == 'PUT' and '/stream-destinations/' in path and path.count('/') == 2:
            return update_destination(event)
        elif http_method == 'DELETE' and '/stream-destinations/' in path and path.count('/') == 2:
            return delete_destination(event)
        elif http_method == 'POST' and path.endswith('/start'):
            return start_restreaming(event)
        elif http_method == 'POST' and path.endswith('/stop'):
            return stop_restreaming(event)
        else:
            return response(404, {'error': 'Not found', 'path': path, 'method': http_method})
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {'error': str(e)})

def get_destinations(event):
    """Alle Streaming-Ziele abrufen"""
    result = table.scan()
    items = result.get('Items', [])
    return response(200, items)

def create_destination(event):
    """Neues Streaming-Ziel erstellen"""
    body = json.loads(event.get('body', '{}'))
    
    # Validierung
    required_fields = ['platform', 'name', 'rtmpUrl', 'streamKey']
    for field in required_fields:
        if field not in body:
            return response(400, {'error': f'Missing required field: {field}'})
    
    destination_id = str(uuid.uuid4())
    
    item = {
        'id': destination_id,
        'platform': body['platform'],
        'name': body['name'],
        'rtmpUrl': body['rtmpUrl'],
        'streamKey': body['streamKey'],
        'enabled': body.get('enabled', True),
        'status': 'inactive',
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat()
    }
    
    table.put_item(Item=item)
    return response(201, item)

def update_destination(event):
    """Streaming-Ziel aktualisieren"""
    path_params = event.get('pathParameters', {})
    destination_id = path_params.get('id')
    
    # API Gateway v2 format
    if not destination_id:
        path = event.get('rawPath', event.get('path', ''))
        parts = path.split('/')
        if len(parts) >= 3:
            destination_id = parts[2]
    
    if not destination_id:
        return response(400, {'error': 'Missing destination ID'})
    
    body = json.loads(event.get('body', '{}'))
    
    # Update Expression bauen
    update_expr = "SET updatedAt = :updatedAt"
    expr_values = {':updatedAt': datetime.utcnow().isoformat()}
    
    if 'name' in body:
        update_expr += ", #n = :name"
        expr_values[':name'] = body['name']
    if 'rtmpUrl' in body:
        update_expr += ", rtmpUrl = :rtmpUrl"
        expr_values[':rtmpUrl'] = body['rtmpUrl']
    if 'streamKey' in body:
        update_expr += ", streamKey = :streamKey"
        expr_values[':streamKey'] = body['streamKey']
    if 'enabled' in body:
        update_expr += ", enabled = :enabled"
        expr_values[':enabled'] = body['enabled']
    
    expr_names = {'#n': 'name'} if 'name' in body else None
    
    kwargs = {
        'Key': {'id': destination_id},
        'UpdateExpression': update_expr,
        'ExpressionAttributeValues': expr_values,
        'ReturnValues': 'ALL_NEW'
    }
    
    if expr_names:
        kwargs['ExpressionAttributeNames'] = expr_names
    
    result = table.update_item(**kwargs)
    return response(200, result['Attributes'])

def delete_destination(event):
    """Streaming-Ziel löschen"""
    path_params = event.get('pathParameters', {})
    destination_id = path_params.get('id')
    
    # API Gateway v2 format
    if not destination_id:
        path = event.get('rawPath', event.get('path', ''))
        parts = path.split('/')
        if len(parts) >= 3:
            destination_id = parts[2]
    
    if not destination_id:
        return response(400, {'error': 'Missing destination ID'})
    
    # Prüfe ob MediaLive Channel existiert und lösche ihn
    try:
        item = table.get_item(Key={'id': destination_id}).get('Item')
        if item and item.get('mediaLiveChannelId'):
            try:
                medialive.delete_channel(ChannelId=item['mediaLiveChannelId'])
            except:
                pass
        if item and item.get('mediaLiveInputId'):
            try:
                medialive.delete_input(InputId=item['mediaLiveInputId'])
            except:
                pass
    except:
        pass
    
    table.delete_item(Key={'id': destination_id})
    return response(200, {'message': 'Destination deleted'})

def start_restreaming(event):
    """Restreaming für ein Ziel starten"""
    path_params = event.get('pathParameters', {})
    destination_id = path_params.get('id')
    
    # API Gateway v2 format
    if not destination_id:
        path = event.get('rawPath', event.get('path', ''))
        parts = path.split('/')
        if len(parts) >= 3:
            destination_id = parts[2]
    
    if not destination_id:
        return response(400, {'error': 'Missing destination ID'})
    
    # Hole Destination
    result = table.get_item(Key={'id': destination_id})
    destination = result.get('Item')
    
    if not destination:
        return response(404, {'error': 'Destination not found'})
    
    if not destination.get('enabled'):
        return response(400, {'error': 'Destination is disabled'})
    
    # Erstelle oder starte MediaLive Channel
    try:
        channel_id = destination.get('mediaLiveChannelId')
        
        if not channel_id:
            # Erstelle neuen MediaLive Channel
            channel_id, input_id = create_medialive_channel(destination)
            
            # Update Destination mit Channel ID
            table.update_item(
                Key={'id': destination_id},
                UpdateExpression='SET mediaLiveChannelId = :channelId, mediaLiveInputId = :inputId, #s = :status, updatedAt = :updatedAt',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={
                    ':channelId': channel_id,
                    ':inputId': input_id,
                    ':status': 'starting',
                    ':updatedAt': datetime.utcnow().isoformat()
                }
            )
        
        # Starte Channel
        medialive.start_channel(ChannelId=channel_id)
        
        # Update Status
        table.update_item(
            Key={'id': destination_id},
            UpdateExpression='SET #s = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'active',
                ':updatedAt': datetime.utcnow().isoformat()
            }
        )
        
        return response(200, {'message': 'Restreaming started', 'channelId': channel_id})
    
    except Exception as e:
        print(f"Error starting restreaming: {str(e)}")
        return response(500, {'error': f'Failed to start restreaming: {str(e)}'})

def stop_restreaming(event):
    """Restreaming für ein Ziel stoppen"""
    path_params = event.get('pathParameters', {})
    destination_id = path_params.get('id')
    
    # API Gateway v2 format
    if not destination_id:
        path = event.get('rawPath', event.get('path', ''))
        parts = path.split('/')
        if len(parts) >= 3:
            destination_id = parts[2]
    
    if not destination_id:
        return response(400, {'error': 'Missing destination ID'})
    
    # Hole Destination
    result = table.get_item(Key={'id': destination_id})
    destination = result.get('Item')
    
    if not destination:
        return response(404, {'error': 'Destination not found'})
    
    channel_id = destination.get('mediaLiveChannelId')
    
    if not channel_id:
        return response(400, {'error': 'No active channel found'})
    
    try:
        # Stoppe Channel
        medialive.stop_channel(ChannelId=channel_id)
        
        # Update Status
        table.update_item(
            Key={'id': destination_id},
            UpdateExpression='SET #s = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'inactive',
                ':updatedAt': datetime.utcnow().isoformat()
            }
        )
        
        return response(200, {'message': 'Restreaming stopped'})
    
    except Exception as e:
        print(f"Error stopping restreaming: {str(e)}")
        return response(500, {'error': f'Failed to stop restreaming: {str(e)}'})

def create_medialive_channel(destination):
    """Erstelle MediaLive Channel für Restreaming"""
    project_name = os.environ['PROJECT_NAME']
    ivs_playback_url = os.environ['IVS_PLAYBACK_URL']
    medialive_role_arn = os.environ['MEDIALIVE_ROLE_ARN']
    sg_id = os.environ['MEDIALIVE_SG_ID']
    
    # Erstelle Input (HLS Pull von IVS)
    input_response = medialive.create_input(
        Name=f"{project_name}-{destination['platform']}-{destination['id'][:8]}",
        Type='URL_PULL',
        InputSecurityGroups=[sg_id],
        Sources=[{
            'Url': ivs_playback_url
        }]
    )
    
    input_id = input_response['Input']['Id']
    
    # Erstelle Channel
    rtmp_url = destination['rtmpUrl']
    stream_key = destination['streamKey']
    platform = destination['platform']
    vertical_mode = destination.get('verticalMode', 'crop')
    
    # Prüfe ob Hochformat-Plattform
    is_vertical = platform in ['tiktok', 'instagram']
    
    encoder_settings = get_encoder_settings(is_vertical, vertical_mode)
    
    channel_response = medialive.create_channel(
        Name=f"{project_name}-{destination['platform']}-{destination['id'][:8]}",
        RoleArn=medialive_role_arn,
        InputAttachments=[{
            'InputId': input_id,
            'InputAttachmentName': 'ivs-input'
        }],
        Destinations=[{
            'Id': 'rtmp-destination',
            'Settings': [{
                'Url': rtmp_url,
                'StreamName': stream_key
            }]
        }],
        EncoderSettings=encoder_settings,
        InputSpecification={
            'Codec': 'AVC',
            'Resolution': 'HD',
            'MaximumBitrate': 'MAX_10_MBPS'
        },
        ChannelClass='SINGLE_PIPELINE'
    )
    
    channel_id = channel_response['Channel']['Id']
    
    return channel_id, input_id

def get_encoder_settings(is_vertical, vertical_mode):
    """Erstelle Encoder Settings basierend auf Format"""
    
    # Video Settings
    if is_vertical:
        # Hochformat 9:16 (1080x1920)
        width = 1080
        height = 1920
        bitrate = 4000000  # 4 Mbps für Vertical
        
        if vertical_mode == 'crop':
            # Crop & Scale: Schneide Mitte aus
            scaling_behavior = 'DEFAULT'
            # Crop wird durch Width/Height automatisch gemacht
        else:
            # Letterbox: Schwarze Balken oben/unten
            scaling_behavior = 'STRETCH_TO_OUTPUT'
    else:
        # Querformat 16:9 (1920x1080)
        width = 1920
        height = 1080
        bitrate = 5000000  # 5 Mbps für Horizontal
        scaling_behavior = 'DEFAULT'
    
    return {
        'TimecodeConfig': {
            'Source': 'EMBEDDED'
        },
        'AudioDescriptions': [{
            'AudioSelectorName': 'default',
            'CodecSettings': {
                'AacSettings': {
                    'Bitrate': 128000,
                    'CodingMode': 'CODING_MODE_2_0',
                    'InputType': 'NORMAL',
                    'Profile': 'LC',
                    'RateControlMode': 'CBR',
                    'RawFormat': 'NONE',
                    'SampleRate': 48000,
                    'Spec': 'MPEG4'
                }
            },
            'AudioTypeControl': 'FOLLOW_INPUT',
            'LanguageCodeControl': 'FOLLOW_INPUT',
            'Name': 'audio_1'
        }],
        'VideoDescriptions': [{
            'CodecSettings': {
                'H264Settings': {
                    'AdaptiveQuantization': 'HIGH',
                    'Bitrate': bitrate,
                    'ColorMetadata': 'INSERT',
                    'EntropyEncoding': 'CABAC',
                    'FlickerAq': 'ENABLED',
                    'FramerateControl': 'SPECIFIED',
                    'FramerateNumerator': 30,
                    'FramerateDenominator': 1,
                    'GopBReference': 'DISABLED',
                    'GopClosedCadence': 1,
                    'GopNumBFrames': 2,
                    'GopSize': 2,
                    'GopSizeUnits': 'SECONDS',
                    'Level': 'H264_LEVEL_AUTO',
                    'LookAheadRateControl': 'HIGH',
                    'NumRefFrames': 3,
                    'ParControl': 'SPECIFIED',
                    'Profile': 'HIGH',
                    'RateControlMode': 'CBR',
                    'Syntax': 'DEFAULT',
                    'SceneChangeDetect': 'ENABLED',
                    'Slices': 1,
                    'SpatialAq': 'ENABLED',
                    'TemporalAq': 'ENABLED',
                    'TimecodeInsertion': 'DISABLED'
                }
            },
            'Height': height,
            'Width': width,
            'Name': 'video_1',
            'RespondToAfd': 'NONE',
            'Sharpness': 50,
            'ScalingBehavior': scaling_behavior
        }],
        'OutputGroups': [{
            'Name': 'RTMP',
            'OutputGroupSettings': {
                'RtmpGroupSettings': {
                    'AuthenticationScheme': 'COMMON',
                    'CacheFullBehavior': 'DISCONNECT_IMMEDIATELY',
                    'CacheLength': 30,
                    'CaptionData': 'ALL',
                    'RestartDelay': 15
                }
            },
            'Outputs': [{
                'OutputName': 'output_1',
                'VideoDescriptionName': 'video_1',
                'AudioDescriptionNames': ['audio_1'],
                'OutputSettings': {
                    'RtmpOutputSettings': {
                        'ConnectionRetryInterval': 2,
                        'NumRetries': 10,
                        'Destination': {
                            'DestinationRefId': 'rtmp-destination'
                        }
                    }
                }
            }]
        }]
    }

def handle_ivs_stream_state_change(event):
    """Behandelt IVS Stream State Changes (automatisches Start/Stop)"""
    detail = event.get('detail', {})
    stream_state = detail.get('stream_state')
    
    print(f"IVS Stream State Change: {stream_state}")
    
    if stream_state == 'StreamStarted':
        # Stream gestartet -> Starte alle aktivierten Ziele
        return auto_start_enabled_destinations()
    elif stream_state == 'StreamEnded':
        # Stream beendet -> Stoppe alle aktiven Ziele
        return auto_stop_active_destinations()
    
    return {'statusCode': 200, 'body': 'No action needed'}

def auto_start_enabled_destinations():
    """Startet automatisch alle aktivierten Streaming-Ziele"""
    try:
        # Hole alle aktivierten Ziele
        result = table.scan(
            FilterExpression='enabled = :enabled AND #s = :status',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':enabled': True,
                ':status': 'inactive'
            }
        )
        
        destinations = result.get('Items', [])
        started = []
        errors = []
        
        for destination in destinations:
            try:
                # Erstelle oder starte MediaLive Channel
                channel_id = destination.get('mediaLiveChannelId')
                
                if not channel_id:
                    # Erstelle neuen Channel
                    channel_id, input_id = create_medialive_channel(destination)
                    
                    # Update Destination
                    table.update_item(
                        Key={'id': destination['id']},
                        UpdateExpression='SET mediaLiveChannelId = :channelId, mediaLiveInputId = :inputId, #s = :status, updatedAt = :updatedAt',
                        ExpressionAttributeNames={'#s': 'status'},
                        ExpressionAttributeValues={
                            ':channelId': channel_id,
                            ':inputId': input_id,
                            ':status': 'starting',
                            ':updatedAt': datetime.utcnow().isoformat()
                        }
                    )
                
                # Starte Channel
                medialive.start_channel(ChannelId=channel_id)
                
                # Update Status
                table.update_item(
                    Key={'id': destination['id']},
                    UpdateExpression='SET #s = :status, updatedAt = :updatedAt',
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'active',
                        ':updatedAt': datetime.utcnow().isoformat()
                    }
                )
                
                started.append(destination['name'])
                print(f"Started restreaming to {destination['name']}")
                
            except Exception as e:
                error_msg = f"Failed to start {destination['name']}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Auto-start completed',
                'started': started,
                'errors': errors
            })
        }
        
    except Exception as e:
        print(f"Error in auto_start: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def auto_stop_active_destinations():
    """Stoppt automatisch alle aktiven Streaming-Ziele"""
    try:
        # Hole alle aktiven Ziele
        result = table.scan(
            FilterExpression='#s = :status',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'active'
            }
        )
        
        destinations = result.get('Items', [])
        stopped = []
        errors = []
        
        for destination in destinations:
            try:
                channel_id = destination.get('mediaLiveChannelId')
                
                if channel_id:
                    # Stoppe Channel
                    medialive.stop_channel(ChannelId=channel_id)
                    
                    # Update Status
                    table.update_item(
                        Key={'id': destination['id']},
                        UpdateExpression='SET #s = :status, updatedAt = :updatedAt',
                        ExpressionAttributeNames={'#s': 'status'},
                        ExpressionAttributeValues={
                            ':status': 'inactive',
                            ':updatedAt': datetime.utcnow().isoformat()
                        }
                    )
                    
                    stopped.append(destination['name'])
                    print(f"Stopped restreaming to {destination['name']}")
                
            except Exception as e:
                error_msg = f"Failed to stop {destination['name']}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Auto-stop completed',
                'stopped': stopped,
                'errors': errors
            })
        }
        
    except Exception as e:
        print(f"Error in auto_stop: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
