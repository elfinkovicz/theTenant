/**
 * API Interceptor für automatischen Logout bei Token-Ablauf
 * 
 * Dieser Interceptor fängt alle API-Fehler ab und loggt den User automatisch aus,
 * wenn der Token abgelaufen ist (401/403 Fehler).
 */

import { useAuthStore } from '../store/authStore'

export interface ApiError extends Error {
  status?: number
  statusText?: string
}

/**
 * Wrapper für fetch() mit automatischem Logout bei Token-Ablauf
 * 
 * WICHTIG: Nur 401 (Unauthorized) führt zum Logout.
 * 403 (Forbidden) bedeutet "keine Berechtigung" und ist kein Auth-Fehler.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, options)

    // Nur bei 401 (Unauthorized) ausloggen - Token ist ungültig/abgelaufen
    // 403 (Forbidden) bedeutet nur "keine Berechtigung für diese Aktion"
    if (response.status === 401) {
      console.warn('Authentication failed - Token expired or invalid (401)')
      
      // Automatischer Logout (ohne Cognito-Call da Token ungültig)
      const { forceLogout } = useAuthStore.getState()
      forceLogout()
      
      // Zeige Benachrichtigung
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
          window.location.href = '/login'
        }, 100)
      }
      
      // Werfe Fehler für weitere Behandlung
      const error: ApiError = new Error('Authentication failed')
      error.status = response.status
      error.statusText = response.statusText
      throw error
    }

    return response
  } catch (error) {
    // Netzwerkfehler oder andere Fehler
    if (error instanceof Error && 'status' in error) {
      throw error
    }
    
    // Unbekannter Fehler
    const apiError: ApiError = new Error('Network error')
    throw apiError
  }
}

/**
 * Helper: GET Request mit Auth-Handling
 */
export async function apiGet<T>(url: string, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetchWithAuth(url, {
    method: 'GET',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Helper: POST Request mit Auth-Handling
 */
export async function apiPost<T>(
  url: string,
  data: any,
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetchWithAuth(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Helper: PUT Request mit Auth-Handling
 */
export async function apiPut<T>(
  url: string,
  data: any,
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetchWithAuth(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Helper: DELETE Request mit Auth-Handling
 */
export async function apiDelete<T>(url: string, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetchWithAuth(url, {
    method: 'DELETE',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Prüft ob ein Fehler ein Auth-Fehler ist (nur 401, nicht 403)
 */
export function isAuthError(error: any): boolean {
  return (
    error?.status === 401 ||
    error?.message?.includes('401') ||
    error?.message?.includes('Authentication failed') ||
    error?.message?.includes('Unauthorized')
  )
}

/**
 * Behandelt API-Fehler mit automatischem Logout (nur bei 401)
 */
export function handleApiError(error: any): void {
  console.error('API Error:', error)
  
  if (isAuthError(error)) {
    const { forceLogout } = useAuthStore.getState()
    forceLogout()
    
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
        window.location.href = '/login'
      }, 100)
    }
  }
}
