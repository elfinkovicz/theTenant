#!/usr/bin/env python3
"""
Script to add a user as admin to the platform tenant.
This directly adds the user to the user-tenants DynamoDB table.
"""

import boto3
from datetime import datetime

# Configuration
REGION = "eu-central-1"
USER_POOL_ID = "eu-central-1_4mUqVJrm2"
USER_TENANTS_TABLE = "viraltenant-user-tenants-production"
TENANTS_TABLE = "viraltenant-tenants-production"

# The email to add as admin
ADMIN_EMAIL = "email@nielsfink.de"  # Update this if needed

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
                'name': next((attr['Value'] for attr in user['Attributes'] if attr['Name'] == 'name'), None),
                'status': user['UserStatus']
            }
        return None
    except Exception as e:
        print(f"Error finding user: {e}")
        return None

def get_platform_tenant():
    """Get the platform tenant from DynamoDB"""
    table = dynamodb.Table(TENANTS_TABLE)
    
    # The main viraltenant.com tenant has subdomain 'www' and creator_name 'ViralTenant'
    # or we look for 'platform' as tenant_id
    try:
        # First try tenant_id = 'platform'
        response = table.get_item(Key={'tenant_id': 'platform'})
        if 'Item' in response:
            return response['Item']
    except Exception as e:
        print(f"Error getting platform tenant by ID: {e}")
    
    # Look for the main ViralTenant tenant (subdomain www or creator_name ViralTenant)
    try:
        response = table.scan(
            FilterExpression='subdomain = :www OR creator_name = :viraltenant',
            ExpressionAttributeValues={
                ':www': 'www',
                ':viraltenant': 'ViralTenant'
            }
        )
        if response['Items']:
            return response['Items'][0]
    except Exception as e:
        print(f"Error scanning for platform tenant: {e}")
    
    return None

def list_all_tenants():
    """List all tenants to find the correct one"""
    table = dynamodb.Table(TENANTS_TABLE)
    try:
        response = table.scan(Limit=20)
        print("\n=== Available Tenants ===")
        for item in response.get('Items', []):
            print(f"  - tenant_id: {item.get('tenant_id')}")
            print(f"    subdomain: {item.get('subdomain')}")
            print(f"    creator_name: {item.get('creator_name')}")
            print(f"    status: {item.get('status')}")
            print()
        return response.get('Items', [])
    except Exception as e:
        print(f"Error listing tenants: {e}")
        return []

def add_admin_to_tenant(user_id, tenant_id, email):
    """Add user as admin to tenant in user-tenants table"""
    table = dynamodb.Table(USER_TENANTS_TABLE)
    
    try:
        # Check if already exists
        response = table.get_item(
            Key={
                'user_id': user_id,
                'tenant_id': tenant_id
            }
        )
        
        if 'Item' in response:
            print(f"User {email} is already associated with tenant {tenant_id}")
            print(f"Current role: {response['Item'].get('role')}")
            
            # Update to admin if not already
            if response['Item'].get('role') != 'admin':
                table.update_item(
                    Key={
                        'user_id': user_id,
                        'tenant_id': tenant_id
                    },
                    UpdateExpression='SET #role = :role, updated_at = :updated_at',
                    ExpressionAttributeNames={'#role': 'role'},
                    ExpressionAttributeValues={
                        ':role': 'admin',
                        ':updated_at': datetime.utcnow().isoformat()
                    }
                )
                print(f"Updated role to admin!")
            return True
        
        # Add new admin entry
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
        print(f"Successfully added {email} as admin to tenant {tenant_id}")
        return True
        
    except Exception as e:
        print(f"Error adding admin: {e}")
        return False

def main():
    print("=" * 60)
    print("Platform Admin Addition Script")
    print("=" * 60)
    
    # Step 1: Find the user in Cognito
    print(f"\n1. Looking for user with email: {ADMIN_EMAIL}")
    user = get_user_by_email(ADMIN_EMAIL)
    
    if not user:
        print(f"   ERROR: User with email '{ADMIN_EMAIL}' not found in Cognito!")
        print("   Make sure the user has registered first.")
        return
    
    print(f"   Found user:")
    print(f"   - User ID: {user['user_id']}")
    print(f"   - Email: {user['email']}")
    print(f"   - Name: {user['name']}")
    print(f"   - Status: {user['status']}")
    
    # Step 2: Find the platform tenant
    print(f"\n2. Looking for platform tenant...")
    platform_tenant = get_platform_tenant()
    
    if not platform_tenant:
        print("   Platform tenant not found. Listing all available tenants:")
        tenants = list_all_tenants()
        
        if tenants:
            print("\n   Please update the script with the correct tenant_id")
            print("   Or create the platform tenant first.")
        return
    
    print(f"   Found platform tenant:")
    print(f"   - Tenant ID: {platform_tenant.get('tenant_id')}")
    print(f"   - Subdomain: {platform_tenant.get('subdomain')}")
    print(f"   - Creator Name: {platform_tenant.get('creator_name')}")
    
    # Step 3: Add user as admin
    print(f"\n3. Adding user as admin to platform tenant...")
    success = add_admin_to_tenant(
        user['user_id'],
        platform_tenant['tenant_id'],
        user['email']
    )
    
    if success:
        print("\n" + "=" * 60)
        print("SUCCESS! User is now admin of the platform tenant.")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("FAILED! Could not add user as admin.")
        print("=" * 60)

if __name__ == "__main__":
    main()
