import { describe, it, expect } from 'vitest';
import { compareHashes, hammingDistance } from '../src/media/hashing.js';

describe('hashing', () => {
  it('computes Hamming distance correctly', () => {
    const a = '10101010';
    const b = '10101010';
    const c = '01010101';
    expect(hammingDistance(a, b)).toBe(0);
    expect(hammingDistance(a, c)).toBe(8);
  });

  it('compares hash results and flags duplicates by threshold', () => {
    const h1 = { pHash: '1'.repeat(64), dHash: '0'.repeat(64), width: 0, height: 0 };
    const h2 = { pHash: '1'.repeat(64), dHash: '0'.repeat(64), width: 0, height: 0 };
    const h3 = { pHash: '1'.repeat(60) + '0'.repeat(4), dHash: '0'.repeat(64), width: 0, height: 0 };

    // identical -> duplicate
    const cmp1 = compareHashes(h1, h2, 0.15);
    expect(cmp1.isDuplicate).toBe(true);

    // small difference -> still duplicate under 15% threshold
    const cmp2 = compareHashes(h1, h3, 0.15);
    expect(cmp2.minDistance).toBeLessThanOrEqual(0.15);
    expect(cmp2.isDuplicate).toBe(true);
  });
});

