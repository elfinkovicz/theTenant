#!/usr/bin/env python3
"""
Script to fix user-tenant access issues.
Adds the user as admin to the tenant they're trying to access.
"""

import boto3
from datetime import datetime

# Configuration
REGION = "eu-central-1"
USER_POOL_ID = "eu-central-1_4mUqVJrm2"
USER_TENANTS_TABLE = "viraltenant-user-tenants-production"
TENANTS_TABLE = "viraltenant-tenants-production"

# The email to fix access for
ADMIN_EMAIL = "email@nielsfink.de"

# The subdomain/tenant to add access to (change this to your subdomain)
TARGET_SUBDOMAIN = "nielsfink"  # Change this to your subdomain

# AWS Clients
dynamodb = boto3.resource('dynamodb', region_name=REGION)
cognito = boto3.client('cognito-idp', region_name=REGION)

def get_user_by_email(email):
    """Find Cognito user by email"""
    try:
        response = cognito.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email = "{email}"',
            Limit=1
        )
        
        if response['Users']:
            user = response['Users'][0]
            return {
                'user_id': user['Username'],
                'email': next((attr['Value'] for attr in user['Attributes'] if attr['Name'] == 'email'), None),
            }
        return None
    except Exception as e:
        print(f"Error finding user: {e}")
        return None

def get_tenant_by_subdomain(subdomain):
    """Get tenant by subdomain"""
    table = dynamodb.Table(TENANTS_TABLE)
    
    try:
        response = table.scan(
            FilterExpression='subdomain = :subdomain',
            ExpressionAttributeValues={':subdomain': subdomain}
        )
        if response['Items']:
            return response['Items'][0]
    except Exception as e:
        print(f"Error finding tenant: {e}")
    
    return None

def list_user_tenants(user_id):
    """List all tenants the user has access to"""
    table = dynamodb.Table(USER_TENANTS_TABLE)
    
    try:
        response = table.query(
            KeyConditionExpression='user_id = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        return response.get('Items', [])
    except Exception as e:
        print(f"Error listing user tenants: {e}")
        return []

def add_admin_to_tenant(user_id, tenant_id, email):
    """Add user as admin to tenant"""
    table = dynamodb.Table(USER_TENANTS_TABLE)
    
    try:
        table.put_item(
            Item={
                'user_id': user_id,
                'tenant_id': tenant_id,
                'role': 'admin',
                'email': email,
                'permissions': ['all'],
                'joined_at': datetime.utcnow().isoformat(),
                'created_at': datetime.utcnow().isoformat()
            }
        )
        return True
    except Exception as e:
        print(f"Error adding admin: {e}")
        return False

def main():
    print("=" * 60)
    print("Fix User-Tenant Access Script")
    print("=" * 60)
    
    # Step 1: Find the user
    print(f"\n1. Looking for user: {ADMIN_EMAIL}")
    user = get_user_by_email(ADMIN_EMAIL)
    
    if not user:
        print(f"   ERROR: User not found!")
        return
    
    print(f"   Found user: {user['user_id']}")
    
    # Step 2: List current tenant access
    print(f"\n2. Current tenant access:")
    current_tenants = list_user_tenants(user['user_id'])
    if current_tenants:
        for t in current_tenants:
            print(f"   - {t['tenant_id']} (role: {t.get('role', 'unknown')})")
    else:
        print("   No tenant access found!")
    
    # Step 3: Find target tenant
    print(f"\n3. Looking for tenant with subdomain: {TARGET_SUBDOMAIN}")
    tenant = get_tenant_by_subdomain(TARGET_SUBDOMAIN)
    
    if not tenant:
        print(f"   ERROR: Tenant with subdomain '{TARGET_SUBDOMAIN}' not found!")
        print("\n   Available tenants:")
        table = dynamodb.Table(TENANTS_TABLE)
        response = table.scan(Limit=10)
        for t in response.get('Items', []):
            print(f"   - subdomain: {t.get('subdomain')}, tenant_id: {t.get('tenant_id')}")
        return
    
    print(f"   Found tenant: {tenant['tenant_id']}")
    
    # Step 4: Check if already has access
    has_access = any(t['tenant_id'] == tenant['tenant_id'] for t in current_tenants)
    if has_access:
        print(f"\n4. User already has access to this tenant!")
        return
    
    # Step 5: Add access
    print(f"\n4. Adding admin access to tenant...")
    success = add_admin_to_tenant(user['user_id'], tenant['tenant_id'], user['email'])
    
    if success:
        print("\n" + "=" * 60)
        print(f"SUCCESS! User now has admin access to '{TARGET_SUBDOMAIN}'")
        print("=" * 60)
    else:
        print("\nFAILED!")

if __name__ == "__main__":
    main()
