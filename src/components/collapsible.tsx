import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/anim/pressable';
import { useScrollPosition } from '@/components/scroll-context';
import { Chip, Text, type IconName } from '@/components/ui';
import { Duration, Ease, PressScale } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';
import { selectionFeedback } from '@/lib/haptics';

const PERSIST_PREFIX = 'ui.collapsible.';

/** Persisted collapsed state helpers — mirror the expo-secure-store pattern in lib/onboarding.ts. */
async function loadCollapsed(key: string): Promise<boolean | null> {
  try {
    const raw = await SecureStore.getItemAsync(PERSIST_PREFIX + key);
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}
async function saveCollapsed(key: string, collapsed: boolean): Promise<void> {
  await SecureStore.setItemAsync(PERSIST_PREFIX + key, collapsed ? '1' : '0').catch(() => {});
}

export interface CollapsibleProps {
  /** Header title (rendered uppercase-styled like SectionHeader when `plain` is false). */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Optional leading icon in the header. */
  icon?: IconName;
  /** Optional count badge shown on the right of the header (before the chevron). */
  count?: number | string;
  /** Uncontrolled initial state. Default: expanded. Ignored when `expanded` is provided. */
  defaultExpanded?: boolean;
  /** Controlled expanded state. When provided, the component is fully controlled. */
  expanded?: boolean;
  /** Called on every user toggle with the next expanded value. */
  onToggle?: (next: boolean) => void;
  /**
   * Persist the collapsed state under this key (expo-secure-store). Uncontrolled only.
   * Restored on mount; saved on every user toggle.
   */
  persistKey?: string;
  /**
   * Viewport-aware auto mode. The section auto-expands as it scrolls into the
   * viewport and stays open once passed; sections still below the fold render
   * collapsed. Requires being rendered inside a scrollable <Screen>.
   */
  auto?: boolean;
  /** Extra content rendered in the header row, right-aligned before the chevron. */
  headerRight?: React.ReactNode;
  /** Card-like chrome (border + surface) around the whole section. Default false. */
  card?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A reusable, animated collapsible section.
 *
 * Modes (in priority order):
 *  1. Controlled — pass `expanded` + `onToggle`.
 *  2. Auto (viewport-aware) — pass `auto` inside a scrollable Screen.
 *  3. Uncontrolled — internal state, optionally persisted via `persistKey`.
 *
 * Viewport detection (auto): the enclosing Screen publishes its scroll offset,
 * viewport height and an animated ref via ScrollPositionContext. A reanimated
 * `useDerivedValue` re-runs on every scroll frame *on the UI thread*, measure()s
 * this section relative to the scroll container and flips a boolean only when the
 * section crosses a threshold — so React state updates happen on transitions, not
 * per frame. To stay jank-free we only auto-COLLAPSE sections that are still
 * below the fold (upcoming); once a section has scrolled above the viewport it
 * stays expanded, which avoids the content-height jumps you'd get from collapsing
 * things above the current scroll position. A manual tap temporarily overrides
 * auto until the section scrolls fully out of view, then auto resumes.
 */
export function Collapsible({
  title,
  subtitle,
  icon,
  count,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onToggle,
  persistKey,
  auto = false,
  headerRight,
  card = false,
  children,
  style,
  contentStyle,
}: CollapsibleProps) {
  const t = useTheme();
  const { accent } = useApp();
  const reduced = useReducedMotion();
  const pos = useScrollPosition();
  const autoEnabled = auto && !!pos?.enabled;

  const isControlled = controlledExpanded !== undefined;

  // Uncontrolled internal state. Auto sections begin collapsed and open as they
  // scroll into view; everything else honours defaultExpanded.
  const [internalExpanded, setInternalExpanded] = useState(autoEnabled ? false : defaultExpanded);
  const [manualOverride, setManualOverride] = useState(false);

  const expanded = isControlled ? (controlledExpanded as boolean) : internalExpanded;

  // Restore persisted state once (uncontrolled, non-auto).
  useEffect(() => {
    if (isControlled || autoEnabled || !persistKey) return;
    let alive = true;
    loadCollapsed(persistKey).then((collapsed) => {
      if (alive && collapsed !== null) setInternalExpanded(!collapsed);
    });
    return () => {
      alive = false;
    };
  }, [persistKey, isControlled, autoEnabled]);

  // ---- expand / collapse animation ----
  const progress = useSharedValue(expanded ? 1 : 0);
  const [contentHeight, setContentHeight] = useState(0);
  const measured = contentHeight > 0;

  useEffect(() => {
    const duration = reduced ? Duration.instant : Duration.base;
    progress.value = withTiming(expanded ? 1 : 0, { duration, easing: Ease.standard });
  }, [expanded, reduced, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: measured ? contentHeight * progress.value : undefined,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  const onMeasure = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setContentHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  };

  // ---- manual toggle ----
  const toggle = useCallback(() => {
    selectionFeedback();
    const next = !expanded;
    if (isControlled) {
      onToggle?.(next);
      return;
    }
    if (autoEnabled) setManualOverride(true);
    setInternalExpanded(next);
    onToggle?.(next);
    if (persistKey) void saveCollapsed(persistKey, !next);
  }, [expanded, isControlled, autoEnabled, onToggle, persistKey]);

  // ---- viewport-aware auto mode ----
  const selfRef = useAnimatedRef<Animated.View>();
  const visibleSV = useSharedValue(0); // last applied auto visibility (0/1)
  const manualSV = useSharedValue(0); // mirror of manualOverride for the worklet

  useEffect(() => {
    manualSV.value = manualOverride ? 1 : 0;
  }, [manualOverride, manualSV]);

  const applyAuto = useCallback((visible: boolean) => {
    setInternalExpanded(visible);
  }, []);
  const clearManual = useCallback(() => setManualOverride(false), []);

  useDerivedValue(() => {
    if (!autoEnabled || !pos) return 0;
    // Touch dependencies so this worklet re-runs on scroll / resize / first layout.
    const y = pos.scrollY.value;
    const vh = pos.viewportHeight.value;
    if (vh === 0) return y * 0;

    const self = measure(selfRef);
    const cont = measure(pos.scrollRef);
    if (self === null || cont === null) return 0;

    const relTop = self.pageY - cont.pageY;
    const relBottom = relTop + self.height;
    const fullyBelow = relTop >= vh;
    const fullyAbove = relBottom <= 0;

    // A manual toggle sticks until the section scrolls entirely out of view.
    if (manualSV.value === 1) {
      if (fullyBelow || fullyAbove) {
        // Reset the override flag via JS state; the effect mirrors it back into
        // manualSV, keeping this worklet free of shared-value writes.
        runOnJS(clearManual)();
      }
      return 0;
    }

    const inBand = relBottom > vh * 0.15 && relTop < vh * 0.85;
    let next = visibleSV.value;
    if (inBand) next = 1;
    else if (fullyBelow) next = 0; // only collapse upcoming sections — never above the fold
    if (next !== visibleSV.value) {
      visibleSV.value = next;
      runOnJS(applyAuto)(next === 1);
    }
    return 0;
  }, [autoEnabled]);

  const headerInner = (
    <>
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: Radius.sm,
            backgroundColor: hexToRgba(accent, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="label" color={t.textSecondary} style={{ letterSpacing: 0.7 }}>
          {title.toUpperCase()}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={t.textMuted} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {count !== undefined ? <Chip label={String(count)} /> : null}
      {headerRight}
      <Animated.View style={chevronStyle}>
        <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
      </Animated.View>
    </>
  );

  const cardChrome: ViewStyle = card
    ? {
        backgroundColor: t.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        paddingHorizontal: Spacing.lg,
      }
    : {};

  return (
    <Animated.View ref={selfRef} style={[cardChrome, style]}>
      <PressableScale
        onPress={toggle}
        scaleTo={PressScale.row}
        opacityTo={0.7}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          paddingVertical: card ? Spacing.md : Spacing.sm,
        }}
      >
        {headerInner}
      </PressableScale>

      <Animated.View style={[{ overflow: 'hidden' }, bodyStyle]}>
        {/* Absolute measuring layer keeps the natural content height available for the height animation. */}
        <View style={[{ position: 'absolute', left: 0, right: 0 }, contentStyle]} onLayout={onMeasure}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
