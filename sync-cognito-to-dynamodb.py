#!/usr/bin/env python3
"""
Cognito to DynamoDB User Sync Script
This script syncs all existing Cognito users to the DynamoDB Users table
"""

import boto3
import sys
from datetime import datetime
from botocore.exceptions import ClientError

# Configuration
REGION = 'eu-central-1'
PROJECT_NAME = 'honigwabe'
USER_POOL_NAME = f'{PROJECT_NAME}-users'
TABLE_NAME = f'{PROJECT_NAME}-users'

def get_user_pool_id(cognito_client, user_pool_name):
    """Find User Pool ID by name"""
    try:
        response = cognito_client.list_user_pools(MaxResults=60)
        for pool in response.get('UserPools', []):
            if pool['Name'] == user_pool_name:
                return pool['Id']
        return None
    except ClientError as e:
        print(f"❌ Error finding User Pool: {e}")
        return None

def get_all_cognito_users(cognito_client, user_pool_id):
    """Fetch all users from Cognito User Pool"""
    users = []
    pagination_token = None
    
    try:
        while True:
            if pagination_token:
                response = cognito_client.list_users(
                    UserPoolId=user_pool_id,
                    PaginationToken=pagination_token
                )
            else:
                response = cognito_client.list_users(UserPoolId=user_pool_id)
            
            users.extend(response.get('Users', []))
            print(f"  Fetched {len(response.get('Users', []))} users...")
            
            pagination_token = response.get('PaginationToken')
            if not pagination_token:
                break
                
        return users
    except ClientError as e:
        print(f"❌ Error fetching users: {e}")
        return []

def get_attribute_value(attributes, name):
    """Extract attribute value from Cognito user attributes"""
    for attr in attributes:
        if attr['Name'] == name:
            return attr['Value']
    return None

def sync_user_to_dynamodb(dynamodb_client, table_name, user):
    """Sync a single user to DynamoDB"""
    # Extract user attributes
    user_id = user['Username']
    email = get_attribute_value(user['Attributes'], 'email')
    name = get_attribute_value(user['Attributes'], 'name')
    email_verified = get_attribute_value(user['Attributes'], 'email_verified')
    
    # Skip unconfirmed users
    if user['UserStatus'] != 'CONFIRMED':
        return 'skipped', email
    
    # Default name if not set
    if not name:
        name = email.split('@')[0] if email else 'User'
    
    # Create DynamoDB item
    timestamp = datetime.utcnow().isoformat() + 'Z'
    
    item = {
        'userId': user_id,
        'email': email,
        'name': name,
        'emailVerified': email_verified == 'true',
        'status': 'active',
        'createdAt': timestamp,
        'updatedAt': timestamp
    }
    
    try:
        dynamodb_client.put_item(
            TableName=table_name,
            Item={
                'userId': {'S': item['userId']},
                'email': {'S': item['email']},
                'name': {'S': item['name']},
                'emailVerified': {'BOOL': item['emailVerified']},
                'status': {'S': item['status']},
                'createdAt': {'S': item['createdAt']},
                'updatedAt': {'S': item['updatedAt']}
            }
        )
        return 'success', email
    except ClientError as e:
        return 'error', f"{email} - {e}"

def main():
    print("=" * 60)
    print("Cognito to DynamoDB User Sync")
    print("=" * 60)
    print()
    
    print(f"Configuration:")
    print(f"  Region: {REGION}")
    print(f"  User Pool: {USER_POOL_NAME}")
    print(f"  DynamoDB Table: {TABLE_NAME}")
    print()
    
    # Initialize AWS clients
    cognito_client = boto3.client('cognito-idp', region_name=REGION)
    dynamodb_client = boto3.client('dynamodb', region_name=REGION)
    
    # Step 1: Get User Pool ID
    print("Step 1: Finding Cognito User Pool...")
    user_pool_id = get_user_pool_id(cognito_client, USER_POOL_NAME)
    
    if not user_pool_id:
        print(f"❌ User Pool '{USER_POOL_NAME}' not found!")
        sys.exit(1)
    
    print(f"✓ Found User Pool: {user_pool_id}")
    print()
    
    # Step 2: Fetch all users
    print("Step 2: Fetching all Cognito users...")
    users = get_all_cognito_users(cognito_client, user_pool_id)
    
    print(f"✓ Found {len(users)} total users in Cognito")
    print()
    
    if len(users) == 0:
        print("No users to sync. Exiting.")
        sys.exit(0)
    
    # Step 3: Sync users to DynamoDB
    print("Step 3: Syncing users to DynamoDB...")
    
    synced_count = 0
    skipped_count = 0
    error_count = 0
    
    for user in users:
        status, info = sync_user_to_dynamodb(dynamodb_client, TABLE_NAME, user)
        
        if status == 'success':
            print(f"  ✓ Synced: {info}")
            synced_count += 1
        elif status == 'skipped':
            print(f"  ⊘ Skipped (unconfirmed): {info}")
            skipped_count += 1
        else:
            print(f"  ✗ Failed: {info}")
            error_count += 1
    
    print()
    print("=" * 60)
    print("Sync Complete")
    print("=" * 60)
    print()
    print("Summary:")
    print(f"  Total users in Cognito: {len(users)}")
    print(f"  Successfully synced: {synced_count}")
    print(f"  Skipped (unconfirmed): {skipped_count}")
    print(f"  Errors: {error_count}")
    print()
    
    if error_count > 0:
        print("⚠ Some users failed to sync. Please check the errors above.")
        sys.exit(1)
    
    print("✓ All users successfully synced to DynamoDB!")
    print()

if __name__ == '__main__':
    main()
