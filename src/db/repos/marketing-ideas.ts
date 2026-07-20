import { getDb } from '@/db/client';
import type { MarketingIdea } from '@/db/types';
import { nowIso } from '@/lib/date';

export const DEFAULT_IDEAS = [
  'Post this week’s special on your status / socials',
  'Message 3 regulars about a slow-moving item',
  'Offer a small birthday perk this month',
  'Ask a happy customer for a referral',
  'Refresh your price list / menu photo',
];

export async function listMarketingIdeas(): Promise<MarketingIdea[]> {
  const db = await getDb();
  return db.getAllAsync<MarketingIdea>(
    'SELECT * FROM marketing_ideas ORDER BY done ASC, sort_order ASC, id ASC',
  );
}

export async function createMarketingIdea(title: string, sortOrder = 0): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO marketing_ideas (title, done, sort_order, created_at, updated_at)
     VALUES (?, 0, ?, ?, ?)`,
    [title.trim(), sortOrder, now, now],
  );
  return res.lastInsertRowId;
}

export async function setMarketingIdeaDone(id: number, done: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE marketing_ideas SET done = ?, updated_at = ? WHERE id = ?', [
    done ? 1 : 0,
    nowIso(),
    id,
  ]);
}

export async function updateMarketingIdea(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE marketing_ideas SET title = ?, updated_at = ? WHERE id = ?', [
    title.trim(),
    nowIso(),
    id,
  ]);
}

export async function deleteMarketingIdea(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM marketing_ideas WHERE id = ?', [id]);
}

export async function countMarketingIdeas(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM marketing_ideas');
  return row?.c ?? 0;
}

/** Seed a starter checklist once. */
export async function ensureDefaultIdeas(): Promise<void> {
  if ((await countMarketingIdeas()) > 0) return;
  for (let i = 0; i < DEFAULT_IDEAS.length; i++) {
    await createMarketingIdea(DEFAULT_IDEAS[i], i);
  }
}
