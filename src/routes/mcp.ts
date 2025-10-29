import { Router } from "express";
import fs from "fs";
import path from "path";

export const mcpRouter = Router();

type McpRequest =
  | { action: "tools" }
  | { action: "components" }
  | { action: "call"; name: string; arguments: any };

const toolSchemas = {
  triage_v1: {
    name: "triage_v1",
    description:
      "Suggest care venue (ER/urgent/primary/virtual) & urgency based on symptoms and age.",
    parameters: {
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
  search_facilities_v1: {
    name: "search_facilities_v1",
    description: "Find Providence care options near a location with filters.",
    parameters: {
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
  get_availability_v1: {
    name: "get_availability_v1",
    description: "Fetch next available appointment slots for a facility/service.",
    parameters: {
      type: "object",
      required: ["facilityId"],
      properties: {
        facilityId: { type: "string" },
        serviceCode: { type: "string", default: "urgent-care" },
        days: { type: "integer", minimum: 1, maximum: 14, default: 7 }
      }
    }
  },
  book_appointment_v1: {
    name: "book_appointment_v1",
    description: "Book appointment or generate deep link to MyChart flow (mock).",
    parameters: {
      type: "object",
      required: ["facilityId", "slotId", "patientContextToken"],
      properties: {
        facilityId: { type: "string" },
        slotId: { type: "string" },
        patientContextToken: { type: "string" }
      }
    }
  }
};

function readComponentSource(): string | null {
  const p = path.join(process.cwd(), "apps", "find-care", "component.tsx");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

mcpRouter.post("/", async (req, res) => {
  const body = req.body as McpRequest;
  if (!body || typeof body !== "object" || !("action" in body)) {
    return res.status(400).json({ error: "bad_request" });
  }

  if (body.action === "tools") {
    return res.json({ tools: Object.values(toolSchemas) });
  }

  if (body.action === "components") {
    const source = readComponentSource();
    return res.json({
      components: [
        {
          name: "find-care-component",
          language: "tsx",
          source: source ?? "// component source not found"
        }
      ]
    });
  }

  if (body.action === "call") {
    const { name, arguments: args } = body as any;
    const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
    try {
      switch (name) {
        case "triage_v1": {
          const r = await fetch(`${base}/api/triage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args || {})
          });
          const json = await r.json();
          return res.json({ ok: true, result: json });
        }
        case "search_facilities_v1": {
          const r = await fetch(`${base}/api/search-facilities`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args || {})
          });
          const json = await r.json();
          return res.json({ ok: true, result: json });
        }
        case "get_availability_v1": {
          const r = await fetch(`${base}/api/availability`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args || {})
          });
          const json = await r.json();
          return res.json({ ok: true, result: json });
        }
        case "book_appointment_v1": {
          const r = await fetch(`${base}/api/book`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args || {})
          });
          const json = await r.json();
          return res.json({ ok: true, result: json });
        }
        default:
          return res.status(400).json({ error: "unknown_tool" });
      }
    } catch (e: any) {
      return res.status(500).json({ error: "tool_error", message: e?.message || String(e) });
    }
  }

  return res.status(400).json({ error: "bad_request" });
});


