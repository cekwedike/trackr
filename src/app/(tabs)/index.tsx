import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, EmptyState, IconName, ListRow, Screen, SectionHeader, Segmented, StatCard, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listLowStockProducts } from '@/db/repos/products';
import { listLowIngredients } from '@/db/repos/ingredients';
import { sumSales } from '@/db/repos/sales';
import { sumExpenses } from '@/db/repos/expenses';
import { countActiveOrders } from '@/db/repos/orders';
import { totalDebts } from '@/db/repos/customers';
import { upcomingReminders } from '@/db/repos/reminders';
import { useTheme } from '@/hooks/use-theme';
import { useAsyncData } from '@/hooks/use-async-data';
import { fromNow, rangeBounds, type RangeKey } from '@/lib/date';
import { computeProfit } from '@/lib/profit';

export default function Dashboard() {
  const t = useTheme();
  const { settings, money } = useApp();
  const [range, setRange] = useState<RangeKey>('month');

  const { data } = useAsyncData(async () => {
    const { start, end } = rangeBounds(range);
    const [sales, expenses, lowProducts, lowIngredients, activeOrders, debts, reminders] = await Promise.all([
      sumSales(start, end),
      sumExpenses(start, end),
      listLowStockProducts(),
      listLowIngredients(),
      countActiveOrders(),
      totalDebts(),
      upcomingReminders(3),
    ]);
    const profit = computeProfit(sales.revenue, sales.cogs, expenses);
    return { sales, expenses, profit, lowProducts, lowIngredients, activeOrders, debts, reminders };
  }, [range]);

  const rangeOptions: { value: RangeKey; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  const lowCount = (data?.lowProducts.length ?? 0) + (data?.lowIngredients.length ?? 0);

  return (
    <Screen>
      <View style={{ marginBottom: Spacing.lg }}>
        <Text variant="caption" color={t.textSecondary}>Welcome back</Text>
        <Text variant="title">{settings?.business_name ?? 'Trackr'}</Text>
      </View>

      <View style={{ marginBottom: Spacing.lg }}>
        <Segmented value={range} onChange={setRange} options={rangeOptions} />
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md }}>
        <StatCard style={{ flex: 1 }} label="Revenue" value={money(data?.sales.revenue ?? 0)} icon="trending-up" tone="success" />
        <StatCard style={{ flex: 1 }} label="Expenses" value={money(data?.expenses ?? 0)} icon="trending-down" tone="danger" />
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
        <StatCard
          style={{ flex: 1 }}
          label="Net profit"
          value={money(data?.profit.netProfit ?? 0)}
          icon="cash"
          tone={(data?.profit.netProfit ?? 0) >= 0 ? 'primary' : 'danger'}
          sub={data ? `${Math.round(data.profit.margin * 100)}% margin` : undefined}
        />
        <StatCard style={{ flex: 1 }} label="Sales count" value={String(data?.sales.count ?? 0)} icon="receipt" tone="accent" />
      </View>

      <SectionHeader title="Quick actions" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl }}>
        <QuickAction icon="cart" label="New sale" onPress={() => router.push('/sales/new')} />
        <QuickAction icon="remove-circle" label="Expense" onPress={() => router.push('/expenses/new')} />
        <QuickAction icon="cube" label="Product" onPress={() => router.push('/products/new')} />
        <QuickAction icon="calculator" label="Profit" onPress={() => router.push('/profit')} />
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
        <StatCard style={{ flex: 1 }} label="Active orders" value={String(data?.activeOrders ?? 0)} icon="clipboard" tone="info" />
        <StatCard style={{ flex: 1 }} label="Owed to you" value={money(data?.debts ?? 0)} icon="wallet" tone="warning" />
      </View>

      {lowCount > 0 ? (
        <Card style={{ marginBottom: Spacing.xl, gap: Spacing.xs }}>
          <SectionHeader title="Low stock alerts" action="Inventory" onAction={() => router.push('/inventory')} />
          {data?.lowProducts.slice(0, 3).map((p) => (
            <ListRow
              key={`p${p.id}`}
              icon="cube"
              iconTone="warning"
              title={p.name}
              subtitle={`${p.stock} ${p.unit} left (min ${p.low_stock_threshold})`}
              onPress={() => router.push(`/products/${p.id}`)}
            />
          ))}
          {data?.lowIngredients.slice(0, 3).map((i) => (
            <ListRow
              key={`i${i.id}`}
              icon="flask"
              iconTone="warning"
              title={i.name}
              subtitle={`${i.qty_on_hand} ${i.unit} left (min ${i.reorder_threshold})`}
              onPress={() => router.push(`/ingredients/${i.id}`)}
            />
          ))}
        </Card>
      ) : null}

      <SectionHeader title="Upcoming reminders" action="See all" onAction={() => router.push('/reminders')} />
      <Card>
        {data && data.reminders.length > 0 ? (
          data.reminders.map((r) => (
            <ListRow
              key={r.id}
              icon="alarm"
              iconTone="primary"
              title={r.title}
              subtitle={fromNow(r.due_at)}
              onPress={() => router.push('/reminders')}
            />
          ))
        ) : (
          <EmptyState icon="alarm-outline" title="No reminders" message="Set reminders for restocks, payments and follow-ups." actionLabel="Add reminder" onAction={() => router.push('/reminders/new')} />
        )}
      </Card>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={onPress} style={{ width: '47%', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={t.primary} />
      </View>
      <Text variant="label">{label}</Text>
    </Card>
  );
}
