import { Router } from "express";
import { z } from "zod";
import { detectRedFlags, recommendVenue } from "../lib/redFlags.js";
export const triageRouter = Router();
const bodySchema = z.object({
    symptoms: z.string(),
    age: z.number().int().min(0).max(120),
    pregnancyStatus: z.enum(["unknown", "pregnant", "not_pregnant"]).default("unknown"),
    durationHours: z.number().int().min(0).max(10000).optional()
});
triageRouter.post("/", (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
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
