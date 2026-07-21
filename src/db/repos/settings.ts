import { getDb } from '@/db/client';
import type { Settings } from '@/db/types';
import { nowIso } from '@/lib/date';
import { DEFAULT_ALLOCATION } from '@/lib/profit';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  let row = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  if (!row) {
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO settings (id, business_name, currency_code, currency_symbol, locale, profit_allocation, lock_enabled, biometric_enabled, onboarded, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
      ['My Business', 'NGN', '₦', 'en', JSON.stringify(DEFAULT_ALLOCATION), now, now],
    );
    row = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  }
  return row!;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await getDb();
  await getSettings(); // ensure row exists
  const fields: string[] = [];
  const values: (string | number)[] = [];
  const allowed: (keyof Settings)[] = [
    'business_name',
    'currency_code',
    'currency_symbol',
    'locale',
    'industry',
    'profit_allocation',
    'lock_enabled',
    'biometric_enabled',
    'onboarded',
    'business_lat',
    'business_lng',
    'business_location_label',
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key] as string | number);
    }
  }
  fields.push('updated_at = ?');
  values.push(nowIso());
  await db.runAsync(`UPDATE settings SET ${fields.join(', ')} WHERE id = 1`, values);
  return getSettings();
}
