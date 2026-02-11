/**
 * Membership Service - API für Mitgliedschafts-System
 */

import { awsConfig } from '../config/aws-config'
import { tenantService } from './tenant.service'

const API_BASE = awsConfig.api.user

export interface MembershipSettings {
  tenant_id: string
  enabled: boolean
  monthly_price: number
  currency: string
  title: string
  description: string
  benefits: string[]
  platform_fee_percent: number
  created_at?: string
  updated_at?: string
}

export interface Membership {
  membership_id: string
  tenant_id: string
  user_id: string
  user_email: string
  status: 'active' | 'cancelled' | 'expired' | 'pending' | 'failed'
  mollie_subscription_id?: string
  mollie_customer_id?: string
  price: number
  currency: string
  started_at?: string
  cancelled_at?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface MembershipPayment {
  payment_id: string
  membership_id: string
  tenant_id: string
  user_id: string
  amount: number
  platform_fee: number
  tenant_payout: number
  mollie_payment_id: string
  status: 'paid' | 'pending' | 'failed'
  paid_at?: string
  created_at: string
}

export interface MembershipStats {
  total: number
  active: number
  cancelled: number
  monthlyRevenue: number
  platformFee: number
  netRevenue: number
}

export interface PayoutSummary {
  totalPayments: number
  paidPayments: number
  totalReceived: number
  totalPlatformFee: number
  totalPayout: number
}

export interface MembershipInfo {
  enabled: boolean
  tenant_name?: string
  title?: string
  description?: string
  benefits?: string[]
  monthly_price?: number
  currency?: string
  message?: string
}

export interface MyMembershipStatus {
  isMember: boolean
  membership?: {
    id: string
    status: string
    price: number
    currency: string
    startedAt?: string
    cancelledAt?: string
    expiresAt?: string
  }
  payments?: MembershipPayment[]
}

// ============================================================
// ADMIN ENDPOINTS
// ============================================================

/**
 * Membership-Einstellungen abrufen
 */
export async function getMembershipSettings(
  tenantId: string,
  accessToken: string
): Promise<MembershipSettings> {
  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/settings`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId
    }
  })

  if (!response.ok) {
    throw new Error('Fehler beim Laden der Einstellungen')
  }

  return response.json()
}

/**
 * Membership-Einstellungen speichern
 */
export async function saveMembershipSettings(
  tenantId: string,
  accessToken: string,
  settings: Partial<MembershipSettings>
): Promise<{ message: string; settings: MembershipSettings }> {
  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/settings`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Fehler beim Speichern')
  }

  return response.json()
}

/**
 * Mitgliederliste abrufen
 */
export async function getMembershipMembers(
  tenantId: string,
  accessToken: string
): Promise<{ members: Membership[]; stats: MembershipStats }> {
  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/members`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId
    }
  })

  if (!response.ok) {
    throw new Error('Fehler beim Laden der Mitglieder')
  }

  return response.json()
}

/**
 * Auszahlungshistorie abrufen
 */
export async function getMembershipPayouts(
  tenantId: string,
  accessToken: string
): Promise<{ payments: MembershipPayment[]; summary: PayoutSummary }> {
  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/payouts`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId
    }
  })

  if (!response.ok) {
    throw new Error('Fehler beim Laden der Auszahlungen')
  }

  return response.json()
}

// ============================================================
// USER ENDPOINTS
// ============================================================

/**
 * Öffentliche Membership-Info abrufen (kein Auth nötig)
 */
export async function getMembershipInfo(tenantId: string): Promise<MembershipInfo> {
  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/info`)

  if (!response.ok) {
    throw new Error('Fehler beim Laden der Membership-Info')
  }

  return response.json()
}

/**
 * Mitgliedschaft starten
 */
export async function subscribeMembership(
  tenantId: string,
  accessToken: string,
  redirectUrl: string,
  userEmail: string
): Promise<{ membershipId: string; checkoutUrl: string; status: string }> {
  // Ensure user is linked to tenant first (required for authorization)
  try {
    await tenantService.joinTenant(accessToken)
  } catch (joinError) {
    console.warn('Could not join tenant before subscribe:', joinError)
    // Continue anyway - might already be a member
  }

  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/subscribe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ redirectUrl, email: userEmail })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Fehler beim Starten der Mitgliedschaft')
  }

  return response.json()
}

/**
 * Eigenen Membership-Status abrufen
 */
export async function getMyMembershipStatus(
  tenantId: string,
  accessToken: string
): Promise<MyMembershipStatus> {
  // Ensure user is linked to tenant first (required for authorization)
  try {
    await tenantService.joinTenant(accessToken)
  } catch (joinError) {
    console.warn('Could not join tenant before status check:', joinError)
    // Continue anyway - might already be a member
  }

  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/my-status`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId
    }
  })

  if (!response.ok) {
    throw new Error('Fehler beim Laden des Status')
  }

  return response.json()
}

/**
 * Mitgliedschaft kündigen
 */
export async function cancelMembership(
  tenantId: string,
  accessToken: string
): Promise<{ message: string; expiresAt: string }> {
  const response = await fetch(`${API_BASE}/tenants/${tenantId}/membership/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Creator-ID': tenantId
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Fehler beim Kündigen')
  }

  return response.json()
}
