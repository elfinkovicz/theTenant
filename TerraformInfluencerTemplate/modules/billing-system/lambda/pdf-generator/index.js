const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const PDFDocument = require('pdfkit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  const pathParameters = event.pathParameters || {};
  const invoiceId = pathParameters.invoiceId;

  if (!invoiceId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Invoice ID required' })
    };
  }

  try {
    // Get invoice from DynamoDB
    const userId = event.requestContext?.authorizer?.claims?.sub;
    
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.BILLING_TABLE_NAME,
        Key: { userId, invoiceId }
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invoice not found' })
      };
    }

    const invoice = result.Item;

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice);

    // Upload to S3
    const s3Key = `invoices/${userId}/${invoiceId}.pdf`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.INVOICES_BUCKET,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf'
      })
    );

    // Generate public URL (bucket is publicly readable)
    const region = process.env.AWS_REGION || 'eu-central-1';
    const downloadUrl = `https://${process.env.INVOICES_BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        downloadUrl,
        invoiceNumber: invoice.invoiceNumber
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('RECHNUNG', { align: 'center' });
    doc.moveDown();

    // Invoice Details
    doc.fontSize(12);
    doc.text(`Rechnungsnummer: ${invoice.invoiceNumber}`, { align: 'right' });
    doc.text(`Rechnungsdatum: ${new Date(invoice.createdAt).toLocaleDateString('de-DE')}`, { align: 'right' });
    doc.moveDown(2);

    // Customer Info
    doc.text('Rechnungsempfänger:');
    doc.text(invoice.email || 'Kunde');
    doc.moveDown(2);

    // Invoice Items
    doc.fontSize(14).text('Leistungen', { underline: true });
    doc.moveDown();

    doc.fontSize(10);
    
    // Table Header
    const tableTop = doc.y;
    doc.text('Beschreibung', 50, tableTop);
    doc.text('Betrag', 400, tableTop, { width: 100, align: 'right' });
    doc.moveDown();

    // Line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Base Fee
    doc.text('Monatliche Grundgebühr', 50, doc.y);
    doc.text(`${formatCurrency(invoice.baseFee)}`, 400, doc.y, { width: 100, align: 'right' });
    doc.moveDown();

    // AWS Costs
    doc.text(`Infrastrukturkosten (${invoice.period.start} - ${invoice.period.end})`, 50, doc.y);
    doc.text(`${formatCurrency(invoice.awsCosts)}`, 400, doc.y, { width: 100, align: 'right' });
    doc.moveDown();

    // AWS Breakdown
    if (invoice.awsBreakdown && Object.keys(invoice.awsBreakdown).length > 0) {
      doc.fontSize(9).fillColor('#666666');
      Object.entries(invoice.awsBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([service, cost]) => {
          doc.text(`  - ${service}`, 70, doc.y);
          doc.text(`${formatCurrency(cost)}`, 400, doc.y, { width: 100, align: 'right' });
          doc.moveDown(0.5);
        });
      doc.fillColor('#000000').fontSize(10);
      doc.moveDown();
    }

    // Line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Total
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Gesamtbetrag', 50, doc.y);
    doc.text(`${formatCurrency(invoice.amount)}`, 400, doc.y, { width: 100, align: 'right' });
    doc.moveDown(2);

    // Payment Status
    doc.font('Helvetica').fontSize(10);
    const statusText = invoice.status === 'paid' ? 'BEZAHLT' : 
                       invoice.status === 'open' ? 'OFFEN' : 
                       invoice.status.toUpperCase();
    doc.text(`Status: ${statusText}`);
    
    if (invoice.paidAt) {
      doc.text(`Bezahlt am: ${new Date(invoice.paidAt).toLocaleDateString('de-DE')}`);
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).fillColor('#666666');
    doc.text('Vielen Dank für Ihr Vertrauen!', { align: 'center' });
    doc.text(`Stripe Invoice ID: ${invoice.stripeInvoiceId}`, { align: 'center' });

    doc.end();
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}
