# Shop Backend Deployment Guide

## 🚀 Quick Start

### 1. Install Lambda Dependencies
```bash
cd TerraformInfluencerTemplate/modules/shop/lambda
npm install
```

### 2. Create Lambda Layer
```bash
mkdir -p nodejs/node_modules
cp -r node_modules/* nodejs/node_modules/
```

### 3. Deploy with Terraform
```bash
cd ../../..
terraform plan -var-file=clients/honigwabe/terraform.tfvars
terraform apply -var-file=clients/honigwabe/terraform.tfvars
```

## 📋 What Gets Deployed

### DynamoDB Tables
- `honigwabe-orders` - Order storage
- `honigwabe-products` - Product catalog (existing)
- `honigwabe-shop-settings` - Payment provider credentials (encrypted)

### Lambda Functions
- `create-order-v2` - Create orders with PayPal/Stripe/Mollie
- `verify-payment` - Verify payments and send emails
- `get-order` - Get order details
- `shop-settings` - Manage payment settings (Admin only)

### API Routes
- `POST /orders/v2` - Create order
- `POST /orders/verify` - Verify payment
- `GET /orders/{orderId}` - Get order details
- `GET /settings` - Get shop settings (Admin)
- `PUT /settings` - Update shop settings (Admin)

### Security
- KMS encryption for payment credentials
- Cognito JWT authorization
- SES for email notifications

## 🔧 Configuration

### Required Variables
Add to `terraform.tfvars`:
```hcl
frontend_url = "https://honigwabe.live"
sender_email = "noreply@honigwabe.live"
shop_name    = "Honigwabe Shop"
```

### SES Email Verification
```bash
aws ses verify-email-identity \
  --email-address noreply@honigwabe.live \
  --region eu-central-1 \
  --profile honigwabe
```

## 🧪 Testing

### 1. Configure Payment Provider (Admin)
```bash
# Login as admin on website
# Go to /shop
# Click "Shop-Einstellungen"
# Enter PayPal/Stripe/Mollie credentials
# Save
```

### 2. Test Order Flow
```bash
# Add products to cart
# Go to /cart
# Select payment provider
# Click "Jetzt bezahlen"
# Complete payment
# Check emails (customer + seller)
```

### 3. Verify in DynamoDB
```bash
aws dynamodb scan \
  --table-name honigwabe-orders \
  --region eu-central-1 \
  --profile honigwabe
```

## 📊 Monitoring

### CloudWatch Logs
```bash
# Create Order logs
aws logs tail /aws/lambda/honigwabe-shop-create-order-v2 --follow

# Verify Payment logs
aws logs tail /aws/lambda/honigwabe-shop-verify-payment --follow
```

### Metrics
- Lambda invocations
- API Gateway 4xx/5xx errors
- DynamoDB read/write capacity
- SES email delivery

## 🔒 Security Checklist

- [ ] KMS key created for encryption
- [ ] Payment credentials encrypted in DynamoDB
- [ ] Cognito authorizer configured
- [ ] Admin group permissions set
- [ ] SES sender email verified
- [ ] CORS configured properly
- [ ] Rate limiting enabled

## 🐛 Troubleshooting

### Payment Creation Fails
**Check:**
- Payment provider credentials in settings
- KMS decryption permissions
- Lambda logs for errors

### Emails Not Sending
**Check:**
- SES email verification status
- SES sending limits (sandbox mode)
- Lambda SES permissions

### Stock Not Updating
**Check:**
- Verify Payment Lambda execution
- DynamoDB update permissions
- Product stock values

## 📚 API Documentation

### Create Order
```bash
POST /orders/v2
Authorization: Bearer {cognito-token}

{
  "items": [
    {
      "productId": "prod_123",
      "quantity": 2
    }
  ],
  "paymentProvider": "paypal"
}

Response:
{
  "orderId": "ord_abc123",
  "paymentId": "PAYPAL-123",
  "approvalUrl": "https://paypal.com/..."
}
```

### Verify Payment
```bash
POST /orders/verify
Authorization: Bearer {cognito-token}

{
  "orderId": "ord_abc123",
  "paymentId": "PAYPAL-123"
}

Response:
{
  "success": true,
  "orderId": "ord_abc123"
}
```

## 🎯 Success Criteria

- ✅ Orders created successfully
- ✅ Payments verified with all 3 providers
- ✅ Stock updated after purchase
- ✅ Emails sent to customer and seller
- ✅ Admin can configure settings
- ✅ API response time < 500ms

## 📞 Support

Check CloudWatch Logs first, then review Terraform state.

**Version:** 2.0  
**Last Updated:** 2025-12-01
