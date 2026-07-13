import { getDb } from '@/db/client';
import { createExpense } from '@/db/repos/expenses';
import type { RecurringRule } from '@/db/types';
import { dayjs, nowIso } from '@/lib/date';

export type Cadence = RecurringRule['cadence'];

/**
 * Given an ISO date and a cadence, returns the ISO string of the next occurrence:
 * daily = +1 day, weekly = +7 days, monthly = +1 calendar month (dayjs keeps the
 * day-of-month, clamping to the last day for shorter months).
 */
export function advanceCadence(dateISO: string, cadence: Cadence): string {
  const d = dayjs(dateISO);
  switch (cadence) {
    case 'daily':
      return d.add(1, 'day').toISOString();
    case 'weekly':
      return d.add(7, 'day').toISOString();
    case 'monthly':
    default:
      return d.add(1, 'month').toISOString();
  }
}

/**
 * Materialises every active recurring rule that is due (next_run <= now) into
 * real expenses. Each missed period since the last run is caught up: an expense
 * is inserted with `occurred_at` set to that period's due date, and `next_run`
 * is advanced until it lands in the future. Work for each rule runs inside its
 * own transaction and is wrapped in try/catch, so one malformed rule can never
 * block the others or break app startup. Returns the number of expenses created.
 */
export async function runDueRecurring(): Promise<number> {
  const db = await getDb();
  const now = nowIso();

  const dueRules = await db.getAllAsync<RecurringRule>(
    'SELECT * FROM recurring_rules WHERE active = 1 AND next_run <= ? ORDER BY next_run ASC',
    [now],
  );

  let created = 0;

  const nowMs = dayjs(now).valueOf();

  for (const rule of dueRules) {
    try {
      let inserted = 0;
      await db.withTransactionAsync(async () => {
        let due = rule.next_run;
        let lastRun = rule.last_run;
        let guard = 0;

        // Insert one expense per missed occurrence, advancing until the next
        // run is in the future. The guard caps runaway loops (e.g. a bad date).
        while (dayjs(due).valueOf() <= nowMs && guard < 1000) {
          await createExpense({
            occurred_at: due,
            amount: rule.amount,
            description: rule.description,
            category: rule.category,
            payment_method: rule.payment_method,
          });
          inserted += 1;
          lastRun = due;
          due = advanceCadence(due, rule.cadence);
          guard += 1;
        }

        await db.runAsync(
          'UPDATE recurring_rules SET next_run = ?, last_run = ?, updated_at = ? WHERE id = ?',
          [due, lastRun, nowIso(), rule.id],
        );
      });
      // Only count once the rule's transaction has committed successfully.
      created += inserted;
    } catch {
      // Swallow per-rule errors so a single bad rule can't block the rest.
    }
  }

  return created;
}
