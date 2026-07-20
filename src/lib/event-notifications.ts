/**
 * Event-driven local notifications: low stock, outstanding balances, order dues,
 * backup nudge. Channels: inventory / payments / orders / system (crm is in
 * birthday-notifications.ts). Respects per-category prefs + OS permission.
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { listCustomers } from '@/db/repos/customers';
import { listOrders } from '@/db/repos/orders';
import { getProduct, listLowStockProducts } from '@/db/repos/products';
import { dayjs } from '@/lib/date';
import { getNotifCategoryEnabled } from '@/lib/notification-prefs';
import {
  BRAND_COLOR,
  cancelReminder,
  ensureNotificationHandler,
  requestNotificationPermission,
} from '@/lib/notifications';
import { formatQty } from '@/lib/money';

export const INVENTORY_CHANNEL_ID = 'inventory';
export const PAYMENTS_CHANNEL_ID = 'payments';
export const ORDERS_CHANNEL_ID = 'orders';
export const SYSTEM_CHANNEL_ID = 'system';

const LOW_STOCK_MAP_KEY = 'notif.lowStock.ids';
const LOW_STOCK_DAY_KEY = 'notif.lowStock.lastDay';
const ORDER_DUE_MAP_KEY = 'notif.orderDue.ids';
const PAYMENTS_NUDGE_ID_KEY = 'notif.payments.nudgeId';
const BACKUP_NUDGE_ID_KEY = 'notif.backup.nudgeId';
export const LAST_BACKUP_AT_KEY = 'backup.lastExportedAt';

/** Days without a backup before the gentle system nudge may fire. */
const BACKUP_NUDGE_AFTER_DAYS = 7;

async function ensureChannel(
  id: string,
  name: string,
  description: string,
  importance: Notifications.AndroidImportance = Notifications.AndroidImportance.DEFAULT,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(id, {
    name,
    description,
    importance,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: BRAND_COLOR,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

/** Create/refresh all event channels (Android). Safe to call often. */
export async function ensureEventChannels(): Promise<void> {
  await Promise.all([
    ensureChannel(INVENTORY_CHANNEL_ID, 'Inventory', 'Low-stock alerts for products that need restocking.'),
    ensureChannel(PAYMENTS_CHANNEL_ID, 'Payments', 'Reminders about outstanding customer balances.'),
    ensureChannel(
      ORDERS_CHANNEL_ID,
      'Orders',
      'Due-date reminders for open orders.',
      Notifications.AndroidImportance.HIGH,
    ),
    ensureChannel(SYSTEM_CHANNEL_ID, 'System', 'Backup reminders and other gentle app tips.'),
  ]);
}

async function readMap(storeKey: string): Promise<Record<string, string>> {
  try {
    const raw = await SecureStore.getItemAsync(storeKey);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeMap(storeKey: string, map: Record<string, string>): Promise<void> {
  try {
    await SecureStore.setItemAsync(storeKey, JSON.stringify(map));
  } catch {
    // best-effort
  }
}

async function readId(storeKey: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(storeKey);
  } catch {
    return null;
  }
}

async function writeId(storeKey: string, id: string | null): Promise<void> {
  try {
    if (id) await SecureStore.setItemAsync(storeKey, id);
    else await SecureStore.deleteItemAsync(storeKey);
  } catch {
    // best-effort
  }
}

function todayKey(): string {
  return dayjs().format('YYYY-MM-DD');
}

async function readDayMap(storeKey: string): Promise<Record<string, string>> {
  return readMap(storeKey);
}

async function writeDayMap(storeKey: string, map: Record<string, string>): Promise<void> {
  await writeMap(storeKey, map);
}

// ---------------------------------------------------------------------------
// Low stock (throttle: 1/day/product)
// ---------------------------------------------------------------------------

export async function cancelLowStockNotification(productId: number): Promise<void> {
  const map = await readMap(LOW_STOCK_MAP_KEY);
  const key = String(productId);
  const id = map[key];
  if (id) {
    await cancelReminder(id);
    delete map[key];
    await writeMap(LOW_STOCK_MAP_KEY, map);
  }
}

/**
 * If the product is at/below threshold and inventory alerts are on, fire a
 * near-immediate local notification (throttled to once per calendar day).
 */
export async function maybeNotifyLowStock(productId: number): Promise<void> {
  try {
    if (!(await getNotifCategoryEnabled('inventory'))) {
      await cancelLowStockNotification(productId);
      return;
    }
    const product = await getProduct(productId);
    if (!product || product.is_active !== 1) {
      await cancelLowStockNotification(productId);
      return;
    }
    if (!(product.low_stock_threshold > 0 && product.stock <= product.low_stock_threshold)) {
      await cancelLowStockNotification(productId);
      return;
    }

    const dayMap = await readDayMap(LOW_STOCK_DAY_KEY);
    const day = todayKey();
    if (dayMap[String(productId)] === day) return;

    ensureNotificationHandler();
    await ensureEventChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelLowStockNotification(productId);

    const qty = formatQty(product.stock);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Running low',
        body: `${product.name} is at ${qty} ${product.unit}. Restock when you can.`,
        color: BRAND_COLOR,
        data: { type: 'low_stock', productId },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: INVENTORY_CHANNEL_ID,
      },
    });

    const map = await readMap(LOW_STOCK_MAP_KEY);
    map[String(productId)] = id;
    await writeMap(LOW_STOCK_MAP_KEY, map);
    dayMap[String(productId)] = day;
    await writeDayMap(LOW_STOCK_DAY_KEY, dayMap);
  } catch {
    // non-critical
  }
}

/** After a sale, check each line product for low stock. */
export async function maybeNotifyLowStockForProducts(productIds: (number | null | undefined)[]): Promise<void> {
  const unique = [...new Set(productIds.filter((id): id is number => typeof id === 'number' && id > 0))];
  for (const id of unique) await maybeNotifyLowStock(id);
}

// ---------------------------------------------------------------------------
// Order due (morning of due date)
// ---------------------------------------------------------------------------

export async function cancelOrderDueNotification(orderId: number): Promise<void> {
  const map = await readMap(ORDER_DUE_MAP_KEY);
  const key = String(orderId);
  const id = map[key];
  if (id) {
    await cancelReminder(id);
    delete map[key];
    await writeMap(ORDER_DUE_MAP_KEY, map);
  }
}

/**
 * Schedule (or clear) a morning-of-due reminder for an open order.
 * Fires at 9:00 local on the due date; skipped if due is in the past or done.
 */
export async function scheduleOrderDueNotification(order: {
  id: number;
  customer_name: string | null;
  status: string;
  due_at: string | null;
}): Promise<string | null> {
  await cancelOrderDueNotification(order.id);

  if (!(await getNotifCategoryEnabled('orders'))) return null;
  if (!order.due_at) return null;
  if (order.status === 'delivered' || order.status === 'cancelled') return null;

  const due = dayjs(order.due_at);
  if (!due.isValid()) return null;

  const fireAt = due.hour(9).minute(0).second(0).millisecond(0);
  if (fireAt.valueOf() <= Date.now()) return null;

  try {
    ensureNotificationHandler();
    await ensureEventChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const who = order.customer_name?.trim() || 'your order';
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Order due today',
        body: `${who} is due today. Open Trackr when you’re ready.`,
        color: BRAND_COLOR,
        data: { type: 'order_due', orderId: order.id },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt.toDate(),
        channelId: ORDERS_CHANNEL_ID,
      },
    });

    const map = await readMap(ORDER_DUE_MAP_KEY);
    map[String(order.id)] = id;
    await writeMap(ORDER_DUE_MAP_KEY, map);
    return id;
  } catch {
    return null;
  }
}

export async function syncOrderDueNotifications(): Promise<void> {
  const orders = await listOrders();
  const enabled = await getNotifCategoryEnabled('orders');
  const map = await readMap(ORDER_DUE_MAP_KEY);

  if (!enabled) {
    for (const id of Object.values(map)) await cancelReminder(id);
    await writeMap(ORDER_DUE_MAP_KEY, {});
    return;
  }

  const keep = new Set(orders.map((o) => String(o.id)));
  for (const [key, notifId] of Object.entries(map)) {
    if (!keep.has(key)) {
      await cancelReminder(notifId);
      delete map[key];
    }
  }
  await writeMap(ORDER_DUE_MAP_KEY, map);

  for (const o of orders) {
    await scheduleOrderDueNotification(o);
  }
}

// ---------------------------------------------------------------------------
// Outstanding balances (daily morning summary when any debt exists)
// ---------------------------------------------------------------------------

export async function cancelPaymentsNudge(): Promise<void> {
  const id = await readId(PAYMENTS_NUDGE_ID_KEY);
  await cancelReminder(id);
  await writeId(PAYMENTS_NUDGE_ID_KEY, null);
}

export async function syncPaymentsNudge(): Promise<void> {
  await cancelPaymentsNudge();
  if (!(await getNotifCategoryEnabled('payments'))) return;

  const customers = await listCustomers();
  const debtors = customers.filter((c) => c.debt_balance > 0);
  if (debtors.length === 0) return;

  try {
    ensureNotificationHandler();
    await ensureEventChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const body =
      debtors.length === 1
        ? `${debtors[0].name} still has a balance with you. Review when you have a moment.`
        : `${debtors.length} customers have outstanding balances. Review receivables when you can.`;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Outstanding balances',
        body,
        color: BRAND_COLOR,
        data: { type: 'payments_nudge' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 0,
        channelId: PAYMENTS_CHANNEL_ID,
      },
    });
    await writeId(PAYMENTS_NUDGE_ID_KEY, id);
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// Backup nudge (gentle; only when no backup in N days)
// ---------------------------------------------------------------------------

export async function markBackupExported(at = dayjs().toISOString()): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_BACKUP_AT_KEY, at);
  } catch {
    // best-effort
  }
  await syncBackupNudge();
}

export async function getLastBackupAt(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_BACKUP_AT_KEY);
  } catch {
    return null;
  }
}

export async function cancelBackupNudge(): Promise<void> {
  const id = await readId(BACKUP_NUDGE_ID_KEY);
  await cancelReminder(id);
  await writeId(BACKUP_NUDGE_ID_KEY, null);
}

export async function syncBackupNudge(): Promise<void> {
  await cancelBackupNudge();
  if (!(await getNotifCategoryEnabled('system'))) return;

  const last = await getLastBackupAt();
  const daysSince = last ? dayjs().diff(dayjs(last), 'day') : BACKUP_NUDGE_AFTER_DAYS + 1;
  if (daysSince < BACKUP_NUDGE_AFTER_DAYS) return;

  try {
    ensureNotificationHandler();
    await ensureEventChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // One-shot tomorrow morning — avoid stacking weekly spam.
    const fireAt = dayjs().add(1, 'day').hour(9).minute(0).second(0).millisecond(0);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Backup when you’re ready',
        body: 'A quick export keeps your books safe if this device is lost or replaced.',
        color: BRAND_COLOR,
        data: { type: 'backup_nudge' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt.toDate(),
        channelId: SYSTEM_CHANNEL_ID,
      },
    });
    await writeId(BACKUP_NUDGE_ID_KEY, id);
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// Full sync (app start / after toggling prefs)
// ---------------------------------------------------------------------------

/** Reschedule event notifications from current DB + prefs. Best-effort. */
export async function syncEventNotifications(): Promise<void> {
  try {
    ensureNotificationHandler();
    await ensureEventChannels();

    if (await getNotifCategoryEnabled('inventory')) {
      const low = await listLowStockProducts();
      for (const p of low) await maybeNotifyLowStock(p.id);
    }

    await syncOrderDueNotifications();
    await syncPaymentsNudge();
    await syncBackupNudge();
  } catch {
    // non-critical
  }
}
