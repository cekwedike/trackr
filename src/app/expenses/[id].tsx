import { useLocalSearchParams } from 'expo-router';

import { ExpenseForm } from '@/components/forms/expense-form';
import { AppHeader, Screen, Text } from '@/components/ui';
import { getExpense } from '@/db/repos/expenses';
import { useAsyncData } from '@/hooks/use-async-data';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsyncData(() => getExpense(Number(id)), [id]);

  if (loading) return null;
  if (!data) {
    return (
      <Screen>
        <AppHeader title="Expense" back />
        <Text variant="body">Expense not found.</Text>
      </Screen>
    );
  }
  return <ExpenseForm initial={data} />;
}
