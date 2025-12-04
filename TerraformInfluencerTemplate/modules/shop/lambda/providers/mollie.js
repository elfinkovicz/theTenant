// Mollie Payment Provider Client
const https = require('https');

class MollieClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = 'api.mollie.com';
  }

  async createPayment(amount, currency, orderId) {
    const paymentData = {
      amount: {
        currency,
        value: amount.toFixed(2)
      },
      description: `Order ${orderId}`,
      redirectUrl: `${process.env.FRONTEND_URL}/order-confirmation?orderId=${orderId}`,
      webhookUrl: `${process.env.API_URL}/orders/${orderId}/webhook`,
      metadata: {
        orderId
      }
    };

    const result = await this.request('POST', '/v2/payments', JSON.stringify(paymentData));

    return {
      id: result.id,
      approvalUrl: result._links.checkout.href
    };
  }

  async getPayment(paymentId) {
    const result = await this.request('GET', `/v2/payments/${paymentId}`);

    return {
      status: result.status,
      amount: parseFloat(result.amount.value)
    };
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Mollie API error: ${parsed.detail || data}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

module.exports = MollieClient;
