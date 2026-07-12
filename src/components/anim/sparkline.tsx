import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Compact trend line with a soft filled area. Responsive width via preserveAspectRatio. */
export function Sparkline({
  data,
  color,
  height = 44,
  strokeWidth = 2.5,
}: {
  data: number[];
  color: string;
  height?: number;
  strokeWidth?: number;
}) {
  const W = 120;
  const pts = data.length > 1 ? data : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const stepX = W / (pts.length - 1);
  const y = (v: number) => height - 4 - ((v - min) / range) * (height - 8);

  let line = '';
  pts.forEach((v, i) => {
    line += `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)} ${y(v).toFixed(2)} `;
  });
  const area = `${line} L${W} ${height} L0 ${height} Z`;
  const gid = 'spark';

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gid})`} />
      <Path d={line} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
