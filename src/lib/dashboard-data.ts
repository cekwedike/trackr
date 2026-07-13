import { bestSellers, monthlyTrends, type BestSeller, type MonthlyPoint } from '@/db/repos/analytics';
import { totalDebts, listCustomers } from '@/db/repos/customers';
import { sumExpenses } from '@/db/repos/expenses';
import { listLowIngredients } from '@/db/repos/ingredients';
import { countActiveOrders, listOrders } from '@/db/repos/orders';
import { listLowStockProducts, suggestedReorder } from '@/db/repos/products';
import { listRecipes } from '@/db/repos/recipes';
import { upcomingReminders } from '@/db/repos/reminders';
import { sumSales } from '@/db/repos/sales';
import type { AllocationBucket, Customer, Ingredient, Order, Product, Recipe, Reminder } from '@/db/types';
import { rangeBounds, type RangeKey } from '@/lib/date';
import { computeProfit, parseAllocation, type ProfitSummary } from '@/lib/profit';

/** A product that is at/below its low-stock threshold, with a suggested reorder qty. */
export interface RestockSuggestion {
  product: Product;
  suggested: number;
}

export const EMPTY_DASHBOARD: DashboardData = {
  revenue: 0,
  cogs: 0,
  salesCount: 0,
  expenses: 0,
  profit: computeProfit(0, 0, 0),
  lowProducts: [],
  restock: [],
  lowIngredients: [],
  activeOrders: 0,
  orders: [],
  debts: 0,
  customers: [],
  reminders: [],
  best: [],
  recipes: [],
  trend: [],
  allocation: parseAllocation(undefined),
};

export interface DashboardData {
  revenue: number;
  cogs: number;
  salesCount: number;
  expenses: number;
  profit: ProfitSummary;
  lowProducts: Product[];
  /** Actionable restock list derived from `lowProducts` (product + suggested reorder qty). */
  restock: RestockSuggestion[];
  lowIngredients: Ingredient[];
  activeOrders: number;
  orders: Order[];
  debts: number;
  customers: Customer[];
  reminders: Reminder[];
  best: BestSeller[];
  recipes: Recipe[];
  trend: MonthlyPoint[];
  allocation: AllocationBucket[];
}

export async function loadDashboard(range: RangeKey, allocationJson: string | null | undefined): Promise<DashboardData> {
  const { start, end } = rangeBounds(range);
  const [sales, expenses, lowProducts, lowIngredients, activeOrders, orders, debts, customers, reminders, best, recipes, trend] =
    await Promise.all([
      sumSales(start, end),
      sumExpenses(start, end),
      listLowStockProducts(),
      listLowIngredients(),
      countActiveOrders(),
      listOrders(),
      totalDebts(),
      listCustomers(),
      upcomingReminders(3),
      bestSellers(start, end, 5),
      listRecipes(),
      monthlyTrends(6),
    ]);

  return {
    revenue: sales.revenue,
    cogs: sales.cogs,
    salesCount: sales.count,
    expenses,
    profit: computeProfit(sales.revenue, sales.cogs, expenses),
    lowProducts,
    restock: lowProducts.map((p) => ({ product: p, suggested: suggestedReorder(p) })),
    lowIngredients,
    activeOrders,
    orders,
    debts,
    customers,
    reminders,
    best,
    recipes,
    trend,
    allocation: parseAllocation(allocationJson),
  };
}
