# Azure Functions Deployment Script for Providence MCP
# This script deploys the fixed code that eliminates 424 TaskGroup errors

# ===== CONFIGURATION - UPDATE THESE VALUES =====
$FUNCTION_APP_NAME = "YOUR_FUNCTION_APP_NAME"  # Change this!
$RESOURCE_GROUP = "YOUR_RESOURCE_GROUP"        # Change this!
# ================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Providence MCP - Azure Functions Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if already built
if (!(Test-Path "dist/index.js")) {
    Write-Host "Building TypeScript..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✓ Build files found" -ForegroundColor Green
}

# Check Azure CLI
Write-Host ""
Write-Host "Checking Azure CLI..." -ForegroundColor Yellow
$azVersion = az --version 2>&1 | Select-String "azure-cli"
if (!$azVersion) {
    Write-Host "✗ Azure CLI not found. Please install: https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Azure CLI installed" -ForegroundColor Green

# Check if logged in
Write-Host ""
Write-Host "Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>&1 | ConvertFrom-Json
if (!$account) {
    Write-Host "✗ Not logged in to Azure. Running 'az login'..." -ForegroundColor Yellow
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Azure login failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "  Subscription: $($account.name)" -ForegroundColor Gray

# Validate configuration
Write-Host ""
Write-Host "Checking configuration..." -ForegroundColor Yellow
if ($FUNCTION_APP_NAME -eq "YOUR_FUNCTION_APP_NAME" -or $RESOURCE_GROUP -eq "YOUR_RESOURCE_GROUP") {
    Write-Host "✗ Please update FUNCTION_APP_NAME and RESOURCE_GROUP in this script!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To find your Function App name, run:" -ForegroundColor Yellow
    Write-Host "  az functionapp list --output table" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
Write-Host "  Function App: $FUNCTION_APP_NAME" -ForegroundColor Gray
Write-Host "  Resource Group: $RESOURCE_GROUP" -ForegroundColor Gray

# Check if Function App exists
Write-Host ""
Write-Host "Verifying Function App exists..." -ForegroundColor Yellow
$appExists = az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Function App '$FUNCTION_APP_NAME' not found in resource group '$RESOURCE_GROUP'" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your existing Function Apps:" -ForegroundColor Yellow
    az functionapp list --output table
    Write-Host ""
    exit 1
}
Write-Host "✓ Function App found" -ForegroundColor Green

# Set critical environment variable
Write-Host ""
Write-Host "Setting AZURE_FUNCTIONS_ENVIRONMENT=true..." -ForegroundColor Yellow
az functionapp config appsettings set `
    --name $FUNCTION_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --settings AZURE_FUNCTIONS_ENVIRONMENT=true `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to set environment variable" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Environment variable set" -ForegroundColor Green

# Create deployment package
Write-Host ""
Write-Host "Creating deployment package..." -ForegroundColor Yellow
$deployPath = "deploy-package"
if (Test-Path $deployPath) {
    Remove-Item $deployPath -Recurse -Force
}
New-Item -ItemType Directory -Path $deployPath | Out-Null

# Copy necessary files
Copy-Item "dist" -Destination "$deployPath/dist" -Recurse
Copy-Item "node_modules" -Destination "$deployPath/node_modules" -Recurse
Copy-Item "package.json" -Destination "$deployPath/"
Copy-Item "host.json" -Destination "$deployPath/"
if (Test-Path ".funcignore") {
    Copy-Item ".funcignore" -Destination "$deployPath/"
}

Write-Host "✓ Package created" -ForegroundColor Green

# Deploy using Azure CLI
Write-Host ""
Write-Host "Deploying to Azure Functions..." -ForegroundColor Yellow
Write-Host "This may take 2-3 minutes..." -ForegroundColor Gray

Push-Location $deployPath
$deployResult = az functionapp deployment source config-zip `
    --name $FUNCTION_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --src (Get-Location).Path `
    2>&1

Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    Write-Host $deployResult -ForegroundColor Red
    exit 1
}

Write-Host "✓ Deployment successful!" -ForegroundColor Green

# Clean up
Remove-Item $deployPath -Recurse -Force

# Restart Function App to ensure new code loads
Write-Host ""
Write-Host "Restarting Function App..." -ForegroundColor Yellow
az functionapp restart --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --output none
Start-Sleep -Seconds 10
Write-Host "✓ Function App restarted" -ForegroundColor Green

# Test the deployment
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing endpoint..." -ForegroundColor Yellow
$testUrl = "https://$FUNCTION_APP_NAME.azurewebsites.net/mcp"
$testBody = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "mcp_ping"
        arguments = @{}
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $testUrl -Method Post -Body $testBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "✓ MCP endpoint responding!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "✗ Test failed. Waiting 30 seconds for cold start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    try {
        $response = Invoke-RestMethod -Uri $testUrl -Method Post -Body $testBody -ContentType "application/json" -ErrorAction Stop
        Write-Host "✓ MCP endpoint responding!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "✗ Endpoint still not responding" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Check logs with:" -ForegroundColor Yellow
        Write-Host "  az webapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Your endpoints:" -ForegroundColor Cyan
Write-Host "  MCP: https://$FUNCTION_APP_NAME.azurewebsites.net/mcp" -ForegroundColor White
Write-Host "  Health: https://$FUNCTION_APP_NAME.azurewebsites.net/health" -ForegroundColor White
Write-Host "  Triage: https://$FUNCTION_APP_NAME.azurewebsites.net/api/triage" -ForegroundColor White
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  az webapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Cyan
Write-Host ""

