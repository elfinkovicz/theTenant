#!/usr/bin/env pwsh
# Build Utilities Lambda Layer (Stripe + PDFKit)

Write-Host "Building Utilities Lambda Layer..." -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$layerDir = Join-Path $scriptDir "layers/utilities"

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
Push-Location $layerDir

try {
    npm install --production
    
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    
    Write-Host "  OK Dependencies installed" -ForegroundColor Green
    
} finally {
    Pop-Location
}

# Build layer structure
Write-Host "`nBuilding layer structure..." -ForegroundColor Yellow
python (Join-Path $scriptDir "build-layer.py") utilities

if ($LASTEXITCODE -ne 0) {
    throw "Layer build failed"
}

Write-Host "`nUtilities Layer built successfully!" -ForegroundColor Green
Write-Host "Next step: terraform apply -target=module.lambda_layers" -ForegroundColor Cyan
