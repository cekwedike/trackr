import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FadeSlide, SkeletonList } from '@/components/anim';
import { MovableFab } from '@/components/nav';
import { AppHeader, Card, Chip, EmptyState, ListRow, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import { useAsyncData } from '@/hooks/use-async-data';
import { useFabActions } from '@/hooks/use-fab-actions';
import { useTheme } from '@/hooks/use-theme';

export default function CustomersScreen() {
  const t = useTheme();
  const { money, terms } = useApp();
  const [search, setSearch] = useState('');
  const { data } = useAsyncData(() => listCustomers(), []);
  const fabActions = useFabActions(['customer', 'order', 'sale']);

  const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search));

  return (
    <>
      <Screen>
        <AppHeader title={terms.customers} subtitle={data ? `${data.length} ${terms.customers.toLowerCase()}` : undefined} />
        <TextField value={search} onChangeText={setSearch} placeholder="Search name or phone..." style={{ marginBottom: Spacing.lg }} />
        {!data ? (
          <SkeletonList rows={7} />
        ) : filtered.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {filtered.map((c, idx) => (
              <FadeSlide key={c.id} delay={Math.min(idx * 45, 360)}>
                <ListRow
                  icon="person"
                  iconTone="info"
                  title={c.name}
                  subtitle={c.phone ?? 'No phone'}
                  onPress={() => router.push(`/customers/${c.id}`)}
                  right={c.debt_balance > 0 ? <Chip label={`Owes ${money(c.debt_balance)}`} tone="warning" /> : undefined}
                />
                {idx < filtered.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </FadeSlide>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon="people-outline"
            title={`No ${terms.customers.toLowerCase()}`}
            message={`Keep a database of your ${terms.customers.toLowerCase()}, their birthdays and debts.`}
            actionLabel={`Add ${terms.customer.toLowerCase()}`}
            onAction={() => router.push('/customers/new')}
          />
        )}
      </Screen>
      <MovableFab actions={fabActions} storageKey="customers" />
    </>
  );
}
