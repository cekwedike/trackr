import type { Recurrence } from '@/db/types';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Brand blue — matches the `expo-notifications` plugin `color` in app.json. */
export const BRAND_COLOR = '#2563EB';

/** Id of the Android channel all reminders are posted to. Kept in sync with the
 *  `defaultChannel` set on the expo-notifications plugin in app.json. */
export const REMINDERS_CHANNEL_ID = 'reminders';

let handlerSet = false;

export function ensureNotificationHandler(): void {
  if (handlerSet) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
}

/**
 * Create/refresh the Android "Reminders" channel. Defining a well-formed channel
 * (name, importance, vibration, light color, sound, visibility) is what makes a
 * notification render as a proper branded heads-up alert instead of a blank box.
 *
 * On Android 13+ a channel must exist before the OS will show the permission
 * prompt, so this is always called before requesting permission. No-op on iOS.
 */
export async function ensureRemindersChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
    name: 'Reminders',
    description: 'Payment, restock and follow-up reminders you set in Trackr.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: BRAND_COLOR,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
  });
}

/** True if notifications are already granted (no prompt shown). */
export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Ensure the channel exists and the permission is granted, prompting the user
 * once if needed. Returns whether notifications are ultimately allowed.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  ensureNotificationHandler();
  await ensureRemindersChannel();
  if (await hasNotificationPermission()) return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Schedule a local notification. Returns the scheduled id, or null if it could not schedule. */
export async function scheduleReminder(
  title: string,
  body: string,
  due: Date,
  recurrence: Recurrence,
): Promise<string | null> {
  try {
    ensureNotificationHandler();
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    let trigger: Notifications.NotificationTriggerInput;
    const hour = due.getHours();
    const minute = due.getMinutes();

    const channelId = REMINDERS_CHANNEL_ID;
    switch (recurrence) {
      case 'daily':
        trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId };
        break;
      case 'weekly':
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: due.getDay() + 1, // expo: 1=Sunday
          hour,
          minute,
          channelId,
        };
        break;
      case 'monthly':
      case 'none':
      default: {
        if (due.getTime() <= Date.now()) return null;
        trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due, channelId };
        break;
      }
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // Brand-tint the small icon + title on Android; harmless on iOS.
        color: BRAND_COLOR,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: 'default',
      },
      trigger,
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}
