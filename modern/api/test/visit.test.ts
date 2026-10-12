import { describe, expect, it } from 'vitest';
import { NOT_EMPTY } from '../src/domain/owner.js';
import { INVALID_DATE, REQUIRED } from '../src/domain/pet.js';
import { validateVisit } from '../src/domain/visit.js';

describe('validateVisit', () => {
  it('accepts a valid visit in either date format', () => {
    expect(validateVisit({ date: '2013-01-01', description: 'rabies shot' })).toEqual({
      ok: true,
      date: { year: 2013, month: 1, day: 1 },
    });
    expect(validateVisit({ date: '2013/01/01', description: 'rabies shot' }).ok).toBe(true);
  });

  it('lets a whitespace-only description pass (no trim)', () => {
    expect(validateVisit({ date: '2013-01-01', description: ' ' }).ok).toBe(true);
  });

  it.each([
    [{ date: '2013-01-01', description: '' }, { description: NOT_EMPTY }],
    [{ date: '2013-01-01' }, { description: NOT_EMPTY }],
    [{ date: '2013-02-29', description: 'x' }, { date: INVALID_DATE }],
    [{ date: '2013-1-01', description: 'x' }, { date: INVALID_DATE }],
    // D1 fix: legacy saves a blank date as NULL.
    [{ date: '', description: 'x' }, { date: REQUIRED }],
    [{ date: '  ', description: 'x' }, { date: REQUIRED }],
    [{ description: 'x' }, { date: REQUIRED }],
    [
      { date: 'bad', description: '' },
      { date: INVALID_DATE, description: NOT_EMPTY },
    ],
  ])('%j gives %j', (input, errors) => {
    expect(validateVisit(input)).toEqual({ ok: false, errors });
  });
});
