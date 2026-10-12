import { describe, expect, it } from 'vitest';
import { parseLegacyId } from '../src/domain/ids.js';

describe('parseLegacyId', () => {
  // Each case was checked against the running legacy app (`/owners/<id>`).
  it.each([
    ['1', 1],
    ['+1', 1],
    ['01', 1],
    ['-1', -1],
    ['0x1', 1],
    ['0X1', 1],
    ['#1', 1],
    ['-0x1', -1],
    ['-#1', -1],
    ['0xA', 10],
    ['0xＡ', 10], // fullwidth A
    ['１', 1], // fullwidth 1
    ['١', 1], // Arabic-Indic 1
    ['1 2', 12], // all whitespace is removed, not only the ends
    [' 1\t', 1],
    [' 1', 1], // em space
    ['2147483647', 2147483647],
    ['-2147483648', -2147483648],
    ['0x7fffffff', 2147483647],
    ['-0x80000000', -2147483648],
  ])('%j is %d', (raw, expected) => {
    expect(parseLegacyId(raw)).toBe(expected);
  });

  it.each([
    '',
    ' ',
    'abc',
    '1.0',
    '1a',
    '0x',
    '+0x1',
    '0x-1',
    '0x+1',
    '--1',
    '+',
    '-',
    ' 1', // no-break space is not Java whitespace
    '2147483648',
    '-2147483649',
    '0x80000000',
    '\u{1D7CF}', // supplementary-plane digit
  ])('%j is rejected', (raw) => {
    expect(parseLegacyId(raw)).toBeUndefined();
  });
});
