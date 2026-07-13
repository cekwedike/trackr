import { getDb } from '@/db/client';
import type { Product } from '@/db/types';
import { logAudit } from '@/lib/audit';
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
  await logAudit('product', res.lastInsertRowId, 'create', `Added product "${input.name}"`);
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
  await logAudit('product', id, 'update', `Updated product "${input.name}"`);
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
  await logAudit('product', id, 'delete', 'Deleted product');
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

/**
 * Suggested quantity to reorder for a low/out-of-stock product: enough to bring
 * stock comfortably back above its threshold (a two-threshold safety buffer),
 * never less than 1. Pure — safe to call from UI + aggregation code.
 */
export function suggestedReorder(product: Pick<Product, 'stock' | 'low_stock_threshold'>): number {
  const target = Math.max(product.low_stock_threshold * 2, product.low_stock_threshold + 1);
  return Math.max(Math.ceil(target - product.stock), 1);
}

/** Increase a product's stock by `qty` (a restock) and log the movement. Thin wrapper over {@link adjustProductStock}. */
export async function restockProduct(id: number, qty: number): Promise<void> {
  if (!(qty > 0)) return;
  await adjustProductStock(id, qty, 'Restock');
}

/** Lightweight row for global search results. */
export interface ProductSearchRow {
  id: number;
  name: string;
  category: string | null;
  sku: string | null;
  price: number;
  stock: number;
  unit: string;
}

/** Case-insensitive LIKE search over an active product's name, category, SKU and notes. */
export async function searchProducts(q: string, limit = 20): Promise<ProductSearchRow[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const like = `%${term}%`;
  return db.getAllAsync<ProductSearchRow>(
    `SELECT id, name, category, sku, price, stock, unit
     FROM products
     WHERE is_active = 1 AND (name LIKE ? OR category LIKE ? OR sku LIKE ? OR notes LIKE ?)
     ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
    [like, like, like, like, limit],
  );
}

/** Total number of active products. */
export async function countProducts(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM products WHERE is_active = 1');
  return row?.c ?? 0;
}

export async function listLowStockProducts(): Promise<Product[]> {
  const db = await getDb();
  return db.getAllAsync<Product>(
    'SELECT * FROM products WHERE is_active = 1 AND low_stock_threshold > 0 AND stock <= low_stock_threshold ORDER BY stock ASC',
  );
}
