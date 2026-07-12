import React, { useCallback } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Duration, Ease, Spring } from '@/constants/motion';
import { tapFeedback } from '@/lib/haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Scale applied while pressed. Lower = more pronounced. */
  scaleTo?: number;
  /** Opacity applied while pressed. */
  opacityTo?: number;
  /** Fire a light haptic tick on press-in. */
  haptic?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
}

/**
 * A Pressable with a spring-driven scale + opacity press micro-interaction.
 * Honors the OS "reduce motion" setting (falls back to a plain opacity dim).
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  scaleTo = 0.96,
  opacityTo = 1,
  haptic,
  hitSlop = 0,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const onPressIn = useCallback(() => {
    if (haptic) tapFeedback();
    opacity.value = withTiming(disabled ? 1 : opacityTo, { duration: Duration.instant, easing: Ease.standard });
    if (!reduced) scale.value = withSpring(scaleTo, Spring.press);
  }, [haptic, disabled, opacity, opacityTo, reduced, scale, scaleTo]);

  const onPressOut = useCallback(() => {
    opacity.value = withTiming(1, { duration: Duration.fast, easing: Ease.standard });
    if (!reduced) scale.value = withSpring(1, Spring.press);
  }, [opacity, reduced, scale]);

  return (
    <AnimatedPressableBase
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[style, animatedStyle, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressableBase>
  );
}

/** Alias — same component, name reads better in some call sites. */
export const AnimatedPressable = PressableScale;
