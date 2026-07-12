import { getDb } from '@/db/client';
import { lastMonths } from '@/lib/date';
import { sumExpenses } from '@/db/repos/expenses';
import { sumSales } from '@/db/repos/sales';

export interface BestSeller {
  name: string;
  qty: number;
  revenue: number;
}

export async function bestSellers(start: string, end: string, limit = 5): Promise<BestSeller[]> {
  const db = await getDb();
  return db.getAllAsync<BestSeller>(
    `SELECT si.name AS name, COALESCE(SUM(si.qty),0) AS qty, COALESCE(SUM(si.line_total),0) AS revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.occurred_at >= ? AND s.occurred_at <= ?
     GROUP BY si.name ORDER BY qty DESC LIMIT ?`,
    [start, end, limit],
  );
}

export interface MonthlyPoint {
  key: string;
  label: string;
  revenue: number;
  cogs: number;
  expenses: number;
  profit: number;
}

export async function monthlyTrends(count = 6): Promise<MonthlyPoint[]> {
  const buckets = lastMonths(count);
  const points: MonthlyPoint[] = [];
  for (const b of buckets) {
    const sales = await sumSales(b.start, b.end);
    const expenses = await sumExpenses(b.start, b.end);
    points.push({
      key: b.key,
      label: b.label,
      revenue: sales.revenue,
      cogs: sales.cogs,
      expenses,
      profit: sales.revenue - sales.cogs - expenses,
    });
  }
  return points;
}

export interface PaymentBreakdown {
  method: string;
  total: number;
}

export async function paymentBreakdown(start: string, end: string): Promise<PaymentBreakdown[]> {
  const db = await getDb();
  return db.getAllAsync<PaymentBreakdown>(
    `SELECT payment_method AS method, COALESCE(SUM(total),0) AS total
     FROM sales WHERE occurred_at >= ? AND occurred_at <= ?
     GROUP BY payment_method ORDER BY total DESC`,
    [start, end],
  );
}
