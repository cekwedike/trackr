import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress gauge (0..1). Great for margin / completion. */
export function ProfitGauge({
  value,
  size = 128,
  stroke = 12,
  color,
  trackColor,
  centerTop,
  centerBottom,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor: string;
  centerTop?: string;
  centerBottom?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value || 0));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerTop ? <Text variant="title" color={color}>{centerTop}</Text> : null}
        {centerBottom ? <Text variant="caption">{centerBottom}</Text> : null}
      </View>
    </View>
  );
}
