#!/usr/bin/env python3
"""
Script zum Hinzufügen von Lifecycle-Schutz zu kritischen Terraform-Ressourcen
"""

import os
import re
from pathlib import Path

# Ressourcen die geschützt werden sollen
PROTECT_RESOURCES = {
    'aws_s3_bucket': {
        'prevent_destroy': True,
        'ignore_changes': ['tags', 'tags_all', 'bucket']
    },
    'aws_dynamodb_table': {
        'prevent_destroy': True,
        'ignore_changes': ['tags', 'tags_all']
    },
    'aws_cognito_user_pool': {
        'prevent_destroy': True,
        'ignore_changes': ['tags', 'tags_all', 'schema']
    },
    'aws_ivs_channel': {
        'prevent_destroy': True,
        'ignore_changes': ['tags', 'tags_all']
    },
    'aws_lambda_function': {
        'ignore_changes': ['source_code_hash', 'last_modified']
    }
}

def has_lifecycle_block(content, resource_start):
    """Prüft ob Ressource bereits einen lifecycle-Block hat"""
    # Finde das Ende der Ressource
    brace_count = 0
    in_resource = False
    
    for i in range(resource_start, len(content)):
        char = content[i]
        if char == '{':
            brace_count += 1
            in_resource = True
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and in_resource:
                # Ende der Ressource gefunden
                resource_content = content[resource_start:i+1]
                return 'lifecycle' in resource_content
    
    return False

def generate_lifecycle_block(resource_type, indent='  '):
    """Generiert lifecycle-Block für Ressourcentyp"""
    config = PROTECT_RESOURCES.get(resource_type, {})
    
    if not config:
        return ''
    
    lines = [f'{indent}lifecycle {{']
    
    if config.get('prevent_destroy'):
        lines.append(f'{indent}  prevent_destroy = true')
    
    if config.get('ignore_changes'):
        lines.append(f'{indent}  ignore_changes = [{", ".join(config["ignore_changes"])}]')
    
    lines.append(f'{indent}}}')
    
    return '\n'.join(lines)

def add_lifecycle_to_file(filepath):
    """Fügt lifecycle-Blöcke zu Datei hinzu"""
    print(f'\nPrüfe: {filepath}')
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    new_content = content
    
    # Finde alle Ressourcen
    for resource_type in PROTECT_RESOURCES.keys():
        pattern = rf'resource\s+"{resource_type}"\s+"[^"]+"\s+{{'
        
        for match in re.finditer(pattern, content):
            resource_start = match.start()
            
            # Prüfe ob bereits lifecycle vorhanden
            if has_lifecycle_block(content, resource_start):
                print(f'  ✓ {resource_type} hat bereits lifecycle-Block')
                continue
            
            # Finde Einfügepunkt (nach der öffnenden Klammer)
            insert_pos = match.end()
            
            # Generiere lifecycle-Block
            lifecycle_block = '\n' + generate_lifecycle_block(resource_type) + '\n'
            
            # Füge ein
            new_content = new_content[:insert_pos] + lifecycle_block + new_content[insert_pos:]
            modified = True
            print(f'  + Lifecycle-Block zu {resource_type} hinzugefügt')
    
    if modified:
        # Backup erstellen
        backup_path = f'{filepath}.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  💾 Backup erstellt: {backup_path}')
        
        # Neue Datei schreiben
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'  ✅ Datei aktualisiert')
    else:
        print(f'  ℹ️  Keine Änderungen nötig')
    
    return modified

def main():
    """Hauptfunktion"""
    print('=' * 60)
    print('Terraform Lifecycle Protection Script')
    print('=' * 60)
    
    # Finde alle .tf Dateien
    terraform_dir = Path(__file__).parent.parent
    tf_files = list(terraform_dir.glob('**/*.tf'))
    
    print(f'\nGefunden: {len(tf_files)} Terraform-Dateien')
    
    modified_files = []
    
    for tf_file in tf_files:
        # Überspringe .terraform Verzeichnis
        if '.terraform' in str(tf_file):
            continue
        
        if add_lifecycle_to_file(tf_file):
            modified_files.append(tf_file)
    
    print('\n' + '=' * 60)
    print('Zusammenfassung')
    print('=' * 60)
    print(f'\nModifizierte Dateien: {len(modified_files)}')
    
    if modified_files:
        print('\nGeänderte Dateien:')
        for f in modified_files:
            print(f'  - {f.relative_to(terraform_dir)}')
        
        print('\n⚠️  WICHTIG:')
        print('  1. Prüfe die Änderungen mit: git diff')
        print('  2. Teste mit: terraform plan')
        print('  3. Backups wurden erstellt (.backup Dateien)')
    else:
        print('\n✅ Alle Dateien sind bereits geschützt!')

if __name__ == '__main__':
    main()
