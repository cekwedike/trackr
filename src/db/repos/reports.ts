/**
 * Read-only aggregate queries that power the Reports and Debtors screens.
 *
 * Everything here is a pure read against the shared SQLite handle — no writes,
 * no schema changes. Money is stored as integer minor units throughout, so the
 * sums stay in minor units and are formatted at the UI edge.
 *
 * Monthly figures deliberately reuse the same month-key helpers and profit math
 * (`monthBounds` + `computeProfit`) that the Profit Calculator uses, so a given
 * month's revenue / COGS / expenses / net profit line up exactly between the two
 * screens.
 */

import { getDb } from '@/db/client';
import { sumExpenses } from '@/db/repos/expenses';
import { sumSales } from '@/db/repos/sales';
import { totalDebts } from '@/db/repos/customers';
import { computeProfit, currentMonthKey, formatMonthKeyShort, monthBounds, shiftMonthKey } from '@/lib/profit';

/** One calendar month of cash-basis figures (minor units). */
export interface MonthlySeriesPoint {
  key: string; // 'YYYY-MM'
  label: string; // short, e.g. "Jul '26"
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
}

/**
 * Revenue / expense / profit series for the last `count` months (oldest first).
 * Reuses `sumSales`, `sumExpenses` and `computeProfit` so the numbers match the
 * Profit Calculator month-for-month.
 */
export async function monthlySeries(count = 6): Promise<MonthlySeriesPoint[]> {
  const n = Math.max(1, Math.floor(count));
  const current = currentMonthKey();
  const points: MonthlySeriesPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = shiftMonthKey(current, -i);
    const { start, end } = monthBounds(key);
    const sales = await sumSales(start, end);
    const expenses = await sumExpenses(start, end);
    const summary = computeProfit(sales.revenue, sales.cogs, expenses);
    points.push({
      key,
      label: formatMonthKeyShort(key),
      revenue: summary.revenue,
      cogs: summary.cogs,
      expenses: summary.expenses,
      grossProfit: summary.grossProfit,
      netProfit: summary.netProfit,
    });
  }
  return points;
}

/** Cash-basis totals for an arbitrary [start, end] window (inclusive ISO bounds). */
export interface PeriodTotals {
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  salesCount: number;
}

export async function periodTotals(start: string, end: string): Promise<PeriodTotals> {
  const sales = await sumSales(start, end);
  const expenses = await sumExpenses(start, end);
  const summary = computeProfit(sales.revenue, sales.cogs, expenses);
  return {
    revenue: summary.revenue,
    cogs: summary.cogs,
    expenses: summary.expenses,
    grossProfit: summary.grossProfit,
    netProfit: summary.netProfit,
    salesCount: sales.count,
  };
}

export type TopProductSort = 'revenue' | 'qty';

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

/**
 * Best-selling products in [start, end], grouped by the (denormalized) line-item
 * name so historical rows survive product deletion. Sortable by revenue or qty.
 */
export async function topProducts(
  start: string,
  end: string,
  limit = 5,
  sort: TopProductSort = 'revenue',
): Promise<TopProduct[]> {
  const db = await getDb();
  const orderBy = sort === 'qty' ? 'qty DESC, revenue DESC' : 'revenue DESC, qty DESC';
  return db.getAllAsync<TopProduct>(
    `SELECT si.name AS name,
            COALESCE(SUM(si.qty), 0) AS qty,
            COALESCE(SUM(si.line_total), 0) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.occurred_at >= ? AND s.occurred_at <= ?
     GROUP BY si.name
     ORDER BY ${orderBy}
     LIMIT ?`,
    [start, end, limit],
  );
}

export interface TopCustomer {
  id: number;
  name: string;
  total: number;
  salesCount: number;
}

/** Highest-spending customers in [start, end] (only sales linked to a customer). */
export async function topCustomers(start: string, end: string, limit = 5): Promise<TopCustomer[]> {
  const db = await getDb();
  return db.getAllAsync<TopCustomer>(
    `SELECT c.id AS id,
            c.name AS name,
            COALESCE(SUM(s.total), 0) AS total,
            COUNT(s.id) AS salesCount
     FROM sales s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.occurred_at >= ? AND s.occurred_at <= ?
     GROUP BY c.id, c.name
     HAVING total > 0
     ORDER BY total DESC
     LIMIT ?`,
    [start, end, limit],
  );
}

/** A customer who currently owes money (debt balance in minor units). */
export interface Receivable {
  id: number;
  name: string;
  phone: string | null;
  amount: number;
}

/** All customers with an outstanding balance, largest debt first. */
export async function outstandingReceivables(): Promise<Receivable[]> {
  const db = await getDb();
  return db.getAllAsync<Receivable>(
    `SELECT id, name, phone, debt_balance AS amount
     FROM customers
     WHERE debt_balance > 0
     ORDER BY debt_balance DESC, name COLLATE NOCASE ASC`,
  );
}

/**
 * Total money owed to the business across all customers (minor units).
 * Reuses the existing `totalDebts` aggregate so the definition of "receivable"
 * stays identical to the rest of the app.
 */
export async function totalReceivable(): Promise<number> {
  return totalDebts();
}
