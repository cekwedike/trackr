import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

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

  // Entrance animation is driven by shared values + `useAnimatedStyle` (a
  // translateY transform + opacity), NOT by reanimated `entering` layout
  // animations. On Android, layout `entering` animations (e.g. `SlideInDown`)
  // leave nested touchables' hit-test regions offset from where they render
  // until a re-layout is forced — which made the close (×) button, option rows
  // and the search clear button silently ignore taps here (tapping the plain
  // backdrop still worked, and typing a search query forced a re-layout that
  // "fixed" it). Transform-based animation keeps the native layout fixed, so
  // every nested Pressable receives touches immediately. See the base `Sheet`
  // in nav/sheet.tsx which uses the same pattern.
  // Refs: reanimated issues #7723 / #6676, react-native #51621.
  const translateY = useSharedValue(48);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 180 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
    } else {
      // Reset so the next open animates in from the bottom again.
      opacity.value = 0;
      translateY.value = 48;
    }
  }, [visible, opacity, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[{ flex: 1, backgroundColor: t.overlay }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      {/* Lift the sheet above the keyboard so the search field / footer stay
          reachable. The KeyboardAvoidingView fills the screen (so the sheet's
          `maxHeight: '82%'` still resolves) and pins the sheet to the bottom via
          `justifyContent: 'flex-end'`. `pointerEvents="box-none"` keeps taps on
          the empty area falling through to the backdrop's close Pressable.
          Behavior follows the Expo SDK 57 guide: `padding` on iOS, undefined on
          Android (relies on `softwareKeyboardLayoutMode: 'resize'`). The sheet's
          transform-based entrance animation stays on the inner Animated.View. */}
      <KeyboardAvoidingView
        style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
      <Animated.View
        style={[{
          maxHeight: '82%',
          backgroundColor: t.card,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          paddingTop: Spacing.md,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xl,
          gap: Spacing.md,
          ...Shadow.lg,
        }, sheetStyle]}
      >
        <View style={{ alignItems: 'center', paddingBottom: Spacing.xs }}>
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: Radius.pill,
              backgroundColor: hexToRgba(accent, 0.5),
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="title" numberOfLines={1}>{title}</Text>
          </View>
          <IconButton icon="close" tone="default" onPress={onClose} />
        </View>

        {searchable ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              backgroundColor: t.inputBg,
              borderRadius: Radius.md,
              borderWidth: 1.5,
              borderColor: searchFocused ? accent : t.border,
              paddingHorizontal: Spacing.md,
              height: 50,
            }}
          >
            <Ionicons name="search" size={18} color={searchFocused ? accent : t.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search..."
              placeholderTextColor={t.textMuted}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{ flex: 1, color: t.text, fontSize: FontSize.md, paddingVertical: Spacing.sm }}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={t.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.sm }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {allowClear ? (
            <Pressable
              onPress={() => {
                selectionFeedback();
                onSelect('');
                onClose();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                minHeight: 60,
                borderRadius: Radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border,
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
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: t.border,
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
                  selectionFeedback();
                  onSelect(o.id);
                  onClose();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  minHeight: 60,
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
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: hexToRgba(tint, selected ? 0.32 : 0.16),
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
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: Radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hexToRgba(accent, 0.1),
                  marginBottom: Spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: Radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: hexToRgba(accent, 0.16),
                  }}
                >
                  <Ionicons name="search-outline" size={22} color={accent} />
                </View>
              </View>
              <Text variant="subtitle">No matches</Text>
              <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center' }}>
                Try a different search
              </Text>
            </View>
          ) : null}
        </ScrollView>
        {footerLabel && onFooter ? (
          <>
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: t.border,
                marginHorizontal: -Spacing.lg,
              }}
            />
            <Button
              title={footerLabel}
              icon="add"
              variant="secondary"
              onPress={() => {
                onFooter();
              }}
            />
          </>
        ) : null}
      </Animated.View>
      </KeyboardAvoidingView>
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
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.inputBg,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: t.border,
          paddingHorizontal: Spacing.md,
          minHeight: 50,
          opacity: pressed ? 0.7 : 1,
        })}
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
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.inputBg,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: t.border,
          paddingHorizontal: Spacing.md,
          minHeight: 50,
          opacity: pressed ? 0.7 : 1,
        })}
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
