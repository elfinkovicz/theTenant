/**
 * Tenant Membership API - Mollie Connect (OAuth)
 * 
 * Ermöglicht Tenant-Admins, Mitgliedschaften anzubieten.
 * Nutzer können sich als zahlende Mitglieder anmelden.
 * Zahlungen gehen direkt auf das Mollie-Konto des Creators (via OAuth).
 * Plattform-Gebühr wird separat abgerechnet.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Table Names
const MEMBERSHIP_SETTINGS_TABLE = process.env.MEMBERSHIP_SETTINGS_TABLE;
const MEMBERSHIPS_TABLE = process.env.MEMBERSHIPS_TABLE;
const MEMBERSHIP_PAYMENTS_TABLE = process.env.MEMBERSHIP_PAYMENTS_TABLE;
const TENANTS_TABLE = process.env.TENANTS_TABLE;
const USER_TENANTS_TABLE = process.env.USER_TENANTS_TABLE;

// Mollie Configuration
const MOLLIE_CLIENT_ID = process.env.MOLLIE_CLIENT_ID;
const MOLLIE_CLIENT_SECRET = process.env.MOLLIE_CLIENT_SECRET;
const MOLLIE_BASE_URL = 'https://api.mollie.com/v2';
const MOLLIE_OAUTH_TOKEN_URL = 'https://api.mollie.com/oauth2/tokens';
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');
const API_BASE_URL = process.env.API_BASE_URL;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Get tenant's Mollie OAuth access token
 * Refreshes if expired
 */
async function getTenantMollieToken(tenantId) {
  const tenant = await docClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  }));

  if (!tenant.Item?.mollie_connect_access_token) {
    throw new Error('Mollie Connect nicht verbunden. Bitte verbinde zuerst dein Mollie-Konto.');
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tenant.Item.mollie_connect_expires_at);
  if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshTenantMollieToken(tenantId, tenant.Item.mollie_connect_refresh_token);
  }

  return tenant.Item.mollie_connect_access_token;
}

/**
 * Refresh tenant's Mollie OAuth token
 */
async function refreshTenantMollieToken(tenantId, refreshToken) {
  const response = await fetch(MOLLIE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: MOLLIE_CLIENT_ID,
      client_secret: MOLLIE_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Token refresh failed:', error);
    throw new Error('Mollie Token abgelaufen. Bitte verbinde dein Mollie-Konto erneut.');
  }

  const tokens = await response.json();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await docClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId },
    UpdateExpression: `SET 
      mollie_connect_access_token = :accessToken,
      mollie_connect_refresh_token = :refreshToken,
      mollie_connect_expires_at = :expiresAt,
      updated_at = :now`,
    ExpressionAttributeValues: {
      ':accessToken': tokens.access_token,
      ':refreshToken': tokens.refresh_token,
      ':expiresAt': expiresAt,
      ':now': now
    }
  }));

  return tokens.access_token;
}

/**
 * Mollie API Request Helper - uses tenant's OAuth token
 */
async function mollieRequest(tenantId, endpoint, method = 'GET', body = null) {
  const accessToken = await getTenantMollieToken(tenantId);

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${MOLLIE_BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    console.error('Mollie API Error:', error);
    throw new Error(error.detail || `Mollie API Error: ${response.status}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

/**
 * Generate unique ID
 */
function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sync user premium status in user_tenants table
 * This allows faster premium checks without querying memberships table
 */
async function syncUserPremiumStatus(userId, tenantId, status, membershipId = null, expiresAt = null) {
  try {
    const now = new Date().toISOString();
    
    await docClient.send(new UpdateCommand({
      TableName: USER_TENANTS_TABLE,
      Key: { user_id: userId, tenant_id: tenantId },
      UpdateExpression: 'SET membership_status = :status, membership_id = :membershipId, membership_expires_at = :expiresAt, updated_at = :now',
      ExpressionAttributeValues: {
        ':status': status,
        ':membershipId': membershipId,
        ':expiresAt': expiresAt,
        ':now': now
      }
    }));
    
    console.log(`Synced premium status for user ${userId} in tenant ${tenantId}: ${status}`);
  } catch (error) {
    console.error('Error syncing premium status:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Find membership by Mollie payment ID
 * Used in webhook to identify which tenant the payment belongs to
 */
async function findMembershipByPaymentId(paymentId) {
  try {
    // Scan for membership with this payment ID (first payment or subscription payment)
    const result = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      IndexName: 'mollie-payment-index',
      KeyConditionExpression: 'mollie_first_payment_id = :paymentId',
      ExpressionAttributeValues: {
        ':paymentId': paymentId
      }
    }));

    if (result.Items && result.Items.length > 0) {
      return result.Items[0];
    }

    // Fallback: Scan all memberships (less efficient but works without index)
    const scanResult = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      FilterExpression: 'mollie_first_payment_id = :paymentId',
      ExpressionAttributeValues: {
        ':paymentId': paymentId
      }
    }));

    return scanResult.Items?.[0] || null;
  } catch (error) {
    // If index doesn't exist, do a scan
    console.log('Index query failed, trying scan:', error.message);
    try {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: MEMBERSHIPS_TABLE,
        FilterExpression: 'mollie_first_payment_id = :paymentId',
        ExpressionAttributeValues: {
          ':paymentId': paymentId
        }
      }));
      return scanResult.Items?.[0] || null;
    } catch (scanError) {
      console.error('Error finding membership by payment ID:', scanError);
      return null;
    }
  }
}

// ============================================================
// ADMIN ENDPOINTS (Tenant-Betreiber)
// ============================================================

/**
 * GET /tenants/{tenantId}/membership/settings
 * Membership-Einstellungen abrufen
 */
async function getMembershipSettings(tenantId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: MEMBERSHIP_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Item || {
        tenant_id: tenantId,
        enabled: false,
        monthly_price: 9.99,
        currency: 'EUR',
        title: 'Mitgliedschaft',
        description: '',
        benefits: [],
        platform_fee_percent: PLATFORM_FEE_PERCENT
      })
    };
  } catch (error) {
    console.error('Error getting membership settings:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * PUT /tenants/{tenantId}/membership/settings
 * Membership-Einstellungen speichern
 */
async function saveMembershipSettings(tenantId, body) {
  try {
    const {
      enabled,
      monthly_price,
      currency = 'EUR',
      title,
      description,
      benefits = []
    } = body;

    // Validierung
    if (enabled && (!monthly_price || monthly_price < 1)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Mindestpreis ist 1€' })
      };
    }

    const now = new Date().toISOString();
    
    // Check if settings exist
    const existing = await docClient.send(new GetCommand({
      TableName: MEMBERSHIP_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    const item = {
      tenant_id: tenantId,
      enabled: !!enabled,
      monthly_price: parseFloat(monthly_price) || 9.99,
      currency,
      title: title || 'Mitgliedschaft',
      description: description || '',
      benefits: Array.isArray(benefits) ? benefits : [],
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      updated_at: now,
      created_at: existing.Item?.created_at || now
    };

    await docClient.send(new PutCommand({
      TableName: MEMBERSHIP_SETTINGS_TABLE,
      Item: item
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Einstellungen gespeichert',
        settings: item
      })
    };
  } catch (error) {
    console.error('Error saving membership settings:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * GET /tenants/{tenantId}/membership/members
 * Liste aller Mitglieder
 */
async function getMembershipMembers(tenantId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      IndexName: 'tenant-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      }
    }));

    const members = result.Items || [];
    
    // Statistiken berechnen
    const activeMembers = members.filter(m => m.status === 'active');
    const totalRevenue = members.reduce((sum, m) => {
      if (m.status === 'active') {
        return sum + (m.price || 0);
      }
      return sum;
    }, 0);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        members,
        stats: {
          total: members.length,
          active: activeMembers.length,
          cancelled: members.filter(m => m.status === 'cancelled').length,
          monthlyRevenue: totalRevenue,
          platformFee: totalRevenue * (PLATFORM_FEE_PERCENT / 100),
          netRevenue: totalRevenue * (1 - PLATFORM_FEE_PERCENT / 100)
        }
      })
    };
  } catch (error) {
    console.error('Error getting members:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * GET /tenants/{tenantId}/membership/payouts
 * Auszahlungshistorie
 */
async function getMembershipPayouts(tenantId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIP_PAYMENTS_TABLE,
      IndexName: 'tenant-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      },
      ScanIndexForward: false, // Neueste zuerst
      Limit: 100
    }));

    const payments = result.Items || [];
    
    // Zusammenfassung
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalReceived = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPlatformFee = paidPayments.reduce((sum, p) => sum + (p.platform_fee || 0), 0);
    const totalPayout = paidPayments.reduce((sum, p) => sum + (p.tenant_payout || 0), 0);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payments,
        summary: {
          totalPayments: payments.length,
          paidPayments: paidPayments.length,
          totalReceived,
          totalPlatformFee,
          totalPayout
        }
      })
    };
  } catch (error) {
    console.error('Error getting payouts:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// ============================================================
// USER ENDPOINTS (Mitglieder)
// ============================================================

/**
 * GET /tenants/{tenantId}/membership/info
 * Öffentliche Membership-Info (kein Auth nötig)
 */
async function getMembershipInfo(tenantId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: MEMBERSHIP_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    const settings = result.Item;

    if (!settings || !settings.enabled) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          enabled: false,
          message: 'Mitgliedschaft nicht verfügbar'
        })
      };
    }

    // Tenant-Info für Anzeige
    const tenantResult = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    const tenant = tenantResult.Item || {};

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        enabled: true,
        tenant_name: tenant.name || tenantId,
        title: settings.title,
        description: settings.description,
        benefits: settings.benefits,
        monthly_price: settings.monthly_price,
        currency: settings.currency
      })
    };
  } catch (error) {
    console.error('Error getting membership info:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /tenants/{tenantId}/membership/subscribe
 * Mitgliedschaft starten - erstellt Mollie Subscription
 */
async function subscribeMembership(tenantId, userId, userEmail, body) {
  try {
    const { redirectUrl, email: bodyEmail } = body;
    
    // E-Mail aus Body nehmen falls nicht im Authorizer (Access Token hat keine E-Mail)
    const finalEmail = (userEmail && userEmail !== 'unknown') ? userEmail : bodyEmail;

    if (!redirectUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'redirectUrl ist erforderlich' })
      };
    }
    
    if (!finalEmail || finalEmail === 'unknown') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'E-Mail-Adresse ist erforderlich' })
      };
    }

    // Prüfen ob Membership aktiviert ist
    const settingsResult = await docClient.send(new GetCommand({
      TableName: MEMBERSHIP_SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    const settings = settingsResult.Item;
    if (!settings || !settings.enabled) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Mitgliedschaft nicht verfügbar' })
      };
    }

    // Prüfen ob User bereits Mitglied ist
    const existingResult = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      IndexName: 'user-index',
      KeyConditionExpression: 'user_id = :userId',
      FilterExpression: 'tenant_id = :tenantId AND #status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':tenantId': tenantId,
        ':active': 'active'
      }
    }));

    if (existingResult.Items && existingResult.Items.length > 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Du bist bereits Mitglied' })
      };
    }

    // Mollie Customer erstellen oder abrufen
    let customerId;
    
    // Suche existierenden Customer (auf dem Mollie-Konto des Creators)
    const customers = await mollieRequest(tenantId, `/customers?limit=250`);
    const existingCustomer = customers._embedded?.customers?.find(c => {
      try {
        const meta = JSON.parse(c.metadata || '{}');
        return meta.userId === userId;
      } catch {
        return false;
      }
    });

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Neuen Customer erstellen (auf dem Mollie-Konto des Creators)
      const customer = await mollieRequest(tenantId, '/customers', 'POST', {
        name: finalEmail.split('@')[0],
        email: finalEmail,
        metadata: JSON.stringify({ userId, type: 'membership', tenantId })
      });
      customerId = customer.id;
    }

    // Membership ID generieren
    const membershipId = generateId('mem_');

    // Tenant-Info holen für Mollie Profile ID (falls gespeichert)
    const tenantResult = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    const tenantData = tenantResult.Item;

    // Erste Zahlung erstellen (für Mandat) - geht direkt auf Creator's Mollie-Konto
    const paymentData = {
      amount: {
        currency: settings.currency,
        value: settings.monthly_price.toFixed(2)
      },
      description: `${settings.title} - Erste Zahlung`,
      redirectUrl: `${redirectUrl}?membershipId=${membershipId}&status=success`,
      webhookUrl: `${API_BASE_URL}/membership/mollie/webhook`,
      customerId: customerId,
      sequenceType: 'first',
      metadata: JSON.stringify({
        type: 'membership_first',
        membershipId,
        tenantId,
        userId,
        userEmail: finalEmail,
        price: settings.monthly_price
      })
    };

    // Falls Tenant eine Mollie Profile ID hat, diese verwenden
    if (tenantData?.mollie_profile_id) {
      paymentData.profileId = tenantData.mollie_profile_id;
    }

    const payment = await mollieRequest(tenantId, '/payments', 'POST', paymentData);

    // Membership in DB speichern (pending)
    const now = new Date().toISOString();
    await docClient.send(new PutCommand({
      TableName: MEMBERSHIPS_TABLE,
      Item: {
        membership_id: membershipId,
        tenant_id: tenantId,
        user_id: userId,
        user_email: finalEmail,
        status: 'pending',
        mollie_customer_id: customerId,
        mollie_first_payment_id: payment.id,
        price: settings.monthly_price,
        currency: settings.currency,
        created_at: now,
        updated_at: now
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        membershipId,
        checkoutUrl: payment._links.checkout.href,
        status: 'pending'
      })
    };
  } catch (error) {
    console.error('Error subscribing:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * GET /tenants/{tenantId}/membership/my-status
 * Eigener Membership-Status
 */
async function getMyMembershipStatus(tenantId, userId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      IndexName: 'user-index',
      KeyConditionExpression: 'user_id = :userId',
      FilterExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':tenantId': tenantId
      }
    }));

    const membership = result.Items?.[0];

    if (!membership) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          isMember: false,
          status: null
        })
      };
    }

    // Zahlungshistorie
    const paymentsResult = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIP_PAYMENTS_TABLE,
      IndexName: 'membership-index',
      KeyConditionExpression: 'membership_id = :membershipId',
      ExpressionAttributeValues: {
        ':membershipId': membership.membership_id
      },
      ScanIndexForward: false,
      Limit: 10
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        isMember: membership.status === 'active',
        membership: {
          id: membership.membership_id,
          status: membership.status,
          price: membership.price,
          currency: membership.currency,
          startedAt: membership.started_at,
          cancelledAt: membership.cancelled_at,
          expiresAt: membership.expires_at
        },
        payments: paymentsResult.Items || []
      })
    };
  } catch (error) {
    console.error('Error getting my status:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /tenants/{tenantId}/membership/cancel
 * Mitgliedschaft kündigen
 */
async function cancelMembership(tenantId, userId) {
  try {
    // Aktive Membership finden
    const result = await docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      IndexName: 'user-index',
      KeyConditionExpression: 'user_id = :userId',
      FilterExpression: 'tenant_id = :tenantId AND #status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':tenantId': tenantId,
        ':active': 'active'
      }
    }));

    const membership = result.Items?.[0];

    if (!membership) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Keine aktive Mitgliedschaft gefunden' })
      };
    }

    // Mollie Subscription kündigen (auf dem Mollie-Konto des Creators)
    if (membership.mollie_subscription_id) {
      try {
        await mollieRequest(
          tenantId,
          `/customers/${membership.mollie_customer_id}/subscriptions/${membership.mollie_subscription_id}`,
          'DELETE'
        );
      } catch (error) {
        console.error('Error cancelling Mollie subscription:', error);
        // Weiter machen auch wenn Mollie fehlschlägt
      }
    }

    // Membership aktualisieren
    const now = new Date().toISOString();
    
    // Berechne Ablaufdatum (Ende des aktuellen Abrechnungszeitraums)
    const startDate = new Date(membership.started_at || membership.created_at);
    const dayOfMonth = startDate.getDate();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    expiresAt.setDate(dayOfMonth);

    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { membership_id: membership.membership_id },
      UpdateExpression: 'SET #status = :status, cancelled_at = :now, expires_at = :expires, updated_at = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':now': now,
        ':expires': expiresAt.toISOString()
      }
    }));

    // User-Tenant Premium-Status aktualisieren (cancelled = noch aktiv bis expires_at)
    await syncUserPremiumStatus(userId, tenantId, 'cancelled', membership.membership_id, expiresAt.toISOString());

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Mitgliedschaft gekündigt',
        expiresAt: expiresAt.toISOString()
      })
    };
  } catch (error) {
    console.error('Error cancelling membership:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// ============================================================
// WEBHOOK HANDLER
// ============================================================

/**
 * POST /membership/mollie/webhook
 * Mollie Webhook für Zahlungen
 */
async function handleMollieWebhook(body) {
  try {
    const { id: paymentId } = body;

    if (!paymentId) {
      return { statusCode: 200, headers: corsHeaders, body: 'OK' };
    }

    // Zuerst Membership anhand der Payment ID finden um tenantId zu bekommen
    // Die Payment ID wurde bei der Erstellung in der Membership gespeichert
    const membershipByPayment = await findMembershipByPaymentId(paymentId);
    
    if (!membershipByPayment) {
      console.log('No membership found for payment:', paymentId);
      return { statusCode: 200, headers: corsHeaders, body: 'OK' };
    }

    const webhookTenantId = membershipByPayment.tenant_id;

    // Payment Details von Mollie holen (mit dem OAuth Token des Creators)
    const payment = await mollieRequest(webhookTenantId, `/payments/${paymentId}`);
    console.log('Membership Webhook - Payment:', JSON.stringify(payment, null, 2));

    const metadata = JSON.parse(payment.metadata || '{}');
    const { type, membershipId, tenantId, userId, userEmail, price } = metadata;

    if (!membershipId) {
      console.log('No membershipId in metadata, skipping');
      return { statusCode: 200, headers: corsHeaders, body: 'OK' };
    }

    const now = new Date().toISOString();

    if (payment.status === 'paid') {
      if (type === 'membership_first') {
        // Erste Zahlung erfolgreich - Subscription erstellen
        console.log(`First payment successful for membership ${membershipId}`);

        // Settings für Subscription holen
        const settingsResult = await docClient.send(new GetCommand({
          TableName: MEMBERSHIP_SETTINGS_TABLE,
          Key: { tenant_id: tenantId }
        }));
        const settings = settingsResult.Item;

        // Mollie Subscription erstellen
        const membership = await docClient.send(new GetCommand({
          TableName: MEMBERSHIPS_TABLE,
          Key: { membership_id: membershipId }
        }));

        const customerId = membership.Item?.mollie_customer_id;

        if (customerId && settings) {
          // Nächstes Abrechnungsdatum (1 Monat ab jetzt)
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() + 1);

          // Subscription auf dem Mollie-Konto des Creators erstellen
          const subscription = await mollieRequest(tenantId, `/customers/${customerId}/subscriptions`, 'POST', {
            amount: {
              currency: settings.currency,
              value: settings.monthly_price.toFixed(2)
            },
            interval: '1 month',
            startDate: startDate.toISOString().split('T')[0],
            description: `${settings.title} - Monatlich`,
            webhookUrl: `${API_BASE_URL}/membership/mollie/webhook`,
            metadata: JSON.stringify({
              type: 'membership_recurring',
              membershipId,
              tenantId,
              userId,
              userEmail,
              price: settings.monthly_price
            })
          });

          // Membership aktivieren
          await docClient.send(new UpdateCommand({
            TableName: MEMBERSHIPS_TABLE,
            Key: { membership_id: membershipId },
            UpdateExpression: 'SET #status = :status, mollie_subscription_id = :subId, started_at = :now, updated_at = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'active',
              ':subId': subscription.id,
              ':now': now
            }
          }));

          // User-Tenant Premium-Status aktualisieren
          await syncUserPremiumStatus(userId, tenantId, 'active', membershipId);

          console.log(`Subscription ${subscription.id} created for membership ${membershipId}`);
        }

        // Zahlung speichern
        await saveMembershipPayment(membershipId, tenantId, userId, payment, price);

      } else if (type === 'membership_recurring') {
        // Wiederkehrende Zahlung
        console.log(`Recurring payment for membership ${membershipId}`);
        await saveMembershipPayment(membershipId, tenantId, userId, payment, price);
      }

    } else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
      console.log(`Payment ${payment.status} for membership ${membershipId}`);

      if (type === 'membership_first') {
        // Erste Zahlung fehlgeschlagen - Membership löschen
        await docClient.send(new UpdateCommand({
          TableName: MEMBERSHIPS_TABLE,
          Key: { membership_id: membershipId },
          UpdateExpression: 'SET #status = :status, updated_at = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'failed',
            ':now': now
          }
        }));
      } else if (type === 'membership_recurring') {
        // Wiederkehrende Zahlung fehlgeschlagen
        // TODO: Retry-Logik oder Benachrichtigung
        console.log(`Recurring payment failed for ${membershipId}`);
      }
    }

    return { statusCode: 200, headers: corsHeaders, body: 'OK' };
  } catch (error) {
    console.error('Webhook error:', error);
    return { statusCode: 200, headers: corsHeaders, body: 'Error processed' };
  }
}

/**
 * Zahlung in DB speichern
 */
async function saveMembershipPayment(membershipId, tenantId, userId, payment, price) {
  const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
  const tenantPayout = price - platformFee;

  await docClient.send(new PutCommand({
    TableName: MEMBERSHIP_PAYMENTS_TABLE,
    Item: {
      payment_id: generateId('pay_'),
      membership_id: membershipId,
      tenant_id: tenantId,
      user_id: userId,
      amount: price,
      platform_fee: platformFee,
      tenant_payout: tenantPayout,
      mollie_payment_id: payment.id,
      status: 'paid',
      paid_at: payment.paidAt || new Date().toISOString(),
      created_at: new Date().toISOString()
    }
  }));
}

// ============================================================
// MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path, pathParameters, body: rawBody, requestContext } = event;
  const body = rawBody ? JSON.parse(rawBody) : {};
  const tenantId = pathParameters?.tenantId;

  // User Info aus Authorizer
  const userId = requestContext?.authorizer?.userId || requestContext?.authorizer?.principalId;
  const userEmail = requestContext?.authorizer?.email;

  try {
    // Webhook (kein Auth)
    if (path.includes('/membership/mollie/webhook') && httpMethod === 'POST') {
      return await handleMollieWebhook(body);
    }

    // Public Info (kein Auth)
    if (path.includes('/membership/info') && httpMethod === 'GET') {
      return await getMembershipInfo(tenantId);
    }

    // Admin Endpoints
    if (path.includes('/membership/settings')) {
      if (httpMethod === 'GET') {
        return await getMembershipSettings(tenantId);
      }
      if (httpMethod === 'PUT') {
        return await saveMembershipSettings(tenantId, body);
      }
    }

    if (path.includes('/membership/members') && httpMethod === 'GET') {
      return await getMembershipMembers(tenantId);
    }

    if (path.includes('/membership/payouts') && httpMethod === 'GET') {
      return await getMembershipPayouts(tenantId);
    }

    // User Endpoints
    if (path.includes('/membership/subscribe') && httpMethod === 'POST') {
      return await subscribeMembership(tenantId, userId, userEmail, body);
    }

    if (path.includes('/membership/my-status') && httpMethod === 'GET') {
      return await getMyMembershipStatus(tenantId, userId);
    }

    if (path.includes('/membership/cancel') && httpMethod === 'POST') {
      return await cancelMembership(tenantId, userId);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
