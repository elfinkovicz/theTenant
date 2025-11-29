#!/usr/bin/env node

/**
 * Build Script for Creator Platform Template
 * 
 * Usage: node build.js --creator=<creator-slug>
 * Example: node build.js --creator=kasper
 */

const fs = require('fs-extra');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`[${step}] ${message}`, 'blue');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarn(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// Parse command line arguments
const args = process.argv.slice(2);
const creatorArg = args.find(arg => arg.startsWith('--creator='));

if (!creatorArg) {
    logError('Missing --creator argument');
    log('Usage: node build.js --creator=<creator-slug>');
    log('Example: node build.js --creator=kasper');
    process.exit(1);
}

const creatorSlug = creatorArg.split('=')[1];

if (!creatorSlug) {
    logError('Invalid creator slug');
    process.exit(1);
}

log('\n🚀 Building Creator Platform', 'blue');
log(`Creator: ${creatorSlug}\n`);

// Paths
const customizationDir = path.join(__dirname, '../customizations', creatorSlug);
const configFile = path.join(customizationDir, 'config.json');
const distDir = path.join(__dirname, 'dist', creatorSlug);
const templateDir = path.join(__dirname, 'public');
const srcDir = path.join(__dirname, 'src');

// Step 1: Check if customization exists
logStep('1/6', 'Checking customization directory...');
if (!fs.existsSync(customizationDir)) {
    logError(`Customization directory not found: ${customizationDir}`);
    log('Please create it first with: mkdir -p ' + customizationDir);
    process.exit(1);
}
logSuccess('Customization directory found');

// Step 2: Load configuration
logStep('2/6', 'Loading configuration...');
if (!fs.existsSync(configFile)) {
    logError(`Configuration file not found: ${configFile}`);
    process.exit(1);
}

let config;
try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    logSuccess('Configuration loaded');
} catch (error) {
    logError(`Failed to parse configuration: ${error.message}`);
    process.exit(1);
}

// Step 3: Clean and create dist directory
logStep('3/6', 'Preparing output directory...');
fs.removeSync(distDir);
fs.ensureDirSync(distDir);
logSuccess(`Output directory created: ${distDir}`);

// Step 4: Copy template files
logStep('4/6', 'Copying template files...');
fs.copySync(templateDir, distDir);
logSuccess('Template files copied');

// Step 5: Process and replace variables
logStep('5/6', 'Processing template variables...');

// Helper function to replace variables in content
function replaceVariables(content, config) {
    // Creator info
    content = content.replace(/\{\{CREATOR_NAME\}\}/g, config.creator.name || 'Creator Name');
    content = content.replace(/\{\{CREATOR_SLUG\}\}/g, config.creator.slug || creatorSlug);
    content = content.replace(/\{\{CREATOR_DOMAIN\}\}/g, config.creator.domain || 'example.com');
    content = content.replace(/\{\{CREATOR_TAGLINE\}\}/g, config.creator.tagline || 'Your Tagline Here');
    content = content.replace(/\{\{CREATOR_DESCRIPTION\}\}/g, config.creator.description || 'Description');
    
    // AWS Configuration
    content = content.replace(/\{\{AWS_REGION\}\}/g, config.aws?.region || 'eu-central-1');
    content = content.replace(/\{\{COGNITO_USER_POOL_ID\}\}/g, config.aws?.cognito?.userPoolId || 'TBD');
    content = content.replace(/\{\{COGNITO_CLIENT_ID\}\}/g, config.aws?.cognito?.clientId || 'TBD');
    content = content.replace(/\{\{COGNITO_AUTH_DOMAIN\}\}/g, config.aws?.cognito?.authDomain || 'TBD');
    content = content.replace(/\{\{USER_API_ENDPOINT\}\}/g, config.aws?.api?.userApi || 'TBD');
    content = content.replace(/\{\{SPONSOR_API_ENDPOINT\}\}/g, config.aws?.api?.sponsorApi || 'TBD');
    content = content.replace(/\{\{SHOP_API_ENDPOINT\}\}/g, config.aws?.api?.shopApi || 'TBD');
    content = content.replace(/\{\{CONTACT_API_ENDPOINT\}\}/g, config.aws?.api?.contactApi || 'TBD');
    content = content.replace(/\{\{IVS_PLAYBACK_URL\}\}/g, config.aws?.ivs?.playbackUrl || 'TBD');
    content = content.replace(/\{\{IVS_CHAT_ROOM_ARN\}\}/g, config.aws?.ivs?.chatRoomArn || 'TBD');
    
    // Branding
    content = content.replace(/\{\{PRIMARY_COLOR\}\}/g, config.branding?.colors?.primary || '#FFC400');
    content = content.replace(/\{\{SECONDARY_COLOR\}\}/g, config.branding?.colors?.secondary || '#FFB700');
    content = content.replace(/\{\{ACCENT_COLOR\}\}/g, config.branding?.colors?.accent || '#FF8A00');
    content = content.replace(/\{\{LOGO_URL\}\}/g, config.branding?.logo || '/assets/logo.png');
    content = content.replace(/\{\{FAVICON_URL\}\}/g, config.branding?.favicon || '/assets/favicon.ico');
    
    // Social Media
    content = content.replace(/\{\{YOUTUBE_URL\}\}/g, config.social?.youtube || '#');
    content = content.replace(/\{\{TWITCH_URL\}\}/g, config.social?.twitch || '#');
    content = content.replace(/\{\{TWITTER_URL\}\}/g, config.social?.twitter || '#');
    content = content.replace(/\{\{TELEGRAM_URL\}\}/g, config.social?.telegram || '#');
    content = content.replace(/\{\{INSTAGRAM_URL\}\}/g, config.social?.instagram || '#');
    content = content.replace(/\{\{TIKTOK_URL\}\}/g, config.social?.tiktok || '#');
    
    // Stream Schedule
    content = content.replace(/\{\{STREAM_SCHEDULE\}\}/g, config.stream?.schedule || 'TBD');
    content = content.replace(/\{\{STREAM_DAY_OF_WEEK\}\}/g, config.stream?.dayOfWeek || 0);
    content = content.replace(/\{\{STREAM_HOUR\}\}/g, config.stream?.hour || 18);
    content = content.replace(/\{\{STREAM_MINUTE\}\}/g, config.stream?.minute || 0);
    
    // Features (boolean values)
    content = content.replace(/\{\{FEATURE_CHAT\}\}/g, config.features?.chat !== false ? 'true' : 'false');
    content = content.replace(/\{\{FEATURE_SPONSOR\}\}/g, config.features?.sponsor !== false ? 'true' : 'false');
    content = content.replace(/\{\{FEATURE_SHOP\}\}/g, config.features?.shop !== false ? 'true' : 'false');
    content = content.replace(/\{\{FEATURE_EVENTS\}\}/g, config.features?.events !== false ? 'true' : 'false');
    content = content.replace(/\{\{FEATURE_MEMBERSHIP\}\}/g, config.features?.membership !== false ? 'true' : 'false');
    content = content.replace(/\{\{FEATURE_DONATIONS\}\}/g, config.features?.donations !== false ? 'true' : 'false');
    
    // Content
    content = content.replace(/\{\{NEXT_EVENT_TITLE\}\}/g, config.content?.nextEvent?.title || 'Upcoming Event');
    content = content.replace(/\{\{NEXT_EVENT_DATE\}\}/g, config.content?.nextEvent?.date || 'TBD');
    content = content.replace(/\{\{NEXT_EVENT_LOCATION\}\}/g, config.content?.nextEvent?.location || 'TBD');
    content = content.replace(/\{\{NEXT_EVENT_DESCRIPTION\}\}/g, config.content?.nextEvent?.description || 'Details coming soon');
    
    // Misc
    content = content.replace(/\{\{CURRENT_YEAR\}\}/g, new Date().getFullYear().toString());
    
    return content;
}

// Process HTML files
const htmlFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.html'));
htmlFiles.forEach(file => {
    const filePath = path.join(distDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = replaceVariables(content, config);
    fs.writeFileSync(filePath, content);
});
logSuccess(`Processed ${htmlFiles.length} HTML files`);

// Step 6: Process config.template.js
logStep('6/6', 'Generating config.js...');
const configTemplatePath = path.join(srcDir, 'js', 'config.template.js');
if (fs.existsSync(configTemplatePath)) {
    let configContent = fs.readFileSync(configTemplatePath, 'utf8');
    configContent = replaceVariables(configContent, config);
    
    // Create js directory in dist
    const jsDistDir = path.join(distDir, 'js');
    fs.ensureDirSync(jsDistDir);
    fs.writeFileSync(path.join(jsDistDir, 'config.js'), configContent);
    logSuccess('config.js generated');
} else {
    logWarn('config.template.js not found, skipping');
}

// Copy CSS files
if (fs.existsSync(path.join(srcDir, 'css'))) {
    fs.copySync(path.join(srcDir, 'css'), path.join(distDir, 'css'));
    logSuccess('CSS files copied');
}

// Copy JS files (except config.template.js)
if (fs.existsSync(path.join(srcDir, 'js'))) {
    const jsFiles = fs.readdirSync(path.join(srcDir, 'js'));
    jsFiles.forEach(file => {
        if (file !== 'config.template.js') {
            fs.copySync(
                path.join(srcDir, 'js', file),
                path.join(distDir, 'js', file)
            );
        }
    });
    logSuccess('JavaScript files copied');
}

// Copy creator-specific assets
const assetsDir = path.join(customizationDir, 'assets');
if (fs.existsSync(assetsDir)) {
    fs.copySync(assetsDir, path.join(distDir, 'assets'));
    logSuccess('Creator assets copied');
} else {
    logWarn('No creator assets found');
}

// Copy custom branding CSS
const brandingCssPath = path.join(customizationDir, 'branding.css');
if (fs.existsSync(brandingCssPath)) {
    fs.copySync(brandingCssPath, path.join(distDir, 'css', 'branding.css'));
    logSuccess('Custom branding CSS copied');
}

// Summary
log('\n✅ Build completed successfully!', 'green');
log(`\nOutput directory: ${distDir}`);
log('\nNext steps:');
log('1. Review the generated files');
log('2. Deploy to S3: ./scripts/deployment/deploy-frontend.sh ' + creatorSlug);
log('3. Test the website\n');
