import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAlert, useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { Button, Card, AppHeader, Screen, SectionHeader, Text, TextField, Toggle } from '@/components/ui';
import { DateTimeField } from '@/components/pickers';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { createCustomer, deleteCustomer, updateCustomer } from '@/db/repos/customers';
import type { Customer } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelBirthdayNotification,
  scheduleBirthdayNotification,
} from '@/lib/birthday-notifications';
import { birthdayToDate, isYearlessBirthday, toYearlessBirthday } from '@/lib/birthday';
import {
  contactsPermissionMessage,
  openSystemSettings,
  pickContactFields,
} from '@/lib/contacts-import';
import { toUserMessage } from '@/lib/errors';
import { fromMinor, parseMoney } from '@/lib/money';

export function CustomerForm({ initial, onDone }: { initial?: Customer; onDone?: () => void }) {
  const t = useTheme();
  const confirm = useConfirm();
  const alert = useAlert();
  const { showUndo } = useUndo();
  const { currencySymbol, terms } = useApp();
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [debt, setDebt] = useState(initial ? String(fromMinor(initial.debt_balance)) : '0');
  const [hasBirthday, setHasBirthday] = useState(!!initial?.birthday);
  const [birthday, setBirthday] = useState(birthdayToDate(initial?.birthday) ?? new Date(2000, 0, 1));
  // Track whether the current birthday has no year (e.g. imported from a contact
  // that only had day + month) so we don't fabricate a year when saving. Any
  // manual edit via the date picker adopts a concrete (full) date.
  const [birthdayYearless, setBirthdayYearless] = useState(isYearlessBirthday(initial?.birthday));
  const [contactId, setContactId] = useState<string | null>(initial?.contact_id ?? null);
  const [saving, setSaving] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const importFromContacts = async () => {
    if (importBusy) return;
    setImportBusy(true);
    try {
      const pick = await pickContactFields();
      if (pick.status === 'cancelled') return;
      if (pick.status === 'denied') {
        const msg = contactsPermissionMessage(pick.outcome);
        if (pick.outcome === 'blocked') {
          const choice = await confirm({
            title: msg.title,
            message: msg.message,
            actions: [
              { label: 'Open Settings', value: 'settings' },
              { label: 'Cancel', style: 'cancel', value: 'cancel' },
            ],
          });
          if (choice === 'settings') void openSystemSettings();
        } else {
          void alert({ title: msg.title, message: msg.message });
        }
        return;
      }
      const c = pick.contact;
      setName(c.name);
      setPhone(c.phone ?? '');
      setEmail(c.email ?? '');
      setContactId(c.id);
      if (c.birthday) {
        const d = birthdayToDate(c.birthday);
        if (d) {
          setHasBirthday(true);
          setBirthday(d);
          setBirthdayYearless(isYearlessBirthday(c.birthday));
        }
      }
    } catch (e) {
      void alert({ title: 'Couldn’t open contacts', message: toUserMessage(e) });
    } finally {
      setImportBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      void alert({ title: 'Name required', message: `Please enter the ${terms.customer.toLowerCase()} name.` });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        birthday: hasBirthday
          ? birthdayYearless
            ? toYearlessBirthday(birthday)
            : birthday.toISOString()
          : null,
        address: address.trim() || null,
        note: note.trim() || null,
        debt_balance: parseMoney(debt),
        contact_id: contactId,
      };
      let id = initial?.id;
      if (initial) await updateCustomer(initial.id, payload);
      else id = await createCustomer(payload);
      if (id != null) {
        if (payload.birthday) {
          await scheduleBirthdayNotification({ id, name: payload.name, birthday: payload.birthday });
        } else {
          await cancelBirthdayNotification(id);
        }
      }
      if (onDone) onDone();
      else router.back();
    } catch (e) {
      void alert({ title: 'Couldn’t save', message: toUserMessage(e, 'Couldn’t save this customer. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const label = terms.customer.toLowerCase();
    const choice = await confirm({
      title: `Delete ${label}`,
      message: `Remove this ${label}?`,
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      // Snapshot the customer before deleting so UNDO can re-create it (new id).
      // Best-effort: linked notes and recorded debt payments are not restored,
      // but the outstanding debt_balance is preserved on the re-created record.
      const snap = initial;
      await deleteCustomer(snap.id);
      await cancelBirthdayNotification(snap.id);
      router.back();
      showUndo({
        message: `Deleted ${label}`,
        onUndo: async () => {
          const id = await createCustomer({
            name: snap.name,
            phone: snap.phone,
            email: snap.email,
            birthday: snap.birthday,
            address: snap.address,
            note: snap.note,
            debt_balance: snap.debt_balance,
            contact_id: snap.contact_id,
          });
          if (snap.birthday) {
            await scheduleBirthdayNotification({ id, name: snap.name, birthday: snap.birthday });
          }
        },
      });
    }
  };

  return (
    <Screen>
      <AppHeader title={initial ? `Edit ${terms.customer.toLowerCase()}` : `New ${terms.customer.toLowerCase()}`} back />

      {!initial ? (
        <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
          <Button
            title="Import from contacts"
            icon="people-outline"
            variant="secondary"
            size="lg"
            onPress={() => router.push('/customers/import')}
            disabled={importBusy || saving}
          />
          <Button
            title={importBusy ? 'Opening contacts…' : 'Fill this form from a contact'}
            icon="person-add-outline"
            variant="ghost"
            size="sm"
            onPress={importFromContacts}
            disabled={importBusy || saving}
          />
          <Text variant="caption" color={t.textMuted}>
            Select several people at once, or pick just one to fill in this form.
          </Text>
        </Card>
      ) : null}

      <SectionHeader title="Contact" />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Full name" autoFocus={!initial} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="080..." />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="Optional" />
        <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Optional" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Ionicons name="gift-outline" size={18} color={t.textSecondary} />
            <Text variant="body">Birthday</Text>
          </View>
          <Toggle value={hasBirthday} onValueChange={setHasBirthday} />
        </View>
        {hasBirthday ? (
          <DateTimeField
            value={birthday}
            onChange={(d) => {
              setBirthday(d);
              // A manual pick includes a year, so stop treating it as year-less.
              setBirthdayYearless(false);
            }}
            mode="date"
          />
        ) : null}
      </Card>

      <SectionHeader title="Financial" style={{ marginTop: Spacing.lg }} />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Outstanding debt (owed to you)" value={debt} onChangeText={setDebt} keyboardType="numeric" prefix={currencySymbol} />
        <TextField label="Note" value={note} onChangeText={setNote} placeholder="Preferences, etc." multiline />
      </Card>

      <Button title={initial ? 'Save changes' : `Add ${terms.customer.toLowerCase()}`} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}
    </Screen>
  );
}
