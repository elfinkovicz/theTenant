/**
 * API Utility mit automatischem Token-Refresh und Expiry Handling
 * Refresht Token automatisch wenn er bald abläuft
 * Leitet bei 401/403 automatisch zur Login-Seite wenn Refresh fehlschlägt
 */

import { useAuthStore } from '../store/authStore';

// Event für Token-Expiry (kann von Komponenten abonniert werden)
export const TOKEN_EXPIRED_EVENT = 'auth:token-expired';

// Interval für automatischen Token-Refresh Check (alle 5 Minuten)
let refreshCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Prüft ob ein Response auf einen abgelaufenen Token hinweist
 * WICHTIG: Nur 401 (Unauthorized) bedeutet Token abgelaufen
 * 403 (Forbidden) bedeutet nur "keine Berechtigung für diese Aktion"
 */
function isTokenExpiredResponse(status: number): boolean {
  return status === 401;
}

/**
 * Behandelt abgelaufene Tokens - versucht erst Refresh
 */
async function handleTokenExpired(): Promise<boolean> {
  console.warn('Token expired - attempting refresh');
  
  const { refreshAccessToken, forceLogout } = useAuthStore.getState();
  
  // Versuche Token zu refreshen
  const refreshed = await refreshAccessToken();
  
  if (refreshed) {
    console.log('Token refreshed successfully after 401');
    return true;
  }
  
  // Refresh fehlgeschlagen - Logout
  console.warn('Token refresh failed - forcing logout');
  forceLogout();
  
  // Event dispatchen für UI-Komponenten
  window.dispatchEvent(new CustomEvent(TOKEN_EXPIRED_EVENT));
  
  // Zur Login-Seite weiterleiten
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login?expired=true';
  }
  
  return false;
}

/**
 * Proaktiver Token-Refresh wenn Token bald abläuft
 */
async function checkAndRefreshToken(): Promise<void> {
  const { isAuthenticated, isTokenExpiringSoon, refreshAccessToken } = useAuthStore.getState();
  
  if (isAuthenticated && isTokenExpiringSoon()) {
    console.log('Token expiring soon - proactively refreshing');
    await refreshAccessToken();
  }
}

/**
 * Startet den automatischen Token-Refresh Check
 */
export function startTokenRefreshCheck(): void {
  if (refreshCheckInterval) {
    return; // Bereits gestartet
  }
  
  // Sofort prüfen
  checkAndRefreshToken();
  
  // Alle 5 Minuten prüfen
  refreshCheckInterval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
  
  console.log('Token refresh check started (every 5 minutes)');
}

/**
 * Stoppt den automatischen Token-Refresh Check
 */
export function stopTokenRefreshCheck(): void {
  if (refreshCheckInterval) {
    clearInterval(refreshCheckInterval);
    refreshCheckInterval = null;
    console.log('Token refresh check stopped');
  }
}

/**
 * Wrapper für fetch mit automatischem Token-Refresh Handling
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Proaktiv Token refreshen wenn nötig
  await checkAndRefreshToken();
  
  // Aktuellen Token holen (könnte gerade refreshed worden sein)
  const { accessToken } = useAuthStore.getState();
  if (accessToken && options.headers) {
    (options.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(url, options);
  
  // Bei 401 mit Authorization Header -> Token abgelaufen, versuche Refresh
  if (isTokenExpiredResponse(response.status) && options.headers) {
    const headers = options.headers as Record<string, string>;
    if (headers['Authorization']) {
      const refreshed = await handleTokenExpired();
      if (refreshed) {
        // Retry mit neuem Token
        const { accessToken: newToken } = useAuthStore.getState();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          return fetch(url, options);
        }
      }
    }
  }
  
  return response;
}

/**
 * Setup für globalen Fetch-Interceptor
 * Überschreibt window.fetch um alle API-Calls zu überwachen
 */
export function setupFetchInterceptor(): void {
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Proaktiv Token refreshen wenn nötig (nur für API-Calls)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isApiCall = url.includes('execute-api') || url.includes('/api/');
    
    if (isApiCall) {
      await checkAndRefreshToken();
    }
    
    const response = await originalFetch(input, init);
    
    if (isApiCall && isTokenExpiredResponse(response.status)) {
      // Prüfe ob es ein authentifizierter Request war
      const hasAuth = init?.headers && 
        ((init.headers as Record<string, string>)['Authorization'] ||
         (init.headers instanceof Headers && init.headers.has('Authorization')));
      
      if (hasAuth) {
        const refreshed = await handleTokenExpired();
        if (refreshed) {
          // Retry mit neuem Token
          const { accessToken } = useAuthStore.getState();
          if (accessToken && init?.headers) {
            const newInit = { ...init };
            if (newInit.headers instanceof Headers) {
              newInit.headers.set('Authorization', `Bearer ${accessToken}`);
            } else {
              (newInit.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
            }
            return originalFetch(input, newInit);
          }
        }
      }
    }
    
    return response;
  };
  
  console.log('Fetch interceptor installed for token refresh handling');
}

/**
 * Hook für Token-Expiry Check beim App-Start
 */
export function checkTokenOnStartup(): void {
  const { isAuthenticated, isTokenExpired, isTokenExpiringSoon, refreshAccessToken } = useAuthStore.getState();
  
  if (isAuthenticated) {
    if (isTokenExpired()) {
      // Token ist abgelaufen - versuche Refresh
      console.warn('Token expired on startup - attempting refresh');
      refreshAccessToken().then(success => {
        if (!success && !window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=true';
        }
      });
    } else if (isTokenExpiringSoon()) {
      // Token läuft bald ab - proaktiv refreshen
      console.log('Token expiring soon on startup - refreshing');
      refreshAccessToken();
    }
  }
  
  // Starte automatischen Refresh-Check
  startTokenRefreshCheck();
}
