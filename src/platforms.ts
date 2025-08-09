export type PlatformConfig = {
  weights: Partial<Record<import('./types.js').Category, number>>;
  thresholds: { review: number; block: number };
};

export const PLATFORMS: Record<string, PlatformConfig> = {
  generic: {
    weights: {},
    thresholds: { review: 25, block: 70 },
  },
  x: {
    weights: { links: 1.1, spam: 1.2 },
    thresholds: { review: 25, block: 70 },
  },
  instagram: {
    weights: { sexual: 1.2 },
    thresholds: { review: 25, block: 65 },
  },
  tiktok: {
    weights: {},
    thresholds: { review: 25, block: 65 },
  },
};
