import { describe, expect, it } from 'vitest';
import {
  compareCaseInsensitive,
  sortPetsByName,
  sortSpecialtiesByName,
  sortVets,
  sortVisitsByDateDesc,
} from '../src/domain/sorting.js';

const names = (items: readonly { name: string }[]) => items.map((i) => i.name);

describe('compareCaseInsensitive (Java String.CASE_INSENSITIVE_ORDER)', () => {
  it.each([
    ['a', 'B', -1],
    ['B', 'a', 1],
    ['abc', 'ABC', 0],
    ['ab', 'ABC', -1],
    ['Zed', 'zed ', -1],
    // Letters compare lowercased, so '_' (0x5F) sorts before both 'a' and 'A'.
    ['_', 'a', -1],
    ['_', 'A', -1],
    // Code-unit order, not locale order: 'é' (0xE9) after 'z'.
    ['é', 'z', 1],
    ['É', 'é', 0],
    // ß keeps its code point (Java's char mapping does not expand it to SS).
    ['ß', 'ss', 1],
    // Upper then lower: dotless ı goes through I, so it equals i.
    ['ı', 'i', 0],
  ])('%s vs %s -> %i', (a, b, sign) => {
    expect(Math.sign(compareCaseInsensitive(a, b))).toBe(sign);
  });
});

describe('sortPetsByName', () => {
  it('sorts case-insensitively without mutating the input', () => {
    const pets = [{ name: 'max' }, { name: 'Basil' }, { name: 'Lucky' }, { name: 'buddy' }];
    expect(names(sortPetsByName(pets))).toEqual(['Basil', 'buddy', 'Lucky', 'max']);
    expect(names(pets)).toEqual(['max', 'Basil', 'Lucky', 'buddy']);
  });
});

describe('sortVisitsByDateDesc', () => {
  it('puts the newest visit first and any NULL date last', () => {
    const visits = [
      { id: 1, date: '2013-01-01' },
      { id: 2, date: null },
      { id: 3, date: '2013-01-04' },
      { id: 4, date: '2012-12-31' },
    ];
    expect(sortVisitsByDateDesc(visits).map((v) => v.id)).toEqual([3, 1, 4, 2]);
  });
});

describe('sortVets', () => {
  it('orders by last name, then first name', () => {
    const vets = [
      { firstName: 'Sharon', lastName: 'Jenkins' },
      { firstName: 'Linda', lastName: 'Douglas' },
      { firstName: 'Helen', lastName: 'Leary' },
      { firstName: 'Anna', lastName: 'Douglas' },
    ];
    expect(sortVets(vets).map((v) => `${v.firstName} ${v.lastName}`)).toEqual([
      'Anna Douglas',
      'Linda Douglas',
      'Sharon Jenkins',
      'Helen Leary',
    ]);
  });
});

describe('sortSpecialtiesByName', () => {
  it('sorts case-insensitively', () => {
    const specialties = [{ name: 'surgery' }, { name: 'Dentistry' }, { name: 'radiology' }];
    expect(names(sortSpecialtiesByName(specialties))).toEqual([
      'Dentistry',
      'radiology',
      'surgery',
    ]);
  });
});
