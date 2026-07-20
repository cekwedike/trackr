import type { Recurrence } from '@/db/types';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
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
 * Current notification permission snapshot (no prompt).
 * Use `canAskAgain === false` + denied to detect a permanent block → Settings.
 */
export async function getNotificationPermissionState(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}> {
  const settings = await Notifications.getPermissionsAsync();
  return {
    granted:
      settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    canAskAgain: settings.canAskAgain,
    status: settings.status,
  };
}

/**
 * Ensure the channel exists and the permission is granted, prompting the user
 * once if needed. Returns whether notifications are ultimately allowed.
 * Does not short-circuit undetermined — always reaches requestPermissionsAsync
 * when the OS can still ask.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  ensureNotificationHandler();
  await ensureRemindersChannel();
  if (await hasNotificationPermission()) return true;
  const existing = await Notifications.getPermissionsAsync();
  // Permanently denied: OS will not show a dialog; callers should open Settings.
  if (existing.status === Notifications.PermissionStatus.DENIED && !existing.canAskAgain) {
    return false;
  }
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
        // MONTHLY fires once per month when day/hour/minute match, and handles
        // the next occurrence itself — so it stays valid even when today's time
        // has already passed (unlike the one-time DATE path below).
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: due.getDate(),
          hour,
          minute,
          channelId,
        };
        break;
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

// ---------------------------------------------------------------------------
// Recurring summary nudges (daily / weekly)
//
// These are standing, repeating local notifications the user opts into from
// Settings — separate from user-created reminders. We keep the scheduled id in
// secure-store so a nudge can be cancelled or rescheduled (e.g. when the user
// changes the time) without touching the database. Both use the existing
// "Reminders" channel and the DAILY / WEEKLY schedulable triggers.
// ---------------------------------------------------------------------------

const DAILY_NUDGE_ID_KEY = 'nudge.daily.notificationId';
const WEEKLY_NUDGE_ID_KEY = 'nudge.weekly.notificationId';

async function readNudgeId(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeNudgeId(key: string, id: string | null): Promise<void> {
  try {
    if (id) await SecureStore.setItemAsync(key, id);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // secure-store is best-effort; a failure just means we can't persist the id
  }
}

/** Cancel the daily summary nudge (if scheduled) and forget its id. */
export async function cancelDailyNudge(): Promise<void> {
  const id = await readNudgeId(DAILY_NUDGE_ID_KEY);
  await cancelReminder(id);
  await writeNudgeId(DAILY_NUDGE_ID_KEY, null);
}

/**
 * Schedule (or reschedule) a repeating daily summary nudge at the given local
 * time. Cancels any previously scheduled daily nudge first so times never stack.
 * Returns the scheduled id, or null if permission was denied / scheduling failed.
 */
export async function scheduleDailyNudge(hour: number, minute: number): Promise<string | null> {
  try {
    ensureNotificationHandler();
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    await cancelDailyNudge();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily summary',
        body: "Take a moment to log today's sales and expenses in Trackr.",
        color: BRAND_COLOR,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
    await writeNudgeId(DAILY_NUDGE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/** Cancel the weekly summary nudge (if scheduled) and forget its id. */
export async function cancelWeeklyNudge(): Promise<void> {
  const id = await readNudgeId(WEEKLY_NUDGE_ID_KEY);
  await cancelReminder(id);
  await writeNudgeId(WEEKLY_NUDGE_ID_KEY, null);
}

/**
 * Schedule (or reschedule) a repeating weekly summary nudge. `weekday` follows
 * the expo-notifications convention (1 = Sunday … 7 = Saturday). Cancels any
 * previously scheduled weekly nudge first. Returns the scheduled id, or null.
 */
export async function scheduleWeeklyNudge(
  weekday: number,
  hour: number,
  minute: number,
): Promise<string | null> {
  try {
    ensureNotificationHandler();
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    await cancelWeeklyNudge();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weekly review',
        body: 'Check your profit, top sellers and expenses for the week in Trackr.',
        color: BRAND_COLOR,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
    await writeNudgeId(WEEKLY_NUDGE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}
