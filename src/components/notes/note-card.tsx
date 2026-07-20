import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { FontSize, FontWeight, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Note } from '@/db/types';
import { useTheme, useThemeName } from '@/hooks/use-theme';
import { fromNow } from '@/lib/date';

import { entityMeta, linkDisplayTitle } from './entities';
import { useNoteColorTokens } from './palette';
import type { NoteEntityLink } from '@/db/repos/notes';

/** Strip common markdown noise for a clean snippet preview. */
export function notePreview(body: string, max = 160): string {
  return body
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[#*_>`~\-\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** A colored Google-Keep-style note card for the grid / masonry view. */
export function NoteCard({
  note,
  attachments,
  onPress,
  onTogglePin,
}: {
  note: Note;
  attachments: NoteEntityLink[];
  onPress: () => void;
  onTogglePin: () => void;
}) {
  const t = useTheme();
  const name = useThemeName();
  const c = useNoteColorTokens(note.color);
  const snippet = notePreview(note.body);
  const shown = attachments.slice(0, 3);
  const extra = attachments.length - shown.length;
  const chipBg = c.isDefault ? t.cardAlt : name === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.06)';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: c.bg,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding: Spacing.md,
          gap: Spacing.sm,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        Shadow.sm,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs }}>
        <Text variant="body" weight="bold" numberOfLines={2} style={{ flex: 1 }}>
          {note.title || 'Untitled'}
        </Text>
        <Pressable onPress={onTogglePin} hitSlop={10}>
          <Ionicons
            name={note.pinned ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={note.pinned ? c.accent : t.textMuted}
          />
        </Pressable>
      </View>

      {(note.note_type ?? 'text') !== 'text' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons
            name={
              note.note_type === 'voice'
                ? 'mic-outline'
                : note.note_type === 'checklist'
                  ? 'checkbox-outline'
                  : 'link-outline'
            }
            size={12}
            color={c.accent}
          />
          <Text variant="caption" color={t.textSecondary} style={{ textTransform: 'capitalize' }}>
            {note.note_type}
          </Text>
        </View>
      ) : null}

      {snippet ? (
        <Text variant="body" color={t.textSecondary} numberOfLines={7} style={{ fontSize: FontSize.sm, lineHeight: 20 }}>
          {snippet}
        </Text>
      ) : note.note_type === 'voice' ? (
        <Text variant="caption" color={t.textMuted}>
          Voice note
        </Text>
      ) : null}

      {shown.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {shown.map((a) => {
            const meta = entityMeta(a.target_type);
            return (
              <View
                key={a.link_id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: chipBg,
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: 3,
                  borderRadius: Radius.pill,
                  maxWidth: '100%',
                }}
              >
                <Ionicons name={meta.icon} size={11} color={c.accent} />
                <Text variant="caption" numberOfLines={1} style={{ color: t.textSecondary, maxWidth: 110 }}>
                  {linkDisplayTitle(a.target_title, a.target_type)}
                </Text>
              </View>
            );
          })}
          {extra > 0 ? (
            <View
              style={{
                justifyContent: 'center',
                paddingHorizontal: Spacing.sm,
                paddingVertical: 3,
                borderRadius: Radius.pill,
                backgroundColor: chipBg,
              }}
            >
              <Text variant="caption" style={{ color: t.textSecondary, fontWeight: FontWeight.semibold }}>
                +{extra}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text variant="caption" color={t.textMuted} style={{ marginTop: 2 }}>
        {fromNow(note.updated_at)}
      </Text>
    </Pressable>
  );
}

/** Compact single-row representation of a note for the List view. */
export function NoteListRow({
  note,
  attachments,
  onPress,
  onTogglePin,
}: {
  note: Note;
  attachments: NoteEntityLink[];
  onPress: () => void;
  onTogglePin: () => void;
}) {
  const t = useTheme();
  const c = useNoteColorTokens(note.color);
  const snippet = notePreview(note.body, 90);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 5,
          alignSelf: 'stretch',
          minHeight: 36,
          borderRadius: Radius.pill,
          backgroundColor: c.isDefault ? t.borderStrong : c.accent,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>
        {snippet ? (
          <Text variant="caption" color={t.textSecondary} numberOfLines={1}>
            {snippet}
          </Text>
        ) : (
          <Text variant="caption" color={t.textMuted} numberOfLines={1}>
            {fromNow(note.updated_at)}
          </Text>
        )}
      </View>
      {attachments.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="link" size={13} color={t.textMuted} />
          <Text variant="caption" color={t.textMuted}>
            {attachments.length}
          </Text>
        </View>
      ) : null}
      <Pressable onPress={onTogglePin} hitSlop={10}>
        <Ionicons
          name={note.pinned ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color={note.pinned ? c.accent : t.textMuted}
        />
      </Pressable>
    </Pressable>
  );
}
