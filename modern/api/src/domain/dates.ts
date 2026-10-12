// Date handling for pet birth dates and visit dates [SPEC §6].
// Legacy binds these with @DateTimeFormat(pattern = "yyyy/MM/dd") on LocalDate (Pet.java, Visit.java),
// which Spring parses strictly and also accepts ISO yyyy-MM-dd.

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

export type ParsedDate =
  { kind: 'ok'; date: LocalDate } | { kind: 'missing' } | { kind: 'invalid' };

const SLASH = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLegacyDate(input: string | null | undefined): ParsedDate {
  if (input == null || input.trim() === '') return { kind: 'missing' };
  const match = SLASH.exec(input) ?? ISO.exec(input);
  if (!match) return { kind: 'invalid' };
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidDate(date) ? { kind: 'ok', date } : { kind: 'invalid' };
}

function isValidDate({ year, month, day }: LocalDate): boolean {
  // Year 0 exists in java.time but Postgres rejects it, so it is invalid here.
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function format(date: LocalDate, sep: string): string {
  return [pad(date.year, 4), pad(date.month, 2), pad(date.day, 2)].join(sep);
}

/** `yyyy-MM-dd`, the format Postgres DATE columns are read as. */
export function formatIsoDate(date: LocalDate): string {
  return format(date, '-');
}

/** `yyyy/MM/dd`, the legacy display and binding format. */
export function formatSlashDate(date: LocalDate): string {
  return format(date, '/');
}

/** Today in the server's local time zone (legacy uses LocalDate.now()). */
export function today(now: Date = new Date()): LocalDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
