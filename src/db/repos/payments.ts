import { getDb } from '@/db/client';
import type { Order, Payment } from '@/db/types';
import { auditMoney, logAudit } from '@/lib/audit';
import { nowIso } from '@/lib/date';

/**
 * Payments repo — records partial payments against an order balance
 * (kind='order') or a customer's outstanding debt (kind='debt').
 *
 * All amounts are integer minor units. Every mutation runs in a transaction and
 * clamps the applied amount so an order can never be overpaid and a debt can
 * never go negative — the amount actually stored in the `payments` row matches
 * the amount applied to the balance so the history always reconciles.
 */

/** Record a payment towards an order and return the freshly-updated order. */
export async function recordOrderPayment(
  orderId: number,
  amount: number,
  method: string,
  note?: string | null,
): Promise<Order | null> {
  const db = await getDb();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const order = await db.getFirstAsync<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return;
    const remaining = Math.max(0, order.total - order.amount_paid);
    const applied = Math.min(Math.max(0, Math.round(amount)), remaining);
    if (applied <= 0) return;
    await db.runAsync(
      `INSERT INTO payments (kind, ref_id, amount, method, note, created_at)
       VALUES ('order', ?, ?, ?, ?, ?)`,
      [orderId, applied, method, note ?? null, now],
    );
    await db.runAsync('UPDATE orders SET amount_paid = ?, updated_at = ? WHERE id = ?', [
      order.amount_paid + applied,
      now,
      orderId,
    ]);
  });
  await logAudit('payment', orderId, 'create', `Recorded order payment of ${await auditMoney(Math.round(amount))}`);
  return db.getFirstAsync<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
}

/** Record a payment towards a customer's debt and return their new balance (minor units). */
export async function recordDebtPayment(
  customerId: number,
  amount: number,
  method: string,
  note?: string | null,
): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ debt_balance: number }>(
      'SELECT debt_balance FROM customers WHERE id = ?',
      [customerId],
    );
    if (!row) return;
    const remaining = Math.max(0, row.debt_balance);
    const applied = Math.min(Math.max(0, Math.round(amount)), remaining);
    if (applied <= 0) return;
    await db.runAsync(
      `INSERT INTO payments (kind, ref_id, amount, method, note, created_at)
       VALUES ('debt', ?, ?, ?, ?, ?)`,
      [customerId, applied, method, note ?? null, now],
    );
    await db.runAsync('UPDATE customers SET debt_balance = ?, updated_at = ? WHERE id = ?', [
      row.debt_balance - applied,
      now,
      customerId,
    ]);
  });
  await logAudit('payment', customerId, 'create', `Recorded debt payment of ${await auditMoney(Math.round(amount))}`);
  void import('@/lib/event-notifications').then((m) => m.syncPaymentsNudge()).catch(() => {});
  const updated = await db.getFirstAsync<{ debt_balance: number }>(
    'SELECT debt_balance FROM customers WHERE id = ?',
    [customerId],
  );
  return updated?.debt_balance ?? 0;
}

/** Payment history for an order or customer, newest first. */
export async function listPayments(kind: 'order' | 'debt', refId: number): Promise<Payment[]> {
  const db = await getDb();
  return db.getAllAsync<Payment>(
    'SELECT * FROM payments WHERE kind = ? AND ref_id = ? ORDER BY created_at DESC, id DESC',
    [kind, refId],
  );
}
