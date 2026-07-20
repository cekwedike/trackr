/**
 * Full backup / restore with optional media and passphrase encryption.
 *
 * Format v2: a `.zip` containing:
 *   - `backup.json` — same table dump as the legacy JSON backup
 *   - `attachments/<filename>` — binary files referenced by the attachments table
 *
 * Format v3 (encrypted): AES-GCM wrapped zip (`TRKRBK01` magic) — see backup-crypto.ts.
 * Legacy plaintext `.zip` / `.json` backups still restore, with a warning from the UI.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { getDb } from '@/db/client';
import { listAllAttachments } from '@/db/repos/attachments';
import { attachmentFileName, writeAttachmentBytes } from '@/lib/attachments';
import { decryptBackupBytes, encryptBackupBytes, isEncryptedBackup } from '@/lib/backup-crypto';
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

export type BackupKind = 'encrypted' | 'legacy-zip' | 'legacy-json';

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

async function buildZipBytes(): Promise<Uint8Array> {
  const payload = await buildBackup();
  const { files, uriToEntry } = await collectAttachmentFiles();
  const remapped = remapAttachmentUris(payload, uriToEntry);
  const json = JSON.stringify(remapped, null, 2);

  const zipEntries: Record<string, Uint8Array> = {
    'backup.json': strToU8(json),
    ...files,
  };
  return zipSync(zipEntries, { level: 6 });
}

/**
 * Export all data + attachment media as a passphrase-encrypted backup and share it.
 * The share file is a `.trackrbackup` container (encrypted zip).
 */
export async function exportBackup(passphrase: string): Promise<string> {
  const zipped = await buildZipBytes();
  let encrypted: Uint8Array;
  try {
    encrypted = await encryptBackupBytes(zipped, passphrase);
  } catch (e) {
    if (e instanceof Error && e.message.length < 120) throw e;
    throw new Error('Couldn’t encrypt your backup. Please try a different passphrase.');
  }

  const filename = `trackr-backup-${dayjs().format('YYYY-MM-DD-HHmm')}.trackrbackup`;
  const out = new File(Paths.cache, filename);
  if (out.exists) out.delete();
  out.create();
  out.write(encrypted);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(out.uri, {
      mimeType: 'application/octet-stream',
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

async function restoreFromZipBytes(bytes: Uint8Array): Promise<number> {
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
  return tables;
}

/**
 * Pick a backup file and inspect whether it needs a passphrase.
 * Does not restore — caller confirms, then calls {@link importBackupWithPassphrase} or
 * {@link importLegacyBackup}.
 */
export async function pickBackupFile(): Promise<
  | { picked: false }
  | { picked: true; uri: string; name: string; kind: BackupKind; bytes: Uint8Array }
> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/json', 'application/octet-stream', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return { picked: false };

  const asset = picked.assets[0];
  const file = new File(asset.uri);
  const name = (asset.name ?? asset.uri).toLowerCase();
  const bytes = await file.bytes();

  if (isEncryptedBackup(bytes) || name.endsWith('.trackrbackup')) {
    return { picked: true, uri: asset.uri, name: asset.name ?? 'backup', kind: 'encrypted', bytes };
  }

  const isZip =
    name.endsWith('.zip') ||
    asset.mimeType === 'application/zip' ||
    (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b);

  if (isZip) {
    return { picked: true, uri: asset.uri, name: asset.name ?? 'backup', kind: 'legacy-zip', bytes };
  }

  return { picked: true, uri: asset.uri, name: asset.name ?? 'backup', kind: 'legacy-json', bytes };
}

/** Restore a passphrase-encrypted `.trackrbackup` (or encrypted bytes). */
export async function importBackupWithPassphrase(
  bytes: Uint8Array,
  passphrase: string,
): Promise<{ imported: true; tables: number }> {
  let zipBytes: Uint8Array;
  try {
    zipBytes = await decryptBackupBytes(bytes, passphrase);
  } catch (e) {
    if (e instanceof Error && e.message.length < 160) throw e;
    throw new Error('Couldn’t unlock that backup. Check the passphrase and try again.');
  }
  try {
    const tables = await restoreFromZipBytes(zipBytes);
    await rescheduleBirthdaysAfterRestore();
    return { imported: true, tables };
  } catch (e) {
    if (e instanceof Error && e.message.includes('valid Trackr')) throw e;
    throw new Error('Couldn’t restore that backup. The file may be damaged.');
  }
}

/** Restore a legacy plaintext zip or JSON backup. */
export async function importLegacyBackup(
  bytes: Uint8Array,
  kind: 'legacy-zip' | 'legacy-json',
): Promise<{ imported: true; tables: number }> {
  if (kind === 'legacy-zip') {
    const tables = await restoreFromZipBytes(bytes);
    await rescheduleBirthdaysAfterRestore();
    return { imported: true, tables };
  }
  const raw = new TextDecoder().decode(bytes);
  const payload = JSON.parse(raw) as BackupPayload;
  const tables = await restorePayload(payload);
  await rescheduleBirthdaysAfterRestore();
  return { imported: true, tables };
}

/**
 * @deprecated Prefer pickBackupFile + importBackupWithPassphrase / importLegacyBackup
 * so the UI can collect a passphrase and warn about legacy files.
 */
export async function importBackup(): Promise<{ imported: boolean; tables: number }> {
  const picked = await pickBackupFile();
  if (!picked.picked) return { imported: false, tables: 0 };
  if (picked.kind === 'encrypted') {
    throw new Error('This backup is passphrase-protected. Enter the passphrase to restore.');
  }
  const result = await importLegacyBackup(picked.bytes, picked.kind);
  return result;
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
