import { getDb } from '@/db/client';
import type { Customer } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  birthday?: string | null;
  address?: string | null;
  note?: string | null;
  debt_balance?: number;
}

export async function listCustomers(): Promise<Customer[]> {
  const db = await getDb();
  return db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC');
}

export async function getCustomer(id: number): Promise<Customer | null> {
  const db = await getDb();
  return db.getFirstAsync<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
}

export async function createCustomer(input: CustomerInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO customers (name, phone, email, birthday, address, note, debt_balance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.phone ?? null,
      input.email ?? null,
      input.birthday ?? null,
      input.address ?? null,
      input.note ?? null,
      input.debt_balance ?? 0,
      now,
      now,
    ],
  );
  return res.lastInsertRowId;
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers SET name = ?, phone = ?, email = ?, birthday = ?, address = ?, note = ?, debt_balance = ?, updated_at = ? WHERE id = ?`,
    [
      input.name,
      input.phone ?? null,
      input.email ?? null,
      input.birthday ?? null,
      input.address ?? null,
      input.note ?? null,
      input.debt_balance ?? 0,
      nowIso(),
      id,
    ],
  );
}

export async function adjustDebt(id: number, delta: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE customers SET debt_balance = debt_balance + ?, updated_at = ? WHERE id = ?', [
    delta,
    nowIso(),
    id,
  ]);
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
}

/** Lightweight row for global search results. */
export interface CustomerSearchRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  debt_balance: number;
}

/** Case-insensitive LIKE search over a customer's name, phone, email, address and note. */
export async function searchCustomers(q: string, limit = 20): Promise<CustomerSearchRow[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const like = `%${term}%`;
  return db.getAllAsync<CustomerSearchRow>(
    `SELECT id, name, phone, email, debt_balance
     FROM customers
     WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ? OR note LIKE ?
     ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
    [like, like, like, like, like, limit],
  );
}

export async function totalDebts(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(debt_balance),0) AS total FROM customers WHERE debt_balance > 0',
  );
  return row?.total ?? 0;
}
