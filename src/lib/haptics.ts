/**
 * Thin, crash-proof wrapper around expo-haptics.
 * Haptics are a non-essential polish layer: every call is guarded so a missing
 * module, web platform, or unsupported device can never break a user flow.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(run: () => Promise<unknown>) {
  if (!supported) return;
  try {
    run().catch(() => {});
  } catch {
    // ignore — haptics are best-effort only
  }
}

/** Light tick for taps / selections. */
export function tapFeedback() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Medium bump for meaningful presses (FAB, primary buttons). */
export function pressFeedback() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Selection tick for pickers / segmented / toggles. */
export function selectionFeedback() {
  safe(() => Haptics.selectionAsync());
}

/** Positive confirmation (save, complete). */
export function successFeedback() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Warning / destructive confirmation. */
export function warningFeedback() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
