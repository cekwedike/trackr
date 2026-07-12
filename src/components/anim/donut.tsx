import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const DONUT_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#EF4444', '#0EA5E9'];

export interface DonutSlice {
  label: string;
  percent: number;
}

/** Static donut chart from percentage slices. */
export function AllocationDonut({
  data,
  size = 132,
  stroke = 16,
  trackColor,
  colors = DONUT_COLORS,
}: {
  data: DonutSlice[];
  size?: number;
  stroke?: number;
  trackColor: string;
  colors?: string[];
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = data.reduce((sum, d) => sum + (Number(d.percent) || 0), 0) || 1;

  let acc = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {data.map((d, i) => {
          const frac = (Number(d.percent) || 0) / total;
          const len = frac * circumference;
          const offset = -acc * circumference;
          acc += frac;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={colors[i % colors.length]}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
    </View>
  );
}
