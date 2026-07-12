import { getDb } from '@/db/client';
import type { Ingredient } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface IngredientInput {
  name: string;
  unit: string;
  qty_on_hand: number;
  unit_cost: number;
  reorder_threshold: number;
  notes?: string | null;
}

export async function listIngredients(): Promise<Ingredient[]> {
  const db = await getDb();
  return db.getAllAsync<Ingredient>('SELECT * FROM ingredients ORDER BY name COLLATE NOCASE ASC');
}

export async function getIngredient(id: number): Promise<Ingredient | null> {
  const db = await getDb();
  return db.getFirstAsync<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [id]);
}

export async function createIngredient(input: IngredientInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO ingredients (name, unit, qty_on_hand, unit_cost, reorder_threshold, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.name, input.unit, input.qty_on_hand, input.unit_cost, input.reorder_threshold, input.notes ?? null, now, now],
  );
  return res.lastInsertRowId;
}

export async function updateIngredient(id: number, input: IngredientInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ingredients SET name = ?, unit = ?, qty_on_hand = ?, unit_cost = ?, reorder_threshold = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [input.name, input.unit, input.qty_on_hand, input.unit_cost, input.reorder_threshold, input.notes ?? null, nowIso(), id],
  );
}

export async function deleteIngredient(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM ingredients WHERE id = ?', [id]);
}

export async function adjustIngredientStock(id: number, delta: number, reason: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE ingredients SET qty_on_hand = qty_on_hand + ?, updated_at = ? WHERE id = ?', [
    delta,
    nowIso(),
    id,
  ]);
  await db.runAsync(
    'INSERT INTO stock_movements (item_type, item_id, change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    ['ingredient', id, delta, reason, nowIso()],
  );
}

export async function listLowIngredients(): Promise<Ingredient[]> {
  const db = await getDb();
  return db.getAllAsync<Ingredient>(
    'SELECT * FROM ingredients WHERE reorder_threshold > 0 AND qty_on_hand <= reorder_threshold ORDER BY qty_on_hand ASC',
  );
}
