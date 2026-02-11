/**
 * WhatsApp Subscription Handler Lambda
 * 
 * Processes incoming WhatsApp messages for subscription management.
 * Users can subscribe/unsubscribe to tenant updates via WhatsApp.
 * 
 * Commands:
 * - START <tenant_subdomain> - Subscribe to a tenant's updates
 * - STOP <tenant_subdomain> - Unsubscribe from a tenant's updates
 * - STOP ALL - Unsubscribe from all tenants
 * - LIST - List all subscriptions
 * - HELP - Show available commands
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SocialMessagingClient, SendWhatsAppMessageCommand } = require('@aws-sdk/client-socialmessaging');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const socialMessaging = new SocialMessagingClient({ region: process.env.REGION });

const SUBSCRIBERS_TABLE = process.env.SUBSCRIBERS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;
const TENANTS_TABLE = process.env.TENANTS_TABLE;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const DISPLAY_NAME = process.env.WHATSAPP_DISPLAY_NAME || 'Viral Tenant';

/**
 * Send WhatsApp message using AWS End User Messaging Social
 */
async function sendWhatsAppMessage(to, text) {
  // Ensure phone number has + prefix for international format
  const formattedTo = to.startsWith('+') ? to : `+${to}`;
  
  const message = {
    messaging_product: 'whatsapp',
    to: formattedTo,
    type: 'text',
    text: { body: text }
  };

  try {
    const command = new SendWhatsAppMessageCommand({
      originationPhoneNumberId: PHONE_NUMBER_ID,
      message: Buffer.from(JSON.stringify(message)),
      metaApiVersion: 'v20.0'
    });

    const response = await socialMessaging.send(command);
    console.log('Message sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Find tenant by subdomain (subscribe code = subdomain)
 * Special cases:
 * - "platform" maps to subdomain "www"
 * - "viraltenant" maps to subdomain "www" (Platform Tenant's custom code)
 */
async function findTenantBySubscribeCode(code) {
  const normalizedCode = code.toLowerCase();
  
  // Special cases that map to the platform tenant (subdomain "www")
  const platformCodes = ['platform', 'viraltenant'];
  const subdomainToSearch = platformCodes.includes(normalizedCode) ? 'www' : normalizedCode;
  
  try {
    // Search by subdomain (subscribeCode is always the subdomain now)
    const subdomainResult = await dynamodb.send(new QueryCommand({
      TableName: TENANTS_TABLE,
      IndexName: 'subdomain-index',
      KeyConditionExpression: 'subdomain = :subdomain',
      ExpressionAttributeValues: { ':subdomain': subdomainToSearch }
    }));

    if (subdomainResult.Items?.[0]) {
      console.log(`Found tenant by subdomain: ${subdomainResult.Items[0].tenant_id}`);
      return subdomainResult.Items[0];
    }

    console.log(`No tenant found for code: ${normalizedCode}`);
    return null;
  } catch (error) {
    console.error('Error finding tenant:', error);
    return null;
  }
}

/**
 * Check if tenant has WhatsApp enabled
 */
async function isTenantWhatsAppEnabled(tenantId) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { tenant_id: tenantId }
    }));

    return result.Item?.enabled === true;
  } catch (error) {
    console.error('Error checking tenant settings:', error);
    return false;
  }
}

/**
 * Subscribe user to tenant
 */
async function subscribe(phoneNumber, tenantId, tenantName) {
  await dynamodb.send(new PutCommand({
    TableName: SUBSCRIBERS_TABLE,
    Item: {
      tenant_id: tenantId,
      phone_number: phoneNumber,
      tenant_name: tenantName,
      subscribed_at: new Date().toISOString(),
      status: 'active'
    }
  }));
}

/**
 * Unsubscribe user from tenant
 */
async function unsubscribe(phoneNumber, tenantId) {
  await dynamodb.send(new DeleteCommand({
    TableName: SUBSCRIBERS_TABLE,
    Key: {
      tenant_id: tenantId,
      phone_number: phoneNumber
    }
  }));
}

/**
 * Get all subscriptions for a phone number
 */
async function getSubscriptions(phoneNumber) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: SUBSCRIBERS_TABLE,
    IndexName: 'phone-number-index',
    KeyConditionExpression: 'phone_number = :phone',
    ExpressionAttributeValues: { ':phone': phoneNumber }
  }));

  return result.Items || [];
}

/**
 * Unsubscribe from all tenants
 */
async function unsubscribeAll(phoneNumber) {
  const subscriptions = await getSubscriptions(phoneNumber);
  
  for (const sub of subscriptions) {
    await unsubscribe(phoneNumber, sub.tenant_id);
  }

  return subscriptions.length;
}

/**
 * Process incoming message
 */
async function processMessage(from, text) {
  const normalizedText = text.trim().toUpperCase();
  const parts = normalizedText.split(/\s+/);
  const command = parts[0];
  const argument = parts.slice(1).join(' ').toLowerCase();

  console.log(`Processing command: ${command}, argument: ${argument}, from: ${from}`);

  // HELP command
  if (command === 'HELP' || command === 'HILFE' || command === '?') {
    return `📱 *${DISPLAY_NAME} WhatsApp Updates*

Verfügbare Befehle:

✅ *START <kanal>* - Updates von einem Kanal abonnieren
   Beispiel: START meinkanal

❌ *STOP <kanal>* - Updates von einem Kanal abbestellen
   Beispiel: STOP meinkanal

🚫 *STOP ALL* - Alle Abonnements beenden

📋 *LIST* - Deine Abonnements anzeigen

❓ *HELP* - Diese Hilfe anzeigen`;
  }

  // LIST command
  if (command === 'LIST' || command === 'LISTE') {
    const subscriptions = await getSubscriptions(from);
    
    if (subscriptions.length === 0) {
      return `📋 Du hast noch keine Abonnements.

Sende *START <kanal>* um Updates zu erhalten.`;
    }

    const list = subscriptions.map(s => `• ${s.tenant_name || s.tenant_id}`).join('\n');
    return `📋 *Deine Abonnements (${subscriptions.length}):*

${list}

Sende *STOP <kanal>* um ein Abo zu beenden.`;
  }

  // STOP ALL command
  if (command === 'STOP' && argument === 'all') {
    const count = await unsubscribeAll(from);
    
    if (count === 0) {
      return `ℹ️ Du hattest keine aktiven Abonnements.`;
    }

    return `✅ Du hast ${count} Abonnement(s) beendet.

Du erhältst keine weiteren Updates mehr.`;
  }

  // START command
  if (command === 'START') {
    if (!argument) {
      return `⚠️ Bitte gib einen Kanal an.

Beispiel: *START meinkanal*`;
    }

    const tenant = await findTenantBySubscribeCode(argument);
    
    if (!tenant) {
      return `❌ Kanal "${argument}" nicht gefunden.

Bitte überprüfe den Namen und versuche es erneut.`;
    }

    const isEnabled = await isTenantWhatsAppEnabled(tenant.tenant_id);
    
    if (!isEnabled) {
      return `❌ Der Kanal "${tenant.name || argument}" hat WhatsApp-Updates nicht aktiviert.`;
    }

    // Check if already subscribed
    const subscriptions = await getSubscriptions(from);
    const alreadySubscribed = subscriptions.some(s => s.tenant_id === tenant.tenant_id);
    
    if (alreadySubscribed) {
      return `ℹ️ Du erhältst bereits Updates von *${tenant.name || argument}*.`;
    }

    await subscribe(from, tenant.tenant_id, tenant.name || argument);

    return `✅ *Erfolgreich abonniert!*

Du erhältst jetzt Updates von *${tenant.name || argument}*.

Sende *STOP ${argument}* um das Abo zu beenden.`;
  }

  // STOP command
  if (command === 'STOP') {
    if (!argument) {
      return `⚠️ Bitte gib einen Kanal an.

Beispiel: *STOP meinkanal*

Oder sende *STOP ALL* um alle Abos zu beenden.`;
    }

    const tenant = await findTenantBySubscribeCode(argument);
    
    if (!tenant) {
      return `❌ Kanal "${argument}" nicht gefunden.`;
    }

    // Check if subscribed
    const subscriptions = await getSubscriptions(from);
    const isSubscribed = subscriptions.some(s => s.tenant_id === tenant.tenant_id);
    
    if (!isSubscribed) {
      return `ℹ️ Du hast *${tenant.name || argument}* nicht abonniert.`;
    }

    await unsubscribe(from, tenant.tenant_id);

    return `✅ Abonnement von *${tenant.name || argument}* beendet.

Du erhältst keine weiteren Updates mehr von diesem Kanal.`;
  }

  // Unknown command - show help
  return `❓ Unbekannter Befehl.

Sende *HELP* für eine Liste der verfügbaren Befehle.`;
}

/**
 * Lambda Handler - processes SNS messages from AWS End User Messaging Social
 */
exports.handler = async (event) => {
  console.log('WhatsApp Subscription Handler received:', JSON.stringify(event));

  try {
    // Handle SNS event
    for (const record of event.Records || []) {
      if (record.Sns) {
        const snsMessage = JSON.parse(record.Sns.Message);
        console.log('SNS Message:', JSON.stringify(snsMessage));

        // AWS End User Messaging Social format:
        // whatsAppWebhookEntry is a JSON string that needs to be parsed
        let webhookEntry;
        if (snsMessage.whatsAppWebhookEntry) {
          webhookEntry = JSON.parse(snsMessage.whatsAppWebhookEntry);
        } else {
          // Fallback for direct webhook format
          webhookEntry = snsMessage;
        }

        console.log('Webhook Entry:', JSON.stringify(webhookEntry));

        // Extract messages from the webhook entry
        const changes = webhookEntry.changes || [];
        for (const change of changes) {
          const value = change.value;
          const messages = value?.messages || [];

          for (const msg of messages) {
            if (msg.type === 'text') {
              const from = msg.from;
              const text = msg.text?.body || '';

              console.log(`Processing message from ${from}: ${text}`);

              const response = await processMessage(from, text);
              await sendWhatsAppMessage(from, response);
            }
          }
        }
      }
    }

    // Handle direct invocation (for testing)
    if (event.from && event.text) {
      const response = await processMessage(event.from, event.text);
      await sendWhatsAppMessage(event.from, response);
      return { statusCode: 200, body: response };
    }

    return { statusCode: 200, body: 'OK' };

  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
    return { statusCode: 500, error: error.message };
  }
};
