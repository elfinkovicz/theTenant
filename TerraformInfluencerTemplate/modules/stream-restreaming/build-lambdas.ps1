# Build Lambda Packages für Stream Restreaming

Write-Host "Building Lambda packages..." -ForegroundColor Green

# Erstelle temporäre Verzeichnisse
$tempDir = "temp_build"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Build lambda.zip (API Handler)
Write-Host "Building lambda.zip..." -ForegroundColor Yellow
Copy-Item "lambda/index.py" "$tempDir/index.py"
Compress-Archive -Path "$tempDir/index.py" -DestinationPath "lambda.zip" -Force

# Build monitor.zip (Stream Monitor)
Write-Host "Building monitor.zip..." -ForegroundColor Yellow
Copy-Item "lambda/stream_monitor.py" "$tempDir/stream_monitor.py"
Copy-Item "lambda/index.py" "$tempDir/index.py"
Compress-Archive -Path "$tempDir/*" -DestinationPath "monitor.zip" -Force

# Cleanup
Remove-Item -Recurse -Force $tempDir

Write-Host "Lambda packages built successfully!" -ForegroundColor Green
Write-Host "  - lambda.zip (API Handler)" -ForegroundColor Cyan
Write-Host "  - monitor.zip (Stream Monitor)" -ForegroundColor Cyan
