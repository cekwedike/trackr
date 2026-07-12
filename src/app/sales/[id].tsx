import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { AppHeader, Button, Card, Chip, Divider, IconButton, Screen, SectionHeader, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { deleteSale, getSale, getSaleItems } from '@/db/repos/sales';
import { getCustomer } from '@/db/repos/customers';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/date';

export default function SaleDetail() {
  const t = useTheme();
  const { money } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const saleId = Number(id);

  const { data } = useAsyncData(async () => {
    const sale = await getSale(saleId);
    if (!sale) return null;
    const items = await getSaleItems(saleId);
    const customer = sale.customer_id ? await getCustomer(sale.customer_id) : null;
    return { sale, items, customer };
  }, [saleId]);

  const remove = () => {
    Alert.alert('Delete sale', 'This will permanently remove this sale record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSale(saleId);
          router.back();
        },
      },
    ]);
  };

  if (!data?.sale) {
    return (
      <Screen>
        <AppHeader title="Sale" back />
        <Text variant="body" color={t.textSecondary}>Sale not found.</Text>
      </Screen>
    );
  }

  const { sale, items, customer } = data;
  const profit = sale.total - sale.cost_total;

  return (
    <Screen>
      <AppHeader title={`Sale #${sale.id}`} back right={<IconButton icon="trash-outline" tone="danger" onPress={remove} />} />

      <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color={t.textSecondary}>Total</Text>
          <Text variant="title" color={t.success}>{money(sale.total)}</Text>
        </View>
        <Divider />
        <Row label="Date" value={formatDateTime(sale.occurred_at)} />
        <Row label="Payment" value={sale.payment_method} />
        {customer ? <Row label="Customer" value={customer.name} /> : null}
        <Row label="Est. cost (COGS)" value={money(sale.cost_total)} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="caption" color={t.textSecondary}>Est. profit</Text>
          <Chip label={money(profit)} tone={profit >= 0 ? 'success' : 'danger'} />
        </View>
        {sale.note ? <Row label="Note" value={sale.note} /> : null}
      </Card>

      <SectionHeader title="Items" />
      <Card>
        {items.map((it, idx) => (
          <View key={it.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="medium">{it.name}</Text>
                <Text variant="caption" color={t.textSecondary}>{it.qty} × {money(it.unit_price)}</Text>
              </View>
              <Text variant="body" weight="semibold">{money(it.line_total)}</Text>
            </View>
            {idx < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>

      <Button title="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: Spacing.lg }} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="caption" color={t.textSecondary}>{label}</Text>
      <Text variant="body" weight="medium" style={{ flexShrink: 1, textAlign: 'right', marginLeft: Spacing.md }}>{value}</Text>
    </View>
  );
}
