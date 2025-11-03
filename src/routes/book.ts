import { Router } from "express";
import { z } from "zod";
import { coerceJsonBody } from "../utils/coerceJsonBody.js";
import fs from "fs";
import path from "path";

export const bookRouter = Router();

const bodySchema = z.object({
  facilityId: z.string(),
  slotId: z.string(),
  patientContextToken: z.string()
});

bookRouter.post("/", (req, res) => {
  const body = coerceJsonBody(req.body);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { facilityId, slotId, patientContextToken } = parsed.data;

  // Try to resolve as Kyruus-backed facility (facilityId = departmentUrlName)
  const kyPath = path.join(process.cwd(), "data", "kyruus.locations.json");
  let isKyruus = false;
  if (fs.existsSync(kyPath)) {
    try {
      const arr = JSON.parse(fs.readFileSync(kyPath, "utf-8")) as any[];
      isKyruus = !!arr.find((x) => String(x.id) === String(facilityId));
    } catch {
      isKyruus = false;
    }
  }

  if (isKyruus) {
    const deepLink = `https://scheduling.care.psjhealth.org/retail?timeSlot=${encodeURIComponent(
      slotId
    )}&departmentUrlName=${encodeURIComponent(facilityId)}&brand=providence`;
    return res.json({ deepLink });
  }

  // Fallback to mock deep link for non-Kyruus facilities
  const deepLink = `https://mychart.example/book?f=${encodeURIComponent(facilityId)}&s=${encodeURIComponent(
    slotId
  )}&t=${encodeURIComponent(patientContextToken)}`;
  return res.json({ deepLink });
});


