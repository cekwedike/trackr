import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { IconName } from '@/components/ui';
import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { hexToRgba } from '@/lib/color';
import { useTheme } from '@/hooks/use-theme';

export interface SidebarItem {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

const EXPANDED = 236;
const COLLAPSED = 76;

/** A sidebar for wide layouts that animates between an icon rail and a full menu. */
export function CollapsibleSidebar({
  items,
  activeKey,
  style,
}: {
  items: SidebarItem[];
  activeKey?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { accent, settings } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const width = useSharedValue(EXPANDED);

  useEffect(() => {
    width.value = withTiming(collapsed ? COLLAPSED : EXPANDED, { duration: 220 });
  }, [collapsed, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: t.card,
          borderRightWidth: 1,
          borderRightColor: t.border,
          paddingVertical: Spacing.lg,
          paddingHorizontal: Spacing.sm,
          gap: Spacing.xs,
        },
        animatedStyle,
        style,
      ]}
    >
      <Pressable
        onPress={() => setCollapsed((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.sm,
          marginBottom: Spacing.sm,
        }}
      >
        <Ionicons name={collapsed ? 'menu' : 'chevron-back'} size={22} color={t.textSecondary} />
        {!collapsed ? <Text variant="label" color={t.textSecondary} numberOfLines={1}>{settings?.business_name ?? 'Menu'}</Text> : null}
      </Pressable>

      {items.map((it) => {
        const active = it.key === activeKey;
        return (
          <Pressable
            key={it.key}
            onPress={it.onPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.md,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.sm,
              borderRadius: Radius.md,
              backgroundColor: active ? hexToRgba(accent, 0.14) : 'transparent',
            }}
          >
            <Ionicons name={it.icon} size={22} color={active ? accent : t.textSecondary} />
            {!collapsed ? (
              <Text variant="body" weight={active ? 'semibold' : 'regular'} color={active ? accent : t.text} numberOfLines={1}>
                {it.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}
