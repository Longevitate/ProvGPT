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
  _meta?: Record<string, unknown>;
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
    description: "Find nearby Providence care facilities by location and venue type.",
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
    _meta: {
      "openai/widgetAccessible": true
    }
  },
  {
    name: "get_availability_v1",
    description: "Get available appointment slots for a specific facility.",
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
    _meta: { "openai/widgetAccessible": true }
  },
  {
    name: "book_appointment_v1",
    description: "Generate booking link for a selected appointment slot.",
    inputSchema: {
      type: "object",
      required: ["facilityId", "slotId"],
      properties: {
        facilityId: { type: "string" },
        slotId: { type: "string" },
        patientContextToken: { type: "string" },
      },
      additionalProperties: false,
    },
    _meta: { "openai/widgetAccessible": true }
  },
];

const COMPONENT_RESOURCE = {
  uri: "ui://find-care/widget.html",
  name: "find-care-widget",
  mimeType: "text/html+skybridge",
};

// SSE removed - using static JSON responses only

function componentHtml(): string {
  const css = `
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 8px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin: 8px 0; }
  .row { display:flex; justify-content:space-between; align-items:center; }
  .slots { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  .btn { display:inline-block; padding:6px 10px; border-radius:6px; background:#00338e; color:#fff; text-decoration:none; font-size:12px; }
  .muted { color:#6b7280; font-size:12px; }
  .title { font-weight:600; }
  `;
  const js = `
  async function callTool(name, args) {
    if (!window.openai || !window.openai.actions || !window.openai.actions.call) return null;
    try { return await window.openai.actions.call(name, args); } catch { return null; }
  }
  function el(tag, attrs={}, children=[]) { const e = document.createElement(tag); Object.assign(e, attrs); children.forEach(c=>e.appendChild(c)); return e; }
  function text(s){ return document.createTextNode(s); }
  async function render() {
    const root = document.getElementById('root');
    root.innerHTML = '';
    const data = (window.openai && window.openai.toolOutput) || {};
    const facilities = Array.isArray(data.results) ? data.results : [];
    if (facilities.length === 0) { root.appendChild(el('div', { innerText: 'No results' })); return; }
    for (const f of facilities) {
      const card = el('div', { className: 'card' });
      const header = el('div', { className: 'row' }, [
        el('div', { className: 'title', innerText: f.name || f.id }),
        el('div', { className: 'muted', innerText: ((f.distance||0).toFixed ? f.distance.toFixed(1) : String(f.distance||'')) + ' mi' })
      ]);
      const addr = el('div', { className: 'muted', innerText: [f?.address?.line1, f?.address?.city, f?.address?.state, f?.address?.zip].filter(Boolean).join(', ') });
      const slots = el('div', { className: 'slots' });
      card.appendChild(header);
      card.appendChild(addr);
      card.appendChild(slots);
      root.appendChild(card);
      slots.innerText = 'Loading...';
      const avail = await callTool('get_availability_v1', { facilityId: f.id, days: 7, serviceCode: 'urgent-care' });
      const list = (avail && avail.slots) ? avail.slots.slice(0, 8) : [];
      slots.innerHTML = '';
      if (list.length === 0) { slots.innerText = 'No slots'; continue; }
      for (const s of list) {
        const href = 'https://scheduling.care.psjhealth.org/retail?timeSlot=' + encodeURIComponent(s) + '&departmentUrlName=' + encodeURIComponent(f.id) + '&brand=providence';
        const a = el('a', { className: 'btn', href, target: '_blank' });
        a.innerText = new Date(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        slots.appendChild(a);
      }
    }
  }
  window.addEventListener('load', render);
  `;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body><div id="root"></div><script type="module">${js}</script></body></html>`;
}

const MCP_BASE_URL = (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim() !== "")
  ? process.env.PUBLIC_BASE_URL
  : `http://127.0.0.1:${String(process.env.PORT || 8080)}`;

function renderMarkdownFallback(payload: any): string {
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length === 0) return "No facilities found.";

  const query = payload.query || {};
  const location = query.zip ? `near ${query.zip}` : "in your area";
  const venueName = (query.venue || "urgent_care").replace("_", " ");

  let markdown = `### Providence ${venueName} ${location}\n`;
  for (const f of results.slice(0, 5)) { // Limit to first 5 for brevity
    const name = f.name || f.id || "Unknown facility";
    const address = [f?.address?.city, f?.address?.state].filter(Boolean).join(", ") || "Address unavailable";
    const openStatus = f.openNow ? "Open" : "Closed";
    markdown += `- ${name} (${address}) — ${openStatus}\n`;
  }
  if (results.length > 5) {
    markdown += `- ... and ${results.length - 5} more\n`;
  }
  return markdown;
}

function wrapWithUI(payload: any) {
  return {
    ui: "ui://find-care/widget.html",
    props: payload,
    fallback_markdown: renderMarkdownFallback(payload)
  };
}

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
      const facilities = await r.json();
      const arr = Array.isArray(facilities) ? facilities : [];
      return {
        content: [{ type: "text", text: JSON.stringify({ results: arr, count: arr.length }) }]
      };
    }
    case "get_availability_v1": {
      const r = await fetch(`${MCP_BASE_URL}/api/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`availability_http_${r.status}`);
      const slots = await r.json();
      return {
        content: [{ type: "text", text: JSON.stringify(slots) }]
      };
    }
    case "book_appointment_v1": {
      const r = await fetch(`${MCP_BASE_URL}/api/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`book_http_${r.status}`);
      const bookingResult = await r.json();
      return {
        content: [{ type: "text", text: JSON.stringify(bookingResult) }]
      };
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
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {},
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
          _meta: tool._meta,
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
        const result: any = await callTool(name, args);
        if (result && (result.content || result.structuredContent)) {
          return makeResponse(reqBody, result);
        }
        return makeResponse(reqBody, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
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
      return makeResponse(reqBody, {
        resource: {
          uri,
          name: COMPONENT_RESOURCE.name,
          mimeType: COMPONENT_RESOURCE.mimeType,
        },
        contents: [
          {
            uri,
            mimeType: COMPONENT_RESOURCE.mimeType,
            type: "text",
            text: componentHtml(),
            _meta: {
              "openai/widgetCSP": {
                connect_domains: ["https://provgpt.azurewebsites.net"],
                resource_domains: ["https://*.oaistatic.com"],
              },
              "openai/widgetDescription": "List nearby Providence locations with timeslots; buttons open the scheduler.",
            }
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
        listChanged: true,
      },
      resources: {},
    },
    serverInfo: {
      name: "providence_ai_booking",
      version: "0.1.1",
    },
  });
});

