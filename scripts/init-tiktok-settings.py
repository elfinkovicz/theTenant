#!/usr/bin/env python3
"""
Initialize empty TikTok settings for a tenant in DynamoDB
"""

import boto3
import sys

def init_tiktok_settings(tenant_id):
    """Create empty TikTok settings for a tenant"""
    dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
    table_name = 'viraltenant-tiktok-settings-production'
    
    try:
        table = dynamodb.Table(table_name)
        
        # Create empty settings
        item = {
            'tenant_id': tenant_id,
            'enabled': False,
            'accessToken': '',
            'refreshToken': '',
            'openId': '',
            'displayName': '',
            'avatarUrl': '',
            'expiresAt': 0,
            'postAsDraft': False,
            'defaultPrivacy': 'PUBLIC_TO_EVERYONE',
            'allowComment': False,
            'allowDuet': False,
            'allowStitch': False,
            'commercialContentEnabled': False,
            'brandOrganic': False,
            'brandedContent': False,
            'postsToday': 0,
            'postsLastReset': '',
            'termsAccepted': False,
            'termsAcceptedAt': '',
            'privacyLevelOptions': [],
            'maxVideoDuration': 600,
            'commentDisabledByCreator': False,
            'duetDisabledByCreator': False,
            'stitchDisabledByCreator': False
        }
        
        table.put_item(Item=item)
        
        print(f"\n✅ TikTok settings initialized for tenant: {tenant_id}")
        print("   All values reset to defaults.")
        return True
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) > 1:
        tenant_id = sys.argv[1]
        init_tiktok_settings(tenant_id)
    else:
        print("💡 Usage: python init-tiktok-settings.py <tenant_id>")
