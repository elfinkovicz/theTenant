// PayPal Payment Provider Client
const https = require('https');

class PayPalClient {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    // Use sandbox for testing, production for live
    this.baseUrl = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
    console.log('PayPal Mode:', process.env.PAYPAL_MODE || 'sandbox', 'URL:', this.baseUrl);
  }

  async getAccessToken() {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const data = await this.request('POST', '/v1/oauth2/token', {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, 'grant_type=client_credentials');

    return data.access_token;
  }

  async createOrder(amount, currency, items, orderId) {
    const token = await this.getAccessToken();

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: amount.toFixed(2)
            }
          }
        },
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity.toString(),
          unit_amount: {
            currency_code: currency,
            value: item.price.toFixed(2)
          }
        }))
      }],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/order-confirmation?orderId=${orderId}`,
        cancel_url: `${process.env.FRONTEND_URL}/cart`,
        brand_name: process.env.SHOP_NAME || 'Shop',
        user_action: 'PAY_NOW'
      }
    };

    const result = await this.request('POST', '/v2/checkout/orders', {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }, JSON.stringify(orderData));

    const approvalUrl = result.links.find(link => link.rel === 'approve')?.href;

    return {
      id: result.id,
      approvalUrl
    };
  }

  async captureOrder(orderId) {
    const token = await this.getAccessToken();

    const result = await this.request('POST', `/v2/checkout/orders/${orderId}/capture`, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return {
      status: result.status,
      captureId: result.purchase_units[0]?.payments?.captures[0]?.id
    };
  }

  request(method, path, headers, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl.replace('https://', ''),
        path,
        method,
        headers
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
              reject(new Error(`PayPal API error: ${parsed.message || data}`));
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

module.exports = PayPalClient;
