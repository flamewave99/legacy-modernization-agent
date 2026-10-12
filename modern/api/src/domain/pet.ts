// Pet form validation [SPEC §5.3, §6].
// Legacy: PetValidator.java (name, type on create, birthDate) plus the duplicate-name check in
// PetController.processCreationForm, which uses Owner.getPet(name, true).

import { parseLegacyDate, type LocalDate } from './dates.js';
import type { FieldErrors } from './owner.js';

export const REQUIRED = 'is required';
export const DUPLICATE = 'is already in use';
export const INVALID_DATE = 'invalid date';
export const INVALID_VALUE = 'invalid value';

export interface PetInput {
  name?: string | null | undefined;
  birthDate?: string | null | undefined;
  /** Pet type by name. */
  type?: string | null | undefined;
}

export type PetField = keyof PetInput;

export interface PetContext {
  /** Create runs the duplicate-name check and requires a type; edit does neither. */
  isNew: boolean;
  /** Names of the owner's saved pets. */
  existingNames: readonly string[];
  /** Known pet type names. */
  typeNames: readonly string[];
}

export type PetValidation =
  { ok: true; birthDate: LocalDate } | { ok: false; errors: FieldErrors<PetField> };

/** One message per invalid field; the first rule that fails wins, as in legacy. */
export function validatePet(input: PetInput, context: PetContext): PetValidation {
  const errors: FieldErrors<PetField> = {};

  // StringUtils.hasLength: null or zero length fails; whitespace-only passes.
  const name = input.name;
  if (name == null || name.length === 0) {
    errors.name = REQUIRED;
  } else if (context.isNew && isDuplicateName(name, context.existingNames)) {
    errors.name = DUPLICATE;
  }

  const type = input.type;
  if (type == null || type.length === 0) {
    if (context.isNew) errors.type = REQUIRED;
  } else if (!context.typeNames.includes(type)) {
    // D5 fix: legacy shows Java's conversion error; modern rejects with a field message.
    errors.type = INVALID_VALUE;
  }

  // A binding error (`invalid date`) is recorded before the validator's `is required`.
  const parsed = parseLegacyDate(input.birthDate);
  if (parsed.kind === 'invalid') errors.birthDate = INVALID_DATE;
  else if (parsed.kind === 'missing') errors.birthDate = REQUIRED;

  if (parsed.kind === 'ok' && Object.keys(errors).length === 0) {
    return { ok: true, birthDate: parsed.date };
  }
  return { ok: false, errors };
}

/** Owner.getPet(name, true): String.toLowerCase on both sides, then equals. */
export function isDuplicateName(name: string, existingNames: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return existingNames.some((existing) => existing.toLowerCase() === lower);
}
