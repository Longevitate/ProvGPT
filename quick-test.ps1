# Quick test for MCP triage endpoint

Write-Host "Testing MCP triage endpoint..." -ForegroundColor Cyan
Write-Host ""

$body = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"triage_v1","arguments":{"symptoms":"headache","age":25}}}'

try {
    $response = Invoke-RestMethod -Uri "https://provgpt.azurewebsites.net/mcp" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 424) {
            Write-Host ""
            Write-Host "Still getting 424 - deployment may not be complete yet." -ForegroundColor Yellow
            Write-Host "Check: https://github.com/Longevitate/ProvGPT/actions" -ForegroundColor Cyan
        }
    }
}

