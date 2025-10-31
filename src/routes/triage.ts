import { Router } from "express";
import { randomUUID } from "crypto";
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
  const correlationId = String(req.headers["x-correlation-id"] || randomUUID());
  const start = Date.now();
  const contentType = req.headers["content-type"] ?? "<undefined>";
  const bodyType = typeof req.body;
  const preview =
    bodyType === "string"
      ? String(req.body)
          .replace(/\s+/g, " ")
          .slice(0, 100)
      : undefined;
  console.log(
    "[triage] start cid=%s content-type=%s type=%s preview=%s",
    correlationId,
    contentType,
    bodyType,
    preview,
  );

  const body = coerceJsonBody(req.body);

  const parsed = triageBodySchema.safeParse(body);
  if (!parsed.success) {
    console.warn("[triage] bad_request cid=%s", correlationId);
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid payload",
        correlationId,
        details: parsed.error.flatten(),
      },
      correlationId,
    });
  }
  const { symptoms, age, pregnancyStatus, durationHours } = parsed.data;
  try {
    const redFlag = detectRedFlags(symptoms, { age, pregnancyStatus, durationHours });
    const venue = redFlag ? "er" : recommendVenue(symptoms, { age });
    const rationale = redFlag
      ? "Red flag detected. For safety, recommend Emergency Department."
      : `Based on symptoms and age, ${venue.replace("_", " ")} is appropriate.`;
    const durationMs = Date.now() - start;
    console.info("[triage] success cid=%s durationMs=%d venue=%s", correlationId, durationMs, venue);
    res.json({ correlationId, venue, rationale, redFlag, durationMs });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error("[triage] unhandled_error cid=%s durationMs=%d err=%o", correlationId, durationMs, err);
    return res.status(424).json({
      error: {
        code: "TRIAGE_DEPENDENCY_FAILURE",
        message: "A downstream dependency failed during triage.",
        correlationId,
        downstream: [],
        hint: "See logs with correlationId",
      },
    });
  }
});


