import { Router } from "express";
import fs from "fs";
import path from "path";

export const mcpRouter = Router();

// Minimal JSON-RPC types
interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number | string | null;
	method: string;
	params?: any;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number | string | null;
	result?: any;
	error?: { code: number; message: string; data?: any };
}

const tools = [
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
					default: "unknown"
				},
				durationHours: { type: "integer", minimum: 0, maximum: 10000 }
			}
		}
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
				venue: { type: "string", enum: ["urgent_care", "er", "primary_care", "virtual"] },
				acceptsInsurancePlanId: { type: "string" },
				acceptsInsurancePlanName: { type: "string" },
				openNow: { type: "boolean" },
				pediatricFriendly: { type: "boolean" }
			}
		}
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
				days: { type: "integer", minimum: 1, maximum: 14, default: 7 }
			}
		}
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
				patientContextToken: { type: "string" }
			}
		}
	}
];

function componentSource(): string | null {
	const p = path.join(process.cwd(), "apps", "find-care", "component.tsx");
	if (!fs.existsSync(p)) return null;
	return fs.readFileSync(p, "utf-8");
}

async function callTool(name: string, args: any) {
	const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
	switch (name) {
		case "triage_v1": {
			const r = await fetch(`${base}/api/triage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args || {}) });
			return await r.json();
		}
		case "search_facilities_v1": {
			const r = await fetch(`${base}/api/search-facilities`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args || {}) });
			return await r.json();
		}
		case "get_availability_v1": {
			const r = await fetch(`${base}/api/availability`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args || {}) });
			return await r.json();
		}
		case "book_appointment_v1": {
			const r = await fetch(`${base}/api/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args || {}) });
			return await r.json();
		}
		default:
			throw new Error("unknown_tool");
	}
}

mcpRouter.post("/", async (req, res) => {
	const reqBody = req.body as JsonRpcRequest;
	const makeRes = (result?: any, error?: { code: number; message: string; data?: any }): JsonRpcResponse => ({
		jsonrpc: "2.0",
		id: reqBody?.id ?? null,
		...(error ? { error } : { result })
	});

	try {
		if (!reqBody || reqBody.jsonrpc !== "2.0" || typeof reqBody.method !== "string") {
			return res.status(400).json(makeRes(undefined, { code: -32600, message: "Invalid Request" }));
		}

		switch (reqBody.method) {
			case "initialize": {
				return res.json(
					makeRes({
						serverInfo: { name: "Providence Find Care Demo", version: "0.1.0" },
						protocolVersion: "2024-11-05",
						capabilities: { tools: { list: true, call: true }, resources: { list: true, read: true } }
					})
				);
			}
			case "tools/list": {
				return res.json(makeRes({ tools }));
			}
			case "listTools": {
				return res.json(makeRes({ tools }));
			}
			case "tools/call": {
				const { name, arguments: args } = reqBody.params || {};
				const out = await callTool(name, args);
				// MCP expects content array
				return res.json(makeRes({ content: [{ type: "json", json: out }] }));
			}
			case "callTool": {
				const { name, arguments: args } = reqBody.params || {};
				const out = await callTool(name, args);
				return res.json(makeRes({ content: [{ type: "json", json: out }] }));
			}
			case "resources/list": {
				return res.json(
					makeRes({
						resources: [
							{
								uri: "component://find-care",
								name: "find-care-component",
								mimeType: "text/tsx"
							}
						]
					})
				);
			}
			case "resources/ls": {
				return res.json(
					makeRes({
						resources: [
							{
								uri: "component://find-care",
								name: "find-care-component",
								mimeType: "text/tsx"
							}
						]
					})
				);
			}
			case "resources/read": {
				const { uri } = reqBody.params || {};
				if (uri !== "component://find-care") {
					return res.status(404).json(makeRes(undefined, { code: -32601, message: "Not found" }));
				}
				const src = componentSource() ?? "// component source not found";
				return res.json(
					makeRes({
						contents: [
							{ uri, mimeType: "text/tsx", text: src }
						]
					})
				);
			}
			case "resources/get": {
				const { uri } = reqBody.params || {};
				if (uri !== "component://find-care") {
					return res.status(404).json(makeRes(undefined, { code: -32601, message: "Not found" }));
				}
				const src = componentSource() ?? "// component source not found";
				return res.json(
					makeRes({
						contents: [
							{ uri, mimeType: "text/tsx", text: src }
						]
					})
				);
			}
			case "ping": {
				return res.json(makeRes({ ok: true }));
			}
			default:
				return res.status(400).json(makeRes(undefined, { code: -32601, message: "Method not found" }));
		}
	} catch (e: any) {
		return res.status(500).json(makeRes(undefined, { code: -32000, message: e?.message || String(e) }));
	}
});

// Minimal SSE endpoint to satisfy MCP connectors that expect an event stream handshake
mcpRouter.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send a simple ready event; clients typically keep the stream open
  const ready = { jsonrpc: "2.0", id: null, method: "ready" };
  res.write(`event: message\n`);
  res.write(`data: ${JSON.stringify(ready)}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(`: keep-alive\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
  });
});


