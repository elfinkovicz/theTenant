import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-tiktok-settings-production')

# Scan all items
response = table.scan()
print('All TikTok settings entries:')
for item in response.get('Items', []):
    print(f"tenant_id: {item.get('tenant_id')}")
    print(f"  termsAccepted: {item.get('termsAccepted')}")
    print(f"  termsAcceptedAt: {item.get('termsAcceptedAt')}")
    print()

if not response.get('Items'):
    print('No entries found!')
