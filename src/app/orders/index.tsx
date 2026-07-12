import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, Card, Chip, EmptyState, FAB, ListRow, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listOrders } from '@/db/repos/orders';
import type { OrderStatus } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
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
  const t = useTheme();
  const { money } = useApp();
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const { data } = useAsyncData(() => listOrders(), []);

  const orders = (data ?? []).filter((o) => (filter === 'active' ? o.status !== 'delivered' && o.status !== 'cancelled' : true));

  return (
    <>
      <Screen>
        <AppHeader title="Orders" back />
        <View style={{ marginBottom: Spacing.lg }}>
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All' }]} />
        </View>
        {orders.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {orders.map((o, idx) => {
              const balance = o.total - o.amount_paid;
              return (
                <View key={o.id}>
                  <ListRow
                    icon="clipboard"
                    iconTone={STATUS_TONE[o.status]}
                    title={o.customer_name || `Order #${o.id}`}
                    subtitle={`${money(o.total)}${balance > 0 ? ` · ${money(balance)} due` : ' · paid'}${o.due_at ? ` · due ${formatDate(o.due_at)}` : ''}`}
                    onPress={() => router.push(`/orders/${o.id}`)}
                    right={<Chip label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />}
                  />
                  {idx < orders.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                </View>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon="clipboard-outline" title="No orders" message="Track customer orders from request to delivery." actionLabel="New order" onAction={() => router.push('/orders/new')} />
        )}
      </Screen>
      <FAB label="Order" onPress={() => router.push('/orders/new')} />
    </>
  );
}
