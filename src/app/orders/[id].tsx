import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { OrderForm } from '@/components/forms/order-form';
import { AppHeader, Button, Card, DetailHero, Divider, IconButton, InfoRow, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { getOrder, getOrderItems, ORDER_STATUSES, setOrderStatus } from '@/db/repos/orders';
import type { OrderStatus } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { pressFeedback } from '@/lib/haptics';
import { orderToReceipt, printReceipt, shareReceipt } from '@/lib/receipt';

export default function OrderDetail() {
  const t = useTheme();
  const { money, terms, settings, accent, currencySymbol } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);

  const { data, loading, reload } = useAsyncData(async () => {
    const order = await getOrder(orderId);
    if (!order) return null;
    const items = await getOrderItems(orderId);
    return { order, items };
  }, [orderId]);

  if (!data) {
    if (loading) return null;
    return (
      <Screen>
        <AppHeader title={terms.order} back />
        <Text variant="body">{terms.order} not found.</Text>
      </Screen>
    );
  }
  if (editing) return <OrderForm initial={data.order} onDone={() => { setEditing(false); reload(); }} />;

  const { order, items } = data;
  const balance = order.total - order.amount_paid;

  const changeStatus = async (s: OrderStatus) => {
    await setOrderStatus(orderId, s);
    reload();
  };

  const buildData = () =>
    orderToReceipt(
      order,
      items,
      {
        businessName: settings?.business_name?.trim() || 'Trackr',
        currencySymbol,
        accent,
      },
      ORDER_STATUSES.find((s) => s.value === order.status)?.label,
    );

  const onShare = async () => {
    pressFeedback();
    setSharing(true);
    try {
      await shareReceipt(buildData());
    } finally {
      setSharing(false);
    }
  };

  const onPrint = () => {
    pressFeedback();
    printReceipt(buildData());
  };

  const statusLabel = ORDER_STATUSES.find((s) => s.value === order.status)?.label;
  const paymentRows = [
    <InfoRow key="total" label="Total" value={money(order.total)} />,
    <InfoRow key="paid" label="Paid" value={money(order.amount_paid)} valueColor={order.amount_paid > 0 ? t.success : undefined} />,
    order.due_at ? <InfoRow key="due" label="Due" value={formatDate(order.due_at)} /> : null,
    order.note ? <InfoRow key="note" label="Note" value={order.note} align="flex-start" /> : null,
  ].filter(Boolean);

  return (
    <Screen>
      <AppHeader title={order.customer_name || `${terms.order} #${order.id}`} back right={<IconButton icon="create-outline" tone="primary" onPress={() => setEditing(true)} />} />

      <DetailHero
        label={balance > 0 ? 'Balance due' : 'Fully paid'}
        value={money(balance > 0 ? balance : order.total)}
        valueColor={balance > 0 ? t.warning : t.success}
        icon="clipboard"
        tone={balance > 0 ? 'warning' : 'success'}
        badge={statusLabel}
        badgeTone={balance > 0 ? 'warning' : 'success'}
        meta={`${items.length} item${items.length === 1 ? '' : 's'} · ${money(order.total)} total`}
      />

      <SectionHeader title="Status" />
      <View style={{ marginBottom: Spacing.lg }}>
        <Segmented
          scroll
          value={order.status}
          onChange={changeStatus}
          options={ORDER_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </View>

      <SectionHeader title="Payment" />
      <Card style={{ marginBottom: Spacing.lg }}>
        {paymentRows.map((row, idx) => (
          <View key={idx}>
            {row}
            {idx < paymentRows.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>

      <SectionHeader title="Items" subtitle={`${items.length} line item${items.length === 1 ? '' : 's'}`} />
      <Card>
        {items.map((it, idx) => (
          <View key={it.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">{it.name}</Text>
                <Text variant="caption" color={t.textSecondary}>{it.qty} × {money(it.unit_price)}</Text>
              </View>
              <Text variant="body" weight="bold">{money(it.line_total)}</Text>
            </View>
            {idx < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg }}>
        <Button title="Send invoice" icon="share-social-outline" onPress={onShare} loading={sharing} style={{ flex: 1 }} />
        <Button title="Print" variant="secondary" icon="print-outline" onPress={onPrint} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
