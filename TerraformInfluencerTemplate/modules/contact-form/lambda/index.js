const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const ses = new SESClient();

exports.handler = async (event) => {
  // CORS Headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle OPTIONS preflight
  if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Log event for debugging
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Alle Felder sind erforderlich" })
      };
    }

    const params = {
      Source: process.env.SENDER_EMAIL,
      Destination: {
        ToAddresses: [process.env.RECIPIENT_EMAIL]
      },
      Message: {
        Subject: {
          Data: `Kontaktformular: Nachricht von ${name}`
        },
        Body: {
          Text: {
            Data: `Name: ${name}\nE-Mail: ${email}\n\nNachricht:\n${message}`
          },
          Html: {
            Data: `
              <h2>Neue Kontaktanfrage</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>E-Mail:</strong> ${email}</p>
              <p><strong>Nachricht:</strong></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            `
          }
        }
      }
    };

    await ses.send(new SendEmailCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Nachricht erfolgreich gesendet" })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Fehler beim Senden der Nachricht", details: error.message })
    };
  }
};
