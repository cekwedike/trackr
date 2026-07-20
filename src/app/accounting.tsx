/**
 * Accounting hub — cash P&L for the current month, category breakdown, and
 * shortcuts into expenses / reports / profit close. Progressive: useful even
 * with little data; never jammed onto day-0 dashboard.
 */
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { FadeSlide } from '@/components/anim';
import {
  AppHeader,
  Button,
  Card,
  Divider,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  StatCard,
  Text,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { expensesByCategory, listExpenses, sumExpenses } from '@/db/repos/expenses';
import { getProfitRecord } from '@/db/repos/profit';
import { periodTotals } from '@/db/repos/reports';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { currentMonthKey, formatMonthKey, monthBounds } from '@/lib/profit';

export default function AccountingScreen() {
  const t = useTheme();
  const { money } = useApp();
  const monthKey = currentMonthKey();

  const { data } = useAsyncData(async () => {
    const { start, end } = monthBounds(monthKey);
    const [totals, byCat, expenses, record] = await Promise.all([
      periodTotals(start, end),
      expensesByCategory(start, end),
      listExpenses(8),
      getProfitRecord(monthKey),
    ]);
    const expenseTotal = await sumExpenses(start, end);
    return { totals, byCat, expenses, record, expenseTotal };
  }, [monthKey]);

  const totals = data?.totals;
  const hasActivity = !!totals && (totals.revenue > 0 || totals.expenses > 0 || totals.salesCount > 0);

  return (
    <Screen>
      <AppHeader title="Accounting" subtitle={`${formatMonthKey(monthKey)} · cash summary`} back />

      <FadeSlide>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
          <StatCard
            style={{ flex: 1 }}
            label="Revenue"
            value={money(totals?.revenue ?? 0)}
            icon="trending-up"
            tone="success"
          />
          <StatCard
            style={{ flex: 1 }}
            label="Expenses"
            value={money(totals?.expenses ?? 0)}
            icon="trending-down"
            tone="danger"
          />
        </View>
        <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="label" color={t.textSecondary}>NET PROFIT (THIS MONTH)</Text>
            {data?.record?.locked === 1 ? (
              <Text variant="caption" color={t.warning}>Month locked</Text>
            ) : null}
          </View>
          <Text
            variant="title"
            color={(totals?.netProfit ?? 0) >= 0 ? t.success : t.danger}
          >
            {money(totals?.netProfit ?? 0)}
          </Text>
          <Text variant="caption" color={t.textMuted}>
            Revenue − COGS − expenses. Figures match Reports and Profit Calculator.
          </Text>
          <Button
            title="Open profit calculator"
            icon="calculator"
            variant="secondary"
            onPress={() => router.push('/profit')}
          />
        </Card>
      </FadeSlide>

      <SectionHeader title="Spend by category" subtitle="This month" />
      {data && data.byCat.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          {data.byCat.map((row, idx) => (
            <View key={row.category}>
              <ListRow
                icon="pricetag"
                iconTone="danger"
                title={row.category}
                right={
                  <Text variant="body" weight="semibold" color={t.danger}>
                    {money(row.total)}
                  </Text>
                }
              />
              {idx < data.byCat.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>
      ) : (
        <Card style={{ marginBottom: Spacing.lg }}>
          <EmptyState
            icon="wallet-outline"
            title="No expenses this month"
            message="Log spending to see category totals and true profit."
            actionLabel="Add expense"
            onAction={() => router.push('/expenses/new')}
          />
        </Card>
      )}

      <SectionHeader title="Recent expenses" />
      {data && data.expenses.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          {data.expenses.map((e, idx) => (
            <View key={e.id}>
              <ListRow
                icon="remove-circle"
                iconTone="danger"
                title={e.description || e.category || 'Expense'}
                subtitle={`${formatDate(e.occurred_at)}${e.tax_rate > 0 ? ` · ${e.tax_rate}% tax` : ''}`}
                onPress={() => router.push(`/expenses/${e.id}`)}
                right={
                  <Text variant="body" weight="semibold" color={t.danger}>
                    {money(e.amount)}
                  </Text>
                }
              />
              {idx < data.expenses.length - 1 ? <Divider /> : null}
            </View>
          ))}
          <Divider />
          <ListRow
            icon="list"
            iconTone="primary"
            title="All expenses"
            onPress={() => router.push('/expenses')}
          />
        </Card>
      ) : null}

      <SectionHeader title="Books" />
      <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
        <ListRow
          icon="wallet"
          iconTone="danger"
          title="Expenses"
          subtitle="Log spend · attach receipts · optional tax %"
          onPress={() => router.push('/expenses')}
        />
        <Divider />
        <ListRow
          icon="repeat"
          iconTone="warning"
          title="Recurring expenses"
          subtitle="Rent, utilities and other bills on a schedule"
          onPress={() => router.push('/recurring' as Href)}
        />
        <Divider />
        <ListRow
          icon="stats-chart"
          iconTone="primary"
          title="Reports"
          subtitle="Trends, top sellers & period P&L"
          onPress={() => router.push('/reports' as Href)}
        />
        <Divider />
        <ListRow
          icon="cash"
          iconTone="warning"
          title="Receivables"
          subtitle="Who owes you money"
          onPress={() => router.push('/debtors' as Href)}
        />
      </Card>

      {!hasActivity ? (
        <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center', marginBottom: Spacing.xl }}>
          Start with a sale or expense — this hub fills in as you bookkeep.
        </Text>
      ) : null}
    </Screen>
  );
}
