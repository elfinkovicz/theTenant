import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { jwtDecode } from 'jwt-decode';
import { awsConfig } from '../config/aws-config';
import { useTenant } from '../providers/TenantProvider';
import { tenantService } from '../services/tenant.service';

interface CognitoToken {
  sub: string;
  email: string;
  'cognito:groups'?: string | string[];
  'custom:role'?: string;
}

// Cache für Admin-Status pro Tenant
const adminCache: Record<string, { isAdmin: boolean; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

export function useAdmin() {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const { isSuspended } = useTenant();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActualAdmin, setIsActualAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const checkInProgress = useRef(false);

  const checkAdminStatus = useCallback(async () => {
    if (checkInProgress.current) return;
    checkInProgress.current = true;

    if (!isAuthenticated || !accessToken) {
      setIsAdmin(false);
      setIsLoading(false);
      checkInProgress.current = false;
      return;
    }

    try {
      // Wait for tenant resolution and use the resolved tenant ID
      const tenant = await tenantService.waitForResolution();
      const tenantId = tenant.tenantId;
      
      console.log('[useAdmin] Checking admin status for tenant:', tenantId);

      // Cache prüfen
      const cacheKey = `${user?.email || 'unknown'}_${tenantId}`;
      const cached = adminCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setIsActualAdmin(cached.isAdmin);
        setIsAdmin(cached.isAdmin && !isSuspended);
        setIsLoading(false);
        checkInProgress.current = false;
        return;
      }

      // User-ID aus JWT extrahieren
      const decoded = jwtDecode<CognitoToken>(accessToken);
      const userId = decoded.sub;

      // Admin-Liste für diesen Tenant vom Backend holen
      const response = await fetch(`${awsConfig.api.user}/tenants/${tenantId}/admins`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': tenantId
        }
      });

      if (response.ok) {
        const data = await response.json();
        const admins = data.admins || [];
        
        const userIsAdmin = admins.some((admin: { user_id: string }) => admin.user_id === userId);
        
        adminCache[cacheKey] = { isAdmin: userIsAdmin, timestamp: Date.now() };
        setIsActualAdmin(userIsAdmin);
        setIsAdmin(userIsAdmin && !isSuspended);
      } else if (response.status === 403) {
        adminCache[cacheKey] = { isAdmin: false, timestamp: Date.now() };
        setIsActualAdmin(false);
        setIsAdmin(false);
      } else {
        console.warn('[useAdmin] Admin check failed, status:', response.status);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('[useAdmin] Error:', error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
      checkInProgress.current = false;
    }
  }, [accessToken, isAuthenticated, user?.email, isSuspended]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  const refreshAdminStatus = useCallback(() => {
    const tenantId = tenantService.getCurrentTenantId();
    const cacheKey = `${user?.email || 'unknown'}_${tenantId}`;
    delete adminCache[cacheKey];
    checkInProgress.current = false;
    setIsLoading(true);
    checkAdminStatus();
  }, [checkAdminStatus, user?.email]);

  return { isAdmin, isActualAdmin, isLoading, refreshAdminStatus, isSuspended };
}
