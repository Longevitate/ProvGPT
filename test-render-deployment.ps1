# Test Render Deployment
# Replace with your actual Render URL once deployed

$RENDER_URL = "https://providence-mcp.onrender.com"

Write-Host "=== Testing Render Deployment ===" -ForegroundColor Cyan

# Test 1: Health endpoint
Write-Host "`n1. Testing /health:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$RENDER_URL/health"
    if ($health.ok) {
        Write-Host "   ✅ Health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: MCP GET (discovery)
Write-Host "`n2. Testing GET /mcp:" -ForegroundColor Yellow
try {
    $mcp = Invoke-RestMethod -Uri "$RENDER_URL/mcp" -Method Get
    Write-Host "   Protocol Version: $($mcp.protocolVersion)" -ForegroundColor Cyan
    Write-Host "   Server Name: $($mcp.serverInfo.name)" -ForegroundColor Cyan
    Write-Host "   ✅ MCP discovery passed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ MCP discovery failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Initialize
Write-Host "`n3. Testing POST initialize:" -ForegroundColor Yellow
try {
    $init = Invoke-RestMethod -Uri "$RENDER_URL/mcp" -Method Post -Body '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' -ContentType "application/json"
    Write-Host "   ✅ Initialize passed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Initialize failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Tools list
Write-Host "`n4. Testing tools/list:" -ForegroundColor Yellow
try {
    $tools = Invoke-RestMethod -Uri "$RENDER_URL/mcp" -Method Post -Body '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' -ContentType "application/json"
    Write-Host "   Tools available: $($tools.result.tools.Count)" -ForegroundColor Cyan
    Write-Host "   First tool: $($tools.result.tools[0].name)" -ForegroundColor Cyan
    Write-Host "   ✅ Tools list passed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Tools list failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Call ping_v1
Write-Host "`n5. Testing ping_v1 tool:" -ForegroundColor Yellow
try {
    $ping = Invoke-RestMethod -Uri "$RENDER_URL/mcp" -Method Post -Body '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ping_v1","arguments":{"message":"hello"}}}' -ContentType "application/json"
    Write-Host "   Response: $($ping.result.content[0].json | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    Write-Host "   ✅ ping_v1 passed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ ping_v1 failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== All Tests Complete ===" -ForegroundColor Cyan
Write-Host "`nIf all tests passed, use this URL in ChatGPT:" -ForegroundColor Yellow
Write-Host "$RENDER_URL/mcp" -ForegroundColor Green

