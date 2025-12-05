# Cleanup Script - Remove all honey/bee references and change to purple theme

Write-Host "Starting cleanup and rebranding..." -ForegroundColor Cyan

# Get all HTML files
$htmlFiles = Get-ChildItem -Path "public" -Filter "*.html" -Recurse

foreach ($file in $htmlFiles) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Remove bee-container div
    $content = $content -replace '<div id="bee-container"></div>\s*', ''
    
    # Remove bee emoji
    $content = $content -replace '🐝', '✨'
    
    # Remove honey pot emoji
    $content = $content -replace '🍯', '💎'
    
    # Remove "Bienen-Check" and replace with "Security Check"
    $content = $content -replace 'Bienen-Check 🐝', 'Security Check ✓'
    $content = $content -replace 'Bienen-Check', 'Security Check'
    
    # Save file
    Set-Content $file.FullName -Value $content -Encoding UTF8 -NoNewline
}

Write-Host "`nHTML files cleaned!" -ForegroundColor Green

# Now update CSS color scheme from yellow to purple
Write-Host "`nUpdating color scheme to purple..." -ForegroundColor Cyan

$cssFile = "src/css/styles.css"
if (Test-Path $cssFile) {
    $cssContent = Get-Content $cssFile -Raw -Encoding UTF8
    
    # Replace color variables
    $cssContent = $cssContent -replace '--honey-yellow: #FFC400;', '--primary-purple: #9333EA;'
    $cssContent = $cssContent -replace '--honey-gold: #FFB700;', '--secondary-purple: #A855F7;'
    $cssContent = $cssContent -replace '--honey-orange: #FF8A00;', '--accent-purple: #C084FC;'
    $cssContent = $cssContent -replace '--honey-beige: #FFF4D6;', '--light-text: #F3E8FF;'
    $cssContent = $cssContent -replace '--warm-black: #111111;', '--dark-bg: #0F0A1E;'
    
    # Replace color references
    $cssContent = $cssContent -replace 'var\(--honey-yellow\)', 'var(--primary-purple)'
    $cssContent = $cssContent -replace 'var\(--honey-gold\)', 'var(--secondary-purple)'
    $cssContent = $cssContent -replace 'var\(--honey-orange\)', 'var(--accent-purple)'
    $cssContent = $cssContent -replace 'var\(--honey-beige\)', 'var(--light-text)'
    $cssContent = $cssContent -replace 'var\(--warm-black\)', 'var(--dark-bg)'
    
    # Replace hex colors directly
    $cssContent = $cssContent -replace '#FFC400', '#9333EA'
    $cssContent = $cssContent -replace '#FFB700', '#A855F7'
    $cssContent = $cssContent -replace '#FF8A00', '#C084FC'
    $cssContent = $cssContent -replace '#FFF4D6', '#F3E8FF'
    $cssContent = $cssContent -replace '#111111', '#0F0A1E'
    
    Set-Content $cssFile -Value $cssContent -Encoding UTF8 -NoNewline
    Write-Host "CSS updated to purple theme!" -ForegroundColor Green
}

Write-Host "`n✅ Cleanup and rebranding complete!" -ForegroundColor Green
Write-Host "- Removed all bee/honey references" -ForegroundColor Cyan
Write-Host "- Changed color scheme from yellow to purple" -ForegroundColor Cyan
Write-Host "- Updated emojis to generic ones" -ForegroundColor Cyan
