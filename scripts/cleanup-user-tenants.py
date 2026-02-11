#!/usr/bin/env python3
"""
Script to clean up invalid user-tenant entries.
Removes entries where the tenant doesn't exist in the tenants table.
"""

import boto3

REGION = "eu-central-1"
USER_TENANTS_TABLE = "viraltenant-user-tenants-production"
TENANTS_TABLE = "viraltenant-tenants-production"

dynamodb = boto3.resource('dynamodb', region_name=REGION)
user_tenants_table = dynamodb.Table(USER_TENANTS_TABLE)
tenants_table = dynamodb.Table(TENANTS_TABLE)

# User to clean up
user_id = 'e3f41812-b041-708a-6c0c-5ab0d8370058'

print(f"Checking user-tenant entries for user: {user_id}")
print("=" * 60)

# Get all user-tenant entries
response = user_tenants_table.query(
    KeyConditionExpression='user_id = :uid',
    ExpressionAttributeValues={':uid': user_id}
)

entries_to_delete = []
valid_entries = []

for item in response.get('Items', []):
    tenant_id = item.get('tenant_id')
    
    # Check if tenant exists
    tenant_response = tenants_table.get_item(Key={'tenant_id': tenant_id})
    
    if 'Item' in tenant_response:
        tenant = tenant_response['Item']
        print(f"VALID: {tenant_id}")
        print(f"  -> subdomain: {tenant.get('subdomain')}")
        print(f"  -> creator_name: {tenant.get('creator_name')}")
        valid_entries.append(item)
    else:
        print(f"INVALID: {tenant_id} (tenant does not exist)")
        entries_to_delete.append(item)

print()
print("=" * 60)
print(f"Valid entries: {len(valid_entries)}")
print(f"Invalid entries to delete: {len(entries_to_delete)}")

if entries_to_delete:
    print()
    confirm = input("Delete invalid entries? (yes/no): ")
    
    if confirm.lower() == 'yes':
        for item in entries_to_delete:
            user_tenants_table.delete_item(
                Key={
                    'user_id': item['user_id'],
                    'tenant_id': item['tenant_id']
                }
            )
            print(f"Deleted: {item['tenant_id']}")
        print("Cleanup complete!")
    else:
        print("Aborted.")
else:
    print("No cleanup needed.")
