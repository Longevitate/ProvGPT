import { describe, expect, it } from "vitest";
import { triageBodySchema } from "../src/routes/triage.js";

describe("triage request schema", () => {
  it("accepts numeric fields encoded as strings", () => {
    const parsed = triageBodySchema.parse({ symptoms: "earache", age: "12" });
    expect(parsed.age).toBe(12);
    expect(parsed.pregnancyStatus).toBe("unknown");
  });

  it("coerces optional duration when provided as string", () => {
    const parsed = triageBodySchema.parse({
      symptoms: "earache",
      age: 12,
      durationHours: "24"
    });
    expect(parsed.durationHours).toBe(24);
  });
});
