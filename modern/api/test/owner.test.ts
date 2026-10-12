import { describe, expect, it } from 'vitest';
import {
  NOT_EMPTY,
  TELEPHONE_OUT_OF_BOUNDS,
  isValidTelephone,
  validateOwner,
} from '../src/domain/owner.js';

const valid = {
  firstName: 'George',
  lastName: 'Franklin',
  address: '110 W. Liberty St.',
  city: 'Madison',
  telephone: '6085551023',
};

describe('isValidTelephone', () => {
  // Every case below was checked against the running legacy app (2026-10-12).
  it.each([
    '1',
    '1234567890',
    '9999999999',
    '+123',
    '-123',
    '-0',
    '1e3',
    '1E+2',
    '1e9',
    '1.',
    '00000000000001',
    '0E5',
    '0E9',
    '١٢٣',
    '０１',
    '1e٠٩',
  ])('accepts %s', (input) => {
    expect(isValidTelephone(input)).toBe(true);
  });

  it.each([
    'abc',
    '12345678901',
    '123-456',
    '1.0',
    '.5',
    '10E-1',
    '1e10',
    '0E10',
    '+',
    '1e',
    ' 1',
    '1 ',
    '1_0',
    '\u{1D7CF}',
    '',
  ])('rejects %j', (input) => {
    expect(isValidTelephone(input)).toBe(false);
  });
});

describe('validateOwner', () => {
  it('accepts a complete owner', () => {
    expect(validateOwner(valid)).toEqual({});
  });

  it.each(['firstName', 'lastName', 'address', 'city', 'telephone'] as const)(
    'requires %s',
    (field) => {
      expect(validateOwner({ ...valid, [field]: '' })).toEqual({ [field]: NOT_EMPTY });
      expect(validateOwner({ ...valid, [field]: undefined })).toEqual({ [field]: NOT_EMPTY });
      expect(validateOwner({ ...valid, [field]: null })).toEqual({ [field]: NOT_EMPTY });
    },
  );

  it('lets whitespace-only names through (no trim)', () => {
    expect(
      validateOwner({ ...valid, firstName: ' ', lastName: '\t', address: ' ', city: ' ' }),
    ).toEqual({});
  });

  it('gives an empty telephone only must not be empty (D9)', () => {
    expect(validateOwner({ ...valid, telephone: '' })).toEqual({ telephone: NOT_EMPTY });
  });

  it('rejects a non-numeric telephone', () => {
    expect(validateOwner({ ...valid, telephone: 'abc' })).toEqual({
      telephone: TELEPHONE_OUT_OF_BOUNDS,
    });
  });

  it('reports every invalid field together', () => {
    expect(validateOwner({ telephone: '12345678901' })).toEqual({
      firstName: NOT_EMPTY,
      lastName: NOT_EMPTY,
      address: NOT_EMPTY,
      city: NOT_EMPTY,
      telephone: TELEPHONE_OUT_OF_BOUNDS,
    });
  });
});
