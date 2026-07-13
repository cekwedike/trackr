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

/**
 * Compact money for tight labels (e.g. chart axes): 1_250_000 minor -> "₦12.5k".
 * Rounds at the major-unit boundary and reuses the minor-units convention so it
 * stays consistent with {@link formatMoney}. For a full grouped amount use
 * {@link formatMoney} instead.
 */
export function formatCompactMoney(minor: number, symbol = '₦'): string {
  const value = fromMinor(minor ?? 0);
  const negative = value < 0;
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `${trimCompact(abs / 1_000_000)}M`;
  else if (abs >= 1_000) body = `${trimCompact(abs / 1_000)}k`;
  else body = trimCompact(abs);
  return `${negative ? '-' : ''}${symbol}${body}`;
}

function trimCompact(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Format a plain quantity (may be fractional) without a currency symbol. */
export function formatQty(qty: number): string {
  if (qty == null || isNaN(qty)) return '0';
  return Number.isInteger(qty) ? String(qty) : String(parseFloat(qty.toFixed(3)));
}
