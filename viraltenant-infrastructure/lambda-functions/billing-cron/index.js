const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const PDFDocument = require('pdfkit');

const ddbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ses = new SESClient({ region: process.env.REGION || 'eu-central-1' });
const s3 = new S3Client({ region: process.env.REGION || 'eu-central-1' });
const ce = new CostExplorerClient({ region: process.env.REGION || 'eu-central-1' });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION || 'eu-central-1' });

const TENANTS_TABLE = process.env.TENANTS_TABLE || 'viraltenant-tenants-production';
const INVOICES_TABLE = process.env.INVOICES_TABLE || 'viraltenant-invoices-production';
const BILLING_TABLE = process.env.BILLING_TABLE || 'viraltenant-billing-production';
const USER_TENANTS_TABLE = process.env.USER_TENANTS_TABLE || 'viraltenant-user-tenants-production';
const AI_USAGE_TABLE = process.env.AI_USAGE_TABLE || 'viraltenant-ai-usage-production';
const INVOICES_BUCKET = process.env.INVOICES_BUCKET || 'viraltenant-invoices-production';
const USER_POOL_ID = process.env.USER_POOL_ID;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'billing@viraltenant.com';

// Billing configuration - loaded from S3
let billingConfig = null;
let logoBuffer = null;

async function loadBillingConfig() {
  if (billingConfig) return billingConfig;
  
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: INVOICES_BUCKET,
      Key: 'config/billing-config.json'
    }));
    const configStr = await response.Body.transformToString();
    billingConfig = JSON.parse(configStr);
    return billingConfig;
  } catch (error) {
    console.error('Error loading billing config, using defaults:', error.message);
    billingConfig = {
      company: {
        name: "ViralTenant GmbH",
        address: { street: "Musterstraße 1", zip: "12345", city: "Berlin", country: "Deutschland" },
        contact: { phone: "+49 123 456789", email: "billing@viraltenant.com", website: "https://viraltenant.com" }
      },
      banking: { bank_name: "Deutsche Bank", iban: "DE00 0000 0000 0000 0000 00", bic: "DEUTDEDB", account_holder: "ViralTenant GmbH" },
      tax: { tax_id: "DE000000000", tax_number: "00/000/00000", vat_rate: 19 },
      invoice: { prefix: "VT", footer_text: "Zahlbar innerhalb von 14 Tagen.", thank_you_text: "Vielen Dank!" },
      logo: { s3_key: "assets/viraltenant-logo.png", width: 180, height: 60 }
    };
    return billingConfig;
  }
}

async function loadLogo() {
  if (logoBuffer) return logoBuffer;
  
  try {
    const config = await loadBillingConfig();
    const response = await s3.send(new GetObjectCommand({
      Bucket: INVOICES_BUCKET,
      Key: config.logo.s3_key
    }));
    logoBuffer = Buffer.from(await response.Body.transformToByteArray());
    return logoBuffer;
  } catch (error) {
    console.error('Error loading logo:', error.message);
    return null;
  }
}

// Get all admin emails for a tenant
async function getTenantAdminEmails(tenantId) {
  try {
    // Query user_tenants table for admins of this tenant
    const result = await docClient.send(new QueryCommand({
      TableName: USER_TENANTS_TABLE,
      IndexName: 'tenant-users-index',
      KeyConditionExpression: 'tenant_id = :tenantId',
      FilterExpression: '#role = :adminRole',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':adminRole': 'admin'
      }
    }));

    const adminEmails = [];
    
    for (const item of (result.Items || [])) {
      try {
        // Get user email from Cognito
        const userResult = await cognito.send(new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: item.user_id
        }));
        
        const emailAttr = userResult.UserAttributes?.find(attr => attr.Name === 'email');
        if (emailAttr?.Value) {
          adminEmails.push(emailAttr.Value);
        }
      } catch (cognitoError) {
        console.error(`Error getting user ${item.user_id} from Cognito:`, cognitoError.message);
      }
    }

    console.log(`Found ${adminEmails.length} admin emails for tenant ${tenantId}:`, adminEmails);
    return adminEmails;
  } catch (error) {
    console.error(`Error getting admin emails for tenant ${tenantId}:`, error);
    return [];
  }
}

// Calculate AWS costs for a tenant
async function calculateAwsCosts(tenantId, startDate, endDate) {
  try {
    // First try to get costs by TenantId tag and service
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0]
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      Filter: { Tags: { Key: 'TenantId', Values: [tenantId] } }
    });

    const response = await ce.send(command);
    
    // Map AWS services to our billing categories
    const breakdown = {
      dynamodb: 0,      // DynamoDB
      s3: 0,            // S3 Storage
      lambda: 0,        // Lambda Functions
      cloudfront: 0,    // CloudFront CDN
      apigateway: 0,    // API Gateway
      mediaconvert: 0,  // MediaConvert (video)
      ses: 0,           // SES Email
      other: 0          // Other services
    };

    // Service name mapping
    const serviceMapping = {
      'Amazon DynamoDB': 'dynamodb',
      'Amazon Simple Storage Service': 's3',
      'AWS Lambda': 'lambda',
      'Amazon CloudFront': 'cloudfront',
      'Amazon API Gateway': 'apigateway',
      'AWS Elemental MediaConvert': 'mediaconvert',
      'Amazon Simple Email Service': 'ses'
    };

    if (response.ResultsByTime?.[0]?.Groups) {
      response.ResultsByTime[0].Groups.forEach(group => {
        const serviceName = group.Keys[0] || '';
        const cost = parseFloat(group.Metrics.UnblendedCost.Amount) || 0;
        
        const category = serviceMapping[serviceName] || 'other';
        breakdown[category] += cost;
      });
    }

    // Round all values to 2 decimal places
    Object.keys(breakdown).forEach(key => {
      breakdown[key] = parseFloat(breakdown[key].toFixed(2));
    });

    // Remove categories with 0 cost
    const filteredBreakdown = {};
    Object.entries(breakdown).forEach(([key, value]) => {
      if (value > 0) {
        filteredBreakdown[key] = value;
      }
    });

    const totalAwsCosts = Object.values(breakdown).reduce((a, b) => a + b, 0);
    console.log(`AWS costs for tenant ${tenantId}:`, { total: totalAwsCosts, breakdown: filteredBreakdown });
    
    return { total: parseFloat(totalAwsCosts.toFixed(2)), breakdown: filteredBreakdown };
  } catch (error) {
    console.log('Cost Explorer error (may be expected):', error.message);
    
    // If TenantId tag doesn't work, try to estimate based on tenant usage
    // This is a fallback when tags aren't properly set
    return await estimateTenantCosts(tenantId, startDate, endDate);
  }
}

// Fallback: Estimate costs based on tenant resource usage
async function estimateTenantCosts(tenantId, startDate, endDate) {
  try {
    // Get tenant's resource usage from DynamoDB
    const tenantResult = await docClient.send(new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId }
    }));
    
    const tenant = tenantResult.Item;
    if (!tenant) {
      return { total: 0, breakdown: {} };
    }

    // Estimate costs based on tenant features and usage
    const breakdown = {};
    
    // Base infrastructure costs (shared proportionally)
    // These are rough estimates per tenant per month
    const baseEstimates = {
      dynamodb: 0.12,    // DynamoDB base usage
      s3: 0.08,          // S3 storage
      lambda: 0.15,      // Lambda invocations
      cloudfront: 0.07,  // CDN delivery
      apigateway: 0.05   // API calls
    };

    // Add base costs
    Object.entries(baseEstimates).forEach(([service, cost]) => {
      breakdown[service] = cost;
    });

    // Add feature-specific costs
    if (tenant.features?.multistream || tenant.multistream_enabled) {
      breakdown.mediaconvert = (breakdown.mediaconvert || 0) + 0.25;
      breakdown.cloudfront = (breakdown.cloudfront || 0) + 0.10;
    }
    
    if (tenant.features?.videohost || tenant.video_count > 0) {
      breakdown.s3 = (breakdown.s3 || 0) + 0.15;
      breakdown.cloudfront = (breakdown.cloudfront || 0) + 0.08;
    }
    
    if (tenant.custom_domain) {
      breakdown.cloudfront = (breakdown.cloudfront || 0) + 0.05;
    }

    // Round all values
    Object.keys(breakdown).forEach(key => {
      breakdown[key] = parseFloat(breakdown[key].toFixed(2));
    });

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    console.log(`Estimated costs for tenant ${tenantId}:`, { total, breakdown });
    
    return { total: parseFloat(total.toFixed(2)), breakdown };
  } catch (error) {
    console.error('Error estimating tenant costs:', error.message);
    return { total: 0, breakdown: {} };
  }
}

// Calculate AI Services costs from usage tracking table
async function calculateAiServicesCosts(tenantId, startDate, endDate) {
  try {
    const billingMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Query AI usage for this tenant and billing month
    const result = await docClient.send(new QueryCommand({
      TableName: AI_USAGE_TABLE,
      KeyConditionExpression: 'tenant_id = :tenantId',
      FilterExpression: 'billing_month = :billingMonth',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':billingMonth': billingMonth
      }
    }));

    const breakdown = {
      transcribe: 0,
      bedrock: 0
    };

    // Sum up costs by usage type
    for (const item of (result.Items || [])) {
      const cost = parseFloat(item.cost || item.estimated_cost || 0);
      const usageType = item.usage_type;
      
      if (usageType === 'transcribe') {
        breakdown.transcribe += cost;
      } else if (usageType === 'bedrock') {
        breakdown.bedrock += cost;
      }
    }

    // Round all values to 4 decimal places for precision
    Object.keys(breakdown).forEach(key => {
      breakdown[key] = parseFloat(breakdown[key].toFixed(4));
    });

    // Remove categories with 0 cost
    const filteredBreakdown = {};
    Object.entries(breakdown).forEach(([key, value]) => {
      if (value > 0) {
        filteredBreakdown[key] = value;
      }
    });

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    console.log(`AI costs for tenant ${tenantId}:`, { total, breakdown: filteredBreakdown });
    
    return { total: parseFloat(total.toFixed(2)), breakdown: filteredBreakdown };
  } catch (error) {
    console.error(`Error calculating AI costs for tenant ${tenantId}:`, error.message);
    return { total: 0, breakdown: {} };
  }
}

// Legacy function for backward compatibility - kept for reference
async function calculateAwsCostsLegacy(tenantId, startDate, endDate) {
  try {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0]
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'TAG', Key: 'BillingGroup' }],
      Filter: { Tags: { Key: 'TenantId', Values: [tenantId] } }
    });

    const response = await ce.send(command);
    
    const breakdown = {
      multistream: 0,
      videohost: 0,
      domain: 0,
      crosspost: 0
    };

    if (response.ResultsByTime?.[0]?.Groups) {
      response.ResultsByTime[0].Groups.forEach(group => {
        const billingGroup = group.Keys[0]?.replace('BillingGroup$', '') || '';
        const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
        if (breakdown.hasOwnProperty(billingGroup)) {
          breakdown[billingGroup] = cost;
        }
      });
    }

    const totalAwsCosts = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { total: parseFloat(totalAwsCosts.toFixed(2)), breakdown };
  } catch (error) {
    console.log('Cost Explorer error (may be expected):', error.message);
    return { total: 0, breakdown: {} };
  }
}

// Generate invoice number
async function generateInvoiceNumber(year, month) {
  const config = await loadBillingConfig();
  const prefix = config.invoice.prefix;
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${year}${String(month).padStart(2, '0')}-${timestamp}`;
}

// Generate PDF invoice - Premium Design (Compact, Times-Roman Font)
async function generateInvoicePDF(invoice, tenant, config) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 0, 
        size: 'A4',
        bufferPages: true
      });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Premium Colors
      const primaryColor = '#7c3aed';    // Vibrant Purple
      const accentColor = '#a78bfa';     // Light Purple
      const goldColor = '#d4af37';       // Premium Gold
      const darkColor = '#1e1b4b';       // Deep Indigo
      const textColor = '#374151';       // Gray 700
      const lightText = '#6b7280';       // Gray 500
      const bgLight = '#faf5ff';         // Purple 50
      const white = '#ffffff';

      const pageWidth = 595.28;
      const pageHeight = 841.89;

      // Load logo
      const logo = await loadLogo();
      
      // === PREMIUM HEADER - Compact ===
      doc.rect(0, 0, pageWidth, 100).fill(darkColor);
      doc.rect(0, 100, pageWidth, 3).fill(goldColor);

      // Logo area (left side) - smaller, elegant
      if (logo) {
        doc.image(logo, 50, 20, { width: 100 });
      } else {
        doc.fontSize(22).fillColor(white).font('Times-Bold');
        doc.text('VIRALTENANT', 50, 30);
        doc.fontSize(9).fillColor(accentColor).font('Times-Roman');
        doc.text('Content Creator Platform', 50, 55);
      }

      // Company info (right side) - elegant styling
      doc.fontSize(10).fillColor(white).font('Times-Bold');
      doc.text(config.company.name, 350, 25, { align: 'right', width: 195 });
      doc.fontSize(9).fillColor(accentColor).font('Times-Roman');
      doc.text(config.company.address.street, 350, 42, { align: 'right', width: 195 });
      doc.text(`${config.company.address.zip} ${config.company.address.city}`, 350, 55, { align: 'right', width: 195 });
      doc.text(config.company.address.country, 350, 68, { align: 'right', width: 195 });
      doc.fillColor(goldColor);
      doc.text(config.company.contact.website, 350, 83, { align: 'right', width: 195 });

      // === INVOICE TITLE SECTION - Smaller ===
      doc.fontSize(26).fillColor(darkColor).font('Times-Bold');
      doc.text('RECHNUNG', 50, 125);
      
      // Elegant underline
      doc.rect(50, 158, 60, 3).fill(primaryColor);
      doc.rect(110, 158, 30, 3).fill(accentColor);
      doc.rect(140, 158, 15, 3).fill(goldColor);

      // === INVOICE META INFO (right side) - Card style ===
      const metaBoxX = 350;
      const metaBoxY = 120;
      const metaBoxWidth = 195;
      const metaBoxHeight = 80;
      
      doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 6).fill(bgLight);
      doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 6).lineWidth(1).stroke(accentColor);
      
      doc.fontSize(7).fillColor(lightText).font('Times-Roman');
      doc.text('RECHNUNGSNUMMER', metaBoxX + 12, metaBoxY + 10);
      doc.text('DATUM', metaBoxX + 12, metaBoxY + 33);
      doc.text('LEISTUNGSZEITRAUM', metaBoxX + 12, metaBoxY + 56);
      
      doc.fontSize(10).fillColor(darkColor).font('Times-Bold');
      doc.text(invoice.invoice_number, metaBoxX + 12, metaBoxY + 20, { width: metaBoxWidth - 24 });
      doc.font('Times-Roman').fontSize(9).fillColor(textColor);
      doc.text(new Date(invoice.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), metaBoxX + 12, metaBoxY + 43);
      const periodStart = new Date(invoice.period.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      doc.text(periodStart, metaBoxX + 12, metaBoxY + 66);

      // === CUSTOMER INFO - Elegant Card ===
      const customerY = 215;
      doc.roundedRect(50, customerY, 250, 70, 6).fill(bgLight);
      doc.roundedRect(50, customerY, 250, 70, 6).lineWidth(1).stroke(accentColor);
      
      doc.fontSize(7).fillColor(primaryColor).font('Times-Bold');
      doc.text('RECHNUNGSEMPFÄNGER', 62, customerY + 10);
      
      doc.fontSize(13).fillColor(darkColor).font('Times-Bold');
      doc.text(tenant.creator_name || tenant.name || 'Kunde', 62, customerY + 24);
      doc.font('Times-Roman').fontSize(8).fillColor(lightText);
      if (tenant.subdomain) {
        doc.text(`${tenant.subdomain}.viraltenant.com`, 62, customerY + 42);
      }
      doc.fontSize(7).fillColor(lightText);
      doc.text(`Tenant-ID: ${tenant.tenant_id}`, 62, customerY + 54);

      // === LINE ITEMS TABLE - Premium Design ===
      const tableTop = 310;
      const tableWidth = 495;
      const tableLeft = 50;
      
      // Table header
      doc.rect(tableLeft, tableTop, tableWidth, 35).fill(darkColor);
      
      // Header text
      doc.fontSize(10).fillColor(white).font('Times-Bold');
      doc.text('Beschreibung', tableLeft + 18, tableTop + 12);
      doc.text('Betrag', tableLeft + tableWidth - 95, tableTop + 12, { align: 'right', width: 75 });

      let yPos = tableTop + 48;
      let rowIndex = 0;
      
      const addRow = (description, amount, isSubItem = false) => {
        const rowHeight = 28;
        
        // Alternating row backgrounds
        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos - 6, tableWidth, rowHeight).fill(bgLight);
        } else {
          doc.rect(tableLeft, yPos - 6, tableWidth, rowHeight).fill(white);
        }
        
        // Row border
        doc.moveTo(tableLeft, yPos + rowHeight - 6).lineTo(tableLeft + tableWidth, yPos + rowHeight - 6).lineWidth(0.5).stroke('#e5e7eb');
        
        // Text
        doc.fillColor(isSubItem ? lightText : textColor);
        doc.fontSize(isSubItem ? 8 : 9).font(isSubItem ? 'Times-Roman' : 'Times-Bold');
        doc.text(isSubItem ? `    ${description}` : description, tableLeft + 18, yPos);
        
        doc.fillColor(isSubItem ? lightText : darkColor);
        doc.fontSize(isSubItem ? 8 : 9).font('Times-Roman');
        doc.text(`${amount.toFixed(2)} €`, tableLeft + tableWidth - 95, yPos, { align: 'right', width: 75 });
        
        yPos += rowHeight;
        rowIndex++;
      };
      
      // Base fee
      addRow('Monatliche Grundgebühr ViralTenant Platform', invoice.base_fee);

      // AWS costs breakdown
      if (invoice.aws_breakdown && Object.keys(invoice.aws_breakdown).length > 0) {
        const labels = {
          dynamodb: 'DynamoDB Datenbank', s3: 'S3 Speicher', lambda: 'Lambda Funktionen',
          cloudfront: 'CloudFront CDN', apigateway: 'API Gateway', mediaconvert: 'MediaConvert Video',
          ses: 'E-Mail Service (SES)', other: 'Sonstige AWS Services',
          multistream: 'Multistreaming Services', videohost: 'Video Hosting & CDN',
          domain: 'Domain Services', crosspost: 'Crossposting Infrastructure'
        };
        
        for (const [key, cost] of Object.entries(invoice.aws_breakdown)) {
          if (cost > 0) addRow(labels[key] || key, cost, true);
        }
      } else if (invoice.aws_costs > 0) {
        addRow('AWS Infrastrukturkosten', invoice.aws_costs, true);
      }

      // AI Services
      if (invoice.ai_costs > 0) {
        addRow('KI Services (Transcribe & Bedrock)', invoice.ai_costs, true);
      }

      // === TOTALS SECTION - Premium Card (Compact) ===
      yPos += 15;
      const totalsX = 320;
      const totalsWidth = 225;
      
      doc.roundedRect(totalsX, yPos, totalsWidth, 90, 6).fill(bgLight);
      doc.roundedRect(totalsX, yPos, totalsWidth, 90, 6).lineWidth(1).stroke(accentColor);

      const vatRate = config.tax?.vat_rate || 7.7;
      const netAmount = invoice.amount / (1 + vatRate / 100);
      const vatAmount = invoice.amount - netAmount;
      
      doc.fontSize(9).fillColor(lightText).font('Times-Roman');
      doc.text('Nettobetrag:', totalsX + 12, yPos + 12);
      doc.fillColor(textColor);
      doc.text(`${netAmount.toFixed(2)} €`, totalsX + totalsWidth - 90, yPos + 12, { align: 'right', width: 75 });
      
      doc.fillColor(lightText);
      doc.text(`MwSt. (${vatRate}%):`, totalsX + 12, yPos + 30);
      doc.fillColor(textColor);
      doc.text(`${vatAmount.toFixed(2)} €`, totalsX + totalsWidth - 90, yPos + 30, { align: 'right', width: 75 });
      
      // Separator line
      doc.moveTo(totalsX + 12, yPos + 50).lineTo(totalsX + totalsWidth - 12, yPos + 50).lineWidth(1).stroke(accentColor);

      // Total amount - highlighted
      doc.fontSize(11).fillColor(darkColor).font('Times-Bold');
      doc.text('Gesamtbetrag:', totalsX + 12, yPos + 62);
      doc.fillColor(primaryColor).fontSize(12);
      doc.text(`${invoice.amount.toFixed(2)} €`, totalsX + totalsWidth - 90, yPos + 62, { align: 'right', width: 75 });

      // === PAYMENT STATUS SECTION (if paid) ===
      const isPaid = invoice.status === 'paid' && invoice.paid_at;
      let paymentY = yPos + 110;
      
      if (isPaid) {
        // PAID stamp/banner
        doc.roundedRect(50, paymentY, 250, 70, 6).fill('#dcfce7'); // Green background
        doc.roundedRect(50, paymentY, 250, 70, 6).lineWidth(2).stroke('#16a34a');
        
        doc.fontSize(16).fillColor('#16a34a').font('Times-Bold');
        doc.text('✓ BEZAHLT', 62, paymentY + 12);
        
        doc.fontSize(8).fillColor('#166534').font('Times-Roman');
        const paidDate = new Date(invoice.paid_at);
        const paidDateStr = paidDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
        const paidTimeStr = paidDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        doc.text(`Bezahlt am: ${paidDateStr} um ${paidTimeStr} Uhr`, 62, paymentY + 34);
        
        // Payment method details
        if (invoice.payment_method === 'mollie' || invoice.mollie_payment_id) {
          doc.text(`Zahlungsart: SEPA-Lastschrift (Mollie)`, 62, paymentY + 46);
          doc.text(`Transaktions-ID: ${invoice.mollie_payment_id || '-'}`, 62, paymentY + 58);
        } else if (invoice.payment_method === 'paypal') {
          doc.text(`Zahlungsart: PayPal`, 62, paymentY + 46);
          doc.text(`Transaktions-ID: ${invoice.paypal_capture_id || '-'}`, 62, paymentY + 58);
        } else if (invoice.payment_method) {
          doc.text(`Zahlungsart: ${invoice.payment_method}`, 62, paymentY + 46);
        }
        
        paymentY += 80; // Move down for banking/contact cards
      }

      // === PAYMENT INFO SECTION - Compact ===
      const cardHeight = 85;
      
      // Banking info card (only show if not paid)
      if (!isPaid) {
        doc.roundedRect(50, paymentY, 235, cardHeight, 6).lineWidth(1).stroke('#e5e7eb');
        
        doc.fontSize(9).fillColor(primaryColor).font('Times-Bold');
        doc.text('BANKVERBINDUNG', 62, paymentY + 10);
        
        doc.fontSize(8).fillColor(textColor).font('Times-Roman');
        doc.text(`Bank: ${config.banking.bank_name}`, 62, paymentY + 26);
        doc.text(`IBAN: ${config.banking.iban}`, 62, paymentY + 40);
        doc.text(`BIC: ${config.banking.bic}`, 62, paymentY + 54);
        doc.text(`Inhaber: ${config.banking.account_holder}`, 62, paymentY + 68);
      }

      // Contact info card
      const contactCardX = isPaid ? 50 : 310;
      const contactCardWidth = isPaid ? 495 : 235;
      doc.roundedRect(contactCardX, paymentY, contactCardWidth, cardHeight, 6).lineWidth(1).stroke('#e5e7eb');
      
      doc.fontSize(9).fillColor(primaryColor).font('Times-Bold');
      doc.text('KONTAKT', contactCardX + 12, paymentY + 10);
      
      doc.fontSize(8).fillColor(textColor).font('Times-Roman');
      doc.text(config.company.contact.email, contactCardX + 12, paymentY + 26);
      doc.text(config.company.contact.phone, contactCardX + 12, paymentY + 40);
      doc.text(config.company.contact.website, contactCardX + 12, paymentY + 54);
      if (config.company.managing_director) {
        doc.text(`Geschäftsführer: ${config.company.managing_director}`, contactCardX + 12, paymentY + 68);
      }

      // === PREMIUM FOOTER - Compact ===
      doc.rect(0, pageHeight - 50, pageWidth, 50).fill(darkColor);
      
      doc.fontSize(8).fillColor(accentColor).font('Times-Roman');
      if (isPaid) {
        doc.text('Diese Rechnung wurde bereits beglichen. Vielen Dank für Ihre Zahlung!', 0, pageHeight - 38, { align: 'center', width: pageWidth });
      } else {
        doc.text(config.invoice.footer_text, 0, pageHeight - 38, { align: 'center', width: pageWidth });
      }
      
      doc.fontSize(9).fillColor(goldColor).font('Times-Bold');
      doc.text(config.invoice.thank_you_text, 0, pageHeight - 22, { align: 'center', width: pageWidth });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Send invoice email to tenant admins (only for paid invoices)
async function sendInvoiceEmail(invoice, tenant, pdfBuffer, adminEmails) {
  if (adminEmails.length === 0) {
    console.log(`No admin emails found for tenant ${tenant.tenant_id}, skipping email`);
    return false;
  }

  const config = await loadBillingConfig();
  const boundary = `----=_Part_${Date.now()}`;
  
  const paidDate = new Date(invoice.paid_at);
  const paidDateStr = paidDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  
  const emailSubject = `Ihre ViralTenant Rechnung ${invoice.invoice_number} - Zahlung erfolgreich`;
  const emailBody = `
Sehr geehrte Damen und Herren,

vielen Dank für Ihre Zahlung!

Der Betrag für den Abrechnungszeitraum ${new Date(invoice.period.start).toLocaleDateString('de-DE')} - ${new Date(invoice.period.end).toLocaleDateString('de-DE')} wurde erfolgreich per SEPA-Lastschrift eingezogen.

Rechnungsnummer: ${invoice.invoice_number}
Gesamtbetrag: ${invoice.amount.toFixed(2)} €
Bezahlt am: ${paidDateStr}
Zahlungsart: SEPA-Lastschrift (Mollie)
${invoice.mollie_payment_id ? `Transaktions-ID: ${invoice.mollie_payment_id}` : ''}

Anbei finden Sie Ihre Rechnung als PDF-Dokument für Ihre Unterlagen.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ViralTenant Team

${config.company.name}
${config.company.address.street}
${config.company.address.zip} ${config.company.address.city}
${config.company.contact.email}
${config.company.contact.website}
`;

  const rawEmail = [
    `From: ${config.company.name} <${SENDER_EMAIL}>`,
    `To: ${adminEmails.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(emailSubject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    emailBody,
    '',
    `--${boundary}`,
    'Content-Type: application/pdf',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="Rechnung_${invoice.invoice_number}.pdf"`,
    '',
    pdfBuffer.toString('base64'),
    '',
    `--${boundary}--`
  ].join('\r\n');

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawEmail) }
    }));
    console.log(`Invoice email sent to ${adminEmails.length} admins for tenant ${tenant.tenant_id}`);
    return true;
  } catch (error) {
    console.error(`Error sending invoice email for tenant ${tenant.tenant_id}:`, error);
    return false;
  }
}

// Create invoice for a single tenant
async function createInvoiceForTenant(tenant, periodStart, periodEnd, year, month) {
  const config = await loadBillingConfig();
  const tenantId = tenant.tenant_id;
  
  console.log(`Processing billing for tenant: ${tenantId}`);

  // Check if tenant has active Mollie mandate
  let hasMollieMandate = false;
  let mollieCustomerId = null;
  
  try {
    const billingRecord = await docClient.send(new GetCommand({
      TableName: BILLING_TABLE,
      Key: { user_id: tenantId }
    }));
    
    hasMollieMandate = billingRecord.Item?.mollie_customer_id && billingRecord.Item?.subscription_status === 'active';
    mollieCustomerId = billingRecord.Item?.mollie_customer_id;
  } catch (error) {
    console.error(`Error checking Mollie status for tenant ${tenantId}:`, error.message);
  }

  // No Mollie mandate = suspend tenant
  if (!hasMollieMandate) {
    console.log(`Tenant ${tenantId} has no active Mollie mandate - suspending tenant`);
    
    // Suspend tenant
    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: 'SET #status = :status, suspended_at = :now, suspension_reason = :reason, updated_at = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'suspended',
        ':now': new Date().toISOString(),
        ':reason': 'no_payment_method'
      }
    }));
    
    // Send suspension email to admins
    const adminEmails = await getTenantAdminEmails(tenantId);
    await sendSuspensionEmail(tenant, adminEmails);
    
    return {
      tenantId,
      action: 'suspended',
      reason: 'no_mollie_mandate'
    };
  }

  // Calculate costs
  const awsCosts = await calculateAwsCosts(tenantId, periodStart, periodEnd);
  const aiCosts = await calculateAiServicesCosts(tenantId, periodStart, periodEnd);
  const baseFee = config.pricing?.base_fee || 30.00;
  const totalAmount = parseFloat((baseFee + awsCosts.total + aiCosts.total).toFixed(2));

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(year, month);
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Charge via Mollie
  console.log(`Charging tenant ${tenantId} via Mollie: ${totalAmount}€`);
  const molliePaymentResult = await chargeTenantViaMollie(
    tenantId, 
    mollieCustomerId,
    totalAmount,
    `ViralTenant ${year}-${String(month).padStart(2, '0')} - Grundgebühr + Nutzung`,
    invoiceId
  );
  
  if (!molliePaymentResult.success) {
    console.error(`Mollie payment failed for tenant ${tenantId}: ${molliePaymentResult.error}`);
    
    // Suspend tenant on payment failure
    await docClient.send(new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenant_id: tenantId },
      UpdateExpression: 'SET #status = :status, suspended_at = :now, suspension_reason = :reason, updated_at = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'suspended',
        ':now': new Date().toISOString(),
        ':reason': 'payment_failed'
      }
    }));
    
    // Send payment failed email
    const adminEmails = await getTenantAdminEmails(tenantId);
    await sendPaymentFailedEmail(tenant, adminEmails, molliePaymentResult.error);
    
    return {
      tenantId,
      action: 'suspended',
      reason: 'payment_failed',
      error: molliePaymentResult.error
    };
  }

  // Payment successful - create invoice as PAID
  const invoice = {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    user_id: tenantId,
    tenant_id: tenantId,
    amount: totalAmount,
    base_fee: baseFee,
    aws_costs: awsCosts.total,
    aws_breakdown: awsCosts.breakdown,
    ai_costs: aiCosts.total,
    ai_breakdown: aiCosts.breakdown,
    status: 'paid',
    payment_method: 'mollie',
    mollie_payment_id: molliePaymentResult.paymentId,
    paid_at: new Date().toISOString(),
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString()
    },
    created_at: new Date().toISOString(),
    billing_month: `${year}-${String(month).padStart(2, '0')}`
  };

  // Generate PDF (will show PAID stamp)
  const pdfBuffer = await generateInvoicePDF(invoice, tenant, config);
  
  // Upload PDF to S3
  const pdfKey = `invoices/${tenantId}/${invoiceNumber}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: INVOICES_BUCKET,
    Key: pdfKey,
    Body: pdfBuffer,
    ContentType: 'application/pdf'
  }));
  
  invoice.pdf_url = `s3://${INVOICES_BUCKET}/${pdfKey}`;
  invoice.pdf_key = pdfKey;

  // Save invoice to DynamoDB
  await docClient.send(new PutCommand({
    TableName: INVOICES_TABLE,
    Item: invoice
  }));

  // Send invoice email to admins
  const adminEmails = await getTenantAdminEmails(tenantId);
  const emailSent = await sendInvoiceEmail(invoice, tenant, pdfBuffer, adminEmails);
  invoice.email_sent = emailSent;
  invoice.email_recipients = adminEmails;

  console.log(`Invoice ${invoiceNumber} created for tenant ${tenantId}: ${totalAmount}€ (paid via Mollie)`);
  return invoice;
}

// Send suspension email (no payment method)
async function sendSuspensionEmail(tenant, adminEmails) {
  if (adminEmails.length === 0) return false;
  
  const config = await loadBillingConfig();
  const emailSubject = `ViralTenant: Ihr Account wurde gesperrt - Zahlungsmethode erforderlich`;
  const emailBody = `
Hallo ${tenant.creator_name || 'Kunde'},

Ihr ViralTenant Account wurde vorübergehend gesperrt, da keine gültige Zahlungsmethode hinterlegt ist.

Um Ihren Account wieder freizuschalten, richten Sie bitte eine SEPA-Lastschrift ein:

👉 Jetzt Zahlungsmethode einrichten: https://viraltenant.com/tenant

Keine Sorge - alle Ihre Daten sind sicher gespeichert und werden nach Einrichtung der Zahlungsmethode wieder verfügbar sein.

Monatliche Kosten:
- Grundgebühr: 30€/Monat
- Infrastrukturkosten: variabel nach Nutzung

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ViralTenant Team

${config.company.contact.email}
${config.company.contact.website}
`;

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { 
        Data: Buffer.from([
          `From: ${config.company.name} <${SENDER_EMAIL}>`,
          `To: ${adminEmails.join(', ')}`,
          `Subject: =?UTF-8?B?${Buffer.from(emailSubject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          emailBody
        ].join('\r\n'))
      }
    }));
    console.log(`Suspension email sent to ${adminEmails.length} admins for tenant ${tenant.tenant_id}`);
    return true;
  } catch (error) {
    console.error(`Error sending suspension email:`, error);
    return false;
  }
}

// Send payment failed email
async function sendPaymentFailedEmail(tenant, adminEmails, errorMessage) {
  if (adminEmails.length === 0) return false;
  
  const config = await loadBillingConfig();
  const emailSubject = `ViralTenant: Zahlung fehlgeschlagen - Account gesperrt`;
  const emailBody = `
Hallo ${tenant.creator_name || 'Kunde'},

Die monatliche Abbuchung für Ihren ViralTenant Account ist leider fehlgeschlagen.

Fehler: ${errorMessage || 'Unbekannter Fehler'}

Ihr Account wurde vorübergehend gesperrt. Um ihn wieder freizuschalten:

1. Prüfen Sie, ob Ihr Bankkonto ausreichend gedeckt ist
2. Aktualisieren Sie ggf. Ihre Zahlungsmethode unter: https://viraltenant.com/tenant

Keine Sorge - alle Ihre Daten sind sicher gespeichert.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ViralTenant Team

${config.company.contact.email}
${config.company.contact.website}
`;

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { 
        Data: Buffer.from([
          `From: ${config.company.name} <${SENDER_EMAIL}>`,
          `To: ${adminEmails.join(', ')}`,
          `Subject: =?UTF-8?B?${Buffer.from(emailSubject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          emailBody
        ].join('\r\n'))
      }
    }));
    console.log(`Payment failed email sent to ${adminEmails.length} admins for tenant ${tenant.tenant_id}`);
    return true;
  } catch (error) {
    console.error(`Error sending payment failed email:`, error);
    return false;
  }
}

// Charge tenant via Mollie using existing mandate
async function chargeTenantViaMollie(tenantId, customerId, amount, description, invoiceId) {
  const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY;
  const MOLLIE_BASE_URL = 'https://api.mollie.com/v2';
  
  if (!MOLLIE_API_KEY) {
    return { success: false, error: 'Mollie API Key nicht konfiguriert' };
  }
  
  try {
    // Get valid mandate
    const mandatesResponse = await fetch(`${MOLLIE_BASE_URL}/customers/${customerId}/mandates`, {
      headers: { 'Authorization': `Bearer ${MOLLIE_API_KEY}` }
    });
    
    if (!mandatesResponse.ok) {
      return { success: false, error: 'Fehler beim Abrufen der Mandate' };
    }
    
    const mandates = await mandatesResponse.json();
    const validMandate = mandates._embedded?.mandates?.find(m => m.status === 'valid');
    
    if (!validMandate) {
      return { success: false, error: 'Kein gültiges Mandat vorhanden' };
    }
    
    // Create recurring payment
    const paymentResponse = await fetch(`${MOLLIE_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOLLIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: {
          currency: 'EUR',
          value: amount.toFixed(2)
        },
        description: description,
        customerId: customerId,
        mandateId: validMandate.id,
        sequenceType: 'recurring',
        webhookUrl: `${process.env.API_BASE_URL || 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production'}/billing/mollie/webhook`,
        metadata: JSON.stringify({
          tenantId,
          invoiceId,
          type: 'monthly_billing'
        })
      })
    });
    
    if (!paymentResponse.ok) {
      const error = await paymentResponse.json();
      return { success: false, error: error.detail || 'Zahlung fehlgeschlagen' };
    }
    
    const payment = await paymentResponse.json();
    
    return {
      success: true,
      paymentId: payment.id,
      status: payment.status
    };
    
  } catch (error) {
    console.error('Mollie charge error:', error);
    return { success: false, error: error.message };
  }
}

// Send payment reminder email
async function sendReminderEmail(invoice, tenant, adminEmails) {
  if (adminEmails.length === 0) {
    console.log(`No admin emails found for tenant ${tenant.tenant_id}, skipping reminder`);
    return false;
  }

  const config = await loadBillingConfig();
  
  const emailSubject = `Zahlungserinnerung: Rechnung ${invoice.invoice_number}`;
  const emailBody = `
Sehr geehrte Damen und Herren,

wir möchten Sie freundlich daran erinnern, dass die folgende Rechnung noch offen ist:

Rechnungsnummer: ${invoice.invoice_number}
Rechnungsdatum: ${new Date(invoice.created_at).toLocaleDateString('de-DE')}
Gesamtbetrag: ${invoice.amount.toFixed(2)} €
Fällig seit: ${new Date(new Date(invoice.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}

Bitte überweisen Sie den ausstehenden Betrag auf folgendes Konto:

Bank: ${config.banking.bank_name}
IBAN: ${config.banking.iban}
BIC: ${config.banking.bic}
Verwendungszweck: ${invoice.invoice_number}

Falls Sie die Zahlung bereits veranlasst haben, betrachten Sie diese E-Mail bitte als gegenstandslos.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ViralTenant Team

${config.company.name}
${config.company.address.street}
${config.company.address.zip} ${config.company.address.city}
${config.company.contact.email}
${config.company.contact.website}
`;

  const rawEmail = [
    `From: ${config.company.name} <${SENDER_EMAIL}>`,
    `To: ${adminEmails.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(emailSubject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    emailBody
  ].join('\r\n');

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawEmail) }
    }));
    console.log(`Reminder email sent to ${adminEmails.length} admins for invoice ${invoice.invoice_number}`);
    return true;
  } catch (error) {
    console.error(`Error sending reminder email for invoice ${invoice.invoice_number}:`, error);
    return false;
  }
}

// Process payment reminders for overdue invoices
async function processPaymentReminders() {
  console.log('Processing payment reminders...');
  
  const results = {
    checked: 0,
    reminders_sent: 0,
    errors: []
  };

  try {
    // Get all open invoices
    const invoicesResult = await docClient.send(new ScanCommand({
      TableName: INVOICES_TABLE,
      FilterExpression: '#status = :open',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':open': 'open' }
    }));

    const openInvoices = invoicesResult.Items || [];
    console.log(`Found ${openInvoices.length} open invoices`);

    const now = new Date();
    const reminderThresholdDays = 14;

    for (const invoice of openInvoices) {
      results.checked++;
      
      try {
        // Skip if reminder already sent
        if (invoice.reminder_sent) {
          console.log(`Reminder already sent for invoice ${invoice.invoice_number}`);
          continue;
        }

        // Check if invoice is older than 14 days
        const invoiceDate = new Date(invoice.created_at);
        const daysSinceCreation = Math.floor((now - invoiceDate) / (1000 * 60 * 60 * 24));

        if (daysSinceCreation < reminderThresholdDays) {
          console.log(`Invoice ${invoice.invoice_number} is only ${daysSinceCreation} days old, skipping`);
          continue;
        }

        console.log(`Invoice ${invoice.invoice_number} is ${daysSinceCreation} days old, sending reminder`);

        // Get tenant info
        const tenantResult = await docClient.send(new GetCommand({
          TableName: TENANTS_TABLE,
          Key: { tenant_id: invoice.tenant_id || invoice.user_id }
        }));

        const tenant = tenantResult.Item;
        if (!tenant) {
          console.log(`Tenant not found for invoice ${invoice.invoice_number}`);
          continue;
        }

        // Get admin emails
        const adminEmails = await getTenantAdminEmails(tenant.tenant_id);

        // Send reminder email
        const emailSent = await sendReminderEmail(invoice, tenant, adminEmails);

        if (emailSent) {
          // Update invoice with reminder status
          await docClient.send(new UpdateCommand({
            TableName: INVOICES_TABLE,
            Key: { invoice_id: invoice.invoice_id },
            UpdateExpression: 'SET reminder_sent = :sent, reminder_sent_at = :sentAt, reminder_recipients = :recipients',
            ExpressionAttributeValues: {
              ':sent': true,
              ':sentAt': new Date().toISOString(),
              ':recipients': adminEmails
            }
          }));

          results.reminders_sent++;
          console.log(`Reminder sent and recorded for invoice ${invoice.invoice_number}`);
        }
      } catch (invoiceError) {
        console.error(`Error processing reminder for invoice ${invoice.invoice_id}:`, invoiceError);
        results.errors.push({
          invoiceId: invoice.invoice_id,
          error: invoiceError.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error processing payment reminders:', error);
    results.errors.push({ error: error.message });
    return results;
  }
}

// Check and suspend tenants with expired trials (30 days without subscription)
async function processTrialExpirations() {
  console.log('Processing trial expirations...');
  
  const results = {
    checked: 0,
    suspended: 0,
    warnings_sent: 0,
    errors: []
  };

  try {
    const now = new Date();
    const TRIAL_DAYS = 30;
    const WARNING_DAYS = 7; // Send warning 7 days before trial ends
    
    // Get all active tenants (not already suspended)
    const tenantsResult = await docClient.send(new ScanCommand({
      TableName: TENANTS_TABLE,
      FilterExpression: '#status = :active OR #status = :trial',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { 
        ':active': 'active',
        ':trial': 'trial'
      }
    }));

    const tenants = tenantsResult.Items || [];
    console.log(`Found ${tenants.length} active/trial tenants to check`);

    for (const tenant of tenants) {
      results.checked++;
      
      try {
        // Skip platform tenant
        if (tenant.tenant_id === 'platform') continue;
        
        const createdAt = new Date(tenant.created_at);
        const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        const daysUntilTrialEnd = TRIAL_DAYS - daysSinceCreation;
        
        // Check if tenant has active Stripe subscription
        const billingResult = await docClient.send(new GetCommand({
          TableName: BILLING_TABLE,
          Key: { user_id: tenant.tenant_id }
        }));
        
        const billing = billingResult.Item;
        const hasActiveSubscription = billing?.stripe_subscription_status === 'active' || 
                                       billing?.stripe_subscription_status === 'trialing';
        const hasPaymentMethod = !!billing?.payment_method_id;
        
        // If tenant has active subscription or payment method, skip
        if (hasActiveSubscription || hasPaymentMethod) {
          console.log(`Tenant ${tenant.tenant_id} has subscription/payment method, skipping`);
          continue;
        }
        
        // Trial expired - suspend tenant
        if (daysSinceCreation >= TRIAL_DAYS) {
          console.log(`Tenant ${tenant.tenant_id} trial expired (${daysSinceCreation} days), suspending...`);
          
          await docClient.send(new UpdateCommand({
            TableName: TENANTS_TABLE,
            Key: { tenant_id: tenant.tenant_id },
            UpdateExpression: 'SET #status = :suspended, status_reason = :reason, suspended_at = :now, updated_at = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':suspended': 'suspended',
              ':reason': 'Trial abgelaufen - Bitte Zahlungsmethode hinterlegen oder Abo buchen',
              ':now': now.toISOString()
            }
          }));
          
          // Send suspension email
          const adminEmails = await getTenantAdminEmails(tenant.tenant_id);
          if (adminEmails.length > 0) {
            await sendTrialExpiredEmail(tenant, adminEmails);
          }
          
          results.suspended++;
          console.log(`Tenant ${tenant.tenant_id} suspended`);
        }
        // Trial ending soon - send warning
        else if (daysUntilTrialEnd <= WARNING_DAYS && daysUntilTrialEnd > 0 && !tenant.trial_warning_sent) {
          console.log(`Tenant ${tenant.tenant_id} trial ending in ${daysUntilTrialEnd} days, sending warning...`);
          
          const adminEmails = await getTenantAdminEmails(tenant.tenant_id);
          if (adminEmails.length > 0) {
            await sendTrialWarningEmail(tenant, adminEmails, daysUntilTrialEnd);
            
            // Mark warning as sent
            await docClient.send(new UpdateCommand({
              TableName: TENANTS_TABLE,
              Key: { tenant_id: tenant.tenant_id },
              UpdateExpression: 'SET trial_warning_sent = :sent, trial_warning_sent_at = :now',
              ExpressionAttributeValues: {
                ':sent': true,
                ':now': now.toISOString()
              }
            }));
            
            results.warnings_sent++;
          }
        }
      } catch (tenantError) {
        console.error(`Error processing trial for tenant ${tenant.tenant_id}:`, tenantError);
        results.errors.push({
          tenantId: tenant.tenant_id,
          error: tenantError.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error processing trial expirations:', error);
    results.errors.push({ error: error.message });
    return results;
  }
}

// Send trial expiration warning email
async function sendTrialWarningEmail(tenant, adminEmails, daysRemaining) {
  const config = await loadBillingConfig();
  
  const emailSubject = `ViralTenant: Ihr Testzeitraum endet in ${daysRemaining} Tagen`;
  const emailBody = `
Hallo ${tenant.creator_name || 'Kunde'},

Ihr kostenloser Testzeitraum bei ViralTenant endet in ${daysRemaining} Tagen.

Um Ihren Account weiterhin nutzen zu können, hinterlegen Sie bitte eine Zahlungsmethode oder buchen Sie ein Abonnement.

👉 Jetzt Zahlungsmethode hinterlegen: https://viraltenant.com/tenant

Nach Ablauf des Testzeitraums wird Ihr Account vorübergehend gesperrt. Alle Ihre Daten bleiben erhalten und Sie können jederzeit durch Hinterlegung einer Zahlungsmethode wieder Zugang erhalten.

Preise:
- Grundgebühr: 30€/Monat
- Infrastrukturkosten: variabel nach Nutzung

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ViralTenant Team

${config.company.contact.email}
${config.company.contact.website}
`;

  const rawEmail = [
    `From: ${config.company.name} <${SENDER_EMAIL}>`,
    `To: ${adminEmails.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(emailSubject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    emailBody
  ].join('\r\n');

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawEmail) }
    }));
    console.log(`Trial warning email sent to ${adminEmails.length} admins for tenant ${tenant.tenant_id}`);
    return true;
  } catch (error) {
    console.error(`Error sending trial warning email for tenant ${tenant.tenant_id}:`, error);
    return false;
  }
}

// Send trial expired email
async function sendTrialExpiredEmail(tenant, adminEmails) {
  const config = await loadBillingConfig();
  
  const emailSubject = `ViralTenant: Ihr Testzeitraum ist abgelaufen`;
  const emailBody = `
Hallo ${tenant.creator_name || 'Kunde'},

Ihr kostenloser Testzeitraum bei ViralTenant ist abgelaufen.

Ihr Account wurde vorübergehend gesperrt. Keine Sorge - alle Ihre Daten sind sicher gespeichert!

Um Ihren Account wieder freizuschalten, hinterlegen Sie bitte eine Zahlungsmethode:

👉 Jetzt freischalten: https://viraltenant.com/tenant

Nach Hinterlegung einer Zahlungsmethode wird Ihr Account automatisch wieder aktiviert.

Preise:
- Grundgebühr: 30€/Monat
- Infrastrukturkosten: variabel nach Nutzung

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ViralTenant Team

${config.company.contact.email}
${config.company.contact.website}
`;

  const rawEmail = [
    `From: ${config.company.name} <${SENDER_EMAIL}>`,
    `To: ${adminEmails.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(emailSubject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    emailBody
  ].join('\r\n');

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawEmail) }
    }));
    console.log(`Trial expired email sent to ${adminEmails.length} admins for tenant ${tenant.tenant_id}`);
    return true;
  } catch (error) {
    console.error(`Error sending trial expired email for tenant ${tenant.tenant_id}:`, error);
    return false;
  }
}

exports.handler = async (event) => {
  console.log('Billing Cron Job started:', JSON.stringify(event, null, 2));
  
  // Check if this is a reminder-only run
  const isReminderRun = event.source === 'reminder' || event.action === 'reminders';
  
  const results = {
    processed: 0,
    skipped: 0,
    errors: [],
    invoices: [],
    reminders: null,
    trials: null
  };

  try {
    await loadBillingConfig();
    
    // Always process trial expirations
    results.trials = await processTrialExpirations();
    
    // Always process payment reminders
    results.reminders = await processPaymentReminders();
    
    // If reminder-only run, return early
    if (isReminderRun) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: 'reminders',
          reminders: results.reminders
        })
      };
    }
    
    // Calculate billing period (previous month)
    const now = new Date();
    const billingYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const billingMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    
    const periodStart = new Date(billingYear, billingMonth - 1, 1);
    const periodEnd = new Date(billingYear, billingMonth, 0);
    
    console.log(`Billing period: ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);

    // Get all active tenants
    const tenantsResult = await docClient.send(new ScanCommand({
      TableName: TENANTS_TABLE,
      FilterExpression: '#status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':active': 'active' }
    }));

    const tenants = tenantsResult.Items || [];
    console.log(`Found ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      try {
        // Skip platform tenant
        if (tenant.tenant_id === 'platform') {
          results.skipped++;
          continue;
        }

        const invoice = await createInvoiceForTenant(tenant, periodStart, periodEnd, billingYear, billingMonth);
        
        if (invoice) {
          results.processed++;
          results.invoices.push({
            tenantId: tenant.tenant_id,
            invoiceId: invoice.invoice_id,
            invoiceNumber: invoice.invoice_number,
            amount: invoice.amount,
            emailSent: invoice.email_sent,
            emailRecipients: invoice.email_recipients
          });
        } else {
          results.skipped++;
        }
      } catch (tenantError) {
        console.error(`Error processing tenant ${tenant.tenant_id}:`, tenantError);
        results.errors.push({
          tenantId: tenant.tenant_id,
          error: tenantError.message
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        billingPeriod: `${billingYear}-${String(billingMonth).padStart(2, '0')}`,
        summary: results
      })
    };
  } catch (error) {
    console.error('Billing cron job failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, results })
    };
  }
};
