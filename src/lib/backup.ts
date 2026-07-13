import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '@/db/client';
import { dayjs } from '@/lib/date';

const TABLES = [
  'settings',
  'products',
  'ingredients',
  'recipes',
  'recipe_items',
  'customers',
  'sales',
  'sale_items',
  'expenses',
  'orders',
  'order_items',
  'notes',
  'links',
  'reminders',
  'stock_movements',
  'profit_records',
  'payments',
  'recurring_rules',
  'audit_log',
  'attachments',
];

export interface BackupPayload {
  app: 'trackr';
  version: number;
  exportedAt: string;
  data: Record<string, Record<string, unknown>[]>;
}

export async function buildBackup(): Promise<BackupPayload> {
  const db = await getDb();
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    data[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }
  return { app: 'trackr', version: 1, exportedAt: dayjs().toISOString(), data };
}

/** Export all data to a JSON file and open the share sheet. Returns the file uri. */
export async function exportBackup(): Promise<string> {
  const payload = await buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const filename = `trackr-backup-${dayjs().format('YYYY-MM-DD-HHmm')}.json`;
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Trackr backup',
    });
  }
  return file.uri;
}

/** Let the user pick a backup file and restore it (replaces all current data). */
export async function importBackup(): Promise<{ imported: boolean; tables: number }> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return { imported: false, tables: 0 };

  const asset = picked.assets[0];
  const file = new File(asset.uri);
  const raw = await file.text();
  const payload = JSON.parse(raw) as BackupPayload;
  if (payload.app !== 'trackr' || !payload.data) {
    throw new Error('This file is not a valid Trackr backup.');
  }

  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  let count = 0;
  try {
    await db.withTransactionAsync(async () => {
      for (const table of TABLES) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
      for (const table of TABLES) {
        const rows = payload.data[table];
        if (!rows || !rows.length) continue;
        for (const row of rows) {
          const cols = Object.keys(row);
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map((c) => row[c] as string | number | null);
          await db.runAsync(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
            values,
          );
        }
        count++;
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return { imported: true, tables: count };
}
