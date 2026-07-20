import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { ExpenseForm } from '@/components/forms/expense-form';
import { AppHeader, Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { addAttachment, type AttachmentEntity, deleteAttachment, listAttachments } from '@/db/repos/attachments';
import { getExpense } from '@/db/repos/expenses';
import type { Attachment } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { pickOrCaptureAttachmentImage } from '@/lib/attachments';

export default function EditExpense() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsyncData(() => getExpense(Number(id)), [id]);

  if (loading) return null;
  if (!data) {
    return (
      <Screen>
        <AppHeader title="Expense" back />
        <Text variant="body">Expense not found.</Text>
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ExpenseForm initial={data} />
      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.border,
          backgroundColor: t.background,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.xl,
        }}
      >
        <AttachmentsSection entity="expense" entityId={data.id} />
      </View>
    </View>
  );
}

const THUMB = 84;

/**
 * Photos/receipts attached to an expense. Thumbnails scroll horizontally;
 * "Add photo" offers camera or library and persists a private copy; tapping a
 * thumbnail confirms removal. Files live under the app document directory, so
 * they survive cache clears (see @/lib/attachments).
 */
function AttachmentsSection({ entity, entityId }: { entity: AttachmentEntity; entityId: number }) {
  const t = useTheme();
  const confirm = useConfirm();
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await listAttachments(entity, entityId));
  }, [entity, entityId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickOrCaptureAttachmentImage();
      if (picked) {
        await addAttachment(entity, entityId, picked.uri, picked.mime);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Attachment) => {
    const choice = await confirm({
      title: 'Remove photo',
      message: 'This will delete the attached photo.',
      actions: [
        { label: 'Remove', style: 'destructive', value: 'remove' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'remove') {
      await deleteAttachment(a.id);
      await refresh();
    }
  };

  return (
    <>
      <SectionHeader title="Attachments" subtitle={items.length ? `${items.length} photo${items.length === 1 ? '' : 's'}` : undefined} />
      <Card style={{ gap: Spacing.md }}>
        {items.length === 0 ? (
          <Text variant="caption" color={t.textMuted}>No photos yet. Add a receipt or photo for your records.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.sm, paddingVertical: 2 }}
          >
            {items.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => remove(a)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Image
                  source={{ uri: a.uri }}
                  style={{ width: THUMB, height: THUMB, borderRadius: Radius.md, backgroundColor: t.cardAlt }}
                  contentFit="cover"
                />
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: t.overlay,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Button title="Add photo" icon="image-outline" variant="secondary" onPress={add} loading={busy} />
      </Card>
    </>
  );
}
