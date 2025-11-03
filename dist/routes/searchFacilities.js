import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { haversineMiles } from "../lib/geo.js";
import { isOpenNow } from "../lib/hours.js";
import { coerceJsonBody } from "../utils/coerceJsonBody.js";
const facilitiesCache = [];
let kyruusFacilitiesCache = null;
let zipMapCache = null;
let knownPlanIdsCache = null;
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
function loadKyruusFacilities() {
    if (kyruusFacilitiesCache)
        return kyruusFacilitiesCache;
    const p = path.join(process.cwd(), "data", "kyruus.locations.json");
    if (!fs.existsSync(p)) {
        kyruusFacilitiesCache = [];
        return kyruusFacilitiesCache;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
        const mapped = raw
            .map((x) => {
            const facility = {
                id: String(x.id),
                name: String(x.name || x.id),
                venue: (x.venue === "er" || x.venue === "primary_care" || x.venue === "virtual") ? x.venue : "urgent_care",
                lat: Number(x.lat),
                lon: Number(x.lon),
                address: {
                    line1: String(x?.address?.line1 || ""),
                    city: String(x?.address?.city || ""),
                    state: String(x?.address?.state || ""),
                    zip: String(x?.address?.zip || ""),
                },
                pediatricFriendly: Boolean(x?.pediatricFriendly || false),
                timeZone: String(x?.timeZone || ""),
                weeklyHours: x?.weeklyHours || {},
                insurancePlanIds: Array.isArray(x?.insurancePlanIds) ? x.insurancePlanIds : undefined,
            };
            facility.departmentUrlName = String(x?.departmentUrlName || x?.id || "");
            facility.locationCode = String(x?.locationCode || (x?.departmentUrlName || x?.id || ""));
            return facility;
        })
            .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon));
        // Deduplicate by unique id (departmentUrlName)
        const byId = new Map();
        for (const f of mapped) {
            if (!byId.has(f.id))
                byId.set(f.id, f);
        }
        kyruusFacilitiesCache = Array.from(byId.values());
    }
    catch {
        kyruusFacilitiesCache = [];
    }
    return kyruusFacilitiesCache;
}
function loadZipMap() {
    if (zipMapCache)
        return zipMapCache;
    const p = path.join(process.cwd(), "data", "zip.json");
    zipMapCache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    return zipMapCache;
}
function loadKnownPlanIds() {
    if (knownPlanIdsCache)
        return knownPlanIdsCache;
    const p = path.join(process.cwd(), "data", "plans.json");
    if (fs.existsSync(p)) {
        const obj = JSON.parse(fs.readFileSync(p, "utf-8"));
        knownPlanIdsCache = new Set(Object.keys(obj));
    }
    else {
        knownPlanIdsCache = new Set();
    }
    return knownPlanIdsCache;
}
function normalizePlanId(id, name) {
    const known = loadKnownPlanIds();
    if (id && known.has(id))
        return id;
    if (name) {
        const t = name.toLowerCase();
        if (t.includes("aetna"))
            return known.has("plan_b") ? "plan_b" : undefined;
        if (t.includes("blue") || t.includes("anthem") || t.includes("premera"))
            return known.has("plan_a") ? "plan_a" : undefined;
        if (t.includes("cigna"))
            return known.has("plan_c") ? "plan_c" : undefined;
    }
    return undefined; // ignore unknowns
}
export const searchFacilitiesRouter = Router();
const bodySchema = z.object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    radiusMiles: z.number().default(40),
    venue: z.enum(["urgent_care", "er", "primary_care", "virtual"]),
    acceptsInsurancePlanId: z.string().optional(),
    acceptsInsurancePlanName: z.string().optional(),
    openNow: z.boolean().optional(),
    pediatricFriendly: z.boolean().optional(),
    zip: z.string().optional()
});
function computeResults(lat, lon, facilities, radiusMiles, filters) {
    const now = new Date();
    return facilities
        .map((f) => {
        const distance = haversineMiles(lat, lon, f.lat, f.lon);
        const hasHours = f && f.timeZone && typeof f.timeZone === "string" && f.timeZone.trim() !== "" && f.weeklyHours && Object.keys(f.weeklyHours).length > 0;
        const open = hasHours ? isOpenNow(f.timeZone, f.weeklyHours, now) : false;
        return { ...f, distance, openNow: open };
    })
        .filter((f) => f.distance <= radiusMiles)
        .filter((f) => (filters.pediatricFriendly == null ? true : f.pediatricFriendly === filters.pediatricFriendly))
        .filter((f) => (filters.planId ? (f.insurancePlanIds || []).includes(filters.planId) : true))
        .filter((f) => (filters.openNow == null ? true : f.openNow === filters.openNow))
        .sort((a, b) => (a.openNow === b.openNow ? a.distance - b.distance : a.openNow ? -1 : 1));
}
async function geocodeZip(zip) {
    try {
        const r = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
        if (!r.ok)
            return null;
        const j = await r.json();
        const place = Array.isArray(j?.places) && j.places[0] ? j.places[0] : null;
        if (!place)
            return null;
        const lat = Number(place.latitude);
        const lon = Number(place.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon))
            return null;
        const city = String(place["place name"] || j["place name"] || "");
        return { lat, lon, city };
    }
    catch {
        return null;
    }
}
searchFacilitiesRouter.post("/", async (req, res) => {
    const body = coerceJsonBody(req.body);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { lat, lon, radiusMiles, venue, acceptsInsurancePlanId, acceptsInsurancePlanName, openNow, pediatricFriendly, zip } = parsed.data;
    let effectiveLat = lat;
    let effectiveLon = lon;
    if ((effectiveLat == null || effectiveLon == null) && zip) {
        const z = loadZipMap()[zip];
        if (z) {
            effectiveLat = z.lat;
            effectiveLon = z.lon;
        }
        else {
            const g = await geocodeZip(zip);
            if (g) {
                effectiveLat = g.lat;
                effectiveLon = g.lon;
            }
        }
    }
    if (effectiveLat == null || effectiveLon == null) {
        return res.status(400).json({ error: "location_required", message: "Provide lat/lon or a known zip." });
    }
    // Prefer Kyruus-backed facilities when cache exists; otherwise fallback to local mock data
    let facilities = [];
    const kyruus = loadKyruusFacilities().filter((f) => f.venue === venue);
    if (kyruus.length > 0) {
        facilities = kyruus;
    }
    else {
        facilities = loadFacilities().filter((f) => f.venue === venue);
    }
    const planId = normalizePlanId(acceptsInsurancePlanId, acceptsInsurancePlanName);
    let results = computeResults(effectiveLat, effectiveLon, facilities, radiusMiles, {
        pediatricFriendly,
        planId,
        openNow
    });
    // Fallbacks if no results
    if (results.length === 0) {
        results = computeResults(effectiveLat, effectiveLon, facilities, radiusMiles, {
            pediatricFriendly,
            planId,
            openNow: undefined
        });
    }
    if (results.length === 0 && pediatricFriendly) {
        results = computeResults(effectiveLat, effectiveLon, facilities, radiusMiles, {
            pediatricFriendly: undefined,
            planId,
            openNow: undefined
        });
    }
    if (results.length === 0) {
        results = computeResults(effectiveLat, effectiveLon, facilities, Math.max(radiusMiles, 25), {
            pediatricFriendly: undefined,
            planId,
            openNow: undefined
        });
    }
    if (results.length === 0) {
        results = computeResults(effectiveLat, effectiveLon, facilities, Math.max(radiusMiles, 35), {
            pediatricFriendly: undefined,
            planId,
            openNow: undefined
        });
    }
    return res.json(results);
});
