// Stripe Payment Provider Client
const https = require('https');

class StripeClient {
  constructor(config) {
    this.secretKey = config.secretKey;
    this.baseUrl = 'api.stripe.com';
  }

  async createPaymentIntent(amount, currency, orderId) {
    const amountInCents = Math.round(amount * 100);

    const data = new URLSearchParams({
      amount: amountInCents.toString(),
      currency: currency.toLowerCase(),
      'metadata[orderId]': orderId,
      'automatic_payment_methods[enabled]': 'true'
    });

    const result = await this.request('POST', '/v1/payment_intents', data.toString());

    return {
      id: result.id,
      clientSecret: result.client_secret
    };
  }

  async confirmPayment(paymentIntentId) {
    const result = await this.request('GET', `/v1/payment_intents/${paymentIntentId}`);

    return {
      status: result.status,
      amount: result.amount / 100
    };
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': body ? Buffer.byteLength(body) : 0
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Stripe API error: ${parsed.error?.message || data}`));
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

module.exports = StripeClient;
