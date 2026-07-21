import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAlert, useConfirm } from '@/components/confirm';
import { SelectModal, type SelectOption } from '@/components/pickers';
import { AppHeader, BrandLoading, Button, Card, Chip, EmptyState, Screen, Text, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import {
  contactsPermissionMessage,
  contactsPlatformHint,
  ensureContactsAccess,
  importSelectedContacts,
  loadImportableContacts,
  openSystemSettings,
  type ImportableContact,
} from '@/lib/contacts-import';
import { toUserMessage } from '@/lib/errors';
import { selectionFeedback } from '@/lib/haptics';

/** Which phone/email field a row is being asked to choose from. */
type MethodPicker = { id: string; kind: 'phone' | 'email' };

export default function ImportContactsScreen() {
  const t = useTheme();
  const alert = useAlert();
  const confirm = useConfirm();
  const { terms } = useApp();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = modeParam === 'resync' ? 'resync' : 'import';

  const [contacts, setContacts] = useState<ImportableContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-contact chosen phone/email overrides (default to the primary otherwise).
  const [phoneChoice, setPhoneChoice] = useState<Record<string, string>>({});
  const [emailChoice, setEmailChoice] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<MethodPicker | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setBlocked(false);
    try {
      const outcome = await ensureContactsAccess();
      if (outcome !== 'granted') {
        setBlocked(true);
        setContacts([]);
        if (outcome === 'blocked') {
          const msg = contactsPermissionMessage(outcome);
          const choice = await confirm({
            title: msg.title,
            message: msg.message,
            actions: [
              { label: 'Open Settings', value: 'settings' },
              { label: 'Cancel', style: 'cancel', value: 'cancel' },
            ],
          });
          if (choice === 'settings') void openSystemSettings();
        }
        return;
      }
      const rows = await loadImportableContacts();
      setContacts(rows);
      setPhoneChoice({});
      setEmailChoice({});
      if (mode === 'resync') {
        setSelected(new Set(rows.filter((r) => r.alreadyImported).map((r) => r.id)));
      } else {
        setSelected(new Set());
      }
    } catch (e) {
      void alert({ title: 'Couldn’t load contacts', message: toUserMessage(e) });
    } finally {
      setLoading(false);
    }
  }, [mode, alert, confirm]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phones.some((p) => p.value.includes(q)) ||
        c.emails.some((e) => e.value.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  const chosenPhone = (c: ImportableContact) => phoneChoice[c.id] ?? c.phone;
  const chosenEmail = (c: ImportableContact) => emailChoice[c.id] ?? c.email;

  const toggle = (id: string) => {
    selectionFeedback();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "Select all" acts on the currently-visible (filtered) rows and toggles: if
  // every visible row is already selected it clears them, otherwise it adds them.
  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleSelectAll = () => {
    selectionFeedback();
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const c of filtered) next.delete(c.id);
      } else {
        for (const c of filtered) next.add(c.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const pickerContact = picker ? contacts.find((c) => c.id === picker.id) ?? null : null;
  const pickerOptions: SelectOption[] = useMemo(() => {
    if (!picker || !pickerContact) return [];
    const list = picker.kind === 'phone' ? pickerContact.phones : pickerContact.emails;
    return list.map((m) => ({ id: m.value, label: m.value, sublabel: m.label ?? undefined }));
  }, [picker, pickerContact]);

  const onPickMethod = (value: string) => {
    if (!picker) return;
    if (picker.kind === 'phone') setPhoneChoice((prev) => ({ ...prev, [picker.id]: value }));
    else setEmailChoice((prev) => ({ ...prev, [picker.id]: value }));
  };

  const runImport = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const picks = contacts
        .filter((c) => selected.has(c.id))
        .map((c) => ({ ...c, phone: chosenPhone(c), email: chosenEmail(c) }));
      const result = await importSelectedContacts(picks, mode);
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} skipped (already exist)`);
      await alert({
        title: mode === 'resync' ? 'Re-sync complete' : 'Import complete',
        message: parts.length ? parts.join(' · ') : 'Nothing changed.',
      });
      router.back();
    } catch (e) {
      void alert({ title: 'Import failed', message: toUserMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'resync' ? 'Re-sync contacts' : `Import ${terms.customers.toLowerCase()}`;

  return (
    <Screen>
      <AppHeader title={title} back subtitle={contactsPlatformHint()} />

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search contacts…"
        style={{ marginBottom: Spacing.md }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          marginBottom: Spacing.md,
        }}
      >
        <Button
          title={allVisibleSelected ? 'Clear all' : 'Select all'}
          icon={allVisibleSelected ? 'ellipse-outline' : 'checkmark-done'}
          variant="secondary"
          size="sm"
          onPress={toggleSelectAll}
          disabled={loading || filtered.length === 0}
        />
        <Button
          title="Clear"
          variant="ghost"
          size="sm"
          onPress={clearSelection}
          disabled={selected.size === 0}
        />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text variant="label" color={selected.size ? t.primary : t.textMuted}>
            {selected.size} selected
          </Text>
        </View>
      </View>

      {loading ? (
        <BrandLoading label="Loading contacts…" />
      ) : blocked ? (
        <EmptyState
          icon="people-outline"
          title="Contacts permission needed"
          message="Allow contacts access so Trackr can import people from your phone book. Tap below to try again, or enable Contacts in system Settings."
          actionLabel="Try again"
          onAction={() => load()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No contacts found"
          message={search ? 'Try a different search.' : 'Your address book looks empty.'}
        />
      ) : (
        <Card padded={false} style={{ marginBottom: Spacing.lg }}>
          {filtered.map((c, idx) => {
            const on = selected.has(c.id);
            const phone = chosenPhone(c);
            const email = chosenEmail(c);
            const contactLine = [phone, email].filter(Boolean).join(' · ') || 'No phone or email';
            const multiPhone = c.phones.length > 1;
            const multiEmail = c.emails.length > 1;
            return (
              <View
                key={c.id}
                style={{
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: t.border,
                  opacity: mode === 'resync' && !c.alreadyImported ? 0.55 : 1,
                }}
              >
                <Pressable
                  onPress={() => toggle(c.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.md,
                    paddingHorizontal: Spacing.lg,
                    paddingVertical: Spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: Radius.sm,
                      borderWidth: 2,
                      borderColor: on ? t.primary : t.borderStrong,
                      backgroundColor: on ? t.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text variant="caption" color={t.textSecondary} numberOfLines={1}>
                      {contactLine}
                      {c.birthday ? ' · Birthday' : ''}
                      {c.alreadyImported ? ' · In Trackr' : ''}
                    </Text>
                  </View>
                </Pressable>

                {multiPhone || multiEmail ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: Spacing.sm,
                      paddingHorizontal: Spacing.lg,
                      paddingLeft: Spacing.lg + 24 + Spacing.md,
                      paddingBottom: Spacing.md,
                    }}
                  >
                    {multiPhone ? (
                      <Chip
                        label={`${c.phones.length} numbers`}
                        icon="call-outline"
                        tone="primary"
                        onPress={() => setPicker({ id: c.id, kind: 'phone' })}
                      />
                    ) : null}
                    {multiEmail ? (
                      <Chip
                        label={`${c.emails.length} emails`}
                        icon="mail-outline"
                        tone="info"
                        onPress={() => setPicker({ id: c.id, kind: 'email' })}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}

      <Button
        title={
          busy
            ? mode === 'resync'
              ? 'Updating…'
              : 'Importing…'
            : mode === 'resync'
              ? `Update ${selected.size}`
              : `Import ${selected.size}`
        }
        icon="people"
        size="lg"
        loading={busy}
        disabled={selected.size === 0 || loading}
        onPress={runImport}
      />

      <SelectModal
        visible={picker != null}
        title={picker?.kind === 'email' ? 'Choose email' : 'Choose number'}
        searchable={false}
        options={pickerOptions}
        selectedId={
          picker?.kind === 'phone'
            ? pickerContact
              ? chosenPhone(pickerContact) ?? undefined
              : undefined
            : pickerContact
              ? chosenEmail(pickerContact) ?? undefined
              : undefined
        }
        onClose={() => setPicker(null)}
        onSelect={onPickMethod}
      />
    </Screen>
  );
}
