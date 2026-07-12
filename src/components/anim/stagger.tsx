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

type Direction = 'up' | 'down' | 'left' | 'right';

function offsetFor(direction: Direction, offset: number): { x: number; y: number } {
  'worklet';
  switch (direction) {
    case 'down':
      return { x: 0, y: -offset };
    case 'left':
      return { x: offset, y: 0 };
    case 'right':
      return { x: -offset, y: 0 };
    default:
      return { x: 0, y: offset };
  }
}

/** Fade + directional slide on mount. Reduced-motion → fade only. */
export function FadeSlide({
  children,
  delay = 0,
  offset = 16,
  duration = Duration.slow,
  from = 'up',
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  duration?: number;
  from?: Direction;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Ease.standard }));
  }, [progress, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const o = offsetFor(from, offset);
    const rest = 1 - progress.value;
    return {
      opacity: progress.value,
      transform: reduced
        ? []
        : [{ translateX: rest * o.x }, { translateY: rest * o.y }],
    };
  });

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/**
 * Applies a staggered entrance to a list of children so they cascade in.
 * Each direct child is delayed by `step` ms (capped by `maxDelay`).
 */
export function Stagger({
  children,
  step = 60,
  initialDelay = 0,
  maxDelay = 500,
  from = 'up',
  offset = 16,
}: {
  children: React.ReactNode;
  step?: number;
  initialDelay?: number;
  maxDelay?: number;
  from?: Direction;
  offset?: number;
}) {
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <FadeSlide key={i} delay={Math.min(initialDelay + i * step, maxDelay)} from={from} offset={offset}>
          {child}
        </FadeSlide>
      ))}
    </>
  );
}
