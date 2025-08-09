import { describe, it, expect } from "vitest";
import { moderateText } from "../src/engine.js";

describe("moderateText", () => {
  it("flags shortener links and scammy phrases", () => {
    const r = moderateText("FREE money!!! Click https://bit.ly/abc now");
    expect(r.flags.some(f => f.category === "links")).toBe(true);
    expect(r.flags.some(f => f.category === "spam")).toBe(true);
    expect(r.label).not.toBe("allow");
  });

  it("detects PII", () => {
    const r = moderateText("Email me at john@example.com or call +1-202-555-0172");
    expect(r.flags.filter(f => f.category === "pii").length).toBeGreaterThan(0);
  });

  it("keeps benign text as allow", () => {
    const r = moderateText("Lovely day at the beach with friends. See you soon!");
    expect(r.label).toBe("allow");
  });
});
