import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { HelpTip } from '@/components/help';
import { AppHeader, Button, CardList, DetailHero, EmptyState, IconButton, ListRow, Screen, SectionHeader, Segmented, Text, TextField } from '@/components/ui';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { recordDebtPayment } from '@/db/repos/payments';
import { outstandingReceivables, totalReceivable, type Receivable } from '@/db/repos/reports';
import type { PaymentMethod } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { pressFeedback } from '@/lib/haptics';
import { parseMoney } from '@/lib/money';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function DebtorsScreen() {
  const t = useTheme();
  const { money, terms } = useApp();

  const { data, loading, reload } = useAsyncData(async () => {
    const [debtors, total] = await Promise.all([outstandingReceivables(), totalReceivable()]);
    return { debtors, total };
  }, []);

  const [payFor, setPayFor] = useState<Receivable | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [recording, setRecording] = useState(false);

  const debtors = data?.debtors ?? [];
  const total = data?.total ?? 0;
  const hasDebtors = debtors.length > 0;

  const openPay = (d: Receivable) => {
    pressFeedback();
    setPayFor(d);
    setAmount('');
    setMethod('cash');
  };

  const closePay = () => {
    setPayFor(null);
    setAmount('');
  };

  const submitPay = async () => {
    if (!payFor) return;
    const minor = parseMoney(amount);
    const applied = Math.min(minor, payFor.amount);
    if (applied <= 0) return;
    pressFeedback();
    setRecording(true);
    try {
      await recordDebtPayment(payFor.id, applied, method);
      closePay();
      reload();
    } finally {
      setRecording(false);
    }
  };

  const owedAmount = payFor?.amount ?? 0;
  const previewMinor = Math.min(parseMoney(amount), owedAmount);
  const validAmount = previewMinor > 0;

  return (
    <Screen>
      <AppHeader
        title="Debtors"
        subtitle="Money owed to your business"
        back
        right={
          <HelpTip
            title="Receivables & debtors"
            subtitle="Who owes you, and how much"
            paragraphs={[
              'This is a read-only view of every customer with an outstanding balance. It updates automatically as credit sales and payments change each customer’s balance.',
            ]}
            points={[
              { term: 'Total receivable', desc: 'The sum of all outstanding balances — the total cash owed to you right now.' },
              { term: 'Amount owed', desc: 'How much an individual customer still owes.' },
            ]}
            tip={`Tap the cash button on a row to record a payment, or open a ${terms.customer.toLowerCase()} for the full history.`}
          />
        }
      />

      {hasDebtors ? (
        <>
          <DetailHero
            label="Total receivable"
            value={money(total)}
            icon="cash-outline"
            tone="warning"
            valueColor={t.warning}
            meta={`${debtors.length} ${debtors.length === 1 ? terms.customer.toLowerCase() : terms.customers.toLowerCase()} owe you`}
          />

          <SectionHeader title="Outstanding balances" subtitle="Largest first" />
          <CardList
            data={debtors}
            keyExtractor={(d) => d.id}
            renderItem={(d) => (
              <ListRow
                icon="person"
                iconTone="warning"
                title={d.name}
                subtitle={d.phone ?? 'No phone on file'}
                onPress={() => router.push(`/customers/${d.id}`)}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="body" weight="semibold" color={t.warning}>{money(d.amount)}</Text>
                      <Text variant="caption" color={t.textMuted}>owed</Text>
                    </View>
                    <IconButton icon="cash-outline" tone="success" onPress={() => openPay(d)} />
                  </View>
                }
              />
            )}
          />

          <View style={{ height: Spacing.xl }} />
          <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center' }}>
            Balances update automatically from credit sales and recorded payments.
          </Text>
        </>
      ) : loading ? null : (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title="Nobody owes you"
          message={`No ${terms.customers.toLowerCase()} currently have an outstanding balance. Credit sales will show up here until they’re paid off.`}
        />
      )}

      <Modal visible={payFor != null} transparent animationType="fade" statusBarTranslucent onRequestClose={closePay}>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={closePay} />
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: t.card,
              borderRadius: Radius.xl,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.border,
              padding: Spacing.lg,
              gap: Spacing.md,
              ...Shadow.lg,
            }}
          >
            <View>
              <Text variant="title" numberOfLines={1}>Record payment</Text>
              {payFor ? (
                <Text variant="caption" color={t.textSecondary}>
                  {payFor.name} · {money(payFor.amount)} owed
                </Text>
              ) : null}
            </View>
            <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" autoFocus />
            <Segmented
              scroll
              value={method}
              onChange={setMethod}
              options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
              <Button title="Cancel" variant="ghost" onPress={closePay} style={{ flex: 1 }} />
              <Button
                title={validAmount ? `Record ${money(previewMinor)}` : 'Record'}
                icon="checkmark"
                onPress={submitPay}
                loading={recording}
                disabled={!validAmount}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
