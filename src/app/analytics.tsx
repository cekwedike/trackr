import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, Card, Chip, Divider, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { bestSellers, monthlyTrends, paymentBreakdown, type MonthlyPoint } from '@/db/repos/analytics';
import { expensesByCategory } from '@/db/repos/expenses';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { rangeBounds, type RangeKey } from '@/lib/date';

export default function Analytics() {
  const t = useTheme();
  const { money } = useApp();
  const [range, setRange] = useState<RangeKey>('month');

  const { data } = useAsyncData(async () => {
    const { start, end } = rangeBounds(range);
    const [trends, sellers, payments, categories] = await Promise.all([
      monthlyTrends(6),
      bestSellers(start, end, 5),
      paymentBreakdown(start, end),
      expensesByCategory(start, end),
    ]);
    return { trends, sellers, payments, categories };
  }, [range]);

  const trends = data?.trends ?? [];
  const thisMonth = trends[trends.length - 1]?.profit ?? 0;
  const lastMonth = trends[trends.length - 2]?.profit ?? 0;
  const growth = lastMonth !== 0 ? ((thisMonth - lastMonth) / Math.abs(lastMonth)) * 100 : thisMonth > 0 ? 100 : 0;

  const hasData = trends.some((p) => p.revenue || p.expenses);

  return (
    <Screen>
      <AppHeader title="Analytics" back />

      <SectionHeader title="Monthly trend (6 months)" />
      <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
        {hasData ? (
          <>
            <TrendChart points={trends} />
            <View style={{ flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' }}>
              <Legend color={t.success} label="Revenue" />
              <Legend color={t.danger} label="Expenses" />
              <Legend color={t.primary} label="Profit" />
            </View>
          </>
        ) : (
          <Text variant="caption" color={t.textMuted}>Record sales and expenses to see trends.</Text>
        )}
      </Card>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
        <View>
          <Text variant="caption" color={t.textSecondary}>Monthly growth</Text>
          <Text variant="caption" color={t.textMuted}>Profit vs last month</Text>
        </View>
        <Chip label={`${growth >= 0 ? '+' : ''}${Math.round(growth)}%`} tone={growth >= 0 ? 'success' : 'danger'} icon={growth >= 0 ? 'trending-up' : 'trending-down'} />
      </Card>

      <View style={{ marginBottom: Spacing.lg }}>
        <Segmented value={range} onChange={setRange} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'all', label: 'All' }]} scroll />
      </View>

      <SectionHeader title="Best sellers" />
      <Card style={{ marginBottom: Spacing.lg }}>
        {data && data.sellers.length > 0 ? (
          data.sellers.map((s, idx) => (
            <View key={s.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
                  <Text variant="subtitle" color={t.textMuted} style={{ width: 24 }}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>{s.name}</Text>
                    <Text variant="caption" color={t.textSecondary}>{s.qty} sold</Text>
                  </View>
                </View>
                <Text variant="body" weight="semibold" color={t.success}>{money(s.revenue)}</Text>
              </View>
              {idx < data.sellers.length - 1 ? <Divider /> : null}
            </View>
          ))
        ) : (
          <Text variant="caption" color={t.textMuted}>No sales in this period.</Text>
        )}
      </Card>

      <SectionHeader title="Payment methods" />
      <Card style={{ marginBottom: Spacing.lg }}>
        {data && data.payments.length > 0 ? (
          data.payments.map((p, idx) => (
            <View key={p.method}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm }}>
                <Text variant="body" style={{ textTransform: 'capitalize' }}>{p.method}</Text>
                <Text variant="body" weight="semibold">{money(p.total)}</Text>
              </View>
              {idx < data.payments.length - 1 ? <Divider /> : null}
            </View>
          ))
        ) : (
          <Text variant="caption" color={t.textMuted}>No sales in this period.</Text>
        )}
      </Card>

      <SectionHeader title="Expenses by category" />
      <Card>
        {data && data.categories.length > 0 ? (
          data.categories.map((c, idx) => (
            <View key={c.category}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm }}>
                <Text variant="body">{c.category}</Text>
                <Text variant="body" weight="semibold" color={t.danger}>{money(c.total)}</Text>
              </View>
              {idx < data.categories.length - 1 ? <Divider /> : null}
            </View>
          ))
        ) : (
          <Text variant="caption" color={t.textMuted}>No expenses in this period.</Text>
        )}
      </Card>
    </Screen>
  );
}

function TrendChart({ points }: { points: MonthlyPoint[] }) {
  const t = useTheme();
  const max = Math.max(1, ...points.map((p) => Math.max(p.revenue, p.expenses, Math.abs(p.profit))));
  const H = 120;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: H + 24 }}>
      {points.map((p) => (
        <View key={p.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: H }}>
            <Bar height={(p.revenue / max) * H} color={t.success} />
            <Bar height={(p.expenses / max) * H} color={t.danger} />
            <Bar height={(Math.max(0, p.profit) / max) * H} color={t.primary} />
          </View>
          <Text variant="caption" color={t.textMuted}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Bar({ height, color }: { height: number; color: string }) {
  return <View style={{ width: 7, height: Math.max(2, height), backgroundColor: color, borderRadius: Radius.sm }} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" color={t.textSecondary}>{label}</Text>
    </View>
  );
}
