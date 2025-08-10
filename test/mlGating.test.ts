import { describe, it, expect, vi } from 'vitest';

// Enable LLM in config for this test, but mock provider behavior
vi.mock('../src/config.js', () => ({
  config: {
    enableLLM: true,
    enableRekognition: false,
    enableSupabase: false,
    debug: false,
    thresholds: { block: 70, review: 30, duplicate: 0.15 },
    weights: { rule: 1.0, ml: 0.8, vision: 0.9, metadata: 0.3 },
    temporal: { burstHour: 10, burstDay: 50 },
    account: { newAccountDays: 7, maxViolations: 5 },
    aws: { region: 'us-east-1' },
    supabase: { url: undefined, anonKey: undefined },
    openai: { apiKey: undefined, model: 'gpt-4', maxTokens: 1000 },
    anthropic: { apiKey: undefined, model: 'claude-3-sonnet-20240229', maxTokens: 1000 },
    perspective: { apiKey: undefined },
  },
}));

// Mock Anthropic provider module used by mlText
vi.mock('../src/providers/nlp/anthropic.js', () => {
  class FakeAnthropicDisabled {
    isEnabled() { return false; }
    getName() { return 'anthropic'; }
    async moderateText() { return { enabled: false, categories: {} }; }
  }
  return { AnthropicProvider: FakeAnthropicDisabled };
});

import { moderateTextWithML } from '../src/detectors/mlText.js';

describe('ML gating', () => {
  it('returns disabled when provider not enabled', async () => {
    const r = await moderateTextWithML('some benign text');
    expect(r.enabled).toBe(false);
    expect(r.flags.length).toBe(0);
    expect(r.provider).toBe('anthropic');
  });
});

// Now test with an enabled provider returning categories
describe('ML flag generation', () => {
  it('creates flags from provider categories', async () => {
    // Reset module registry so new mock takes effect
    vi.resetModules();
    vi.doMock('../src/providers/nlp/anthropic.js', () => {
      class FakeAnthropicEnabled {
        isEnabled() { return true; }
        getName() { return 'anthropic'; }
        async moderateText() {
          return {
            enabled: true,
            categories: {
              hate: { confidence: 0.9, label: 'hate speech' },
              spam: { confidence: 0.4, label: 'spammy' },
            },
          };
        }
      }
      return { AnthropicProvider: FakeAnthropicEnabled };
    });

    // Re-import to pick up new mock
    const { moderateTextWithML: mod2 } = await import('../src/detectors/mlText.js');
    const r = await mod2('You are awful');
    // Only high-confidence category should appear
    expect(r.enabled).toBe(true);
    expect(r.flags.some(f => f.category === 'hate')).toBe(true);
    expect(r.flags.some(f => f.category === 'spam')).toBe(false);
  });
});
