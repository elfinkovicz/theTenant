import React, { createContext, useContext } from 'react'
import { useTenantDetection } from '@hooks/useTenant'

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

interface TenantContextType {
  tenant: Tenant | null
  setTenant: (tenant: Tenant | null) => void
  isLoading: boolean
  error: string | null
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

interface TenantProviderProps {
  children: React.ReactNode
}

export function TenantProvider({ children }: TenantProviderProps) {
  const tenantDetection = useTenantDetection()

  return (
    <TenantContext.Provider value={tenantDetection}>
      {children}
    </TenantContext.Provider>
  )
}