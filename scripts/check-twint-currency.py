#!/usr/bin/env python3
"""
Check TWINT availability based on currency
TWINT is only available for CHF (Swiss Francs), not EUR
"""

import requests
import json

MOLLIE_API_KEY = 'live_89PzvdbdNMgtudtDdkF8wCGQB5G7r5'
MOLLIE_BASE_URL = 'https://api.mollie.com/v2'

def check_methods_for_currency(currency, amount='2.00'):
    """Check available payment methods for a specific currency and amount"""
    headers = {
        'Authorization': f'Bearer {MOLLIE_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    print(f"\n🔍 Checking payment methods for {currency} {amount}...")
    print("=" * 60)
    
    # Get methods available for this specific amount/currency
    response = requests.get(
        f'{MOLLIE_BASE_URL}/methods',
        headers=headers,
        params={
            'amount[value]': amount,
            'amount[currency]': currency,
            'includeWallets': 'applepay'
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    methods = data.get('_embedded', {}).get('methods', [])
    
    print(f"\n✅ Available methods for {currency} {amount}:")
    for method in methods:
        print(f"   • {method.get('id'):20} - {method.get('description')}")
    
    # Check if TWINT is in the list
    twint = next((m for m in methods if m.get('id') == 'twint'), None)
    if twint:
        print(f"\n🎉 TWINT IS AVAILABLE for {currency}!")
    else:
        print(f"\n❌ TWINT is NOT available for {currency}")

if __name__ == '__main__':
    print("=" * 60)
    print("TWINT Currency Test")
    print("=" * 60)
    
    # Test with EUR (current setting)
    check_methods_for_currency('EUR', '2.00')
    
    # Test with CHF (required for TWINT)
    check_methods_for_currency('CHF', '2.00')
    
    print("\n" + "=" * 60)
    print("CONCLUSION:")
    print("=" * 60)
    print("TWINT is a Swiss payment method and ONLY works with CHF!")
    print("To enable TWINT, you need to:")
    print("1. Set shop currency to CHF, OR")
    print("2. Allow customers to select CHF as payment currency")
    print("=" * 60)
