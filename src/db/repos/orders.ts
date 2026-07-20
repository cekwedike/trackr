import { getDb } from '@/db/client';
import type { Order, OrderItem, OrderStatus } from '@/db/types';
import { auditMoney, logAudit } from '@/lib/audit';
import { nowIso } from '@/lib/date';

export interface OrderItemInput {
  product_id: number | null;
  name: string;
  qty: number;
  unit_price: number;
}

export interface OrderInput {
  customer_id: number | null;
  customer_name: string | null;
  status: OrderStatus;
  due_at: string | null;
  amount_paid: number;
  note?: string | null;
  items: OrderItemInput[];
}

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export async function listOrders(): Promise<Order[]> {
  const db = await getDb();
  return db.getAllAsync<Order>('SELECT * FROM orders ORDER BY created_at DESC');
}

export async function getOrder(id: number): Promise<Order | null> {
  const db = await getDb();
  return db.getFirstAsync<Order>('SELECT * FROM orders WHERE id = ?', [id]);
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  return db.getAllAsync<OrderItem>('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [orderId]);
}

function computeTotal(items: OrderItemInput[]): number {
  return items.reduce((sum, it) => sum + Math.round(it.unit_price * it.qty), 0);
}

export async function createOrder(input: OrderInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const total = computeTotal(input.items);
  let orderId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO orders (customer_id, customer_name, status, due_at, total, amount_paid, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.customer_id,
        input.customer_name,
        input.status,
        input.due_at,
        total,
        input.amount_paid,
        input.note ?? null,
        now,
        now,
      ],
    );
    orderId = res.lastInsertRowId;
    for (const it of input.items) {
      await db.runAsync(
        'INSERT INTO order_items (order_id, product_id, name, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, it.product_id, it.name, it.qty, it.unit_price, Math.round(it.unit_price * it.qty)],
      );
    }
  });
  await logAudit(
    'order',
    orderId,
    'create',
    `Created order${input.customer_name ? ` for "${input.customer_name}"` : ''} of ${await auditMoney(total)}`,
  );
  void import('@/lib/event-notifications')
    .then((m) =>
      m.scheduleOrderDueNotification({
        id: orderId,
        customer_name: input.customer_name,
        status: input.status,
        due_at: input.due_at,
      }),
    )
    .catch(() => {});
  return orderId;
}

export async function updateOrder(id: number, input: OrderInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  const total = computeTotal(input.items);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE orders SET customer_id = ?, customer_name = ?, status = ?, due_at = ?, total = ?, amount_paid = ?, note = ?, updated_at = ? WHERE id = ?`,
      [
        input.customer_id,
        input.customer_name,
        input.status,
        input.due_at,
        total,
        input.amount_paid,
        input.note ?? null,
        now,
        id,
      ],
    );
    await db.runAsync('DELETE FROM order_items WHERE order_id = ?', [id]);
    for (const it of input.items) {
      await db.runAsync(
        'INSERT INTO order_items (order_id, product_id, name, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
        [id, it.product_id, it.name, it.qty, it.unit_price, Math.round(it.unit_price * it.qty)],
      );
    }
  });
  await logAudit(
    'order',
    id,
    'update',
    `Updated order${input.customer_name ? ` for "${input.customer_name}"` : ''} to ${await auditMoney(total)}`,
  );
  void import('@/lib/event-notifications')
    .then((m) =>
      m.scheduleOrderDueNotification({
        id,
        customer_name: input.customer_name,
        status: input.status,
        due_at: input.due_at,
      }),
    )
    .catch(() => {});
}

export async function setOrderStatus(id: number, status: OrderStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), id]);
  const label = ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
  await logAudit('order', id, 'update', `Set order status to ${label}`);
  void import('@/lib/event-notifications')
    .then(async (m) => {
      const order = await getOrder(id);
      if (order) await m.scheduleOrderDueNotification(order);
    })
    .catch(() => {});
}

export async function deleteOrder(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM orders WHERE id = ?', [id]);
  await logAudit('order', id, 'delete', 'Deleted order');
  void import('@/lib/event-notifications').then((m) => m.cancelOrderDueNotification(id)).catch(() => {});
}

/** Lightweight row for global search results. */
export interface OrderSearchRow {
  id: number;
  customer_name: string | null;
  status: OrderStatus;
  total: number;
  due_at: string | null;
}

/** Case-insensitive LIKE search over an order's customer name, note and status. */
export async function searchOrders(q: string, limit = 20): Promise<OrderSearchRow[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const like = `%${term}%`;
  return db.getAllAsync<OrderSearchRow>(
    `SELECT id, customer_name, status, total, due_at
     FROM orders
     WHERE customer_name LIKE ? OR note LIKE ? OR status LIKE ?
     ORDER BY created_at DESC LIMIT ?`,
    [like, like, like, limit],
  );
}

export async function countActiveOrders(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM orders WHERE status NOT IN ('delivered','cancelled')",
  );
  return row?.c ?? 0;
}
