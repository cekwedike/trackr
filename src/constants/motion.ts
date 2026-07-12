/**
 * Trackr motion system.
 * Central source of truth for durations, easings and spring configs so every
 * animation across the app shares the same rhythm. Values are plain objects so
 * they can be read inside reanimated worklets without capture issues.
 */

import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const Duration = {
  instant: 120,
  fast: 180,
  base: 260,
  slow: 380,
  slower: 560,
} as const;

/** Shared easing curves. `standard` is the everyday ease-out. */
export const Ease = {
  standard: Easing.out(Easing.cubic),
  decelerate: Easing.out(Easing.quad),
  accelerate: Easing.in(Easing.cubic),
  emphasized: Easing.bezier(0.2, 0, 0, 1),
  inOut: Easing.inOut(Easing.cubic),
} as const;

/** Spring presets tuned for a premium, controlled feel (never floppy). */
export const Spring = {
  /** Subtle settle for press feedback. */
  press: { damping: 18, stiffness: 320, mass: 0.7 } as WithSpringConfig,
  /** General purpose UI spring. */
  gentle: { damping: 20, stiffness: 180, mass: 1 } as WithSpringConfig,
  /** Quick, tight response for toggles / indicators. */
  snappy: { damping: 22, stiffness: 260, mass: 0.8 } as WithSpringConfig,
  /** A touch of overshoot for playful moments (FAB, celebrate). */
  bouncy: { damping: 12, stiffness: 200, mass: 0.9 } as WithSpringConfig,
} as const;

export const Timing = {
  fast: { duration: Duration.fast, easing: Ease.standard } as WithTimingConfig,
  base: { duration: Duration.base, easing: Ease.standard } as WithTimingConfig,
  slow: { duration: Duration.slow, easing: Ease.emphasized } as WithTimingConfig,
} as const;

/** Standard press-in scale for tappable surfaces. */
export const PressScale = {
  card: 0.97,
  button: 0.96,
  row: 0.985,
  icon: 0.9,
  chip: 0.94,
} as const;
