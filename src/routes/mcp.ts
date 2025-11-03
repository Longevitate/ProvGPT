import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const tools: ToolDefinition[] = [
  {
    name: "ping_v1",
    description: "Simple ping test to verify server connectivity and response handling.",
    inputSchema: {
      type: "object",
      properties: {
        message: { 
          type: "string",
          description: "Optional message to echo back"
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_care_v1",
    description:
      "Single call to find nearby care after collecting basics. Provide zip (preferred) or lat/lon, venue, and optional radiusMiles (default 40). Returns Providence facilities sorted by distance with ids equal to departmentUrlName; booking links are constructed as scheduling.care.psjhealth.org using that id. Use this one tool after clarifying age and location; avoid calling other tools.",
    inputSchema: {
      type: "object",
      required: ["venue"],
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        zip: { type: "string" },
        radiusMiles: { type: "number", default: 40 },
        venue: {
          type: "string",
          enum: ["urgent_care", "er", "primary_care", "virtual"],
        },
        acceptsInsurancePlanId: { type: "string" },
        acceptsInsurancePlanName: { type: "string" },
        openNow: { type: "boolean" },
        pediatricFriendly: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
];

const COMPONENT_RESOURCE = {
  uri: "component://find-care",
  name: "find-care-component",
  mimeType: "text/tsx",
};

// SSE removed - using static JSON responses only

function componentSource(): string | null {
  const filePath = path.join(process.cwd(), "apps", "find-care", "component.tsx");
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf-8");
}

const MCP_BASE_URL = (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim() !== "")
  ? process.env.PUBLIC_BASE_URL
  : `http://127.0.0.1:${String(process.env.PORT || 8080)}`;

async function callTool(name: string, args: Record<string, unknown> | undefined) {
  const payload = args ?? {};

  switch (name) {
    case "ping_v1": {
      // Simple ping response
      const { message } = payload as { message?: string };
      return {
        ok: true,
        timestamp: new Date().toISOString(),
        message: message || "pong",
        server: "providence_ai_booking",
      };
    }
    case "triage_v1": {
      const r = await fetch(`${MCP_BASE_URL}/api/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`triage_http_${r.status}`);
      return await r.json();
    }
    case "find_care_v1": {
      const r = await fetch(`${MCP_BASE_URL}/api/search-facilities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`findcare_http_${r.status}`);
      return await r.json();
    }
    case "get_availability_v1": {
      const r = await fetch(`${MCP_BASE_URL}/api/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`availability_http_${r.status}`);
      return await r.json();
    }
    case "book_appointment_v1": {
      const r = await fetch(`${MCP_BASE_URL}/api/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`book_http_${r.status}`);
      return await r.json();
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function makeResponse(
  reqBody: JsonRpcRequest,
  result?: unknown,
  error?: { code: number; message: string; data?: unknown },
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: reqBody.id ?? null,
    ...(error ? { error } : { result }),
  };
}

async function handleJsonRpc(reqBody: JsonRpcRequest): Promise<JsonRpcResponse> {
  switch (reqBody.method) {
    case "initialize": {
      return makeResponse(reqBody, {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: "providence_ai_booking",
          version: "0.1.1",
        },
      });
    }
    case "tools/list": {
      return makeResponse(reqBody, {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
    }
    case "tools/call": {
      const { name, arguments: args } = (reqBody.params ?? {}) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
      if (!name) {
        return makeResponse(reqBody, undefined, {
          code: -32602,
          message: "Missing tool name",
        });
      }
      try {
        const result = await callTool(name, args);
        return makeResponse(reqBody, {
          content: [
            { 
              type: "text", 
              text: JSON.stringify(result)
            }
          ],
        });
      } catch (err) {
        console.error(`[MCP] tools/call failed for ${name}:`, err);
        return makeResponse(reqBody, undefined, {
          code: -32000,
          message: err instanceof Error ? err.message : "Tool execution failed",
        });
      }
    }
    case "resources/list": {
      return makeResponse(reqBody, {
        resources: [
          {
            uri: COMPONENT_RESOURCE.uri,
            name: COMPONENT_RESOURCE.name,
            mimeType: COMPONENT_RESOURCE.mimeType,
          },
        ],
      });
    }
    case "resources/read": {
      const { uri } = (reqBody.params ?? {}) as { uri?: string };
      if (uri !== COMPONENT_RESOURCE.uri) {
        return makeResponse(reqBody, undefined, {
          code: -32601,
          message: "Resource not found",
        });
      }
      const source = componentSource();
      if (source == null) {
        return makeResponse(reqBody, undefined, {
          code: -32004,
          message: "Component source unavailable",
        });
      }
      return makeResponse(reqBody, {
        resource: {
          uri,
          name: COMPONENT_RESOURCE.name,
          mimeType: COMPONENT_RESOURCE.mimeType,
          mime_type: COMPONENT_RESOURCE.mimeType,
        },
        contents: [
          {
            uri,
            mimeType: COMPONENT_RESOURCE.mimeType,
            mime_type: COMPONENT_RESOURCE.mimeType,
            type: "text",
            text: source,
          },
        ],
      });
    }
    default:
      return makeResponse(reqBody, undefined, {
        code: -32601,
        message: "Method not found",
      });
  }
}

// SSE functions removed

export const mcpRouter = Router();

// OPTIONS handler for CORS preflight
mcpRouter.options("/", (_req, res) => {
  res.status(204).end();
});

// POST handler - static JSON response (no streaming)
mcpRouter.post("/", async (req, res) => {
  const reqBody = req.body as JsonRpcRequest;
  if (!reqBody || reqBody.jsonrpc !== "2.0" || typeof reqBody.method !== "string") {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: reqBody?.id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    });
  }

  try {
    const rpcResponse = await handleJsonRpc(reqBody);
    // Ensure proper Content-Type and no BOM
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json(rpcResponse);
  } catch (err) {
    console.error(`[MCP] Error handling method ${reqBody.method}:`, err);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(500).json({
      jsonrpc: "2.0",
      id: reqBody.id ?? null,
      error: {
        code: -32000,
        message: err instanceof Error ? err.message : "Unexpected server error",
      },
    });
  }
});

// GET handler for MCP discovery (ChatGPT does this first!)
mcpRouter.get("/", (_req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({
    jsonrpc: "2.0",
    protocolVersion: "2025-03-26",
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    serverInfo: {
      name: "providence_ai_booking",
      version: "0.1.0",
    },
  });
});

