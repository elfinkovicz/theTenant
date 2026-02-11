import axios from 'axios';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;
const PLATFORM_TENANT_ID = '319190e1-0791-43b0-bd04-506f959c1471';

// Hardcoded custom domain mappings - no API call needed
const CUSTOM_DOMAIN_MAP: Record<string, { tenantId: string; subdomain: string; creatorName: string }> = {
  'standupnow.ch': { tenantId: 'ab5b624a-0707-48d4-bafb-e59f3276aece', subdomain: 'standupnow', creatorName: 'Leonardo Forte' },
  'www.standupnow.ch': { tenantId: 'ab5b624a-0707-48d4-bafb-e59f3276aece', subdomain: 'standupnow', creatorName: 'Leonardo Forte' },
};

interface TenantInfo {
  tenantId: string;
  subdomain: string;
  creatorName: string;
  source: 'subdomain' | 'custom_domain' | 'platform';
  status?: string;
  status_reason?: string;
}

// Single source of truth for tenant
let resolvedTenant: TenantInfo | null = null;
let resolutionPromise: Promise<TenantInfo> | null = null;

class TenantService {
  
  /**
   * Get hostname info
   */
  private getHostnameInfo() {
    const hostname = window.location.hostname.toLowerCase();
    const isViralTenant = hostname.includes('viraltenant.com');
    const parts = hostname.split('.');
    const isSubdomain = isViralTenant && parts.length >= 3 && parts[0] !== 'www';
    const subdomain = isSubdomain ? parts[0] : null;
    const isCustomDomain = !isViralTenant;
    
    return { hostname, isViralTenant, isSubdomain, subdomain, isCustomDomain };
  }

  /**
   * Resolve tenant - called once at app start
   * Returns cached result on subsequent calls
   */
  async resolveTenant(): Promise<TenantInfo> {
    // Return cached if already resolved
    if (resolvedTenant) {
      return resolvedTenant;
    }
    
    // If resolution in progress, wait for it
    if (resolutionPromise) {
      return resolutionPromise;
    }
    
    // Start resolution
    resolutionPromise = this.doResolveTenant();
    resolvedTenant = await resolutionPromise;
    resolutionPromise = null;
    
    // Store in localStorage for sync access
    localStorage.setItem('currentTenantId', resolvedTenant.tenantId);
    console.log('[TenantService] Resolved tenant:', resolvedTenant.tenantId, 'source:', resolvedTenant.source);
    
    return resolvedTenant;
  }

  private async doResolveTenant(): Promise<TenantInfo> {
    const { hostname, isViralTenant, isSubdomain, subdomain, isCustomDomain } = this.getHostnameInfo();
    
    // 1. Platform main domain (viraltenant.com or www.viraltenant.com)
    if (isViralTenant && !isSubdomain) {
      console.log('[TenantService] Platform domain');
      return {
        tenantId: PLATFORM_TENANT_ID,
        subdomain: 'www',
        creatorName: 'ViralTenant',
        source: 'platform',
        status: 'active',
        status_reason: ''
      };
    }
    
    // 2. Subdomain (tenant.viraltenant.com)
    if (isSubdomain && subdomain) {
      console.log('[TenantService] Subdomain:', subdomain);
      return this.resolveSubdomain(subdomain);
    }
    
    // 3. Custom domain (standupnow.ch, etc.)
    if (isCustomDomain) {
      console.log('[TenantService] Custom domain:', hostname);
      return this.resolveCustomDomain(hostname);
    }
    
    // Fallback
    return {
      tenantId: PLATFORM_TENANT_ID,
      subdomain: 'www',
      creatorName: 'ViralTenant',
      source: 'platform',
      status: 'active',
      status_reason: ''
    };
  }

  private async resolveSubdomain(subdomain: string): Promise<TenantInfo> {
    try {
      // Try by-subdomain endpoint first
      const response = await axios.get(`${API_BASE_URL}/tenants/by-subdomain/${subdomain}`);
      if (response.data) {
        return {
          tenantId: response.data.id || response.data.tenant_id || subdomain,
          subdomain: subdomain,
          creatorName: response.data.creator_name || subdomain,
          source: 'subdomain',
          status: response.data.status || 'active',
          status_reason: response.data.status_reason || ''
        };
      }
    } catch (e) {
      console.log('[TenantService] by-subdomain failed, trying direct');
    }
    
    // Fallback: use subdomain as tenant ID
    return {
      tenantId: subdomain,
      subdomain: subdomain,
      creatorName: subdomain,
      source: 'subdomain',
      status: 'active',
      status_reason: ''
    };
  }

  private async resolveCustomDomain(hostname: string): Promise<TenantInfo> {
    // Check hardcoded mapping first - instant resolution
    const mapped = CUSTOM_DOMAIN_MAP[hostname];
    if (mapped) {
      console.log('[TenantService] Custom domain resolved from hardcoded map:', hostname);
      return {
        tenantId: mapped.tenantId,
        subdomain: mapped.subdomain,
        creatorName: mapped.creatorName,
        source: 'custom_domain',
        status: 'active',
        status_reason: ''
      };
    }

    // Fallback to API for unmapped domains
    try {
      const response = await axios.get(`${API_BASE_URL}/domain-routing/${hostname}`);
      if (response.data?.tenantId) {
        return {
          tenantId: response.data.tenantId,
          subdomain: response.data.subdomain || response.data.tenantId,
          creatorName: response.data.creatorName || 'Unknown',
          source: 'custom_domain',
          status: response.data.status || 'active',
          status_reason: response.data.status_reason || ''
        };
      }
    } catch (error) {
      console.error('[TenantService] Custom domain resolution failed:', error);
    }
    
    // Fallback to platform (should not happen for valid custom domains)
    console.warn('[TenantService] Custom domain not found, using platform');
    return {
      tenantId: PLATFORM_TENANT_ID,
      subdomain: 'www',
      creatorName: 'ViralTenant',
      source: 'platform',
      status: 'active',
      status_reason: ''
    };
  }

  /**
   * Wait for tenant resolution to complete
   */
  async waitForResolution(): Promise<TenantInfo> {
    if (resolvedTenant) {
      return resolvedTenant;
    }
    return this.resolveTenant();
  }

  /**
   * Get current tenant ID (sync) - use after resolution
   */
  getCurrentTenantId(): string {
    if (resolvedTenant) {
      return resolvedTenant.tenantId;
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('currentTenantId');
    if (stored) {
      return stored;
    }
    
    // Emergency fallback based on hostname
    const { isSubdomain, subdomain } = this.getHostnameInfo();
    if (isSubdomain && subdomain) {
      return subdomain;
    }
    
    return PLATFORM_TENANT_ID;
  }

  /**
   * Get resolved tenant info (sync) - use after resolution
   */
  getResolvedTenant(): TenantInfo | null {
    return resolvedTenant;
  }

  /**
   * Check if current domain is a custom domain
   */
  isCustomDomain(): boolean {
    return this.getHostnameInfo().isCustomDomain;
  }

  /**
   * Clear cache - for testing or forced refresh
   */
  clearCache(): void {
    resolvedTenant = null;
    resolutionPromise = null;
    localStorage.removeItem('currentTenantId');
  }

  /**
   * Join current tenant - links user to tenant in database
   * Called automatically after login/register
   */
  async joinTenant(accessToken: string): Promise<{ success: boolean; role?: string; joined_at?: string }> {
    const tenantId = this.getCurrentTenantId();
    
    if (!tenantId || !accessToken) {
      console.log('[TenantService] Cannot join tenant - missing tenantId or accessToken');
      return { success: false };
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/tenants/${tenantId}/join`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('[TenantService] User joined tenant:', tenantId, response.data);
      return { 
        success: true, 
        role: response.data.role,
        joined_at: response.data.joined_at
      };
    } catch (error: any) {
      // 200 means already a member - that's fine
      if (error.response?.status === 200) {
        console.log('[TenantService] User already member of tenant:', tenantId);
        return { 
          success: true, 
          role: error.response.data?.role,
          joined_at: error.response.data?.joined_at
        };
      }
      console.error('[TenantService] Error joining tenant:', error);
      return { success: false };
    }
  }
}

export const tenantService = new TenantService();
