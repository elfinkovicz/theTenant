#!/usr/bin/env python3
"""
Check Mollie API Key in Shop Settings
"""

import boto3
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')

# Table name - adjust if needed
SHOP_TABLE = 'viraltenant-tenant-shop-production'

def check_shop_mollie(tenant_id):
    """Check Mollie config in shop settings"""
    table = dynamodb.Table(SHOP_TABLE)
    
    try:
        response = table.get_item(Key={'tenant_id': tenant_id})
        
        if 'Item' not in response:
            print(f"❌ No shop data found for tenant: {tenant_id}")
            return
        
        item = response['Item']
        settings = item.get('settings', {})
        payment_config = settings.get('paymentConfig', {})
        mollie_config = payment_config.get('mollie', {})
        
        print(f"\n📦 Shop Settings for tenant: {tenant_id}")
        print(f"=" * 60)
        
        print(f"\n💳 Mollie Configuration:")
        print(f"   Enabled: {mollie_config.get('enabled', False)}")
        
        api_key = mollie_config.get('apiKey', '')
        if api_key:
            # Show first and last 4 chars for security
            masked_key = api_key[:8] + '...' + api_key[-4:] if len(api_key) > 12 else api_key
            print(f"   API Key: {masked_key}")
            
            # Check if it's live or test
            if api_key.startswith('live_'):
                print(f"   Mode: 🟢 LIVE")
            elif api_key.startswith('test_'):
                print(f"   Mode: 🟡 TEST")
            else:
                print(f"   Mode: ⚠️ Unknown format")
        else:
            print(f"   API Key: ❌ Not set")
        
        print(f"   Profile ID: {mollie_config.get('profileId', 'Not set')}")
        
        # Also show PayPal config
        paypal_config = payment_config.get('paypal', {})
        print(f"\n💳 PayPal Configuration:")
        print(f"   Enabled: {paypal_config.get('enabled', False)}")
        print(f"   Sandbox: {paypal_config.get('sandbox', True)}")
        
        print(f"\n📅 Last Updated: {item.get('updated_at', 'Unknown')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    # Your tenant ID - adjust as needed
    # Platform tenant
    tenant_id = '319190e1-0791-43b0-bd04-506f959c1471'
    
    check_shop_mollie(tenant_id)
    
    # If you have other tenants to check, add them here
    # check_shop_mollie('another-tenant-id')
