import { getDb } from '@/db/client';
import { getSettings } from '@/db/repos/settings';
import type { AuditEntry } from '@/db/types';
import { nowIso } from '@/lib/date';
import { formatMoney } from '@/lib/money';

export type AuditAction = AuditEntry['action'];

/**
 * Format a minor-units money value for a human-readable activity summary, using
 * the user's configured currency symbol. Audit logging is best-effort, so if
 * settings can't be read we fall back to the default symbol rather than throw.
 * This keeps raw internal values (e.g. `150000`) out of the Activity log — they
 * always render as proper money (e.g. `₦1,500`).
 */
export async function auditMoney(minor: number): Promise<string> {
  try {
    const { currency_symbol } = await getSettings();
    return formatMoney(minor, currency_symbol);
  } catch {
    return formatMoney(minor);
  }
}

/**
 * Append one row to the activity/audit log — a fire-and-forget record of a
 * create/update/delete somewhere in the app.
 *
 * IMPORTANT: this is a PLAIN insert (never wrapped in `withTransactionAsync`).
 * It is called from inside repositories right after their own DB work completes,
 * and some of those repos run their mutation inside a transaction. SQLite does
 * not support nested transactions, so wrapping here would throw. Errors are
 * swallowed on purpose: logging must never break the mutation it describes.
 */
export async function logAudit(
  entity: string,
  entityId: number | null,
  action: AuditAction,
  summary: string,
): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO audit_log (entity, entity_id, action, summary, created_at) VALUES (?, ?, ?, ?, ?)',
      [entity, entityId, action, summary, nowIso()],
    );
  } catch {
    // Intentionally ignored — the audit log is best-effort and must never
    // surface an error to (or roll back) the caller's mutation.
  }
}

/** Recent audit entries, newest first. Defaults to the 200 most recent. */
export async function listAuditEntries(limit = 200, offset = 0): Promise<AuditEntry[]> {
  const db = await getDb();
  return db.getAllAsync<AuditEntry>(
    'SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
}

/** Remove every audit entry. */
export async function clearAuditLog(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM audit_log');
}
