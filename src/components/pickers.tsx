import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, Divider, IconButton, Text, TextField } from '@/components/ui';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, formatDate } from '@/lib/date';

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

export function SelectModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
  searchable = true,
  footerLabel,
  onFooter,
  allowClear,
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
  searchable?: boolean;
  footerLabel?: string;
  onFooter?: () => void;
  allowClear?: boolean;
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={onClose} />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '80%',
          backgroundColor: t.background,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          padding: Spacing.lg,
          gap: Spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="subtitle">{title}</Text>
          <IconButton icon="close" onPress={onClose} />
        </View>
        {searchable ? (
          <TextField value={query} onChangeText={setQuery} placeholder="Search..." />
        ) : null}
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          {allowClear ? (
            <>
              <Pressable
                onPress={() => {
                  onSelect('');
                  onClose();
                }}
                style={{ paddingVertical: Spacing.md }}
              >
                <Text variant="body" color={t.textSecondary}>None</Text>
              </Pressable>
              <Divider />
            </>
          ) : null}
          {filtered.map((o) => (
            <View key={o.id}>
              <Pressable
                onPress={() => {
                  onSelect(o.id);
                  onClose();
                }}
                style={({ pressed }) => ({ paddingVertical: Spacing.md, opacity: pressed ? 0.6 : 1 })}
              >
                <Text variant="body" weight="medium">{o.label}</Text>
                {o.sublabel ? <Text variant="caption" color={t.textSecondary}>{o.sublabel}</Text> : null}
              </Pressable>
              <Divider />
            </View>
          ))}
          {filtered.length === 0 ? (
            <Text variant="caption" color={t.textMuted} style={{ paddingVertical: Spacing.lg, textAlign: 'center' }}>
              No matches
            </Text>
          ) : null}
        </ScrollView>
        {footerLabel && onFooter ? (
          <Button
            title={footerLabel}
            icon="add"
            variant="secondary"
            onPress={() => {
              onFooter();
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

/** A tappable field that shows a value and opens the select modal. */
export function SelectField({
  label,
  value,
  placeholder = 'Select...',
  onPress,
}: {
  label?: string;
  value?: string | null;
  placeholder?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? <Text variant="label" color={t.textSecondary}>{label}</Text> : null}
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.inputBg,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: t.border,
          paddingHorizontal: Spacing.md,
          height: 48,
        }}
      >
        <Text variant="body" color={value ? t.text : t.textMuted}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>
    </View>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
}: {
  label?: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'datetime';
}) {
  const t = useTheme();
  const [iosOpen, setIosOpen] = useState(false);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        onChange: (e, d) => {
          if (e.type !== 'set' || !d) return;
          if (mode === 'datetime') {
            DateTimePickerAndroid.open({
              value: d,
              mode: 'time',
              is24Hour: false,
              onChange: (e2, d2) => {
                if (e2.type === 'set' && d2) onChange(d2);
              },
            });
          } else {
            onChange(d);
          }
        },
      });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? <Text variant="label" color={t.textSecondary}>{label}</Text> : null}
      <Pressable
        onPress={open}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.inputBg,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: t.border,
          paddingHorizontal: Spacing.md,
          height: 48,
        }}
      >
        <Text variant="body">{mode === 'datetime' ? formatDateTime(value.toISOString()) : formatDate(value.toISOString())}</Text>
        <Ionicons name="calendar-outline" size={18} color={t.textMuted} />
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <View style={{ backgroundColor: t.card, borderRadius: Radius.md, padding: Spacing.sm }}>
          <DateTimePicker
            value={value}
            mode={mode === 'datetime' ? 'datetime' : 'date'}
            display="inline"
            onChange={(_e, d) => {
              if (d) onChange(d);
            }}
          />
          <Button title="Done" onPress={() => setIosOpen(false)} />
        </View>
      ) : null}
    </View>
  );
}

export const PickerStyles = { fontSize: FontSize.md };
