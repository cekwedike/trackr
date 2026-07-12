import type { AllocationBucket, AllocationSlice } from '@/db/types';
import { dayjs } from '@/lib/date';

export const DEFAULT_ALLOCATION: AllocationBucket[] = [
  { name: 'Back into business', percent: 50 },
  { name: 'Savings', percent: 20 },
  { name: 'Emergency funds', percent: 10 },
  { name: 'Tithes', percent: 10 },
  { name: 'My gain', percent: 10 },
];

export function parseAllocation(json: string | null | undefined): AllocationBucket[] {
  if (!json) return DEFAULT_ALLOCATION;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as AllocationBucket[];
    return DEFAULT_ALLOCATION;
  } catch {
    return DEFAULT_ALLOCATION;
  }
}

export function allocationTotal(buckets: AllocationBucket[]): number {
  return buckets.reduce((sum, b) => sum + (Number(b.percent) || 0), 0);
}

/** Split a profit amount (minor units) across buckets, distributing rounding remainder to the largest bucket. */
export function splitAllocation(
  profitMinor: number,
  buckets: AllocationBucket[],
): AllocationSlice[] {
  const safe = Math.max(0, profitMinor);
  const rows = buckets.map((b) => ({
    name: b.name,
    percent: Number(b.percent) || 0,
    amount: Math.floor((safe * (Number(b.percent) || 0)) / 100),
  }));
  const distributed = rows.reduce((sum, r) => sum + r.amount, 0);
  const remainder = safe - distributed;
  if (remainder !== 0 && rows.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < rows.length; i++) if (rows[i].percent > rows[maxIdx].percent) maxIdx = i;
    rows[maxIdx].amount += remainder;
  }
  return rows;
}

export interface ProfitSummary {
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number; // revenue - cogs
  netProfit: number; // revenue - cogs - expenses
  margin: number; // netProfit / revenue (0..1)
}

export function computeProfit(revenue: number, cogs: number, expenses: number): ProfitSummary {
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;
  const margin = revenue > 0 ? netProfit / revenue : 0;
  return { revenue, cogs, expenses, grossProfit, netProfit, margin };
}

/**
 * Realized (distributable) profit for a month. Under sound bookkeeping you only
 * distribute profit that actually exists, so a break-even or loss month yields 0.
 */
export function realizedProfit(netProfit: number): number {
  return Math.max(0, netProfit);
}

// ---------- Month key helpers ('YYYY-MM') ----------

/** The calendar month key for "now", e.g. '2026-07'. */
export function currentMonthKey(): string {
  return dayjs().format('YYYY-MM');
}

/** Shift a month key by a number of months (positive = later). */
export function shiftMonthKey(key: string, delta: number): string {
  return dayjs(`${key}-01`).add(delta, 'month').format('YYYY-MM');
}

/** Inclusive ISO bounds covering the whole month, for range queries. */
export function monthBounds(key: string): { start: string; end: string } {
  const m = dayjs(`${key}-01`);
  return { start: m.startOf('month').toISOString(), end: m.endOf('month').toISOString() };
}

/** Human label for a month key, e.g. 'July 2026'. */
export function formatMonthKey(key: string): string {
  return dayjs(`${key}-01`).format('MMMM YYYY');
}

/** Short human label for a month key, e.g. "Jul '26". */
export function formatMonthKeyShort(key: string): string {
  return dayjs(`${key}-01`).format("MMM 'YY");
}

/** True when the month key is the current month or in the past (i.e. not the future). */
export function isCurrentOrPastMonth(key: string): boolean {
  return dayjs(`${key}-01`).startOf('month').isSameOrBefore(dayjs().startOf('month'));
}

/** Parse a stored allocation JSON snapshot into typed slices. */
export function parseAllocationSlices(json: string | null | undefined): AllocationSlice[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as AllocationSlice[];
    return [];
  } catch {
    return [];
  }
}
