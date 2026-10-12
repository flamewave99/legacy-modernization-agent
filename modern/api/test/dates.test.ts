import { describe, expect, it } from 'vitest';
import { formatIsoDate, formatSlashDate, parseLegacyDate, today } from '../src/domain/dates.js';

describe('parseLegacyDate', () => {
  it.each([
    ['2010/09/07', { year: 2010, month: 9, day: 7 }],
    ['2010-09-07', { year: 2010, month: 9, day: 7 }],
    ['2021/02/03', { year: 2021, month: 2, day: 3 }],
    ['2023-08-09', { year: 2023, month: 8, day: 9 }],
    ['2020/02/29', { year: 2020, month: 2, day: 29 }],
    ['2000-02-29', { year: 2000, month: 2, day: 29 }],
    ['2099/12/31', { year: 2099, month: 12, day: 31 }],
  ])('accepts %s', (input, date) => {
    expect(parseLegacyDate(input)).toEqual({ kind: 'ok', date });
  });

  it.each([
    '2020/02/30',
    '2021/02/29',
    '1900-02-29',
    '2020/04/31',
    '2020/13/01',
    '2020/00/10',
    '2020/01/00',
    '2020/1/05',
    '2020/01/5',
    '2020-1-05',
    ' 2020/01/05',
    '2020/01/05 ',
    '2020/01-05',
    '20/01/05',
    '0000-01-01',
    '31/31/2020',
    'abc',
    'notadate',
  ])('rejects %j as invalid', (input) => {
    expect(parseLegacyDate(input)).toEqual({ kind: 'invalid' });
  });

  it.each(['', ' ', '   ', '\t', null, undefined])('treats %j as missing', (input) => {
    expect(parseLegacyDate(input)).toEqual({ kind: 'missing' });
  });
});

describe('formatters', () => {
  const date = { year: 2010, month: 9, day: 7 };

  it('formats yyyy-MM-dd', () => {
    expect(formatIsoDate(date)).toBe('2010-09-07');
  });

  it('formats yyyy/MM/dd', () => {
    expect(formatSlashDate(date)).toBe('2010/09/07');
  });

  it('pads small years', () => {
    expect(formatIsoDate({ year: 33, month: 1, day: 2 })).toBe('0033-01-02');
  });

  it('round-trips through the parser', () => {
    expect(parseLegacyDate(formatSlashDate(date))).toEqual({ kind: 'ok', date });
    expect(parseLegacyDate(formatIsoDate(date))).toEqual({ kind: 'ok', date });
  });

  it('gives today in local time', () => {
    expect(today(new Date(2024, 0, 31, 23, 59))).toEqual({ year: 2024, month: 1, day: 31 });
  });
});
