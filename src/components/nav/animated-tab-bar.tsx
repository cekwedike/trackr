import React, { useEffect, useState } from 'react';
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
 * tab, icon scale/bounce on focus, animated labels and a press ripple. Respects
 * the per-industry tab gating (only routes present in `state.routes` render) and
 * the Android nav-bar safe-area spacing.
 */
export function AnimatedTabBar({ state, descriptors, navigation, insets }: AnimatedTabBarProps) {
  const t = useTheme();
  const { accent } = useApp();
  const reduced = useReducedMotion();
  const [rowW, setRowW] = useState(0);

  const count = state.routes.length;
  const itemW = count > 0 ? rowW / count : 0;
  const pos = useSharedValue(state.index);

  useEffect(() => {
    pos.value = reduced
      ? withTiming(state.index, { duration: Duration.base, easing: Ease.standard })
      : withSpring(state.index, Spring.snappy);
  }, [state.index, reduced, pos]);

  const pillStyle = useAnimatedStyle(() => ({
    width: itemW,
    opacity: itemW > 0 ? 1 : 0,
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
                width: 56,
                height: 34,
                borderRadius: Radius.pill,
                backgroundColor: hexToRgba(accent, 0.14),
              }}
            />
          </Animated.View>
        </Animated.View>

        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor?.options ?? {};
          const focused = state.index === index;
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
