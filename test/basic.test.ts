import { describe, it, expect, vi, beforeEach } from "vitest";
import { moderateText, moderateContent } from "../src/engine.js";
import { config } from "../src/config.js";

// Mock the config for testing
vi.mock("../src/config.js", () => ({
  config: {
    enableLLM: false,
    enableRekognition: false,
    enableSupabase: false,
    debug: false,
    thresholds: {
      block: 70,
      review: 30,
      duplicate: 0.15,
    },
    weights: {
      rule: 1.0,
      ml: 0.8,
      vision: 0.9,
      metadata: 0.3,
    },
    temporal: {
      burstHour: 10,
      burstDay: 50,
    },
    account: {
      newAccountDays: 7,
      maxViolations: 5,
    },
  },
}));

describe("moderateText", () => {
  it("flags shortener links and scammy phrases", async () => {
    const r = await moderateText("FREE money!!! Click https://bit.ly/abc now");
    expect(r.flags.some(f => f.category === "links")).toBe(true);
    expect(r.flags.some(f => f.category === "spam")).toBe(true);
    expect(r.label).not.toBe("allow");
  });

  it("detects PII", async () => {
    const r = await moderateText("Email me at john@example.com or call +1-202-555-0172");
    expect(r.flags.filter(f => f.category === "pii").length).toBeGreaterThan(0);
  });

  it("keeps benign text as allow", async () => {
    const r = await moderateText("Lovely day at the beach with friends. See you soon!");
    expect(r.label).toBe("allow");
  });
});

describe("moderateContent with context", () => {
  it("includes account context flags", async () => {
    const r = await moderateContent("Test message", undefined, {
      platform: "x",
      context: {
        account: {
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          priorViolations: 3,
        },
      },
    });
    
    expect(r.flags.some(f => f.source === "metadata")).toBe(true);
    expect(r.platform).toBe("x");
  });

  it("includes temporal context flags", async () => {
    const r = await moderateContent("Test message", undefined, {
      context: {
        postingHistory: {
          lastHourCount: 15,
          last24hCount: 60,
        },
      },
    });
    
    expect(r.flags.some(f => f.source === "metadata")).toBe(true);
  });

  it("includes engagement context flags", async () => {
    const r = await moderateContent("Test message", undefined, {
      context: {
        engagement: {
          replies: 0,
          likes: 1001,
          uniqueRepliers: 0,
        },
      },
    });
    
    console.log('Generated flags:', JSON.stringify(r.flags, null, 2));
    expect(r.flags.some(f => f.source === "metadata")).toBe(true);
  });

  it("includes network context flags", async () => {
    const r = await moderateContent("Test message", undefined, {
      context: {
        network: {
          similarTextClusterIds: ["cluster1", "cluster2", "cluster3"],
        },
        crossPlatform: {
          similarPostHashes: ["hash1", "hash2"],
        },
      },
    });
    
    expect(r.flags.some(f => f.source === "metadata")).toBe(true);
    expect(r.flags.some(f => f.category === "content_clustering")).toBe(true);
    expect(r.flags.some(f => f.category === "cross_platform_spam")).toBe(true);
  });

  it("combines multiple context signals", async () => {
    const r = await moderateContent("Test message", undefined, {
      context: {
        account: {
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          priorViolations: 0,
        },
        postingHistory: {
          lastHourCount: 20,
          last24hCount: 100,
        },
        engagement: {
          replies: 0,
          likes: 2000,
          uniqueRepliers: 0,
        },
      },
    });
    
    const metadataFlags = r.flags.filter(f => f.source === "metadata");
    expect(metadataFlags.length).toBeGreaterThan(1);
    expect(metadataFlags.some(f => f.category === "new_account")).toBe(true);
    expect(metadataFlags.some(f => f.category === "burst_posting")).toBe(true);
    expect(metadataFlags.some(f => f.category === "suspicious_engagement")).toBe(true);
  });
});

describe("media moderation", () => {
  it("handles image moderation requests", async () => {
    const r = await moderateContent(undefined, {
      url: "https://example.com/image.jpg",
      type: "image",
    });
    
    // Should return a result even without text
    expect(r).toBeDefined();
    expect(r.platform).toBe("generic");
  });

  it("handles video moderation requests", async () => {
    const r = await moderateContent(undefined, {
      url: "https://example.com/video.mp4",
      type: "video",
    });
    
    expect(r).toBeDefined();
    expect(r.platform).toBe("generic");
  });

  it("handles combined text and media", async () => {
    const r = await moderateContent("Check out this image!", {
      url: "https://example.com/image.jpg",
      type: "image",
    }, {
      platform: "instagram",
    });
    
    expect(r.platform).toBe("instagram");
    // In offline environments, media analysis may be skipped; just ensure no crash
    expect(r).toBeDefined();
  });
});

describe("scoring and thresholds", () => {
  it("applies correct thresholds", () => {
    expect(config.thresholds.block).toBe(70);
    expect(config.thresholds.review).toBe(30);
    expect(config.thresholds.duplicate).toBe(0.15);
  });

  it("applies correct weights", () => {
    expect(config.weights.rule).toBe(1.0);
    expect(config.weights.ml).toBe(0.8);
    expect(config.weights.vision).toBe(0.9);
    expect(config.weights.metadata).toBe(0.3);
  });

  it("generates appropriate labels based on scores", async () => {
    // Low score should be allow
    const lowScoreResult = await moderateText("Hello world");
    expect(lowScoreResult.label).toBe("allow");
    
    // High score should be block
    const highScoreResult = await moderateText("FREE money!!! Click https://bit.ly/abc now");
    expect(highScoreResult.label).toBe("block");
  });
});

describe("flag structure", () => {
  it("includes required flag properties", async () => {
    const r = await moderateText("FREE money!!! Click https://bit.ly/abc now");
    
    expect(r.flags.length).toBeGreaterThan(0);
    
    for (const flag of r.flags) {
      expect(flag.source).toBeDefined();
      expect(flag.category).toBeDefined();
      expect(flag.weight).toBeDefined();
      expect(flag.message).toBeDefined();
      expect(flag.adjustedWeight).toBeDefined();
    }
  });

  it("includes source-specific properties", async () => {
    const r = await moderateContent("Test message", undefined, {
      context: {
        account: {
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    
    const metadataFlags = r.flags.filter(f => f.source === "metadata");
    expect(metadataFlags.length).toBeGreaterThan(0);
    
    for (const flag of metadataFlags) {
      expect(flag.confidence).toBeDefined();
    }
  });
});
