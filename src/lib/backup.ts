/**
 * Full backup / restore with optional media (LOCKED: zip includes audio).
 *
 * Format v2: a `.zip` containing:
 *   - `backup.json` — same table dump as the legacy JSON backup
 *   - `attachments/<filename>` — binary files referenced by the attachments table
 *
 * Legacy `.json` backups (version 1) still restore; they simply have no media files.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { getDb } from '@/db/client';
import { listAllAttachments } from '@/db/repos/attachments';
import { attachmentFileName, writeAttachmentBytes } from '@/lib/attachments';
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
  'message_templates',
  'marketing_ideas',
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
  return { app: 'trackr', version: 2, exportedAt: dayjs().toISOString(), data };
}

/** Rewrite attachment uris in the payload to stable relative paths for zip packaging. */
function remapAttachmentUris(
  payload: BackupPayload,
  uriToEntry: Map<string, string>,
): BackupPayload {
  const rows = payload.data.attachments;
  if (!rows?.length) return payload;
  const remapped = rows.map((row) => {
    const uri = String(row.uri ?? '');
    const entry = uriToEntry.get(uri);
    if (!entry) return row;
    return { ...row, uri: `attachments/${entry}` };
  });
  return { ...payload, data: { ...payload.data, attachments: remapped } };
}

async function collectAttachmentFiles(): Promise<{
  files: Record<string, Uint8Array>;
  uriToEntry: Map<string, string>;
}> {
  const attachments = await listAllAttachments();
  const files: Record<string, Uint8Array> = {};
  const uriToEntry = new Map<string, string>();
  const usedNames = new Set<string>();

  for (const att of attachments) {
    try {
      const file = new File(att.uri);
      if (!file.exists) continue;
      let name = attachmentFileName(att.uri);
      if (usedNames.has(name)) {
        name = `${att.id}-${name}`;
      }
      usedNames.add(name);
      const bytes = await file.bytes();
      files[`attachments/${name}`] = bytes;
      uriToEntry.set(att.uri, name);
    } catch {
      // Skip missing/unreadable files; row still exports so restore can warn later.
    }
  }
  return { files, uriToEntry };
}

/** Export all data + attachment media to a zip and open the share sheet. */
export async function exportBackup(): Promise<string> {
  const payload = await buildBackup();
  const { files, uriToEntry } = await collectAttachmentFiles();
  const remapped = remapAttachmentUris(payload, uriToEntry);
  const json = JSON.stringify(remapped, null, 2);

  const zipEntries: Record<string, Uint8Array> = {
    'backup.json': strToU8(json),
    ...files,
  };
  const zipped = zipSync(zipEntries, { level: 6 });

  const filename = `trackr-backup-${dayjs().format('YYYY-MM-DD-HHmm')}.zip`;
  const out = new File(Paths.cache, filename);
  if (out.exists) out.delete();
  out.create();
  out.write(zipped);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(out.uri, {
      mimeType: 'application/zip',
      dialogTitle: 'Export Trackr backup',
    });
  }
  void import('@/lib/event-notifications').then((m) => m.markBackupExported()).catch(() => {});
  return out.uri;
}

async function restorePayload(payload: BackupPayload): Promise<number> {
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
  return count;
}

/**
 * After DB restore, rewrite relative `attachments/...` uris to absolute files
 * written from the zip (or leave absolute uris from legacy JSON alone).
 */
async function materializeAttachmentFiles(
  media: Record<string, Uint8Array>,
): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; uri: string }>('SELECT id, uri FROM attachments');
  for (const row of rows) {
    if (!row.uri.startsWith('attachments/')) continue;
    const entry = row.uri;
    const bytes = media[entry];
    if (!bytes) continue;
    const base = entry.slice('attachments/'.length);
    const newUri = await writeAttachmentBytes(base, bytes);
    await db.runAsync('UPDATE attachments SET uri = ? WHERE id = ?', [newUri, row.id]);
  }
}

/** Let the user pick a backup (.zip or legacy .json) and restore it. */
export async function importBackup(): Promise<{ imported: boolean; tables: number }> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return { imported: false, tables: 0 };

  const asset = picked.assets[0];
  const file = new File(asset.uri);
  const name = (asset.name ?? asset.uri).toLowerCase();
  const isZip = name.endsWith('.zip') || asset.mimeType === 'application/zip';

  if (isZip) {
    const bytes = await file.bytes();
    const entries = unzipSync(bytes);
    const jsonBytes = entries['backup.json'];
    if (!jsonBytes) throw new Error('This zip is not a valid Trackr backup (missing backup.json).');
    const payload = JSON.parse(strFromU8(jsonBytes)) as BackupPayload;
    const tables = await restorePayload(payload);
    const media: Record<string, Uint8Array> = {};
    for (const [path, data] of Object.entries(entries)) {
      if (path.startsWith('attachments/') && !path.endsWith('/')) {
        media[path] = data;
      }
    }
    await materializeAttachmentFiles(media);
    await rescheduleBirthdaysAfterRestore();
    return { imported: true, tables };
  }

  const raw = await file.text();
  const payload = JSON.parse(raw) as BackupPayload;
  const tables = await restorePayload(payload);
  await rescheduleBirthdaysAfterRestore();
  return { imported: true, tables };
}

async function rescheduleBirthdaysAfterRestore(): Promise<void> {
  try {
    const { listCustomers } = await import('@/db/repos/customers');
    const { syncBirthdayNotifications } = await import('@/lib/birthday-notifications');
    const customers = await listCustomers();
    await syncBirthdayNotifications(customers);
  } catch {
    // Birthday reschedule is best-effort after restore
  }
}
