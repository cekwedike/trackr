import { useLocalSearchParams } from 'expo-router';

import { ReminderForm } from '@/components/forms/reminder-form';
import { AppHeader, Screen, Text } from '@/components/ui';
import { getReminder } from '@/db/repos/reminders';
import { useAsyncData } from '@/hooks/use-async-data';

export default function EditReminder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsyncData(() => getReminder(Number(id)), [id]);

  if (loading) return null;
  if (!data) {
    return (
      <Screen>
        <AppHeader title="Reminder" back />
        <Text variant="body">Reminder not found.</Text>
      </Screen>
    );
  }

  return <ReminderForm initial={data} />;
}
