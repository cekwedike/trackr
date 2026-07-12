import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Recurrence } from '@/db/types';

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

export async function requestNotificationPermission(): Promise<boolean> {
  ensureNotificationHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
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

    const channelId = 'reminders';
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
      content: { title, body },
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
