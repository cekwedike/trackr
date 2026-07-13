import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { OrderForm } from '@/components/forms/order-form';
import { useConfirm } from '@/components/confirm';
import { SelectField, SelectModal } from '@/components/pickers';
import { AppHeader, Button, Card, DetailHero, Divider, IconButton, InfoRow, Screen, SectionHeader, Segmented, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { getOrder, getOrderItems, ORDER_STATUSES, setOrderStatus } from '@/db/repos/orders';
import { listPayments, recordOrderPayment } from '@/db/repos/payments';
import type { OrderStatus, PaymentMethod } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDateTime } from '@/lib/date';
import { pressFeedback } from '@/lib/haptics';
import { parseMoney } from '@/lib/money';
import { orderToReceipt, printReceipt, shareReceipt } from '@/lib/receipt';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function OrderDetail() {
  const t = useTheme();
  const confirm = useConfirm();
  const { money, terms, settings, accent, currencySymbol } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [methodModal, setMethodModal] = useState(false);
  const [recording, setRecording] = useState(false);

  const { data, loading, reload } = useAsyncData(async () => {
    const order = await getOrder(orderId);
    if (!order) return null;
    const items = await getOrderItems(orderId);
    const payments = await listPayments('order', orderId);
    return { order, items, payments };
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

  const { order, items, payments } = data;
  const balance = order.total - order.amount_paid;

  const changeStatus = async (s: OrderStatus) => {
    await setOrderStatus(orderId, s);
    reload();
  };

  const onRecordPayment = async () => {
    const minor = parseMoney(payAmount);
    if (minor <= 0) {
      await confirm({
        title: 'Enter an amount',
        message: 'Type how much was paid before recording it.',
        actions: [{ label: 'OK', value: 'ok' }],
      });
      return;
    }
    const applied = Math.min(minor, balance);
    const chosen = await confirm({
      title: 'Record payment',
      message: `Record ${money(applied)} towards this ${terms.order.toLowerCase()}?`,
      actions: [
        { label: 'Record', value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (chosen !== 'ok') return;
    pressFeedback();
    setRecording(true);
    try {
      await recordOrderPayment(orderId, applied, payMethod);
      setPayAmount('');
      reload();
    } finally {
      setRecording(false);
    }
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
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === payMethod)?.label;
  const paymentRows = [
    <InfoRow key="total" label="Total" value={money(order.total)} />,
    <InfoRow key="paid" label="Paid" value={money(order.amount_paid)} valueColor={order.amount_paid > 0 ? t.success : undefined} />,
    balance > 0 ? <InfoRow key="balance" label="Balance" value={money(balance)} valueColor={t.warning} /> : null,
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

      {balance > 0 ? (
        <>
          <SectionHeader title="Record payment" subtitle={`${money(balance)} outstanding`} />
          <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
            <TextField label="Amount" value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" placeholder="0" prefix={currencySymbol} />
            <SelectField label="Method" value={methodLabel} onPress={() => setMethodModal(true)} />
            <Button title="Record payment" icon="cash-outline" onPress={onRecordPayment} loading={recording} />
          </Card>
        </>
      ) : null}

      {payments.length > 0 ? (
        <>
          <SectionHeader title="Payment history" subtitle={`${payments.length} payment${payments.length === 1 ? '' : 's'}`} />
          <Card style={{ marginBottom: Spacing.lg }}>
            {payments.map((p, idx) => (
              <View key={p.id}>
                <InfoRow
                  label={formatDateTime(p.created_at)}
                  right={
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="body" weight="semibold" color={t.success}>{money(p.amount)}</Text>
                      <Text variant="caption" color={t.textMuted}>{PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}</Text>
                    </View>
                  }
                />
                {idx < payments.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

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

      <SelectModal
        visible={methodModal}
        title="Payment method"
        searchable={false}
        onClose={() => setMethodModal(false)}
        onSelect={(id) => setPayMethod(id as PaymentMethod)}
        selectedId={payMethod}
        options={PAYMENT_METHODS.map((m) => ({ id: m.value, label: m.label }))}
      />
    </Screen>
  );
}
