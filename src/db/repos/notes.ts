import { getDb } from '@/db/client';
import type { LinkTargetType, Link, Note } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface NoteInput {
  title: string;
  body: string;
  pinned?: number;
  color?: string | null;
}

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export function extractWikiLinks(body: string): string[] {
  const titles = new Set<string>();
  let match: RegExpExecArray | null;
  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(body)) !== null) {
    const raw = match[1].trim();
    if (raw) titles.add(raw);
  }
  return Array.from(titles);
}

export async function listNotes(search = ''): Promise<Note[]> {
  const db = await getDb();
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    return db.getAllAsync<Note>(
      'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY pinned DESC, updated_at DESC',
      [q, q],
    );
  }
  return db.getAllAsync<Note>('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC');
}

/** Lightweight row for global search results. */
export interface NoteSearchRow {
  id: number;
  title: string;
  body: string;
}

/** Case-insensitive LIKE search over a note's title and body. */
export async function searchNotes(q: string, limit = 20): Promise<NoteSearchRow[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const like = `%${term}%`;
  return db.getAllAsync<NoteSearchRow>(
    `SELECT id, title, body FROM notes
     WHERE title LIKE ? OR body LIKE ?
     ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
    [like, like, limit],
  );
}

export async function getNote(id: number): Promise<Note | null> {
  const db = await getDb();
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', [id]);
}

export async function findNoteByTitle(title: string): Promise<Note | null> {
  const db = await getDb();
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE title = ? COLLATE NOCASE LIMIT 1', [title]);
}

/** Rebuild the note->note wiki links for a note from its body. Entity links are untouched. */
async function rebuildWikiLinks(noteId: number, body: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM links WHERE source_note_id = ? AND target_type = 'note'", [noteId]);
  const titles = extractWikiLinks(body);
  const now = nowIso();
  for (const title of titles) {
    const target = await findNoteByTitle(title);
    await db.runAsync(
      'INSERT INTO links (source_note_id, target_type, target_id, target_title, created_at) VALUES (?, ?, ?, ?, ?)',
      [noteId, 'note', target?.id ?? null, title, now],
    );
  }
}

export async function createNote(input: NoteInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    'INSERT INTO notes (title, body, pinned, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [input.title || 'Untitled', input.body ?? '', input.pinned ?? 0, input.color ?? null, now, now],
  );
  const id = res.lastInsertRowId;
  await rebuildWikiLinks(id, input.body ?? '');
  await resolveDanglingLinksTo(input.title);
  return id;
}

export async function updateNote(id: number, input: NoteInput): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET title = ?, body = ?, pinned = ?, color = ?, updated_at = ? WHERE id = ?', [
    input.title || 'Untitled',
    input.body ?? '',
    input.pinned ?? 0,
    input.color ?? null,
    nowIso(),
    id,
  ]);
  await rebuildWikiLinks(id, input.body ?? '');
  await resolveDanglingLinksTo(input.title);
}

/** When a note is created/renamed, resolve any unresolved wiki links that referenced its title. */
async function resolveDanglingLinksTo(title: string): Promise<void> {
  if (!title) return;
  const db = await getDb();
  const note = await findNoteByTitle(title);
  if (!note) return;
  await db.runAsync(
    "UPDATE links SET target_id = ? WHERE target_type = 'note' AND target_id IS NULL AND target_title = ? COLLATE NOCASE",
    [note.id, title],
  );
}

export async function deleteNote(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
  await db.runAsync("UPDATE links SET target_id = NULL WHERE target_type = 'note' AND target_id = ?", [id]);
}

export async function togglePinned(id: number, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?', [pinned ? 1 : 0, nowIso(), id]);
}

/** Set (or clear, with null) the per-note color-theme key. Leaves updated_at untouched to avoid reordering. */
export async function setNoteColor(id: number, color: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET color = ? WHERE id = ?', [color, id]);
}

/** Entity link (customer/product/order) attached to a note, used by the Connection view. */
export interface NoteEntityLink {
  link_id: number;
  note_id: number;
  target_type: LinkTargetType;
  target_id: number | null;
  target_title: string | null;
}

/** All entity attachments (customer/product/order) across every note, for grouping in the Connection view. */
export async function listNoteEntityLinks(): Promise<NoteEntityLink[]> {
  const db = await getDb();
  return db.getAllAsync<NoteEntityLink>(
    `SELECT id AS link_id, source_note_id AS note_id, target_type, target_id, target_title
     FROM links
     WHERE target_type IN ('customer', 'product', 'order')
     ORDER BY target_type ASC, target_title ASC`,
  );
}

// ----- Links -----

export interface OutgoingLink extends Link {
  resolved_title: string | null;
}

export async function getOutgoingLinks(noteId: number): Promise<OutgoingLink[]> {
  const db = await getDb();
  return db.getAllAsync<OutgoingLink>(
    `SELECT l.*, n.title AS resolved_title
     FROM links l LEFT JOIN notes n ON (l.target_type = 'note' AND n.id = l.target_id)
     WHERE l.source_note_id = ? ORDER BY l.id ASC`,
    [noteId],
  );
}

export interface Backlink {
  id: number;
  source_note_id: number;
  source_title: string;
}

/** Notes that reference a given entity (product/sale/order/customer/expense). */
export async function getNotesLinkingEntity(type: LinkTargetType, id: number): Promise<Backlink[]> {
  const db = await getDb();
  return db.getAllAsync<Backlink>(
    `SELECT l.id, l.source_note_id, n.title AS source_title
     FROM links l JOIN notes n ON n.id = l.source_note_id
     WHERE l.target_type = ? AND l.target_id = ? ORDER BY n.title ASC`,
    [type, id],
  );
}

export async function addEntityLink(
  noteId: number,
  type: LinkTargetType,
  targetId: number,
  targetTitle: string,
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM links WHERE source_note_id = ? AND target_type = ? AND target_id = ?',
    [noteId, type, targetId],
  );
  if (existing) return;
  await db.runAsync(
    'INSERT INTO links (source_note_id, target_type, target_id, target_title, created_at) VALUES (?, ?, ?, ?, ?)',
    [noteId, type, targetId, targetTitle, nowIso()],
  );
}

export async function removeLink(linkId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM links WHERE id = ?', [linkId]);
}
