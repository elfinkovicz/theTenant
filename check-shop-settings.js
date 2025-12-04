// Check Shop Settings in DynamoDB
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_TABLE = 'honigwabe-shop-settings';

async function checkSettings() {
  try {
    console.log('Checking shop settings in table:', SETTINGS_TABLE);
    
    const result = await docClient.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: 'payment-config' }
    }));

    if (!result.Item) {
      console.log('❌ No payment settings found!');
      console.log('You need to configure PayPal settings in the admin panel.');
      return;
    }

    console.log('✅ Payment settings found:');
    console.log('PayPal Enabled:', result.Item.paypalEnabled);
    console.log('PayPal Client ID:', result.Item.paypalClientId ? '✅ Set' : '❌ Not set');
    console.log('PayPal Secret:', result.Item.paypalSecret ? '✅ Set' : '❌ Not set');
    console.log('PayPal Mode:', result.Item.paypalMode || 'Not set (defaults to live)');
    console.log('\nStripe Enabled:', result.Item.stripeEnabled);
    console.log('Mollie Enabled:', result.Item.mollieEnabled);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log('❌ Settings table not found. Make sure Terraform has been applied.');
    }
  }
}

checkSettings();
