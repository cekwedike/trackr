/**
 * Operations hub — open pipeline, due soon, restock, reminders, recurring, exports.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { FadeSlide } from '@/components/anim';
import { useConfirm } from '@/components/confirm';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  Text,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listOrders, ORDER_STATUSES } from '@/db/repos/orders';
import { listLowStockProducts, restockProduct, suggestedReorder } from '@/db/repos/products';
import { upcomingReminders } from '@/db/repos/reminders';
import { listRecurringRules } from '@/db/repos/recurring';
import type { Product } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { dayjs, formatDate, fromNow } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import {
  exportCustomersCsv,
  exportExpensesCsv,
  exportInventoryCsv,
  exportOrdersCsv,
  exportSalesCsv,
} from '@/lib/export-csv';
import { formatQty } from '@/lib/money';

export default function OperationsScreen() {
  const t = useTheme();
  const { money, terms } = useApp();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const { data, reload } = useAsyncData(async () => {
    const [orders, lowStock, reminders, recurring] = await Promise.all([
      listOrders(),
      listLowStockProducts(),
      upcomingReminders(6),
      listRecurringRules(),
    ]);
    const open = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    const dueSoon = open
      .filter((o) => o.due_at)
      .sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1))
      .slice(0, 6);
    const activeRecurring = recurring.filter((r) => r.active === 1);
    return { open, dueSoon, lowStock, reminders, activeRecurring };
  }, []);

  const onRestock = async (p: Product) => {
    const qty = suggestedReorder(p);
    const choice = await confirm({
      title: `Restock ${p.name}?`,
      message: `Add ${formatQty(qty)} ${p.unit} to bring stock back above the ${formatQty(p.low_stock_threshold)} ${p.unit} threshold.`,
      actions: [
        { label: `Add ${formatQty(qty)} ${p.unit}`, value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'ok') return;
    setBusyId(p.id);
    try {
      await restockProduct(p.id, qty);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const runExport = async (key: string, fn: () => Promise<{ count: number }>) => {
    setExporting(key);
    try {
      const res = await fn();
      if (res.count === 0) {
        Alert.alert('Nothing to export', 'Add a few records first, then export again.');
      }
    } catch (e) {
      Alert.alert('Export failed', toUserMessage(e, 'Couldn’t export. Please try again.'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen>
      <AppHeader title="Operations" subtitle="Pipeline, restock & follow-ups" back />

      <FadeSlide>
        <SectionHeader
          title={`Open ${terms.orders.toLowerCase()}`}
          subtitle={data ? `${data.open.length} active` : undefined}
        />
        {data && data.open.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
            {data.open.slice(0, 5).map((o, idx) => {
              const status = ORDER_STATUSES.find((s) => s.value === o.status)?.label ?? o.status;
              return (
                <View key={o.id}>
                  <ListRow
                    icon="clipboard"
                    iconTone="warning"
                    title={o.customer_name || terms.order}
                    subtitle={`${money(o.total)}${o.due_at ? ` · due ${formatDate(o.due_at)}` : ''}`}
                    onPress={() => router.push(`/orders/${o.id}`)}
                    right={<Chip label={status} tone="warning" />}
                  />
                  {idx < Math.min(data.open.length, 5) - 1 ? <Divider /> : null}
                </View>
              );
            })}
            <Divider />
            <ListRow
              icon="list"
              iconTone="primary"
              title={`All ${terms.orders.toLowerCase()}`}
              onPress={() => router.push('/orders')}
            />
          </Card>
        ) : (
          <Card style={{ marginBottom: Spacing.lg }}>
            <EmptyState
              icon="clipboard-outline"
              title={`No open ${terms.orders.toLowerCase()}`}
              message={`Track work from request to delivery.`}
              actionLabel={`New ${terms.order.toLowerCase()}`}
              onAction={() => router.push('/orders/new')}
              secondaryLabel="Export CSV later"
              onSecondary={() => runExport('orders', exportOrdersCsv)}
              compact
            />
          </Card>
        )}
      </FadeSlide>

      <SectionHeader title="Due soon" />
      {data && data.dueSoon.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          {data.dueSoon.map((o, idx) => {
            const overdue = o.due_at && dayjs(o.due_at).isBefore(dayjs(), 'day');
            return (
              <View key={o.id}>
                <ListRow
                  icon="calendar"
                  iconTone={overdue ? 'danger' : 'primary'}
                  title={o.customer_name || terms.order}
                  subtitle={formatDate(o.due_at)}
                  onPress={() => router.push(`/orders/${o.id}`)}
                  right={
                    <Text variant="caption" color={overdue ? t.danger : t.textSecondary}>
                      {fromNow(o.due_at)}
                    </Text>
                  }
                />
                {idx < data.dueSoon.length - 1 ? <Divider /> : null}
              </View>
            );
          })}
        </Card>
      ) : (
        <Card style={{ marginBottom: Spacing.lg }}>
          <Text variant="caption" color={t.textMuted}>
            Set due dates on {terms.orders.toLowerCase()} to see what’s coming up.
          </Text>
        </Card>
      )}

      <SectionHeader title="Needs restock" />
      {data && data.lowStock.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          {data.lowStock.slice(0, 6).map((p, idx) => (
            <View key={p.id}>
              <ListRow
                icon="cube"
                iconTone="warning"
                title={p.name}
                subtitle={`${formatQty(p.stock)} / ${formatQty(p.low_stock_threshold)} ${p.unit}`}
                onPress={() => router.push(`/products/${p.id}`)}
                right={
                  <Chip
                    label={busyId === p.id ? 'Adding…' : `+${formatQty(suggestedReorder(p))}`}
                    tone="warning"
                    icon="add"
                    onPress={() => onRestock(p)}
                  />
                }
              />
              {idx < Math.min(data.lowStock.length, 6) - 1 ? <Divider /> : null}
            </View>
          ))}
          <Divider />
          <ListRow
            icon="cube"
            iconTone="primary"
            title={terms.inventoryLabel}
            onPress={() => router.push('/inventory')}
          />
        </Card>
      ) : (
        <Card style={{ marginBottom: Spacing.lg }}>
          <Text variant="caption" color={t.textMuted}>
            All stocked up — or set low-stock thresholds on your {terms.items.toLowerCase()}.
          </Text>
        </Card>
      )}

      <SectionHeader title="Reminders" />
      {data && data.reminders.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          {data.reminders.map((r, idx) => (
            <View key={r.id}>
              <ListRow
                icon="alarm"
                iconTone="primary"
                title={r.title}
                subtitle={fromNow(r.due_at)}
                onPress={() => router.push('/reminders')}
              />
              {idx < data.reminders.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>
      ) : (
        <Card style={{ marginBottom: Spacing.lg }}>
          <EmptyState
            icon="alarm-outline"
            title="No upcoming reminders"
            message="Set a reminder so nothing slips."
            actionLabel="Add reminder"
            onAction={() => router.push('/reminders/new')}
            compact
          />
        </Card>
      )}

      <SectionHeader title="Recurring bills" subtitle={data ? `${data.activeRecurring.length} active` : undefined} />
      <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
        <ListRow
          icon="repeat"
          iconTone="warning"
          title="Manage recurring expenses"
          subtitle="Auto-log rent, utilities and subscriptions"
          onPress={() => router.push('/recurring' as Href)}
        />
      </Card>

      <SectionHeader title="Export" subtitle="CSV for spreadsheets" />
      <Card style={{ gap: Spacing.sm, marginBottom: Spacing.xl }}>
        <Button
          title="Export sales"
          icon="download-outline"
          variant="secondary"
          loading={exporting === 'sales'}
          onPress={() => runExport('sales', exportSalesCsv)}
        />
        <Button
          title="Export expenses"
          icon="download-outline"
          variant="secondary"
          loading={exporting === 'expenses'}
          onPress={() => runExport('expenses', exportExpensesCsv)}
        />
        <Button
          title={`Export ${terms.orders.toLowerCase()}`}
          icon="download-outline"
          variant="secondary"
          loading={exporting === 'orders'}
          onPress={() => runExport('orders', exportOrdersCsv)}
        />
        <Button
          title="Export inventory"
          icon="download-outline"
          variant="secondary"
          loading={exporting === 'inventory'}
          onPress={() => runExport('inventory', exportInventoryCsv)}
        />
        <Button
          title={`Export ${terms.customers.toLowerCase()}`}
          icon="download-outline"
          variant="secondary"
          loading={exporting === 'customers'}
          onPress={() => runExport('customers', exportCustomersCsv)}
        />
      </Card>
    </Screen>
  );
}
