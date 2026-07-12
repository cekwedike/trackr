import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Entrance } from '@/components/anim';
import { ENTITY_ROUTE, entityMeta } from '@/components/notes/entities';
import { NoteCard, NoteListRow } from '@/components/notes/note-card';
import { ViewSwitcher, type NotesView } from '@/components/notes/view-switcher';
import { AppHeader, Card, EmptyState, FAB, Screen, Text, TextField, type IconName } from '@/components/ui';
import { FontWeight, Radius, Spacing } from '@/constants/theme';
import { createNote, listNoteEntityLinks, listNotes, togglePinned, type NoteEntityLink } from '@/db/repos/notes';
import type { LinkTargetType, Note } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';

export default function NotesScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<NotesView>('card');

  const { data, reload } = useAsyncData(async () => {
    const [notes, links] = await Promise.all([listNotes(search), listNoteEntityLinks()]);
    return { notes, links };
  }, [search]);

  const notes = data?.notes ?? [];
  const links = data?.links ?? [];

  const linksByNote = useMemo(() => {
    const map = new Map<number, NoteEntityLink[]>();
    for (const l of links) {
      const arr = map.get(l.note_id);
      if (arr) arr.push(l);
      else map.set(l.note_id, [l]);
    }
    return map;
  }, [links]);

  const pinned = useMemo(() => notes.filter((n) => n.pinned === 1), [notes]);
  const others = useMemo(() => notes.filter((n) => n.pinned !== 1), [notes]);

  const columns = width >= 620 ? 3 : 2;

  const create = async () => {
    const id = await createNote({ title: '', body: '' });
    router.push(`/notes/${id}`);
  };

  const open = (id: number) => router.push(`/notes/${id}`);
  const toggle = async (n: Note) => {
    await togglePinned(n.id, n.pinned !== 1);
    reload();
  };

  const attachmentsFor = (id: number) => linksByNote.get(id) ?? [];

  const empty = notes.length === 0;

  return (
    <>
      <Screen>
        <AppHeader title="Notes" subtitle="Your business notebook" />

        <Pressable
          onPress={create}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            backgroundColor: t.card,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: t.border,
            paddingHorizontal: Spacing.lg,
            height: 50,
            marginBottom: Spacing.md,
          }}
        >
          <Ionicons name="create-outline" size={20} color={t.primary} />
          <Text variant="body" color={t.textMuted} style={{ flex: 1 }}>
            Take a note…
          </Text>
          <Ionicons name="add-circle" size={26} color={t.primary} />
        </Pressable>

        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes..."
          style={{ marginBottom: Spacing.md }}
        />

        <View style={{ marginBottom: Spacing.lg }}>
          <ViewSwitcher value={view} onChange={setView} />
        </View>

        {empty ? (
          <EmptyState
            icon="document-text-outline"
            title={search ? 'No matching notes' : 'No notes yet'}
            message={
              search
                ? 'Try a different search term.'
                : 'Jot down recipes, ideas and supplier info — and attach them to customers, products or orders.'
            }
            actionLabel={search ? undefined : 'New note'}
            onAction={search ? undefined : create}
          />
        ) : view === 'card' ? (
          <CardView
            pinned={pinned}
            others={others}
            columns={columns}
            attachmentsFor={attachmentsFor}
            onOpen={open}
            onToggle={toggle}
          />
        ) : view === 'list' ? (
          <ListView
            pinned={pinned}
            others={others}
            attachmentsFor={attachmentsFor}
            onOpen={open}
            onToggle={toggle}
          />
        ) : (
          <ConnectionView notes={notes} links={links} onOpen={open} />
        )}
      </Screen>
      <FAB icon="add" label="Note" onPress={create} />
    </>
  );
}

// ---------- Card (masonry) view ----------

function Masonry({
  notes,
  columns,
  attachmentsFor,
  onOpen,
  onToggle,
}: {
  notes: Note[];
  columns: number;
  attachmentsFor: (id: number) => NoteEntityLink[];
  onOpen: (id: number) => void;
  onToggle: (n: Note) => void;
}) {
  const cols: Note[][] = Array.from({ length: columns }, () => []);
  notes.forEach((n, i) => cols[i % columns].push(n));
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.md }}>
      {cols.map((col, ci) => (
        <View key={ci} style={{ flex: 1, gap: Spacing.md }}>
          {col.map((n, ri) => (
            <Entrance key={n.id} delay={Math.min((ri * columns + ci) * 45, 350)}>
              <NoteCard
                note={n}
                attachments={attachmentsFor(n.id)}
                onPress={() => onOpen(n.id)}
                onTogglePin={() => onToggle(n)}
              />
            </Entrance>
          ))}
        </View>
      ))}
    </View>
  );
}

function CardView({
  pinned,
  others,
  columns,
  attachmentsFor,
  onOpen,
  onToggle,
}: {
  pinned: Note[];
  others: Note[];
  columns: number;
  attachmentsFor: (id: number) => NoteEntityLink[];
  onOpen: (id: number) => void;
  onToggle: (n: Note) => void;
}) {
  return (
    <View style={{ gap: Spacing.lg }}>
      {pinned.length > 0 ? (
        <View style={{ gap: Spacing.sm }}>
          <GroupLabel icon="bookmark" text="Pinned" />
          <Masonry notes={pinned} columns={columns} attachmentsFor={attachmentsFor} onOpen={onOpen} onToggle={onToggle} />
        </View>
      ) : null}
      {others.length > 0 ? (
        <View style={{ gap: Spacing.sm }}>
          {pinned.length > 0 ? <GroupLabel icon="documents-outline" text="Others" /> : null}
          <Masonry notes={others} columns={columns} attachmentsFor={attachmentsFor} onOpen={onOpen} onToggle={onToggle} />
        </View>
      ) : null}
    </View>
  );
}

// ---------- List view ----------

function ListView({
  pinned,
  others,
  attachmentsFor,
  onOpen,
  onToggle,
}: {
  pinned: Note[];
  others: Note[];
  attachmentsFor: (id: number) => NoteEntityLink[];
  onOpen: (id: number) => void;
  onToggle: (n: Note) => void;
}) {
  const t = useTheme();
  const section = (items: Note[]) => (
    <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
      {items.map((n, idx) => (
        <View key={n.id}>
          <NoteListRow
            note={n}
            attachments={attachmentsFor(n.id)}
            onPress={() => onOpen(n.id)}
            onTogglePin={() => onToggle(n)}
          />
          {idx < items.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
        </View>
      ))}
    </Card>
  );
  return (
    <View style={{ gap: Spacing.lg }}>
      {pinned.length > 0 ? (
        <View style={{ gap: Spacing.sm }}>
          <GroupLabel icon="bookmark" text="Pinned" />
          <Entrance>{section(pinned)}</Entrance>
        </View>
      ) : null}
      {others.length > 0 ? (
        <View style={{ gap: Spacing.sm }}>
          {pinned.length > 0 ? <GroupLabel icon="documents-outline" text="Others" /> : null}
          <Entrance delay={pinned.length > 0 ? 60 : 0}>{section(others)}</Entrance>
        </View>
      ) : null}
    </View>
  );
}

// ---------- Connection view ----------

interface ConnGroup {
  key: string;
  type: LinkTargetType;
  id: number | null;
  title: string;
  notes: Note[];
}

function ConnectionView({
  notes,
  links,
  onOpen,
}: {
  notes: Note[];
  links: NoteEntityLink[];
  onOpen: (id: number) => void;
}) {
  const { groups, unattached } = useMemo(() => {
    const byId = new Map<number, Note>(notes.map((n) => [n.id, n]));
    const map = new Map<string, ConnGroup>();
    const attached = new Set<number>();
    for (const l of links) {
      const note = byId.get(l.note_id);
      if (!note) continue;
      attached.add(note.id);
      const key = `${l.target_type}:${l.target_id ?? 'null'}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          type: l.target_type,
          id: l.target_id,
          title: l.target_title || entityMeta(l.target_type).label,
          notes: [],
        };
        map.set(key, g);
      }
      if (!g.notes.some((x) => x.id === note.id)) g.notes.push(note);
    }
    const order: Record<string, number> = { customer: 0, product: 1, order: 2 };
    const groups = Array.from(map.values()).sort(
      (a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.title.localeCompare(b.title),
    );
    const unattached = notes.filter((n) => !attached.has(n.id));
    return { groups, unattached };
  }, [notes, links]);

  return (
    <View style={{ gap: Spacing.md }}>
      {groups.map((g, i) => (
        <Entrance key={g.key} delay={Math.min(i * 45, 300)}>
          <ConnectionCard group={g} onOpen={onOpen} />
        </Entrance>
      ))}
      {unattached.length > 0 ? (
        <Entrance delay={Math.min(groups.length * 45, 300)}>
          <UnattachedCard notes={unattached} onOpen={onOpen} />
        </Entrance>
      ) : null}
      {groups.length === 0 && unattached.length === 0 ? (
        <EmptyState icon="git-network-outline" title="Nothing linked yet" message="Attach notes to customers, products or orders from the note editor to see them grouped here." />
      ) : null}
    </View>
  );
}

function ConnectionCard({ group, onOpen }: { group: ConnGroup; onOpen: (id: number) => void }) {
  const t = useTheme();
  const meta = entityMeta(group.type);
  const goEntity = () => {
    if (group.id != null && ENTITY_ROUTE[group.type]) {
      router.push(`${ENTITY_ROUTE[group.type]}/${group.id}` as Href);
    }
  };
  return (
    <Card style={{ gap: Spacing.sm }}>
      <Pressable
        onPress={goEntity}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, opacity: pressed ? 0.6 : 1 })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            backgroundColor: t.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={meta.icon} size={20} color={t.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="bold" numberOfLines={1}>
            {group.title}
          </Text>
          <Text variant="caption" color={t.textSecondary}>
            {meta.label} · {group.notes.length} {group.notes.length === 1 ? 'note' : 'notes'}
          </Text>
        </View>
        {group.id != null && ENTITY_ROUTE[group.type] ? (
          <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
        ) : null}
      </Pressable>
      <ConnectedNotes notes={group.notes} onOpen={onOpen} />
    </Card>
  );
}

function UnattachedCard({ notes, onOpen }: { notes: Note[]; onOpen: (id: number) => void }) {
  const t = useTheme();
  return (
    <Card style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            backgroundColor: t.cardAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={t.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="bold">Unattached</Text>
          <Text variant="caption" color={t.textSecondary}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} not linked to anything
          </Text>
        </View>
      </View>
      <ConnectedNotes notes={notes} onOpen={onOpen} />
    </Card>
  );
}

/** Indented, connected list of note titles under a group header. */
function ConnectedNotes({ notes, onOpen }: { notes: Note[]; onOpen: (id: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ marginLeft: 19, borderLeftWidth: 1.5, borderLeftColor: t.border, paddingLeft: Spacing.md, gap: 2 }}>
      {notes.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => onOpen(n.id)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            paddingVertical: Spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name={n.pinned ? 'bookmark' : 'document-text-outline'} size={15} color={n.pinned ? t.warning : t.textMuted} />
          <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {n.title || 'Untitled'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------- shared ----------

function GroupLabel({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={13} color={t.textSecondary} />
      <Text variant="label" color={t.textSecondary} style={{ letterSpacing: 0.5, fontWeight: FontWeight.semibold }}>
        {text.toUpperCase()}
      </Text>
    </View>
  );
}
