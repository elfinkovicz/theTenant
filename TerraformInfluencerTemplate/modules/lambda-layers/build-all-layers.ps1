Write-Host "Building all Lambda Layers..." -ForegroundColor Cyan
Write-Host ""

$layers = @("aws-sdk-core", "aws-sdk-extended", "utilities")

foreach ($layer in $layers) {
    Write-Host "Building $layer layer..." -ForegroundColor Blue
    
    Push-Location "layers\$layer"
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies for $layer" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    
    python build-layer.py $layer
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to prepare $layer layer" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Built $layer layer successfully" -ForegroundColor Green
    Write-Host ""
}

Write-Host "All Lambda Layers built successfully!" -ForegroundColor Green
