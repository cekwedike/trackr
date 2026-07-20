import { getDb } from '@/db/client';
import type { PaymentMethod, Sale, SaleItem } from '@/db/types';
import { auditMoney, logAudit } from '@/lib/audit';
import { nowIso } from '@/lib/date';

export interface SaleItemInput {
  product_id: number | null;
  name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
}

export interface SaleInput {
  occurred_at: string;
  payment_method: PaymentMethod;
  customer_id: number | null;
  note?: string | null;
  items: SaleItemInput[];
}

export interface SaleWithMeta extends Sale {
  item_count: number;
  customer_name: string | null;
}

export async function listSales(limit = 200): Promise<SaleWithMeta[]> {
  const db = await getDb();
  return db.getAllAsync<SaleWithMeta>(
    `SELECT s.*, c.name AS customer_name,
       (SELECT COALESCE(SUM(qty),0) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     ORDER BY s.occurred_at DESC LIMIT ?`,
    [limit],
  );
}

export async function getSale(id: number): Promise<Sale | null> {
  const db = await getDb();
  return db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', [id]);
}

export async function getSaleItems(saleId: number): Promise<SaleItem[]> {
  const db = await getDb();
  return db.getAllAsync<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC', [saleId]);
}

export async function createSale(input: SaleInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const total = input.items.reduce((sum, it) => sum + Math.round(it.unit_price * it.qty), 0);
  const costTotal = input.items.reduce((sum, it) => sum + Math.round(it.unit_cost * it.qty), 0);

  let saleId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO sales (occurred_at, payment_method, customer_id, total, cost_total, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.occurred_at, input.payment_method, input.customer_id, total, costTotal, input.note ?? null, now],
    );
    saleId = res.lastInsertRowId;

    for (const it of input.items) {
      const lineTotal = Math.round(it.unit_price * it.qty);
      await db.runAsync(
        `INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [saleId, it.product_id, it.name, it.qty, it.unit_price, it.unit_cost, lineTotal],
      );
      if (it.product_id) {
        await db.runAsync('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?', [
          it.qty,
          now,
          it.product_id,
        ]);
        await db.runAsync(
          'INSERT INTO stock_movements (item_type, item_id, change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
          ['product', it.product_id, -it.qty, 'Sale', now],
        );
      }
    }

    if (input.customer_id && input.payment_method === 'credit') {
      await db.runAsync('UPDATE customers SET debt_balance = debt_balance + ?, updated_at = ? WHERE id = ?', [
        total,
        now,
        input.customer_id,
      ]);
    }
  });
  await logAudit('sale', saleId, 'create', `Recorded sale of ${await auditMoney(total)}`);
  void import('@/lib/event-notifications')
    .then(async (m) => {
      await m.maybeNotifyLowStockForProducts(input.items.map((it) => it.product_id));
      if (input.customer_id && input.payment_method === 'credit') await m.syncPaymentsNudge();
    })
    .catch(() => {});
  return saleId;
}

export async function deleteSale(id: number): Promise<void> {
  const db = await getDb();
  const sale = await getSale(id);
  if (!sale) return;
  const items = await getSaleItems(id);
  const now = nowIso();

  await db.withTransactionAsync(async () => {
    // Reverse the stock decrement `createSale` applied for each product line.
    for (const it of items) {
      if (it.product_id) {
        await db.runAsync('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [
          it.qty,
          now,
          it.product_id,
        ]);
        await db.runAsync(
          'INSERT INTO stock_movements (item_type, item_id, change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
          ['product', it.product_id, it.qty, 'Sale deleted', now],
        );
      }
    }

    // Reverse the debt `createSale` added for credit sales (basis: sale total).
    if (sale.customer_id && sale.payment_method === 'credit') {
      await db.runAsync('UPDATE customers SET debt_balance = debt_balance - ?, updated_at = ? WHERE id = ?', [
        sale.total,
        now,
        sale.customer_id,
      ]);
    }

    // sale_items rows are removed via ON DELETE CASCADE.
    await db.runAsync('DELETE FROM sales WHERE id = ?', [id]);
  });
  await logAudit('sale', id, 'delete', `Deleted sale of ${await auditMoney(sale.total)}`);
  void import('@/lib/event-notifications')
    .then(async (m) => {
      await m.maybeNotifyLowStockForProducts(items.map((it) => it.product_id));
      if (sale.customer_id && sale.payment_method === 'credit') await m.syncPaymentsNudge();
    })
    .catch(() => {});
}

/**
 * Replace an existing sale in place: reverse prior stock/debt effects, rewrite
 * header + line items, then apply the new effects. Keeps the same sale id so
 * attachments stay linked.
 */
export async function updateSale(id: number, input: SaleInput): Promise<void> {
  const db = await getDb();
  const sale = await getSale(id);
  if (!sale) return;
  const oldItems = await getSaleItems(id);
  const now = nowIso();
  const total = input.items.reduce((sum, it) => sum + Math.round(it.unit_price * it.qty), 0);
  const costTotal = input.items.reduce((sum, it) => sum + Math.round(it.unit_cost * it.qty), 0);

  await db.withTransactionAsync(async () => {
    for (const it of oldItems) {
      if (it.product_id) {
        await db.runAsync('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [
          it.qty,
          now,
          it.product_id,
        ]);
        await db.runAsync(
          'INSERT INTO stock_movements (item_type, item_id, change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
          ['product', it.product_id, it.qty, 'Sale edited (reverse)', now],
        );
      }
    }

    if (sale.customer_id && sale.payment_method === 'credit') {
      await db.runAsync('UPDATE customers SET debt_balance = debt_balance - ?, updated_at = ? WHERE id = ?', [
        sale.total,
        now,
        sale.customer_id,
      ]);
    }

    await db.runAsync('DELETE FROM sale_items WHERE sale_id = ?', [id]);
    await db.runAsync(
      `UPDATE sales SET occurred_at = ?, payment_method = ?, customer_id = ?, total = ?, cost_total = ?, note = ?
       WHERE id = ?`,
      [input.occurred_at, input.payment_method, input.customer_id, total, costTotal, input.note ?? null, id],
    );

    for (const it of input.items) {
      const lineTotal = Math.round(it.unit_price * it.qty);
      await db.runAsync(
        `INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, it.product_id, it.name, it.qty, it.unit_price, it.unit_cost, lineTotal],
      );
      if (it.product_id) {
        await db.runAsync('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?', [
          it.qty,
          now,
          it.product_id,
        ]);
        await db.runAsync(
          'INSERT INTO stock_movements (item_type, item_id, change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
          ['product', it.product_id, -it.qty, 'Sale edited', now],
        );
      }
    }

    if (input.customer_id && input.payment_method === 'credit') {
      await db.runAsync('UPDATE customers SET debt_balance = debt_balance + ?, updated_at = ? WHERE id = ?', [
        total,
        now,
        input.customer_id,
      ]);
    }
  });

  await logAudit('sale', id, 'update', `Updated sale of ${await auditMoney(total)}`);
  const productIds = [
    ...oldItems.map((it) => it.product_id),
    ...input.items.map((it) => it.product_id),
  ];
  void import('@/lib/event-notifications')
    .then(async (m) => {
      await m.maybeNotifyLowStockForProducts(productIds);
      if (
        (sale.customer_id && sale.payment_method === 'credit') ||
        (input.customer_id && input.payment_method === 'credit')
      ) {
        await m.syncPaymentsNudge();
      }
    })
    .catch(() => {});
}

/** Lightweight row for global search results. */
export interface SaleSearchRow {
  id: number;
  occurred_at: string;
  total: number;
  customer_name: string | null;
  note: string | null;
}

/** Case-insensitive LIKE search over a sale's note and its customer's name. */
export async function searchSales(q: string, limit = 20): Promise<SaleSearchRow[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const like = `%${term}%`;
  return db.getAllAsync<SaleSearchRow>(
    `SELECT s.id, s.occurred_at, s.total, s.note, c.name AS customer_name
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.note LIKE ? OR c.name LIKE ?
     ORDER BY s.occurred_at DESC LIMIT ?`,
    [like, like, limit],
  );
}

/** Sales linked to a customer, newest first (for customer timeline). */
export async function listSalesForCustomer(customerId: number, limit = 50): Promise<Sale[]> {
  const db = await getDb();
  return db.getAllAsync<Sale>(
    'SELECT * FROM sales WHERE customer_id = ? ORDER BY occurred_at DESC LIMIT ?',
    [customerId, limit],
  );
}

/** Total number of recorded sales. */
export async function countSales(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sales');
  return row?.c ?? 0;
}

/** Sum of sale totals and COGS within [start, end). */
export async function sumSales(start: string, end: string): Promise<{ revenue: number; cogs: number; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ revenue: number; cogs: number; count: number }>(
    `SELECT COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(cost_total),0) AS cogs, COUNT(*) AS count
     FROM sales WHERE occurred_at >= ? AND occurred_at <= ?`,
    [start, end],
  );
  return row ?? { revenue: 0, cogs: 0, count: 0 };
}
