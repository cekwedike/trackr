import type { WidgetKey } from '@/constants/industries';
import type { DashboardData } from '@/lib/dashboard-data';

/** Always shown even on an empty day-0 dashboard. */
const ALWAYS_VISIBLE: ReadonlySet<WidgetKey> = new Set(['hero', 'quickActions']);

/** Whether a secondary widget has enough data to earn a place on the compact dashboard. */
export function widgetHasContent(key: WidgetKey, data: DashboardData): boolean {
  switch (key) {
    case 'hero':
    case 'quickActions':
      return true;
    case 'profit':
    case 'stats':
    case 'ledger':
      return data.salesCount > 0 || data.revenue > 0 || data.expenses > 0;
    case 'pipeline':
      return data.orders.some((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    case 'appointments':
      return data.orders.some(
        (o) => !!o.due_at && o.status !== 'delivered' && o.status !== 'cancelled',
      );
    case 'lowStock':
      return data.restock.length > 0 || data.lowIngredients.length > 0;
    case 'production':
      return data.recipes.length > 0;
    case 'bestSellers':
      return data.best.length > 0;
    case 'clients':
      return data.customers.length > 0;
    case 'debts':
      return data.debts > 0;
    case 'reminders':
      return data.reminders.length > 0;
    case 'expenses':
      return data.expenses > 0 || data.trend.some((p) => p.expenses > 0);
    default:
      return false;
  }
}

/** Filter industry widgets for compact (default) vs expanded dashboard. */
export function visibleWidgets(
  widgets: WidgetKey[],
  data: DashboardData,
  showAll: boolean,
): { visible: WidgetKey[]; hiddenCount: number } {
  if (showAll) return { visible: widgets, hiddenCount: 0 };
  const visible = widgets.filter((k) => ALWAYS_VISIBLE.has(k) || widgetHasContent(k, data));
  return { visible, hiddenCount: Math.max(0, widgets.length - visible.length) };
}
