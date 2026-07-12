import { getDb } from '@/db/client';
import type { Product } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface ProductInput {
  name: string;
  category?: string | null;
  sku?: string | null;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  low_stock_threshold: number;
  image_uri?: string | null;
  notes?: string | null;
}

export async function listProducts(includeInactive = false): Promise<Product[]> {
  const db = await getDb();
  const where = includeInactive ? '' : 'WHERE is_active = 1';
  return db.getAllAsync<Product>(`SELECT * FROM products ${where} ORDER BY name COLLATE NOCASE ASC`);
}

export async function getProduct(id: number): Promise<Product | null> {
  const db = await getDb();
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', [id]);
}

export async function createProduct(input: ProductInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO products (name, category, sku, price, cost, stock, unit, low_stock_threshold, image_uri, notes, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      input.name,
      input.category ?? null,
      input.sku ?? null,
      input.price,
      input.cost,
      input.stock,
      input.unit,
      input.low_stock_threshold,
      input.image_uri ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
  return res.lastInsertRowId;
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE products SET name = ?, category = ?, sku = ?, price = ?, cost = ?, stock = ?, unit = ?, low_stock_threshold = ?, image_uri = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [
      input.name,
      input.category ?? null,
      input.sku ?? null,
      input.price,
      input.cost,
      input.stock,
      input.unit,
      input.low_stock_threshold,
      input.image_uri ?? null,
      input.notes ?? null,
      nowIso(),
      id,
    ],
  );
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
}

/** Adjust stock by a delta and log a movement. */
export async function adjustProductStock(id: number, delta: number, reason: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [delta, nowIso(), id]);
  await db.runAsync(
    'INSERT INTO stock_movements (item_type, item_id, change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    ['product', id, delta, reason, nowIso()],
  );
}

export async function listLowStockProducts(): Promise<Product[]> {
  const db = await getDb();
  return db.getAllAsync<Product>(
    'SELECT * FROM products WHERE is_active = 1 AND low_stock_threshold > 0 AND stock <= low_stock_threshold ORDER BY stock ASC',
  );
}
