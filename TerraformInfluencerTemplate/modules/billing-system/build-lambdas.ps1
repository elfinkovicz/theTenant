#!/usr/bin/env pwsh
# Build script for Billing System Lambda functions

Write-Host "Building Billing System Lambda functions..." -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $scriptDir "lambda"

# Function to build a Lambda
function Build-Lambda {
    param(
        [string]$Name,
        [string]$Path
    )
    
    Write-Host "`nBuilding $Name..." -ForegroundColor Yellow
    
    # Check if index.js exists
    if (-not (Test-Path (Join-Path $Path "index.js"))) {
        Write-Host "  Skipping $Name - no index.js found" -ForegroundColor Gray
        return
    }
    
    Push-Location $Path
    
    try {
        # No dependencies to install - all dependencies are in Lambda Layers
        Write-Host "  Dependencies provided by Lambda Layers (utilities layer)" -ForegroundColor Gray
        
        # Create ZIP with only index.js (no node_modules)
        $zipPath = Join-Path $lambdaDir "$Name.zip"
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        
        Write-Host "  Creating ZIP..." -ForegroundColor Gray
        Compress-Archive -Path "index.js" -DestinationPath $zipPath -Force
        
        $zipSize = (Get-Item $zipPath).Length / 1KB
        $sizeRounded = [math]::Round($zipSize, 2)
        Write-Host "  OK $Name built ($sizeRounded KB)" -ForegroundColor Green
        
    } finally {
        Pop-Location
    }
}

# Build all Lambda functions
Build-Lambda -Name "cost-calculator" -Path (Join-Path $lambdaDir "cost-calculator")
Build-Lambda -Name "payment-setup" -Path (Join-Path $lambdaDir "payment-setup")
Build-Lambda -Name "webhook-handler" -Path (Join-Path $lambdaDir "webhook-handler")
Build-Lambda -Name "pdf-generator" -Path (Join-Path $lambdaDir "pdf-generator")

Write-Host "`nAll Billing Lambda functions built successfully!" -ForegroundColor Green
