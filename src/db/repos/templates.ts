import { getDb } from '@/db/client';
import type { MessageTemplate } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface MessageTemplateInput {
  title: string;
  body: string;
  category?: string | null;
}

export const TEMPLATE_CATEGORIES = ['Promo', 'Follow-up', 'Birthday', 'Thank you', 'Reminder', 'Other'];

/** Seed a few practical defaults the first time the marketing hub opens. */
export const DEFAULT_TEMPLATES: MessageTemplateInput[] = [
  {
    title: 'Birthday wish',
    body: 'Happy birthday, {name}! Thanks for being a valued customer. Come by this week for a small treat on us.',
    category: 'Birthday',
  },
  {
    title: 'New stock alert',
    body: 'Hi {name} — fresh stock just arrived. Reply if you’d like us to set something aside.',
    category: 'Promo',
  },
  {
    title: 'Gentle payment reminder',
    body: 'Hi {name}, just a friendly note about your outstanding balance. Happy to help if you have questions.',
    category: 'Reminder',
  },
  {
    title: 'Thank you',
    body: 'Thank you for your purchase, {name}! We appreciate your business.',
    category: 'Thank you',
  },
];

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const db = await getDb();
  return db.getAllAsync<MessageTemplate>(
    'SELECT * FROM message_templates ORDER BY updated_at DESC, id DESC',
  );
}

export async function getMessageTemplate(id: number): Promise<MessageTemplate | null> {
  const db = await getDb();
  return db.getFirstAsync<MessageTemplate>('SELECT * FROM message_templates WHERE id = ?', [id]);
}

export async function createMessageTemplate(input: MessageTemplateInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO message_templates (title, body, category, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [input.title.trim(), input.body, input.category ?? null, now, now],
  );
  return res.lastInsertRowId;
}

export async function updateMessageTemplate(id: number, input: MessageTemplateInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE message_templates SET title = ?, body = ?, category = ?, updated_at = ? WHERE id = ?`,
    [input.title.trim(), input.body, input.category ?? null, nowIso(), id],
  );
}

export async function deleteMessageTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM message_templates WHERE id = ?', [id]);
}

export async function countMessageTemplates(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM message_templates');
  return row?.c ?? 0;
}

/** Insert default templates only when the table is empty. */
export async function ensureDefaultTemplates(): Promise<void> {
  if ((await countMessageTemplates()) > 0) return;
  for (const t of DEFAULT_TEMPLATES) await createMessageTemplate(t);
}

/** Replace `{name}` (and common variants) for personalised copy/share. */
export function fillTemplate(body: string, name?: string | null): string {
  const n = (name ?? '').trim() || 'there';
  return body.replace(/\{name\}/gi, n);
}
