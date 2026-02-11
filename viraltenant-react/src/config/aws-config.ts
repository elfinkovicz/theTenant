// Multi-Tenant ViralTenant Platform Configuration
// Generiert: 2025-12-29 17:09:26

export const awsConfig = {
  mode: 'multi-tenant',
  region: 'eu-central-1',
  
  platform: {
    name: 'ViralTenant',
    domain: 'viraltenant.com',
    apiEndpoint: 'https://df5r2od45h0ol.cloudfront.net/api',
    cdnDomain: 'df5r2od45h0ol.cloudfront.net'
  },
  
  cognito: {
    userPoolId: 'eu-central-1_4mUqVJrm2',  // Wird durch Terraform ersetzt
    clientId: '23g1eol46sdr3a80prfem1kgli',       // Wird durch Terraform ersetzt
    domain: 'viraltenant-auth-production'
  },
  
  storage: {
    bucketName: 'viraltenant-assets-production',
    cdnDomain: 'df5r2od45h0ol.cloudfront.net'
  },
  
  cloudfront: {
    domain: 'df5r2od45h0ol.cloudfront.net'
  },
  
  database: {
    tableName: 'viraltenant-data-production'
  },
  
  api: {
    user: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production',  // Wird durch Terraform ersetzt
    auth: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production',  // Auth API - gleiche URL, da integriert
    chat: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production/api',
    shop: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production/api',
    contactForm: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production/api',
    creatorOnboarding: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production/api/onboarding',
    domainRouting: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production/api/routing',
    videos: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production/api'
  },
  
  ivs: {
    playbackUrl: 'https://placeholder-stream.m3u8',
    chatRoomArn: 'arn:aws:ivs:eu-central-1:placeholder:chat-room/placeholder',
    channelArn: 'arn:aws:ivs:eu-central-1:placeholder:channel/placeholder'
  }
}

// Multi-Tenant Helper Functions
export const multiTenantHelpers = {
  getCurrentCreator(): string {
    // Extract creator from subdomain or path
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    // Check for subdomain pattern (creator.viraltenant.com)
    if (hostname !== 'viraltenant.com' && hostname.endsWith('.viraltenant.com')) {
      return hostname.replace('.viraltenant.com', '');
    }
    
    // Check for path pattern (/tenants/tenantId/)
    const pathMatch = pathname.match(/^\/tenants\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Default to platform UUID for main site
    return '319190e1-0791-43b0-bd04-506f959c1471';
  },
  
  async apiCall(endpoint: string, options: RequestInit = {}) {
    const creatorId = this.getCurrentCreator();
    const baseUrl = awsConfig.api.user;
    
    // Add creator context to headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Creator-ID': creatorId,
      ...options.headers
    };
    
    return fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });
  },
  
  getAssetUrl(assetPath: string): string {
    const creatorId = this.getCurrentCreator();
    const cdnDomain = awsConfig.storage.cdnDomain;
    
    // Remove leading slash if present
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    return `https://${cdnDomain}/tenants/${creatorId}/${cleanPath}`;
  },
  
  getUploadUrl(type: 'videos' | 'images' | 'thumbnails' | 'assets'): string {
    const creatorId = this.getCurrentCreator();
    return `tenants/${creatorId}/${type}/`;
  }
};

export default awsConfig;
