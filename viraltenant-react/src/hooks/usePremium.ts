/**
 * usePremium Hook - Prüft ob der User ein Premium-Mitglied ist
 * 
 * Premium-User haben Zugang zu exklusiven Inhalten:
 * - Videos mit isExclusive: true
 * - Livestreams mit membersOnly: true
 * - Exklusive Podcasts und Newsfeed-Posts
 * 
 * Admins sind automatisch Premium-User.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAdmin } from './useAdmin';
import { tenantService } from '../services/tenant.service';
import { getMyMembershipStatus, MyMembershipStatus } from '../services/membership.service';

// Cache für Premium-Status pro Tenant
const premiumCache: Record<string, { isPremium: boolean; status: MyMembershipStatus | null; timestamp: number }> = {};
const CACHE_TTL = 2 * 60 * 1000; // 2 Minuten (kürzer als Admin, da sich Membership-Status ändern kann)

export function usePremium() {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [isPremium, setIsPremium] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<MyMembershipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const checkInProgress = useRef(false);

  const checkPremiumStatus = useCallback(async () => {
    if (checkInProgress.current) return;
    checkInProgress.current = true;

    // Nicht eingeloggt = kein Premium
    if (!isAuthenticated || !accessToken) {
      setIsPremium(false);
      setMembershipStatus(null);
      setIsLoading(false);
      checkInProgress.current = false;
      return;
    }

    // Warte bis Admin-Status geladen ist
    if (adminLoading) {
      checkInProgress.current = false;
      return;
    }

    // Admins sind automatisch Premium
    if (isAdmin) {
      setIsPremium(true);
      setMembershipStatus({ isMember: true });
      setIsLoading(false);
      checkInProgress.current = false;
      return;
    }

    try {
      // Warte auf Tenant-Auflösung
      const tenant = await tenantService.waitForResolution();
      const tenantId = tenant.tenantId;
      
      console.log('[usePremium] Checking premium status for tenant:', tenantId);

      // Cache prüfen
      const cacheKey = `${user?.email || 'unknown'}_${tenantId}`;
      const cached = premiumCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[usePremium] Using cached status:', cached.isPremium);
        setIsPremium(cached.isPremium);
        setMembershipStatus(cached.status);
        setIsLoading(false);
        checkInProgress.current = false;
        return;
      }

      // Membership-Status vom Backend holen
      const status = await getMyMembershipStatus(tenantId, accessToken);
      console.log('[usePremium] Membership status:', status);
      
      const userIsPremium = status.isMember && status.membership?.status === 'active';
      
      // Cache aktualisieren
      premiumCache[cacheKey] = { 
        isPremium: userIsPremium, 
        status, 
        timestamp: Date.now() 
      };
      
      setIsPremium(userIsPremium);
      setMembershipStatus(status);
    } catch (error) {
      console.error('[usePremium] Error checking premium status:', error);
      // Bei Fehler: kein Premium (sicher)
      setIsPremium(false);
      setMembershipStatus(null);
    } finally {
      setIsLoading(false);
      checkInProgress.current = false;
    }
  }, [accessToken, isAuthenticated, user?.email, isAdmin, adminLoading]);

  useEffect(() => {
    checkPremiumStatus();
  }, [checkPremiumStatus]);

  // Re-check wenn Admin-Status sich ändert
  useEffect(() => {
    if (!adminLoading) {
      checkInProgress.current = false;
      checkPremiumStatus();
    }
  }, [isAdmin, adminLoading]);

  const refreshPremiumStatus = useCallback(() => {
    const tenantId = tenantService.getCurrentTenantId();
    const cacheKey = `${user?.email || 'unknown'}_${tenantId}`;
    delete premiumCache[cacheKey];
    checkInProgress.current = false;
    setIsLoading(true);
    checkPremiumStatus();
  }, [checkPremiumStatus, user?.email]);

  return { 
    isPremium, 
    membershipStatus, 
    isLoading: isLoading || adminLoading,
    refreshPremiumStatus,
    // Convenience: User ist eingeloggt aber kein Premium
    canUpgrade: isAuthenticated && !isPremium && !isAdmin
  };
}

/**
 * Globale Funktion um Premium-Cache zu invalidieren
 * (z.B. nach erfolgreicher Zahlung)
 */
export function invalidatePremiumCache() {
  Object.keys(premiumCache).forEach(key => delete premiumCache[key]);
}
