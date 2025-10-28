import { Router } from "express";
import { z } from "zod";

export const bookRouter = Router();

const bodySchema = z.object({
  facilityId: z.string(),
  slotId: z.string(),
  patientContextToken: z.string()
});

bookRouter.post("/", (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { facilityId, slotId, patientContextToken } = parsed.data;
  const deepLink = `https://mychart.example/book?f=${encodeURIComponent(facilityId)}&s=${encodeURIComponent(
    slotId
  )}&t=${encodeURIComponent(patientContextToken)}`;
  res.json({ deepLink });
});


