import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import type { IconName } from '@/components/ui';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type NotesView = 'card' | 'list' | 'connection';

const VIEWS: { key: NotesView; icon: IconName; label: string }[] = [
  { key: 'card', icon: 'grid-outline', label: 'Card' },
  { key: 'list', icon: 'list-outline', label: 'List' },
  { key: 'connection', icon: 'git-network-outline', label: 'Connections' },
];

/** Icon-based segmented control for switching between note layouts. */
export function ViewSwitcher({ value, onChange }: { value: NotesView; onChange: (v: NotesView) => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.cardAlt,
        borderRadius: Radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {VIEWS.map((v) => {
        const active = v.key === value;
        return (
          <Pressable
            key={v.key}
            onPress={() => onChange(v.key)}
            accessibilityLabel={`${v.label} view`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.sm,
              backgroundColor: active ? t.card : 'transparent',
              ...(active ? Shadow.sm : null),
            }}
          >
            <Ionicons name={v.icon} size={16} color={active ? t.primary : t.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}
