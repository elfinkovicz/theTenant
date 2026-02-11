# Build Script for Stripe Lambda Functions
# Run from viraltenant-infrastructure directory
# Note: Dependencies come from common-deps Lambda Layer - no npm install needed!

Write-Host "Building Stripe Lambda Functions (using common-deps layer)..." -ForegroundColor Cyan

# Build billing-api (code only, deps from layer)
Write-Host "`nBuilding billing-api..." -ForegroundColor Yellow
Push-Location lambda-functions/billing-api
# Only include JS files, no node_modules needed
Compress-Archive -Path *.js -DestinationPath ../../billing_api.zip -Force
Pop-Location
Write-Host "billing_api.zip created (code only)" -ForegroundColor Green

# Build stripe-webhook (code only, deps from layer)
Write-Host "`nBuilding stripe-webhook..." -ForegroundColor Yellow
Push-Location lambda-functions/stripe-webhook
Compress-Archive -Path *.js -DestinationPath ../../stripe_webhook.zip -Force
Pop-Location
Write-Host "stripe_webhook.zip created (code only)" -ForegroundColor Green

# Build stripe-eventbridge-handler (code only, deps from layer)
Write-Host "`nBuilding stripe-eventbridge-handler..." -ForegroundColor Yellow
Push-Location lambda-functions/stripe-eventbridge-handler
Compress-Archive -Path *.js -DestinationPath ../../stripe_eventbridge_handler.zip -Force
Pop-Location
Write-Host "stripe_eventbridge_handler.zip created (code only)" -ForegroundColor Green

Write-Host "`nAll Lambda functions built successfully!" -ForegroundColor Cyan
Write-Host "Dependencies are provided by common-deps Lambda Layer." -ForegroundColor Gray
Write-Host "`nRun 'terraform apply' to deploy." -ForegroundColor White
