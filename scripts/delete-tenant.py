#!/usr/bin/env python3
"""
Tenant Lösch-Skript für Testzwecke
Löscht alle Daten eines Cognito Users und ALLER Tenants wo er Admin ist:
- Cognito User
- Alle DynamoDB Tenant-Einträge wo User Admin ist
- Alle DynamoDB User-Tenant-Beziehungen
- Alle S3 Ordnerstrukturen
- Alle Route 53 Subdomains
- Alle AWS IVS Channels und Chat Rooms
- Alle Invoices
- Alle Verification Codes
"""

import boto3
import sys
from botocore.exceptions import ClientError

# Konfiguration
REGION = "eu-central-1"
USER_POOL_ID = "eu-central-1_4mUqVJrm2"
TENANTS_TABLE = "viraltenant-tenants-production"
USER_TENANTS_TABLE = "viraltenant-user-tenants-production"
TENANT_LIVE_TABLE = "viraltenant-tenant-live-production"
INVOICES_TABLE = "viraltenant-invoices-production"
VERIFICATION_TABLE = "viraltenant-email-verification-production"
CREATOR_ASSETS_BUCKET = "viraltenant-creator-assets-production"
HOSTED_ZONE_ID = "Z038248814K1ECJCOM0GL"
PLATFORM_DOMAIN = "viraltenant.com"

# AWS Clients
cognito = boto3.client('cognito-idp', region_name=REGION)
dynamodb = boto3.resource('dynamodb', region_name=REGION)
dynamodb_client = boto3.client('dynamodb', region_name=REGION)
s3 = boto3.client('s3', region_name=REGION)
route53 = boto3.client('route53', region_name=REGION)
ivs = boto3.client('ivs', region_name=REGION)
ivschat = boto3.client('ivschat', region_name=REGION)

def get_user_id(email):
    """Hole User ID aus Cognito"""
    try:
        response = cognito.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        for attr in response['UserAttributes']:
            if attr['Name'] == 'sub':
                return attr['Value']
    except ClientError as e:
        if e.response['Error']['Code'] == 'UserNotFoundException':
            print(f"⚠️  Cognito User nicht gefunden: {email}")
            return None
        raise
    return None

def get_tenant_by_email(email):
    """Finde Tenant anhand der Creator-Email"""
    table = dynamodb.Table(TENANTS_TABLE)
    try:
        response = table.query(
            IndexName='creator-email-index',
            KeyConditionExpression='creator_email = :email',
            ExpressionAttributeValues={':email': email}
        )
        if response['Items']:
            return response['Items'][0]
    except ClientError as e:
        print(f"⚠️  Fehler beim Suchen des Tenants: {e}")
    return None

def get_all_tenants_for_user(user_id):
    """Finde alle Tenants wo der User Admin ist"""
    table = dynamodb.Table(USER_TENANTS_TABLE)
    tenants = []
    try:
        response = table.query(
            KeyConditionExpression='user_id = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        for item in response.get('Items', []):
            if item.get('role') == 'admin':
                tenant_id = item.get('tenant_id')
                # Hole Tenant-Details
                tenant_table = dynamodb.Table(TENANTS_TABLE)
                tenant_response = tenant_table.get_item(Key={'tenant_id': tenant_id})
                if 'Item' in tenant_response:
                    tenants.append(tenant_response['Item'])
    except ClientError as e:
        print(f"⚠️  Fehler beim Suchen der User-Tenants: {e}")
    return tenants

def delete_cognito_user(email):
    """Lösche Cognito User"""
    try:
        cognito.admin_delete_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        print(f"✅ Cognito User gelöscht: {email}")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'UserNotFoundException':
            print(f"⚠️  Cognito User existiert nicht: {email}")
            return True
        print(f"❌ Fehler beim Löschen des Cognito Users: {e}")
        return False

def delete_tenant_record(tenant_id):
    """Lösche Tenant aus DynamoDB"""
    table = dynamodb.Table(TENANTS_TABLE)
    try:
        table.delete_item(Key={'tenant_id': tenant_id})
        print(f"✅ Tenant-Eintrag gelöscht: {tenant_id}")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen des Tenant-Eintrags: {e}")
        return False

def delete_user_tenant_relation(user_id, tenant_id):
    """Lösche User-Tenant-Beziehung aus DynamoDB"""
    table = dynamodb.Table(USER_TENANTS_TABLE)
    try:
        table.delete_item(Key={'user_id': user_id, 'tenant_id': tenant_id})
        print(f"✅ User-Tenant-Beziehung gelöscht: {tenant_id}")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen der User-Tenant-Beziehung: {e}")
        return False

def delete_all_user_tenant_relations(user_id):
    """Lösche alle User-Tenant-Beziehungen für einen User"""
    table = dynamodb.Table(USER_TENANTS_TABLE)
    try:
        response = table.query(
            KeyConditionExpression='user_id = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        for item in response.get('Items', []):
            table.delete_item(Key={'user_id': user_id, 'tenant_id': item['tenant_id']})
            print(f"✅ User-Tenant-Beziehung gelöscht: {item['tenant_id']}")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen der User-Tenant-Beziehungen: {e}")
        return False

def delete_s3_folder(tenant_id):
    """Lösche S3 Ordnerstruktur des Tenants"""
    prefix = f"tenants/{tenant_id}/"
    try:
        paginator = s3.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=CREATOR_ASSETS_BUCKET, Prefix=prefix)
        
        objects_to_delete = []
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    objects_to_delete.append({'Key': obj['Key']})
        
        if objects_to_delete:
            # Delete in batches of 1000 (S3 limit)
            for i in range(0, len(objects_to_delete), 1000):
                batch = objects_to_delete[i:i+1000]
                s3.delete_objects(
                    Bucket=CREATOR_ASSETS_BUCKET,
                    Delete={'Objects': batch}
                )
            print(f"✅ S3 Ordner gelöscht: {len(objects_to_delete)} Objekte für {tenant_id}")
        else:
            print(f"⚠️  Keine S3 Objekte gefunden für Tenant: {tenant_id}")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen des S3 Ordners: {e}")
        return False

def delete_route53_record(subdomain):
    """Lösche Route 53 Subdomain-Eintrag"""
    record_name = f"{subdomain}.{PLATFORM_DOMAIN}"
    try:
        response = route53.list_resource_record_sets(
            HostedZoneId=HOSTED_ZONE_ID,
            StartRecordName=record_name,
            StartRecordType='A',
            MaxItems='1'
        )
        
        records = response.get('ResourceRecordSets', [])
        if not records or records[0]['Name'] != f"{record_name}.":
            print(f"⚠️  Route 53 Record existiert nicht: {record_name}")
            return True
        
        record = records[0]
        
        route53.change_resource_record_sets(
            HostedZoneId=HOSTED_ZONE_ID,
            ChangeBatch={
                'Comment': f'Delete subdomain {subdomain}',
                'Changes': [{
                    'Action': 'DELETE',
                    'ResourceRecordSet': record
                }]
            }
        )
        print(f"✅ Route 53 Record gelöscht: {record_name}")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen des Route 53 Records: {e}")
        return False

def get_ivs_resources(tenant_id):
    """Hole AWS IVS Ressourcen für einen Tenant"""
    table = dynamodb.Table(TENANT_LIVE_TABLE)
    try:
        response = table.get_item(Key={'tenant_id': tenant_id})
        if 'Item' in response:
            item = response['Item']
            return {
                'channel_arn': item.get('ivs_channel_arn'),
                'chat_room_arn': item.get('ivs_chat_room_arn')
            }
    except ClientError as e:
        print(f"⚠️  Fehler beim Abrufen der IVS Ressourcen: {e}")
    return {'channel_arn': None, 'chat_room_arn': None}

def delete_ivs_channel(channel_arn):
    """Lösche AWS IVS Channel"""
    if not channel_arn:
        return True
    
    try:
        ivs.delete_channel(arn=channel_arn)
        print(f"✅ AWS IVS Channel gelöscht")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"⚠️  IVS Channel existiert nicht")
            return True
        print(f"❌ Fehler beim Löschen des IVS Channels: {e}")
        return False

def delete_ivs_chat_room(chat_room_arn):
    """Lösche AWS IVS Chat Room"""
    if not chat_room_arn:
        return True
    
    try:
        ivschat.delete_room(identifier=chat_room_arn)
        print(f"✅ AWS IVS Chat Room gelöscht")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"⚠️  IVS Chat Room existiert nicht")
            return True
        print(f"❌ Fehler beim Löschen des IVS Chat Rooms: {e}")
        return False

def delete_tenant_live_record(tenant_id):
    """Lösche Tenant-Live-Eintrag aus DynamoDB"""
    table = dynamodb.Table(TENANT_LIVE_TABLE)
    try:
        table.delete_item(Key={'tenant_id': tenant_id})
        print(f"✅ Tenant-Live-Eintrag gelöscht")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen des Tenant-Live-Eintrags: {e}")
        return False

def delete_invoices_for_tenant(tenant_id):
    """Lösche alle Rechnungen für einen Tenant"""
    table = dynamodb.Table(INVOICES_TABLE)
    try:
        # Scan for invoices with this tenant_id
        response = table.scan(
            FilterExpression='tenant_id = :tid',
            ExpressionAttributeValues={':tid': tenant_id}
        )
        
        deleted_count = 0
        for item in response.get('Items', []):
            table.delete_item(Key={'invoice_id': item['invoice_id']})
            deleted_count += 1
        
        if deleted_count > 0:
            print(f"✅ {deleted_count} Rechnungen gelöscht für Tenant: {tenant_id}")
        return True
    except ClientError as e:
        print(f"❌ Fehler beim Löschen der Rechnungen: {e}")
        return False

def delete_verification_code(email):
    """Lösche Verifizierungscode für eine E-Mail"""
    table = dynamodb.Table(VERIFICATION_TABLE)
    try:
        table.delete_item(Key={'email': email})
        print(f"✅ Verifizierungscode gelöscht für: {email}")
        return True
    except ClientError as e:
        print(f"⚠️  Fehler beim Löschen des Verifizierungscodes: {e}")
        return True  # Not critical

def delete_single_tenant(tenant, user_id):
    """Lösche einen einzelnen Tenant und alle zugehörigen Ressourcen"""
    tenant_id = tenant['tenant_id']
    subdomain = tenant.get('subdomain')
    
    print(f"\n   🗑️  Lösche Tenant: {subdomain}.{PLATFORM_DOMAIN}")
    print(f"      ID: {tenant_id}")
    
    success = True
    
    # IVS Ressourcen
    ivs_resources = get_ivs_resources(tenant_id)
    if not delete_ivs_chat_room(ivs_resources['chat_room_arn']):
        success = False
    if not delete_ivs_channel(ivs_resources['channel_arn']):
        success = False
    if not delete_tenant_live_record(tenant_id):
        success = False
    
    # Route 53
    if subdomain:
        if not delete_route53_record(subdomain):
            success = False
    
    # S3
    if not delete_s3_folder(tenant_id):
        success = False
    
    # Invoices
    if not delete_invoices_for_tenant(tenant_id):
        success = False
    
    # User-Tenant-Beziehung
    if user_id:
        if not delete_user_tenant_relation(user_id, tenant_id):
            success = False
    
    # Tenant-Eintrag
    if not delete_tenant_record(tenant_id):
        success = False
    
    return success

def main():
    if len(sys.argv) < 2:
        print("Verwendung: python delete-tenant.py <email>")
        print("Beispiel:   python delete-tenant.py test@example.com")
        print("\nDieses Skript löscht:")
        print("  - Den Cognito User")
        print("  - ALLE Tenants wo der User Admin ist")
        print("  - Alle zugehörigen AWS Ressourcen (IVS, S3, Route53)")
        print("  - Alle Rechnungen und Verifizierungscodes")
        sys.exit(1)
    
    email = sys.argv[1]
    
    print(f"\n🔍 Suche Daten für E-Mail: {email}")
    print("=" * 60)
    
    # 1. User ID aus Cognito holen
    user_id = get_user_id(email)
    
    # 2. Tenant direkt über E-Mail finden
    direct_tenant = get_tenant_by_email(email)
    
    # 3. Alle Tenants wo User Admin ist
    admin_tenants = []
    if user_id:
        admin_tenants = get_all_tenants_for_user(user_id)
    
    # Kombiniere beide Listen (ohne Duplikate)
    all_tenants = []
    tenant_ids_seen = set()
    
    if direct_tenant:
        all_tenants.append(direct_tenant)
        tenant_ids_seen.add(direct_tenant['tenant_id'])
    
    for tenant in admin_tenants:
        if tenant['tenant_id'] not in tenant_ids_seen:
            all_tenants.append(tenant)
            tenant_ids_seen.add(tenant['tenant_id'])
    
    if not all_tenants and not user_id:
        print(f"❌ Keine Daten gefunden für E-Mail: {email}")
        sys.exit(1)
    
    # Zusammenfassung anzeigen
    print(f"\n👤 Cognito User:")
    if user_id:
        print(f"   - User ID: {user_id}")
        print(f"   - E-Mail: {email}")
    else:
        print(f"   - Nicht gefunden")
    
    print(f"\n📋 Gefundene Tenants: {len(all_tenants)}")
    for tenant in all_tenants:
        subdomain = tenant.get('subdomain', 'N/A')
        print(f"   - {subdomain}.{PLATFORM_DOMAIN}")
        print(f"     ID: {tenant['tenant_id']}")
        print(f"     Creator: {tenant.get('creator_name', 'N/A')}")
        
        # IVS Ressourcen
        ivs_resources = get_ivs_resources(tenant['tenant_id'])
        if ivs_resources['channel_arn']:
            print(f"     IVS Channel: ✓")
        if ivs_resources['chat_room_arn']:
            print(f"     IVS Chat: ✓")
        
        # S3 Objekte zählen
        prefix = f"tenants/{tenant['tenant_id']}/"
        try:
            paginator = s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=CREATOR_ASSETS_BUCKET, Prefix=prefix)
            s3_count = sum(len(page.get('Contents', [])) for page in pages)
            print(f"     S3 Objekte: {s3_count}")
        except:
            pass
    
    # Bestätigung
    print("\n" + "=" * 60)
    print("⚠️  WARNUNG: Dies löscht ALLE oben aufgeführten Daten unwiderruflich!")
    print("=" * 60)
    
    confirm = input("\nMöchten Sie fortfahren? (ja/nein): ")
    if confirm.lower() != 'ja':
        print("Abgebrochen.")
        sys.exit(0)
    
    # Löschen
    print(f"\n🗑️  Lösche alle Daten...")
    print("-" * 60)
    
    success = True
    
    # Alle Tenants löschen
    for tenant in all_tenants:
        if not delete_single_tenant(tenant, user_id):
            success = False
    
    # Verifizierungscode löschen
    delete_verification_code(email)
    
    # Cognito User löschen (am Ende)
    if user_id:
        if not delete_cognito_user(email):
            success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✅ Alle Daten erfolgreich gelöscht!")
    else:
        print("⚠️  Daten teilweise gelöscht (siehe Fehler oben)")

if __name__ == "__main__":
    main()
