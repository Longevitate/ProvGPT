import { Router } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
const tools = [
    {
        name: "triage_v1",
        description: "Suggest care venue (ER/urgent/primary/virtual) & urgency based on symptoms and age.",
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
const sseClients = new Map();
function componentSource() {
    const filePath = path.join(process.cwd(), "apps", "find-care", "component.tsx");
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, "utf-8");
}
async function callTool(name, args) {
    // Use in-process implementations to avoid HTTP fetch issues in Azure
    const payload = args ?? {};
    switch (name) {
        case "triage_v1": {
            // Simple in-process triage logic
            const { symptoms, age } = payload;
            if (!symptoms || typeof age !== 'number') {
                throw new Error("Missing required parameters: symptoms and age");
            }
            const symptomsLower = symptoms.toLowerCase();
            let venue = "urgent_care";
            let redFlag = false;
            let rationale = "Based on symptoms and age, urgent care is appropriate.";
            // Check for red flags
            if (symptomsLower.includes("chest pain") || symptomsLower.includes("shortness of breath")) {
                venue = "er";
                redFlag = true;
                rationale = "Red flag detected. For safety, recommend Emergency Department.";
            }
            else if (symptomsLower.includes("severe") || age < 2 || age > 75) {
                venue = "er";
                rationale = "Age or severity factors recommend Emergency Room evaluation.";
            }
            return {
                correlationId: randomUUID(),
                venue,
                rationale,
                redFlag,
            };
        }
        case "search_facilities_v1": {
            // Mock search results
            const { venue, zip } = payload;
            if (!venue) {
                throw new Error("Missing required parameter: venue");
            }
            const mockFacilities = [
                {
                    id: "prov_anc_er",
                    name: "Providence Alaska Medical Center ER",
                    venue: "er",
                    address: "3200 Providence Dr, Anchorage, AK 99508",
                    distance: 2.3,
                    isOpen: true,
                },
                {
                    id: "prov_anc_urgent",
                    name: "Providence Urgent Care - Midtown",
                    venue: "urgent_care",
                    address: "1700 E Bogard Rd, Wasilla, AK 99654",
                    distance: 8.7,
                    isOpen: true,
                },
            ].filter(f => f.venue === venue);
            return {
                correlationId: randomUUID(),
                results: mockFacilities,
                totalFound: mockFacilities.length,
            };
        }
        case "get_availability_v1": {
            // Mock availability
            const { facilityId } = payload;
            if (!facilityId) {
                throw new Error("Missing required parameter: facilityId");
            }
            const mockSlots = [
                { id: "slot_001", date: "2025-11-01", time: "09:00", available: true },
                { id: "slot_002", date: "2025-11-01", time: "10:00", available: true },
                { id: "slot_003", date: "2025-11-01", time: "11:00", available: true },
            ];
            return {
                correlationId: randomUUID(),
                facilityId,
                slots: mockSlots,
            };
        }
        case "book_appointment_v1": {
            // Mock booking
            const { facilityId, slotId } = payload;
            if (!facilityId || !slotId) {
                throw new Error("Missing required parameters: facilityId and slotId");
            }
            return {
                correlationId: randomUUID(),
                bookingId: `BOOK-${Date.now()}`,
                status: "confirmed",
                message: "Appointment booked successfully (mock)",
            };
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
function makeResponse(reqBody, result, error) {
    return {
        jsonrpc: "2.0",
        id: reqBody.id ?? null,
        ...(error ? { error } : { result }),
    };
}
async function handleJsonRpc(reqBody) {
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
            const { name, arguments: args } = (reqBody.params ?? {});
            if (!name) {
                return makeResponse(reqBody, undefined, {
                    code: -32602,
                    message: "Missing tool name",
                });
            }
            try {
                const result = await callTool(name, args);
                return makeResponse(reqBody, {
                    content: [{ type: "json", json: result }],
                });
            }
            catch (err) {
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
            const { uri } = (reqBody.params ?? {});
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
function broadcastToSseClients(response) {
    const payload = JSON.stringify(response);
    for (const [clientId, res] of sseClients) {
        try {
            res.write(`event: message\n`);
            res.write(`data: ${payload}\n\n`);
        }
        catch (err) {
            console.error(`[MCP] SSE write failed for client ${clientId}:`, err);
            sseClients.delete(clientId);
            try {
                res.end();
            }
            catch {
                // ignore
            }
        }
    }
}
function createSseConnection(res) {
    const clientId = randomUUID();
    sseClients.set(clientId, res);
    res.write(`event: message\n`);
    res.write(`data: ${JSON.stringify({
        jsonrpc: "2.0",
        method: "ready",
        params: { clientId },
    })}\n\n`);
    return clientId;
}
export const mcpRouter = Router();
mcpRouter.post("/", async (req, res) => {
    const reqBody = req.body;
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
    }
    catch (err) {
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
