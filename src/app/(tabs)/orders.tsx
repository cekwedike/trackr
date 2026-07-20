import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SkeletonList } from '@/components/anim';
import { MovableFab } from '@/components/nav';
import { AppHeader, CardList, Chip, EmptyState, ListRow, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listOrders } from '@/db/repos/orders';
import type { OrderStatus } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useQuickActionCandidates } from '@/hooks/use-fab-actions';
import { formatDate } from '@/lib/date';

const STATUS_TONE: Record<OrderStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  in_progress: 'info',
  ready: 'primary',
  delivered: 'success',
  cancelled: 'danger',
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrdersScreen() {
  const { money, terms } = useApp();
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const { data } = useAsyncData(() => listOrders(), []);
  const { actions: fabActions, defaultKeys } = useQuickActionCandidates(['order', 'customer', 'expense']);

  const orders = (data ?? []).filter((o) => (filter === 'active' ? o.status !== 'delivered' && o.status !== 'cancelled' : true));

  return (
    <>
      <Screen>
        <AppHeader title={terms.orders} subtitle={data ? `${data.length} total` : undefined} />
        <View style={{ marginBottom: Spacing.lg }}>
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All' }]} />
        </View>
        {!data ? (
          <SkeletonList rows={6} />
        ) : orders.length > 0 ? (
          <CardList
            data={orders}
            keyExtractor={(o) => o.id}
            renderItem={(o) => {
              const balance = o.total - o.amount_paid;
              return (
                <ListRow
                  icon="clipboard"
                  iconTone={STATUS_TONE[o.status]}
                  title={o.customer_name || terms.order}
                  subtitle={`${money(o.total)}${balance > 0 ? ` · ${money(balance)} due` : ' · paid'}${o.due_at ? ` · due ${formatDate(o.due_at)}` : ''}`}
                  onPress={() => router.push(`/orders/${o.id}`)}
                  right={<Chip label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />}
                />
              );
            }}
          />
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title={`No ${terms.orders.toLowerCase()}`}
            message={`Track ${terms.customer.toLowerCase()} ${terms.orders.toLowerCase()} from request to delivery.`}
            actionLabel={`New ${terms.order.toLowerCase()}`}
            onAction={() => router.push('/orders/new')}
            secondaryLabel="Operations hub"
            onSecondary={() => router.push('/operations' as Href)}
          />
        )}
      </Screen>
      <MovableFab actions={fabActions} defaultKeys={defaultKeys} storageKey="orders" />
    </>
  );
}
