import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-tenants-production')

tenant_id = '319190e1-0791-43b0-bd04-506f959c1471'

print(f'Checking tenant: {tenant_id}')
response = table.get_item(Key={'tenant_id': tenant_id})

if 'Item' in response:
    print('Tenant found:')
    item = response['Item']
    print(f'  tenant_id: {item.get("tenant_id")}')
    print(f'  subdomain: {item.get("subdomain")}')
    print(f'  status: {item.get("status")}')
    print(f'  custom_pages: {item.get("custom_pages", "NOT SET")}')
    print(f'  All keys: {list(item.keys())}')
else:
    print('Tenant NOT found in DynamoDB!')
