import { getDb } from '@/db/client';
import type { Recurrence, Reminder } from '@/db/types';
import { logAudit } from '@/lib/audit';
import { nowIso } from '@/lib/date';

export interface ReminderInput {
  title: string;
  body?: string | null;
  due_at: string;
  recurrence: Recurrence;
  notification_id?: string | null;
  target_type?: string | null;
  target_id?: number | null;
}

export async function listReminders(includeCompleted = false): Promise<Reminder[]> {
  const db = await getDb();
  const where = includeCompleted ? '' : 'WHERE completed = 0';
  return db.getAllAsync<Reminder>(`SELECT * FROM reminders ${where} ORDER BY due_at ASC`);
}

export async function getReminder(id: number): Promise<Reminder | null> {
  const db = await getDb();
  return db.getFirstAsync<Reminder>('SELECT * FROM reminders WHERE id = ?', [id]);
}

export async function createReminder(input: ReminderInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const res = await db.runAsync(
    `INSERT INTO reminders (title, body, due_at, recurrence, completed, notification_id, target_type, target_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.body ?? null,
      input.due_at,
      input.recurrence,
      input.notification_id ?? null,
      input.target_type ?? null,
      input.target_id ?? null,
      now,
      now,
    ],
  );
  await logAudit('reminder', res.lastInsertRowId, 'create', `Created reminder "${input.title}"`);
  return res.lastInsertRowId;
}

export async function updateReminder(id: number, input: ReminderInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reminders SET title = ?, body = ?, due_at = ?, recurrence = ?, notification_id = ?,
       target_type = ?, target_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.title,
      input.body ?? null,
      input.due_at,
      input.recurrence,
      input.notification_id ?? null,
      input.target_type ?? null,
      input.target_id ?? null,
      nowIso(),
      id,
    ],
  );
  await logAudit('reminder', id, 'update', `Updated reminder "${input.title}"`);
}

export async function setReminderCompleted(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE reminders SET completed = ?, updated_at = ? WHERE id = ?', [completed ? 1 : 0, nowIso(), id]);
  await logAudit('reminder', id, 'update', completed ? 'Completed reminder' : 'Reopened reminder');
}

export async function deleteReminder(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  await logAudit('reminder', id, 'delete', 'Deleted reminder');
}

/** Total number of reminders ever created (including completed). */
export async function countReminders(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM reminders');
  return row?.c ?? 0;
}

export async function upcomingReminders(limit = 5): Promise<Reminder[]> {
  const db = await getDb();
  return db.getAllAsync<Reminder>(
    'SELECT * FROM reminders WHERE completed = 0 ORDER BY due_at ASC LIMIT ?',
    [limit],
  );
}
