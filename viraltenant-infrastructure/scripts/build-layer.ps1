# Build Lambda Layer Script
# =========================
# This script builds the common-deps layer for all Lambda functions

$ErrorActionPreference = "Stop"

$layerPath = "$PSScriptRoot\..\lambda-layers\common-deps"
$nodejsPath = "$layerPath\nodejs"
$zipPath = "$layerPath\common-deps-layer.zip"

Write-Host "🔧 Building common-deps Lambda Layer..." -ForegroundColor Cyan

# Check if nodejs folder exists
if (-not (Test-Path $nodejsPath)) {
    Write-Host "❌ nodejs folder not found at $nodejsPath" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
Push-Location $nodejsPath
npm install --production
Pop-Location

# Remove old zip if exists
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Create zip (Lambda expects nodejs/node_modules structure)
Write-Host "📦 Creating layer zip..." -ForegroundColor Yellow
Push-Location $layerPath
Compress-Archive -Path "nodejs" -DestinationPath $zipPath -Force
Pop-Location

# Get zip size
$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "✅ Layer built successfully!" -ForegroundColor Green
Write-Host "📁 Location: $zipPath" -ForegroundColor Gray
Write-Host "📊 Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Gray

# Check if size is within Lambda limits (50MB unzipped, 250MB total)
if ($zipSize -gt 50) {
    Write-Host "⚠️ Warning: Layer is larger than 50MB. Consider splitting dependencies." -ForegroundColor Yellow
}
