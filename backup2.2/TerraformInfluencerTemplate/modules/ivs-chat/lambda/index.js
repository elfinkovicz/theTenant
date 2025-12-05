const { IvschatClient, CreateChatTokenCommand } = require("@aws-sdk/client-ivschat");

const ivschat = new IvschatClient();

// CORS Headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { userId, username, capabilities } = body;

    if (!userId || !username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "userId und username sind erforderlich" })
      };
    }

    const params = {
      roomIdentifier: process.env.CHAT_ROOM_ARN,
      userId: userId,
      attributes: {
        username: username
      },
      capabilities: capabilities || ["SEND_MESSAGE", "DELETE_MESSAGE"],
      sessionDurationInMinutes: 180
    };

    const command = new CreateChatTokenCommand(params);
    const response = await ivschat.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token: response.token,
        sessionExpirationTime: response.sessionExpirationTime
      })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Fehler beim Erstellen des Chat-Tokens" })
    };
  }
};
