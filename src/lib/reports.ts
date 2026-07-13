/**
 * Pure shaping / formatting helpers for the Reports screen charts.
 *
 * These functions turn the aggregate rows from `db/repos/reports.ts` into plain
 * geometry (pixel coordinates, SVG path strings, scales) that a react-native-svg
 * chart can render directly. Keeping the math here means the screen component
 * stays declarative and the geometry is easy to reason about / test.
 *
 * Everything is defensive against empty or all-zero data: scales never divide by
 * zero and every returned coordinate is a finite number, so the charts render a
 * flat baseline instead of crashing when there's nothing to show yet.
 *
 * Currency formatting reuses `fromMinor` from `@/lib/money` (the single source of
 * truth for the minor-units convention).
 */

import type { MonthlySeriesPoint } from '@/db/repos/reports';
import { currentMonthKey, formatMonthKey, monthBounds, shiftMonthKey } from '@/lib/profit';

// ---------- Period selector ----------

export type ReportPeriod = 'this' | 'last' | 'last3' | 'last6';

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'this', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'last3', label: 'Last 3' },
  { value: 'last6', label: 'Last 6 months' },
];

/**
 * Inclusive ISO bounds for a report period, built from the same month-key
 * helpers the Profit Calculator uses so window edges line up exactly.
 */
export function periodRange(period: ReportPeriod): { start: string; end: string; label: string } {
  const current = currentMonthKey();
  switch (period) {
    case 'last': {
      const key = shiftMonthKey(current, -1);
      const b = monthBounds(key);
      return { start: b.start, end: b.end, label: formatMonthKey(key) };
    }
    case 'last3': {
      const start = monthBounds(shiftMonthKey(current, -2)).start;
      const end = monthBounds(current).end;
      return { start, end, label: 'Last 3 months' };
    }
    case 'last6': {
      const start = monthBounds(shiftMonthKey(current, -5)).start;
      const end = monthBounds(current).end;
      return { start, end, label: 'Last 6 months' };
    }
    case 'this':
    default: {
      const b = monthBounds(current);
      return { start: b.start, end: b.end, label: formatMonthKey(current) };
    }
  }
}

// ---------- Deltas / month-over-month ----------

export interface Delta {
  current: number;
  previous: number;
  /** Signed absolute change (current − previous), in the same units as inputs. */
  abs: number;
  /** Signed percent change; guarded so a zero baseline never yields NaN/Infinity. */
  percent: number;
  /** True when the value grew (or held steady). Callers decide if that's good/bad. */
  up: boolean;
}

/** Percent change from `previous` to `current`, safe when `previous` is 0. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : current < 0 ? -100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function computeDelta(current: number, previous: number): Delta {
  return {
    current,
    previous,
    abs: current - previous,
    percent: percentChange(current, previous),
    up: current >= previous,
  };
}

/** Month-over-month deltas for the two most recent points of a monthly series. */
export interface MonthlyDeltas {
  revenue: Delta;
  expenses: Delta;
  profit: Delta;
}

export function monthlyDeltas(series: MonthlySeriesPoint[]): MonthlyDeltas {
  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  const cur = current ?? { revenue: 0, expenses: 0, netProfit: 0 };
  const prev = previous ?? { revenue: 0, expenses: 0, netProfit: 0 };
  return {
    revenue: computeDelta(cur.revenue, prev.revenue),
    expenses: computeDelta(cur.expenses, prev.expenses),
    profit: computeDelta(cur.netProfit, prev.netProfit),
  };
}

/** e.g. 12.4 -> "+12%", -3 -> "-3%", 0 -> "0%". */
export function formatSignedPercent(percent: number): string {
  const rounded = Math.round(percent);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

/** True when there is any non-zero activity to chart. */
export function hasSeriesData(series: MonthlySeriesPoint[]): boolean {
  return series.some((p) => p.revenue !== 0 || p.expenses !== 0 || p.netProfit !== 0);
}

// ---------- Scales ----------

/** Round a raw maximum up to a friendly axis value (always ≥ 1). */
export function niceMax(value: number): number {
  if (!isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}

// ---------- Grouped bar chart (revenue vs expenses) ----------

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  series: 'revenue' | 'expenses';
  value: number;
}

export interface BarGroup {
  key: string;
  label: string;
  /** Horizontal centre of the group — use for the axis label. */
  center: number;
  bars: BarRect[];
}

export interface BarChartLayout {
  width: number;
  height: number;
  max: number;
  groups: BarGroup[];
}

/**
 * Build grouped (revenue, expenses) bars that fit exactly inside `width`×`height`.
 * Bars grow upward from the bottom (y = height). Returns an empty layout for a
 * zero/negative canvas or empty data so the caller can render nothing safely.
 */
export function buildBarChart(
  data: MonthlySeriesPoint[],
  width: number,
  height: number,
): BarChartLayout {
  if (data.length === 0 || width <= 0 || height <= 0) {
    return { width: Math.max(0, width), height: Math.max(0, height), max: 1, groups: [] };
  }
  const rawMax = Math.max(0, ...data.flatMap((d) => [d.revenue, d.expenses]));
  const max = niceMax(rawMax);
  const groupWidth = width / data.length;
  const sidePad = groupWidth * 0.16;
  const innerGap = groupWidth * 0.08;
  const barWidth = Math.max(2, (groupWidth - sidePad * 2 - innerGap) / 2);

  const scaleH = (value: number) => {
    const h = (Math.max(0, value) / max) * height;
    return isFinite(h) ? Math.max(0, h) : 0;
  };

  const groups: BarGroup[] = data.map((d, i) => {
    const groupX = i * groupWidth;
    const revH = scaleH(d.revenue);
    const expH = scaleH(d.expenses);
    const revX = groupX + sidePad;
    const expX = revX + barWidth + innerGap;
    return {
      key: d.key,
      label: d.label,
      center: groupX + groupWidth / 2,
      bars: [
        { x: revX, y: height - revH, width: barWidth, height: revH, series: 'revenue', value: d.revenue },
        { x: expX, y: height - expH, width: barWidth, height: expH, series: 'expenses', value: d.expenses },
      ],
    };
  });

  return { width, height, max, groups };
}

// ---------- Profit trend line ----------

export interface LinePoint {
  x: number;
  y: number;
  value: number;
  key: string;
  label: string;
}

export interface LineChartLayout {
  width: number;
  height: number;
  /** SVG path for the profit line. Empty string when there's no data. */
  linePath: string;
  /** Closed path from the line down to the zero baseline, for the soft fill. */
  areaPath: string;
  /** Y pixel of the zero line (profit can be negative). */
  zeroY: number;
  points: LinePoint[];
  min: number;
  max: number;
}

/**
 * Build a profit trend line (net profit can be negative). Coordinates are padded
 * vertically so the stroke isn't clipped, and the zero line is exposed so the
 * caller can draw a dashed baseline and a fill that hugs zero.
 */
export function buildProfitLine(
  data: MonthlySeriesPoint[],
  width: number,
  height: number,
  pad = 8,
): LineChartLayout {
  const empty: LineChartLayout = {
    width: Math.max(0, width),
    height: Math.max(0, height),
    linePath: '',
    areaPath: '',
    zeroY: Math.max(0, height) / 2,
    points: [],
    min: 0,
    max: 0,
  };
  if (data.length === 0 || width <= 0 || height <= 0) return empty;

  const values = data.map((d) => d.netProfit);
  const rawMax = Math.max(0, ...values);
  const rawMin = Math.min(0, ...values);
  const span = rawMax - rawMin || 1;
  const innerH = Math.max(1, height - pad * 2);

  const y = (v: number) => pad + ((rawMax - v) / span) * innerH;
  const x = (i: number) => (data.length === 1 ? width / 2 : (i / (data.length - 1)) * width);

  const points: LinePoint[] = data.map((d, i) => ({
    x: x(i),
    y: y(d.netProfit),
    value: d.netProfit,
    key: d.key,
    label: d.label,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const zeroY = y(0);
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath =
    points.length >= 2
      ? `${linePath} L${last.x.toFixed(2)} ${zeroY.toFixed(2)} L${first.x.toFixed(2)} ${zeroY.toFixed(2)} Z`
      : '';

  return { width, height, linePath, areaPath, zeroY, points, min: rawMin, max: rawMax };
}

// ---------- Compact currency (axis labels) ----------

// The compact chart formatter now lives alongside the canonical money helpers
// (single source of truth for the minor-units convention). Re-exported here so
// existing `@/lib/reports` importers keep working unchanged.
export { formatCompactMoney } from '@/lib/money';
