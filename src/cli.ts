#!/usr/bin/env node
import { moderateText } from './engine.js';

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    if (process.stdin.isTTY) resolve('');
  });
}

async function main() {
  const args = process.argv.slice(2);
  const textArgIndex = args.indexOf('--text');
  let text = '';
  if (textArgIndex !== -1 && args[textArgIndex + 1]) {
    text = args[textArgIndex + 1];
  } else {
    text = (await readStdin()).trim();
  }
  const pIndex = args.indexOf('--platform');
  const platform =
    pIndex !== -1 && args[pIndex + 1]
      ? (args[pIndex + 1] as 'generic' | 'x' | 'instagram' | 'tiktok')
      : 'generic';

  if (!text) {
    console.error(
      'Usage: flag-post --text "your text" [--platform generic|x|instagram|tiktok]'
    );
    process.exit(2);
  }
  const result = moderateText(text, { platform });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.label === 'block' ? 1 : 0);
}

main();
