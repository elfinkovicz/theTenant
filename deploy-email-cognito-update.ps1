# Email Notifications with Post-Confirmation Trigger Deployment
# This script adds a Cognito Post-Confirmation trigger to save users to DynamoDB

Write-Host "=== Email Notifications with Post-Confirmation Trigger Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Rebuild Lambda Layers with Cognito SDK
Write-Host "Step 1: Rebuilding Lambda Layers..." -ForegroundColor Yellow
Set-Location "TerraformInfluencerTemplate/modules/lambda-layers/layers/aws-sdk-extended"

if (Test-Path "node_modules") {
    Write-Host "Removing old node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force node_modules
}

if (Test-Path "package-lock.json") {
    Write-Host "Removing old package-lock.json..." -ForegroundColor Gray
    Remove-Item -Force package-lock.json
}

Write-Host "Installing dependencies with Cognito SDK..." -ForegroundColor Gray
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed!" -ForegroundColor Red
    Set-Location "../../../.."
    exit 1
}

Set-Location "../../../.."
Write-Host "Lambda layers updated successfully!" -ForegroundColor Green
Write-Host ""

# Step 2: Rebuild Email Notifications Lambda
Write-Host "Step 2: Rebuilding Email Notifications Lambda..." -ForegroundColor Yellow
Set-Location "TerraformInfluencerTemplate/modules/email-notifications"

if (Test-Path "lambda.zip") {
    Write-Host "Removing old lambda.zip..." -ForegroundColor Gray
    Remove-Item -Force lambda.zip
}

Set-Location "../../.."
Write-Host "Email Notifications Lambda prepared for deployment!" -ForegroundColor Green
Write-Host ""

# Step 3: Terraform Plan
Write-Host "Step 3: Running Terraform Plan..." -ForegroundColor Yellow
Set-Location "TerraformInfluencerTemplate"

terraform plan -var-file="project.tfvars" -out=tfplan

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Terraform plan failed!" -ForegroundColor Red
    Set-Location ".."
    exit 1
}

Write-Host ""
Write-Host "Terraform plan completed successfully!" -ForegroundColor Green
Write-Host ""

# Step 4: Ask for confirmation
Write-Host "=== Review the plan above ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Changes include:" -ForegroundColor Yellow
Write-Host "  - Added Cognito Post-Confirmation Lambda Trigger" -ForegroundColor White
Write-Host "  - New users are automatically saved to DynamoDB Users table" -ForegroundColor White
Write-Host "  - Email Notifications Lambda reads from Users DynamoDB table" -ForegroundColor White
Write-Host "  - Updated Lambda Layer with SES SDK" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Do you want to apply these changes? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    Set-Location ".."
    exit 0
}

# Step 5: Terraform Apply
Write-Host ""
Write-Host "Step 4: Applying Terraform changes..." -ForegroundColor Yellow

terraform apply tfplan

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Terraform apply failed!" -ForegroundColor Red
    Set-Location ".."
    exit 1
}

Set-Location ".."

Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Post-Confirmation Trigger is now active:" -ForegroundColor Cyan
Write-Host "  ✓ New users are automatically saved to DynamoDB" -ForegroundColor Green
Write-Host "  ✓ Email Notifications sends to all registered users" -ForegroundColor Green
Write-Host ""
Write-Host "Test by:" -ForegroundColor Yellow
Write-Host "  1. Registering a new user" -ForegroundColor White
Write-Host "  2. Creating a newsfeed post with status 'published'" -ForegroundColor White
Write-Host ""
