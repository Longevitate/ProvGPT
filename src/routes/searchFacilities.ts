import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { haversineMiles } from "../lib/geo.js";
import { isOpenNow } from "../lib/hours.js";

export type Facility = {
	id: string;
	name: string;
	venue: "urgent_care" | "er" | "primary_care" | "virtual";
	lat: number;
	lon: number;
	address: { line1: string; city: string; state: string; zip: string };
	pediatricFriendly: boolean;
	timeZone: string; // IANA tz
	weeklyHours: Record<string, { open: string; close: string }[]>; // e.g., { Mon: [{open:"08:00",close:"17:00"}], ... }
	insurancePlanIds?: string[];
};

const facilitiesCache: Facility[] = [];
let zipMapCache: Record<string, { lat: number; lon: number; city?: string }> | null = null;
let knownPlanIdsCache: Set<string> | null = null;

function loadFacilities(): Facility[] {
	if (facilitiesCache.length > 0) return facilitiesCache;
	const dataDir = path.join(process.cwd(), "data");
	const files = ["facilities.anchorage.json", "facilities.seattle.json"];
	for (const f of files) {
		const p = path.join(dataDir, f);
		if (fs.existsSync(p)) {
			const arr = JSON.parse(fs.readFileSync(p, "utf-8")) as Facility[];
			facilitiesCache.push(...arr);
		}
	}
	return facilitiesCache;
}

function loadZipMap(): Record<string, { lat: number; lon: number; city?: string }> {
	if (zipMapCache) return zipMapCache;
	const p = path.join(process.cwd(), "data", "zip.json");
	zipMapCache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
	return zipMapCache!;
}

function loadKnownPlanIds(): Set<string> {
	if (knownPlanIdsCache) return knownPlanIdsCache;
	const p = path.join(process.cwd(), "data", "plans.json");
	if (fs.existsSync(p)) {
		const obj = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, string[]>;
		knownPlanIdsCache = new Set(Object.keys(obj));
	} else {
		knownPlanIdsCache = new Set();
	}
	return knownPlanIdsCache!;
}

function normalizePlanId(id?: string, name?: string): string | undefined {
	const known = loadKnownPlanIds();
	if (id && known.has(id)) return id;
	if (name) {
		const t = name.toLowerCase();
		if (t.includes("aetna")) return known.has("plan_b") ? "plan_b" : undefined;
		if (t.includes("blue") || t.includes("anthem") || t.includes("premera")) return known.has("plan_a") ? "plan_a" : undefined;
		if (t.includes("cigna")) return known.has("plan_c") ? "plan_c" : undefined;
	}
	return undefined; // ignore unknowns
}

export const searchFacilitiesRouter = Router();

const bodySchema = z.object({
	lat: z.number().optional(),
	lon: z.number().optional(),
	radiusMiles: z.number().default(15),
	venue: z.enum(["urgent_care", "er", "primary_care", "virtual"]),
	acceptsInsurancePlanId: z.string().optional(),
	acceptsInsurancePlanName: z.string().optional(),
	openNow: z.boolean().optional(),
	pediatricFriendly: z.boolean().optional(),
	zip: z.string().optional()
});

function computeResults(
	lat: number,
	lon: number,
	facilities: Facility[],
	radiusMiles: number,
	filters: { pediatricFriendly?: boolean; planId?: string; openNow?: boolean }
) {
	const now = new Date();
	return facilities
		.map((f) => {
			const distance = haversineMiles(lat, lon, f.lat, f.lon);
			const open = isOpenNow(f.timeZone, f.weeklyHours, now);
			return { ...f, distance, openNow: open } as Facility & { distance: number; openNow: boolean };
		})
		.filter((f) => f.distance <= radiusMiles)
		.filter((f) => (filters.pediatricFriendly == null ? true : f.pediatricFriendly === filters.pediatricFriendly))
		.filter((f) => (filters.planId ? (f.insurancePlanIds || []).includes(filters.planId) : true))
		.filter((f) => (filters.openNow == null ? true : f.openNow === filters.openNow))
		.sort((a, b) => (a.openNow === b.openNow ? a.distance - b.distance : a.openNow ? -1 : 1));
}

searchFacilitiesRouter.post("/", (req, res) => {
	const parsed = bodySchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const { lat, lon, radiusMiles, venue, acceptsInsurancePlanId, acceptsInsurancePlanName, openNow, pediatricFriendly, zip } = parsed.data;

	let effectiveLat = lat;
	let effectiveLon = lon;
	if ((effectiveLat == null || effectiveLon == null) && zip) {
		const z = loadZipMap()[zip];
		if (z) {
			effectiveLat = z.lat;
			effectiveLon = z.lon;
		}
	}
	if (effectiveLat == null || effectiveLon == null) {
		return res.status(400).json({ error: "location_required", message: "Provide lat/lon or a known zip." });
	}

	const facilities = loadFacilities().filter((f) => f.venue === venue);
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


