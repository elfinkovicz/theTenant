#!/usr/bin/env python3
"""
ViralTenant Multi-Tenant Platform - Deployment Configuration
Passe die Werte in der Config-Klasse an und führe deploy.py aus
"""

import os
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    # python-dotenv not installed, will use system environment variables
    pass

class DeploymentConfig:
    """ViralTenant Multi-Tenant Platform Konfiguration"""
    
    def __init__(self):
        # ============================================
        # 🎯 PLATFORM GRUNDKONFIGURATION (ANPASSEN!)
        # ============================================
        
        # Platform Identität
        self.PLATFORM_NAME = "viraltenant"                    # Platform Name (lowercase)
        self.PLATFORM_DISPLAY_NAME = "ViralTenant"            # Anzeige-Name
        self.PLATFORM_DOMAIN = "viraltenant.com"             # Haupt-Domain
        self.API_DOMAIN = "api.viraltenant.com"              # API-Domain
        
        # AWS Konfiguration
        self.AWS_REGION = "eu-central-1"
        self.AWS_PROFILE = "viraltenant"                     # AWS CLI Profile Name
        self.ENVIRONMENT = "production"
        
        # Platform Admin
        self.PLATFORM_ADMIN_EMAIL = "admin@viraltenant.com"
        self.PLATFORM_CONTACT_EMAIL = "contact@viraltenant.com"
        
        # ============================================
        # 📧 KONTAKT & SUPPORT (ANPASSEN!)
        # ============================================
        
        # Support E-Mails
        self.CONTACT_EMAIL_RECIPIENT = "email@nielsfink.de"   # Empfänger für Kontaktformulare
        self.CONTACT_EMAIL_SENDER = f"noreply@{self.PLATFORM_DOMAIN}"
        
        # Platform Admins
        self.ADMIN_EMAILS = [
            "email@nielsfink.de",
            # Weitere Admin-Emails hier hinzufügen
        ]
        
        # ============================================
        # 🏗️ VERZEICHNISSE
        # ============================================
        
        # Haupt-Verzeichnisse
        self.INFRASTRUCTURE_DIR = "./viraltenant-infrastructure"  # Terraform Infrastructure
        self.FRONTEND_DIR = "./viraltenant-react"                # React Frontend
        
        # ============================================
        # 🌐 DNS & DOMAINS (ROUTE 53 KONFIGURATION)
        # ============================================
        
        # Route 53 DNS Management
        self.ENABLE_ROUTE53_DNS = True                        # Route 53 DNS aktivieren
        self.CREATE_ROUTE53_ZONE = True                       # Neue Zone erstellen
        self.ROUTE53_ZONE_ID = ""                            # Bestehende Zone ID (falls CREATE_ROUTE53_ZONE = False)
        
        # SSL Certificate Management
        self.ENABLE_SSL_CERTIFICATE = True                    # SSL Zertifikat über ACM erstellen
        self.SSL_CERTIFICATE_VALIDATION = "DNS"              # DNS oder EMAIL Validation
        
        # Domain Routing Configuration
        self.ENABLE_WILDCARD_SUBDOMAIN = True                # *.viraltenant.com für Creator Subdomains
        self.ENABLE_WWW_REDIRECT = True                       # www.viraltenant.com Weiterleitung
        self.ENABLE_API_SUBDOMAIN = True                      # api.viraltenant.com für API Gateway
        
        # E-Mail DNS Records
        self.ENABLE_MX_RECORDS = True                         # MX Records für E-Mail
        self.MX_RECORDS = [                                   # E-Mail Server Konfiguration
            "10 mail.viraltenant.com",
            "20 mail2.viraltenant.com"
        ]
        
        # Domain Verification Records
        self.ENABLE_TXT_RECORDS = True                        # TXT Records für Verification
        self.TXT_RECORDS = [                                  # Domain Verification Records
            "v=spf1 include:_spf.google.com ~all",           # SPF Record
            "google-site-verification=your-verification-code" # Google Site Verification
        ]
        
        # DNS TTL Settings
        self.DNS_TTL_DEFAULT = 300                            # Standard TTL für DNS Records
        self.DNS_TTL_MX = 300                                 # TTL für MX Records
        self.DNS_TTL_TXT = 300                                # TTL für TXT Records
        
        # ============================================
        # 🌐 CLOUDFRONT & CDN KONFIGURATION
        # ============================================
        
        # CloudFront Domain Aliases
        self.ENABLE_CLOUDFRONT_CUSTOM_DOMAINS = True         # Custom Domains für CloudFront aktivieren
        self.CLOUDFRONT_DOMAINS = [                          # Domains für CloudFront Distribution
            self.PLATFORM_DOMAIN,                            # viraltenant.com
            f"www.{self.PLATFORM_DOMAIN}",                   # www.viraltenant.com
            f"*.{self.PLATFORM_DOMAIN}"                      # *.viraltenant.com (Wildcard für Creator)
        ]
        
        # CloudFront SSL Certificate
        self.CLOUDFRONT_SSL_CERTIFICATE = "auto"             # "auto" = Route 53 SSL, "manual" = eigenes Zertifikat, "none" = CloudFront Standard
        self.CLOUDFRONT_SSL_CERTIFICATE_ARN = ""             # Manuelle SSL Certificate ARN (falls CLOUDFRONT_SSL_CERTIFICATE = "manual")
        
        # CloudFront Caching
        self.CLOUDFRONT_DEFAULT_TTL = 86400                  # Standard Cache TTL (1 Tag)
        self.CLOUDFRONT_MAX_TTL = 31536000                   # Maximum Cache TTL (1 Jahr)
        self.CLOUDFRONT_WEBSITE_TTL = 3600                   # Website Content TTL (1 Stunde)
        self.CLOUDFRONT_API_TTL = 0                          # API Calls TTL (kein Caching)
        
        # CloudFront Compression
        self.CLOUDFRONT_COMPRESSION = True                   # Gzip Compression aktivieren
        self.CLOUDFRONT_HTTP2 = True                         # HTTP/2 Support aktivieren
        
        # ============================================
        # 🗄️ DATABASE KONFIGURATION
        # ============================================
        
        self.ENABLE_POINT_IN_TIME_RECOVERY = True            # DynamoDB Point-in-Time Recovery
        self.ENABLE_DELETION_PROTECTION = False              # DynamoDB Deletion Protection
        
        # ============================================
        # 📦 STORAGE KONFIGURATION
        # ============================================
        
        self.ENABLE_VERSIONING = True                        # S3 Versioning
        self.ENABLE_ENCRYPTION = True                        # S3 Encryption
        
        # ============================================
        # 🔐 AUTH KONFIGURATION
        # ============================================
        
        self.ENABLE_MFA = False                              # Cognito MFA
        self.PASSWORD_POLICY = {                             # Cognito Password Policy
            "minimum_length": 8,
            "require_lowercase": True,
            "require_numbers": True,
            "require_symbols": False,
            "require_uppercase": True
        }
        
        # ============================================
        # 🚀 API KONFIGURATION
        # ============================================
        
        self.API_THROTTLE_RATE = 1000                        # API Gateway throttle rate
        self.API_THROTTLE_BURST = 2000                       # API Gateway throttle burst
        
        # ============================================
        # 📊 MONITORING
        # ============================================
        
        self.ENABLE_CLOUDWATCH_LOGS = True                   # CloudWatch Logs
        self.LOG_RETENTION_DAYS = 30                         # CloudWatch Log retention in days
        
        # ============================================
        # 🏷️ TAGS
        # ============================================
        
        self.TAGS = {
            "Platform": "ViralTenant",
            "Environment": self.ENVIRONMENT,
            "ManagedBy": "Terraform",
            "Type": "Multi-Tenant",
            "Domain": self.PLATFORM_DOMAIN
        }
        
        # ============================================
        # 📱 LEGACY CREATOR-SPEZIFISCHE WERTE
        # (Für Kompatibilität mit altem Code)
        # ============================================
        
        # Legacy Creator Values (für Kompatibilität)
        self.CREATOR_NAME = "viraltenant"
        self.CREATOR_DISPLAY_NAME = self.PLATFORM_DISPLAY_NAME
        self.DOMAIN_NAME = self.PLATFORM_DOMAIN
        self.WEBSITE_DOMAIN = f"www.{self.PLATFORM_DOMAIN}"
        self.ADMIN_EMAIL = self.PLATFORM_ADMIN_EMAIL
        self.CONTACT_EMAIL_DISPLAY = self.PLATFORM_CONTACT_EMAIL
    
    # ============================================
    # 🔧 METHODEN
    # ============================================
    
    def validate(self):
        """Validiert die Platform-Konfiguration"""
        errors = []
        
        if self.PLATFORM_NAME == "platform-name":
            errors.append("PLATFORM_NAME muss angepasst werden")
        
        if self.PLATFORM_DOMAIN == "platform.com":
            errors.append("PLATFORM_DOMAIN muss angepasst werden")
        
        if not self.PLATFORM_NAME.replace("-", "").replace("_", "").isalnum():
            errors.append("PLATFORM_NAME darf nur Buchstaben, Zahlen und Bindestriche enthalten")
        
        if self.PLATFORM_NAME != self.PLATFORM_NAME.lower():
            errors.append("PLATFORM_NAME muss lowercase sein")
        
        # Prüfe wichtige Verzeichnisse
        if not Path(self.INFRASTRUCTURE_DIR).exists():
            errors.append(f"Infrastructure Verzeichnis nicht gefunden: {self.INFRASTRUCTURE_DIR}")
        
        if not Path(self.FRONTEND_DIR).exists():
            errors.append(f"Frontend Verzeichnis nicht gefunden: {self.FRONTEND_DIR}")
        
        return errors
    
    def show(self):
        """Zeigt die Platform-Konfiguration an"""
        print("=" * 60)
        print("VIRALTENANT MULTI-TENANT PLATFORM CONFIGURATION")
        print("=" * 60)
        print()
        print("🎯 Platform:")
        print(f"  Name:                {self.PLATFORM_NAME}")
        print(f"  Display Name:        {self.PLATFORM_DISPLAY_NAME}")
        print(f"  Domain:              {self.PLATFORM_DOMAIN}")
        print(f"  API Domain:          {self.API_DOMAIN}")
        print()
        print("☁️ AWS:")
        print(f"  Region:              {self.AWS_REGION}")
        print(f"  Profile:             {self.AWS_PROFILE}")
        print(f"  Environment:         {self.ENVIRONMENT}")
        print()
        print("📧 E-Mail:")
        print(f"  Admin:               {self.PLATFORM_ADMIN_EMAIL}")
        print(f"  Contact:             {self.PLATFORM_CONTACT_EMAIL}")
        print(f"  Support:             {self.CONTACT_EMAIL_RECIPIENT}")
        print()
        print("🏗️ Verzeichnisse:")
        print(f"  Infrastructure:      {self.INFRASTRUCTURE_DIR}")
        print(f"  Frontend:            {self.FRONTEND_DIR}")
        print()
        print("🌐 DNS & Route 53:")
        print(f"  Route 53 DNS:        {'✅' if self.ENABLE_ROUTE53_DNS else '❌'}")
        print(f"  Create Hosted Zone:  {'Yes' if self.CREATE_ROUTE53_ZONE else 'No'}")
        if not self.CREATE_ROUTE53_ZONE:
            print(f"  Existing Zone ID:    {self.ROUTE53_ZONE_ID}")
        print(f"  SSL Certificate:     {'✅' if self.ENABLE_SSL_CERTIFICATE else '❌'}")
        print(f"  Wildcard Subdomain:  {'✅' if self.ENABLE_WILDCARD_SUBDOMAIN else '❌'}")
        print(f"  WWW Redirect:        {'✅' if self.ENABLE_WWW_REDIRECT else '❌'}")
        print(f"  API Subdomain:       {'✅' if self.ENABLE_API_SUBDOMAIN else '❌'}")
        print(f"  MX Records:          {'✅' if self.ENABLE_MX_RECORDS else '❌'}")
        print(f"  TXT Records:         {'✅' if self.ENABLE_TXT_RECORDS else '❌'}")
        print()
        print("🌐 CloudFront:")
        print(f"  Custom Domains:      {'✅' if self.ENABLE_CLOUDFRONT_CUSTOM_DOMAINS else '❌'}")
        print(f"  SSL Certificate:     {self.CLOUDFRONT_SSL_CERTIFICATE}")
        print(f"  Compression:         {'✅' if self.CLOUDFRONT_COMPRESSION else '❌'}")
        print(f"  HTTP/2:              {'✅' if self.CLOUDFRONT_HTTP2 else '❌'}")
        print()
        print("🗄️ Database:")
        print(f"  Point-in-Time Recovery: {'✅' if self.ENABLE_POINT_IN_TIME_RECOVERY else '❌'}")
        print(f"  Deletion Protection:    {'✅' if self.ENABLE_DELETION_PROTECTION else '❌'}")
        print()
        print("📦 Storage:")
        print(f"  Versioning:          {'✅' if self.ENABLE_VERSIONING else '❌'}")
        print(f"  Encryption:          {'✅' if self.ENABLE_ENCRYPTION else '❌'}")
        print()
        print("🔐 Auth:")
        print(f"  MFA:                 {'✅' if self.ENABLE_MFA else '❌'}")
        print(f"  Min Password Length: {self.PASSWORD_POLICY['minimum_length']}")
        print()
        print("🚀 API:")
        print(f"  Throttle Rate:       {self.API_THROTTLE_RATE}")
        print(f"  Throttle Burst:      {self.API_THROTTLE_BURST}")
        print()
        print("📊 Monitoring:")
        print(f"  CloudWatch Logs:     {'✅' if self.ENABLE_CLOUDWATCH_LOGS else '❌'}")
        print(f"  Log Retention:       {self.LOG_RETENTION_DAYS} days")
        print()
        print("👥 Admins:")
        for email in self.ADMIN_EMAILS:
            print(f"  - {email}")
        print()
        print("=" * 60)
    
    def to_dict(self):
        """Konvertiert Config zu Dictionary"""
        return {k: v for k, v in self.__dict__.items() 
                if not k.startswith('_') and not callable(v)}


# Singleton-Instanz
config = DeploymentConfig()


if __name__ == "__main__":
    # Wenn direkt ausgeführt: Konfiguration anzeigen und validieren
    config.show()
    print()
    
    errors = config.validate()
    if errors:
        print("❌ Validierungsfehler:")
        for error in errors:
            print(f"  - {error}")
        print()
        print("💡 Bitte passe deployment-config.py an!")
    else:
        print("✅ Platform-Konfiguration ist valide")
        print()
        print("🚀 Bereit für Deployment:")
        print("   python deploy.py")