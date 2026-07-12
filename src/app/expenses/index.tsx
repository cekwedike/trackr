import { router } from 'expo-router';
import { View } from 'react-native';

import { AppHeader, Card, Chip, EmptyState, FAB, ListRow, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listExpenses } from '@/db/repos/expenses';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';

export default function ExpensesScreen() {
  const t = useTheme();
  const { money } = useApp();
  const { data } = useAsyncData(() => listExpenses(), []);
  const total = (data ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <Screen>
        <AppHeader title="Expenses" back subtitle={data ? `${data.length} entries · ${money(total)}` : undefined} />
        {data && data.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {data.map((e, idx) => (
              <View key={e.id}>
                <ListRow
                  icon="remove-circle"
                  iconTone="danger"
                  title={e.description || e.category || 'Expense'}
                  subtitle={`${formatDate(e.occurred_at)}`}
                  onPress={() => router.push(`/expenses/${e.id}`)}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text variant="body" weight="bold" color={t.danger}>{money(e.amount)}</Text>
                      {e.category ? <Chip label={e.category} /> : null}
                    </View>
                  }
                />
                {idx < data.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="wallet-outline" title="No expenses yet" message="Log what you spend to see true profit." actionLabel="Add expense" onAction={() => router.push('/expenses/new')} />
        )}
      </Screen>
      <FAB label="Expense" onPress={() => router.push('/expenses/new')} />
    </>
  );
}
