import { Network, CrossPlatform, Flag } from '../schema.js';

export interface NetworkFeatures {
  hasSimilarContent: boolean;
  similarClusterCount: number;
  hasCrossPlatformMatches: boolean;
  crossPlatformMatchCount: number;
}

/**
 * Analyze network signals and generate metadata flags
 */
export function analyzeNetworkFeatures(
  network: Network,
  crossPlatform: CrossPlatform
): {
  features: NetworkFeatures;
  flags: Flag[];
} {
  const flags: Flag[] = [];
  const features: NetworkFeatures = {
    hasSimilarContent: false,
    similarClusterCount: 0,
    hasCrossPlatformMatches: false,
    crossPlatformMatchCount: 0,
  };

  // Analyze similar text clusters
  if (
    network.similarTextClusterIds &&
    network.similarTextClusterIds.length > 0
  ) {
    features.hasSimilarContent = true;
    features.similarClusterCount = network.similarTextClusterIds.length;

    if (features.similarClusterCount > 5) {
      flags.push({
        source: 'metadata',
        category: 'content_clustering',
        weight: 25,
        message: `Content appears in ${features.similarClusterCount} similar clusters`,
        confidence: 1.0,
      });
    } else if (features.similarClusterCount > 2) {
      flags.push({
        source: 'metadata',
        category: 'content_clustering',
        weight: 15,
        message: `Content appears in ${features.similarClusterCount} similar clusters`,
        confidence: 1.0,
      });
    }
  }

  // Analyze cross-platform matches
  if (
    crossPlatform.similarPostHashes &&
    crossPlatform.similarPostHashes.length > 0
  ) {
    features.hasCrossPlatformMatches = true;
    features.crossPlatformMatchCount = crossPlatform.similarPostHashes.length;

    if (features.crossPlatformMatchCount > 3) {
      flags.push({
        source: 'metadata',
        category: 'cross_platform_spam',
        weight: 30,
        message: `Content detected across ${features.crossPlatformMatchCount} platforms`,
        confidence: 1.0,
      });
    } else if (features.crossPlatformMatchCount > 1) {
      flags.push({
        source: 'metadata',
        category: 'cross_platform_spam',
        weight: 20,
        message: `Content detected across ${features.crossPlatformMatchCount} platforms`,
        confidence: 1.0,
      });
    }
  }

  return { features, flags };
}

/**
 * Get network risk multiplier based on features
 */
export function getNetworkRiskMultiplier(features: NetworkFeatures): number {
  let multiplier = 1.0;

  if (features.hasSimilarContent) {
    multiplier *= 1 + features.similarClusterCount * 0.1;
  }

  if (features.hasCrossPlatformMatches) {
    multiplier *= 1 + features.crossPlatformMatchCount * 0.2;
  }

  return Math.min(multiplier, 2.5); // Cap at 2.5x
}

/**
 * Check if network signals suggest coordinated activity
 */
export function isCoordinatedActivity(features: NetworkFeatures): boolean {
  return features.hasSimilarContent && features.hasCrossPlatformMatches;
}

/**
 * Simple locality-sensitive hashing for text similarity
 * This is a basic implementation - in production you might use more sophisticated LSH
 */
export function computeTextHash(text: string): string {
  // Simple hash based on character frequency
  const charCount: Record<string, number> = {};
  for (const char of text.toLowerCase()) {
    if (char.match(/[a-z0-9]/)) {
      charCount[char] = (charCount[char] || 0) + 1;
    }
  }

  // Create a simple hash from character frequencies
  const sorted = Object.entries(charCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10) // Top 10 most frequent characters
    .map(([char, count]) => `${char}${count}`)
    .join('');

  return sorted.padEnd(20, '0');
}

/**
 * Check if two text hashes are similar
 */
export function areTextHashesSimilar(
  hash1: string,
  hash2: string,
  threshold: number = 0.7
): boolean {
  let matches = 0;
  const minLength = Math.min(hash1.length, hash2.length);

  for (let i = 0; i < minLength; i++) {
    if (hash1[i] === hash2[i]) {
      matches++;
    }
  }

  return matches / minLength >= threshold;
}
