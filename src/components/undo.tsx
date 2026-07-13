import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback } from '@/lib/haptics';

export interface UndoOptions {
  /** Short confirmation line, e.g. `Deleted sale`. */
  message: string;
  /** Called when the user taps UNDO. May be async; failures are swallowed. */
  onUndo: () => unknown | Promise<unknown>;
  /** Label for the action; defaults to `UNDO`. */
  actionLabel?: string;
  /** Auto-dismiss delay in ms; defaults to ~5s. */
  duration?: number;
}

interface UndoContextValue {
  showUndo: (options: UndoOptions) => void;
  hide: () => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const DEFAULT_DURATION = 5000;
// Clears the custom bottom tab bar (52 row + paddings) so the snackbar floats
// just above it; on tab-less screens it simply sits a little higher.
const TAB_BAR_CLEARANCE = 68;

interface Snack extends UndoOptions {
  id: number;
}

/**
 * Mount once near the app root (see app/_layout.tsx). Exposes an imperative,
 * themed "Undo" snackbar via {@link useUndo}. Only one snackbar shows at a time
 * — a new call replaces the current one — and each auto-dismisses after ~5s.
 * The card mirrors the confirm dialog / sheet theming (t.card + hairline border
 * + Shadow.lg) and animates in/out with a transform-driven fade that respects
 * reduced motion.
 */
export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const idRef = useRef(0);

  const hide = useCallback((id?: number) => {
    setSnack((cur) => (cur && (id == null || cur.id === id) ? null : cur));
  }, []);

  const showUndo = useCallback((options: UndoOptions) => {
    const id = ++idRef.current;
    setSnack({ id, ...options });
  }, []);

  return (
    <UndoContext.Provider value={{ showUndo, hide: () => hide() }}>
      {children}
      {snack ? <Snackbar key={snack.id} snack={snack} onHide={() => hide(snack.id)} /> : null}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within an UndoProvider');
  return ctx;
}

function Snackbar({ snack, onHide }: { snack: Snack; onHide: () => void }) {
  const t = useTheme();
  const { accent } = useApp();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  // `visible` drives the single entrance/exit animation effect below; flipping it
  // to false animates the card out and then unmounts via onHide.
  const [visible, setVisible] = useState(true);

  // All shared-value mutations live in this one effect (mirrors confirm.tsx),
  // animating in on mount and out when `visible` flips to false.
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: reduced ? 120 : visible ? 220 : 180 }, (finished) => {
      if (finished && !visible) runOnJS(onHide)();
    });
  }, [visible, progress, reduced, onHide]);

  // Auto-dismiss timer; cleared on unmount (replace / manual dismiss remount by key).
  useEffect(() => {
    const duration = snack.duration ?? DEFAULT_DURATION;
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [snack.duration]);

  const runUndo = () => {
    selectionFeedback();
    try {
      void snack.onUndo();
    } catch {
      // undo is best-effort; never let a restore failure crash the UI
    }
    setVisible(false);
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * (reduced ? 0 : 16) }],
  }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          {
            position: 'absolute',
            left: Spacing.lg,
            right: Spacing.lg,
            bottom: insets.bottom + TAB_BAR_CLEARANCE,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            backgroundColor: t.card,
            borderRadius: Radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.border,
            paddingVertical: Spacing.md,
            paddingLeft: Spacing.lg,
            paddingRight: Spacing.sm,
            alignSelf: 'center',
            maxWidth: 520,
            width: '100%',
            ...Shadow.lg,
          },
          cardStyle,
        ]}
      >
        <Text variant="body" weight="medium" numberOfLines={2} style={{ flex: 1 }}>
          {snack.message}
        </Text>
        <Pressable
          onPress={runUndo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={snack.actionLabel ?? 'Undo'}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="arrow-undo-outline" size={16} color={accent} />
          <Text variant="label" weight="bold" color={accent}>
            {(snack.actionLabel ?? 'Undo').toUpperCase()}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
