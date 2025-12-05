# Migration Script: Convert Lambda functions to use Lambda Layers
# This script updates all Lambda modules to use shared Lambda Layers instead of bundled dependencies

Write-Host "=== Lambda Layer Migration Script ===" -ForegroundColor Cyan
Write-Host ""

# Define modules and their required layers
$modules = @{
    "ad-management" = @("aws_sdk_core")
    "channel-management" = @("aws_sdk_core")
    "contact-info-management" = @("aws_sdk_core")
    "event-management" = @("aws_sdk_core")
    "ivs-chat" = @("aws_sdk_extended")
    "legal-management" = @("aws_sdk_core")
    "newsfeed-management" = @("aws_sdk_core")
    "product-management" = @("aws_sdk_core")
    "shop" = @("aws_sdk_core", "aws_sdk_extended", "utilities")
    "team-management" = @("aws_sdk_core")
    "telegram-integration" = @("aws_sdk_core")
    "video-management" = @("aws_sdk_core", "utilities")
}

$modulesPath = "TerraformInfluencerTemplate/modules"

foreach ($module in $modules.Keys) {
    Write-Host "Processing module: $module" -ForegroundColor Yellow
    
    $mainTfPath = "$modulesPath/$module/main.tf"
    $variablesTfPath = "$modulesPath/$module/variables.tf"
    $packageJsonPath = "$modulesPath/$module/lambda/package.json"
    
    if (-not (Test-Path $mainTfPath)) {
        Write-Host "  Skipping - main.tf not found" -ForegroundColor Gray
        continue
    }
    
    # 1. Update main.tf - Change source_dir to source_file
    Write-Host "  Updating main.tf..." -ForegroundColor Green
    $mainContent = Get-Content $mainTfPath -Raw
    
    # Replace source_dir with source_file for single file
    $mainContent = $mainContent -replace 'source_dir\s*=\s*"\$\{path\.module\}/lambda"', 'source_file = "${path.module}/lambda/index.js"'
    
    # Add layers to Lambda function if not already present
    if ($mainContent -notmatch 'layers\s*=') {
        $layersList = $modules[$module] | ForEach-Object {
            "    var.${_}_layer_arn"
        }
        $layersBlock = "`n  # Use Lambda Layers for dependencies`n  layers = [`n$($layersList -join ",`n")`n  ]`n"
        
        # Insert layers after runtime line
        $mainContent = $mainContent -replace '(runtime\s*=\s*"[^"]+"\s*\n)', "`$1$layersBlock"
    }
    
    Set-Content -Path $mainTfPath -Value $mainContent -NoNewline
    
    # 2. Update variables.tf - Add layer ARN variables
    Write-Host "  Updating variables.tf..." -ForegroundColor Green
    
    if (Test-Path $variablesTfPath) {
        $variablesContent = Get-Content $variablesTfPath -Raw
        
        foreach ($layer in $modules[$module]) {
            $varName = "${layer}_layer_arn"
            if ($variablesContent -notmatch $varName) {
                $layerDescription = switch ($layer) {
                    "aws_sdk_core" { "ARN of the AWS SDK Core Lambda Layer (DynamoDB, S3)" }
                    "aws_sdk_extended" { "ARN of the AWS SDK Extended Lambda Layer (SES, KMS, IVS)" }
                    "utilities" { "ARN of the Utilities Lambda Layer (uuid, etc.)" }
                }
                
                $variableBlock = "`n`nvariable `"$varName`" {`n  description = `"$layerDescription`"`n  type        = string`n}"
                $variablesContent += $variableBlock
            }
        }
        
        Set-Content -Path $variablesTfPath -Value $variablesContent -NoNewline
    }
    
    # 3. Delete package.json (dependencies now come from layers)
    if (Test-Path $packageJsonPath) {
        Write-Host "  Removing package.json..." -ForegroundColor Green
        Remove-Item $packageJsonPath -Force
    }
    
    Write-Host "  ✓ Module $module migrated successfully" -ForegroundColor Green
    Write-Host ""
}

Write-Host ""
Write-Host "=== Migration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update main.tf to pass layer ARNs to each module"
Write-Host "2. Run: terraform init"
Write-Host "3. Run: terraform plan"
Write-Host "4. Run: terraform apply"
Write-Host ""
Write-Host "Benefits:" -ForegroundColor Green
Write-Host "  - Faster deployments (no dependency packaging)"
Write-Host "  - Smaller Lambda packages"
Write-Host "  - Consistent dependency versions"
Write-Host "  - Reduced storage costs"
