import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { createNote } from '@/db/repos/notes';
import { toUserMessage } from '@/lib/errors';

/**
 * FAB / quick-action entry: create a blank note and open the editor.
 * Mirrors other `/…/new` routes that the shared quick-action metadata targets.
 */
export default function NewNoteScreen() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const id = await createNote({ title: '', body: '', note_type: 'text' });
        router.replace(`/notes/${id}`);
      } catch (e) {
        router.replace('/notes');
        console.warn('Could not create note', toUserMessage(e));
      }
    })();
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="body">Creating note…</Text>
      </View>
    </Screen>
  );
}
