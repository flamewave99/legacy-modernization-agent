// Path id parsing with legacy parity. Spring binds `@PathVariable int` through
// NumberUtils.parseNumber: it strips every whitespace char (not only the ends), then uses
// Integer.decode for hex (`0x1F`, `0X1F`, `#1F`, optionally after `-`) and Integer.valueOf otherwise.
// Probed on the running legacy app: `+1`, `0x1`, `%231`, `1%202`, `01`, `١` and `%E2%80%831` (em
// space) all load owner 1; `1.0`, `0x`, `+0x1`, `%C2%A01` (no-break space) and 2147483648 give 400.

import { digitValue } from './owner.js';

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

// Character.isWhitespace: space, line and paragraph separators except the no-break ones, plus
// the ASCII controls \t \n \v \f \r and \x1C-\x1F.
// eslint-disable-next-line no-control-regex -- Java counts \x1C-\x1F as whitespace.
const JAVA_WHITESPACE = /[\t\n\v\f\r\x1C-\x1F\u2028\u2029]|(?![\u00A0\u2007\u202F])\p{Zs}/gu;
const DECIMAL_DIGIT = /^\p{Nd}$/u;

/** The id as Java would bind it to an `int`, or `undefined` where legacy answers 400. */
export function parseLegacyId(raw: string): number | undefined {
  const text = raw.replace(JAVA_WHITESPACE, '');
  const index = text.startsWith('-') ? 1 : 0;
  if (text.startsWith('0x', index) || text.startsWith('0X', index) || text.startsWith('#', index)) {
    // Integer.decode: the sign, then the prefix, then digits with no second sign.
    const digits = text.slice(index + (text.startsWith('#', index) ? 1 : 2));
    if (digits.startsWith('-') || digits.startsWith('+')) return undefined;
    return parseJavaInt((index === 1 ? '-' : '') + digits, 16);
  }
  return parseJavaInt(text, 10);
}

/** Integer.parseInt(s, radix): optional sign, at least one digit, within int range. */
function parseJavaInt(s: string, radix: number): number | undefined {
  const negative = s.startsWith('-');
  const start = negative || s.startsWith('+') ? 1 : 0;
  if (s.length === start) return undefined;
  let value = 0;
  for (let i = start; i < s.length; i += 1) {
    const digit = javaDigit(s, i, radix);
    if (digit < 0) return undefined;
    value = value * radix + digit;
    if (value > INT_MAX + 1) return undefined;
  }
  const result = negative ? -value : value;
  return result < INT_MIN || result > INT_MAX ? undefined : result;
}

/**
 * Character.digit(char, radix) on one UTF-16 code unit: any BMP decimal digit, plus Latin letters
 * (ASCII or fullwidth) for radix above 10. A surrogate half is never a digit.
 */
function javaDigit(s: string, index: number, radix: number): number {
  const code = s.charCodeAt(index);
  let value = -1;
  if (DECIMAL_DIGIT.test(String.fromCharCode(code))) value = digitValue(s, index);
  else if (code >= 0x41 && code <= 0x5a) value = code - 0x41 + 10;
  else if (code >= 0x61 && code <= 0x7a) value = code - 0x61 + 10;
  else if (code >= 0xff21 && code <= 0xff3a) value = code - 0xff21 + 10;
  else if (code >= 0xff41 && code <= 0xff5a) value = code - 0xff41 + 10;
  return value < radix ? value : -1;
}
