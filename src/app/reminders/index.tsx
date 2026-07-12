import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { AppHeader, Card, Chip, EmptyState, FAB, IconButton, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteReminder, getReminder, listReminders, setReminderCompleted } from '@/db/repos/reminders';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, fromNow } from '@/lib/date';
import { cancelReminder } from '@/lib/notifications';

const RECUR_LABEL: Record<string, string> = { none: 'Once', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function RemindersScreen() {
  const t = useTheme();
  const { data, reload } = useAsyncData(() => listReminders(true), []);

  const complete = async (id: number, done: boolean) => {
    await setReminderCompleted(id, done);
    if (done) {
      const r = await getReminder(id);
      await cancelReminder(r?.notification_id);
    }
    reload();
  };

  const remove = (id: number) => {
    Alert.alert('Delete reminder', 'Remove this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await getReminder(id);
          await cancelReminder(r?.notification_id);
          await deleteReminder(id);
          reload();
        },
      },
    ]);
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
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">{r.title}</Text>
                  <Text variant="caption" color={t.textSecondary}>{formatDateTime(r.due_at)} · {fromNow(r.due_at)}</Text>
                </View>
                {r.recurrence !== 'none' ? <Chip label={RECUR_LABEL[r.recurrence]} tone="primary" /> : null}
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
                    <View style={{ flex: 1 }}>
                      <Text variant="body" style={{ textDecorationLine: 'line-through' }}>{r.title}</Text>
                    </View>
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
