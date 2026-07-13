import { getDb } from '@/db/client';
import type { Expense } from '@/db/types';
import { auditMoney, logAudit } from '@/lib/audit';
import { nowIso } from '@/lib/date';

export interface ExpenseInput {
  occurred_at: string;
  amount: number;
  description?: string | null;
  category?: string | null;
  payment_method?: string | null;
}

export const EXPENSE_CATEGORIES = [
  'Ingredients',
  'Supplies',
  'Rent',
  'Utilities',
  'Transport',
  'Salaries',
  'Marketing',
  'Equipment',
  'Fees',
  'Other',
];

export async function listExpenses(limit = 300): Promise<Expense[]> {
  const db = await getDb();
  return db.getAllAsync<Expense>('SELECT * FROM expenses ORDER BY occurred_at DESC LIMIT ?', [limit]);
}

export async function getExpense(id: number): Promise<Expense | null> {
  const db = await getDb();
  return db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
}

export async function createExpense(input: ExpenseInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO expenses (occurred_at, amount, description, category, payment_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.occurred_at, input.amount, input.description ?? null, input.category ?? null, input.payment_method ?? null, nowIso()],
  );
  await logAudit('expense', res.lastInsertRowId, 'create', `Recorded expense of ${await auditMoney(input.amount)}`);
  return res.lastInsertRowId;
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE expenses SET occurred_at = ?, amount = ?, description = ?, category = ?, payment_method = ? WHERE id = ?`,
    [input.occurred_at, input.amount, input.description ?? null, input.category ?? null, input.payment_method ?? null, id],
  );
  await logAudit('expense', id, 'update', `Updated expense to ${await auditMoney(input.amount)}`);
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  await logAudit('expense', id, 'delete', 'Deleted expense');
}

/** Lightweight row for global search results. */
export interface ExpenseSearchRow {
  id: number;
  occurred_at: string;
  amount: number;
  description: string | null;
  category: string | null;
}

/** Case-insensitive LIKE search over an expense's description, category and payment method. */
export async function searchExpenses(q: string, limit = 20): Promise<ExpenseSearchRow[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const like = `%${term}%`;
  return db.getAllAsync<ExpenseSearchRow>(
    `SELECT id, occurred_at, amount, description, category
     FROM expenses
     WHERE description LIKE ? OR category LIKE ? OR payment_method LIKE ?
     ORDER BY occurred_at DESC LIMIT ?`,
    [like, like, like, limit],
  );
}

/** Total number of recorded expenses. */
export async function countExpenses(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM expenses');
  return row?.c ?? 0;
}

export async function sumExpenses(start: string, end: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE occurred_at >= ? AND occurred_at <= ?',
    [start, end],
  );
  return row?.total ?? 0;
}

export async function expensesByCategory(start: string, end: string): Promise<{ category: string; total: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ category: string; total: number }>(
    `SELECT COALESCE(category,'Other') AS category, COALESCE(SUM(amount),0) AS total
     FROM expenses WHERE occurred_at >= ? AND occurred_at <= ?
     GROUP BY COALESCE(category,'Other') ORDER BY total DESC`,
    [start, end],
  );
}
