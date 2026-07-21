/**
 * Birthday parsing/formatting helpers.
 *
 * A customer birthday may be stored in one of two shapes:
 *  - A full date: `YYYY-MM-DD` or a full ISO timestamp (`YYYY-MM-DDTHH:mm:ss…`) —
 *    used when the source knows the year (manual entry, or a contact with a year).
 *  - A **year-less** date in ISO 8601 recurring form `--MM-DD` (e.g. `--07-21`) —
 *    used when a device contact only provides day + month (very common). We do
 *    NOT invent a year in that case.
 *
 * Neither `new Date('--07-21')` nor `dayjs('--07-21')` can parse the year-less
 * form, so ALL birthday parsing/formatting must go through these helpers rather
 * than calling `new Date()` / `dayjs()` on the raw value.
 */
import { dayjs } from '@/lib/date';

export interface BirthdayParts {
  /** 4-digit year, or `null` when the birthday has no year. */
  year: number | null;
  /** Month, 1–12. */
  month: number;
  /** Day, 1–31. */
  day: number;
}

const YEARLESS_RE = /^--(\d{2})-(\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function isValidMonthDay(month: number, day: number): boolean {
  return (
    Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= 31
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Parse a stored birthday (`--MM-DD`, `YYYY-MM-DD`, or full ISO) into
 * `{ year, month, day }` with month 1–12. Returns `null` for empty/invalid input.
 */
export function parseBirthday(value: string | null | undefined): BirthdayParts | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const yearless = YEARLESS_RE.exec(trimmed);
  if (yearless) {
    const month = Number(yearless[1]);
    const day = Number(yearless[2]);
    return isValidMonthDay(month, day) ? { year: null, month, day } : null;
  }

  const dated = DATE_RE.exec(trimmed);
  if (dated) {
    const year = Number(dated[1]);
    const month = Number(dated[2]);
    const day = Number(dated[3]);
    return isValidMonthDay(month, day) ? { year: year > 0 ? year : null, month, day } : null;
  }

  // Fallback: let dayjs try other ISO/locale-ish forms before giving up.
  const d = dayjs(trimmed);
  if (d.isValid()) return { year: d.year(), month: d.month() + 1, day: d.date() };
  return null;
}

/** True when the birthday is valid but has a day + month with no year. */
export function isYearlessBirthday(value: string | null | undefined): boolean {
  const parts = parseBirthday(value);
  return !!parts && parts.year == null;
}

/**
 * Format a birthday for display: `21 Jul 2005` when the year is known, `21 Jul`
 * for year-less birthdays. Returns `''` for null/invalid input.
 */
export function formatBirthday(value: string | null | undefined): string {
  const parts = parseBirthday(value);
  if (!parts) return '';
  const d = dayjs(new Date(parts.year ?? 2000, parts.month - 1, parts.day, 12, 0, 0));
  return parts.year == null ? d.format('DD MMM') : d.format('DD MMM YYYY');
}

/**
 * Convert a birthday to a JS `Date` suitable for a date picker. Year-less
 * birthdays use `fallbackYear` so the picker has a concrete date; the caller
 * decides whether to persist that year (see {@link toYearlessBirthday}).
 * Returns `null` for null/invalid input.
 */
export function birthdayToDate(value: string | null | undefined, fallbackYear = 2000): Date | null {
  const parts = parseBirthday(value);
  if (!parts) return null;
  return new Date(parts.year ?? fallbackYear, parts.month - 1, parts.day, 12, 0, 0);
}

/** Serialise a `Date`'s month + day as a year-less ISO 8601 recurring date (`--MM-DD`). */
export function toYearlessBirthday(date: Date): string {
  return `--${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
