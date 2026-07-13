import { createContext, useContext } from 'react';
import Animated, { type AnimatedRef, type SharedValue } from 'react-native-reanimated';

/**
 * Lightweight scroll-position broadcast used by <Collapsible auto> to decide when
 * a section is on-screen. The Screen's scroll container publishes its live scroll
 * offset, its viewport height and an animated ref to itself; auto Collapsibles
 * read these on the UI thread (via reanimated worklets + measure()) so viewport
 * detection never triggers a re-render per scroll frame.
 *
 * Everything here is optional: screens that don't scroll (or components rendered
 * outside a Screen) simply get `null` and Collapsible falls back to manual mode.
 */
export interface ScrollPosition {
  /** Live vertical scroll offset (UI thread). */
  scrollY: SharedValue<number>;
  /** Measured height of the visible scroll viewport (UI thread). */
  viewportHeight: SharedValue<number>;
  /** Animated ref to the scroll container, so children can measure() relative to it. */
  scrollRef: AnimatedRef<Animated.View>;
  /** True only inside a scrollable Screen — auto mode is a no-op otherwise. */
  enabled: boolean;
}

const ScrollPositionContext = createContext<ScrollPosition | null>(null);

export const ScrollPositionProvider = ScrollPositionContext.Provider;

/** Returns the ambient scroll position, or null when not inside a scrollable Screen. */
export function useScrollPosition(): ScrollPosition | null {
  return useContext(ScrollPositionContext);
}
