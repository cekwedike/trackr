import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { CustomerForm } from '@/components/forms/customer-form';
import { AppHeader, Button, Card, Chip, Divider, IconButton, ListRow, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { adjustDebt, getCustomer } from '@/db/repos/customers';
import { getNotesLinkingEntity } from '@/db/repos/notes';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { parseMoney } from '@/lib/money';

export default function CustomerDetail() {
  const t = useTheme();
  const { money, terms } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');

  const { data, reload } = useAsyncData(async () => {
    const customer = await getCustomer(customerId);
    if (!customer) return null;
    const notes = await getNotesLinkingEntity('customer', customerId);
    return { customer, notes };
  }, [customerId]);

  const changeDebt = async (sign: number) => {
    const minor = parseMoney(amount) * sign;
    if (minor === 0) return;
    await adjustDebt(customerId, minor);
    setAmount('');
    reload();
  };

  if (data === null) {
    return (
      <Screen>
        <AppHeader title={terms.customer} back />
        <Text variant="body">{terms.customer} not found.</Text>
      </Screen>
    );
  }
  if (!data) return null;
  if (editing) return <CustomerForm initial={data.customer} />;

  const { customer, notes } = data;

  return (
    <Screen>
      <AppHeader title={customer.name} back right={<IconButton icon="create-outline" tone="primary" onPress={() => setEditing(true)} />} />

      <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        {customer.phone ? (
          <ListRow icon="call" iconTone="success" title={customer.phone} subtitle="Tap to call" onPress={() => Linking.openURL(`tel:${customer.phone}`)} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
        ) : null}
        {customer.email ? <Row label="Email" value={customer.email} /> : null}
        {customer.address ? <Row label="Address" value={customer.address} /> : null}
        {customer.birthday ? <Row label="Birthday" value={formatDate(customer.birthday)} /> : null}
        {customer.note ? <Row label="Note" value={customer.note} /> : null}
      </Card>

      <SectionHeader title="Debt" />
      <Card style={{ gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="body" color={t.textSecondary}>Currently owes you</Text>
          <Chip label={money(customer.debt_balance)} tone={customer.debt_balance > 0 ? 'warning' : 'success'} />
        </View>
        <Divider />
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Button title="Record payment" icon="arrow-down" variant="secondary" onPress={() => changeDebt(-1)} style={{ flex: 1 }} />
          <Button title="Add debt" icon="arrow-up" variant="secondary" onPress={() => changeDebt(1)} style={{ flex: 1 }} />
        </View>
      </Card>

      {notes.length > 0 ? (
        <>
          <SectionHeader title="Linked notes" />
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {notes.map((n, idx) => (
              <View key={n.id}>
                <ListRow icon="document-text" iconTone="primary" title={n.source_title} onPress={() => router.push(`/notes/${n.source_note_id}`)} />
                {idx < notes.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="caption" color={t.textSecondary}>{label}</Text>
      <Text variant="body" weight="medium" style={{ flexShrink: 1, textAlign: 'right', marginLeft: Spacing.md }}>{value}</Text>
    </View>
  );
}
