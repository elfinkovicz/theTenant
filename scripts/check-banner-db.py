import boto3
import json

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-tenant-frontend-production')

# Get standupnow tenant frontend data
response = table.get_item(Key={'tenant_id': 'ab5b624a-0707-48d4-bafb-e59f3276aece'})

if 'Item' in response:
    item = response['Item']
    print("Tenant Frontend Data:")
    print(f"  tenant_id: {item.get('tenant_id')}")
    print(f"  updated_at: {item.get('updated_at')}")
    
    page_banners = item.get('page_banners', {})
    print(f"\nPage Banners ({len(page_banners)} total):")
    for page_id, banner in page_banners.items():
        print(f"\n  {page_id}:")
        print(f"    overlay_opacity: {banner.get('overlay_opacity')}")
        print(f"    blur: {banner.get('blur')}")
        print(f"    banner_url: {banner.get('banner_url', 'none')[:50]}...")
        print(f"    updated_at: {banner.get('updated_at')}")
else:
    print("No data found for standupnow tenant")
