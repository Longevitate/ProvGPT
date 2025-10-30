import { Router } from "express";
import { z } from "zod";
import { coerceJsonBody } from "../utils/coerceJsonBody.js";
export const bookRouter = Router();
const bodySchema = z.object({
    facilityId: z.string(),
    slotId: z.string(),
    patientContextToken: z.string()
});
bookRouter.post("/", (req, res) => {
    const body = coerceJsonBody(req.body);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { facilityId, slotId, patientContextToken } = parsed.data;
    const deepLink = `https://mychart.example/book?f=${encodeURIComponent(facilityId)}&s=${encodeURIComponent(slotId)}&t=${encodeURIComponent(patientContextToken)}`;
    res.json({ deepLink });
});
