/**
 * Trackr design system tokens.
 * A single source of truth for colors, spacing, typography and radii.
 * Styling is done with React Native StyleSheet driven by these tokens.
 */

import { Platform } from 'react-native';

export const Palette = {
  brand: '#2563EB',
  brandDark: '#1D4ED8',
  brandSoft: '#DBEAFE',
  accent: '#7C3AED',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0891B2',
} as const;

export interface ThemeColors {
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  overlay: string;
  tabBar: string;
  inputBg: string;
}

export type ThemeName = 'light' | 'dark';

export const Colors: Record<ThemeName, ThemeColors> = {
  light: {
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    background: '#F5F7FB',
    card: '#FFFFFF',
    cardAlt: '#F1F5F9',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    primary: Palette.brand,
    primaryText: '#FFFFFF',
    primarySoft: Palette.brandSoft,
    accent: Palette.accent,
    success: Palette.success,
    successSoft: Palette.successSoft,
    warning: Palette.warning,
    warningSoft: Palette.warningSoft,
    danger: Palette.danger,
    dangerSoft: Palette.dangerSoft,
    info: Palette.info,
    overlay: 'rgba(15,23,42,0.45)',
    tabBar: '#FFFFFF',
    inputBg: '#FFFFFF',
  },
  dark: {
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    background: '#0B1120',
    card: '#151C2C',
    cardAlt: '#1E2740',
    border: '#26304A',
    borderStrong: '#334155',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    primarySoft: '#1E3A8A',
    accent: '#A78BFA',
    success: '#22C55E',
    successSoft: '#14331F',
    warning: '#F59E0B',
    warningSoft: '#3A2A08',
    danger: '#EF4444',
    dangerSoft: '#3B1416',
    info: '#22D3EE',
    overlay: 'rgba(0,0,0,0.6)',
    tabBar: '#111827',
    inputBg: '#151C2C',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 34,
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'system-ui, sans-serif', rounded: 'system-ui, sans-serif', mono: 'monospace' },
}) as { sans: string; rounded: string; mono: string };

export const MaxContentWidth = 720;
