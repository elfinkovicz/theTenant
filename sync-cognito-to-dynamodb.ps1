# Cognito to DynamoDB User Sync Script
param(
    [Parameter(Mandatory=$false)]
    [string]$Region = "eu-central-1",
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "honigwabe"
)

Write-Host "=== Cognito to DynamoDB User Sync ===" -ForegroundColor Cyan
Write-Host ""

$UserPoolId = "${ProjectName}-users"
$TableName = "${ProjectName}-users"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  User Pool: $UserPoolId" -ForegroundColor White
Write-Host "  DynamoDB Table: $TableName" -ForegroundColor White
Write-Host ""

# Step 1: Get User Pool ID
Write-Host "Step 1: Finding Cognito User Pool..." -ForegroundColor Yellow

try {
    $userPools = aws cognito-idp list-user-pools --max-results 60 --region $Region | ConvertFrom-Json
    $userPool = $userPools.UserPools | Where-Object { $_.Name -eq $UserPoolId }
    
    if (-not $userPool) {
        Write-Host "ERROR: User Pool not found!" -ForegroundColor Red
        exit 1
    }
    
    $actualUserPoolId = $userPool.Id
    Write-Host "Found User Pool: $actualUserPoolId" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to find User Pool" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: List all Cognito users
Write-Host "Step 2: Fetching all Cognito users..." -ForegroundColor Yellow

$allUsers = @()
$paginationToken = $null

do {
    try {
        if ($paginationToken) {
            $result = aws cognito-idp list-users --user-pool-id $actualUserPoolId --region $Region --pagination-token $paginationToken | ConvertFrom-Json
        } else {
            $result = aws cognito-idp list-users --user-pool-id $actualUserPoolId --region $Region | ConvertFrom-Json
        }
        
        $allUsers += $result.Users
        $paginationToken = $result.PaginationToken
        
        Write-Host "  Fetched $($result.Users.Count) users..." -ForegroundColor Gray
    } catch {
        Write-Host "ERROR: Failed to list users" -ForegroundColor Red
        exit 1
    }
} while ($paginationToken)

Write-Host "Found $($allUsers.Count) total users in Cognito" -ForegroundColor Green
Write-Host ""

if ($allUsers.Count -eq 0) {
    Write-Host "No users to sync. Exiting." -ForegroundColor Yellow
    exit 0
}

# Step 3: Sync users to DynamoDB
Write-Host "Step 3: Syncing users to DynamoDB..." -ForegroundColor Yellow

$syncedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($user in $allUsers) {
    $userId = $user.Username
    $email = ($user.Attributes | Where-Object { $_.Name -eq "email" }).Value
    $name = ($user.Attributes | Where-Object { $_.Name -eq "name" }).Value
    $emailVerified = ($user.Attributes | Where-Object { $_.Name -eq "email_verified" }).Value
    
    if ($user.UserStatus -ne "CONFIRMED") {
        Write-Host "  Skipping unconfirmed user: $email" -ForegroundColor Gray
        $skippedCount++
        continue
    }
    
    if (-not $name) {
        $name = $email.Split('@')[0]
    }
    
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    # Create JSON file for this item
    $tempFile = [System.IO.Path]::GetTempFileName()
    
    $itemJson = @"
{
    "userId": {"S": "$userId"},
    "email": {"S": "$email"},
    "name": {"S": "$name"},
    "emailVerified": {"BOOL": $(if ($emailVerified -eq "true") { "true" } else { "false" })},
    "status": {"S": "active"},
    "createdAt": {"S": "$timestamp"},
    "updatedAt": {"S": "$timestamp"}
}
"@
    
    $itemJson | Out-File -FilePath $tempFile -Encoding UTF8
    
    $result = aws dynamodb put-item --table-name $TableName --item file://$tempFile --region $Region 2>&1
    Remove-Item $tempFile -Force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Synced: $email" -ForegroundColor Green
        $syncedCount++
    } else {
        Write-Host "  Failed to sync: $email" -ForegroundColor Red
        Write-Host "    Error: $result" -ForegroundColor Gray
        $errorCount++
    }
}

Write-Host ""
Write-Host "=== Sync Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Total users in Cognito: $($allUsers.Count)" -ForegroundColor White
Write-Host "  Successfully synced: $syncedCount" -ForegroundColor Green
Write-Host "  Skipped (unconfirmed): $skippedCount" -ForegroundColor Yellow
Write-Host "  Errors: $errorCount" -ForegroundColor Red
Write-Host ""

if ($errorCount -gt 0) {
    Write-Host "Some users failed to sync." -ForegroundColor Yellow
    exit 1
}

Write-Host "All users successfully synced!" -ForegroundColor Green
Write-Host ""
