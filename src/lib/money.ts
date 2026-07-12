/**
 * Money is stored everywhere as an integer number of minor units (e.g. kobo/cents),
 * i.e. the display value multiplied by 100. This avoids floating point rounding bugs.
 */

export function toMinor(amount: number): number {
  if (!isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return (minor ?? 0) / 100;
}

/** Parse a user-typed money string ("1,200.50", "₦300") into minor units. */
export function parseMoney(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : toMinor(value);
}

function groupDigits(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format minor units into a display string with grouping. */
export function formatMoney(
  minor: number,
  symbol = '₦',
  opts: { decimals?: 'auto' | 0 | 2; signed?: boolean } = {},
): string {
  const { decimals = 'auto', signed = false } = opts;
  const value = fromMinor(minor ?? 0);
  const negative = value < 0;
  const abs = Math.abs(value);

  let decimalPlaces: number;
  if (decimals === 'auto') {
    decimalPlaces = Number.isInteger(abs) ? 0 : 2;
  } else {
    decimalPlaces = decimals;
  }

  const fixed = abs.toFixed(decimalPlaces);
  const [intPart, fracPart] = fixed.split('.');
  const grouped = groupDigits(intPart);
  const body = fracPart ? `${grouped}.${fracPart}` : grouped;

  const sign = negative ? '-' : signed ? '+' : '';
  return `${sign}${symbol}${body}`;
}

/** Format a plain quantity (may be fractional) without a currency symbol. */
export function formatQty(qty: number): string {
  if (qty == null || isNaN(qty)) return '0';
  return Number.isInteger(qty) ? String(qty) : String(parseFloat(qty.toFixed(3)));
}
