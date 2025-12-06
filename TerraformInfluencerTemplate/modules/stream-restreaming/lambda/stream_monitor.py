import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
ivs = boto3.client('ivs')
medialive = boto3.client('medialive')

table = dynamodb.Table(os.environ['DESTINATIONS_TABLE'])
state_table = dynamodb.Table(os.environ['STATE_TABLE'])
channel_arn = os.environ['IVS_CHANNEL_ARN']

def handler(event, context):
    """
    Überwacht den IVS Stream Status und startet/stoppt Restreaming automatisch
    Wird alle 30 Sekunden von CloudWatch Events aufgerufen
    """
    print(f"Checking IVS stream status for channel: {channel_arn}")
    
    try:
        # Hole aktuellen Stream Status
        response = ivs.get_stream(channelArn=channel_arn)
        stream = response.get('stream')
        
        if stream and stream.get('state') == 'LIVE':
            current_state = 'LIVE'
            print("Stream is LIVE")
        else:
            current_state = 'OFFLINE'
            print("Stream is OFFLINE")
            
    except ivs.exceptions.ResourceNotFoundException:
        # Kein aktiver Stream
        current_state = 'OFFLINE'
        print("No active stream found")
    except Exception as e:
        print(f"Error checking stream status: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
    
    # Hole vorherigen Status
    try:
        state_response = state_table.get_item(Key={'id': 'stream_state'})
        previous_state = state_response.get('Item', {}).get('state', 'OFFLINE')
    except:
        previous_state = 'OFFLINE'
    
    print(f"Previous state: {previous_state}, Current state: {current_state}")
    
    # Status hat sich geändert
    if previous_state != current_state:
        print(f"State changed from {previous_state} to {current_state}")
        
        # Speichere neuen Status
        state_table.put_item(Item={
            'id': 'stream_state',
            'state': current_state,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Führe entsprechende Aktion aus
        if current_state == 'LIVE':
            return auto_start_enabled_destinations()
        else:
            return auto_stop_active_destinations()
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'No state change',
            'state': current_state
        })
    }

def auto_start_enabled_destinations():
    """Startet automatisch alle aktivierten Streaming-Ziele"""
    print("Auto-starting enabled destinations...")
    
    try:
        # Hole alle aktivierten Ziele die nicht aktiv sind
        result = table.scan(
            FilterExpression='enabled = :enabled AND (#s = :inactive OR attribute_not_exists(#s))',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':enabled': True,
                ':inactive': 'inactive'
            }
        )
        
        destinations = result.get('Items', [])
        print(f"Found {len(destinations)} destinations to start")
        
        started = []
        errors = []
        
        for destination in destinations:
            try:
                destination_id = destination['id']
                channel_id = destination.get('mediaLiveChannelId')
                
                print(f"Starting destination: {destination['name']} (ID: {destination_id})")
                
                # Prüfe ob Channel existiert
                if channel_id:
                    try:
                        channel_info = medialive.describe_channel(ChannelId=channel_id)
                        channel_state = channel_info['State']
                        
                        if channel_state == 'IDLE':
                            # Channel existiert und ist idle -> starte ihn
                            print(f"Starting existing channel {channel_id}")
                            medialive.start_channel(ChannelId=channel_id)
                        elif channel_state in ['STARTING', 'RUNNING']:
                            print(f"Channel {channel_id} is already {channel_state}")
                            # Bereits gestartet oder am starten
                            started.append(destination['name'])
                            continue
                        else:
                            print(f"Channel {channel_id} is in state {channel_state}, recreating...")
                            # Channel in ungültigem Status -> lösche und erstelle neu
                            try:
                                medialive.delete_channel(ChannelId=channel_id)
                            except:
                                pass
                            channel_id = None
                    except medialive.exceptions.NotFoundException:
                        print(f"Channel {channel_id} not found, will create new one")
                        channel_id = None
                
                # Erstelle neuen Channel falls nötig
                if not channel_id:
                    print(f"Creating new MediaLive channel for {destination['name']}")
                    channel_id, input_id = create_medialive_channel(destination)
                    
                    # Update Destination mit Channel IDs
                    table.update_item(
                        Key={'id': destination_id},
                        UpdateExpression='SET mediaLiveChannelId = :channelId, mediaLiveInputId = :inputId, updatedAt = :updatedAt',
                        ExpressionAttributeValues={
                            ':channelId': channel_id,
                            ':inputId': input_id,
                            ':updatedAt': datetime.utcnow().isoformat()
                        }
                    )
                    
                    # Starte den neu erstellten Channel
                    print(f"Starting new channel {channel_id}")
                    medialive.start_channel(ChannelId=channel_id)
                
                # Update Status auf active
                table.update_item(
                    Key={'id': destination_id},
                    UpdateExpression='SET #s = :status, updatedAt = :updatedAt',
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'active',
                        ':updatedAt': datetime.utcnow().isoformat()
                    }
                )
                
                started.append(destination['name'])
                print(f"Successfully started {destination['name']}")
                
            except Exception as e:
                error_msg = f"Failed to start {destination.get('name', 'unknown')}: {str(e)}"
                print(error_msg)
                import traceback
                traceback.print_exc()
                errors.append(error_msg)
        
        result = {
            'message': 'Auto-start completed',
            'started': started,
            'errors': errors
        }
        print(f"Auto-start result: {result}")
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except Exception as e:
        error_msg = f"Error in auto_start: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': error_msg})
        }

def auto_stop_active_destinations():
    """Stoppt automatisch alle aktiven Streaming-Ziele"""
    print("Auto-stopping active destinations...")
    
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
        print(f"Found {len(destinations)} active destinations to stop")
        
        stopped = []
        errors = []
        
        for destination in destinations:
            try:
                destination_id = destination['id']
                channel_id = destination.get('mediaLiveChannelId')
                
                print(f"Stopping destination: {destination['name']} (ID: {destination_id})")
                
                if channel_id:
                    try:
                        # Prüfe Channel Status
                        channel_info = medialive.describe_channel(ChannelId=channel_id)
                        channel_state = channel_info['State']
                        
                        if channel_state in ['RUNNING', 'STARTING']:
                            print(f"Stopping channel {channel_id}")
                            medialive.stop_channel(ChannelId=channel_id)
                        else:
                            print(f"Channel {channel_id} is already in state {channel_state}")
                    except medialive.exceptions.NotFoundException:
                        print(f"Channel {channel_id} not found")
                    except Exception as e:
                        print(f"Error stopping channel {channel_id}: {str(e)}")
                
                # Update Status auf inactive
                table.update_item(
                    Key={'id': destination_id},
                    UpdateExpression='SET #s = :status, updatedAt = :updatedAt',
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'inactive',
                        ':updatedAt': datetime.utcnow().isoformat()
                    }
                )
                
                stopped.append(destination['name'])
                print(f"Successfully stopped {destination['name']}")
                
            except Exception as e:
                error_msg = f"Failed to stop {destination.get('name', 'unknown')}: {str(e)}"
                print(error_msg)
                import traceback
                traceback.print_exc()
                errors.append(error_msg)
        
        result = {
            'message': 'Auto-stop completed',
            'stopped': stopped,
            'errors': errors
        }
        print(f"Auto-stop result: {result}")
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except Exception as e:
        error_msg = f"Error in auto_stop: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': error_msg})
        }

def create_medialive_channel(destination):
    """Erstelle MediaLive Channel für Restreaming"""
    from index import create_medialive_channel as create_channel
    return create_channel(destination)
