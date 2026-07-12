import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { Text } from '@/components/ui';

/**
 * Counts up (or down) to `value` when it changes. JS-driven with requestAnimationFrame,
 * which is smooth enough for a handful of counters and avoids worklet/Intl pitfalls.
 */
export function AnimatedCounter({
  value,
  format,
  duration = 800,
  variant = 'display',
  color,
  weight,
  style,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  variant?: 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <Text variant={variant} color={color} weight={weight} style={style} numberOfLines={1}>
      {format ? format(display) : String(display)}
    </Text>
  );
}
