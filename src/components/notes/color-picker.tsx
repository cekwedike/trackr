import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useThemeName } from '@/hooks/use-theme';

import { NOTE_COLORS } from './palette';

/** Horizontal row of color swatches for choosing a note's color theme. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (key: string) => void;
}) {
  const name = useThemeName();
  const selected = value ?? 'default';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.sm, paddingVertical: Spacing.xs, paddingHorizontal: 2 }}
    >
      {NOTE_COLORS.map((c) => {
        const variant = c[name];
        const active = c.key === selected;
        const isDefault = c.key === 'default';
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: Radius.pill,
              backgroundColor: variant.bg,
              borderWidth: active ? 2.5 : 1.5,
              borderColor: active ? variant.accent : variant.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {isDefault && !active ? (
              <Ionicons name="ban-outline" size={18} color={variant.accent} />
            ) : active ? (
              <Ionicons name="checkmark" size={18} color={variant.accent} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
