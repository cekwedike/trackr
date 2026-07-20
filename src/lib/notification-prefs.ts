/**
 * Per-category notification toggles (SecureStore). Defaults match the product
 * refinement spec §12: inventory/orders on; payments/crm/system off until opted in.
 */
import * as SecureStore from 'expo-secure-store';

export type NotifCategory = 'inventory' | 'payments' | 'orders' | 'crm' | 'system';

export const NOTIF_CATEGORY_META: Record<
  NotifCategory,
  { label: string; hint: string; icon: 'cube' | 'cash' | 'clipboard' | 'gift' | 'cloud-upload' }
> = {
  inventory: {
    label: 'Low stock',
    hint: 'When an item drops to its reorder level (at most once a day per item)',
    icon: 'cube',
  },
  payments: {
    label: 'Outstanding balances',
    hint: 'A gentle morning note when customers still owe you',
    icon: 'cash',
  },
  orders: {
    label: 'Order due dates',
    hint: 'Morning of the due date for open orders',
    icon: 'clipboard',
  },
  crm: {
    label: 'Customer birthdays',
    hint: 'Wish customers a happy birthday on the morning of their day',
    icon: 'gift',
  },
  system: {
    label: 'Backup reminder',
    hint: 'A soft nudge if you haven’t exported a backup in a while',
    icon: 'cloud-upload',
  },
};

const DEFAULTS: Record<NotifCategory, boolean> = {
  inventory: true,
  payments: false,
  orders: true,
  crm: false,
  system: false,
};

function key(cat: NotifCategory): string {
  return `notif.cat.${cat}`;
}

export async function getNotifCategoryEnabled(cat: NotifCategory): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(key(cat));
    if (raw === null || raw === undefined) return DEFAULTS[cat];
    return raw === '1';
  } catch {
    return DEFAULTS[cat];
  }
}

export async function setNotifCategoryEnabled(cat: NotifCategory, enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(cat), enabled ? '1' : '0');
  } catch {
    // best-effort
  }
}

export async function getAllNotifCategories(): Promise<Record<NotifCategory, boolean>> {
  const entries = await Promise.all(
    (Object.keys(DEFAULTS) as NotifCategory[]).map(async (cat) => [cat, await getNotifCategoryEnabled(cat)] as const),
  );
  return Object.fromEntries(entries) as Record<NotifCategory, boolean>;
}
