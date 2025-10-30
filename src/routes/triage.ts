import { Router } from "express";
import { z } from "zod";
import { detectRedFlags, recommendVenue } from "../lib/redFlags.js";
import { coerceJsonBody } from "../utils/coerceJsonBody.js";

export const triageRouter = Router();

export const triageBodySchema = z.object({
  symptoms: z
    .string()
    .trim()
    .min(1, "symptoms is required"),
  age: z.coerce.number().int().min(0).max(120),
  pregnancyStatus: z.enum(["unknown", "pregnant", "not_pregnant"]).default("unknown"),
  durationHours: z.coerce.number().int().min(0).max(10000).optional()
});

triageRouter.post("/", (req, res) => {
  const contentType = req.headers["content-type"] ?? "<undefined>";
  const bodyType = typeof req.body;
  const preview =
    bodyType === "string"
      ? String(req.body)
          .replace(/\s+/g, " ")
          .slice(0, 100)
      : undefined;
  console.log("[triage] content-type=%s type=%s preview=%s", contentType, bodyType, preview);

  const body = coerceJsonBody(req.body);

  const parsed = triageBodySchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { symptoms, age, pregnancyStatus, durationHours } = parsed.data;
  const redFlag = detectRedFlags(symptoms, { age, pregnancyStatus, durationHours });
  const venue = redFlag ? "er" : recommendVenue(symptoms, { age });
  const rationale = redFlag
    ? "Red flag detected. For safety, recommend Emergency Department."
    : `Based on symptoms and age, ${venue.replace("_", " ")} is appropriate.`;
  res.json({ venue, rationale, redFlag });
});


