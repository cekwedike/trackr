import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(relativeTime);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export type RangeKey = 'today' | 'week' | 'month' | 'year' | 'all';

export function nowIso(): string {
  return dayjs().toISOString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return dayjs(iso).format('DD MMM YYYY');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return dayjs(iso).format('DD MMM YYYY, h:mm A');
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return dayjs(iso).format('h:mm A');
}

export function fromNow(iso: string | null | undefined): string {
  if (!iso) return '';
  return dayjs(iso).fromNow();
}

export function monthLabel(iso: string): string {
  return dayjs(iso).format('MMM');
}

/** The selectable dashboard ranges, in display order, with human labels. */
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

/**
 * Resolve a named range to a concrete `{ start, end }` window (ISO strings).
 * A thin, intention-revealing alias over {@link rangeBounds} for call sites that
 * only need the bounds (e.g. data aggregation) and not the display label.
 */
export function resolveRange(key: RangeKey): { start: string; end: string } {
  const { start, end } = rangeBounds(key);
  return { start, end };
}

/** Returns [startInclusiveIso, endExclusiveIso] for a named range relative to now. */
export function rangeBounds(key: RangeKey): { start: string; end: string; label: string } {
  const now = dayjs();
  switch (key) {
    case 'today':
      return { start: now.startOf('day').toISOString(), end: now.endOf('day').toISOString(), label: 'Today' };
    case 'week':
      return { start: now.startOf('week').toISOString(), end: now.endOf('week').toISOString(), label: 'This week' };
    case 'month':
      return { start: now.startOf('month').toISOString(), end: now.endOf('month').toISOString(), label: 'This month' };
    case 'year':
      return { start: now.startOf('year').toISOString(), end: now.endOf('year').toISOString(), label: 'This year' };
    case 'all':
    default:
      return { start: '1970-01-01T00:00:00.000Z', end: now.add(100, 'year').toISOString(), label: 'All time' };
  }
}

/** Last N month buckets (oldest first) as {start, end, label, key}. */
export function lastMonths(count: number): { start: string; end: string; label: string; key: string }[] {
  const buckets = [] as { start: string; end: string; label: string; key: string }[];
  for (let i = count - 1; i >= 0; i--) {
    const m = dayjs().subtract(i, 'month');
    buckets.push({
      start: m.startOf('month').toISOString(),
      end: m.endOf('month').toISOString(),
      label: m.format('MMM'),
      key: m.format('YYYY-MM'),
    });
  }
  return buckets;
}

export { dayjs };
