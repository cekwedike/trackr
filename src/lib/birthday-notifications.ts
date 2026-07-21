/**
 * Morning local notifications for customer birthdays (YEARLY trigger).
 * Channel: crm (created here so Task 11 works before full Task 12 channels).
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Customer } from '@/db/types';
import { parseBirthday } from '@/lib/birthday';
import { getNotifCategoryEnabled } from '@/lib/notification-prefs';
import {
  BRAND_COLOR,
  cancelReminder,
  ensureNotificationHandler,
  requestNotificationPermission,
} from '@/lib/notifications';

export const CRM_CHANNEL_ID = 'crm';

const BIRTHDAY_MAP_KEY = 'birthday.notificationIds';

async function ensureCrmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CRM_CHANNEL_ID, {
    name: 'Customers',
    description: 'Birthday reminders and customer follow-ups.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: BRAND_COLOR,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

async function readMap(): Promise<Record<string, string>> {
  try {
    const raw = await SecureStore.getItemAsync(BIRTHDAY_MAP_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, string>): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIRTHDAY_MAP_KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
}

/** Cancel a previously scheduled birthday notification for a customer. */
export async function cancelBirthdayNotification(customerId: number): Promise<void> {
  const map = await readMap();
  const key = String(customerId);
  const id = map[key];
  if (id) {
    await cancelReminder(id);
    delete map[key];
    await writeMap(map);
  }
}

/**
 * Schedule (or reschedule) a yearly morning birthday reminder for a customer.
 * Hour defaults to 9:00 local. No-op when birthday is null/invalid or permission denied.
 */
export async function scheduleBirthdayNotification(
  customer: Pick<Customer, 'id' | 'name' | 'birthday'>,
  hour = 9,
  minute = 0,
): Promise<string | null> {
  await cancelBirthdayNotification(customer.id);
  if (!customer.birthday) return null;
  // Spec §12: CRM / birthday alerts default off until the user enables them.
  if (!(await getNotifCategoryEnabled('crm'))) return null;

  // Birthdays recur yearly, so we only need month + day. Parse handles both
  // `YYYY-MM-DD` / full ISO and the year-less `--MM-DD` form (day + month only).
  const bd = parseBirthday(customer.birthday);
  if (!bd) return null;

  try {
    ensureNotificationHandler();
    await ensureCrmChannel();
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    // YearlyTriggerInput month is JS Date range (0 = January); parseBirthday is 1-based.
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Birthday: ${customer.name}`,
        body: `Wish ${customer.name} a happy birthday today.`,
        color: BRAND_COLOR,
        data: { type: 'birthday', customerId: customer.id },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: bd.month - 1,
        day: bd.day,
        hour,
        minute,
        channelId: CRM_CHANNEL_ID,
      },
    });

    const map = await readMap();
    map[String(customer.id)] = id;
    await writeMap(map);
    return id;
  } catch {
    return null;
  }
}

/** Reschedule birthdays for a list of customers (e.g. after import / restore). */
export async function syncBirthdayNotifications(
  customers: Pick<Customer, 'id' | 'name' | 'birthday'>[],
): Promise<void> {
  for (const c of customers) {
    if (c.birthday) await scheduleBirthdayNotification(c);
    else await cancelBirthdayNotification(c.id);
  }
}
