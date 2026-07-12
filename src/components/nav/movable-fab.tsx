import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/nav/sheet';
import type { IconName } from '@/components/ui';
import { Text } from '@/components/ui';
import { Duration, Spring } from '@/constants/motion';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';
import { pressFeedback, selectionFeedback } from '@/lib/haptics';

export interface FabAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

const SIZE = 60;
const CIRCLE = 48;
const MARGIN = Spacing.lg;
const TAB_BAR = 60;

type Side = 'left' | 'right';

function clampW(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

interface PersistedPos {
  side: Side;
  ty: number;
}

/**
 * A draggable, editable floating action button that expands into a WhatsApp-style
 * speed-dial menu.
 * - Drag anywhere; releases snap to the nearest screen edge and persist.
 * - Tap expands a staggered stack of action pills over a dimmed scrim.
 * - Tap an action to run it and collapse; tap "Edit" (or long-press the FAB) to
 *   choose which actions appear. The selection is persisted per `storageKey`.
 */
export function MovableFab({
  actions,
  storageKey = 'fab',
  defaultKeys,
}: {
  actions: FabAction[];
  storageKey?: string;
  defaultKeys?: string[];
}) {
  const t = useTheme();
  const { accent } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const maxLeft = -(width - SIZE - 2 * MARGIN);
  const contentHeight = height - insets.top - (TAB_BAR + insets.bottom);
  const minUp = -Math.max(0, contentHeight - SIZE - 2 * MARGIN);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pressed = useSharedValue(0);
  const progress = useSharedValue(0);

  const [side, setSide] = useState<Side>('right');
  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchorBottom, setAnchorBottom] = useState(MARGIN + SIZE + Spacing.md);
  const [editOpen, setEditOpen] = useState(false);

  const visibleActions = useMemo(() => {
    const keys = selectedKeys ?? defaultKeys ?? actions.map((a) => a.key);
    const set = new Set(keys);
    let list = actions.filter((a) => set.has(a.key));
    if (!list.length && defaultKeys) list = actions.filter((a) => defaultKeys.includes(a.key));
    if (!list.length) list = actions;
    return list;
  }, [actions, selectedKeys, defaultKeys]);

  const persistPos = (s: Side, y: number) => {
    SecureStore.setItemAsync(`movablefab.${storageKey}`, JSON.stringify({ side: s, ty: y } satisfies PersistedPos)).catch(() => {});
  };
  const persistSelection = (keys: string[]) => {
    SecureStore.setItemAsync(`movablefab.${storageKey}.actions`, JSON.stringify(keys)).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(`movablefab.${storageKey}`)
      .then((raw) => {
        if (!active || !raw) return;
        const p = JSON.parse(raw) as PersistedPos;
        tx.value = p.side === 'left' ? maxLeft : 0;
        ty.value = clampW(p.ty ?? 0, minUp, 0);
        setSide(p.side === 'left' ? 'left' : 'right');
      })
      .catch(() => {});
    SecureStore.getItemAsync(`movablefab.${storageKey}.actions`)
      .then((raw) => {
        if (!active || !raw) return;
        const keys = JSON.parse(raw) as string[];
        if (Array.isArray(keys)) setSelectedKeys(keys);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, maxLeft, minUp]);

  useEffect(() => {
    if (expanded) {
      setMounted(true);
      progress.value = withTiming(1, { duration: reduced ? Duration.fast : Duration.base });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: reduced ? Duration.instant : Duration.fast }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, reduced]);

  useEffect(() => {
    if (!expanded) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setExpanded(false);
      return true;
    });
    return () => sub.remove();
  }, [expanded]);

  const open = () => {
    pressFeedback();
    const s: Side = tx.value < maxLeft / 2 ? 'left' : 'right';
    setSide(s);
    setAnchorBottom(MARGIN - ty.value + SIZE + Spacing.md);
    setExpanded(true);
  };
  const close = () => setExpanded(false);
  // Tapping the FAB toggles: when the speed-dial is open the icon has rotated to an
  // "×", so a tap must dismiss rather than re-open. The Tap gesture is recreated on
  // every render, so this closure always sees the current `expanded` value.
  const toggle = () => {
    if (expanded) close();
    else open();
  };
  const openEditor = () => {
    setExpanded(false);
    setEditOpen(true);
  };
  const runAction = (a: FabAction) => {
    setExpanded(false);
    a.onPress();
  };

  const toggleKey = (key: string) => {
    selectionFeedback();
    const base = selectedKeys ?? visibleActions.map((a) => a.key);
    const set = new Set(base);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    const next = actions.map((a) => a.key).filter((k) => set.has(k));
    setSelectedKeys(next);
    persistSelection(next);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onChange((e) => {
      tx.value = clampW(startX.value + e.translationX, maxLeft, 0);
      ty.value = clampW(startY.value + e.translationY, minUp, 0);
    })
    .onEnd(() => {
      const s: Side = tx.value < maxLeft / 2 ? 'left' : 'right';
      tx.value = withSpring(s === 'left' ? maxLeft : 0, Spring.snappy);
      runOnJS(setSide)(s);
      runOnJS(persistPos)(s, ty.value);
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      runOnJS(toggle)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(320)
    .onStart(() => {
      pressed.value = withSpring(1, Spring.snappy);
      runOnJS(openEditor)();
    })
    .onFinalize(() => {
      pressed.value = withSpring(0, Spring.snappy);
    });

  const gesture = Gesture.Race(pan, longPress, tap);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + pressed.value * 0.06 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 45}deg` }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!actions.length) return null;

  const items: ({ type: 'edit' } | { type: 'action'; action: FabAction })[] = [
    { type: 'edit' },
    ...visibleActions.map((action) => ({ type: 'action' as const, action })),
  ];

  return (
    <>
      {mounted ? (
        <>
          <Animated.View
            pointerEvents={expanded ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay, zIndex: 40 }, backdropStyle]}
          >
            <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close menu" />
          </Animated.View>

          <View
            pointerEvents={expanded ? 'box-none' : 'none'}
            style={{
              position: 'absolute',
              bottom: anchorBottom,
              [side === 'left' ? 'left' : 'right']: MARGIN + (SIZE - CIRCLE) / 2,
              alignItems: side === 'left' ? 'flex-start' : 'flex-end',
              gap: Spacing.md,
              zIndex: 45,
            }}
          >
            {items.map((it, index) =>
              it.type === 'edit' ? (
                <SpeedDialPill
                  key="__edit"
                  index={index}
                  total={items.length}
                  progress={progress}
                  side={side}
                  icon="options"
                  label="Edit menu"
                  circleBg={t.cardAlt}
                  iconColor={accent}
                  labelBg={t.card}
                  labelColor={t.textSecondary}
                  borderColor={t.border}
                  onPress={openEditor}
                />
              ) : (
                <SpeedDialPill
                  key={it.action.key}
                  index={index}
                  total={items.length}
                  progress={progress}
                  side={side}
                  icon={it.action.icon}
                  label={it.action.label}
                  circleBg={accent}
                  iconColor="#FFFFFF"
                  labelBg={t.card}
                  labelColor={t.text}
                  borderColor={t.border}
                  onPress={() => runAction(it.action)}
                />
              ),
            )}
          </View>
        </>
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Close quick actions' : 'Open quick actions'}
          style={[
            {
              position: 'absolute',
              right: MARGIN,
              bottom: MARGIN,
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 5 },
              elevation: 12,
            },
            fabStyle,
          ]}
        >
          <Animated.View style={iconStyle}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit quick actions" accent>
        <Text variant="caption" color={t.textSecondary} style={{ marginBottom: Spacing.md }}>
          Choose which actions appear when you tap the button. Drag the button anywhere; it snaps to the edge.
        </Text>
        <View style={{ gap: Spacing.sm }}>
          {actions.map((a) => {
            const active = visibleActions.some((v) => v.key === a.key);
            return (
              <Pressable
                key={a.key}
                onPress={() => toggleKey(a.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  padding: Spacing.sm,
                  borderRadius: Radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? accent : t.border,
                  backgroundColor: active ? hexToRgba(accent, 0.1) : t.card,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: Radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? accent : t.cardAlt,
                  }}
                >
                  <Ionicons name={a.icon} size={20} color={active ? '#FFFFFF' : t.textSecondary} />
                </View>
                <Text variant="body" weight="semibold" style={{ flex: 1 }}>
                  {a.label}
                </Text>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={active ? accent : t.textMuted}
                />
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

function SpeedDialPill({
  index,
  total,
  progress,
  side,
  icon,
  label,
  circleBg,
  iconColor,
  labelBg,
  labelColor,
  borderColor,
  onPress,
}: {
  index: number;
  total: number;
  progress: SharedValue<number>;
  side: Side;
  icon: IconName;
  label: string;
  circleBg: string;
  iconColor: string;
  labelBg: string;
  labelColor: string;
  borderColor: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const delay = (total - 1 - index) * 0.08;
    const p = interpolate(progress.value, [delay, Math.min(1, delay + 0.55)], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 18 }, { scale: 0.8 + p * 0.2 }],
    };
  });

  const circle = (
    <View
      style={{
        width: CIRCLE,
        height: CIRCLE,
        borderRadius: CIRCLE / 2,
        backgroundColor: circleBg,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.md,
      }}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
  );

  const chip = (
    <View
      style={{
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        backgroundColor: labelBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor,
        ...Shadow.sm,
      }}
    >
      <Text variant="label" color={labelColor}>
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
      >
        {side === 'left' ? (
          <>
            {circle}
            {chip}
          </>
        ) : (
          <>
            {chip}
            {circle}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
