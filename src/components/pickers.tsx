import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, IconButton, Text, type IconName } from '@/components/ui';
import { INDUSTRIES } from '@/constants/industries';
import { FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';
import { formatDateTime, formatDate } from '@/lib/date';
import { selectionFeedback } from '@/lib/haptics';

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
  /** Optional leading icon. Falls back to the matching industry icon when the option id is an industry. */
  icon?: IconName;
  /** Optional accent tint for the row. Falls back to the matching industry accent. */
  tint?: string;
}

const industryById = (id: string) => INDUSTRIES.find((i) => i.id === id);

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
  selectedId,
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
  /** Highlights the currently-selected row. Falls back to the active industry for industry lists. */
  selectedId?: string;
}) {
  const t = useTheme();
  const { accent, industry } = useApp();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  const isSelected = (o: SelectOption) => {
    if (selectedId != null) return o.id === selectedId;
    const ind = industryById(o.id);
    return ind ? ind.id === industry.id : false;
  };

  // Only mount the native <Modal> while open. Multiple concurrently-mounted
  // RN <Modal>s (a screen can declare several SelectModals) conflict on Android
  // and the first-declared one may fail to present; unmounting hidden pickers
  // guarantees at most one native modal exists at a time.
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: t.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(180)}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '82%',
          backgroundColor: t.card,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          paddingTop: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xl,
          gap: Spacing.md,
          ...Shadow.lg,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: 3,
            backgroundColor: hexToRgba(accent, 0.55),
            marginBottom: Spacing.xs,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title">{title}</Text>
          <IconButton icon="close" onPress={onClose} />
        </View>
        {searchable ? <TextField value={query} onChangeText={setQuery} placeholder="Search..." /> : null}
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.sm }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {allowClear ? (
            <Pressable
              onPress={() => {
                onSelect('');
                onClose();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                padding: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: t.cardAlt,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: Radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: t.card,
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={t.textMuted} />
              </View>
              <Text variant="body" weight="medium" color={t.textSecondary}>
                None
              </Text>
            </Pressable>
          ) : null}
          {filtered.map((o) => {
            const ind = industryById(o.id);
            const icon = o.icon ?? ind?.icon;
            const tint = o.tint ?? ind?.accent ?? accent;
            const selected = isSelected(o);
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  onSelect(o.id);
                  onClose();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: selected ? tint : t.border,
                  backgroundColor: selected ? hexToRgba(tint, 0.12) : t.cardAlt,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {icon ? (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: Radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: hexToRgba(tint, selected ? 0.2 : 0.14),
                    }}
                  >
                    <Ionicons name={icon} size={20} color={tint} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">
                    {o.label}
                  </Text>
                  {o.sublabel ? (
                    <Text variant="caption" color={t.textSecondary} numberOfLines={1}>
                      {o.sublabel}
                    </Text>
                  ) : null}
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={tint} /> : null}
              </Pressable>
            );
          })}
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
      </Animated.View>
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
