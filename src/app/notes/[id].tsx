import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppHeader, Card, Chip, IconButton, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { SelectModal, type SelectOption } from '@/components/pickers';
import { Radius, Spacing } from '@/constants/theme';
import {
  addEntityLink,
  deleteNote,
  findNoteByTitle,
  getBacklinks,
  getNote,
  getOutgoingLinks,
  createNote,
  removeLink,
  togglePinned,
  updateNote,
} from '@/db/repos/notes';
import { listCustomers } from '@/db/repos/customers';
import { listProducts } from '@/db/repos/products';
import { listOrders } from '@/db/repos/orders';
import type { LinkTargetType } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';

const ENTITY_ROUTE: Record<string, string> = {
  note: '/notes',
  product: '/products',
  customer: '/customers',
  order: '/orders',
  sale: '/sales',
  expense: '/expenses',
};

export default function NoteEditor() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Number(id);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const loadedFor = useRef<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [typeModal, setTypeModal] = useState(false);
  const [entityModal, setEntityModal] = useState<LinkTargetType | null>(null);
  const [entityOptions, setEntityOptions] = useState<SelectOption[]>([]);

  const { data, reload } = useAsyncData(async () => {
    const note = await getNote(noteId);
    if (!note) return null;
    const [outgoing, backlinks] = await Promise.all([getOutgoingLinks(noteId), getBacklinks(noteId)]);
    return { note, outgoing, backlinks };
  }, [noteId]);

  useEffect(() => {
    if (data?.note && loadedFor.current !== data.note.id) {
      setTitle(data.note.title);
      setBody(data.note.body);
      setPinned(data.note.pinned === 1);
      loadedFor.current = data.note.id;
    }
  }, [data]);

  // Debounced autosave
  useEffect(() => {
    if (loadedFor.current !== noteId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateNote(noteId, { title: title || 'Untitled', body, pinned: pinned ? 1 : 0 });
      reload();
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, pinned]);

  const remove = () => {
    Alert.alert('Delete note', 'This note will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteNote(noteId); router.back(); } },
    ]);
  };

  const openWikiLink = async (targetId: number | null, targetTitle: string) => {
    if (targetId) {
      router.push(`/notes/${targetId}`);
    } else {
      // Create the missing note and open it
      const existing = await findNoteByTitle(targetTitle);
      const newId = existing?.id ?? (await createNote({ title: targetTitle, body: '' }));
      router.push(`/notes/${newId}`);
    }
  };

  const chooseType = async (type: string) => {
    const linkType = type as LinkTargetType;
    let options: SelectOption[] = [];
    if (linkType === 'product') {
      options = (await listProducts()).map((p) => ({ id: String(p.id), label: p.name }));
    } else if (linkType === 'customer') {
      options = (await listCustomers()).map((c) => ({ id: String(c.id), label: c.name, sublabel: c.phone ?? undefined }));
    } else if (linkType === 'order') {
      options = (await listOrders()).map((o) => ({ id: String(o.id), label: o.customer_name || `Order #${o.id}` }));
    }
    setEntityOptions(options);
    setEntityModal(linkType);
  };

  const addLink = async (selectedId: string) => {
    if (!entityModal || !selectedId) return;
    const opt = entityOptions.find((o) => o.id === selectedId);
    await addEntityLink(noteId, entityModal, Number(selectedId), opt?.label ?? '');
    reload();
  };

  if (data === null) {
    return (
      <Screen>
        <AppHeader title="Note" back />
        <Text variant="body">Note not found.</Text>
      </Screen>
    );
  }

  const entityLinks = data?.outgoing.filter((l) => l.target_type !== 'note') ?? [];
  const noteLinks = data?.outgoing.filter((l) => l.target_type === 'note') ?? [];

  return (
    <Screen>
      <AppHeader
        title="Note"
        back
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon={pinned ? 'bookmark' : 'bookmark-outline'} tone={pinned ? 'warning' : undefined} onPress={() => { setPinned((v) => !v); togglePinned(noteId, !pinned); }} />
            <IconButton icon="trash-outline" tone="danger" onPress={remove} />
          </View>
        }
      />

      <TextField value={title} onChangeText={setTitle} placeholder="Title" style={{ marginBottom: Spacing.md }} />
      <Card style={{ marginBottom: Spacing.lg }}>
        <TextField value={body} onChangeText={setBody} placeholder={'Write anything...\nUse [[Note title]] to link notes.'} multiline />
        <Text variant="caption" color={t.textMuted} style={{ marginTop: Spacing.sm }}>Tip: type [[ ]] around a note title to link it.</Text>
      </Card>

      <SectionHeader title="Links" action="Link record" onAction={() => setTypeModal(true)} />
      <Card style={{ gap: Spacing.sm }}>
        {noteLinks.length === 0 && entityLinks.length === 0 ? (
          <Text variant="caption" color={t.textMuted}>No links yet. Reference notes with [[title]] or link a record.</Text>
        ) : null}
        {noteLinks.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => openWikiLink(l.target_id, l.target_title ?? '')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 }}
          >
            <Ionicons name="link" size={16} color={l.target_id ? t.primary : t.textMuted} />
            <Text variant="body" color={l.target_id ? t.primary : t.textMuted}>
              {l.resolved_title ?? l.target_title}{l.target_id ? '' : '  (create)'}
            </Text>
          </Pressable>
        ))}
        {entityLinks.map((l) => (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => l.target_id && router.push(`${ENTITY_ROUTE[l.target_type]}/${l.target_id}` as Href)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}
            >
              <Chip label={l.target_type} tone="accent" />
              <Text variant="body">{l.target_title}</Text>
            </Pressable>
            <IconButton icon="close" size={16} onPress={async () => { await removeLink(l.id); reload(); }} />
          </View>
        ))}
      </Card>

      <SectionHeader title="Linked mentions" />
      <Card style={{ gap: Spacing.sm }}>
        {data && data.backlinks.length > 0 ? (
          data.backlinks.map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/notes/${b.source_note_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 }}>
              <Ionicons name="return-down-back" size={16} color={t.textSecondary} />
              <Text variant="body">{b.source_title}</Text>
            </Pressable>
          ))
        ) : (
          <Text variant="caption" color={t.textMuted}>No other notes link here yet.</Text>
        )}
      </Card>

      <SelectModal
        visible={typeModal}
        title="Link to a record"
        searchable={false}
        onClose={() => setTypeModal(false)}
        onSelect={chooseType}
        options={[
          { id: 'product', label: 'Product' },
          { id: 'customer', label: 'Customer' },
          { id: 'order', label: 'Order' },
        ]}
      />
      <SelectModal
        visible={entityModal !== null}
        title="Choose record"
        onClose={() => setEntityModal(null)}
        onSelect={addLink}
        options={entityOptions}
      />
    </Screen>
  );
}
