import { useState, useEffect } from 'react'
import { awsConfig } from '../config/aws-config'

interface Tenant {
  id: string
  subdomain: string
  creator_name: string
  status: 'active' | 'pending' | 'suspended'
  settings?: {
    theme?: string
    features?: string[]
  }
}

export function useTenantDetection() {
  const [tenant, setTenantState] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Wrapper to also store tenant ID in localStorage
  const setTenant = (newTenant: Tenant | null) => {
    setTenantState(newTenant)
    // Backend returns tenant_id, frontend uses id - support both
    const tenantId = newTenant?.id || (newTenant as any)?.tenant_id
    if (tenantId) {
      localStorage.setItem('currentTenantId', tenantId)
    } else {
      localStorage.removeItem('currentTenantId')
    }
  }

  useEffect(() => {
    detectTenant()
  }, [])

  const detectTenant = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Extract subdomain from hostname
      const hostname = window.location.hostname
      const parts = hostname.split('.')
      
      // Check if we're on a subdomain (not www or main domain)
      if (parts.length >= 3 && parts[0] !== 'www') {
        const subdomain = parts[0]
        
        // Load tenant configuration
        const response = await fetch(`${awsConfig.api.user}/tenants/by-subdomain/${subdomain}`)
        
        if (response.ok) {
          const tenantData = await response.json()
          // Map backend field names to frontend interface
          const mappedTenant: Tenant = {
            id: tenantData.tenant_id || tenantData.id,
            subdomain: tenantData.subdomain,
            creator_name: tenantData.creator_name,
            status: tenantData.status,
            settings: tenantData.settings
          }
          setTenant(mappedTenant)
        } else if (response.status === 404) {
          // Subdomain not found, redirect to main domain
          window.location.href = `https://viraltenant.com${window.location.pathname}`
          return
        } else {
          throw new Error('Failed to load tenant configuration')
        }
      } else {
        // We're on the main domain or www - no tenant context needed
        // Platform admins will see their tenants via /user/tenants endpoint
        setTenant(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    tenant,
    setTenant,
    isLoading,
    error,
    detectTenant
  }
}