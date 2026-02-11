#!/usr/bin/env python3
"""
Set Instagram access token for testing
"""

import boto3

REGION = 'eu-central-1'
TABLE_NAME = 'viraltenant-instagram-settings-production'
PLATFORM_TENANT_ID = '319190e1-0791-43b0-bd04-506f959c1471'

# Instagram App Token
ACCESS_TOKEN = 'IGAARkIITpDKxBZAGFxaWt1MFpGVEoyaFMxUFREbHJ4aDRDSmhKUTFQQ1QyaVk1NzB5ZAFlQbldsbUFlcGVwNzBKS1BiTERpZAHBERzZAoTy1ZAR1VNSS1jYWRpeDdGY1l2SHdqTUZAmd0JSWGxZARDlvQ3RPVlJZAaDZAMM2twVU1acnBCWQZDZD'

def set_instagram_token():
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    print(f"Setting Instagram token for tenant: {PLATFORM_TENANT_ID}")
    
    table.put_item(Item={
        'tenant_id': PLATFORM_TENANT_ID,
        'enabled': True,
        'accessToken': ACCESS_TOKEN,
        'accountId': '',  # Will be fetched from API
        'accountName': 'Test Account'
    })
    
    print("✅ Instagram token saved!")

if __name__ == '__main__':
    set_instagram_token()
