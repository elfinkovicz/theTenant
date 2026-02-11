#!/usr/bin/env python3
"""
Check available Mollie payment methods for the account
"""

import requests
import json

# Mollie Live API Key
MOLLIE_API_KEY = 'live_89PzvdbdNMgtudtDdkF8wCGQB5G7r5'
MOLLIE_BASE_URL = 'https://api.mollie.com/v2'

def check_payment_methods():
    """Check all available payment methods"""
    headers = {
        'Authorization': f'Bearer {MOLLIE_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    print("🔍 Checking Mollie Payment Methods...")
    print("=" * 60)
    
    # Get all methods (including inactive)
    response = requests.get(
        f'{MOLLIE_BASE_URL}/methods/all',
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    methods = data.get('_embedded', {}).get('methods', [])
    
    print(f"\n📋 All Payment Methods ({len(methods)} total):\n")
    
    # Group by status
    active = []
    inactive = []
    pending = []
    
    for method in methods:
        method_id = method.get('id')
        description = method.get('description')
        status = method.get('status', 'unknown')
        
        info = {
            'id': method_id,
            'description': description,
            'status': status,
            'min': method.get('minimumAmount', {}).get('value'),
            'max': method.get('maximumAmount', {}).get('value') if method.get('maximumAmount') else 'unlimited'
        }
        
        if status == 'activated':
            active.append(info)
        elif status == 'pending-boarding':
            pending.append(info)
        else:
            inactive.append(info)
    
    print("✅ ACTIVE Methods:")
    for m in active:
        print(f"   • {m['id']:20} - {m['description']}")
        print(f"     Min: {m['min']} EUR, Max: {m['max']}")
    
    if pending:
        print(f"\n⏳ PENDING Methods (need activation):")
        for m in pending:
            print(f"   • {m['id']:20} - {m['description']} [{m['status']}]")
    
    if inactive:
        print(f"\n❌ INACTIVE Methods:")
        for m in inactive:
            print(f"   • {m['id']:20} - {m['description']} [{m['status']}]")
    
    # Specifically check for TWINT
    print("\n" + "=" * 60)
    print("🔍 TWINT Status:")
    twint = next((m for m in methods if m.get('id') == 'twint'), None)
    if twint:
        print(f"   ID: {twint.get('id')}")
        print(f"   Description: {twint.get('description')}")
        print(f"   Status: {twint.get('status')}")
        if twint.get('status') != 'activated':
            print(f"   ⚠️ TWINT is not activated! You need to enable it in Mollie Dashboard.")
    else:
        print("   ❌ TWINT not found in available methods")
        print("   ⚠️ TWINT might not be available for your account/region")

def check_profile():
    """Check profile info"""
    headers = {
        'Authorization': f'Bearer {MOLLIE_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    print("\n" + "=" * 60)
    print("👤 Profile Info:")
    
    response = requests.get(
        f'{MOLLIE_BASE_URL}/profiles/me',
        headers=headers
    )
    
    if response.status_code == 200:
        profile = response.json()
        print(f"   Name: {profile.get('name')}")
        print(f"   Email: {profile.get('email')}")
        print(f"   Mode: {profile.get('mode')}")
        print(f"   Status: {profile.get('status')}")
        print(f"   Review: {profile.get('review', {}).get('status', 'N/A')}")
    else:
        print(f"   Error: {response.status_code}")

if __name__ == '__main__':
    check_payment_methods()
    check_profile()
