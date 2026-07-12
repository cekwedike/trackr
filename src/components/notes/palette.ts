/**
 * Google-Keep-style note color themes.
 * Each color has a light and a dark variant so cards stay legible in both schemes.
 * `bg` is the card fill, `border` a subtle edge, `accent` for pins / icons / small marks.
 * Text always uses the active theme's `text` / `textSecondary`, which are dark on the
 * light pastels and light on the deep dark fills, so both remain readable.
 */

import { useTheme, useThemeName } from '@/hooks/use-theme';

export interface NoteColorVariant {
  bg: string;
  border: string;
  accent: string;
}

export interface NoteColor {
  key: string;
  name: string;
  light: NoteColorVariant;
  dark: NoteColorVariant;
}

/** The special "no color" key — falls back to the app's normal card surface. */
export const DEFAULT_NOTE_COLOR = 'default';

export const NOTE_COLORS: NoteColor[] = [
  {
    key: 'default',
    name: 'Default',
    light: { bg: '#FFFFFF', border: '#E2E8F0', accent: '#2563EB' },
    dark: { bg: '#151C2C', border: '#26304A', accent: '#3B82F6' },
  },
  {
    key: 'rose',
    name: 'Rose',
    light: { bg: '#FDE4E4', border: '#F6C7C7', accent: '#C0392B' },
    dark: { bg: '#3A2223', border: '#533032', accent: '#F2A9A6' },
  },
  {
    key: 'amber',
    name: 'Amber',
    light: { bg: '#FDEFC7', border: '#F2DE9C', accent: '#B7791F' },
    dark: { bg: '#3A3116', border: '#524721', accent: '#EBCB6B' },
  },
  {
    key: 'sage',
    name: 'Sage',
    light: { bg: '#E4F2DE', border: '#C7E4BC', accent: '#4F7A3A' },
    dark: { bg: '#22301E', border: '#35492E', accent: '#A6D19A' },
  },
  {
    key: 'teal',
    name: 'Teal',
    light: { bg: '#D9F2EE', border: '#B4E4DB', accent: '#2C7A6E' },
    dark: { bg: '#16302C', border: '#274A43', accent: '#86D0C4' },
  },
  {
    key: 'sky',
    name: 'Sky',
    light: { bg: '#DDECFB', border: '#BCD8F4', accent: '#2563EB' },
    dark: { bg: '#17273D', border: '#274259', accent: '#8FBEF0' },
  },
  {
    key: 'lavender',
    name: 'Lavender',
    light: { bg: '#EAE4FB', border: '#D4C6F4', accent: '#6D4AC0' },
    dark: { bg: '#262038', border: '#3B3155', accent: '#B9A6EE' },
  },
  {
    key: 'blush',
    name: 'Blush',
    light: { bg: '#FBE4F3', border: '#F4C6E4', accent: '#B83280' },
    dark: { bg: '#33203A', border: '#4B2E52', accent: '#E9A6D6' },
  },
  {
    key: 'fog',
    name: 'Fog',
    light: { bg: '#ECEFF3', border: '#D5DCE5', accent: '#556070' },
    dark: { bg: '#232B3A', border: '#364052', accent: '#9AA7BC' },
  },
];

export function findNoteColor(key: string | null | undefined): NoteColor {
  return NOTE_COLORS.find((c) => c.key === key) ?? NOTE_COLORS[0];
}

export interface NoteColorTokens {
  key: string;
  bg: string;
  border: string;
  accent: string;
  isDefault: boolean;
}

/** Resolve a note color key to concrete tokens for the current theme scheme. */
export function useNoteColorTokens(key: string | null | undefined): NoteColorTokens {
  const name = useThemeName();
  const theme = useTheme();
  const color = findNoteColor(key);
  const isDefault = color.key === DEFAULT_NOTE_COLOR;
  const variant = color[name];
  return {
    key: color.key,
    bg: isDefault ? theme.card : variant.bg,
    border: isDefault ? theme.border : variant.border,
    accent: variant.accent,
    isDefault,
  };
}
