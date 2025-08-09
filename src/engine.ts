import type { Flag, ModerationOptions, ModerationResult } from './types.js';
import { runAllDetectors } from './detectors/index.js';
import { PLATFORMS } from './platforms.js';

function aggregateScore(
  flags: Flag[],
  platform: NonNullable<ModerationOptions['platform']>
): number {
  const cfg = PLATFORMS[platform] ?? PLATFORMS['generic'];
  const score = flags.reduce((acc, f) => {
    const mult = cfg.weights[f.category] ?? 1;
    return acc + f.weight * mult;
  }, 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function labelFromScore(
  score: number,
  platform: NonNullable<ModerationOptions['platform']>
): 'allow' | 'review' | 'block' {
  const t = (PLATFORMS[platform] ?? PLATFORMS['generic']).thresholds;
  if (score >= t.block) return 'block';
  if (score >= t.review) return 'review';
  return 'allow';
}

export function moderateText(
  text: string,
  opts: ModerationOptions = {}
): ModerationResult {
  const platform = opts.platform ?? 'generic';
  const flags = runAllDetectors(text);
  const score = aggregateScore(flags, platform);
  const label = labelFromScore(score, platform);
  return { score, label, platform, flags };
}
