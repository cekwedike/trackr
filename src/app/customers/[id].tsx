import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { CustomerForm } from '@/components/forms/customer-form';
import { AppHeader, Button, Card, DetailHero, Divider, IconButton, InfoRow, ListRow, Screen, SectionHeader, Text, TextField } from '@/components/ui';
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
  if (editing) return <CustomerForm initial={data.customer} onDone={() => { setEditing(false); reload(); }} />;

  const { customer, notes } = data;
  const owes = customer.debt_balance > 0;

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

      <SectionHeader title="Update balance" />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Button title="Record payment" icon="arrow-down" variant="secondary" onPress={() => changeDebt(-1)} style={{ flex: 1 }} />
          <Button title="Add debt" icon="arrow-up" variant="secondary" onPress={() => changeDebt(1)} style={{ flex: 1 }} />
        </View>
      </Card>

      {notes.length > 0 ? (
        <>
          <SectionHeader title="Linked notes" style={{ marginTop: Spacing.lg }} />
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
