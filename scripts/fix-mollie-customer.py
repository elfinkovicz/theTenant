#!/usr/bin/env python3
"""
Fix Mollie customer ID in DynamoDB for platform tenant
"""
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
billing_table = dynamodb.Table('viraltenant-billing-production')

tenant_id = '319190e1-0791-43b0-bd04-506f959c1471'
mollie_customer_id = 'cst_tZBTRNvdoo'

# First check if record exists
response = billing_table.get_item(Key={'user_id': tenant_id})

if 'Item' in response:
    print(f"Existing record found: {response['Item']}")
    # Update existing record
    billing_table.update_item(
        Key={'user_id': tenant_id},
        UpdateExpression='SET mollie_customer_id = :cid, mollie_mandate_status = :status, updated_at = :now',
        ExpressionAttributeValues={
            ':cid': mollie_customer_id,
            ':status': 'active',
            ':now': datetime.utcnow().isoformat()
        }
    )
    print(f"Updated record with mollie_customer_id: {mollie_customer_id}")
else:
    print("No existing record, creating new one")
    billing_table.put_item(Item={
        'user_id': tenant_id,
        'mollie_customer_id': mollie_customer_id,
        'mollie_mandate_status': 'active',
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    })
    print(f"Created new record with mollie_customer_id: {mollie_customer_id}")

# Verify
response = billing_table.get_item(Key={'user_id': tenant_id})
print(f"\nFinal record: {response.get('Item', 'NOT FOUND')}")
