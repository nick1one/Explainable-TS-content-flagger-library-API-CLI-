import { config } from '../config.js';
import { Flag } from '../schema.js';
import { AnthropicProvider } from '../providers/nlp/anthropic.js';

export interface MLTextResult {
  flags: Flag[];
  provider: string;
  enabled: boolean;
}

/**
 * ML-based text moderation using NLP providers
 */
export async function moderateTextWithML(text: string): Promise<MLTextResult> {
  if (!config.enableLLM) {
    return {
      flags: [],
      provider: 'none',
      enabled: false,
    };
  }

  try {
    // Use Anthropic as the default provider
    const provider = new AnthropicProvider();

    if (!provider.isEnabled()) {
      return {
        flags: [],
        provider: provider.getName(),
        enabled: false,
      };
    }

    const result = await provider.moderateText(text);

    if (!result.enabled || !result.categories) {
      return {
        flags: [],
        provider: provider.getName(),
        enabled: false,
      };
    }

    // Convert provider results to flags
    const flags: Flag[] = [];
    for (const [category, detection] of Object.entries(result.categories)) {
      if (detection.confidence > 0.6) {
        // Only flag high-confidence results
        flags.push({
          source: 'ml',
          category,
          weight: Math.round(detection.confidence * 40), // Scale confidence to weight
          message: `ML detection: ${detection.label} (${(detection.confidence * 100).toFixed(1)}%)`,
          confidence: detection.confidence,
          provider: provider.getName(),
        });
      }
    }

    return {
      flags,
      provider: provider.getName(),
      enabled: true,
    };
  } catch (error) {
    console.warn('ML text moderation failed:', error);
    return {
      flags: [],
      provider: 'error',
      enabled: false,
    };
  }
}

/**
 * Merge ML flags with rule-based flags, handling conflicts
 */
export function mergeMLAndRuleFlags(
  mlFlags: Flag[],
  ruleFlags: Flag[]
): Flag[] {
  const merged: Flag[] = [...ruleFlags];
  const ruleCategories = new Set(ruleFlags.map((f) => f.category));

  for (const mlFlag of mlFlags) {
    // If rule-based detection already flagged this category, adjust ML weight
    if (ruleCategories.has(mlFlag.category)) {
      // Reduce ML weight when rule-based already detected it
      const adjustedFlag = {
        ...mlFlag,
        weight: Math.round(mlFlag.weight * 0.7), // Reduce weight by 30%
        message: `${mlFlag.message} (reinforced by rules)`,
      };
      merged.push(adjustedFlag);
    } else {
      // Add new ML-only detection
      merged.push(mlFlag);
    }
  }

  return merged;
}

/**
 * Apply whitelist rules to reduce false positives
 */
export function applyWhitelistRules(flags: Flag[], text: string): Flag[] {
  const whitelistPatterns = [
    // Educational content about scams
    {
      pattern: /\b(discuss|discussion|warning|awareness|education|learn)\b/i,
      categories: ['scam'],
    },
    // News reporting
    {
      pattern: /\b(news|report|article|coverage|investigation)\b/i,
      categories: ['violence', 'hate'],
    },
    // Academic/research context
    {
      pattern: /\b(research|study|analysis|paper|academic|university)\b/i,
      categories: ['sexual', 'violence'],
    },
  ];

  return flags.filter((flag) => {
    for (const whitelist of whitelistPatterns) {
      if (
        whitelist.categories.includes(flag.category) &&
        whitelist.pattern.test(text)
      ) {
        // Reduce weight for whitelisted content
        flag.weight = Math.round(flag.weight * 0.5);
        flag.message += ' (whitelisted context)';
        return true; // Keep but reduce weight
      }
    }
    return true;
  });
}
