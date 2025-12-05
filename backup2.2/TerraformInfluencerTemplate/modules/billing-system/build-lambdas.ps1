# PowerShell Build script for Billing System Lambda functions
# Dependencies werden via Terraform Lambda Layers verwaltet

Write-Host "Building Billing System Lambda functions..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Dependencies werden via Lambda Layers verwaltet - nur Code wird gepackt!" -ForegroundColor Yellow
Write-Host ""

function Build-Lambda {
    param (
        [string]$Name
    )
    
    $dir = "lambda\$Name"
    
    Write-Host "Building $Name..." -ForegroundColor Blue
    
    Push-Location $dir
    
    # Nur index.js packen (keine Dependencies!)
    Compress-Archive -Path index.js -DestinationPath "..\$Name.zip" -Force
    
    Pop-Location
    
    Write-Host "Built $Name successfully (Code only, ~5 KB)" -ForegroundColor Green
}

# Build all Lambda functions
Build-Lambda "cost-calculator"
Build-Lambda "payment-setup"
Build-Lambda "webhook-handler"

Write-Host ""
Write-Host "All Lambda functions built successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Lambda Layers (Stripe, AWS SDK) werden automatisch von Terraform deployed" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Run: terraform init"
Write-Host "2. Run: terraform plan -var-file=project.tfvars"
Write-Host "3. Run: terraform apply -var-file=project.tfvars"
