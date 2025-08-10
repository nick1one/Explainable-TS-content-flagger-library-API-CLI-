import type { Flag } from '../schema.js';

const urlRe = /\bhttps?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?/gi;
const shorteners = [
  'bit.ly',
  't.co',
  'goo.gl',
  'tinyurl.com',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  't.ly',
  'rebrand.ly',
];

export function linksDetector(text: string): Flag[] {
  const flags: Flag[] = [];
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = urlRe.exec(text))) {
    const url = m[0];
    count++;
    const host = (() => {
      try {
        return new URL(url).host.toLowerCase();
      } catch {
        return '';
      }
    })();
    if (shorteners.includes(host)) {
      flags.push({
        source: 'rule',
        category: 'links',
        weight: 30,
        message: 'Suspicious link shortener',
        indices: [m.index, m.index + url.length],
        snippet: url,
      });
    } else {
      flags.push({
        source: 'rule',
        category: 'links',
        weight: 5,
        message: 'External link',
        indices: [m.index, m.index + url.length],
        snippet: url,
      });
    }
  }
  if (count >= 3) {
    flags.push({
      source: 'rule',
      category: 'spam',
      weight: 15,
      message: 'Too many links',
      indices: [0, Math.min(140, text.length)],
      snippet: text.slice(0, 140),
    });
  }
  return flags;
}
