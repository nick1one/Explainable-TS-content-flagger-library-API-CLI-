import { wordlistDetector } from './wordlist.js';
import { piiDetector } from './pii.js';
import { linksDetector } from './links.js';
import { spamDetector } from './spam.js';
import type { Flag } from '../schema.js';

const profanity = wordlistDetector('profanity', 'profanity', 18);
const hate = wordlistDetector('hate', 'hate', 28);
const violence = wordlistDetector('violence', 'violence', 30);
const sexual = wordlistDetector('sexual', 'sexual', 22);
const selfharm = wordlistDetector('selfharm', 'selfharm', 40);

export function runAllDetectors(text: string): Flag[] {
  return [
    ...profanity(text),
    ...hate(text),
    ...violence(text),
    ...sexual(text),
    ...selfharm(text),
    ...piiDetector(text),
    ...linksDetector(text),
    ...spamDetector(text),
  ];
}
