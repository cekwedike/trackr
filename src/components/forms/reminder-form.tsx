import { router } from 'expo-router';
import { useState } from 'react';

import { useAlert } from '@/components/confirm';
import { Button, Card, AppHeader, Screen, Text, TextField } from '@/components/ui';
import { DateTimeField, SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { createReminder, updateReminder } from '@/db/repos/reminders';
import type { Recurrence, Reminder } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/errors';
import { cancelReminder, scheduleReminder } from '@/lib/notifications';

const RECURRENCE: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

export function ReminderForm({ initial, onDone }: { initial?: Reminder; onDone?: () => void }) {
  const t = useTheme();
  const alert = useAlert();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [due, setDue] = useState(() => (initial ? new Date(initial.due_at) : new Date(Date.now() + 60 * 60 * 1000)));
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'none');
  const [recModal, setRecModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const finish = () => {
    if (onDone) onDone();
    else router.back();
  };

  const save = async () => {
    if (!title.trim()) {
      void alert({ title: 'Title required', message: 'Please enter a reminder title.' });
      return;
    }
    setSaving(true);
    const oldNotificationId = initial?.notification_id ?? null;
    let scheduledId: string | null = null;
    try {
      const shouldNotify = !initial || initial.completed === 0;

      // Schedule the new alert first so a failed schedule never drops the old one.
      if (shouldNotify) {
        scheduledId = await scheduleReminder(title.trim(), body.trim(), due, recurrence);
      }

      // Keep the previous OS notification if reschedule failed (permission / OS error)
      // and this isn’t a clearly past one-shot. Completed reminders clear the id.
      const pastOnce = recurrence === 'none' && due.getTime() <= Date.now();
      const notificationId = shouldNotify
        ? (scheduledId ?? (pastOnce ? null : oldNotificationId))
        : null;

      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        due_at: due.toISOString(),
        recurrence,
        notification_id: notificationId,
        target_type: initial?.target_type,
        target_id: initial?.target_id,
      };

      try {
        if (initial) await updateReminder(initial.id, payload);
        else await createReminder(payload);
      } catch (dbErr) {
        // Roll back the newly scheduled alert if the DB write failed.
        if (scheduledId) await cancelReminder(scheduledId);
        throw dbErr;
      }

      // DB succeeded — cancel the previous alert only when it was replaced or cleared.
      if (oldNotificationId && oldNotificationId !== notificationId) {
        await cancelReminder(oldNotificationId);
      }

      if (!scheduledId && shouldNotify && pastOnce) {
        void alert({ title: 'Saved', message: 'Reminder saved, but the time is in the past so no notification was scheduled.' });
      }
      finish();
    } catch (e) {
      void alert({ title: 'Couldn’t save', message: toUserMessage(e, 'Couldn’t save this reminder. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit reminder' : 'New reminder'} back />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Restock flour" autoFocus={!initial} />
        <TextField label="Details" value={body} onChangeText={setBody} placeholder="Optional" multiline />
        <DateTimeField label="When" value={due} onChange={setDue} />
        <SelectField label="Repeat" value={RECURRENCE.find((r) => r.value === recurrence)?.label} onPress={() => setRecModal(true)} />
      </Card>
      <Text variant="caption" color={t.textMuted} style={{ marginTop: Spacing.md }}>
        You&apos;ll get a phone notification at the set time.
      </Text>
      <Button
        title={initial ? 'Save changes' : 'Set reminder'}
        icon={initial ? 'checkmark' : 'alarm'}
        onPress={save}
        loading={saving}
        size="lg"
        style={{ marginTop: Spacing.lg }}
      />

      <SelectModal
        visible={recModal}
        title="Repeat"
        searchable={false}
        onClose={() => setRecModal(false)}
        onSelect={(id) => setRecurrence(id as Recurrence)}
        options={RECURRENCE.map((r) => ({ id: r.value, label: r.label }))}
      />
    </Screen>
  );
}
