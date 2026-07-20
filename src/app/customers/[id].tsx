import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { CustomerForm } from '@/components/forms/customer-form';
import { useConfirm } from '@/components/confirm';
import { SelectField, SelectModal } from '@/components/pickers';
import { AppHeader, Button, Card, DetailHero, Divider, IconButton, InfoRow, ListRow, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { adjustDebt, getCustomer } from '@/db/repos/customers';
import { getNotesLinkingEntity } from '@/db/repos/notes';
import { listPayments, recordDebtPayment } from '@/db/repos/payments';
import { listSalesForCustomer } from '@/db/repos/sales';
import type { PaymentMethod } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDateTime } from '@/lib/date';
import { pressFeedback } from '@/lib/haptics';
import { parseMoney } from '@/lib/money';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function CustomerDetail() {
  const t = useTheme();
  const confirm = useConfirm();
  const { money, terms } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [methodModal, setMethodModal] = useState(false);
  const [recording, setRecording] = useState(false);

  const { data, loading, reload } = useAsyncData(async () => {
    const customer = await getCustomer(customerId);
    if (!customer) return null;
    const [notes, payments, sales] = await Promise.all([
      getNotesLinkingEntity('customer', customerId),
      listPayments('debt', customerId),
      listSalesForCustomer(customerId, 40),
    ]);
    type TimelineItem =
      | { kind: 'sale'; id: number; at: string; amount: number; method: string }
      | { kind: 'payment'; id: number; at: string; amount: number; method: string }
      | { kind: 'note'; id: number; at: string; title: string; noteId: number };
    const timeline: TimelineItem[] = [
      ...sales.map((s) => ({
        kind: 'sale' as const,
        id: s.id,
        at: s.occurred_at,
        amount: s.total,
        method: s.payment_method,
      })),
      ...payments.map((p) => ({
        kind: 'payment' as const,
        id: p.id,
        at: p.created_at,
        amount: p.amount,
        method: p.method,
      })),
      ...notes.map((n) => ({
        kind: 'note' as const,
        id: n.id,
        at: n.source_updated_at ?? '',
        title: n.source_title,
        noteId: n.source_note_id,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));
    return { customer, payments, timeline };
  }, [customerId]);

  const addDebt = async () => {
    const minor = parseMoney(amount);
    if (minor <= 0) return;
    await adjustDebt(customerId, minor);
    setAmount('');
    reload();
  };

  const recordPayment = async (balance: number) => {
    const minor = parseMoney(amount);
    if (minor <= 0) {
      await confirm({
        title: 'Enter an amount',
        message: 'Type how much was paid before recording it.',
        actions: [{ label: 'OK', value: 'ok' }],
      });
      return;
    }
    const applied = Math.min(minor, balance);
    if (applied <= 0) return;
    const chosen = await confirm({
      title: 'Record payment',
      message: `Record ${money(applied)} from ${data?.customer.name ?? 'this ' + terms.customer.toLowerCase()}?`,
      actions: [
        { label: 'Record', value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (chosen !== 'ok') return;
    pressFeedback();
    setRecording(true);
    try {
      await recordDebtPayment(customerId, applied, payMethod);
      setAmount('');
      reload();
    } finally {
      setRecording(false);
    }
  };

  if (!data) {
    if (loading) return null;
    return (
      <Screen>
        <AppHeader title={terms.customer} back />
        <Text variant="body">{terms.customer} not found.</Text>
      </Screen>
    );
  }
  if (editing) return <CustomerForm initial={data.customer} onDone={() => { setEditing(false); reload(); }} />;

  const { customer, payments, timeline } = data;
  const owes = customer.debt_balance > 0;
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === payMethod)?.label;

  const contactRows = [
    customer.phone ? (
      <InfoRow key="phone" icon="call" iconTone="success" label="Phone" value={customer.phone} onPress={() => Linking.openURL(`tel:${customer.phone}`)} />
    ) : null,
    customer.email ? <InfoRow key="email" label="Email" value={customer.email} align="flex-start" /> : null,
    customer.address ? <InfoRow key="addr" label="Address" value={customer.address} align="flex-start" /> : null,
    customer.birthday ? <InfoRow key="bday" label="Birthday" value={formatDate(customer.birthday)} /> : null,
    customer.note ? <InfoRow key="note" label="Note" value={customer.note} align="flex-start" /> : null,
  ].filter(Boolean);

  return (
    <Screen>
      <AppHeader title={customer.name} back right={<IconButton icon="create-outline" tone="primary" onPress={() => setEditing(true)} />} />

      <DetailHero
        label={owes ? 'Owes you' : 'Balance'}
        value={money(customer.debt_balance)}
        valueColor={owes ? t.warning : t.success}
        icon="person"
        tone={owes ? 'warning' : 'info'}
        meta={owes ? 'Outstanding balance' : 'All settled up'}
      />

      {contactRows.length > 0 ? (
        <>
          <SectionHeader title="Contact" />
          <Card style={{ marginBottom: Spacing.lg }}>
            {contactRows.map((row, idx) => (
              <View key={idx}>
                {row}
                {idx < contactRows.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Update balance" subtitle={owes ? `${money(customer.debt_balance)} outstanding` : undefined} />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
        <SelectField label="Method" value={methodLabel} onPress={() => setMethodModal(true)} />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {owes ? (
            <Button title="Record payment" icon="arrow-down" onPress={() => recordPayment(customer.debt_balance)} loading={recording} style={{ flex: 1 }} />
          ) : null}
          <Button title="Add debt" icon="arrow-up" variant="secondary" onPress={addDebt} style={{ flex: 1 }} />
        </View>
      </Card>

      {timeline.length > 0 ? (
        <>
          <SectionHeader title="Activity" subtitle="Sales, payments & notes" style={{ marginTop: Spacing.lg }} />
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {timeline.slice(0, 20).map((item, idx) => (
              <View key={`${item.kind}-${item.id}`}>
                {item.kind === 'sale' ? (
                  <ListRow
                    icon="cart"
                    iconTone="success"
                    title={`Sale · ${money(item.amount)}`}
                    subtitle={`${formatDateTime(item.at)} · ${item.method}`}
                    onPress={() => router.push(`/sales/${item.id}`)}
                  />
                ) : null}
                {item.kind === 'payment' ? (
                  <ListRow
                    icon="arrow-down"
                    iconTone="success"
                    title={`Payment · ${money(item.amount)}`}
                    subtitle={`${formatDateTime(item.at)} · ${PAYMENT_METHODS.find((m) => m.value === item.method)?.label ?? item.method}`}
                  />
                ) : null}
                {item.kind === 'note' ? (
                  <ListRow
                    icon="document-text"
                    iconTone="primary"
                    title={item.title}
                    subtitle={item.at ? formatDateTime(item.at) : undefined}
                    onPress={() => router.push(`/notes/${item.noteId}`)}
                  />
                ) : null}
                {idx < Math.min(timeline.length, 20) - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {payments.length > 0 && timeline.every((x) => x.kind !== 'payment') ? (
        <>
          <SectionHeader title="Payment history" subtitle={`${payments.length} payment${payments.length === 1 ? '' : 's'}`} style={{ marginTop: Spacing.lg }} />
          <Card>
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

      {/* Linked notes are included in Activity when present */}

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
