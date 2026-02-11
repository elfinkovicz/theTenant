/**
 * Mollie Connect Handlers for ViralTenant
 * 
 * Ermöglicht Creatoren, ihr eigenes Mollie-Konto zu verbinden,
 * um Mitglieder-Abonnements direkt abzurechnen.
 * 
 * OAuth Flow:
 * 1. Creator klickt "Mit Mollie verbinden"
 * 2. Redirect zu Mollie OAuth
 * 3. Creator autorisiert die App
 * 4. Callback mit Authorization Code
 * 5. Code gegen Access Token tauschen
 * 6. Token speichern für API-Calls im Namen des Creators
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TENANTS_TABLE = process.env.TENANTS_TABLE || 'viraltenant-tenants-production';
const BILLING_TABLE = process.env.BILLING_TABLE || 'viraltenant-billing-production';
const MEMBERSHIPS_TABLE = process.env.MEMBERSHIPS_TABLE || 'viraltenant-memberships-production';

// Mollie Connect Configuration
const MOLLIE_CLIENT_ID = process.env.MOLLIE_CLIENT_ID || 'app_GYccPvztAbzr4FsyGXAnmt6A';
const MOLLIE_CLIENT_SECRET = process.env.MOLLIE_CLIENT_SECRET || 'PEyPUKrUQKAvf8sE3Sj7ssQv4aEC4R4HW7QaMS3b';
const MOLLIE_REDIRECT_URI = process.env.MOLLIE_REDIRECT_URI || 'https://viraltenant.com/mollie-callback';
const MOLLIE_BASE_URL = 'https://api.mollie.com/v2';
// Authorize URL ist www.mollie.com (User-facing), Token URL ist api.mollie.com
const MOLLIE_OAUTH_AUTHORIZE_URL = 'https://www.mollie.com/oauth2';
const MOLLIE_OAUTH_TOKEN_URL = 'https://api.mollie.com/oauth2';

// Test API Key für Entwicklung (dein Key)
const MOLLIE_TEST_API_KEY = process.env.MOLLIE_TEST_API_KEY || 'test_AFJDu3aGV4RbDmNgvhU85BQn4fznhA';
const MOLLIE_PROFILE_ID = process.env.MOLLIE_PROFILE_ID || 'pfl_Ag7i7PW7sH';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Mollie API Request Helper (für OAuth Access Tokens)
 */
async function mollieOAuthRequest(accessToken, endpoint, method = 'GET', body = null) {
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
    console.error('Mollie OAuth API Error:', error);
    throw new Error(error.detail || `Mollie API Error: ${response.status}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

/**
 * GET /billing/mollie/connect/authorize/{tenantId}
 * Generiert die OAuth-URL für den Creator
 */
async function getConnectAuthorizeUrl(tenantId, body) {
  try {
    if (!MOLLIE_CLIENT_ID) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Mollie Connect nicht konfiguriert (Client ID fehlt)' })
      };
    }

    const { redirectUrl } = body || {};
    
    // State für CSRF-Schutz und Tenant-Zuordnung
    const state = Buffer.from(JSON.stringify({
      tenantId,
      timestamp: Date.now(),
      redirectUrl: redirectUrl || `https://${tenantId}.viraltenant.com/tenant`
    })).toString('base64');

    // OAuth Scopes für Mitglieder-Abrechnung
    const scopes = [
      'payments.read',
      'payments.write',
      'customers.read',
      'customers.write',
      'mandates.read',
      'mandates.write',
      'subscriptions.read',
      'subscriptions.write',
      'profiles.read',
      'organizations.read'
    ].join(' ');

    const authUrl = new URL(`${MOLLIE_OAUTH_AUTHORIZE_URL}/authorize`);
    authUrl.searchParams.set('client_id', MOLLIE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', MOLLIE_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('approval_prompt', 'auto');

    console.log('Mollie Connect Authorize URL generated:', authUrl.toString());
    console.log('Redirect URI:', MOLLIE_REDIRECT_URI);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        authorizeUrl: authUrl.toString(),
        state
      })
    };
  } catch (error) {
    console.error('Error generating authorize URL:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * GET /billing/mollie/connect/callback
 * OAuth Callback - tauscht Code gegen Access Token
 * 
 * Gibt JSON zurück (für fetch-Aufrufe vom Frontend).
 * Das Frontend übernimmt dann den Redirect.
 */
async function handleConnectCallback(queryParams) {
  try {
    const { code, state, error, error_description } = queryParams;

    if (error) {
      console.error('Mollie OAuth Error:', error, error_description);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          error: error_description || error 
        })
      };
    }

    if (!code || !state) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          error: 'Code oder State fehlt' 
        })
      };
    }

    // State dekodieren
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          error: 'Ungültiger State' 
        })
      };
    }

    const { tenantId, redirectUrl } = stateData;

    // Code gegen Access Token tauschen
    console.log('Token exchange request:', {
      grant_type: 'authorization_code',
      code: code.substring(0, 10) + '...',
      redirect_uri: MOLLIE_REDIRECT_URI,
      client_id: MOLLIE_CLIENT_ID
    });

    const tokenResponse = await fetch(`${MOLLIE_OAUTH_TOKEN_URL}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: MOLLIE_REDIRECT_URI,
        client_id: MOLLIE_CLIENT_ID,
        client_secret: MOLLIE_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange error:', {
        status: tokenResponse.status,
        error: errorData,
        usedRedirectUri: MOLLIE_REDIRECT_URI,
        usedClientId: MOLLIE_CLIENT_ID
      });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          error: errorData.error_description || errorData.error || 'Token-Austausch fehlgeschlagen',
          details: errorData
        })
      };
    }

    const tokens = await tokenResponse.json();
    
    // Mollie Organization Info abrufen
    const orgInfo = await mollieOAuthRequest(tokens.access_token, '/organizations/me');

    // Mollie Profiles abrufen (für Zahlungen benötigt)
    let profileId = null;
    try {
      const profiles = await mollieOAuthRequest(tokens.access_token, '/profiles');
      if (profiles._embedded?.profiles?.length > 0) {
        // Erstes aktives Profil verwenden
        const activeProfile = profiles._embedded.profiles.find(p => p.status === 'verified' || p.status === 'unverified') 
                            || profiles._embedded.profiles[0];
        profileId = activeProfile?.id;
        console.log('Found Mollie profile:', profileId, activeProfile?.name);
      }
    } catch (profileError) {
      console.warn('Could not fetch Mollie profiles:', profileError.message);
    }

    // Tokens, Org-Info und Profile speichern
    const updateExpression = profileId 
      ? `SET 
        mollie_connect_access_token = :accessToken,
        mollie_connect_refresh_token = :refreshToken,
        mollie_connect_expires_at = :expiresAt,
        mollie_connect_organization_id = :orgId,
        mollie_connect_organization_name = :orgName,
        mollie_profile_id = :profileId,
        mollie_connect_status = :status,
        mollie_connect_connected_at = :connectedAt,
        updated_at = :now`
      : `SET 
        mollie_connect_access_token = :accessToken,
        mollie_connect_refresh_token = :refreshToken,
        mollie_connect_expires_at = :expiresAt,
        mollie_connect_organization_id = :orgId,
        mollie_connect_organization_name = :orgName,
        mollie_connect_status = :status,
        mollie_connect_connected_at = :connectedAt,
        updated_at = :now`;

    const expressionValues = {
      ':accessToken': tokens.access_token,
      ':refreshToken': tokens.refresh_token,
      ':expiresAt': new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      ':orgId': orgInfo.id,
      ':orgName': orgInfo.name,
      ':status': 'connected',
      ':connectedAt': new Date().toISOString(),
      ':now': new Date().toISOString()
    };
    
    if (profileId) {
      expressionValues[':profileId'] = profileId;
    }

    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues
    }));

    console.log(`Mollie Connect erfolgreich für Tenant ${tenantId}: ${orgInfo.name}, Profile: ${profileId}`);

    // JSON Response für Frontend (kein Redirect mehr)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        tenantId,
        organizationId: orgInfo.id,
        organizationName: orgInfo.name,
        redirectUrl: redirectUrl || `https://${tenantId}.viraltenant.com/tenant`
      })
    };
  } catch (error) {
    console.error('Callback error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
}

/**
 * GET /billing/mollie/connect/status/{tenantId}
 * Prüft ob Creator Mollie Connect verbunden hat
 */
async function getConnectStatus(tenantId) {
  try {
    const tenant = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    if (!tenant.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Tenant nicht gefunden' })
      };
    }

    const isConnected = tenant.Item.mollie_connect_status === 'connected';
    const isExpired = tenant.Item.mollie_connect_expires_at && 
                      new Date(tenant.Item.mollie_connect_expires_at) < new Date();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        connected: isConnected && !isExpired,
        organizationId: tenant.Item.mollie_connect_organization_id,
        organizationName: tenant.Item.mollie_connect_organization_name,
        connectedAt: tenant.Item.mollie_connect_connected_at,
        needsReconnect: isExpired
      })
    };
  } catch (error) {
    console.error('Error getting connect status:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * DELETE /billing/mollie/connect/{tenantId}
 * Trennt Mollie Connect Verbindung
 */
async function disconnectMollie(tenantId) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: `SET 
        mollie_connect_status = :status,
        mollie_connect_disconnected_at = :now,
        updated_at = :now
        REMOVE mollie_connect_access_token, mollie_connect_refresh_token`,
      ExpressionAttributeValues: {
        ':status': 'disconnected',
        ':now': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Mollie Connect getrennt' })
    };
  } catch (error) {
    console.error('Error disconnecting:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * Refresh Access Token wenn abgelaufen
 */
async function refreshAccessToken(tenantId) {
  const tenant = await docClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  }));

  if (!tenant.Item?.mollie_connect_refresh_token) {
    throw new Error('Kein Refresh Token vorhanden');
  }

  const tokenResponse = await fetch(`${MOLLIE_OAUTH_TOKEN_URL}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tenant.Item.mollie_connect_refresh_token,
      client_id: MOLLIE_CLIENT_ID,
      client_secret: MOLLIE_CLIENT_SECRET
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh fehlgeschlagen');
  }

  const tokens = await tokenResponse.json();

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
      ':expiresAt': new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      ':now': new Date().toISOString()
    }
  }));

  return tokens.access_token;
}

/**
 * Helper: Get valid access token (refresh if needed)
 */
async function getValidAccessToken(tenantId) {
  const tenant = await docClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenant_id: tenantId }
  }));

  if (!tenant.Item?.mollie_connect_access_token) {
    throw new Error('Mollie Connect nicht verbunden');
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tenant.Item.mollie_connect_expires_at);
  if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshAccessToken(tenantId);
  }

  return tenant.Item.mollie_connect_access_token;
}


// ============================================================
// MITGLIEDER-ABRECHNUNG (Creator → Mitglieder)
// ============================================================

/**
 * POST /billing/mollie/connect/create-member-customer/{tenantId}
 * Erstellt einen Mollie-Kunden für ein Mitglied im Creator-Account
 */
async function createMemberCustomer(tenantId, body) {
  try {
    const { memberId, name, email } = body;

    if (!memberId || !email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'memberId und email sind erforderlich' })
      };
    }

    const accessToken = await getValidAccessToken(tenantId);

    // Kunde im Creator's Mollie-Account erstellen
    const customer = await mollieOAuthRequest(accessToken, '/customers', 'POST', {
      name: name || email,
      email,
      metadata: JSON.stringify({
        tenantId,
        memberId,
        type: 'membership_subscriber'
      })
    });

    // Speichern in Memberships-Tabelle
    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { 
        tenant_id: tenantId,
        member_id: memberId 
      },
      UpdateExpression: `SET 
        mollie_customer_id = :customerId,
        mollie_customer_email = :email,
        updated_at = :now`,
      ExpressionAttributeValues: {
        ':customerId': customer.id,
        ':email': email,
        ':now': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        customerId: customer.id,
        message: 'Mitglied-Kunde erstellt'
      })
    };
  } catch (error) {
    console.error('Error creating member customer:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/connect/create-member-subscription/{tenantId}
 * Erstellt ein Mollie-Abo für ein Mitglied
 */
async function createMemberSubscription(tenantId, body) {
  try {
    const { memberId, customerId, amount, description, interval = '1 month', webhookUrl } = body;

    if (!customerId || !amount) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'customerId und amount sind erforderlich' })
      };
    }

    const accessToken = await getValidAccessToken(tenantId);

    // Prüfen ob Kunde ein gültiges Mandat hat
    const mandates = await mollieOAuthRequest(accessToken, `/customers/${customerId}/mandates`);
    const validMandate = mandates._embedded?.mandates?.find(m => m.status === 'valid');

    if (!validMandate) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Kein gültiges Mandat vorhanden',
          needsMandate: true
        })
      };
    }

    // Subscription erstellen
    const subscription = await mollieOAuthRequest(
      accessToken, 
      `/customers/${customerId}/subscriptions`, 
      'POST', 
      {
        amount: {
          currency: 'EUR',
          value: parseFloat(amount).toFixed(2)
        },
        interval,
        description: description || `Mitgliedschaft bei ${tenantId}`,
        webhookUrl: webhookUrl || `${process.env.API_BASE_URL}/billing/mollie/connect/webhook`,
        metadata: JSON.stringify({
          tenantId,
          memberId,
          type: 'membership'
        })
      }
    );

    // Speichern
    if (memberId) {
      await docClient.send(new UpdateCommand({
        TableName: MEMBERSHIPS_TABLE,
        Key: { 
          tenant_id: tenantId,
          member_id: memberId 
        },
        UpdateExpression: `SET 
          mollie_subscription_id = :subId,
          mollie_subscription_status = :status,
          subscription_amount = :amount,
          subscription_interval = :interval,
          subscription_started_at = :now,
          updated_at = :now`,
        ExpressionAttributeValues: {
          ':subId': subscription.id,
          ':status': subscription.status,
          ':amount': parseFloat(amount),
          ':interval': interval,
          ':now': new Date().toISOString()
        }
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        subscriptionId: subscription.id,
        status: subscription.status,
        nextPaymentDate: subscription.nextPaymentDate,
        message: 'Mitglied-Abo erstellt'
      })
    };
  } catch (error) {
    console.error('Error creating member subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/connect/create-member-mandate/{tenantId}
 * Erstellt erste Zahlung für SEPA-Mandat eines Mitglieds
 */
async function createMemberMandate(tenantId, body) {
  try {
    const { memberId, customerId, redirectUrl, amount = '0.01' } = body;

    if (!customerId || !redirectUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'customerId und redirectUrl sind erforderlich' })
      };
    }

    const accessToken = await getValidAccessToken(tenantId);

    // Erste Zahlung für Mandat-Erstellung
    const payment = await mollieOAuthRequest(accessToken, '/payments', 'POST', {
      amount: {
        currency: 'EUR',
        value: amount
      },
      description: `Zahlungsmethode einrichten - ${tenantId}`,
      redirectUrl: `${redirectUrl}?memberId=${memberId}&tenantId=${tenantId}`,
      webhookUrl: `${process.env.API_BASE_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production'}/billing/mollie/connect/webhook`,
      customerId,
      sequenceType: 'first',
      metadata: JSON.stringify({
        tenantId,
        memberId,
        type: 'member_mandate_setup'
      })
    });

    // Speichere Payment ID für Webhook-Zuordnung
    if (memberId) {
      await docClient.send(new UpdateCommand({
        TableName: MEMBERSHIPS_TABLE,
        Key: { tenant_id: tenantId, member_id: memberId },
        UpdateExpression: `SET 
          mollie_setup_payment_id = :paymentId,
          mollie_customer_id = :customerId,
          updated_at = :now`,
        ExpressionAttributeValues: {
          ':paymentId': payment.id,
          ':customerId': customerId,
          ':now': new Date().toISOString()
        }
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentId: payment.id,
        checkoutUrl: payment._links.checkout.href,
        status: payment.status
      })
    };
  } catch (error) {
    console.error('Error creating member mandate:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * POST /billing/mollie/connect/webhook
 * Webhook für Mitglieder-Zahlungen
 * 
 * Mollie sendet hier Benachrichtigungen über Zahlungsstatus-Änderungen.
 * Wir müssen den Tenant finden und dessen Access Token nutzen um Details abzurufen.
 */
async function handleConnectWebhook(body) {
  try {
    const { id: paymentId } = body;

    if (!paymentId) {
      return { statusCode: 400, headers: corsHeaders, body: 'Payment ID required' };
    }

    console.log('Mollie Connect Webhook received:', paymentId);

    // Schritt 1: Finde die Zahlung in unserer DB um den Tenant zu identifizieren
    // Wir speichern Payment IDs bei der Erstellung in der Memberships-Tabelle
    const paymentRecord = await findPaymentByMollieId(paymentId);
    
    if (!paymentRecord) {
      // Fallback: Versuche alle Tenants mit Mollie Connect durchzugehen
      // Das ist ineffizient, aber funktioniert als Fallback
      console.log('Payment not found in DB, trying to find tenant...');
      const result = await processWebhookForUnknownPayment(paymentId);
      return result;
    }

    const { tenantId, memberId } = paymentRecord;

    // Schritt 2: Hole Access Token des Creators
    const accessToken = await getValidAccessToken(tenantId);

    // Schritt 3: Hole Payment-Details von Mollie
    const payment = await mollieOAuthRequest(accessToken, `/payments/${paymentId}`);
    console.log('Payment status:', payment.status, 'for tenant:', tenantId);

    // Schritt 4: Verarbeite basierend auf Status
    await processPaymentStatus(tenantId, memberId, payment);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'OK'
    };
  } catch (error) {
    console.error('Connect webhook error:', error);
    // Immer 200 zurückgeben um Mollie-Retries zu vermeiden
    return { statusCode: 200, headers: corsHeaders, body: 'Error processed' };
  }
}

/**
 * Finde Payment-Record anhand der Mollie Payment ID
 */
async function findPaymentByMollieId(paymentId) {
  try {
    // Suche in der Memberships-Tabelle nach der Payment ID
    const result = await docClient.send(new ScanCommand({
      TableName: MEMBERSHIPS_TABLE,
      FilterExpression: 'mollie_payment_id = :paymentId OR mollie_setup_payment_id = :paymentId',
      ExpressionAttributeValues: {
        ':paymentId': paymentId
      }
    }));

    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      return {
        tenantId: item.tenant_id,
        memberId: item.member_id
      };
    }

    return null;
  } catch (error) {
    console.error('Error finding payment:', error);
    return null;
  }
}

/**
 * Fallback: Versuche Payment bei allen verbundenen Tenants zu finden
 */
async function processWebhookForUnknownPayment(paymentId) {
  try {
    // Finde alle Tenants mit aktivem Mollie Connect
    const tenantsResult = await docClient.send(new ScanCommand({
      TableName: TENANTS_TABLE,
      FilterExpression: 'mollie_connect_status = :status',
      ExpressionAttributeValues: {
        ':status': 'connected'
      }
    }));

    for (const tenant of tenantsResult.Items || []) {
      try {
        const accessToken = await getValidAccessToken(tenant.tenant_id);
        const payment = await mollieOAuthRequest(accessToken, `/payments/${paymentId}`);
        
        // Gefunden! Verarbeite die Zahlung
        const metadata = JSON.parse(payment.metadata || '{}');
        await processPaymentStatus(tenant.tenant_id, metadata.memberId, payment);
        
        console.log('Found payment for tenant:', tenant.tenant_id);
        return { statusCode: 200, headers: corsHeaders, body: 'OK' };
      } catch (e) {
        // Payment gehört nicht zu diesem Tenant, weiter zum nächsten
        continue;
      }
    }

    console.log('Payment not found for any tenant:', paymentId);
    return { statusCode: 200, headers: corsHeaders, body: 'OK' };
  } catch (error) {
    console.error('Error in fallback webhook processing:', error);
    return { statusCode: 200, headers: corsHeaders, body: 'Error processed' };
  }
}

/**
 * Verarbeite Payment-Status und aktualisiere Membership
 */
async function processPaymentStatus(tenantId, memberId, payment) {
  const metadata = JSON.parse(payment.metadata || '{}');
  const paymentType = metadata.type || 'unknown';

  console.log(`Processing payment ${payment.id}: status=${payment.status}, type=${paymentType}`);

  switch (payment.status) {
    case 'paid':
      await handleSuccessfulPayment(tenantId, memberId, payment, paymentType);
      break;

    case 'failed':
    case 'canceled':
    case 'expired':
      await handleFailedPayment(tenantId, memberId, payment, paymentType);
      break;

    case 'pending':
    case 'open':
      // Noch in Bearbeitung, nichts tun
      console.log(`Payment ${payment.id} is ${payment.status}, waiting...`);
      break;

    default:
      console.log(`Unknown payment status: ${payment.status}`);
  }
}

/**
 * Erfolgreiche Zahlung verarbeiten
 */
async function handleSuccessfulPayment(tenantId, memberId, payment, paymentType) {
  console.log(`Successful payment for member ${memberId} in tenant ${tenantId}`);

  if (paymentType === 'member_mandate_setup') {
    // SEPA-Mandat wurde erfolgreich eingerichtet
    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { tenant_id: tenantId, member_id: memberId },
      UpdateExpression: `SET 
        mollie_mandate_id = :mandateId,
        mollie_mandate_status = :status,
        mandate_created_at = :now,
        updated_at = :now`,
      ExpressionAttributeValues: {
        ':mandateId': payment.mandateId,
        ':status': 'valid',
        ':now': new Date().toISOString()
      }
    }));
    console.log(`Mandate ${payment.mandateId} created for member ${memberId}`);
  } else {
    // Reguläre Mitgliedschafts-Zahlung
    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { tenant_id: tenantId, member_id: memberId },
      UpdateExpression: `SET 
        membership_status = :status,
        last_payment_at = :paidAt,
        last_payment_amount = :amount,
        payment_failures = :zero,
        updated_at = :now`,
      ExpressionAttributeValues: {
        ':status': 'active',
        ':paidAt': payment.paidAt || new Date().toISOString(),
        ':amount': parseFloat(payment.amount.value),
        ':zero': 0,
        ':now': new Date().toISOString()
      }
    }));
    console.log(`Membership activated for member ${memberId}`);
  }
}

/**
 * Fehlgeschlagene Zahlung verarbeiten
 */
async function handleFailedPayment(tenantId, memberId, payment, paymentType) {
  console.log(`Failed payment (${payment.status}) for member ${memberId} in tenant ${tenantId}`);

  const failureReason = payment.details?.failureReason || payment.status;

  if (paymentType === 'member_mandate_setup') {
    // Mandat-Einrichtung fehlgeschlagen
    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { tenant_id: tenantId, member_id: memberId },
      UpdateExpression: `SET 
        mollie_mandate_status = :status,
        mandate_failure_reason = :reason,
        updated_at = :now`,
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':reason': failureReason,
        ':now': new Date().toISOString()
      }
    }));
  } else {
    // Mitgliedschafts-Zahlung fehlgeschlagen
    // Erhöhe Failure-Counter und setze Status auf "payment_failed"
    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { tenant_id: tenantId, member_id: memberId },
      UpdateExpression: `SET 
        membership_status = :status,
        payment_failure_reason = :reason,
        payment_failures = if_not_exists(payment_failures, :zero) + :one,
        last_payment_failed_at = :now,
        updated_at = :now`,
      ExpressionAttributeValues: {
        ':status': 'payment_failed',
        ':reason': failureReason,
        ':zero': 0,
        ':one': 1,
        ':now': new Date().toISOString()
      }
    }));

    // TODO: Optional - Benachrichtigung an Mitglied senden
    // TODO: Optional - Nach X Fehlversuchen Mitgliedschaft pausieren
  }
}

/**
 * GET /billing/mollie/connect/member-subscriptions/{tenantId}
 * Liste aller Mitglieder-Abos eines Creators
 */
async function getMemberSubscriptions(tenantId) {
  try {
    const accessToken = await getValidAccessToken(tenantId);

    // Alle Kunden des Creators abrufen
    const customers = await mollieOAuthRequest(accessToken, '/customers?limit=250');
    
    const subscriptions = [];
    
    for (const customer of customers._embedded?.customers || []) {
      try {
        const metadata = JSON.parse(customer.metadata || '{}');
        if (metadata.type === 'membership_subscriber') {
          // Subscriptions für diesen Kunden abrufen
          const subs = await mollieOAuthRequest(
            accessToken, 
            `/customers/${customer.id}/subscriptions`
          );
          
          for (const sub of subs._embedded?.subscriptions || []) {
            subscriptions.push({
              subscriptionId: sub.id,
              customerId: customer.id,
              customerName: customer.name,
              customerEmail: customer.email,
              memberId: metadata.memberId,
              amount: sub.amount,
              interval: sub.interval,
              status: sub.status,
              nextPaymentDate: sub.nextPaymentDate,
              createdAt: sub.createdAt
            });
          }
        }
      } catch (e) {
        console.log('Error processing customer:', customer.id, e.message);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ subscriptions })
    };
  } catch (error) {
    console.error('Error getting member subscriptions:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * DELETE /billing/mollie/connect/member-subscription/{tenantId}/{subscriptionId}
 * Kündigt ein Mitglieder-Abo
 */
async function cancelMemberSubscription(tenantId, subscriptionId, customerId) {
  try {
    const accessToken = await getValidAccessToken(tenantId);

    await mollieOAuthRequest(
      accessToken,
      `/customers/${customerId}/subscriptions/${subscriptionId}`,
      'DELETE'
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Abo gekündigt' })
    };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

module.exports = {
  getConnectAuthorizeUrl,
  handleConnectCallback,
  getConnectStatus,
  disconnectMollie,
  createMemberCustomer,
  createMemberSubscription,
  createMemberMandate,
  handleConnectWebhook,
  getMemberSubscriptions,
  cancelMemberSubscription,
  getValidAccessToken,
  mollieOAuthRequest
};
