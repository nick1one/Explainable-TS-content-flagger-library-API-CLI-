import { config } from '../../config.js';
import {
  NLPProvider,
  NLPProviderConfig,
  mapProviderCategory,
} from './types.js';
import { ProviderResult } from '../../schema.js';

export class OpenAIProvider implements NLPProvider {
  private config: NLPProviderConfig;

  constructor(providerConfig?: NLPProviderConfig) {
    this.config = {
      apiKey: config.openai.apiKey,
      model: config.openai.model,
      maxTokens: config.openai.maxTokens,
      temperature: 0.1, // Low temperature for consistent moderation
      ...providerConfig,
    };
  }

  isEnabled(): boolean {
    return !!this.config.apiKey;
  }

  getName(): string {
    return 'openai';
  }

  async moderateText(text: string): Promise<ProviderResult> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        categories: {},
        error: 'OpenAI API key not configured',
      };
    }

    try {
      // Dynamic import to avoid hard dependency
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: this.config.apiKey!,
      });

      const prompt = this.buildModerationPrompt(text);

      const response = await openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        max_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const moderationResult = this.parseModerationResponse(content);

      return {
        enabled: true,
        categories: moderationResult,
        raw: response,
      };
    } catch (error) {
      return {
        enabled: false,
        categories: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildModerationPrompt(text: string): string {
    return `You are a content moderation expert. Analyze the following text and identify any concerning content categories.

Text to analyze: "${text}"

Please respond with a JSON object where each key is a content category and the value is an object with:
- "confidence": a number between 0 and 1 indicating your confidence
- "label": a brief description of what you detected

Categories to check for:
- hate: hate speech, discrimination, bigotry
- harassment: bullying, intimidation, targeted abuse
- sexual: explicit sexual content, inappropriate sexual language
- violence: threats of violence, graphic violence, incitement
- self_harm: promotion of self-harm, suicide content
- scam: fraudulent schemes, phishing attempts
- spam: unwanted commercial content, repetitive posting
- misinformation: false claims, conspiracy theories

If no concerning content is found, return an empty object {}.

Response (JSON only):`;
  }

  private parseModerationResponse(
    response: string
  ): Record<string, { confidence: number; label: string }> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {};
      const parsed: unknown = JSON.parse(jsonMatch[0]);
      const categories: Record<string, { confidence: number; label: string }> = {};

      if (parsed && typeof parsed === 'object') {
        for (const [category, v] of Object.entries(parsed as Record<string, unknown>)) {
          const value = v as Record<string, unknown>;
          const confRaw = value.confidence;
          const labelRaw = value.label;
          const confidence = typeof confRaw === 'number' ? confRaw : Number(confRaw ?? 0);
          const label = typeof labelRaw === 'string' ? labelRaw : String(labelRaw ?? category);
          if (!Number.isNaN(confidence)) {
            const mappedCategory = mapProviderCategory(category, 'openai');
            categories[mappedCategory] = {
              confidence: Math.min(Math.max(confidence, 0), 1),
              label,
            };
          }
        }
      }

      return categories;
    } catch (error) {
      console.warn(
        'Failed to parse OpenAI moderation response:',
        error instanceof Error ? error.message : String(error)
      );
      return {};
    }
  }
}
