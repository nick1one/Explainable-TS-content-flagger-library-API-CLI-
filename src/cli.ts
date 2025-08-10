#!/usr/bin/env node
import { moderateContent } from './engine.js';

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

  // Parse arguments
  const textArgIndex = args.indexOf('--text');
  let text = '';
  if (textArgIndex !== -1 && args[textArgIndex + 1]) {
    text = args[textArgIndex + 1];
  } else {
    text = (await readStdin()).trim();
  }

  const platformIndex = args.indexOf('--platform');
  const platform =
    platformIndex !== -1 && args[platformIndex + 1]
      ? (args[platformIndex + 1] as 'generic' | 'x' | 'instagram' | 'tiktok')
      : 'generic';

  const mediaUrlIndex = args.indexOf('--media-url');
  const mediaTypeIndex = args.indexOf('--media-type');
  let media = undefined;
  if (
    mediaUrlIndex !== -1 &&
    args[mediaUrlIndex + 1] &&
    mediaTypeIndex !== -1 &&
    args[mediaTypeIndex + 1]
  ) {
    media = {
      url: args[mediaUrlIndex + 1],
      type: args[mediaTypeIndex + 1] as 'image' | 'video',
    };
  }

  const debugIndex = args.indexOf('--debug');
  const debug = debugIndex !== -1;

  if (!text && !media) {
    console.error(
      'Usage: flag-post [--text "your text"] [--media-url "url" --media-type image|video] [--platform generic|x|instagram|tiktok] [--debug]'
    );
    console.error('At least one of --text or --media-url must be provided');
    process.exit(2);
  }

  try {
    const result = await moderateContent(text || undefined, media, {
      platform,
    });

    if (debug) {
      console.log('Provider Status:');
      if (result.debug?.providers) {
        for (const [provider, status] of Object.entries(
          result.debug.providers
        )) {
          console.log(`  ${provider}: ${status}`);
        }
      }
      console.log('\nTimings:');
      if (result.debug?.timings) {
        for (const [operation, time] of Object.entries(result.debug.timings)) {
          console.log(`  ${operation}: ${time}ms`);
        }
      }

      console.log('\n---');
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.label === 'block' ? 1 : 0);
  } catch (error) {
    console.error('Moderation failed:', error);
    process.exit(1);
  }
}

main();
