import json
import boto3
import os
from datetime import datetime

ivs = boto3.client('ivs')

def lambda_handler(event, context):
    """
    Get IVS Stream Status and Viewer Count
    """
    
    channel_arn = os.environ.get('CHANNEL_ARN')
    
    if not channel_arn:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Channel ARN not configured'
            })
        }
    
    try:
        # Get Stream information
        stream_response = ivs.get_stream(channelArn=channel_arn)
        stream = stream_response.get('stream')
        
        if stream and stream.get('state') == 'LIVE':
            # Stream is live
            viewer_count = stream.get('viewerCount', 0)
            start_time = stream.get('startTime')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'isLive': True,
                    'viewerCount': viewer_count,
                    'startTime': start_time.isoformat() if start_time else None,
                    'health': stream.get('health', 'UNKNOWN')
                })
            }
        else:
            # Stream is offline
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'isLive': False,
                    'viewerCount': 0
                })
            }
            
    except ivs.exceptions.ResourceNotFoundException:
        # No active stream
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'isLive': False,
                'viewerCount': 0
            })
        }
    except Exception as e:
        print(f"Error getting stream status: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Failed to get stream status',
                'message': str(e)
            })
        }
