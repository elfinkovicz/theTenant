const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const LEGAL_DOCS_TABLE = process.env.LEGAL_DOCS_TABLE_NAME;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

// Helper: Check if user is admin
function isAdmin(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  console.log('isAdmin check - claims:', JSON.stringify(claims));
  
  if (!claims) {
    console.log('isAdmin: No claims found');
    return false;
  }
  
  let groups = claims['cognito:groups'];
  console.log('isAdmin - raw groups:', groups, 'type:', typeof groups);
  
  if (!groups) {
    console.log('isAdmin: No groups found');
    return false;
  }
  
  if (typeof groups === 'string') {
    if (groups.startsWith('[') && groups.endsWith(']')) {
      const groupsStr = groups.slice(1, -1);
      groups = groupsStr.split(',').map(g => g.trim());
      console.log('isAdmin - extracted groups from brackets:', groups);
    } else {
      groups = [groups];
      console.log('isAdmin - single group:', groups);
    }
  }
  
  const result = groups.includes(ADMIN_GROUP);
  console.log('isAdmin result:', result, 'groups:', groups, 'looking for:', ADMIN_GROUP);
  return result;
}

// Helper: CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
  };
}

// Helper: Response
function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

// Default legal documents
const DEFAULT_LEGAL_DOCS = [
  {
    id: 'impressum',
    title: 'Impressum',
    content: `# Impressum

## Angaben gemäß § 5 TMG

[Ihr Name / Firmenname]
[Straße und Hausnummer]
[PLZ und Ort]

## Kontakt

E-Mail: [ihre-email@example.com]
Telefon: [Ihre Telefonnummer]

## Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV

[Name]
[Adresse]

## Haftungsausschluss

Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.`,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'datenschutz',
    title: 'Datenschutzerklärung',
    content: `# Datenschutzerklärung

## 1. Datenschutz auf einen Blick

### Allgemeine Hinweise

Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.

### Datenerfassung auf dieser Website

**Wer ist verantwortlich für die Datenerfassung auf dieser Website?**

Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.

**Wie erfassen wir Ihre Daten?**

Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben.

## 2. Hosting

Wir hosten die Inhalte unserer Website bei Amazon Web Services (AWS).

## 3. Allgemeine Hinweise und Pflichtinformationen

### Datenschutz

Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst.`,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'agb',
    title: 'Allgemeine Geschäftsbedingungen',
    content: `# Allgemeine Geschäftsbedingungen (AGB)

## § 1 Geltungsbereich

Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge, die zwischen [Ihr Unternehmen] und dem Kunden geschlossen werden.

## § 2 Vertragsschluss

(1) Die Darstellung der Produkte im Online-Shop stellt kein rechtlich bindendes Angebot, sondern einen unverbindlichen Online-Katalog dar.

(2) Durch Anklicken des Buttons "Kaufen" geben Sie eine verbindliche Bestellung ab.

## § 3 Preise und Zahlungsbedingungen

(1) Alle Preise sind Endpreise und enthalten die gesetzliche Mehrwertsteuer.

(2) Die Zahlung erfolgt über die angegebenen Zahlungsmethoden.

## § 4 Lieferung

Die Lieferung erfolgt innerhalb von Deutschland.

## § 5 Widerrufsrecht

Verbrauchern steht ein gesetzliches Widerrufsrecht zu.`,
    lastUpdated: new Date().toISOString()
  }
];

// Initialize table with default legal documents
async function initializeLegalDocs() {
  console.log('Initializing legal docs table with defaults');
  
  for (const doc of DEFAULT_LEGAL_DOCS) {
    await docClient.send(new PutCommand({
      TableName: LEGAL_DOCS_TABLE,
      Item: {
        docId: doc.id,
        ...doc,
        updatedAt: new Date().toISOString()
      }
    }));
  }
  
  console.log('Legal docs initialized successfully');
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || event.requestContext?.routeKey?.split(' ')[0];
  const path = event.requestContext?.http?.path || event.path || event.requestContext?.path || event.rawPath || event.requestContext?.resourcePath;
  
  console.log('Detected method:', method);
  console.log('Detected path:', path);

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  try {
    // GET /legal - List all legal documents (public)
    if (method === 'GET' && path === '/legal') {
      const result = await docClient.send(new ScanCommand({
        TableName: LEGAL_DOCS_TABLE
      }));

      // If no legal docs exist, initialize with defaults
      if (!result.Items || result.Items.length === 0) {
        await initializeLegalDocs();
        const newResult = await docClient.send(new ScanCommand({
          TableName: LEGAL_DOCS_TABLE
        }));
        return response(200, { legalDocs: newResult.Items || [] });
      }

      return response(200, { legalDocs: result.Items || [] });
    }

    // PUT /legal - Update legal documents (admin only)
    if (method === 'PUT' && path === '/legal') {
      if (!isAdmin(event)) {
        return response(403, { error: 'Admin access required' });
      }

      const body = JSON.parse(event.body);
      const { legalDocs } = body;

      if (!Array.isArray(legalDocs)) {
        return response(400, { error: 'Invalid request: legalDocs must be an array' });
      }

      // Update each legal document
      for (const doc of legalDocs) {
        await docClient.send(new PutCommand({
          TableName: LEGAL_DOCS_TABLE,
          Item: {
            docId: doc.id,
            ...doc,
            lastUpdated: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }));
      }

      return response(200, { message: 'Legal documents updated successfully' });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
