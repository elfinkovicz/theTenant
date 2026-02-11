import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-tiktok-settings-production')

# Reset terms acceptance for platform tenant
response = table.update_item(
    Key={'tenant_id': 'platform'},
    UpdateExpression='SET termsAccepted = :ta, termsAcceptedAt = :tat',
    ExpressionAttributeValues={
        ':ta': False,
        ':tat': ''
    },
    ReturnValues='ALL_NEW'
)

print('TikTok terms reset for platform tenant:')
print(f"  termsAccepted: {response['Attributes'].get('termsAccepted')}")
print(f"  termsAcceptedAt: {response['Attributes'].get('termsAcceptedAt')}")
