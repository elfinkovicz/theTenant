import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-tenants-production')

response = table.get_item(Key={'tenant_id': 'ab5b624a-0707-48d4-bafb-e59f3276aece'})
item = response.get('Item', {})

print("Mollie Connect Status:")
print(f"  Status: {item.get('mollie_connect_status')}")
print(f"  Organization: {item.get('mollie_connect_organization_name')}")
print(f"  Profile ID: {item.get('mollie_profile_id', 'NICHT GESETZT')}")
print(f"  Access Token: {'Vorhanden' if item.get('mollie_connect_access_token') else 'Fehlt'}")
