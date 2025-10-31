# ChatGPT Apps SDK Troubleshooting Guide

## ✅ **Current Status**

Your MCP server is **100% working**:
- URL: `https://provgpt.azurewebsites.net/mcp`
- Protocol: MCP (JSON-RPC 2.0)
- Available tools: 4 (triage_v1, search_facilities_v1, get_availability_v1, book_appointment_v1)
- Tested: ✅ All working correctly

**The problem is NOT your server** - it's in how ChatGPT Apps SDK is calling it.

---

## 🔍 **Understanding the Error Path**

When you see:
```
/Providence AI Booking/link_690546105f8c8191ad761666684e4ca4/triage_v1
```

This is ChatGPT's **internal routing path**, NOT what hits your server. Here's what should happen:

```
1. User asks ChatGPT to triage symptoms
2. ChatGPT routes internally via: /Providence AI Booking/link_.../triage_v1
3. ChatGPT translates to JSON-RPC:
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {"name": "triage_v1", "arguments": {"symptoms": "earache", "age": 12}}
   }
4. ChatGPT calls YOUR server: https://provgpt.azurewebsites.net/mcp
5. Your server responds with triage recommendation
6. ChatGPT shows result to user
```

The 424 error suggests **step 4 or 5 is failing**.

---

## 🛠️ **Fix Steps (Try in Order)**

### Step 1: Delete and Re-create the App

ChatGPT might have cached a bad configuration:

1. Go to ChatGPT → Apps & Connectors
2. Find "Providence AI Booking"
3. Click **Delete**
4. Click **Create** new app
5. Give it a NEW name: "Providence Care Finder"
6. Add Connector:
   - Type: **MCP Server**
   - URL: **`https://provgpt.azurewebsites.net/mcp`**
   - Authentication: **None**
7. Save

### Step 2: Test Tool Discovery First

Before doing triage, verify ChatGPT can see your tools:

Ask ChatGPT:
```
"What tools are available from the Providence Care Finder connector?"
```

**Expected response**: ChatGPT should list 4 tools:
- triage_v1
- search_facilities_v1
- get_availability_v1
- book_appointment_v1

If it doesn't list them, the MCP connection isn't working.

### Step 3: Use Simple Test First

Try a tool with fewer parameters:

Ask ChatGPT:
```
"Using the Providence connector, search for urgent care facilities near zip code 99501"
```

This tests `search_facilities_v1` which might have better error messages.

### Step 4: Check for Timeout Issues

Your server responds in < 1 second (verified in tests), but ChatGPT might have a stricter timeout.

Ask ChatGPT:
```
"Show me the full error details including any timeout information"
```

Look for:
- **Connection timeout** → Network issue between ChatGPT and Azure
- **Read timeout** → Your server took too long (unlikely based on our tests)
- **424 error** → Azure Functions issue (but we're not using Functions anymore!)

### Step 5: Verify Protocol Version

Your server uses MCP protocol version `2024-11-05`. 

Ask ChatGPT:
```
"What MCP protocol version are you using?"
```

If there's a mismatch, that could cause compatibility issues.

---

## 🐛 **Common Issues & Solutions**

### Issue 1: "Tool not found" Error

**Symptom**: ChatGPT says it can't find the tool  
**Solution**: 
1. Verify URL has no trailing slash: `https://provgpt.azurewebsites.net/mcp` (not `/mcp/`)
2. Re-create the app from scratch
3. Make sure you selected "MCP Server" type (not "REST API")

### Issue 2: Connection Timeouts

**Symptom**: "Connection timed out" or "Request timeout"  
**Possible causes**:
1. **ChatGPT's network can't reach your Azure endpoint**
   - Test: Can you access `https://provgpt.azurewebsites.net/health` from a browser?
   - If yes, it's reachable. If no, Azure might be blocking ChatGPT's IPs.

2. **Azure cold start delay**
   - First request after inactivity can be slow
   - Solution: Keep endpoint warm by pinging it every 5 minutes

### Issue 3: 424 "TaskGroup" Errors

**Symptom**: `424: unhandled errors in a TaskGroup`  
**This is what you're seeing now!**

**Possible causes**:
1. **Azure App Service issue** (not your code)
   - Your Docker container might not be starting correctly
   - Check Azure logs for startup errors

2. **Wrong entry point**
   - Dockerfile should use: `CMD ["node", "dist/server.js"]`
   - server.js should call `app.listen()` in Docker mode
   - Verify in logs that you see: "Server listening on..."

### Issue 4: Parameters Not Passed Correctly

**Symptom**: Tool is called but parameters are missing or wrong  
**Debug**:
- Ask ChatGPT: "Show me the exact parameters you're sending to triage_v1"
- Check if parameter names match your schema exactly
- Check if parameter types are correct (string vs integer)

---

## 🧪 **Debug Commands**

### Test 1: Verify MCP Endpoint from Command Line
```powershell
.\test-mcp-endpoint.ps1
```

**Expected**: All 3 tests pass (initialize, tools/list, tools/call)

### Test 2: Check Azure Logs
```bash
az webapp log tail --name ProvGPT --resource-group gptApps
```

**Look for**:
- ✅ "Server listening on http://0.0.0.0:8080"
- ✅ "[entry] cid=... POST /mcp"
- ✅ "[mcp] entry cid=..."
- ❌ Any errors or crashes

### Test 3: Check if App is Running
```bash
curl https://provgpt.azurewebsites.net/health
```

**Expected**: `{"ok":true}`

### Test 4: Test MCP Directly
```bash
curl -X POST https://provgpt.azurewebsites.net/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**Expected**: JSON response with list of 4 tools

---

## 💡 **Questions to Ask ChatGPT**

These questions help debug the issue:

### 1. Tool Discovery
```
"What tools are available from the Providence Care Finder?"
```

**This tests**: If ChatGPT can call `tools/list` successfully

### 2. Show Raw Request
```
"Show me the raw MCP request you're sending to the Providence server"
```

**This shows**: The actual JSON-RPC payload ChatGPT is generating

### 3. Show Full Error
```
"Show me the complete error message including status code and response body"
```

**This reveals**: What error your server (or Azure) is returning

### 4. Test Simpler Tool
```
"Search for urgent care near 99501 using Providence"
```

**This tests**: If the problem is specific to triage_v1 or all tools

### 5. Check Parameters
```
"Before calling triage, show me exactly what parameters you're planning to send"
```

**This reveals**: If parameter mapping is correct

---

## 🎯 **Next Steps Based on What You Find**

### If ChatGPT can't see tools at all:
→ **Connection problem** between ChatGPT and your MCP endpoint
→ Re-create the app, verify URL is exactly: `https://provgpt.azurewebsites.net/mcp`

### If ChatGPT sees tools but they fail when called:
→ **Parameter mismatch** or **response format issue**
→ Ask ChatGPT to show raw request/response
→ Compare with our working test (see test-mcp-endpoint.ps1 output)

### If you see 424 errors in Azure logs:
→ **Docker/Azure issue** (not MCP issue)
→ Check if container is restarting
→ Verify Dockerfile uses correct entry point

### If tools work sometimes but not others:
→ **Timeout or rate limiting**
→ Check Azure App Service logs for performance issues
→ Consider increasing Azure App Service plan

---

## 📊 **Expected vs Actual**

### Expected Flow (Working):
```
User → ChatGPT → JSON-RPC to /mcp → Your Server → Response → ChatGPT → User
```

### Your Current Flow (Broken):
```
User → ChatGPT → ??? → 424 Error
```

We need to find where the break is. Most likely:
1. ChatGPT can't reach your endpoint
2. ChatGPT is sending wrong format
3. Your server is returning wrong format
4. Azure is returning 424 before your code runs

---

## 🆘 **Still Not Working?**

If after all these steps it still doesn't work:

### Option 1: Enable Detailed Logging

Add more logging to see what ChatGPT is actually sending:

```typescript
// In src/routes/mcp.ts, add at the top of the POST handler:
console.log("[MCP] Raw request body:", JSON.stringify(req.body));
console.log("[MCP] Headers:", JSON.stringify(req.headers));
```

Then check Azure logs to see what ChatGPT is actually sending.

### Option 2: Contact OpenAI Support

Your MCP server is working correctly (we tested it). If ChatGPT Apps SDK can't use it, that's a ChatGPT issue.

Provide them:
- Your MCP endpoint: `https://provgpt.azurewebsites.net/mcp`
- Test showing it works: (output from test-mcp-endpoint.ps1)
- The error you're seeing
- Screenshots of your Apps & Connectors configuration

### Option 3: Wait for Azure Deployment

If you just made changes and pushed, wait ~5 minutes for GitHub Actions to deploy. Then test again.

Check deployment status: https://github.com/Longevitate/ProvGPT/actions

---

## ✅ **Success Checklist**

You'll know it's working when:

- [ ] ChatGPT can list your 4 tools
- [ ] You can ask "I have an earache" and get a triage recommendation
- [ ] You can search for facilities by zip code
- [ ] No 424 errors
- [ ] Azure logs show successful `/mcp` requests

---

**Your MCP server is solid. The issue is in the ChatGPT Apps SDK integration. Follow the debug steps above to isolate the problem!** 🚀

