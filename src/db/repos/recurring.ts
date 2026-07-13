import { getDb } from '@/db/client';
import type { RecurringRule } from '@/db/types';
import { logAudit } from '@/lib/audit';
import { nowIso } from '@/lib/date';

export type Cadence = RecurringRule['cadence'];

/** Fields callers provide when creating/updating a recurring expense rule. */
export interface RecurringRuleInput {
  amount: number; // minor units
  category?: string | null;
  description?: string | null;
  payment_method?: string | null;
  cadence: Cadence;
  /** ISO date/time of the first (or next) run. */
  next_run: string;
}

export async function listRecurringRules(): Promise<RecurringRule[]> {
  const db = await getDb();
  return db.getAllAsync<RecurringRule>(
    'SELECT * FROM recurring_rules ORDER BY active DESC, next_run ASC',
  );
}

export async function getRecurringRule(id: number): Promise<RecurringRule | null> {
  const db = await getDb();
  return db.getFirstAsync<RecurringRule>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
}

export async function createRecurringRule(input: RecurringRuleInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO recurring_rules
       (kind, amount, category, description, payment_method, cadence, next_run, last_run, active, created_at, updated_at)
     VALUES ('expense', ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
    [
      input.amount,
      input.category ?? null,
      input.description ?? null,
      input.payment_method ?? null,
      input.cadence,
      input.next_run,
      now,
      now,
    ],
  );
  await logAudit('recurring', res.lastInsertRowId, 'create', `Created recurring expense (${input.amount})`);
  return res.lastInsertRowId;
}

export async function updateRecurringRule(id: number, patch: RecurringRuleInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE recurring_rules
       SET amount = ?, category = ?, description = ?, payment_method = ?, cadence = ?, next_run = ?, updated_at = ?
     WHERE id = ?`,
    [
      patch.amount,
      patch.category ?? null,
      patch.description ?? null,
      patch.payment_method ?? null,
      patch.cadence,
      patch.next_run,
      nowIso(),
      id,
    ],
  );
  await logAudit('recurring', id, 'update', `Updated recurring expense (${patch.amount})`);
}

export async function deleteRecurringRule(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
  await logAudit('recurring', id, 'delete', 'Deleted recurring expense');
}

export async function setRecurringActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE recurring_rules SET active = ?, updated_at = ? WHERE id = ?', [
    active ? 1 : 0,
    nowIso(),
    id,
  ]);
  await logAudit('recurring', id, 'update', active ? 'Enabled recurring expense' : 'Paused recurring expense');
}

/** Total number of recurring rules (any state). */
export async function countRecurringRules(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM recurring_rules');
  return row?.c ?? 0;
}
