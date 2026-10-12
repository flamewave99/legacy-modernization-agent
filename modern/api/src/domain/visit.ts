// Visit form validation [SPEC §5.4, §6].
// Legacy: @NotEmpty on Visit.description and @DateTimeFormat(pattern = "yyyy/MM/dd") on Visit.date.
// Legacy saves a blank date as NULL (D1); modern requires it.

import { parseLegacyDate, type LocalDate } from './dates.js';
import { NOT_EMPTY, type FieldErrors } from './owner.js';
import { INVALID_DATE, REQUIRED } from './pet.js';

export interface VisitInput {
  date?: string | null | undefined;
  description?: string | null | undefined;
}

export type VisitField = keyof VisitInput;

export type VisitValidation =
  { ok: true; date: LocalDate } | { ok: false; errors: FieldErrors<VisitField> };

export function validateVisit(input: VisitInput): VisitValidation {
  const errors: FieldErrors<VisitField> = {};

  const parsed = parseLegacyDate(input.date);
  if (parsed.kind === 'invalid') errors.date = INVALID_DATE;
  else if (parsed.kind === 'missing') errors.date = REQUIRED; // D1 fix

  // @NotEmpty: no trim, whitespace-only passes.
  const description = input.description;
  if (description == null || description.length === 0) errors.description = NOT_EMPTY;

  if (parsed.kind === 'ok' && Object.keys(errors).length === 0) {
    return { ok: true, date: parsed.date };
  }
  return { ok: false, errors };
}
