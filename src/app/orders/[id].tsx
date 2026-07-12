import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { OrderForm } from '@/components/forms/order-form';
import { AppHeader, Card, Chip, Divider, IconButton, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { getOrder, getOrderItems, ORDER_STATUSES, setOrderStatus } from '@/db/repos/orders';
import type { OrderStatus } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';

export default function OrderDetail() {
  const t = useTheme();
  const { money, terms } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const [editing, setEditing] = useState(false);

  const { data, reload } = useAsyncData(async () => {
    const order = await getOrder(orderId);
    if (!order) return null;
    const items = await getOrderItems(orderId);
    return { order, items };
  }, [orderId]);

  if (data === null) {
    return (
      <Screen>
        <AppHeader title={terms.order} back />
        <Text variant="body">{terms.order} not found.</Text>
      </Screen>
    );
  }
  if (!data) return null;
  if (editing) return <OrderForm initial={data.order} onDone={() => { setEditing(false); reload(); }} />;

  const { order, items } = data;
  const balance = order.total - order.amount_paid;

  const changeStatus = async (s: OrderStatus) => {
    await setOrderStatus(orderId, s);
    reload();
  };

  return (
    <Screen>
      <AppHeader title={order.customer_name || `${terms.order} #${order.id}`} back right={<IconButton icon="create-outline" tone="primary" onPress={() => setEditing(true)} />} />

      <SectionHeader title="Status" />
      <View style={{ marginBottom: Spacing.lg }}>
        <Segmented
          scroll
          value={order.status}
          onChange={changeStatus}
          options={ORDER_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </View>

      <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <Row label="Total" value={money(order.total)} />
        <Row label="Paid" value={money(order.amount_paid)} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="body" color={t.textSecondary}>Balance</Text>
          <Chip label={money(balance)} tone={balance > 0 ? 'warning' : 'success'} />
        </View>
        {order.due_at ? <Row label="Due" value={formatDate(order.due_at)} /> : null}
        {order.note ? <Row label="Note" value={order.note} /> : null}
      </Card>

      <SectionHeader title="Items" />
      <Card>
        {items.map((it, idx) => (
          <View key={it.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="medium">{it.name}</Text>
                <Text variant="caption" color={t.textSecondary}>{it.qty} × {money(it.unit_price)}</Text>
              </View>
              <Text variant="body" weight="semibold">{money(it.line_total)}</Text>
            </View>
            {idx < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" color={t.textSecondary}>{label}</Text>
      <Text variant="body" weight="medium" style={{ flexShrink: 1, textAlign: 'right', marginLeft: Spacing.md }}>{value}</Text>
    </View>
  );
}
