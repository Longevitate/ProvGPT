# Test script for all MCP endpoints
# Run this to verify all endpoints are working

$baseUrl = "https://provgpt.azurewebsites.net"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Testing Providence MCP Endpoints" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 10
    Write-Host "   ✓ Health: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Health check failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: MCP Ping
Write-Host "2. Testing MCP Ping..." -ForegroundColor Yellow
$pingBody = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "mcp_ping"
        arguments = @{}
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp" -Method Post -Body $pingBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ MCP Ping: OK" -ForegroundColor Green
    Write-Host "   Response: $($response.result.content[0].json | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ MCP Ping failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Triage Canary
Write-Host "3. Testing Triage Canary..." -ForegroundColor Yellow
$triageBody = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/call"
    params = @{
        name = "triage_canary"
        arguments = @{}
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp" -Method Post -Body $triageBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ Triage Canary: OK" -ForegroundColor Green
    Write-Host "   Response: $($response.result.content[0].json | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Triage Canary failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Search Facilities
Write-Host "4. Testing Search Facilities..." -ForegroundColor Yellow
$searchBody = @{
    jsonrpc = "2.0"
    id = 3
    method = "tools/call"
    params = @{
        name = "search_facilities_v1"
        arguments = @{
            venue = "urgent_care"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp" -Method Post -Body $searchBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ Search Facilities: OK" -ForegroundColor Green
    Write-Host "   Found $($response.result.content[0].json.totalFound) facilities" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Search Facilities failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Tools List
Write-Host "5. Testing Tools List..." -ForegroundColor Yellow
$toolsBody = @{
    jsonrpc = "2.0"
    id = 4
    method = "tools/list"
    params = @{}
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/mcp" -Method Post -Body $toolsBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ Tools List: OK" -ForegroundColor Green
    Write-Host "   Available tools: $($response.result.tools.Count)" -ForegroundColor Gray
    foreach ($tool in $response.result.tools) {
        Write-Host "     - $($tool.name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Tools List failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "All Tests Complete!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your MCP server URL: $baseUrl/mcp" -ForegroundColor White
Write-Host "Use this URL in ChatGPT's MCP configuration" -ForegroundColor White

