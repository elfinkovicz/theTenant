# Install Lambda Layer Dependencies
# Run this script to install dependencies for all Lambda Layers locally

Write-Host "=== Installing Lambda Layer Dependencies ===" -ForegroundColor Cyan
Write-Host ""

$layers = @("aws-sdk-core", "aws-sdk-extended", "utilities")

foreach ($layer in $layers) {
    $layerPath = "$PSScriptRoot/layers/$layer"
    
    if (Test-Path "$layerPath/package.json") {
        Write-Host "Installing dependencies for $layer..." -ForegroundColor Yellow
        
        Push-Location $layerPath
        
        # Install dependencies
        npm install --production
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $layer dependencies installed" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to install $layer dependencies" -ForegroundColor Red
        }
        
        Pop-Location
    } else {
        Write-Host "  Skipping $layer - package.json not found" -ForegroundColor Gray
    }
    
    Write-Host ""
}

Write-Host "=== Installation Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: terraform init"
Write-Host "2. Run: terraform apply -target=module.lambda_layers"
Write-Host ""
