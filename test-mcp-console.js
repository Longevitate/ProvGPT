// Paste this into your browser console to test MCP endpoint
// Open DevTools (F12), go to Console tab, paste and run

const mcpUrl = "https://provgpt.azurewebsites.net/mcp";

// Test 1: List tools
async function testToolsList() {
  console.log("📋 Testing tools/list...");
  try {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      })
    });
    
    const data = await response.json();
    console.log("✅ tools/list SUCCESS");
    console.log("Status:", response.status);
    console.log("Tools:", data.result?.tools?.map(t => t.name));
    console.log("Full response:", data);
    return data;
  } catch (error) {
    console.error("❌ tools/list FAILED:", error);
  }
}

// Test 2: Call triage_v1
async function testTriage() {
  console.log("\n🏥 Testing triage_v1...");
  try {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "triage_v1",
          arguments: {
            symptoms: "mild chest pain and shortness of breath",
            age: 40,
            pregnancyStatus: "unknown",
            durationHours: 2
          }
        }
      })
    });
    
    const data = await response.json();
    console.log("Status:", response.status);
    
    if (response.status === 424) {
      console.error("❌ Got 424 error!");
      console.error("Response:", data);
      return data;
    }
    
    if (data.error) {
      console.error("❌ JSON-RPC error:", data.error);
      return data;
    }
    
    console.log("✅ triage_v1 SUCCESS");
    console.log("Result:", data.result);
    return data;
  } catch (error) {
    console.error("❌ triage_v1 FAILED:", error);
  }
}

// Test 3: Search facilities
async function testSearch() {
  console.log("\n🔍 Testing search_facilities_v1...");
  try {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "search_facilities_v1",
          arguments: {
            venue: "urgent_care",
            zip: "99501"
          }
        }
      })
    });
    
    const data = await response.json();
    console.log("Status:", response.status);
    
    if (response.status === 424) {
      console.error("❌ Got 424 error!");
      return data;
    }
    
    console.log("✅ search_facilities_v1 SUCCESS");
    console.log("Result:", data.result);
    return data;
  } catch (error) {
    console.error("❌ search_facilities_v1 FAILED:", error);
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting MCP endpoint tests...\n");
  console.log("Testing: " + mcpUrl);
  console.log("=" .repeat(60));
  
  await testToolsList();
  await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
  
  await testTriage();
  await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
  
  await testSearch();
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ All tests complete!");
  console.log("\nIf you see 424 errors above, the deployment hasn't finished yet.");
  console.log("Wait 2-3 more minutes and run: runAllTests()");
}

// Show instructions
console.log("MCP Testing Console Commands:");
console.log("==============================");
console.log("testToolsList()  - Test if server lists tools");
console.log("testTriage()     - Test triage_v1 tool");
console.log("testSearch()     - Test search_facilities_v1 tool");
console.log("runAllTests()    - Run all tests");
console.log("\nStarting tests automatically...\n");

// Auto-run
runAllTests();

