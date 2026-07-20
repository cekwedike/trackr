import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Text, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback } from '@/lib/haptics';

export interface ChecklistItem {
  checked: boolean;
  text: string;
}

/** Parse checklist body lines (`[ ]` / `[x]`). Plain lines become unchecked items. */
export function parseChecklist(body: string): ChecklistItem[] {
  const lines = body.split('\n');
  if (lines.length === 1 && lines[0] === '') return [{ checked: false, text: '' }];
  return lines.map((line) => {
    const m = line.match(/^\s*\[([ xX])\]\s?(.*)$/);
    if (m) return { checked: m[1].toLowerCase() === 'x', text: m[2] };
    return { checked: false, text: line };
  });
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items.map((i) => `[${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
}

export function ChecklistEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTheme();
  const items = parseChecklist(value);

  const commit = (next: ChecklistItem[]) => onChange(serializeChecklist(next));

  const toggle = (index: number) => {
    selectionFeedback();
    const next = items.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it));
    commit(next);
  };

  const setText = (index: number, text: string) => {
    const next = items.map((it, i) => (i === index ? { ...it, text } : it));
    commit(next);
  };

  const addItem = () => {
    commit([...items, { checked: false, text: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      commit([{ checked: false, text: '' }]);
      return;
    }
    commit(items.filter((_, i) => i !== index));
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      {items.map((item, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Pressable
            onPress={() => toggle(index)}
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              borderRadius: Radius.sm,
              borderWidth: 2,
              borderColor: item.checked ? t.primary : t.borderStrong,
              backgroundColor: item.checked ? t.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={item.checked ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </Pressable>
          <TextField
            value={item.text}
            onChangeText={(text) => setText(index, text)}
            placeholder="Checklist item"
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Pressable onPress={() => removeItem(index)} hitSlop={10} accessibilityLabel="Remove item">
            <Ionicons name="close" size={18} color={t.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={addItem}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }}
      >
        <Ionicons name="add-circle-outline" size={20} color={t.primary} />
        <Text variant="body" color={t.primary}>
          Add item
        </Text>
      </Pressable>
    </View>
  );
}
