/*
  Fetch and normalize Kyruus locations into local cache files.
  Outputs:
    - data/kyruus.locations.raw.json
    - data/kyruus.locations.json (normalized subset)
*/

import fs from "fs";
import path from "path";

const SOURCE_URL = "https://providencekyruus.azurewebsites.net/api/searchlocationsbyservices?";

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function to24h(timeStr) {
  // Input like "8:00 am" or "8:00 pm"; return HH:MM (24h) or null
  if (!timeStr || typeof timeStr !== "string") return null;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ap = m[3].toLowerCase();
  if (ap === "am") {
    if (hh === 12) hh = 0;
  } else {
    if (hh !== 12) hh += 12;
  }
  const hStr = String(hh).padStart(2, "0");
  return `${hStr}:${mm}`;
}

function parseAddressPlain(addressPlain) {
  // Best-effort parsing: "line, City, ST ZIP"
  if (!addressPlain || typeof addressPlain !== "string") {
    return { line1: "", city: "", state: "", zip: "" };
  }
  const parts = addressPlain.split(",");
  const line1 = parts[0]?.trim() ?? addressPlain;
  // Attempt to get city, state zip from the last segment(s)
  let city = "";
  let state = "";
  let zip = "";
  if (parts.length >= 3) {
    city = parts[1].trim();
    const tail = parts.slice(2).join(",").trim();
    const m = tail.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (m) {
      state = m[1];
      zip = m[2];
    } else {
      // fallback: try to split by space
      const tokens = tail.split(/\s+/);
      state = tokens.find((t) => /^[A-Z]{2}$/.test(t)) || "";
      zip = tokens.find((t) => /^\d{5}(?:-\d{4})?$/.test(t)) || "";
    }
  }
  return { line1, city, state, zip };
}

function dayKeyFromName(name) {
  // Map to Mon/Tue/... keys used by our server utilities
  const map = { Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" };
  return map[name] || null;
}

function normalizeVenue(item) {
  const isUrgent = !!item.is_urgent_care || !!item.is_express_care;
  if (isUrgent) return "urgent_care";
  // Basic heuristics
  const name = String(item.name || "").toLowerCase();
  if (name.includes("emergency")) return "er";
  if (name.includes("primary") || name.includes("family") || name.includes("internal")) return "primary_care";
  return "urgent_care";
}

function deriveWeeklyHours(hoursObj) {
  if (!hoursObj || typeof hoursObj !== "object") return undefined;
  const result = {};
  const keys = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  for (const k of keys) {
    const d = hoursObj[k];
    if (!d || !d.start || !d.end) continue;
    const open = to24h(d.start);
    const close = to24h(d.end);
    if (!open || !close) continue;
    const std = dayKeyFromName(k);
    if (!std) continue;
    result[std] = [{ open, close }];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

async function main() {
  console.log("Fetching Kyruus locations...");
  const res = await fetch(SOURCE_URL, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch locations: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  const rawOut = path.join(process.cwd(), "data", "kyruus.locations.raw.json");
  ensureDir(rawOut);
  fs.writeFileSync(rawOut, JSON.stringify(raw, null, 2));

  const locations = Array.isArray(raw?.locations) ? raw.locations : [];
  const normalized = [];
  for (const item of locations) {
    const dept = item.booking_wheelhouse;
    if (!dept || typeof dept !== "string" || dept.trim() === "") continue; // require departmentUrlName
    const id = dept.trim();
    const name = String(item.name || id);
    const venue = normalizeVenue(item);
    const lat = item?.coordinates?.lat;
    const lon = item?.coordinates?.lng;
    if (typeof lat !== "number" || typeof lon !== "number") continue; // need coordinates
    const addrParsed = parseAddressPlain(item.address_plain || "");
    // Map time zone from state when possible
    let timeZone = undefined;
    const state = (addrParsed.state || "").toUpperCase();
    if (state === "WA" || state === "OR" || state === "CA") timeZone = "America/Los_Angeles";
    else if (state === "AK") timeZone = "America/Anchorage";
    else if (state === "MT") timeZone = "America/Denver";
    const weeklyHours = deriveWeeklyHours(item.hours || null);
    const siteUrl = item.sitecore_url || item.pwamp_url || item.kd_pwamp_url || item.sw_pwamp_url || null;

    normalized.push({
      id,
      name,
      venue,
      lat,
      lon,
      address: addrParsed,
      pediatricFriendly: false,
      timeZone,
      weeklyHours,
      insurancePlanIds: undefined,
      departmentUrlName: id,
      locationCode: id,
      siteUrl: siteUrl || undefined
    });
  }

  const normOut = path.join(process.cwd(), "data", "kyruus.locations.json");
  fs.writeFileSync(normOut, JSON.stringify(normalized, null, 2));
  console.log(`Wrote ${normalized.length} locations -> ${normOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


