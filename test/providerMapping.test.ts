import { describe, it, expect } from 'vitest';
import { mapVisionCategory } from '../src/providers/vision/types.js';

describe('vision provider category mapping', () => {
  it('maps AWS Rekognition labels to standard categories', () => {
    expect(mapVisionCategory('Explicit Nudity', 'aws-rekognition')).toBe('nsfw');
    expect(mapVisionCategory('Violence', 'aws-rekognition')).toBe('violence');
    expect(mapVisionCategory('Weapons', 'aws-rekognition')).toBe('weapons');
  });

  it('returns lowercased category when unmapped', () => {
    expect(mapVisionCategory('UnknownLabel', 'aws-rekognition')).toBe('unknownlabel');
  });
});

