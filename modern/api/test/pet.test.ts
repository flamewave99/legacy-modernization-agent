import { describe, expect, it } from 'vitest';
import {
  DUPLICATE,
  INVALID_DATE,
  INVALID_VALUE,
  REQUIRED,
  isDuplicateName,
  validatePet,
  type PetContext,
} from '../src/domain/pet.js';

const typeNames = ['bird', 'cat', 'dog', 'hamster', 'lizard', 'snake'];
const create: PetContext = { isNew: true, existingNames: ['Leo', 'Basil'], typeNames };
const edit: PetContext = { ...create, isNew: false };
const valid = { name: 'Rex', birthDate: '2020-01-02', type: 'dog' };

describe('validatePet', () => {
  it('accepts a valid pet and returns the parsed date', () => {
    expect(validatePet(valid, create)).toEqual({
      ok: true,
      birthDate: { year: 2020, month: 1, day: 2 },
    });
    expect(validatePet({ ...valid, birthDate: '2020/01/02' }, create).ok).toBe(true);
  });

  it('accepts a future birth date', () => {
    expect(validatePet({ ...valid, birthDate: '2999-12-31' }, create).ok).toBe(true);
  });

  it.each([
    ['name', { name: '' }, REQUIRED],
    ['name', { name: null }, REQUIRED],
    ['birthDate', { birthDate: '' }, REQUIRED],
    ['birthDate', { birthDate: '   ' }, REQUIRED],
    ['birthDate', { birthDate: undefined }, REQUIRED],
    ['birthDate', { birthDate: '2020/02/30' }, INVALID_DATE],
    ['birthDate', { birthDate: '2020/1/02' }, INVALID_DATE],
    ['birthDate', { birthDate: ' 2020/01/02' }, INVALID_DATE],
    ['type', { type: '' }, REQUIRED],
    ['type', { type: null }, REQUIRED],
    ['type', { type: 'dragon' }, INVALID_VALUE],
    ['type', { type: 'Dog' }, INVALID_VALUE],
  ])('on create, %s %j gives %s', (field, patch, message) => {
    expect(validatePet({ ...valid, ...patch }, create)).toEqual({
      ok: false,
      errors: { [field]: message },
    });
  });

  it('lets a whitespace-only name pass (no trim)', () => {
    expect(validatePet({ ...valid, name: '  ' }, create).ok).toBe(true);
  });

  it('rejects a duplicate name on create, case-insensitively', () => {
    expect(validatePet({ ...valid, name: 'leo' }, create)).toEqual({
      ok: false,
      errors: { name: DUPLICATE },
    });
  });

  it('allows a sibling name and a missing type on edit', () => {
    expect(validatePet({ ...valid, name: 'Leo', type: null }, edit).ok).toBe(true);
  });

  it('still rejects an unknown type on edit', () => {
    expect(validatePet({ ...valid, type: 'dragon' }, edit)).toEqual({
      ok: false,
      errors: { type: INVALID_VALUE },
    });
  });

  it('reports every failing field together', () => {
    expect(validatePet({ name: '', birthDate: 'nope', type: '' }, create)).toEqual({
      ok: false,
      errors: { name: REQUIRED, birthDate: INVALID_DATE, type: REQUIRED },
    });
  });
});

describe('isDuplicateName', () => {
  it.each([
    ['Leo', true],
    ['LEO', true],
    ['basil', true],
    ['Leo ', false],
    ['Rex', false],
  ])('%s -> %s', (name, expected) => {
    expect(isDuplicateName(name, ['Leo', 'Basil'])).toBe(expected);
  });

  it('is false for an owner without pets', () => {
    expect(isDuplicateName('Leo', [])).toBe(false);
  });
});
