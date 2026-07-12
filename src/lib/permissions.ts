/**
 * Centralised permission requests + user-facing rationale for Trackr.
 *
 * Trackr is offline-first and private, so it asks for as little as possible and
 * only when there is a clear reason. Each helper returns a simple outcome and
 * pairs with a short rationale string you can show before/after prompting.
 *
 * What actually needs a runtime permission:
 *  - Notifications (expo-notifications): required to post reminder alerts. On
 *    Android 13+ the OS prompt only appears once a channel exists, so the
 *    request path creates the "Reminders" channel first.
 *  - Photo library (expo-image-picker): requested before attaching product
 *    photos. On modern Android the system photo picker needs no permission, but
 *    requesting keeps behaviour consistent on iOS and older Android.
 *
 * What does NOT need a runtime permission (documented so callers don't prompt):
 *  - Backup export (expo-sharing): opens the system share sheet only.
 *  - Backup import (expo-document-picker): opens the system document UI only.
 */
import { hasNotificationPermission, requestNotificationPermission } from '@/lib/notifications';

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

export const PermissionRationale = {
  notifications: {
    title: 'Stay on top of your business',
    message:
      'Allow notifications so Trackr can remind you about payments, restocks and follow-ups even when the app is closed.',
  },
  photos: {
    title: 'Add photos to your records',
    message: 'Allow photo access so you can attach pictures to your products and records.',
  },
} as const;

/**
 * Ensure notification permission, prompting once if needed. Creates the Android
 * channel as part of the flow so notifications render as branded alerts.
 */
export async function requestNotifications(): Promise<PermissionOutcome> {
  if (await hasNotificationPermission()) return 'granted';
  const granted = await requestNotificationPermission();
  return granted ? 'granted' : 'denied';
}
