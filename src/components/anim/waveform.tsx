import React, { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const W = 300; // internal viewBox width; stretched to fit via preserveAspectRatio="none"

function buildWave(width: number, height: number, phase: number, waves: number, amp: number, mid: number): string {
  'worklet';
  const steps = 48;
  let d = `M0 ${mid}`;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = mid + Math.sin((i / steps) * Math.PI * 2 * waves + phase) * amp;
    d += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  d += ` L${width} ${height} L0 ${height} Z`;
  return d;
}

/** A looping, filled animated wave. Fills its parent width; height is fixed. */
export function Waveform({ color, height = 70, duration = 5200 }: { color: string; height?: number; duration?: number }) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration, easing: Easing.linear }), -1, false);
  }, [phase, duration]);

  const backProps = useAnimatedProps(() => ({
    d: buildWave(W, height, phase.value + Math.PI * 0.6, 1.5, height * 0.16, height * 0.55),
  }));
  const frontProps = useAnimatedProps(() => ({
    d: buildWave(W, height, phase.value, 2, height * 0.22, height * 0.62),
  }));

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <AnimatedPath animatedProps={backProps} fill={color} opacity={0.25} />
      <AnimatedPath animatedProps={frontProps} fill={color} opacity={0.5} />
    </Svg>
  );
}
