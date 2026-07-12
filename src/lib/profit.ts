import type { AllocationBucket } from '@/db/types';

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
): { name: string; percent: number; amount: number }[] {
  const safe = Math.max(0, profitMinor);
  const rows = buckets.map((b) => ({
    name: b.name,
    percent: b.percent,
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
