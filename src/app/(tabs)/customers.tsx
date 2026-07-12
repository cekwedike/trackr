import { router } from 'expo-router';
import { useState } from 'react';

import { SkeletonList } from '@/components/anim';
import { MovableFab } from '@/components/nav';
import { AppHeader, CardList, Chip, EmptyState, ListRow, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import { useAsyncData } from '@/hooks/use-async-data';
import { useQuickActionCandidates } from '@/hooks/use-fab-actions';

export default function CustomersScreen() {
  const { money, terms } = useApp();
  const [search, setSearch] = useState('');
  const { data } = useAsyncData(() => listCustomers(), []);
  const { actions: fabActions, defaultKeys } = useQuickActionCandidates(['customer', 'order', 'sale']);

  const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search));

  return (
    <>
      <Screen>
        <AppHeader title={terms.customers} subtitle={data ? `${data.length} ${terms.customers.toLowerCase()}` : undefined} />
        <TextField value={search} onChangeText={setSearch} placeholder="Search name or phone..." style={{ marginBottom: Spacing.lg }} />
        {!data ? (
          <SkeletonList rows={7} />
        ) : filtered.length > 0 ? (
          <CardList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={(c) => (
              <ListRow
                icon="person"
                iconTone="info"
                title={c.name}
                subtitle={c.phone ?? 'No phone'}
                onPress={() => router.push(`/customers/${c.id}`)}
                right={c.debt_balance > 0 ? <Chip label={`Owes ${money(c.debt_balance)}`} tone="warning" /> : undefined}
              />
            )}
          />
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
      <MovableFab actions={fabActions} defaultKeys={defaultKeys} storageKey="customers" />
    </>
  );
}
