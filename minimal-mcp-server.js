// Minimal MCP Server - Deploy this to test if Azure is the problem
// This is the simplest possible working MCP server

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Define one simple tool
const TOOLS = [
  {
    name: "greet",
    description: "Greets a person by name",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Name to greet" }
      }
    }
  }
];

// MCP endpoint
app.post('/mcp', (req, res) => {
  const { jsonrpc, id, method, params } = req.body;
  
  console.log(`[MCP] ${method}`, params);
  
  // Initialize
  if (method === 'initialize') {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        serverInfo: { name: "Simple MCP", version: "1.0.0" },
        protocolVersion: "2024-11-05",
        capabilities: { tools: { list: {}, call: {} } }
      }
    });
  }
  
  // List tools
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS }
    });
  }
  
  // Call tool
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    if (name === 'greet') {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: `Hello, ${args.name}! This is a simple MCP server.`
          }]
        }
      });
    }
    
    return res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown tool: ${name}` }
    });
  }
  
  // Unknown method
  return res.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unknown method: ${method}` }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Simple MCP server running on port ${PORT}`);
  console.log(`   Test: curl http://localhost:${PORT}/health`);
  console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`);
});

