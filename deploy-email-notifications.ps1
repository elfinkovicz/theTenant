# Deploy Email Notifications System
# Adds email notification functionality to newsfeed

Write-Host "=== Email Notifications Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install Lambda Dependencies
Write-Host "Step 1: Installing Lambda dependencies..." -ForegroundColor Yellow
Set-Location "TerraformInfluencerTemplate/modules/email-notifications/lambda"
npm install
Set-Location "../../.."
Write-Host "Dependencies installed" -ForegroundColor Green

# Step 2: Deploy Infrastructure
Write-Host ""
Write-Host "Step 2: Deploying infrastructure with Terraform..." -ForegroundColor Yellow
Set-Location ".."
python deploy.py

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Email Notifications System deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Features:" -ForegroundColor Yellow
Write-Host "  - New E-Mail tab in Newsfeed Settings" -ForegroundColor White
Write-Host "  - Configure sender email prefix (e.g., newsfeed@domain.com)" -ForegroundColor White
Write-Host "  - Automatic emails to all registered users" -ForegroundColor White
Write-Host "  - Beautiful HTML email templates" -ForegroundColor White
Write-Host "  - Triggered on published posts" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Go to Admin > Newsfeed Settings" -ForegroundColor White
Write-Host "  2. Click on the E-Mail tab" -ForegroundColor White
Write-Host "  3. Configure sender prefix and domain" -ForegroundColor White
Write-Host "  4. Enable email notifications" -ForegroundColor White
Write-Host "  5. Publish a test post to verify" -ForegroundColor White
