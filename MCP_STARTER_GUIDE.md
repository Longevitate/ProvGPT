# 🚀 Simple MCP Server - Starter Guide

Your Providence app already has a **working MCP server**! This guide shows you the essential parts.

---

## 📦 **Minimal MCP Server (Your Current Setup)**

Your MCP server is in `src/routes/mcp.ts`. Here's a simplified version showing the core structure:

### 1. **Define Your Tools** (Lines 26-85 in mcp.ts)

```typescript
const tools = [
  {
    name: "triage_v1",
    description: "Suggest care venue based on symptoms",
    inputSchema: {
      type: "object",
      required: ["symptoms", "age"],
      properties: {
        symptoms: { type: "string" },
        age: { type: "integer", minimum: 0, maximum: 120 }
      }
    }
  },
  {
    name: "search_facilities_v1",
    description: "Find care facilities near a location",
    inputSchema: {
      type: "object",
      required: ["venue"],
      properties: {
        venue: { 
          type: "string",
          enum: ["urgent_care", "er", "primary_care", "virtual"]
        },
        zip: { type: "string" }
      }
    }
  }
];
```

### 2. **Handle JSON-RPC Methods**

```typescript
async function handleJsonRpc(reqBody: JsonRpcRequest) {
  switch (reqBody.method) {
    
    // Tell clients what tools you have
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: reqBody.id,
        result: { tools }
      };
    
    // Execute a tool
    case "tools/call":
      const { name, arguments: args } = reqBody.params;
      const result = await executeTool(name, args);
      return {
        jsonrpc: "2.0",
        id: reqBody.id,
        result: { content: [{ type: "json", json: result }] }
      };
    
    // Initialize connection
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: reqBody.id,
        result: {
          serverInfo: { name: "Providence Find Care", version: "1.0.0" },
          capabilities: { tools: {} }
        }
      };
  }
}
```

### 3. **Create Express Endpoint**

```typescript
import { Router } from "express";

export const mcpRouter = Router();

mcpRouter.post("/", async (req, res) => {
  const reqBody = req.body; // JSON-RPC request
  const response = await handleJsonRpc(reqBody);
  res.json(response);
});
```

---

## 🎯 **Even Simpler: Hello World MCP Server**

Want to start from scratch? Here's a minimal example:

```typescript
// simple-mcp-server.ts
import express from "express";

const app = express();
app.use(express.json());

// Define one simple tool
const tools = [{
  name: "greet",
  description: "Greet a person by name",
  inputSchema: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" }
    }
  }
}];

// MCP endpoint
app.post("/mcp", async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;
  
  if (method === "tools/list") {
    // Return available tools
    return res.json({
      jsonrpc: "2.0",
      id,
      result: { tools }
    });
  }
  
  if (method === "tools/call") {
    // Execute the tool
    const { name, arguments: args } = params;
    
    if (name === "greet") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: `Hello, ${args.name}!`
          }]
        }
      });
    }
  }
  
  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        serverInfo: { name: "Simple MCP", version: "1.0.0" },
        capabilities: { tools: {} }
      }
    });
  }
});

app.listen(8080, () => {
  console.log("MCP server running on http://localhost:8080/mcp");
});
```

**Run it:**
```bash
npm install express
npx ts-node simple-mcp-server.ts
```

**Test it:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "greet",
      "arguments": { "name": "Alice" }
    }
  }'
```

---

## 📚 **Official Examples to Learn From**

### 1. **Your Providence App** ✅
- **File**: `src/routes/mcp.ts`
- **What it does**: Healthcare triage and facility search
- **Why it's great**: Real-world example with multiple complex tools

### 2. **Official MCP Servers**
```bash
# Clone official examples
git clone https://github.com/modelcontextprotocol/servers

# Popular examples:
cd servers/src/filesystem    # File system access
cd servers/src/github        # GitHub API
cd servers/src/sqlite        # Database access
```

### 3. **Model Context Protocol Documentation**
- Spec: https://spec.modelcontextprotocol.io/
- SDK: https://github.com/modelcontextprotocol/typescript-sdk

---

## 🎨 **Your MCP Server Architecture**

```
Your Providence MCP Server:

Express App (server.ts)
    │
    └─> /mcp endpoint (routes/mcp.ts)
            │
            ├─> tools/list → Returns 6 tools
            │   └─> triage_v1, search_facilities_v1, etc.
            │
            ├─> tools/call → Executes a tool
            │   └─> Calls your business logic
            │
            ├─> initialize → Handshake
            │
            └─> resources/list → Optional resources
```

---

## ✅ **What Makes Your MCP Server Good**

Your current implementation already has:

1. ✅ **Multiple tools** (6 tools: triage, search, availability, booking, etc.)
2. ✅ **Proper JSON-RPC 2.0** format
3. ✅ **Schema validation** (inputSchema for each tool)
4. ✅ **Error handling** (try-catch blocks, diagnostic envelopes)
5. ✅ **Real business logic** (not just mock data)
6. ✅ **Express integration** (works as HTTP POST endpoint)

**You don't need to start from scratch - your server is already well-built!**

---

## 🚀 **Quick Start: Copy Your Own Server**

To create a new MCP server based on your Providence app:

### Option 1: Simplify Your Current Server

1. Keep `src/routes/mcp.ts`
2. Remove tools you don't need (keep 1-2)
3. Simplify the tool logic
4. Deploy to Azure

### Option 2: Extract Core Pattern

Copy this structure from your app:

```typescript
// 1. Define tools array
const tools = [/* tool definitions */];

// 2. Handle JSON-RPC methods
function handleJsonRpc(request) {
  switch (request.method) {
    case "tools/list": return { tools };
    case "tools/call": return executeTool(...);
    case "initialize": return { serverInfo };
  }
}

// 3. Create Express endpoint
router.post("/mcp", async (req, res) => {
  const response = await handleJsonRpc(req.body);
  res.json(response);
});
```

---

## 📖 **Key MCP Concepts**

### JSON-RPC 2.0 Format
All MCP communication uses this format:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "my_tool",
    "arguments": { "param1": "value1" }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "Tool result here"
    }]
  }
}
```

### Required Methods
- `initialize` - Handshake
- `tools/list` - List available tools
- `tools/call` - Execute a tool

### Optional Methods
- `resources/list` - List available resources
- `resources/read` - Read a resource
- `prompts/list` - List prompt templates

---

## 🎯 **Your Next Steps**

1. ✅ **Your current server works** - Use it as-is for your demo
2. 📚 **Study your own code** - `src/routes/mcp.ts` is a great learning resource
3. 🔧 **Customize tools** - Modify the tools array to match your needs
4. 🚀 **Deploy** - Your Azure deployment is already set up
5. 🤝 **Integrate with Apps SDK** - Point it to `https://provgpt.azurewebsites.net/mcp`

---

## 💡 **Pro Tips**

1. **Start Simple**: Begin with 1-2 tools, add more later
2. **Use Your Own Code**: Your `mcp.ts` file is already a great template
3. **Test Locally First**: Use curl to test before deploying
4. **Read Your Own Logs**: The `[mcp]` logs show what's working
5. **Tool Schemas Matter**: Good inputSchema = better AI understanding

---

## 🎉 **You Already Have Everything You Need!**

Your Providence MCP server at `src/routes/mcp.ts` is:
- ✅ Well-structured
- ✅ Production-ready
- ✅ Following best practices
- ✅ A great reference for future projects

**For your demo**: Just use what you have! It's already a solid MCP implementation.

**For future projects**: Copy the pattern from `mcp.ts` and customize the tools.

---

## 📞 **Additional Resources**

- **Your Working Code**: `src/routes/mcp.ts` (339 lines of MCP goodness!)
- **MCP Spec**: https://spec.modelcontextprotocol.io/
- **Official SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Example Servers**: https://github.com/modelcontextprotocol/servers
- **Test Your Server**: `curl -X POST https://provgpt.azurewebsites.net/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`

---

**TL;DR**: Your Providence app is already a great MCP server example. You can use it as-is or copy its pattern for new projects! 🚀

