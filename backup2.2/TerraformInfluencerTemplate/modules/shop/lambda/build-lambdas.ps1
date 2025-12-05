# Build Lambda ZIP files for Windows

Write-Host "Building Lambda ZIP files..." -ForegroundColor Green

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Create ZIP for each Lambda function
Write-Host "Creating create-order-paypal.zip..." -ForegroundColor Yellow
Compress-Archive -Path create-order-paypal.js,providers,node_modules -DestinationPath create-order-paypal.zip -Force

Write-Host "Creating verify-payment-paypal.zip..." -ForegroundColor Yellow
Compress-Archive -Path verify-payment-paypal.js,providers,node_modules -DestinationPath verify-payment-paypal.zip -Force

Write-Host "Creating get-order.zip..." -ForegroundColor Yellow
Compress-Archive -Path get-order.js,node_modules -DestinationPath get-order.zip -Force

Write-Host "Creating shop-settings.zip..." -ForegroundColor Yellow
Compress-Archive -Path shop-settings.js,node_modules -DestinationPath shop-settings.zip -Force

Write-Host "Done! Lambda ZIP files created." -ForegroundColor Green
