import { config } from '../../config.js';
import {
  NLPProvider,
  NLPProviderConfig,
  mapProviderCategory,
} from './types.js';
import { ProviderResult } from '../../schema.js';

export class PerspectiveProvider implements NLPProvider {
  private config: NLPProviderConfig;

  constructor(providerConfig?: NLPProviderConfig) {
    this.config = {
      apiKey: config.perspective.apiKey,
      ...providerConfig,
    };
  }

  isEnabled(): boolean {
    return !!this.config.apiKey;
  }

  getName(): string {
    return 'perspective';
  }

  async moderateText(text: string): Promise<ProviderResult> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        categories: {},
        error: 'Perspective API key not configured',
      };
    }

    try {
      const fetchLike = (
        globalThis as unknown as {
          fetch?: (
            input: string,
            init?: unknown
          ) => Promise<{
            ok: boolean;
            status: number;
            statusText: string;
            json: () => Promise<unknown>;
          }>;
        }
      ).fetch;
      if (!fetchLike) {
        throw new Error('Fetch API not available in this environment');
      }
      const response = await fetchLike(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comment: {
              text: text,
            },
            languages: ['en'],
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              IDENTITY_ATTACK: {},
              INSULT: {},
              PROFANITY: {},
              THREAT: {},
              SEXUALLY_EXPLICIT: {},
              FLIRTATION: {},
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Perspective API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const moderationResult = this.parsePerspectiveResponse(data);

      return {
        enabled: true,
        categories: moderationResult,
        raw: data,
      };
    } catch (error) {
      return {
        enabled: false,
        categories: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parsePerspectiveResponse(
    data: unknown
  ): Record<string, { confidence: number; label: string }> {
    const categories: Record<string, { confidence: number; label: string }> =
      {};

    const root =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : undefined;
    const attributeScores =
      root && typeof root.attributeScores === 'object'
        ? (root.attributeScores as Record<string, unknown>)
        : undefined;
    if (attributeScores) {
      for (const [attribute, scoreData] of Object.entries(attributeScores)) {
        const scoreObj =
          scoreData && typeof scoreData === 'object'
            ? (scoreData as Record<string, unknown>)
            : undefined;
        if (scoreObj && 'summaryScore' in scoreObj) {
          const summaryScore = scoreObj.summaryScore as unknown;
          const value =
            summaryScore && typeof summaryScore === 'object'
              ? (summaryScore as Record<string, unknown>).value
              : undefined;
          if (typeof value === 'number') {
            const mappedCategory = mapProviderCategory(
              attribute,
              'perspective'
            );
            categories[mappedCategory] = {
              confidence: value,
              label: this.getAttributeLabel(attribute),
            };
          }
        }
      }
    }

    return categories;
  }

  private getAttributeLabel(attribute: string): string {
    const labels: Record<string, string> = {
      TOXICITY: 'Toxic content',
      SEVERE_TOXICITY: 'Severely toxic content',
      IDENTITY_ATTACK: 'Identity attack',
      INSULT: 'Insulting content',
      PROFANITY: 'Profane language',
      THREAT: 'Threatening content',
      SEXUALLY_EXPLICIT: 'Sexually explicit content',
      FLIRTATION: 'Flirtatious content',
    };

    return labels[attribute] || attribute;
  }
}
