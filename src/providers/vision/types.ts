import { VisionProviderResult } from '../../schema.js';

export interface VisionProvider {
  /**
   * Check if the provider is available and enabled
   */
  isEnabled(): boolean;

  /**
   * Moderate image content
   */
  moderateImage(imageBuffer: Buffer): Promise<VisionProviderResult>;

  /**
   * Moderate video content (extract frames and moderate each)
   */
  moderateVideo(videoBuffer: Buffer): Promise<VisionProviderResult>;

  /**
   * Get provider name
   */
  getName(): string;
}

export interface VisionProviderConfig {
  apiKey?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  minConfidence?: number;
}

/**
 * Standard categories for vision providers
 */
export const VISION_CATEGORIES = {
  NSFW: 'nsfw',
  VIOLENCE: 'violence',
  HATE: 'hate',
  DRUGS: 'drugs',
  GAMBLING: 'gambling',
  TOBACCO: 'tobacco',
  PROFANITY: 'profanity',
  DISTURBING: 'disturbing',
  WEAPONS: 'weapons',
  BLOOD: 'blood',
} as const;

export type VisionCategory =
  (typeof VISION_CATEGORIES)[keyof typeof VISION_CATEGORIES];

/**
 * Map provider-specific categories to our standard categories
 */
export function mapVisionCategory(
  providerCategory: string,
  provider: string
): VisionCategory | string {
  const categoryMaps: Record<
    string,
    Record<string, VisionCategory | string>
  > = {
    'aws-rekognition': {
      'Explicit Nudity': VISION_CATEGORIES.NSFW,
      Violence: VISION_CATEGORIES.VIOLENCE,
      'Hate Symbols': VISION_CATEGORIES.HATE,
      Drugs: VISION_CATEGORIES.DRUGS,
      Gambling: VISION_CATEGORIES.GAMBLING,
      Tobacco: VISION_CATEGORIES.TOBACCO,
      'Rude Gestures': VISION_CATEGORIES.PROFANITY,
      'Visually Disturbing': VISION_CATEGORIES.DISTURBING,
      Weapons: VISION_CATEGORIES.WEAPONS,
      Blood: VISION_CATEGORIES.BLOOD,
    },
  };

  const providerMap = categoryMaps[provider];
  if (providerMap && providerMap[providerCategory]) {
    return providerMap[providerCategory];
  }

  // Return original category if no mapping found
  return providerCategory.toLowerCase();
}
