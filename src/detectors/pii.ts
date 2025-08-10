import type { Flag } from '../schema.js';

const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phoneRe =
  /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/;
const ccRe = /\b(?:\d[ -]*?){13,19}\b/;

function luhnCheck(num: string): boolean {
  const digits = num
    .replace(/\D/g, '')
    .split('')
    .reverse()
    .map((n) => parseInt(n, 10));
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function piiDetector(text: string): Flag[] {
  const flags: Flag[] = [];
  const email = emailRe.exec(text);
  if (email)
    flags.push({
      source: 'rule',
      category: 'pii',
      weight: 15,
      message: 'Email address detected',
      indices: [email.index, email.index + email[0].length],
      snippet: email[0],
    });

  const phone = phoneRe.exec(text);
  if (phone)
    flags.push({
      source: 'rule',
      category: 'pii',
      weight: 10,
      message: 'Phone number detected',
      indices: [phone.index, phone.index + phone[0].length],
      snippet: phone[0],
    });

  const cc = ccRe.exec(text);
  if (cc && luhnCheck(cc[0]))
    flags.push({
      source: 'rule',
      category: 'pii',
      weight: 35,
      message: 'Potential credit card number',
      indices: [cc.index, cc.index + cc[0].length],
      snippet: cc[0],
    });

  return flags;
}
