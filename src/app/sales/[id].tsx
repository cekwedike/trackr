import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { AppHeader, Button, Card, Chip, DetailHero, Divider, IconButton, InfoRow, Screen, SectionHeader, Text } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { createSale, deleteSale, getSale, getSaleItems } from '@/db/repos/sales';
import { getCustomer } from '@/db/repos/customers';
import { addAttachment, type AttachmentEntity, deleteAttachment, listAttachments } from '@/db/repos/attachments';
import type { Attachment } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { pickAttachmentImage } from '@/lib/attachments';
import { formatDateTime } from '@/lib/date';
import { pressFeedback } from '@/lib/haptics';
import { printReceipt, saleToReceipt, shareReceipt } from '@/lib/receipt';

export default function SaleDetail() {
  const t = useTheme();
  const confirm = useConfirm();
  const { showUndo } = useUndo();
  const { money, settings, accent, currencySymbol, terms } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const saleId = Number(id);
  const [sharing, setSharing] = useState(false);

  const { data, loading } = useAsyncData(async () => {
    const sale = await getSale(saleId);
    if (!sale) return null;
    const items = await getSaleItems(saleId);
    const customer = sale.customer_id ? await getCustomer(sale.customer_id) : null;
    return { sale, items, customer };
  }, [saleId]);

  const remove = async () => {
    const choice = await confirm({
      title: 'Delete sale',
      message: 'This will permanently remove this sale record.',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      // Snapshot the sale + its line items before deleting so UNDO can re-create
      // it (a new id is acceptable). deleteSale reverses stock/debt; createSale
      // re-applies them, so the round-trip stays consistent.
      const snap = data?.sale;
      const snapItems = data?.items ?? [];
      await deleteSale(saleId);
      router.back();
      if (snap) {
        showUndo({
          message: 'Deleted sale',
          onUndo: () =>
            createSale({
              occurred_at: snap.occurred_at,
              payment_method: snap.payment_method,
              customer_id: snap.customer_id,
              note: snap.note,
              items: snapItems.map((it) => ({
                product_id: it.product_id,
                name: it.name,
                qty: it.qty,
                unit_price: it.unit_price,
                unit_cost: it.unit_cost,
              })),
            }),
        });
      }
    }
  };

  if (!data?.sale) {
    if (loading) return null;
    return (
      <Screen>
        <AppHeader title={terms.sale} back />
        <Text variant="body" color={t.textSecondary}>{terms.sale} not found.</Text>
      </Screen>
    );
  }

  const { sale, items, customer } = data;
  const profit = sale.total - sale.cost_total;

  const buildData = () =>
    saleToReceipt(sale, items, customer?.name, {
      businessName: settings?.business_name?.trim() || 'Trackr',
      currencySymbol,
      accent,
    });

  const onShare = async () => {
    pressFeedback();
    setSharing(true);
    try {
      await shareReceipt(buildData());
    } finally {
      setSharing(false);
    }
  };

  const onPrint = () => {
    pressFeedback();
    printReceipt(buildData());
  };

  const detailRows = [
    <InfoRow key="date" label="Date" value={formatDateTime(sale.occurred_at)} />,
    <InfoRow key="pay" label="Payment" value={PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method} />,
    customer ? <InfoRow key="cust" label="Customer" value={customer.name} onPress={() => router.push(`/customers/${customer.id}`)} /> : null,
    <InfoRow key="cogs" label="Est. cost (COGS)" value={money(sale.cost_total)} />,
    <InfoRow key="profit" label="Est. profit" right={<Chip label={money(profit)} tone={profit >= 0 ? 'success' : 'danger'} />} />,
    sale.note ? <InfoRow key="note" label="Note" value={sale.note} align="flex-start" /> : null,
  ].filter(Boolean);

  return (
    <Screen>
      <AppHeader title={customer?.name || terms.sale} back right={<IconButton icon="trash-outline" tone="danger" onPress={remove} />} />

      <DetailHero
        label="Total sale"
        value={money(sale.total)}
        valueColor={t.success}
        icon="cart"
        tone="success"
        meta={`${items.length} item${items.length === 1 ? '' : 's'} · ${formatDateTime(sale.occurred_at)}`}
      />

      <SectionHeader title="Details" />
      <Card style={{ marginBottom: Spacing.lg }}>
        {detailRows.map((row, idx) => (
          <View key={idx}>
            {row}
            {idx < detailRows.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>

      <SectionHeader title="Items" subtitle={`${items.length} line item${items.length === 1 ? '' : 's'}`} />
      <Card>
        {items.map((it, idx) => (
          <View key={it.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">{it.name}</Text>
                <Text variant="caption" color={t.textSecondary}>{it.qty} × {money(it.unit_price)}</Text>
              </View>
              <Text variant="body" weight="bold">{money(it.line_total)}</Text>
            </View>
            {idx < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>

      <View style={{ marginTop: Spacing.lg }}>
        <AttachmentsSection entity="sale" entityId={sale.id} />
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg }}>
        <Button title="Share receipt" icon="share-social-outline" onPress={onShare} loading={sharing} style={{ flex: 1 }} />
        <Button title="Print" variant="secondary" icon="print-outline" onPress={onPrint} style={{ flex: 1 }} />
      </View>

      <Button title="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: Spacing.sm }} />
    </Screen>
  );
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
  card: 'Card',
  pos: 'POS',
  credit: 'Credit',
  other: 'Other',
};

const THUMB = 84;

/**
 * Photos/receipts attached to a sale or expense. Thumbnails scroll horizontally;
 * "Add photo" picks from the library and persists a private copy; tapping a
 * thumbnail confirms removal. Files live under the app document directory, so
 * they survive cache clears (see @/lib/attachments).
 */
export function AttachmentsSection({ entity, entityId }: { entity: AttachmentEntity; entityId: number }) {
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
      const picked = await pickAttachmentImage();
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
