import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { tenantService } from '../services/tenant.service';

interface TenantContextType {
  tenantId: string;
  subdomain: string;
  creatorName: string;
  source: 'subdomain' | 'custom_domain' | 'platform';
  isLoading: boolean;
  isCustomDomain: boolean;
  status: string;
  statusReason: string;
  isSuspended: boolean;
}

const PLATFORM_TENANT_ID = '319190e1-0791-43b0-bd04-506f959c1471';

const TenantContext = createContext<TenantContextType>({
  tenantId: PLATFORM_TENANT_ID,
  subdomain: 'www',
  creatorName: 'ViralTenant',
  source: 'platform',
  isLoading: true,
  isCustomDomain: false,
  status: 'active',
  statusReason: '',
  isSuspended: false
});

export const useTenant = () => useContext(TenantContext);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenant, setTenant] = useState<TenantContextType>({
    tenantId: PLATFORM_TENANT_ID,
    subdomain: 'www',
    creatorName: 'ViralTenant',
    source: 'platform',
    isLoading: true,
    isCustomDomain: false,
    status: 'active',
    statusReason: '',
    isSuspended: false
  });

  useEffect(() => {
    const resolveTenant = async () => {
      try {
        const resolved = await tenantService.resolveTenant();
        
        setTenant({
          tenantId: resolved.tenantId,
          subdomain: resolved.subdomain,
          creatorName: resolved.creatorName,
          source: resolved.source,
          isLoading: false,
          isCustomDomain: resolved.source === 'custom_domain',
          status: resolved.status || 'active',
          statusReason: resolved.status_reason || '',
          isSuspended: resolved.status === 'suspended'
        });
      } catch (error) {
        console.error('[TenantProvider] Error:', error);
        setTenant(prev => ({ ...prev, isLoading: false }));
      }
    };

    resolveTenant();
  }, []);

  // Show loading spinner for custom domains while resolving
  if (tenant.isLoading && tenantService.isCustomDomain()) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={tenant}>
      {tenant.isSuspended && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white py-3 px-4 text-center">
          <div className="container mx-auto flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">
              Dieser Account wurde gesperrt. Bitte bezahle deine offenen Rechnungen.
            </span>
          </div>
        </div>
      )}
      <div className={tenant.isSuspended ? 'pt-12' : ''}>
        {children}
      </div>
    </TenantContext.Provider>
  );
}
