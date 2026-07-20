import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppHeader, Button, Card, EmptyState, Screen, Text, TextField } from '@/components/ui';
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

export default function ImportContactsScreen() {
  const t = useTheme();
  const { terms } = useApp();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = modeParam === 'resync' ? 'resync' : 'import';

  const [contacts, setContacts] = useState<ImportableContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
          Alert.alert(msg.title, msg.message, [
            { text: 'Open Settings', onPress: () => openSystemSettings() },
            { text: 'OK', style: 'cancel' },
          ]);
        }
        return;
      }
      const rows = await loadImportableContacts();
      setContacts(rows);
      if (mode === 'resync') {
        setSelected(new Set(rows.filter((r) => r.alreadyImported).map((r) => r.id)));
      } else {
        setSelected(new Set());
      }
    } catch (e) {
      Alert.alert('Couldn’t load contacts', toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const toggle = (id: string) => {
    selectionFeedback();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filtered) next.add(c.id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const runImport = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const picks = contacts.filter((c) => selected.has(c.id));
      const result = await importSelectedContacts(picks, mode);
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      Alert.alert(
        mode === 'resync' ? 'Re-sync complete' : 'Import complete',
        parts.length ? parts.join(' · ') : 'Nothing changed.',
      );
      router.back();
    } catch (e) {
      Alert.alert('Import failed', toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'resync' ? 'Re-sync contacts' : `Import ${terms.customers.toLowerCase()}`;

  return (
    <Screen>
      <AppHeader
        title={title}
        back
        subtitle={contactsPlatformHint()}
      />

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search contacts…"
        style={{ marginBottom: Spacing.md }}
      />

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
        <Button title="Select visible" variant="secondary" size="sm" onPress={selectVisible} disabled={loading} />
        <Button title="Clear" variant="ghost" size="sm" onPress={clearSelection} disabled={selected.size === 0} />
      </View>

      {loading ? (
        <Text variant="body" color={t.textMuted} style={{ textAlign: 'center', marginTop: Spacing.xl }}>
          Loading contacts…
        </Text>
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
            return (
              <Pressable
                key={c.id}
                onPress={() => toggle(c.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  paddingHorizontal: Spacing.lg,
                  paddingVertical: Spacing.md,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: t.border,
                  opacity: mode === 'resync' && !c.alreadyImported ? 0.55 : 1,
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
                    {[c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}
                    {c.birthday ? ' · Birthday' : ''}
                    {c.alreadyImported ? ' · In Trackr' : ''}
                  </Text>
                </View>
              </Pressable>
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
              ? `Update selected (${selected.size})`
              : `Import selected (${selected.size})`
        }
        icon="people"
        size="lg"
        loading={busy}
        disabled={selected.size === 0 || loading}
        onPress={runImport}
      />
    </Screen>
  );
}
