import { getDb } from '@/db/client';
import type { Attachment } from '@/db/types';
import { deleteAttachmentFile } from '@/lib/attachments';
import { nowIso } from '@/lib/date';

export type AttachmentEntity = Attachment['entity'];

/** Persist an attachment row pointing at an already-copied file. Returns the new id. */
export async function addAttachment(
  entity: AttachmentEntity,
  entityId: number,
  uri: string,
  mime: string | null,
): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO attachments (entity, entity_id, uri, mime, created_at) VALUES (?, ?, ?, ?, ?)',
    [entity, entityId, uri, mime, nowIso()],
  );
  return res.lastInsertRowId;
}

/** All attachments for an entity, newest first. */
export async function listAttachments(entity: AttachmentEntity, entityId: number): Promise<Attachment[]> {
  const db = await getDb();
  return db.getAllAsync<Attachment>(
    'SELECT * FROM attachments WHERE entity = ? AND entity_id = ? ORDER BY created_at DESC, id DESC',
    [entity, entityId],
  );
}

/** Delete an attachment row and its backing file (file removal is best-effort). */
export async function deleteAttachment(id: number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ uri: string }>('SELECT uri FROM attachments WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM attachments WHERE id = ?', [id]);
  if (row?.uri) await deleteAttachmentFile(row.uri);
}
