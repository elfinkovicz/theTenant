#!/usr/bin/env python3
"""
Reset TikTok Commercial Content settings for a tenant in DynamoDB
Sets commercialContentEnabled, brandOrganic, brandedContent to false
"""

import boto3
import sys

REGION = 'eu-central-1'
TABLE_NAME = 'viraltenant-tiktok-settings-production'
PLATFORM_TENANT_ID = '319190e1-0791-43b0-bd04-506f959c1471'

def reset_commercial_content(tenant_id):
    """Reset commercial content settings for a tenant"""
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    print(f"\n🔄 Resetting TikTok Commercial Content for tenant: {tenant_id}")
    print("-" * 60)
    
    try:
        # Get current settings
        response = table.get_item(Key={'tenant_id': tenant_id})
        
        if 'Item' not in response:
            print(f"  ⚠️  No TikTok settings found for tenant")
            return
        
        item = response['Item']
        print(f"  Current settings:")
        print(f"    commercialContentEnabled: {item.get('commercialContentEnabled', 'not set')}")
        print(f"    brandOrganic: {item.get('brandOrganic', 'not set')}")
        print(f"    brandedContent: {item.get('brandedContent', 'not set')}")
        
        # Update to reset commercial content
        table.update_item(
            Key={'tenant_id': tenant_id},
            UpdateExpression='SET commercialContentEnabled = :false, brandOrganic = :false, brandedContent = :false',
            ExpressionAttributeValues={
                ':false': False
            }
        )
        
        print(f"\n  ✅ Commercial Content settings reset to false!")
        print(f"    commercialContentEnabled: false")
        print(f"    brandOrganic: false")
        print(f"    brandedContent: false")
        
    except Exception as e:
        print(f"  ❌ Error: {e}")

if __name__ == '__main__':
    tenant_id = sys.argv[1] if len(sys.argv) > 1 else PLATFORM_TENANT_ID
    
    print(f"🎯 Target tenant: {tenant_id}")
    if tenant_id == PLATFORM_TENANT_ID:
        print("   (Platform Main Tenant)")
    
    reset_commercial_content(tenant_id)
