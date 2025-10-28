import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { haversineMiles } from "../lib/geo.js";
import { isOpenNow } from "../lib/hours.js";
const facilitiesCache = [];
function loadFacilities() {
    if (facilitiesCache.length > 0)
        return facilitiesCache;
    const dataDir = path.join(process.cwd(), "data");
    const files = ["facilities.anchorage.json", "facilities.seattle.json"];
    for (const f of files) {
        const p = path.join(dataDir, f);
        if (fs.existsSync(p)) {
            const arr = JSON.parse(fs.readFileSync(p, "utf-8"));
            facilitiesCache.push(...arr);
        }
    }
    return facilitiesCache;
}
export const searchFacilitiesRouter = Router();
const bodySchema = z.object({
    lat: z.number(),
    lon: z.number(),
    radiusMiles: z.number().default(15),
    venue: z.enum(["urgent_care", "er", "primary_care", "virtual"]),
    acceptsInsurancePlanId: z.string().optional(),
    openNow: z.boolean().optional(),
    pediatricFriendly: z.boolean().optional()
});
searchFacilitiesRouter.post("/", (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { lat, lon, radiusMiles, venue, acceptsInsurancePlanId, openNow, pediatricFriendly } = parsed.data;
    const facilities = loadFacilities().filter((f) => f.venue === venue);
    const now = new Date();
    const results = facilities
        .map((f) => {
        const distance = haversineMiles(lat, lon, f.lat, f.lon);
        const open = isOpenNow(f.timeZone, f.weeklyHours, now);
        return { ...f, distance, openNow: open };
    })
        .filter((f) => f.distance <= radiusMiles)
        .filter((f) => (pediatricFriendly == null ? true : f.pediatricFriendly === pediatricFriendly))
        .filter((f) => acceptsInsurancePlanId ? (f.insurancePlanIds || []).includes(acceptsInsurancePlanId) : true)
        .filter((f) => (openNow == null ? true : f.openNow === openNow))
        .sort((a, b) => (a.openNow === b.openNow ? a.distance - b.distance : a.openNow ? -1 : 1));
    res.json(results);
});
