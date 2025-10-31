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
    name: "mcp_ping",
    description: "Simple in-process ping to validate MCP POST path.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "triage_v1",
    description:
      "Suggest care venue (ER/urgent/primary/virtual) & urgency based on symptoms and age.",
    inputSchema: {
      type: "object",
      required: ["symptoms", "age"],
      properties: {
        symptoms: { type: "string" },
        age: { type: "integer", minimum: 0, maximum: 120 },
        pregnancyStatus: {
          type: "string",
          enum: ["unknown", "pregnant", "not_pregnant"],
          default: "unknown",
        },
        durationHours: { type: "integer", minimum: 0, maximum: 10000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "triage_canary",
    description: "Dependency-free canary for triage service health.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "search_facilities_v1",
    description: "Find Providence care options near a location with filters.",
    inputSchema: {
      type: "object",
      required: ["venue"],
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        zip: { type: "string" },
        radiusMiles: { type: "number", default: 15 },
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
  {
    name: "get_availability_v1",
    description: "Fetch next available appointment slots for a facility/service.",
    inputSchema: {
      type: "object",
      required: ["facilityId"],
      properties: {
        facilityId: { type: "string" },
        serviceCode: { type: "string", default: "urgent-care" },
        days: { type: "integer", minimum: 1, maximum: 14, default: 7 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "book_appointment_v1",
    description: "Book appointment or generate deep link to MyChart flow (mock).",
    inputSchema: {
      type: "object",
      required: ["facilityId", "slotId", "patientContextToken"],
      properties: {
        facilityId: { type: "string" },
        slotId: { type: "string" },
        patientContextToken: { type: "string" },
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

const sseClients = new Map<string, Response>();

function componentSource(): string | null {
  const filePath = path.join(process.cwd(), "apps", "find-care", "component.tsx");
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf-8");
}

async function callTool(
  name: string,
  args: Record<string, unknown> | undefined,
  correlationId: string,
) {
  const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
  const payload = JSON.stringify(args ?? {});
  const headers = { "content-type": "application/json", "x-correlation-id": correlationId } as Record<string, string>;

  async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout_${ms}ms`)), ms)),
    ]);
  }

  async function fetchSafe(url: string, init: any, timeoutMs = 5000, retries = 1): Promise<any> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await withTimeout(fetch(url, init), timeoutMs);
        return resp;
      } catch (e) {
        lastErr = e;
        // jitter backoff
        if (attempt < retries) {
          const delay = 100 + Math.floor(Math.random() * 200);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  switch (name) {
    case "triage_v1": {
      const response = await fetchSafe(`${base}/api/triage`, { method: "POST", headers, body: payload }, 5000, 1);
      return response.json();
    }
    case "triage_canary": {
      const response = await fetchSafe(`${base}/api/triage_canary`, { method: "GET", headers }, 3000, 0);
      return response.json();
    }
    case "search_facilities_v1": {
      const response = await fetchSafe(`${base}/api/search-facilities`, {
        method: "POST",
        headers,
        body: payload,
      }, 7000, 1);
      return response.json();
    }
    case "get_availability_v1": {
      const response = await fetchSafe(`${base}/api/availability`, { method: "POST", headers, body: payload }, 5000, 1);
      return response.json();
    }
    case "book_appointment_v1": {
      const response = await fetchSafe(`${base}/api/book`, { method: "POST", headers, body: payload }, 5000, 1);
      return response.json();
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
        serverInfo: { name: "Providence Find Care Demo", version: "0.1.0" },
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { list: {}, call: {} },
          resources: { list: {}, read: {} },
        },
      });
    }
    case "tools/list": {
      return makeResponse(reqBody, {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          input_schema: tool.inputSchema,
        })),
      });
    }
    case "tools/call": {
      const rawParams = (reqBody.params ?? {}) as Record<string, unknown>;
      const name = (rawParams as any).name as string | undefined;
      const args = ((rawParams as any).arguments ?? (rawParams as any).args) as
        | Record<string, unknown>
        | undefined;
      if (!name) {
        return makeResponse(reqBody, undefined, {
          code: -32602,
          message: "Missing tool name",
        });
      }
      // Handle in-process ping without any HTTP calls
      if (name === "mcp_ping") {
        return makeResponse(reqBody, {
          content: [
            {
              type: "json",
              json: {
                ok: true,
                now: new Date().toISOString(),
                role: "node-mcp",
              },
            },
          ],
        });
      }
      try {
        const correlationId = randomUUID();
        const result = await callTool(name, args, correlationId);
        return makeResponse(reqBody, {
          content: [{ type: "json", json: result }],
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
            mime_type: COMPONENT_RESOURCE.mimeType,
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

function broadcastToSseClients(response: JsonRpcResponse) {
  const payload = JSON.stringify(response);
  for (const [clientId, res] of sseClients) {
    try {
      res.write(`event: message\n`);
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error(`[MCP] SSE write failed for client ${clientId}:`, err);
      sseClients.delete(clientId);
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  }
}

function createSseConnection(res: Response) {
  const clientId = randomUUID();
  sseClients.set(clientId, res);
  res.write(`event: message\n`);
  res.write(
    `data: ${JSON.stringify({
      jsonrpc: "2.0",
      method: "ready",
      params: { clientId },
    })}\n\n`,
  );
  return clientId;
}

export const mcpRouter = Router();

mcpRouter.post("/", async (req, res) => {
  let reqBody: JsonRpcRequest | undefined;
  const cid = (req as any).correlationId ?? "<none>";
  try {
    const bodyType = typeof req.body;
    const size = req.headers["content-length"] ?? "-";
    console.info("[mcp] entry cid=%s type=%s size=%s", cid, bodyType, size);
    if (bodyType === "string") {
      const raw = (req.body as unknown as string).trim();
      try {
        reqBody = JSON.parse(raw) as JsonRpcRequest;
      } catch (e) {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: invalid JSON" },
        });
      }
    } else {
      reqBody = req.body as JsonRpcRequest;
    }
  } catch {}
  if (!reqBody || reqBody.jsonrpc !== "2.0" || typeof reqBody.method !== "string") {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: reqBody?.id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    });
  }

  try {
    const rpcResponse = await handleJsonRpc(reqBody);
    broadcastToSseClients(rpcResponse);
    return res.json(rpcResponse);
  } catch (err) {
    console.error(`[MCP] Error handling method ${reqBody.method}:`, err);
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

mcpRouter.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = createSseConnection(res);
  console.log(`[MCP] SSE client connected: ${clientId}`);

  const keepAlive = setInterval(() => {
    res.write(`: keep-alive\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(clientId);
    console.log(`[MCP] SSE client disconnected: ${clientId}`);
  });
});

