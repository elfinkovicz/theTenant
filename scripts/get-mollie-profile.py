import boto3
import requests

dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
table = dynamodb.Table('viraltenant-tenants-production')

# Tenant holen
response = table.get_item(Key={'tenant_id': 'ab5b624a-0707-48d4-bafb-e59f3276aece'})
item = response.get('Item', {})

access_token = item.get('mollie_connect_access_token')
if not access_token:
    print("Kein Access Token!")
    exit(1)

# Profile von Mollie holen
resp = requests.get(
    'https://api.mollie.com/v2/profiles',
    headers={'Authorization': f'Bearer {access_token}'}
)

if resp.status_code == 200:
    data = resp.json()
    profiles = data.get('_embedded', {}).get('profiles', [])
    if profiles:
        for p in profiles:
            print(f"Profile: {p['id']} - {p['name']} ({p['status']})")
        
        # Erstes Profil in DB speichern
        profile_id = profiles[0]['id']
        table.update_item(
            Key={'tenant_id': 'ab5b624a-0707-48d4-bafb-e59f3276aece'},
            UpdateExpression='SET mollie_profile_id = :pid',
            ExpressionAttributeValues={':pid': profile_id}
        )
        print(f"\nProfile ID {profile_id} in DB gespeichert!")
    else:
        print("Keine Profile gefunden!")
        print("Der Creator muss im Mollie Dashboard ein Website-Profil anlegen:")
        print("https://my.mollie.com/dashboard/settings/profiles")
else:
    print(f"Fehler: {resp.status_code}")
    print(resp.text)
