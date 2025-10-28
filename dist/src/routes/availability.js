import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { nextSlotsWithinDays } from "../lib/hours.js";
const facilities = [];
function getFacilities() {
    if (facilities.length > 0)
        return facilities;
    const dataDir = path.join(process.cwd(), "data");
    for (const f of ["facilities.anchorage.json", "facilities.seattle.json"]) {
        const p = path.join(dataDir, f);
        if (fs.existsSync(p))
            facilities.push(...JSON.parse(fs.readFileSync(p, "utf-8")));
    }
    return facilities;
}
function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
export const availabilityRouter = Router();
const bodySchema = z.object({
    facilityId: z.string(),
    serviceCode: z.string().default("urgent-care"),
    days: z.number().int().min(1).max(14).default(7)
});
availabilityRouter.post("/", (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { facilityId, serviceCode, days } = parsed.data;
    const fac = getFacilities().find((f) => f.id === facilityId);
    if (!fac)
        return res.status(404).json({ error: "facility_not_found" });
    const seed = hashString(`${facilityId}:${serviceCode}`);
    const rng = mulberry32(seed);
    const slots = nextSlotsWithinDays(fac.timeZone, fac.weeklyHours, new Date(), days, 3, 6, rng);
    res.json({ facilityId, serviceCode, slots });
});
