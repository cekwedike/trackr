import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, Card, Chip, EmptyState, FAB, ListRow, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';

export default function CustomersScreen() {
  const t = useTheme();
  const { money } = useApp();
  const [search, setSearch] = useState('');
  const { data } = useAsyncData(() => listCustomers(), []);

  const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search));

  return (
    <>
      <Screen>
        <AppHeader title="Customers" back subtitle={data ? `${data.length} contacts` : undefined} />
        <TextField value={search} onChangeText={setSearch} placeholder="Search name or phone..." style={{ marginBottom: Spacing.lg }} />
        {filtered.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {filtered.map((c, idx) => (
              <View key={c.id}>
                <ListRow
                  icon="person"
                  iconTone="info"
                  title={c.name}
                  subtitle={c.phone ?? 'No phone'}
                  onPress={() => router.push(`/customers/${c.id}`)}
                  right={c.debt_balance > 0 ? <Chip label={`Owes ${money(c.debt_balance)}`} tone="warning" /> : undefined}
                />
                {idx < filtered.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="people-outline" title="No customers" message="Keep a database of your customers, their birthdays and debts." actionLabel="Add customer" onAction={() => router.push('/customers/new')} />
        )}
      </Screen>
      <FAB label="Customer" onPress={() => router.push('/customers/new')} />
    </>
  );
}
