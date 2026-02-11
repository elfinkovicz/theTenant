#!/usr/bin/env python3
"""
Reset all crosspost platform connections for a tenant in DynamoDB
"""

import boto3
import sys

REGION = 'eu-central-1'

# All crosspost settings tables
TABLES = {
    'tiktok': 'viraltenant-tiktok-settings-production',
    'youtube': 'viraltenant-youtube-settings-production',
    'snapchat': 'viraltenant-snapchat-settings-production',
    'facebook': 'viraltenant-facebook-settings-production',
    'instagram': 'viraltenant-instagram-settings-production',
    'xtwitter': 'viraltenant-xtwitter-settings-production',
    'linkedin': 'viraltenant-linkedin-settings-production',
    'threads': 'viraltenant-threads-settings-production',
    'telegram': 'viraltenant-telegram-settings-production',
    'discord': 'viraltenant-discord-settings-production',
    'slack': 'viraltenant-slack-settings-production',
    'bluesky': 'viraltenant-bluesky-settings-production',
    'mastodon': 'viraltenant-mastodon-settings-production',
    'whatsapp': 'viraltenant-whatsapp-settings-production',
    'email': 'viraltenant-email-settings-production',
}

def reset_all_connections(tenant_id):
    """Reset all crosspost connections for a tenant"""
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    
    print(f"\n🔄 Resetting all crosspost connections for tenant: {tenant_id}")
    print("-" * 60)
    
    for platform, table_name in TABLES.items():
        try:
            table = dynamodb.Table(table_name)
            
            # Check if entry exists
            response = table.get_item(Key={'tenant_id': tenant_id})
            
            if 'Item' in response:
                item = response['Item']
                
                # Delete the entire item to reset
                table.delete_item(Key={'tenant_id': tenant_id})
                print(f"  ✅ {platform}: Reset (was connected)")
            else:
                print(f"  ⚪ {platform}: No settings found")
                
        except dynamodb.meta.client.exceptions.ResourceNotFoundException:
            print(f"  ⚠️  {platform}: Table not found ({table_name})")
        except Exception as e:
            print(f"  ❌ {platform}: Error - {e}")
    
    print("\n✅ All crosspost connections have been reset!")
    print("   User will need to reconnect all platforms.")

def show_all_connections(tenant_id):
    """Show all crosspost connections for a tenant"""
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    
    print(f"\n📋 Crosspost connections for tenant: {tenant_id}")
    print("-" * 60)
    
    for platform, table_name in TABLES.items():
        try:
            table = dynamodb.Table(table_name)
            response = table.get_item(Key={'tenant_id': tenant_id})
            
            if 'Item' in response:
                item = response['Item']
                enabled = item.get('enabled', False)
                
                # Check for access token (different field names per platform)
                has_token = bool(
                    item.get('accessToken') or 
                    item.get('pageAccessToken') or 
                    item.get('oauth2AccessToken') or
                    item.get('botToken') or
                    item.get('webhookUrl') or
                    item.get('appPassword')
                )
                
                # Get display name
                display_name = (
                    item.get('displayName') or 
                    item.get('channelName') or 
                    item.get('pageName') or
                    item.get('accountName') or
                    item.get('username') or
                    item.get('handle') or
                    item.get('chatName') or
                    'Unknown'
                )
                
                status = "🟢" if enabled and has_token else "🟡" if enabled else "⚪"
                print(f"  {status} {platform}: enabled={enabled}, connected={has_token}, name={display_name}")
            else:
                print(f"  ⚪ {platform}: No settings")
                
        except dynamodb.meta.client.exceptions.ResourceNotFoundException:
            print(f"  ⚠️  {platform}: Table not found")
        except Exception as e:
            print(f"  ❌ {platform}: Error - {e}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        tenant_id = sys.argv[1]
        
        if len(sys.argv) > 2 and sys.argv[2] == '--reset':
            confirm = input(f"\n⚠️  This will DELETE all crosspost settings for tenant {tenant_id}.\n   Type 'yes' to confirm: ")
            if confirm.lower() == 'yes':
                reset_all_connections(tenant_id)
            else:
                print("Aborted.")
        else:
            show_all_connections(tenant_id)
            print(f"\n💡 To reset all connections, run:")
            print(f"   python reset-all-crosspost-connections.py {tenant_id} --reset")
    else:
        print("💡 Usage:")
        print("   python reset-all-crosspost-connections.py <tenant_id>          # Show connections")
        print("   python reset-all-crosspost-connections.py <tenant_id> --reset  # Reset all")
