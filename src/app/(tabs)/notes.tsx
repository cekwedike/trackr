import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, Card, EmptyState, FAB, ListRow, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { createNote, listNotes } from '@/db/repos/notes';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { fromNow } from '@/lib/date';

export default function NotesScreen() {
  const t = useTheme();
  const [search, setSearch] = useState('');
  const { data } = useAsyncData(() => listNotes(search), [search]);

  const create = async () => {
    const id = await createNote({ title: 'Untitled', body: '' });
    router.push(`/notes/${id}`);
  };

  const preview = (body: string) => body.replace(/[#*_>`\-\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

  return (
    <>
      <Screen>
        <AppHeader title="Notes" subtitle="Your business notebook" />
        <TextField value={search} onChangeText={setSearch} placeholder="Search notes..." style={{ marginBottom: Spacing.lg }} />
        {data && data.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {data.map((n, idx) => (
              <View key={n.id}>
                <ListRow
                  icon={n.pinned ? 'bookmark' : 'document-text'}
                  iconTone={n.pinned ? 'warning' : 'primary'}
                  title={n.title}
                  subtitle={preview(n.body) || fromNow(n.updated_at)}
                  onPress={() => router.push(`/notes/${n.id}`)}
                  right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />}
                />
                {idx < data.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="document-text-outline" title="No notes yet" message="Jot down recipes, ideas and supplier info — and attach them to customers, products or orders." actionLabel="New note" onAction={create} />
        )}
      </Screen>
      <FAB icon="add" label="Note" onPress={create} />
    </>
  );
}
