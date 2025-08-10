import { Engagement, Flag } from '../schema.js';

export interface EngagementFeatures {
  hasEngagement: boolean;
  engagementRatio: number; // replies / likes
  uniqueReplierRatio: number; // unique repliers / replies
  isLowQuality: boolean;
  isHighQuality: boolean;
}

/**
 * Analyze engagement patterns and generate metadata flags
 */
export function analyzeEngagementFeatures(engagement: Engagement): {
  features: EngagementFeatures;
  flags: Flag[];
} {
  const flags: Flag[] = [];
  const features: EngagementFeatures = {
    hasEngagement: false,
    engagementRatio: 0,
    uniqueReplierRatio: 0,
    isLowQuality: false,
    isHighQuality: false,
  };

  if (!engagement.replies && !engagement.likes) {
    return { features, flags };
  }

  features.hasEngagement = true;

  // Calculate engagement ratios
  if (engagement.replies && engagement.likes) {
    features.engagementRatio = engagement.replies / engagement.likes;

    // Low engagement ratio might indicate fake engagement
    if (features.engagementRatio < 0.01 && engagement.likes > 100) {
      features.isLowQuality = true;
      flags.push({
        source: 'metadata',
        category: 'low_engagement',
        weight: 15,
        message: `Low engagement ratio: ${(features.engagementRatio * 100).toFixed(2)}% replies/likes`,
        confidence: 0.8,
      });
    }
  }

  // Analyze unique repliers
  if (engagement.replies && engagement.uniqueRepliers) {
    features.uniqueReplierRatio =
      engagement.uniqueRepliers / engagement.replies;

    // High unique replier ratio suggests organic engagement
    if (features.uniqueReplierRatio > 0.8 && engagement.replies > 10) {
      features.isHighQuality = true;
      flags.push({
        source: 'metadata',
        category: 'high_quality_engagement',
        weight: -10, // Negative weight = trust boost
        message: `High quality engagement: ${(features.uniqueReplierRatio * 100).toFixed(1)}% unique repliers`,
        confidence: 0.9,
      });
    }

    // Low unique replier ratio might indicate coordinated activity
    if (features.uniqueReplierRatio < 0.3 && engagement.replies > 5) {
      flags.push({
        source: 'metadata',
        category: 'coordinated_engagement',
        weight: 20,
        message: `Low unique replier ratio: ${(features.uniqueReplierRatio * 100).toFixed(1)}% unique repliers`,
        confidence: 0.7,
      });
    }
  }

  // Check for suspicious engagement patterns
  if (engagement.likes || engagement.replies) {
    console.log('Debug: Checking suspicious patterns', {
      likes: engagement.likes,
      replies: engagement.replies,
    });

    // Very high likes with no replies might indicate fake engagement
    if (
      engagement.likes &&
      engagement.likes > 1000 &&
      engagement.replies === 0
    ) {
      console.log('Debug: Adding suspicious_engagement flag');
      flags.push({
        source: 'metadata',
        category: 'suspicious_engagement',
        weight: 25,
        message: 'High likes with no replies (possible fake engagement)',
        confidence: 0.8,
      });
    }

    // Very high replies with low likes might indicate coordinated activity
    if (
      engagement.replies &&
      engagement.replies > 50 &&
      engagement.likes &&
      engagement.likes < 10
    ) {
      flags.push({
        source: 'metadata',
        category: 'coordinated_engagement',
        weight: 20,
        message: 'High replies with low likes (possible coordinated activity)',
        confidence: 0.7,
      });
    }
  }

  return { features, flags };
}

/**
 * Get engagement risk multiplier based on features
 */
export function getEngagementRiskMultiplier(
  features: EngagementFeatures
): number {
  let multiplier = 1.0;

  if (features.isLowQuality) {
    multiplier *= 1.3;
  }

  if (features.isHighQuality) {
    multiplier *= 0.8; // Trust boost
  }

  return Math.max(multiplier, 0.5); // Floor at 0.5x
}

/**
 * Check if engagement patterns suggest organic vs. inorganic activity
 */
export function isOrganicEngagement(features: EngagementFeatures): boolean {
  return features.isHighQuality && !features.isLowQuality;
}

/**
 * Check if engagement patterns suggest bot activity
 */
export function isBotEngagement(features: EngagementFeatures): boolean {
  return features.isLowQuality && features.engagementRatio < 0.001;
}
