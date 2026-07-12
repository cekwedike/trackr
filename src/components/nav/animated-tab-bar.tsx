import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Duration, Ease, Spring } from '@/constants/motion';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';
import { selectionFeedback } from '@/lib/haptics';

type TabIcon = (props: { focused: boolean; color: ColorValue; size: number }) => React.ReactNode;

interface TabRoute {
  key: string;
  name: string;
  params?: object;
}

interface TabDescriptor {
  options: {
    title?: string;
    tabBarIcon?: TabIcon;
    tabBarAccessibilityLabel?: string;
  };
}

/** Minimal structural view of the props expo-router passes to a custom `tabBar`. */
export interface AnimatedTabBarProps {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, TabDescriptor>;
  navigation: {
    navigate: (name: string, params?: object) => void;
    emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
  };
  insets: { bottom: number; top: number };
}

function TabItem({
  focused,
  icon,
  label,
  color,
  activeColor,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  focused: boolean;
  icon?: TabIcon;
  label: string;
  color: string;
  activeColor: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = reduced
      ? withTiming(focused ? 1 : 0, { duration: Duration.fast })
      : withSpring(focused ? 1 : 0, Spring.bouncy);
  }, [focused, reduced, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.14 }, { translateY: progress.value * -2 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.6 + progress.value * 0.4 }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={{ color: hexToRgba(activeColor, 0.12), borderless: true, radius: 44 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 2 }}
    >
      <Animated.View style={iconStyle}>
        {icon?.({ focused, color: focused ? activeColor : color, size: 24 })}
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[
          { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: focused ? activeColor : color },
          labelStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Custom animated bottom tab bar: a spring-driven moving pill behind the active
 * tab, icon scale/bounce on focus, animated labels and a press ripple.
 *
 * Per-industry tab gating happens HERE: expo-router does not remove `href: null`
 * routes from `state.routes` when a custom `tabBar` is supplied, so all registered
 * screens arrive in `state.routes`. We filter them against a per-industry allowlist
 * (`index` + the industry's `navTabs` + `more`, always hiding `notes`) so the bar
 * shows at most 4 items. Respects the Android nav-bar safe-area spacing.
 */
export function AnimatedTabBar({ state, descriptors, navigation, insets }: AnimatedTabBarProps) {
  const t = useTheme();
  const { accent, industry } = useApp();
  const reduced = useReducedMotion();
  const [rowW, setRowW] = useState(0);

  // Allowlist: Home first, up to 2 industry entity tabs, More last. `notes` and any
  // entity tab not in this industry's `navTabs` are always excluded.
  const allowed = useMemo(() => new Set<string>(['index', ...industry.navTabs, 'more']), [industry.navTabs]);
  const routes = useMemo(() => state.routes.filter((r) => allowed.has(r.name)), [state.routes, allowed]);

  const count = routes.length;
  const itemW = count > 0 ? rowW / count : 0;
  const pillW = itemW > 0 ? Math.max(44, Math.min(64, itemW - Spacing.md)) : 0;

  // `state.index` indexes the FULL routes array; map the focused route into the
  // filtered list. -1 means the active route is hidden (e.g. `notes`) → no pill.
  const focusedRoute = state.routes[state.index];
  const focusedIndex = focusedRoute ? routes.findIndex((r) => r.key === focusedRoute.key) : -1;

  const pos = useSharedValue(Math.max(0, focusedIndex));

  useEffect(() => {
    if (focusedIndex < 0) return;
    pos.value = reduced
      ? withTiming(focusedIndex, { duration: Duration.base, easing: Ease.standard })
      : withSpring(focusedIndex, Spring.snappy);
  }, [focusedIndex, reduced, pos]);

  const showPill = focusedIndex >= 0;
  const pillStyle = useAnimatedStyle(() => ({
    width: itemW,
    opacity: itemW > 0 && showPill ? 1 : 0,
    transform: [{ translateX: pos.value * itemW }],
  }));

  const onRowLayout = (e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width);

  return (
    <View
      style={{
        backgroundColor: t.tabBar,
        borderTopColor: t.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingBottom: insets.bottom + Spacing.sm,
        paddingTop: Spacing.sm,
        ...(Platform.OS === 'ios'
          ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -3 } }
          : { elevation: 12 }),
      }}
    >
      <View onLayout={onRowLayout} style={{ flexDirection: 'row', height: 52 }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          <Animated.View style={[{ height: '100%', alignItems: 'center', justifyContent: 'center' }, pillStyle]}>
            <View
              style={{
                width: pillW,
                height: 40,
                borderRadius: Radius.pill,
                backgroundColor: hexToRgba(accent, 0.14),
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hexToRgba(accent, 0.22),
              }}
            />
          </Animated.View>
        </Animated.View>

        {routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor?.options ?? {};
          const focused = focusedIndex === index;
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              selectionFeedback();
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              icon={options.tabBarIcon}
              label={label}
              color={t.textMuted}
              activeColor={accent}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel}
            />
          );
        })}
      </View>
    </View>
  );
}
