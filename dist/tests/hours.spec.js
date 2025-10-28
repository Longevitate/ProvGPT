import { describe, it, expect } from "vitest";
import { isOpenNow, nextSlotsWithinDays } from "../src/lib/hours.js";
const weekly = {
    Mon: [{ open: "08:00", close: "17:00" }],
    Tue: [{ open: "08:00", close: "17:00" }],
    Wed: [{ open: "08:00", close: "17:00" }],
    Thu: [{ open: "08:00", close: "17:00" }],
    Fri: [{ open: "08:00", close: "17:00" }],
    Sat: [],
    Sun: []
};
describe("hours", () => {
    it("isOpenNow true during business hours", () => {
        // Monday 10:00 local in Los Angeles
        const d = new Date("2024-08-05T17:00:00Z");
        expect(isOpenNow("America/Los_Angeles", weekly, d)).toBe(true);
    });
    it("nextSlotsWithinDays returns future ISO strings", () => {
        const slots = nextSlotsWithinDays("America/Los_Angeles", weekly, new Date("2024-08-05T00:00:00Z"), 3, 3, 3, () => 0.5);
        expect(slots.length).toBeGreaterThanOrEqual(3);
        for (const s of slots) {
            expect(new Date(s).toString()).not.toBe("Invalid Date");
        }
    });
});
