# PowerShell Script to add users to the admin group

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$false)]
    [string]$Profile = "honigwabe",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "eu-central-1"
)

Write-Host "Adding admin user..." -ForegroundColor Yellow
Write-Host "Email: $Email"
Write-Host "Profile: $Profile"
Write-Host "Region: $Region"
Write-Host ""

# Get User Pool ID
Write-Host "Getting User Pool ID..." -ForegroundColor Yellow
$UserPoolId = aws cognito-idp list-user-pools --max-results 10 --region $Region --profile $Profile --query "UserPools[?Name=='honigwabe-user-pool'].Id" --output text

if ([string]::IsNullOrEmpty($UserPoolId)) {
    Write-Host "Error: User Pool not found" -ForegroundColor Red
    exit 1
}

Write-Host "User Pool ID: $UserPoolId"
Write-Host ""

# Check if user exists
Write-Host "Checking if user exists..." -ForegroundColor Yellow
try {
    aws cognito-idp admin-get-user --user-pool-id $UserPoolId --username $Email --region $Region --profile $Profile 2>&1 | Out-Null
    Write-Host "✓ User exists" -ForegroundColor Green
} catch {
    Write-Host "Error: User $Email does not exist" -ForegroundColor Red
    Write-Host "User must register first on the website"
    exit 1
}

Write-Host ""

# Add to admin group
Write-Host "Adding user to admin group..." -ForegroundColor Yellow
aws cognito-idp admin-add-user-to-group `
    --user-pool-id $UserPoolId `
    --username $Email `
    --group-name admins `
    --region $Region `
    --profile $Profile

Write-Host ""
Write-Host "✓ Successfully added $Email to admin group!" -ForegroundColor Green
Write-Host ""
Write-Host "The user now has admin privileges and can:"
Write-Host "  - Upload videos"
Write-Host "  - Edit videos"
Write-Host "  - Delete videos"
Write-Host "  - Manage video metadata"
