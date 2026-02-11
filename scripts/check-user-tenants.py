import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-user-tenants-production')

# Check entries for the user
user_id = 'e3f41812-b041-708a-6c0c-5ab0d8370058'
response = table.query(
    KeyConditionExpression='user_id = :uid',
    ExpressionAttributeValues={':uid': user_id}
)

print('User tenant entries for email@nielsfink.de:')
for item in response.get('Items', []):
    print(f"  - tenant_id: {item.get('tenant_id')}")
    print(f"    role: {item.get('role')}")
    print(f"    email: {item.get('email')}")
    print()

if not response.get('Items'):
    print('No entries found!')
