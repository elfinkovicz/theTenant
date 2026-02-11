import { useTenant } from '../providers/TenantProvider'

// Platform tenant UUID
const PLATFORM_TENANT_ID = '319190e1-0791-43b0-bd04-506f959c1471';

/**
 * Hook to check if we're on the platform tenant (viraltenant.com)
 * 
 * Platform tenant: viraltenant.com / www.viraltenant.com
 * - Shows: Tenant creation, marketing, pricing
 * - Target: New creators who want to create their own tenant
 * 
 * Regular tenants: creator.viraltenant.com or custom domains
 * - Shows: Creator content, community features
 * - Target: End users who register under a specific creator
 */
export function usePlatformTenant() {
  const { tenantId, subdomain, isLoading } = useTenant()
  
  const isPlatform = tenantId === PLATFORM_TENANT_ID || subdomain === 'www'
  const isTenant = !isPlatform && !isLoading
  
  return {
    isPlatform,
    isTenant,
    tenantId,
    subdomain,
    isLoading
  }
}
