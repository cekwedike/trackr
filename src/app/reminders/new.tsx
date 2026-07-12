import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, AppHeader, Screen, Text, TextField } from '@/components/ui';
import { DateTimeField, SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { createReminder } from '@/db/repos/reminders';
import type { Recurrence } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { scheduleReminder } from '@/lib/notifications';

const RECURRENCE: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

export default function NewReminder() {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [recModal, setRecModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a reminder title.');
      return;
    }
    setSaving(true);
    try {
      const notificationId = await scheduleReminder(title.trim(), body.trim(), due, recurrence);
      await createReminder({
        title: title.trim(),
        body: body.trim() || null,
        due_at: due.toISOString(),
        recurrence,
        notification_id: notificationId,
      });
      if (!notificationId && recurrence === 'none' && due.getTime() <= Date.now()) {
        Alert.alert('Saved', 'Reminder saved, but the time is in the past so no notification was scheduled.');
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="New reminder" back />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Restock flour" autoFocus />
        <TextField label="Details" value={body} onChangeText={setBody} placeholder="Optional" multiline />
        <DateTimeField label="When" value={due} onChange={setDue} />
        <SelectField label="Repeat" value={RECURRENCE.find((r) => r.value === recurrence)?.label} onPress={() => setRecModal(true)} />
      </Card>
      <Text variant="caption" color={t.textMuted} style={{ marginTop: Spacing.md }}>
        You&apos;ll get a phone notification at the set time.
      </Text>
      <Button title="Set reminder" icon="alarm" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />

      <SelectModal visible={recModal} title="Repeat" searchable={false} onClose={() => setRecModal(false)} onSelect={(id) => setRecurrence(id as Recurrence)} options={RECURRENCE.map((r) => ({ id: r.value, label: r.label }))} />
    </Screen>
  );
}
