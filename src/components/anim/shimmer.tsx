import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';

/**
 * A shimmering placeholder surface. Renders a base tint with a highlight band
 * sweeping across it. Under "reduce motion" it degrades to a soft opacity pulse.
 */
export function Shimmer({
  style,
  radius = Radius.md,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    if (reduced) {
      pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      progress.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false);
    }
  }, [reduced, progress, pulse]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -w + progress.value * (2 * w) }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ backgroundColor: t.cardAlt, borderRadius: radius, overflow: 'hidden' }, style]}
    >
      {reduced ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.border }, pulseStyle]} />
      ) : (
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
          <LinearGradient
            colors={[hexToRgba(t.card, 0), hexToRgba(t.card, 0.65), hexToRgba(t.card, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {children}
    </View>
  );
}

/** A single skeleton block (a sized Shimmer). */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = Radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Shimmer radius={radius} style={[{ width, height }, style]} />;
}

/** A card of skeleton list-rows for list screens' loading state. */
export function SkeletonList({ rows = 6, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: Radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          paddingHorizontal: Spacing.lg,
          ...Shadow.sm,
        },
        style,
      ]}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            paddingVertical: Spacing.md,
            borderBottomWidth: i < rows - 1 ? StyleSheet.hairlineWidth : 0,
            borderColor: t.border,
          }}
        >
          <Skeleton width={42} height={42} radius={Radius.md} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width="58%" height={13} />
            <Skeleton width="38%" height={11} />
          </View>
          <Skeleton width={54} height={20} radius={Radius.pill} />
        </View>
      ))}
    </View>
  );
}
