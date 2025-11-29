#!/usr/bin/env python3
"""
Bereitet alle Lambda-Funktionen vor (installiert Dependencies)
"""

import os
import sys
import json
import subprocess
from pathlib import Path


class Colors:
    BLUE = '\033[0;34m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'


def log_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.NC}")


def log_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.NC}")


def log_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.NC}")


def log_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.NC}")


def run_npm_install(lambda_dir, package_name=None):
    """Installiert npm Dependencies für Lambda"""
    lambda_path = Path(lambda_dir)
    
    if not lambda_path.exists():
        log_warning(f"Lambda-Verzeichnis nicht gefunden: {lambda_dir}")
        return False
    
    package_json = lambda_path / "package.json"
    
    # Erstelle package.json wenn nicht vorhanden
    if not package_json.exists() and package_name:
        log_info(f"Erstelle package.json für {package_name}...")
        package_data = {
            "name": package_name,
            "version": "1.0.0",
            "dependencies": {}
        }
        
        # Füge spezifische Dependencies hinzu
        if "ivs-chat" in package_name:
            package_data["dependencies"]["@aws-sdk/client-ivschat"] = "^3.0.0"
        elif "shop" in package_name:
            package_data["dependencies"]["stripe"] = "^14.0.0"
        
        with open(package_json, 'w') as f:
            json.dump(package_data, f, indent=2)
    
    # Installiere Dependencies
    if package_json.exists():
        log_info(f"Installiere Dependencies für {lambda_path.name}...")
        try:
            # Verwende shell=True für Windows-Kompatibilität
            subprocess.run(
                "npm install --production",
                cwd=lambda_path,
                check=True,
                capture_output=True,
                shell=True
            )
            return True
        except subprocess.CalledProcessError as e:
            log_error(f"npm install fehlgeschlagen: {e}")
            return False
        except FileNotFoundError:
            log_warning(f"npm nicht gefunden - überspringe {lambda_path.name}")
            log_info("Terraform wird Lambda-Pakete ohne node_modules erstellen")
            return True
    
    return True


def prepare_lambdas():
    """Bereitet alle Lambda-Funktionen vor"""
    print()
    log_info("🔧 Bereite Lambda-Funktionen vor...")
    print()
    
    # Wechsle zum Terraform-Verzeichnis
    script_dir = Path(__file__).parent
    terraform_dir = script_dir.parent
    os.chdir(terraform_dir)
    
    success_count = 0
    total_count = 0
    
    # Lambda-Funktionen mit Dependencies
    lambdas_with_deps = [
        {
            "path": "modules/ivs-chat/lambda",
            "name": "ivs-chat-token-lambda",
            "description": "IVS Chat Lambda"
        },
        {
            "path": "modules/shop/lambda",
            "name": "shop-lambda",
            "description": "Shop Lambda"
        }
    ]
    
    # Lambda-Funktionen ohne Dependencies
    lambdas_without_deps = [
        "Contact Form Lambda",
        "Event Management Lambda",
        "Team Management Lambda",
        "Video Management Lambda",
        "User Auth Lambda",
        "Sponsor System Lambda",
        "Advertisement Management Lambda"
    ]
    
    # Bereite Lambdas mit Dependencies vor
    for lambda_config in lambdas_with_deps:
        total_count += 1
        log_info(f"📦 {lambda_config['description']}...")
        
        if run_npm_install(lambda_config["path"], lambda_config["name"]):
            log_success(f"{lambda_config['description']} bereit")
            success_count += 1
        else:
            log_error(f"{lambda_config['description']} fehlgeschlagen")
        print()
    
    # Lambdas ohne Dependencies
    for lambda_name in lambdas_without_deps:
        total_count += 1
        log_success(f"{lambda_name} bereit (keine Dependencies)")
        success_count += 1
    
    print()
    
    if success_count == total_count:
        log_success(f"🎉 Alle {total_count} Lambda-Funktionen sind bereit!")
        return True
    else:
        log_warning(f"⚠️  {success_count}/{total_count} Lambda-Funktionen bereit")
        return False


def main():
    """Hauptfunktion"""
    try:
        success = prepare_lambdas()
        sys.exit(0 if success else 1)
    except Exception as e:
        log_error(f"Fehler: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
