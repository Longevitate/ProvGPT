# Test MCP endpoint for ChatGPT Apps SDK debugging

$mcpUrl = "https://provgpt.azurewebsites.net/mcp"

Write-Host "Testing MCP Endpoint: $mcpUrl" -ForegroundColor Cyan
Write-Host ""

# Test 1: Initialize (handshake)
Write-Host "1. Testing initialize..." -ForegroundColor Yellow
$initBody = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{
        protocolVersion = "2024-11-05"
        clientInfo = @{
            name = "test-client"
            version = "1.0.0"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $mcpUrl -Method Post -Body $initBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ Initialize successful" -ForegroundColor Green
    Write-Host "   Server: $($response.result.serverInfo.name)" -ForegroundColor Gray
    Write-Host "   Capabilities: $($response.result.capabilities | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Initialize failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: List tools
Write-Host "2. Testing tools/list..." -ForegroundColor Yellow
$toolsBody = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
    params = @{}
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $mcpUrl -Method Post -Body $toolsBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ tools/list successful" -ForegroundColor Green
    Write-Host "   Available tools: $($response.result.tools.Count)" -ForegroundColor Gray
    foreach ($tool in $response.result.tools) {
        Write-Host "     - $($tool.name): $($tool.description)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ tools/list failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Call triage_v1 (the tool ChatGPT is trying to use)
Write-Host "3. Testing tools/call (triage_v1)..." -ForegroundColor Yellow
$triageBody = @{
    jsonrpc = "2.0"
    id = 3
    method = "tools/call"
    params = @{
        name = "triage_v1"
        arguments = @{
            symptoms = "earache"
            age = 12
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $mcpUrl -Method Post -Body $triageBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✓ triage_v1 successful" -ForegroundColor Green
    Write-Host "   Result:" -ForegroundColor Gray
    Write-Host "   $($response.result | ConvertTo-Json -Depth 10)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ triage_v1 failed: $_" -ForegroundColor Red
    Write-Host "   Error details: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Debugging Tips for ChatGPT Apps SDK:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If MCP endpoint works but ChatGPT fails:" -ForegroundColor White
Write-Host "1. Check ChatGPT app configuration:" -ForegroundColor Yellow
Write-Host "   - MCP server URL: $mcpUrl" -ForegroundColor Gray
Write-Host "   - Make sure it's exactly this URL (no trailing slash)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Try re-creating the app in ChatGPT:" -ForegroundColor Yellow
Write-Host "   - Delete the current app" -ForegroundColor Gray
Write-Host "   - Create new app" -ForegroundColor Gray
Write-Host "   - Add connector with MCP URL" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Check if ChatGPT needs authentication:" -ForegroundColor Yellow
Write-Host "   - Your endpoint is public (no auth)" -ForegroundColor Gray
Write-Host "   - Make sure 'No Authentication' is selected" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Ask ChatGPT these debug questions:" -ForegroundColor Yellow
Write-Host "   - 'What MCP tools do you have available?'" -ForegroundColor Gray
Write-Host "   - 'Can you list all your available tools?'" -ForegroundColor Gray
Write-Host "   - 'Show me the raw MCP request you're sending'" -ForegroundColor Gray
Write-Host ""

