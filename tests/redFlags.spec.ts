import { describe, it, expect } from "vitest";
import { detectRedFlags, recommendVenue } from "../src/lib/redFlags.js";

describe("red flags", () => {
  it("detects chest pain as red flag", () => {
    expect(detectRedFlags("I have chest pain", { age: 50 })).toBe(true);
  });

  it("non red flag routes to urgent care by default", () => {
    expect(recommendVenue("ear pain", { age: 12 })).toBe("urgent_care");
  });
});


