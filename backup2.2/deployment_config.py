#!/usr/bin/env python3
"""
Deployment Configuration für Creator Platform
Passe die Werte in der Config-Klasse an und führe deploy.py aus
"""

class DeploymentConfig:
    """Zentrale Deployment-Konfiguration"""
    
    def __init__(self):
        # ============================================
        # PROJEKT-INFORMATIONEN (ANPASSEN!)
        # ============================================
        self.CREATOR_NAME = "honigwabe"              # lowercase, keine Leerzeichen
        self.CREATOR_DISPLAY_NAME = "Honigwabe"      # Anzeige-Name
        self.DOMAIN_NAME = "honigwabe.live"                # Domain ohne www
        self.WEBSITE_DOMAIN = "www.honigwabe.live"         # Website-Domain (mit www)
        
        # ============================================
        # AWS KONFIGURATION
        # ============================================
        self.AWS_REGION = "eu-central-1"
        self.AWS_PROFILE = self.CREATOR_NAME                 # AWS CLI Profile Name
        self.ENVIRONMENT = "production"
        
        # ============================================
        # E-MAIL KONFIGURATION
        # ============================================
        self.CONTACT_EMAIL_RECIPIENT = f"email@nielsfink.de"    #Adresse zum mailerhalt über das kontaktformular
        self.CONTACT_EMAIL_SENDER = f"noreply@{self.DOMAIN_NAME}"
        self.ADMIN_EMAIL = f"admin@{self.DOMAIN_NAME}"
        
        # ============================================
        # KONTAKT-INFORMATIONEN
        # ============================================
        self.CONTACT_EMAIL_DISPLAY = f"contact@{self.DOMAIN_NAME}"
        self.CONTACT_PHONE = "+49 123 456789"
        self.CONTACT_ADDRESS_STREET = "Musterstraße 123"
        self.CONTACT_ADDRESS_CITY = "12345 Musterstadt"
        self.CONTACT_ADDRESS_COUNTRY = "Deutschland"
        
        # ============================================
        # TERRAFORM BACKEND
        # ============================================
        self.TF_STATE_BUCKET = f"{self.CREATOR_NAME}-terraform-state"
        self.TF_LOCK_TABLE = f"{self.CREATOR_NAME}-terraform-locks"
    
        # ============================================
        # FEATURES (True/False)
        # ============================================
        self.ENABLE_IVS_STREAMING = True
        self.ENABLE_IVS_CHAT = True
        self.ENABLE_USER_AUTH = True
        self.ENABLE_SPONSOR_SYSTEM = True
        self.ENABLE_SHOP = True
        self.ENABLE_VIDEO_MANAGEMENT = True
        self.ENABLE_TEAM_MANAGEMENT = True
        self.ENABLE_EVENT_MANAGEMENT = True
        self.ENABLE_AD_MANAGEMENT = True
        self.ENABLE_HERO_MANAGEMENT = True
        self.ENABLE_PRODUCT_MANAGEMENT = True
        self.ENABLE_STREAM_RESTREAMING = True
        
        # ============================================
        # ADMIN CONFIGURATION
        # ============================================
        self.ADMIN_EMAILS = [
            "email@nielsfink.de",
            # Weitere Admin-Emails hier hinzufügen (max 3 empfohlen)
        ]
        
        # ============================================
        # IVS KONFIGURATION
        # ============================================
        self.IVS_CHANNEL_NAME = "HonigwabeLive"  # Keine leerzeichen
        self.IVS_CHANNEL_TYPE = "STANDARD"  # STANDARD oder BASIC
        
        # ============================================
        # COGNITO KONFIGURATION
        # ============================================
        self.ALLOW_USER_REGISTRATION = True
        self.COGNITO_CALLBACK_URLS = [
            f"https://{self.WEBSITE_DOMAIN}/callback",
            f"https://{self.WEBSITE_DOMAIN}/login"
        ]
        self.COGNITO_LOGOUT_URLS = [
            f"https://{self.WEBSITE_DOMAIN}/logout",
            f"https://{self.WEBSITE_DOMAIN}/"
        ]
        
        # ============================================
        # STRIPE (optional)
        # ============================================
        import os
        self.STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
        self.STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
        
        # ============================================
        # BILLING SYSTEM
        # ============================================
        self.ENABLE_BILLING_SYSTEM = True  # Monatliche AWS-Kostenabrechnung
        self.BILLING_BASE_FEE = 20  # Monatliche Grundgebühr in Euro
        self.STRIPE_WEBHOOK_SECRET = ""  # Webhook Secret von Stripe Dashboard
        
        # ============================================
        # ROUTE53
        # ============================================
        self.CREATE_ROUTE53_ZONE = False  # Zone existiert bereits
        self.ROUTE53_ZONE_ID = "Z08359721A0G4IX475C7Z"  # Existierende Zone ID
        
        # ============================================
        # PFADE
        # ============================================
        self.TERRAFORM_DIR = "./TerraformInfluencerTemplate"
        self.FRONTEND_DIR = "./honigwabe-react"
        self.CLIENT_DIR = f"{self.TERRAFORM_DIR}/clients/{self.CREATOR_NAME}"
        
        # ============================================
        # SOCIAL MEDIA
        # ============================================
        # Video & Livestreaming
        self.SOCIAL_YOUTUBE = f"https://youtube.com/@{self.CREATOR_NAME}"
        self.SOCIAL_TWITCH = f"https://twitch.tv/{self.CREATOR_NAME}"
        self.SOCIAL_TIKTOK = f"https://tiktok.com/@{self.CREATOR_NAME}"
        self.SOCIAL_VIMEO = f"https://vimeo.com/{self.CREATOR_NAME}"
        self.SOCIAL_KICK = f"https://kick.com/{self.CREATOR_NAME}"
        
        # Social Media
        self.SOCIAL_INSTAGRAM = f"https://instagram.com/{self.CREATOR_NAME}"
        self.SOCIAL_TWITTER = f"https://twitter.com/{self.CREATOR_NAME}"
        self.SOCIAL_FACEBOOK = f"https://facebook.com/{self.CREATOR_NAME}"
        self.SOCIAL_THREADS = f"https://threads.net/@{self.CREATOR_NAME}"
        self.SOCIAL_LINKEDIN = f"https://linkedin.com/in/{self.CREATOR_NAME}"
        self.SOCIAL_SNAPCHAT = f"https://snapchat.com/add/{self.CREATOR_NAME}"
        self.SOCIAL_PINTEREST = f"https://pinterest.com/{self.CREATOR_NAME}"
        self.SOCIAL_REDDIT = f"https://reddit.com/r/{self.CREATOR_NAME}"
        
        # Musik & Audio
        self.SOCIAL_SPOTIFY = f"https://open.spotify.com/artist/{self.CREATOR_NAME}"
        self.SOCIAL_APPLE_MUSIC = f"https://music.apple.com/artist/{self.CREATOR_NAME}"
        self.SOCIAL_SOUNDCLOUD = f"https://soundcloud.com/{self.CREATOR_NAME}"
        self.SOCIAL_BANDCAMP = f"https://{self.CREATOR_NAME}.bandcamp.com"
        self.SOCIAL_AUDIOMACK = f"https://audiomack.com/{self.CREATOR_NAME}"
        
        # Podcasts
        self.SOCIAL_SPOTIFY_PODCAST = f"https://open.spotify.com/show/{self.CREATOR_NAME}"
        self.SOCIAL_APPLE_PODCAST = f"https://podcasts.apple.com/podcast/{self.CREATOR_NAME}"
        
        # Community & Chat
        self.SOCIAL_DISCORD = f"https://discord.gg/{self.CREATOR_NAME}"
        self.SOCIAL_TELEGRAM = f"https://t.me/{self.CREATOR_NAME}"
        self.SOCIAL_WHATSAPP = f"https://whatsapp.com/channel/{self.CREATOR_NAME}"
        
        # Monetarisierung
        self.SOCIAL_PATREON = f"https://patreon.com/{self.CREATOR_NAME}"
        self.SOCIAL_KOFI = f"https://ko-fi.com/{self.CREATOR_NAME}"
        self.SOCIAL_BUYMEACOFFEE = f"https://buymeacoffee.com/{self.CREATOR_NAME}"
        self.SOCIAL_SUBSTACK = f"https://{self.CREATOR_NAME}.substack.com"
        
        # Gaming
        self.SOCIAL_STEAM = f"https://steamcommunity.com/id/{self.CREATOR_NAME}"
        
        # Publishing
        self.SOCIAL_MEDIUM = f"https://medium.com/@{self.CREATOR_NAME}"
        
        # ============================================
        # BRANDING
        # ============================================
        self.BRAND_PRIMARY_COLOR = "#FFC400"
        self.BRAND_SECONDARY_COLOR = "#FFB700"
        self.BRAND_ACCENT_COLOR = "#FF8A00"
    
    # ============================================
    # METHODEN
    # ============================================
    
    def validate(self):
        """Validiert die Konfiguration"""
        errors = []
        
        if self.CREATOR_NAME == "creator-name":
            errors.append("CREATOR_NAME muss angepasst werden")
        
        if self.DOMAIN_NAME == "creator.com":
            errors.append("DOMAIN_NAME muss angepasst werden")
        
        if not self.CREATOR_NAME.replace("-", "").replace("_", "").isalnum():
            errors.append("CREATOR_NAME darf nur Buchstaben, Zahlen und Bindestriche enthalten")
        
        if self.CREATOR_NAME != self.CREATOR_NAME.lower():
            errors.append("CREATOR_NAME muss lowercase sein")
        
        return errors
    
    def show(self):
        """Zeigt die Konfiguration an"""
        print("=" * 50)
        print("DEPLOYMENT CONFIGURATION")
        print("=" * 50)
        print()
        print("Projekt:")
        print(f"  Creator Name:        {self.CREATOR_NAME}")
        print(f"  Display Name:        {self.CREATOR_DISPLAY_NAME}")
        print(f"  Domain:              {self.DOMAIN_NAME}")
        print(f"  Website:             {self.WEBSITE_DOMAIN}")
        print()
        print("AWS:")
        print(f"  Region:              {self.AWS_REGION}")
        print(f"  Profile:             {self.AWS_PROFILE}")
        print(f"  Environment:         {self.ENVIRONMENT}")
        print()
        print("E-Mail:")
        print(f"  Contact Recipient:   {self.CONTACT_EMAIL_RECIPIENT}")
        print(f"  Contact Sender:      {self.CONTACT_EMAIL_SENDER}")
        print(f"  Admin:               {self.ADMIN_EMAIL}")
        print()
        print("Kontakt-Informationen:")
        print(f"  E-Mail:              {self.CONTACT_EMAIL_DISPLAY}")
        print(f"  Telefon:             {self.CONTACT_PHONE}")
        print(f"  Adresse:             {self.CONTACT_ADDRESS_STREET}")
        print(f"                       {self.CONTACT_ADDRESS_CITY}")
        print(f"                       {self.CONTACT_ADDRESS_COUNTRY}")
        print()
        print("Features:")
        print(f"  IVS Streaming:       {self.ENABLE_IVS_STREAMING}")
        print(f"  IVS Chat:            {self.ENABLE_IVS_CHAT}")
        print(f"  User Auth:           {self.ENABLE_USER_AUTH}")
        print(f"  Sponsor System:      {self.ENABLE_SPONSOR_SYSTEM}")
        print(f"  Shop:                {self.ENABLE_SHOP}")
        print(f"  Video Management:    {self.ENABLE_VIDEO_MANAGEMENT}")
        print(f"  Team Management:     {self.ENABLE_TEAM_MANAGEMENT}")
        print(f"  Event Management:    {self.ENABLE_EVENT_MANAGEMENT}")
        print(f"  Ad Management:       {self.ENABLE_AD_MANAGEMENT}")
        print(f"  Hero Management:     {self.ENABLE_HERO_MANAGEMENT}")
        print(f"  Product Management:  {self.ENABLE_PRODUCT_MANAGEMENT}")
        print(f"  Stream Restreaming:  {self.ENABLE_STREAM_RESTREAMING}")
        print(f"  Billing System:      {self.ENABLE_BILLING_SYSTEM}")
        print()
        print("Billing:")
        print(f"  Base Fee:            {self.BILLING_BASE_FEE}€/Monat")
        print(f"  Stripe Configured:   {'✅' if self.STRIPE_SECRET_KEY else '❌'}")
        print()
        print("Admins:")
        for email in self.ADMIN_EMAILS:
            print(f"  - {email}")
        print()
        print("Terraform Backend:")
        print(f"  State Bucket:        {self.TF_STATE_BUCKET}")
        print(f"  Lock Table:          {self.TF_LOCK_TABLE}")
        print()
        print("=" * 50)
    
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
        print("Bitte passe deployment-config.py an!")
    else:
        print("✅ Konfiguration ist valide")
