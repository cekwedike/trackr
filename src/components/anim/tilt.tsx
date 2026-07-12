import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Spring } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A card surface with an interactive 2.5D tilt: pressing lifts it toward the
 * viewer and tips it in the direction of the touch (perspective + rotateX/Y),
 * with a moving glass sheen for depth. Reduced-motion → flat scale only.
 */
export function TiltCard({
  children,
  onPress,
  onLongPress,
  intensity = 8,
  lift = 1.02,
  sheen = true,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  intensity?: number;
  lift?: number;
  sheen?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 1, h: 1 });
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const pressed = useSharedValue(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width || 1, h: height || 1 });
  }, []);

  const onPressIn = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = withSpring(1, Spring.press);
      if (reduced) return;
      const nx = (e.nativeEvent.locationX / size.w) * 2 - 1;
      const ny = (e.nativeEvent.locationY / size.h) * 2 - 1;
      ry.value = withSpring(nx * intensity, Spring.gentle);
      rx.value = withSpring(-ny * intensity, Spring.gentle);
    },
    [reduced, size.w, size.h, intensity, rx, ry, pressed],
  );

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, Spring.gentle);
    rx.value = withSpring(0, Spring.gentle);
    ry.value = withSpring(0, Spring.gentle);
  }, [rx, ry, pressed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${rx.value}deg` },
      { rotateY: `${ry.value}deg` },
      { scale: 1 + pressed.value * (lift - 1) },
    ],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * 0.5,
    transform: [{ translateX: ry.value * 6 }, { translateY: rx.value * -6 }],
  }));

  return (
    <AnimatedPressable
      onLayout={onLayout}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[style, animatedStyle]}
    >
      {children}
      {sheen && !reduced ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheenStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </AnimatedPressable>
  );
}
