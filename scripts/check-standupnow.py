import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')

# Check tenant
tenants_table = dynamodb.Table('viraltenant-tenants-production')
response = tenants_table.scan(
    FilterExpression='subdomain = :s',
    ExpressionAttributeValues={':s': 'standupnow'}
)
print("Standupnow tenant:")
for item in response.get('Items', []):
    print(f"  tenant_id: {item.get('tenant_id')}")
    print(f"  subdomain: {item.get('subdomain')}")
    print(f"  custom_domain: {item.get('custom_domain')}")

# Get the tenant_id
tenant_id = response['Items'][0]['tenant_id'] if response.get('Items') else None
print(f"\nTenant ID: {tenant_id}")

# Check user_tenants for this tenant
if tenant_id:
    user_tenants_table = dynamodb.Table('viraltenant-user-tenants-production')
    response2 = user_tenants_table.scan(
        FilterExpression='tenant_id = :t',
        ExpressionAttributeValues={':t': tenant_id}
    )
    print(f"\nUsers with access to tenant {tenant_id}:")
    for item in response2.get('Items', []):
        print(f"  user_id: {item.get('user_id')}, role: {item.get('role')}")
