import type { Flag } from '../schema.js';

export function spamDetector(text: string): Flag[] {
  const flags: Flag[] = [];
  const len = text.length || 1;
  const caps = (text.match(/[A-Z]/g) || []).length;
  const ratio = caps / len;
  if (ratio > 0.5 && len > 10) {
    flags.push({
      source: 'rule',
      category: 'spam',
      weight: 10,
      message: 'Excessive ALL CAPS',
      indices: [0, Math.min(140, len)],
      snippet: text.slice(0, 140),
    });
  }
  if (/([!?\.])\1{3,}/.test(text)) {
    const m = /([!?\.])\1{3,}/.exec(text)!;
    flags.push({
      source: 'rule',
      category: 'spam',
      weight: 8,
      message: 'Excessive punctuation',
      indices: [m.index, m.index + m[0].length],
      snippet: m[0],
    });
  }
  if (/(free\s+money|giveaway|dm\s+to\s+claim)/i.test(text)) {
    const m = /(free\s+money|giveaway|dm\s+to\s+claim)/i.exec(text)!;
    flags.push({
      source: 'rule',
      category: 'spam',
      weight: 18,
      message: 'Scam-like phrase',
      indices: [m.index, m.index + m[0].length],
      snippet: m[0],
    });
  }
  return flags;
}
