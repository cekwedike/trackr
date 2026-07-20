import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { AppHeader, Card, Chip, EmptyState, FAB, IconButton, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { createReminder, deleteReminder, getReminder, listReminders, setReminderCompleted } from '@/db/repos/reminders';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, fromNow } from '@/lib/date';
import { cancelReminder } from '@/lib/notifications';

const RECUR_LABEL: Record<string, string> = { none: 'Once', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function RemindersScreen() {
  const t = useTheme();
  const confirm = useConfirm();
  const { showUndo } = useUndo();
  const { data, reload } = useAsyncData(() => listReminders(true), []);

  const complete = async (id: number, done: boolean) => {
    await setReminderCompleted(id, done);
    if (done) {
      const r = await getReminder(id);
      await cancelReminder(r?.notification_id);
    }
    reload();
  };

  const remove = async (id: number) => {
    const choice = await confirm({
      title: 'Delete reminder',
      message: 'Remove this reminder?',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'delete') return;
    // Snapshot the reminder before deleting so UNDO can re-create it (new id).
    // Best-effort: the scheduled OS notification is cancelled on delete and is
    // not re-scheduled on restore (notification_id cleared), matching how the
    // list re-creates records without touching notifications.
    const snap = await getReminder(id);
    await cancelReminder(snap?.notification_id);
    await deleteReminder(id);
    reload();
    if (snap) {
      showUndo({
        message: 'Deleted reminder',
        onUndo: async () => {
          await createReminder({
            title: snap.title,
            body: snap.body,
            due_at: snap.due_at,
            recurrence: snap.recurrence,
            notification_id: null,
            target_type: snap.target_type,
            target_id: snap.target_id,
          });
          reload();
        },
      });
    }
  };

  const active = (data ?? []).filter((r) => r.completed === 0);
  const done = (data ?? []).filter((r) => r.completed === 1);

  return (
    <>
      <Screen>
        <AppHeader title="Reminders" back />
        {active.length === 0 && done.length === 0 ? (
          <EmptyState icon="alarm-outline" title="No reminders" message="Get notified for restocks, payments and follow-ups." actionLabel="Add reminder" onAction={() => router.push('/reminders/new')} />
        ) : (
          <>
            {active.map((r) => (
              <Card key={r.id} style={{ marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <Pressable onPress={() => complete(r.id, true)}>
                  <Ionicons name="ellipse-outline" size={24} color={t.textMuted} />
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/reminders/${r.id}`)}>
                  <Text variant="body" weight="semibold">{r.title}</Text>
                  <Text variant="caption" color={t.textSecondary}>{formatDateTime(r.due_at)} · {fromNow(r.due_at)}</Text>
                </Pressable>
                {r.recurrence !== 'none' ? <Chip label={RECUR_LABEL[r.recurrence]} tone="primary" /> : null}
                <IconButton icon="create-outline" tone="primary" size={18} onPress={() => router.push(`/reminders/${r.id}`)} />
                <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => remove(r.id)} />
              </Card>
            ))}
            {done.length > 0 ? (
              <>
                <Text variant="label" color={t.textSecondary} style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>COMPLETED</Text>
                {done.map((r) => (
                  <Card key={r.id} style={{ marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, opacity: 0.6 }}>
                    <Pressable onPress={() => complete(r.id, false)}>
                      <Ionicons name="checkmark-circle" size={24} color={t.success} />
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => router.push(`/reminders/${r.id}`)}>
                      <Text variant="body" style={{ textDecorationLine: 'line-through' }}>{r.title}</Text>
                    </Pressable>
                    <IconButton icon="create-outline" tone="primary" size={18} onPress={() => router.push(`/reminders/${r.id}`)} />
                    <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => remove(r.id)} />
                  </Card>
                ))}
              </>
            ) : null}
          </>
        )}
      </Screen>
      <FAB label="Reminder" onPress={() => router.push('/reminders/new')} />
    </>
  );
}
