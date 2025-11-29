#!/usr/bin/env python3
import os
import re

# Pfad zum public-Ordner
public_dir = "public"

# Alle HTML-Dateien im public-Ordner
html_files = [f for f in os.listdir(public_dir) if f.endswith('.html')]

for filename in html_files:
    filepath = os.path.join(public_dir, filename)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Ersetze CSS-Pfade
    content = re.sub(r'href="css/', r'href="../src/css/', content)
    
    # Ersetze JS-Pfade
    content = re.sub(r'src="js/', r'src="../src/js/', content)
    
    # Ersetze "Honigwabe LIVE" mit "Creator Platform"
    content = content.replace('Honigwabe LIVE', 'Creator Platform')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Fixed: {filename}")

print("\n🎉 All files fixed!")
