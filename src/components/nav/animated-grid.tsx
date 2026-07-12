import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Entrance } from '@/components/anim';
import { Spacing } from '@/constants/theme';
import { useColumns } from '@/hooks/use-columns';

/**
 * Responsive grid that lays children out in a fixed number of columns and
 * gives each cell a staggered fade + slide-up entrance.
 */
export function AnimatedGrid<T>({
  data,
  renderItem,
  keyExtractor,
  columns,
  gap = Spacing.sm,
  style,
}: {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  columns?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const auto = useColumns(2, 3);
  const cols = columns ?? auto;
  const basis = `${100 / cols}%`;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }, style]}>
      {data.map((item, i) => (
        <View key={keyExtractor(item, i)} style={{ width: basis as any, paddingHorizontal: gap / 2, marginBottom: gap }}>
          <Entrance delay={Math.min(i * 55, 400)}>{renderItem(item, i)}</Entrance>
        </View>
      ))}
    </View>
  );
}
