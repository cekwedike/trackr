import { useWindowDimensions } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

/** Responsive column count based on the usable content width. */
export function useColumns(min = 2, max = 3): number {
  const { width } = useWindowDimensions();
  const usable = Math.min(width, MaxContentWidth);
  if (usable >= 620) return max;
  if (usable >= 380) return Math.min(2, max);
  return min === 1 ? 1 : Math.min(2, max);
}
