import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Duration, Ease } from '@/constants/motion';

/** Fade + slide-up on mount. Reliable across iOS/Android (no layout-animation dependency). */
export function Entrance({
  children,
  delay = 0,
  offset = 14,
  duration = Duration.slow,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Ease.standard }));
  }, [progress, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced ? [] : [{ translateY: (1 - progress.value) * offset }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
