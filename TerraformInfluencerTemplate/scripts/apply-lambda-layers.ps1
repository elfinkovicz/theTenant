# Apply Lambda Layers to all modules
# This script updates Lambda modules to use Lambda Layers

Write-Host "Applying Lambda Layers to all modules..." -ForegroundColor Cyan

$modules = @{
    "ad-management" = "aws_sdk_core"
    "channel-management" = "aws_sdk_core"
    "contact-info-management" = "aws_sdk_core"
    "event-management" = "aws_sdk_core"
    "ivs-chat" = "aws_sdk_extended"
    "legal-management" = "aws_sdk_core"
    "newsfeed-management" = "aws_sdk_core"
    "product-management" = "aws_sdk_core"
    "team-management" = "aws_sdk_core"
    "telegram-integration" = "aws_sdk_core"
    "video-management" = "aws_sdk_core,utilities"
    "shop" = "aws_sdk_core,aws_sdk_extended,utilities"
}

foreach ($module in $modules.Keys) {
    Write-Host "Processing: $module" -ForegroundColor Yellow
    
    $mainTf = "TerraformInfluencerTemplate/modules/$module/main.tf"
    $varsTf = "TerraformInfluencerTemplate/modules/$module/variables.tf"
    $pkgJson = "TerraformInfluencerTemplate/modules/$module/lambda/package.json"
    
    if (Test-Path $pkgJson) {
        Remove-Item $pkgJson -Force
        Write-Host "  Removed package.json" -ForegroundColor Green
    }
}

Write-Host "`nDone! Now update main.tf and variables.tf manually." -ForegroundColor Cyan
