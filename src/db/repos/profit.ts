import { getDb } from '@/db/client';
import type { ProfitRecord } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface ProfitRecordInput {
  month: string; // 'YYYY-MM'
  revenue: number;
  cogs: number;
  expenses: number;
  net_profit: number;
  allocation: string; // JSON string of AllocationSlice[]
}

/** Insert or update (by month) a monthly profit snapshot, preserving created_at.
 *  Refuses to overwrite when the month is locked. */
export async function upsertProfitRecord(input: ProfitRecordInput): Promise<ProfitRecord> {
  const db = await getDb();
  const existing = await getProfitRecord(input.month);
  if (existing?.locked === 1) {
    throw new Error('This month is locked. Unlock it before saving a new close.');
  }
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO profit_records (month, revenue, cogs, expenses, net_profit, allocation, locked, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(month) DO UPDATE SET
       revenue = excluded.revenue,
       cogs = excluded.cogs,
       expenses = excluded.expenses,
       net_profit = excluded.net_profit,
       allocation = excluded.allocation,
       updated_at = excluded.updated_at
     WHERE profit_records.locked = 0`,
    [input.month, input.revenue, input.cogs, input.expenses, input.net_profit, input.allocation, now, now],
  );
  const row = await getProfitRecord(input.month);
  return row!;
}

/** Lock (close) a month so the snapshot cannot be overwritten until unlocked. */
export async function setProfitRecordLocked(month: string, locked: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE profit_records SET locked = ?, updated_at = ? WHERE month = ?', [
    locked ? 1 : 0,
    nowIso(),
    month,
  ]);
}

/** All saved monthly records, most recent month first. */
export async function listProfitRecords(limit = 60): Promise<ProfitRecord[]> {
  const db = await getDb();
  return db.getAllAsync<ProfitRecord>(
    'SELECT * FROM profit_records ORDER BY month DESC LIMIT ?',
    [limit],
  );
}

/** The saved record for a single month, or null if none has been recorded. */
export async function getProfitRecord(month: string): Promise<ProfitRecord | null> {
  const db = await getDb();
  return db.getFirstAsync<ProfitRecord>('SELECT * FROM profit_records WHERE month = ?', [month]);
}

/** Number of months that have been recorded to profit history. */
export async function countProfitRecords(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM profit_records');
  return row?.c ?? 0;
}
