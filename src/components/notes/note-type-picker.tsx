import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { NoteType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback } from '@/lib/haptics';

export const NOTE_TYPE_META: Record<
  NoteType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }
> = {
  text: { label: 'Text', icon: 'document-text-outline', hint: 'Free-form notes' },
  checklist: { label: 'Checklist', icon: 'checkbox-outline', hint: 'To-dos you can tick off' },
  voice: { label: 'Voice', icon: 'mic-outline', hint: 'Record audio on device' },
  linked: { label: 'Linked', icon: 'link-outline', hint: 'Start by attaching a record' },
};

export function NoteTypePicker({
  value,
  onChange,
}: {
  value: NoteType;
  onChange: (type: NoteType) => void;
}) {
  const t = useTheme();
  const types: NoteType[] = ['text', 'checklist', 'voice', 'linked'];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
      {types.map((type) => {
        const meta = NOTE_TYPE_META[type];
        const selected = value === type;
        return (
          <Pressable
            key={type}
            onPress={() => {
              selectionFeedback();
              onChange(type);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.pill,
              borderWidth: 1,
              borderColor: selected ? t.primary : t.border,
              backgroundColor: selected ? t.primarySoft : t.card,
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Ionicons name={meta.icon} size={16} color={selected ? t.primary : t.textSecondary} />
            <Text variant="caption" weight={selected ? 'semibold' : 'regular'} color={selected ? t.primary : t.textSecondary}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
