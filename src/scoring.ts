import { config } from './config.js';
import { Flag } from './schema.js';
import {
  analyzeAccountFeatures,
  type AccountFeatures,
} from './features/account.js';
import {
  analyzeTemporalFeatures,
  type TemporalFeatures,
} from './features/temporal.js';
import {
  analyzeNetworkFeatures,
  type NetworkFeatures,
} from './features/network.js';
import {
  analyzeEngagementFeatures,
  type EngagementFeatures,
} from './features/engagement.js';
import { Context } from './schema.js';

export interface ScoringResult {
  score: number;
  label: 'allow' | 'review' | 'block';
  flags: Flag[];
  debug?: {
    providers: Record<string, 'enabled' | 'disabled'>;
    timings: Record<string, number>;
    featureMultipliers: Record<string, number>;
  };
}

/**
 * Calculate final moderation score and label
 */
export function calculateModerationScore(
  flags: Flag[],
  context?: Context
): ScoringResult {
  const startTime = Date.now();
  const debug: ScoringResult['debug'] = {
    providers: {},
    timings: {},
    featureMultipliers: {},
  };

  // Apply source-specific weights
  const weightedFlags = flags.map((flag) => ({
    ...flag,
    adjustedWeight: flag.weight * (config.weights[flag.source] || 1.0),
  }));

  // Calculate base score from flags
  let baseScore = 0;
  const sourceScores: Record<string, number> = {};

  for (const flag of weightedFlags) {
    const sourceScore = flag.adjustedWeight;
    sourceScores[flag.source] = (sourceScores[flag.source] || 0) + sourceScore;
    baseScore += sourceScore;
  }

  // Apply feature multipliers if context is provided
  let finalScore = baseScore;
  let featureMultipliers: Record<string, number> = {};
  const allFlags = [...weightedFlags];

  if (context) {
    const featureResults = analyzeContextFeatures(context);
    featureMultipliers = featureResults.multipliers;

    // Apply multipliers to final score
    for (const [, multiplier] of Object.entries(featureMultipliers)) {
      finalScore *= multiplier;
    }

    // Add feature flags with adjustedWeight
    allFlags.push(
      ...featureResults.flags.map((flag) => ({
        ...flag,
        adjustedWeight: flag.weight * (config.weights[flag.source] || 1.0),
      }))
    );
  }

  // Cap the score
  finalScore = Math.min(Math.max(finalScore, 0), 100);

  // Determine label based on thresholds
  let label: 'allow' | 'review' | 'block';
  if (finalScore >= config.thresholds.block) {
    label = 'block';
  } else if (finalScore >= config.thresholds.review) {
    label = 'review';
  } else {
    label = 'allow';
  }

  // Update debug info
  debug.timings.total = Date.now() - startTime;
  debug.featureMultipliers = featureMultipliers;

  return {
    score: Math.round(finalScore),
    label,
    flags: allFlags,
    debug: config.debug ? debug : undefined,
  };
}

/**
 * Analyze context features and return flags and multipliers
 */
function analyzeContextFeatures(context: Context): {
  flags: Flag[];
  multipliers: Record<string, number>;
} {
  const flags: Flag[] = [];
  const multipliers: Record<string, number> = {};

  // Account features
  if (context.account) {
    const accountResult = analyzeAccountFeatures(context.account);
    flags.push(...accountResult.flags);
    multipliers.account = getAccountRiskMultiplier(accountResult.features);
  }

  // Temporal features
  if (context.postingHistory) {
    const temporalResult = analyzeTemporalFeatures(context.postingHistory);
    flags.push(...temporalResult.flags);
    multipliers.temporal = getTemporalRiskMultiplier(temporalResult.features);
  }

  // Network features
  if (context.network || context.crossPlatform) {
    const networkResult = analyzeNetworkFeatures(
      context.network || { similarTextClusterIds: [] },
      context.crossPlatform || { similarPostHashes: [] }
    );
    flags.push(...networkResult.flags);
    multipliers.network = getNetworkRiskMultiplier(networkResult.features);
  }

  // Engagement features
  if (context.engagement) {
    const engagementResult = analyzeEngagementFeatures(context.engagement);
    flags.push(...engagementResult.flags);
    multipliers.engagement = getEngagementRiskMultiplier(
      engagementResult.features
    );
  }

  return { flags, multipliers };
}

/**
 * Get account risk multiplier
 */
function getAccountRiskMultiplier(features: AccountFeatures): number {
  let multiplier = 1.0;

  if (features.isNewAccount) {
    multiplier *= 1.5;
  }

  if (features.hasPriorViolations) {
    multiplier *= 1 + features.violationCount * 0.2;
  }

  return Math.min(multiplier, 3.0);
}

/**
 * Get temporal risk multiplier
 */
function getTemporalRiskMultiplier(features: TemporalFeatures): number {
  let multiplier = 1.0;

  if (features.burstHour) {
    multiplier *= 1.3;
  }

  if (features.burstDay) {
    multiplier *= 1.2;
  }

  return Math.min(multiplier, 2.0);
}

/**
 * Get network risk multiplier
 */
function getNetworkRiskMultiplier(features: NetworkFeatures): number {
  let multiplier = 1.0;

  if (features.hasSimilarContent) {
    multiplier *= 1 + features.similarClusterCount * 0.1;
  }

  if (features.hasCrossPlatformMatches) {
    multiplier *= 1 + features.crossPlatformMatchCount * 0.2;
  }

  return Math.min(multiplier, 2.5);
}

/**
 * Get engagement risk multiplier
 */
function getEngagementRiskMultiplier(features: EngagementFeatures): number {
  let multiplier = 1.0;

  if (features.isLowQuality) {
    multiplier *= 1.3;
  }

  if (features.isHighQuality) {
    multiplier *= 0.8;
  }

  return Math.max(multiplier, 0.5);
}

/**
 * Generate explainable summary of moderation decision
 */
export function generateExplanation(result: ScoringResult): string {
  const { score, label, flags } = result;

  let explanation = `Moderation result: ${label.toUpperCase()} (Score: ${score}/100)\n\n`;

  if (flags.length === 0) {
    explanation += 'No issues detected.';
    return explanation;
  }

  // Group flags by source
  const flagsBySource = flags.reduce(
    (acc, flag) => {
      if (!acc[flag.source]) acc[flag.source] = [];
      acc[flag.source].push(flag);
      return acc;
    },
    {} as Record<string, Flag[]>
  );

  for (const [source, sourceFlags] of Object.entries(flagsBySource)) {
    explanation += `${source.toUpperCase()} DETECTIONS:\n`;

    for (const flag of sourceFlags) {
      const confidence = flag.confidence
        ? ` (${(flag.confidence * 100).toFixed(1)}% confidence)`
        : '';
      explanation += `• ${flag.message}${confidence} [Weight: ${flag.weight}]\n`;
    }
    explanation += '\n';
  }

  return explanation.trim();
}
