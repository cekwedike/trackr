import { router } from 'expo-router';
import { View } from 'react-native';

import { FadeSlide, SkeletonList } from '@/components/anim';
import { MovableFab } from '@/components/nav';
import { AppHeader, Card, Chip, EmptyState, ListRow, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listSales } from '@/db/repos/sales';
import { useAsyncData } from '@/hooks/use-async-data';
import { useFabActions } from '@/hooks/use-fab-actions';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/date';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
  card: 'Card',
  pos: 'POS',
  credit: 'Credit',
  other: 'Other',
};

export default function SalesScreen() {
  const t = useTheme();
  const { money, terms } = useApp();
  const { data } = useAsyncData(() => listSales(), []);
  const fabActions = useFabActions(['sale', 'expense', 'customer']);

  const total = (data ?? []).reduce((s, x) => s + x.total, 0);

  return (
    <>
      <Screen>
        <AppHeader title={terms.sales} subtitle={data ? `${data.length} recorded · ${money(total)}` : undefined} />
        {!data ? (
          <SkeletonList rows={7} />
        ) : data.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {data.map((s, idx) => (
              <FadeSlide key={s.id} delay={Math.min(idx * 45, 360)}>
                <ListRow
                  icon="cart"
                  iconTone="success"
                  title={s.customer_name ? `${s.customer_name}` : `${terms.sale} #${s.id}`}
                  subtitle={`${formatDateTime(s.occurred_at)} · ${s.item_count} item(s)`}
                  onPress={() => router.push(`/sales/${s.id}`)}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text variant="body" weight="bold" color={t.success}>{money(s.total)}</Text>
                      <Chip label={METHOD_LABEL[s.payment_method] ?? s.payment_method} tone={s.payment_method === 'credit' ? 'warning' : 'default'} />
                    </View>
                  }
                />
                {idx < data.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </FadeSlide>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon="cart-outline"
            title={`No ${terms.sales.toLowerCase()} yet`}
            message={`Record your first ${terms.sale.toLowerCase()} to start tracking revenue.`}
            actionLabel={`Record a ${terms.sale.toLowerCase()}`}
            onAction={() => router.push('/sales/new')}
          />
        )}
      </Screen>
      <MovableFab actions={fabActions} storageKey="sales" />
    </>
  );
}
