import {
  moderateTextWithML,
  mergeMLAndRuleFlags,
  applyWhitelistRules,
} from './detectors/mlText.js';
import { moderateImage } from './media/image.js';
import { moderateVideo } from './media/video.js';
import { calculateModerationScore, generateExplanation } from './scoring.js';
import { config } from './config.js';
import { Media, ModerationResult, Flag } from './schema.js';

// Import existing detectors
import { linksDetector } from './detectors/links.js';
import { piiDetector } from './detectors/pii.js';
import { spamDetector } from './detectors/spam.js';
import { runAllDetectors } from './detectors/index.js';

export interface ExtendedModerationOptions {
  platform?: 'generic' | 'x' | 'instagram' | 'tiktok';
  context?: {
    account?: {
      id?: string;
      createdAt?: string;
      isVerified?: boolean;
      priorViolations?: number;
    };
    postingHistory?: {
      last24hCount?: number;
      lastHourCount?: number;
    };
    crossPlatform?: {
      similarPostHashes?: string[];
    };
    network?: {
      similarTextClusterIds?: string[];
    };
    engagement?: {
      replies?: number;
      likes?: number;
      uniqueRepliers?: number;
    };
  };
}

/**
 * Main moderation engine that combines rule-based, ML, and context features
 */
export async function moderateContent(
  text?: string,
  media?: Media,
  options: ExtendedModerationOptions = {}
): Promise<ModerationResult> {
  const startTime = Date.now();
  const allFlags: Flag[] = [];
  const debug: ModerationResult['debug'] = {
    providers: {},
    timings: {},
  };

  try {
    // 1. Rule-based text moderation (existing detectors)
    if (text) {
      const ruleFlags = await runRuleBasedDetectors(text);
      allFlags.push(...ruleFlags);
    }

    // 2. ML text moderation (if enabled)
    if (text && config.enableLLM) {
      const mlResult = await moderateTextWithML(text);
      debug.providers[mlResult.provider] = mlResult.enabled
        ? 'enabled'
        : 'disabled';

      if (mlResult.enabled && mlResult.flags.length > 0) {
        // Merge ML flags with rule-based flags
        const mergedFlags = mergeMLAndRuleFlags(mlResult.flags, allFlags);
        allFlags.length = 0; // Clear and replace
        allFlags.push(...mergedFlags);
      }
    } else if (text) {
      debug.providers.ml = 'disabled';
    }

    // 3. Media moderation (if provided)
    if (media) {
      let mediaFlags: Flag[] = [];

      if (media.type === 'image') {
        const imageResult = await moderateImage(media);
        mediaFlags = imageResult.flags;
        debug.providers.vision = config.enableRekognition
          ? 'enabled'
          : 'disabled';
      } else if (media.type === 'video') {
        const videoResult = await moderateVideo(media);
        mediaFlags = videoResult.flags;
        debug.providers.vision = config.enableRekognition
          ? 'enabled'
          : 'disabled';
      }

      allFlags.push(...mediaFlags);
    }

    // 4. Apply whitelist rules to reduce false positives
    if (text) {
      const whitelistedFlags = applyWhitelistRules(allFlags, text);
      allFlags.length = 0;
      allFlags.push(...whitelistedFlags);
    }

    // 5. Calculate final score and label
    const scoringResult = calculateModerationScore(allFlags, options.context);

    // 6. Update debug info
    debug.timings.total = Date.now() - startTime;
    if (scoringResult.debug) {
      Object.assign(debug, scoringResult.debug);
    }

    return {
      score: scoringResult.score,
      label: scoringResult.label,
      platform: options.platform || 'generic',
      flags: scoringResult.flags,
      debug: config.debug ? debug : undefined,
    };
  } catch (error) {
    console.error('Moderation engine error:', error);

    // Return error result
    return {
      score: 100, // High score for errors
      label: 'block',
      platform: options.platform || 'generic',
      flags: [
        {
          source: 'rule',
          category: 'error',
          weight: 100,
          message: `Moderation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      debug: config.debug ? debug : undefined,
    };
  }
}

/**
 * Run existing rule-based detectors
 */
async function runRuleBasedDetectors(text: string): Promise<Flag[]> {
  const flags: Flag[] = [];

  // Links detection
  const linkFlags = linksDetector(text);
  if (linkFlags.length > 0) {
    flags.push(...linkFlags);
  }

  // PII detection
  const piiFlags = piiDetector(text);
  if (piiFlags.length > 0) {
    flags.push(...piiFlags);
  }

  // Spam detection
  const spamFlags = spamDetector(text);
  if (spamFlags.length > 0) {
    flags.push(...spamFlags);
  }

  // Wordlist detection using the unified detector
  const wordlistFlags = runAllDetectors(text);
  if (wordlistFlags.length > 0) {
    flags.push(
      ...wordlistFlags.map((flag) => ({
        ...flag,
        source: 'rule' as const,
      }))
    );
  }

  return flags;
}

/**
 * Legacy function for backward compatibility
 */
export async function moderateText(
  text: string,
  options: { platform?: 'generic' | 'x' | 'instagram' | 'tiktok' } = {}
): Promise<ModerationResult> {
  return moderateContent(text, undefined, options);
}

/**
 * Generate human-readable explanation of moderation decision
 */
export function explainModeration(result: ModerationResult): string {
  return generateExplanation({
    score: result.score,
    label: result.label,
    flags: result.flags,
  });
}
