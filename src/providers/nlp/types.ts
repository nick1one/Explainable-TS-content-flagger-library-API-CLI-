import { ProviderResult } from '../../schema.js';

export interface NLPProvider {
  /**
   * Check if the provider is available and enabled
   */
  isEnabled(): boolean;

  /**
   * Moderate text content
   */
  moderateText(text: string): Promise<ProviderResult>;

  /**
   * Get provider name
   */
  getName(): string;
}

export interface NLPProviderConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Standard categories for NLP providers
 */
export const NLP_CATEGORIES = {
  HATE: 'hate',
  HARASSMENT: 'harassment',
  SEXUAL: 'sexual',
  VIOLENCE: 'violence',
  SELF_HARM: 'self_harm',
  SCAM: 'scam',
  SPAM: 'spam',
  MISINFORMATION: 'misinformation',
  TOXIC: 'toxic',
} as const;

export type NLPCategory = (typeof NLP_CATEGORIES)[keyof typeof NLP_CATEGORIES];

/**
 * Map provider-specific categories to our standard categories
 */
export function mapProviderCategory(
  providerCategory: string,
  provider: string
): NLPCategory | string {
  const categoryMaps: Record<string, Record<string, NLPCategory | string>> = {
    openai: {
      hate: NLP_CATEGORIES.HATE,
      harassment: NLP_CATEGORIES.HARASSMENT,
      sexual: NLP_CATEGORIES.SEXUAL,
      violence: NLP_CATEGORIES.VIOLENCE,
      self_harm: NLP_CATEGORIES.SELF_HARM,
      scam: NLP_CATEGORIES.SCAM,
      spam: NLP_CATEGORIES.SPAM,
    },
    anthropic: {
      hate: NLP_CATEGORIES.HATE,
      harassment: NLP_CATEGORIES.HARASSMENT,
      sexual: NLP_CATEGORIES.SEXUAL,
      violence: NLP_CATEGORIES.VIOLENCE,
      self_harm: NLP_CATEGORIES.SELF_HARM,
      scam: NLP_CATEGORIES.SCAM,
      spam: NLP_CATEGORIES.SPAM,
    },
    perspective: {
      TOXICITY: NLP_CATEGORIES.TOXIC,
      SEVERE_TOXICITY: NLP_CATEGORIES.TOXIC,
      IDENTITY_ATTACK: NLP_CATEGORIES.HARASSMENT,
      INSULT: NLP_CATEGORIES.HARASSMENT,
      PROFANITY: NLP_CATEGORIES.TOXIC,
      THREAT: NLP_CATEGORIES.VIOLENCE,
      SEXUALLY_EXPLICIT: NLP_CATEGORIES.SEXUAL,
    },
  };

  const providerMap = categoryMaps[provider];
  if (providerMap && providerMap[providerCategory]) {
    return providerMap[providerCategory];
  }

  // Return original category if no mapping found
  return providerCategory.toLowerCase();
}
