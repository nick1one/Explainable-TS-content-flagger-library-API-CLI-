import { config } from '../config.js';
import { PostingHistory, Flag } from '../schema.js';

export interface TemporalFeatures {
  isBursting: boolean;
  burstHour: boolean;
  burstDay: boolean;
  postFrequency: number; // posts per hour
  timeOfDay: number; // 0-23 hour
}

/**
 * Analyze temporal patterns and generate metadata flags
 */
export function analyzeTemporalFeatures(postingHistory: PostingHistory): {
  features: TemporalFeatures;
  flags: Flag[];
} {
  const flags: Flag[] = [];
  const features: TemporalFeatures = {
    isBursting: false,
    burstHour: false,
    burstDay: false,
    postFrequency: 0,
    timeOfDay: new Date().getHours(),
  };

  // Analyze posting frequency
  if (postingHistory.lastHourCount && postingHistory.last24hCount) {
    features.postFrequency = postingHistory.lastHourCount;

    // Check for burst posting in the last hour
    if (postingHistory.lastHourCount > config.temporal.burstHour) {
      features.burstHour = true;
      features.isBursting = true;
      flags.push({
        source: 'metadata',
        category: 'burst_posting',
        weight: 20,
        message: `High posting frequency: ${postingHistory.lastHourCount} posts in the last hour`,
        confidence: 1.0,
      });
    }

    // Check for burst posting in the last 24 hours
    if (postingHistory.last24hCount > config.temporal.burstDay) {
      features.burstDay = true;
      features.isBursting = true;
      flags.push({
        source: 'metadata',
        category: 'high_volume',
        weight: 15,
        message: `High volume posting: ${postingHistory.last24hCount} posts in the last 24 hours`,
        confidence: 1.0,
      });
    }

    // Calculate posts per hour
    features.postFrequency = postingHistory.last24hCount / 24;
  }

  // Time-of-day analysis (optional - could detect unusual posting times)
  const hour = features.timeOfDay;
  if (hour >= 0 && hour <= 5) {
    // Very early morning posting might be suspicious
    flags.push({
      source: 'metadata',
      category: 'unusual_timing',
      weight: 5,
      message: `Unusual posting time: ${hour}:00`,
      confidence: 0.7,
    });
  }

  return { features, flags };
}

/**
 * Get temporal risk multiplier based on features
 */
export function getTemporalRiskMultiplier(features: TemporalFeatures): number {
  let multiplier = 1.0;

  if (features.burstHour) {
    multiplier *= 1.3;
  }

  if (features.burstDay) {
    multiplier *= 1.2;
  }

  if (features.postFrequency > 10) {
    multiplier *= 1.1;
  }

  return Math.min(multiplier, 2.0); // Cap at 2x
}

/**
 * Check if posting pattern suggests automation
 */
export function isAutomatedPosting(features: TemporalFeatures): boolean {
  return features.burstHour && features.postFrequency > 5;
}
