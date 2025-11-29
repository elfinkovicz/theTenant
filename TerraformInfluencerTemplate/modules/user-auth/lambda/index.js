const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand, AdminDeleteUserCommand } = require("@aws-sdk/client-cognito-identity-provider");

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient();

const TABLE_NAME = process.env.USER_TABLE_NAME;
const USER_POOL_ID = process.env.USER_POOL_ID;

exports.handler = async (event) => {
  try {
    const { httpMethod, pathParameters, body } = event;
    const userId = pathParameters?.userId;

    switch (httpMethod) {
      case "GET":
        return await getUser(userId);
      case "PUT":
        return await updateUser(userId, JSON.parse(body));
      case "DELETE":
        return await deleteUser(userId);
      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: "Method not allowed" })
        };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function getUser(userId) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId }
  });

  const result = await docClient.send(command);
  
  if (!result.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "User not found" })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result.Item)
  };
}

async function updateUser(userId, updates) {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      ...updates,
      updatedAt: new Date().toISOString()
    }
  });

  await docClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "User updated successfully" })
  };
}

async function deleteUser(userId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { userId }
  }));

  await cognitoClient.send(new AdminDeleteUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: userId
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "User deleted successfully" })
  };
}
