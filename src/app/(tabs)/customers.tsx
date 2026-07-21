import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SkeletonList } from '@/components/anim';
import { useAlert, useConfirm } from '@/components/confirm';
import { MovableFab } from '@/components/nav';
import { AppHeader, Button, CardList, Chip, EmptyState, ListRow, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import { useAsyncData } from '@/hooks/use-async-data';
import { useQuickActionCandidates } from '@/hooks/use-fab-actions';
import {
  contactsPermissionMessage,
  importSelectedContacts,
  openSystemSettings,
  pickContactFields,
} from '@/lib/contacts-import';
import { toUserMessage } from '@/lib/errors';

export default function CustomersScreen() {
  const { money, terms } = useApp();
  const alert = useAlert();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const { data, reload } = useAsyncData(() => listCustomers(), []);
  const { actions: fabActions, defaultKeys } = useQuickActionCandidates(['customer', 'order', 'sale', 'note']);
  const [importBusy, setImportBusy] = useState(false);

  const filtered = (data ?? []).filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search),
  );

  const openImport = () => router.push('/customers/import');
  const openResync = () => router.push('/customers/import?mode=resync');

  const quickPick = async () => {
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
      const result = await importSelectedContacts([pick.contact], 'import');
      await reload();
      void alert({
        title: result.created ? 'Contact added' : 'Contact updated',
        message: `${terms.customer} list refreshed from your address book.`,
      });
    } catch (e) {
      void alert({ title: 'Couldn’t import contact', message: toUserMessage(e) });
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <>
      <Screen>
        <AppHeader
          title={terms.customers}
          subtitle={data ? `${data.length} ${terms.customers.toLowerCase()}` : undefined}
        />
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
          <Button
            title={importBusy ? 'Opening…' : 'Import'}
            icon="download-outline"
            variant="secondary"
            size="sm"
            onPress={openImport}
            disabled={importBusy}
            style={{ flex: 1 }}
          />
          <Button
            title="Pick one"
            icon="person-add-outline"
            variant="ghost"
            size="sm"
            onPress={quickPick}
            disabled={importBusy}
            style={{ flex: 1 }}
          />
        </View>
        {(data?.length ?? 0) > 0 ? (
          <Button
            title="Re-sync from contacts"
            icon="sync-outline"
            variant="ghost"
            size="sm"
            onPress={openResync}
            style={{ marginBottom: Spacing.md }}
          />
        ) : null}
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone..."
          style={{ marginBottom: Spacing.lg }}
        />
        {!data ? (
          <SkeletonList rows={7} />
        ) : filtered.length > 0 ? (
          <CardList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={(c) => (
              <ListRow
                icon="person"
                iconTone="info"
                title={c.name}
                subtitle={c.phone ?? 'No phone'}
                onPress={() => router.push(`/customers/${c.id}`)}
                right={
                  c.debt_balance > 0 ? <Chip label={`Owes ${money(c.debt_balance)}`} tone="warning" /> : undefined
                }
              />
            )}
          />
        ) : (
          <EmptyState
            icon="people-outline"
            title={`No ${terms.customers.toLowerCase()}`}
            message={`Keep a database of your ${terms.customers.toLowerCase()}, their birthdays and debts — or import from your phone contacts.`}
            actionLabel={`Add ${terms.customer.toLowerCase()}`}
            onAction={() => router.push('/customers/new')}
          />
        )}
      </Screen>
      <MovableFab actions={fabActions} defaultKeys={defaultKeys} storageKey="customers" />
    </>
  );
}
