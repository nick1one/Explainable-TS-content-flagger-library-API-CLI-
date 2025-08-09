const FULLWIDTH_START = 0xff01;
const FULLWIDTH_END = 0xff5e;

const leetMap: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  $: 's',
  '@': 'a',
  '!': 'i',
  '|': 'l',
};

export function normalizeForMatch(input: string): string {
  // Convert fullwidth ASCII to normal ASCII
  let s = Array.from(input)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code >= FULLWIDTH_START && code <= FULLWIDTH_END) {
        return String.fromCodePoint(code - 0xfee0);
      }
      return ch;
    })
    .join('');

  // Lowercase
  s = s.toLowerCase();

  // Fold common leetspeak
  s = s.replace(/[013457$@!|]/g, (m) => leetMap[m] ?? m);

  // Remove zero-width and repeated spaces
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ');

  return s;
}
