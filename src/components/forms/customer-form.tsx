import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Card, AppHeader, Screen, Text, TextField } from '@/components/ui';
import { DateTimeField } from '@/components/pickers';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { createCustomer, deleteCustomer, updateCustomer } from '@/db/repos/customers';
import type { Customer } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { fromMinor, parseMoney } from '@/lib/money';

export function CustomerForm({ initial }: { initial?: Customer }) {
  const t = useTheme();
  const { currencySymbol } = useApp();
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [debt, setDebt] = useState(initial ? String(fromMinor(initial.debt_balance)) : '0');
  const [hasBirthday, setHasBirthday] = useState(!!initial?.birthday);
  const [birthday, setBirthday] = useState(initial?.birthday ? new Date(initial.birthday) : new Date(2000, 0, 1));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter the customer name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        birthday: hasBirthday ? birthday.toISOString() : null,
        address: address.trim() || null,
        note: note.trim() || null,
        debt_balance: parseMoney(debt),
      };
      if (initial) await updateCustomer(initial.id, payload);
      else await createCustomer(payload);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!initial) return;
    Alert.alert('Delete customer', 'Remove this customer?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCustomer(initial.id); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit customer' : 'New customer'} back />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Full name" autoFocus={!initial} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="080..." />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="Optional" />
        <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Optional" />

        <Pressable onPress={() => setHasBirthday((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Ionicons name="gift-outline" size={18} color={t.textSecondary} />
            <Text variant="body">Birthday</Text>
          </View>
          <Ionicons name={hasBirthday ? 'toggle' : 'toggle-outline'} size={32} color={hasBirthday ? t.primary : t.textMuted} />
        </Pressable>
        {hasBirthday ? <DateTimeField value={birthday} onChange={setBirthday} mode="date" /> : null}

        <TextField label="Outstanding debt (owed to you)" value={debt} onChangeText={setDebt} keyboardType="numeric" prefix={currencySymbol} />
        <TextField label="Note" value={note} onChangeText={setNote} placeholder="Preferences, etc." multiline />
      </Card>

      <Button title={initial ? 'Save changes' : 'Add customer'} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}
    </Screen>
  );
}
