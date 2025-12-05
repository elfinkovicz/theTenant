const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USER_TABLE_NAME = process.env.USER_TABLE_NAME;

exports.handler = async (event) => {
  console.log('Post-Confirmation Trigger:', JSON.stringify(event, null, 2));

  try {
    const { userPoolId, userName, request } = event;
    const { userAttributes } = request;

    // User in DynamoDB speichern
    const userItem = {
      userId: userName, // Cognito Sub (User ID)
      email: userAttributes.email,
      name: userAttributes.name || userAttributes.email.split('@')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailVerified: userAttributes.email_verified === 'true',
      status: 'active'
    };

    await docClient.send(new PutCommand({
      TableName: USER_TABLE_NAME,
      Item: userItem
    }));

    console.log('User saved to DynamoDB:', userItem);

    // Event zurückgeben (erforderlich für Cognito Trigger)
    return event;
  } catch (error) {
    console.error('Error saving user to DynamoDB:', error);
    // Fehler nicht werfen, damit die Registrierung nicht fehlschlägt
    return event;
  }
};
