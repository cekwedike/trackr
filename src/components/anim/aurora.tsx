import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { hexToRgba } from '@/lib/color';

interface Blob {
  color: string;
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  duration: number;
}

function Orb({ blob, reduced }: { blob: Blob; reduced: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withRepeat(withTiming(1, { duration: blob.duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p, reduced, blob.duration]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: p.value * blob.driftX },
      { translateY: p.value * blob.driftY },
      { scale: 1 + p.value * 0.12 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: `${blob.x}%`,
          top: `${blob.y}%`,
          width: blob.size,
          height: blob.size,
          borderRadius: blob.size / 2,
          backgroundColor: blob.color,
        },
        style,
      ]}
    />
  );
}

/**
 * A soft, slowly-drifting multi-orb "aurora" glow. Meant to sit behind hero /
 * auth / onboarding content (clip it with an overflow-hidden parent). Cheap:
 * a few translucent circles animated on the UI thread. Frozen under reduce-motion.
 */
export function Aurora({
  colors,
  opacity = 0.5,
}: {
  colors: [string, string, string?];
  opacity?: number;
}) {
  const reduced = useReducedMotion();
  const [a, b, c] = colors;
  const third = c ?? a;

  const blobs: Blob[] = [
    { color: hexToRgba(a, 0.5), size: 260, x: -20, y: -30, driftX: 40, driftY: 30, duration: 9000 },
    { color: hexToRgba(b, 0.45), size: 220, x: 55, y: -10, driftX: -50, driftY: 40, duration: 11000 },
    { color: hexToRgba(third, 0.4), size: 240, x: 20, y: 40, driftX: 30, driftY: -30, duration: 13000 },
  ];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, overflow: 'hidden' }]}>
      {blobs.map((blob, i) => (
        <Orb key={i} blob={blob} reduced={reduced} />
      ))}
    </View>
  );
}
