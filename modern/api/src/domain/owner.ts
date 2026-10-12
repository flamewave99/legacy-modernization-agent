// Owner form validation [SPEC §6].
// Legacy: @NotEmpty on firstName, lastName (Person.java), address, city and telephone, plus
// @Digits(integer = 10, fraction = 0) on telephone (Owner.java). Hibernate Validator checks
// @Digits on a String by parsing it with `new BigDecimal(String)`.

export const NOT_EMPTY = 'must not be empty';
export const TELEPHONE_OUT_OF_BOUNDS =
  'numeric value out of bounds (<10 digits>.<0 digits> expected)';

export interface OwnerInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  address?: string | null | undefined;
  city?: string | null | undefined;
  telephone?: string | null | undefined;
}

export type OwnerField = keyof OwnerInput;
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

const REQUIRED: readonly OwnerField[] = ['firstName', 'lastName', 'address', 'city', 'telephone'];

/** One message per invalid field. An empty telephone gets `must not be empty` (D9). */
export function validateOwner(input: OwnerInput): FieldErrors<OwnerField> {
  const errors: FieldErrors<OwnerField> = {};
  for (const field of REQUIRED) {
    // @NotEmpty: null or zero length fails; whitespace-only passes (no trim).
    const value = input[field];
    if (value == null || value.length === 0) errors[field] = NOT_EMPTY;
  }
  const telephone = input.telephone;
  if (errors.telephone === undefined && telephone != null && !isValidTelephone(telephone)) {
    errors.telephone = TELEPHONE_OUT_OF_BOUNDS;
  }
  return errors;
}

// java.math.BigDecimal(String): optional sign, digits with an optional point, optional exponent.
// It reads UTF-16 chars through Character.digit, so any BMP decimal digit counts (legacy accepts
// `١٢٣` and `０１`) but a supplementary-plane digit such as `𝟏` (a surrogate pair) does not.
const BIG_DECIMAL = /^[+-]?(?:(\p{Nd}+)\.?(\p{Nd}*)|\.(\p{Nd}+))(?:[eE]([+-]?)(\p{Nd}+))?$/u;
const DIGIT = /^\p{Nd}$/u;
const SUPPLEMENTARY = /[\u{10000}-\u{10FFFF}]/u;

/** `@Digits(integer = 10, fraction = 0)`: precision - scale ≤ 10 and scale ≤ 0. */
export function isValidTelephone(value: string): boolean {
  if (SUPPLEMENTARY.test(value)) return false;
  // From here every char is one code unit, so `.length` and charCodeAt are per digit.
  const match = BIG_DECIMAL.exec(value);
  if (!match) return false;
  const intPart = match[1] ?? '';
  const fracPart = match[2] ?? match[3] ?? '';
  const exponent = digitsValue(match[5] ?? '0') * (match[4] === '-' ? -1n : 1n);

  const scale = BigInt(fracPart.length) - exponent;
  if (scale > 0n) return false;
  // Precision counts the unscaled value's digits without leading zeros; zero has precision 1.
  const unscaled = intPart + fracPart;
  let firstNonZero = 0;
  while (firstNonZero < unscaled.length && digitValue(unscaled, firstNonZero) === 0) {
    firstNonZero += 1;
  }
  const precision = Math.max(unscaled.length - firstNonZero, 1);
  return BigInt(precision) - scale <= 10n;
}

function digitsValue(digits: string): bigint {
  let value = 0n;
  for (let i = 0; i < digits.length; i += 1) value = value * 10n + BigInt(digitValue(digits, i));
  return value;
}

/**
 * Value of the decimal digit at `index`. Unicode encodes each digit set as a contiguous 0-9 run,
 * so the value is the offset from the start of the contiguous Nd run, modulo 10.
 */
export function digitValue(digits: string, index: number): number {
  let code = digits.charCodeAt(index);
  let offset = 0;
  while (DIGIT.test(String.fromCharCode(code - 1))) {
    code -= 1;
    offset += 1;
  }
  return offset % 10;
}
