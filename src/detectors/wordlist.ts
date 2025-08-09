import { normalizeForMatch } from '../normalize.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Flag, Category } from '../types.js';

function loadList(name: string): string[] {
  const p = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'resources',
    name + '.json'
  );
  const data = fs.readFileSync(p, 'utf-8');
  return JSON.parse(data) as string[];
}

function* findAll(
  haystack: string,
  needle: string
): Generator<[number, number]> {
  let start = 0;
  while (true) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) break;
    yield [idx, idx + needle.length];
    start = idx + needle.length;
  }
}

export function wordlistDetector(
  category: Category,
  listName: string,
  weight = 20
) {
  const list = loadList(listName).map((s) => s.toLowerCase());
  return (text: string): Flag[] => {
    const norm = normalizeForMatch(text);
    const flags: Flag[] = [];
    for (const phrase of list) {
      if (!phrase.trim()) continue;
      for (const [a, b] of findAll(norm, phrase)) {
        flags.push({
          category,
          weight,
          message: `Matched phrase: ${phrase}`,
          indices: [a, b],
          snippet: text.slice(a, b),
        });
      }
    }
    return flags;
  };
}
