import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { ChecklistEditor } from '@/components/notes/checklist-editor';
import { ColorPicker } from '@/components/notes/color-picker';
import { ENTITY_ROUTE, entityMeta, linkDisplayTitle } from '@/components/notes/entities';
import { NoteTypePicker, NOTE_TYPE_META } from '@/components/notes/note-type-picker';
import { useNoteColorTokens } from '@/components/notes/palette';
import { VoiceNoteSection } from '@/components/notes/voice-recorder';
import { SelectModal, type SelectOption } from '@/components/pickers';
import { AppHeader, Card, IconButton, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { listCustomers } from '@/db/repos/customers';
import { listOrders } from '@/db/repos/orders';
import { listProducts } from '@/db/repos/products';
import {
  addEntityLink,
  createNote,
  deleteNote,
  getNote,
  getOutgoingLinks,
  removeLink,
  togglePinned,
  updateNote,
} from '@/db/repos/notes';
import type { LinkTargetType, NoteType } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';

export default function NoteEditor() {
  const t = useTheme();
  const confirm = useConfirm();
  const { showUndo } = useUndo();
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Number(id);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<NoteType>('text');
  const loadedFor = useRef<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openAttachOnce = useRef(false);

  const [typeModal, setTypeModal] = useState(false);
  const [entityModal, setEntityModal] = useState<LinkTargetType | null>(null);
  const [entityOptions, setEntityOptions] = useState<SelectOption[]>([]);

  const tokens = useNoteColorTokens(color);

  const { data, loading, reload } = useAsyncData(async () => {
    const note = await getNote(noteId);
    if (!note) return null;
    const outgoing = await getOutgoingLinks(noteId);
    return { note, outgoing };
  }, [noteId]);

  useEffect(() => {
    if (data?.note && loadedFor.current !== data.note.id) {
      setTitle(data.note.title);
      setBody(data.note.body);
      setPinned(data.note.pinned === 1);
      setColor(data.note.color);
      setNoteType(data.note.note_type ?? 'text');
      loadedFor.current = data.note.id;
      if ((data.note.note_type ?? 'text') === 'linked' && !openAttachOnce.current) {
        openAttachOnce.current = true;
        setTypeModal(true);
      }
    }
  }, [data]);

  useEffect(() => {
    if (loadedFor.current !== noteId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateNote(noteId, {
        title: title || 'Untitled',
        body,
        pinned: pinned ? 1 : 0,
        color,
        note_type: noteType,
      });
      reload();
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, pinned, color, noteType]);

  const changeType = (next: NoteType) => {
    if (next === 'checklist' && noteType !== 'checklist' && !body.includes('[')) {
      setBody(body.trim() ? body.split('\n').map((l) => `[ ] ${l}`).join('\n') : '[ ] ');
    }
    setNoteType(next);
    if (next === 'linked') setTypeModal(true);
  };

  const remove = async () => {
    const choice = await confirm({
      title: 'Delete note',
      message: 'This note will be permanently deleted.',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      const snap = data?.note;
      await deleteNote(noteId);
      router.back();
      if (snap) {
        showUndo({
          message: 'Deleted note',
          onUndo: () =>
            createNote({
              title: snap.title,
              body: snap.body,
              pinned: snap.pinned,
              color: snap.color,
              note_type: snap.note_type ?? 'text',
            }),
        });
      }
    }
  };

  const chooseType = async (type: string) => {
    const linkType = type as LinkTargetType;
    let options: SelectOption[] = [];
    if (linkType === 'product') {
      options = (await listProducts()).map((p) => ({ id: String(p.id), label: p.name }));
    } else if (linkType === 'customer') {
      options = (await listCustomers()).map((c) => ({
        id: String(c.id),
        label: c.name,
        sublabel: c.phone ?? undefined,
      }));
    } else if (linkType === 'order') {
      options = (await listOrders()).map((o) => ({
        id: String(o.id),
        label: o.customer_name || 'Order',
      }));
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

  if (!data) {
    if (loading) return null;
    return (
      <Screen>
        <AppHeader title="Note" back />
        <Text variant="body">Note not found.</Text>
      </Screen>
    );
  }

  const attached = data?.outgoing.filter((l) => l.target_type !== 'note') ?? [];
  const typeMeta = NOTE_TYPE_META[noteType];

  return (
    <Screen style={{ backgroundColor: tokens.isDefault ? t.background : tokens.bg }}>
      <AppHeader
        title={typeMeta.label}
        back
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon={pinned ? 'bookmark' : 'bookmark-outline'}
              color={pinned ? tokens.accent : undefined}
              onPress={() => {
                setPinned((v) => !v);
                togglePinned(noteId, !pinned);
              }}
            />
            <IconButton icon="trash-outline" tone="danger" onPress={remove} />
          </View>
        }
      />

      <SectionHeader title="Note type" />
      <Card style={{ marginBottom: Spacing.lg }}>
        <NoteTypePicker value={noteType} onChange={changeType} />
      </Card>

      <Card
        style={{
          gap: Spacing.sm,
          marginBottom: Spacing.lg,
          backgroundColor: tokens.bg,
          borderColor: tokens.border,
        }}
      >
        <TextField value={title} onChangeText={setTitle} placeholder="Note title" />
        {noteType === 'checklist' ? (
          <ChecklistEditor value={body} onChange={setBody} />
        ) : noteType === 'voice' ? (
          <>
            <TextField
              value={body}
              onChangeText={setBody}
              placeholder="Optional caption…"
              multiline
              style={{ minHeight: 72 }}
            />
            <VoiceNoteSection noteId={noteId} />
          </>
        ) : (
          <TextField
            value={body}
            onChangeText={setBody}
            placeholder="Start writing — ideas, supplier details, to-dos, anything…"
            multiline
            style={{ minHeight: 220 }}
          />
        )}
        <Text variant="caption" color={t.textMuted}>
          Saved automatically
        </Text>
      </Card>

      <SectionHeader title="Color theme" />
      <Card style={{ marginBottom: Spacing.lg }}>
        <ColorPicker value={color} onChange={setColor} />
      </Card>

      <SectionHeader title="Attached to" action="Attach" onAction={() => setTypeModal(true)} />
      <Card style={{ gap: Spacing.sm }}>
        {attached.length === 0 ? (
          <Pressable
            onPress={() => setTypeModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              paddingVertical: Spacing.sm,
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={t.primary} />
            <Text variant="body" color={t.textSecondary}>
              Link this note to a customer, product or order
            </Text>
          </Pressable>
        ) : (
          attached.map((l) => {
            const meta = entityMeta(l.target_type);
            return (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <Pressable
                  onPress={() =>
                    l.target_id && router.push(`${ENTITY_ROUTE[l.target_type]}/${l.target_id}` as Href)
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: Radius.md,
                      backgroundColor: t.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={meta.icon} size={18} color={t.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>
                      {linkDisplayTitle(l.target_title, l.target_type)}
                    </Text>
                    <Text variant="caption" color={t.textSecondary}>
                      {meta.label}
                    </Text>
                  </View>
                </Pressable>
                <IconButton
                  icon="close"
                  size={18}
                  onPress={async () => {
                    await removeLink(l.id);
                    reload();
                  }}
                />
              </View>
            );
          })
        )}
      </Card>

      <SelectModal
        visible={typeModal}
        title="Attach to…"
        searchable={false}
        onClose={() => setTypeModal(false)}
        onSelect={chooseType}
        options={[
          { id: 'customer', label: 'Customer' },
          { id: 'product', label: 'Product' },
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
