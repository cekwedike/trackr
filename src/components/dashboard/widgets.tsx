import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AllocationDonut, AnimatedCounter, Aurora, DONUT_COLORS, GradientBackdrop, ProfitGauge, Sparkline, TiltCard, Waveform } from '@/components/anim';
import { AnimatedGrid } from '@/components/nav';
import { useConfirm } from '@/components/confirm';
import { HelpTip } from '@/components/help';
import { Card, Chip, Collapsible, ListRow, Text } from '@/components/ui';
import { useColumns } from '@/hooks/use-columns';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { QUICK_ACTION_META } from '@/constants/quick-actions';
import { useApp } from '@/context/app-context';
import { ORDER_STATUSES } from '@/db/repos/orders';
import { restockProduct } from '@/db/repos/products';
import type { DashboardData, RestockSuggestion } from '@/lib/dashboard-data';
import { hexToRgba, shade } from '@/lib/color';
import { formatDate, fromNow, rangeBounds, type RangeKey } from '@/lib/date';
import { formatQty } from '@/lib/money';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface WidgetProps {
  data: DashboardData;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  /** Reload the dashboard aggregation after an inline mutation (e.g. a restock). */
  reload?: () => void;
}

const WHITE = '#FFFFFF';

// ---------------------------------------------------------------- Collapsible section
function SeeAll({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text variant="label" color={t.primary}>{label}</Text>
    </Pressable>
  );
}

/** A dashboard section that can be collapsed/expanded; the choice is remembered per widget. */
function Section({
  id,
  title,
  icon,
  action,
  onAction,
  count,
  gap = Spacing.sm,
  card = true,
  children,
}: {
  id: string;
  title: string;
  icon?: IconName;
  action?: string;
  onAction?: () => void;
  count?: number | string;
  gap?: number;
  card?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      card={card}
      persistKey={`dash.${id}`}
      title={title}
      icon={icon}
      count={count}
      headerRight={action && onAction ? <SeeAll label={action} onPress={onAction} /> : undefined}
      style={{ marginBottom: Spacing.xl }}
      contentStyle={{ gap, paddingBottom: Spacing.md }}
    >
      {children}
    </Collapsible>
  );
}

// ---------------------------------------------------------------- Hero
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: hexToRgba(WHITE, 0.16),
        borderRadius: Radius.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
      }}
    >
      <Text variant="caption" color={hexToRgba(WHITE, 0.8)}>{label}</Text>
      <Text variant="subtitle" color={WHITE} weight="bold" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function HeroRevenue({ data, range }: WidgetProps) {
  const { money, settings, accent, industry } = useApp();
  const from = accent;
  const to = shade(accent, -0.4);
  const label = rangeBounds(range).label;

  return (
    <TiltCard intensity={6} lift={1.015} style={{ borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadow.lg }}>
      <GradientBackdrop from={from} to={to} id="hero" />
      <Aurora colors={[WHITE, from, to]} opacity={0.28} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Waveform color={WHITE} height={88} />
      </View>

      <View style={{ padding: Spacing.xl, gap: Spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={hexToRgba(WHITE, 0.8)}>Welcome back</Text>
            <Text variant="subtitle" color={WHITE} weight="bold" numberOfLines={1}>
              {settings?.business_name ?? 'Trackr'}
            </Text>
          </View>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: hexToRgba(WHITE, 0.2),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={industry.icon as IconName} size={22} color={WHITE} />
          </View>
        </View>

        <View>
          <Text variant="caption" color={hexToRgba(WHITE, 0.8)}>Revenue · {label}</Text>
          <AnimatedCounter value={data.revenue} format={money} variant="display" color={WHITE} weight="bold" />
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <HeroStat label="Expenses" value={money(data.expenses)} />
          <HeroStat label="Net profit" value={money(data.profit.netProfit)} />
        </View>
      </View>
    </TiltCard>
  );
}

// ---------------------------------------------------------------- Quick actions
function QuickActions() {
  const t = useTheme();
  const router = useRouter();
  const { industry, terms, accent } = useApp();
  // Compact dashboard: surface at most four actions; the rest live on the FAB.
  const actions = industry.quickActions.slice(0, 4);
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <AnimatedGrid
        data={actions}
        columns={2}
        keyExtractor={(key) => key}
        renderItem={(key) => {
          const a = QUICK_ACTION_META[key];
          if (!a) return null;
          return (
            <TiltCard
              onPress={() => router.push(a.href)}
              intensity={10}
              style={{
                alignItems: 'center',
                gap: Spacing.sm,
                paddingVertical: Spacing.lg,
                backgroundColor: t.card,
                borderRadius: Radius.lg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border,
                overflow: 'hidden',
                ...Shadow.sm,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: hexToRgba(accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={a.icon} size={22} color={accent} />
              </View>
              <Text variant="label" color={t.text}>{a.label(terms)}</Text>
            </TiltCard>
          );
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------- Profit pulse
function ProfitPulse({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money, accent } = useApp();
  const margin = data.revenue > 0 ? data.profit.netProfit / data.revenue : 0;
  const alloc = data.allocation;

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Text variant="label" color={t.textSecondary}>PROFIT</Text>
          <HelpTip
            title="Profit at a glance"
            subtitle="Margin and where profit goes"
            points={[
              { term: 'Net profit', desc: 'What’s left after cost of goods sold and expenses for the selected period.' },
              { term: 'Margin', desc: 'Net profit as a share of revenue. The dial fills up as your margin grows.' },
              { term: 'The profit split', desc: 'Your plan for dividing profit into buckets like savings, reinvesting and owner pay. The mini-ring previews it.' },
            ]}
            tip="Tap this card to open the Profit Calculator and edit your split."
          />
        </View>
        <Pressable onPress={() => router.push('/profit' as Href)} hitSlop={8}>
          <Text variant="label" color={t.primary}>Edit split</Text>
        </Pressable>
      </View>
      <TiltCard
        onPress={() => router.push('/profit' as Href)}
        intensity={6}
        style={{
          marginBottom: Spacing.lg,
          gap: Spacing.lg,
          backgroundColor: t.card,
          borderRadius: Radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          padding: Spacing.lg,
          overflow: 'hidden',
          ...Shadow.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }}>
          <ProfitGauge
            value={margin}
            size={116}
            color={accent}
            trackColor={t.border}
            centerTop={`${Math.round(margin * 100)}%`}
            centerBottom="margin"
          />
          <View style={{ flex: 1, gap: Spacing.sm }}>
            <View>
              <Text variant="caption" color={t.textSecondary}>Net profit</Text>
              <AnimatedCounter value={data.profit.netProfit} format={money} variant="title" color={data.profit.netProfit >= 0 ? t.success : t.danger} weight="bold" />
            </View>
            <View>
              <Text variant="caption" color={t.textSecondary}>Revenue</Text>
              <Text variant="body" weight="semibold">{money(data.revenue)}</Text>
            </View>
          </View>
        </View>

        {alloc.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }}>
            <AllocationDonut
              data={alloc.map((a) => ({ label: a.name, percent: a.percent }))}
              size={112}
              trackColor={t.border}
            />
            <View style={{ flex: 1, gap: Spacing.xs }}>
              {alloc.slice(0, 5).map((a, i) => (
                <View key={a.name} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <Text variant="caption" color={t.textSecondary} style={{ flex: 1 }} numberOfLines={1}>{a.name}</Text>
                  <Text variant="caption" weight="semibold">{money(Math.round((data.profit.netProfit * a.percent) / 100))}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </TiltCard>
    </>
  );
}

// ---------------------------------------------------------------- Stat grid
function MiniStat({ label, value, format, icon, tone, basis }: { label: string; value: number; format: (n: number) => string; icon: IconName; tone: string; basis: string }) {
  const t = useTheme();
  return (
    <Card style={{ flexBasis: basis as any, flexGrow: 1, gap: Spacing.sm }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: hexToRgba(tone, 0.14), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <AnimatedCounter value={value} format={format} variant="subtitle" weight="bold" />
      <Text variant="caption" color={t.textSecondary} numberOfLines={1}>{label}</Text>
    </Card>
  );
}

function StatGrid({ data }: WidgetProps) {
  const t = useTheme();
  const { money, terms, accent } = useApp();
  const cols = useColumns(2, 3);
  const basis = cols >= 3 ? '31%' : '47%';
  const num = (n: number) => String(n);

  const stats: { label: string; value: number; format: (n: number) => string; icon: IconName; tone: string }[] = [
    { label: 'Revenue', value: data.revenue, format: money, icon: 'trending-up', tone: t.success },
    { label: 'Expenses', value: data.expenses, format: money, icon: 'trending-down', tone: t.danger },
    { label: 'Net profit', value: data.profit.netProfit, format: money, icon: 'cash', tone: accent },
    { label: terms.sales, value: data.salesCount, format: num, icon: 'receipt', tone: t.info },
    { label: `Active ${terms.orders.toLowerCase()}`, value: data.activeOrders, format: num, icon: 'clipboard', tone: t.warning },
    { label: 'Owed to you', value: data.debts, format: money, icon: 'wallet', tone: t.warning },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg }}>
      {stats.map((s) => (
        <MiniStat key={s.label} label={s.label} value={s.value} format={s.format} icon={s.icon} tone={s.tone} basis={basis} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Orders pipeline
function orderBalance(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

function OrdersPipeline({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money, terms } = useApp();
  const active = data.orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const counts = ORDER_STATUSES.filter((s) => s.value !== 'delivered' && s.value !== 'cancelled').map((s) => ({
    label: s.label,
    count: active.filter((o) => o.status === s.value).length,
  }));

  return (
    <Section id="pipeline" title={terms.orders} icon="clipboard-outline" action="See all" onAction={() => router.push('/orders' as Href)} gap={Spacing.md}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
        {counts.map((c) => (
          <Chip key={c.label} label={`${c.label} · ${c.count}`} />
        ))}
      </View>
      {active.length === 0 ? (
        <Text variant="caption" color={t.textSecondary}>No open {terms.orders.toLowerCase()} right now.</Text>
      ) : (
        active.slice(0, 4).map((o) => (
          <ListRow
            key={o.id}
            title={o.customer_name || terms.order}
            subtitle={o.due_at ? `Due ${fromNow(o.due_at)}` : ORDER_STATUSES.find((s) => s.value === o.status)?.label}
            right={<Text variant="body" weight="semibold" color={orderBalance(o.total, o.amount_paid) > 0 ? t.warning : t.success}>{money(orderBalance(o.total, o.amount_paid))}</Text>}
            onPress={() => router.push(`/orders/${o.id}` as Href)}
          />
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Appointments / upcoming
function AppointmentsToday({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { terms } = useApp();
  const upcoming = data.orders
    .filter((o) => o.due_at && o.status !== 'delivered' && o.status !== 'cancelled')
    .sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1))
    .slice(0, 5);

  return (
    <Section id="appointments" title={`Upcoming ${terms.orders.toLowerCase()}`} icon="time-outline" action="See all" onAction={() => router.push('/orders' as Href)}>
      {upcoming.length === 0 ? (
        <Text variant="caption" color={t.textSecondary}>Nothing scheduled. Enjoy the calm.</Text>
      ) : (
        upcoming.map((o) => (
          <ListRow
            key={o.id}
            icon="time-outline"
            title={o.customer_name || terms.order}
            subtitle={formatDate(o.due_at)}
            right={<Text variant="caption" color={t.textSecondary}>{fromNow(o.due_at)}</Text>}
            onPress={() => router.push(`/orders/${o.id}` as Href)}
          />
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Restock (low stock)
/** A single low-stock product row with an inline "Restock" action. */
function RestockRow({ item, busy, onRestock }: { item: RestockSuggestion; busy: boolean; onRestock: () => void }) {
  const router = useRouter();
  const { product, suggested } = item;
  const out = product.stock <= 0;
  return (
    <ListRow
      icon={out ? 'alert-circle' : 'cube-outline'}
      iconTone={out ? 'danger' : 'warning'}
      title={product.name}
      subtitle={`${formatQty(product.stock)} / ${formatQty(product.low_stock_threshold)} ${product.unit} · reorder ${formatQty(suggested)}`}
      onPress={() => router.push(`/products/${product.id}` as Href)}
      right={<Chip label={busy ? 'Adding…' : `Restock +${formatQty(suggested)}`} tone="primary" icon="add" onPress={onRestock} />}
    />
  );
}

function LowStockAlerts({ data, reload }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<number | null>(null);

  const products = data.restock;
  const ingredients = data.lowIngredients;
  const total = products.length + ingredients.length;

  const onRestock = async (item: RestockSuggestion) => {
    const { product, suggested } = item;
    const choice = await confirm({
      title: `Restock ${product.name}?`,
      message: `Add ${formatQty(suggested)} ${product.unit} to bring stock back above the ${formatQty(product.low_stock_threshold)} ${product.unit} threshold.`,
      actions: [
        { label: `Add ${formatQty(suggested)} ${product.unit}`, style: 'default', value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'ok') return;
    setBusyId(product.id);
    try {
      await restockProduct(product.id, suggested);
      reload?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section id="lowStock" title="Restock" icon="cart-outline" count={total || undefined} action="Manage" onAction={() => router.push('/inventory' as Href)}>
      {total === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Ionicons name="checkmark-circle" size={18} color={t.success} />
          <Text variant="caption" color={t.textSecondary}>All stocked up — nothing to reorder.</Text>
        </View>
      ) : (
        <>
          {products.slice(0, 5).map((item) => (
            <RestockRow key={`p${item.product.id}`} item={item} busy={busyId === item.product.id} onRestock={() => onRestock(item)} />
          ))}
          {ingredients.slice(0, Math.max(0, 5 - products.length)).map((i) => (
            <ListRow
              key={`i${i.id}`}
              icon="flask-outline"
              iconTone="warning"
              title={i.name}
              subtitle={`${formatQty(i.qty_on_hand)} / ${formatQty(i.reorder_threshold)} ${i.unit} · reorder`}
              onPress={() => router.push(`/ingredients/${i.id}` as Href)}
            />
          ))}
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Production queue
function ProductionQueue({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { industry } = useApp();
  return (
    <Section id="production" title={industry.terms.productionLabel} icon="reader-outline" action="See all" onAction={() => router.push('/recipes' as Href)}>
      {data.recipes.length === 0 ? (
        <Pressable onPress={() => router.push('/recipes/new' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs }}>
          <Ionicons name="add-circle-outline" size={20} color={t.primary} />
          <Text variant="caption" color={t.textSecondary}>Add your first {industry.terms.productionLabel.toLowerCase()} to track costs.</Text>
        </Pressable>
      ) : (
        data.recipes.slice(0, 5).map((r) => (
          <ListRow key={r.id} icon="reader-outline" title={r.name} subtitle={`Yields ${r.yield_qty}`} onPress={() => router.push(`/recipes/${r.id}` as Href)} />
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Best sellers
function BestSellers({ data }: WidgetProps) {
  const t = useTheme();
  const { money } = useApp();
  return (
    <Section id="bestSellers" title="Top sellers" icon="ribbon-outline">
      {data.best.length === 0 ? (
        <Text variant="caption" color={t.textSecondary}>No sales in this period yet.</Text>
      ) : (
        data.best.map((b, i) => (
          <ListRow
            key={`${b.name}-${i}`}
            title={b.name}
            subtitle={`${b.qty} sold`}
            right={<Text variant="body" weight="semibold" color={t.success}>{money(b.revenue)}</Text>}
          />
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Clients snapshot
function ClientsSnapshot({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money, terms, accent } = useApp();
  return (
    <Section id="clients" title={terms.customers} icon="people-outline" action="See all" onAction={() => router.push('/customers' as Href)} card={false}>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Card style={{ flex: 1, gap: Spacing.xs }}>
          <Ionicons name="people" size={20} color={accent} />
          <AnimatedCounter value={data.customers.length} format={(n) => String(n)} variant="title" weight="bold" />
          <Text variant="caption" color={t.textSecondary}>Total {terms.customers.toLowerCase()}</Text>
        </Card>
        <Card style={{ flex: 1, gap: Spacing.xs }}>
          <Ionicons name="wallet" size={20} color={t.warning} />
          <AnimatedCounter value={data.debts} format={money} variant="title" weight="bold" />
          <Text variant="caption" color={t.textSecondary}>Owed to you</Text>
        </Card>
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------- Debts owed
function DebtsOwed({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money } = useApp();
  const debtors = data.customers.filter((c) => c.debt_balance > 0).sort((a, b) => b.debt_balance - a.debt_balance).slice(0, 4);
  return (
    <Section id="debts" title="Owed to you" icon="wallet-outline" action="See all" onAction={() => router.push('/customers' as Href)}>
      {debtors.length === 0 ? (
        <Text variant="caption" color={t.textSecondary}>No outstanding debts. Nice.</Text>
      ) : (
        debtors.map((c) => (
          <ListRow
            key={c.id}
            icon="person-outline"
            title={c.name}
            right={<Text variant="body" weight="semibold" color={t.warning}>{money(c.debt_balance)}</Text>}
            onPress={() => router.push(`/customers/${c.id}` as Href)}
          />
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Reminders
function UpcomingReminders({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Section id="reminders" title="Reminders" icon="alarm-outline" action="See all" onAction={() => router.push('/reminders' as Href)}>
      {data.reminders.length === 0 ? (
        <Text variant="caption" color={t.textSecondary}>No upcoming reminders.</Text>
      ) : (
        data.reminders.map((r) => (
          <ListRow key={r.id} icon="alarm-outline" title={r.title} subtitle={fromNow(r.due_at)} />
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Expenses breakdown
function ExpensesBreakdown({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money } = useApp();
  const series = data.trend.map((p) => p.expenses);
  return (
    <Section id="expenses" title="Expenses trend" icon="trending-down-outline" action="See all" onAction={() => router.push('/expenses' as Href)} gap={Spacing.md}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text variant="caption" color={t.textSecondary}>This period</Text>
          <Text variant="title" weight="bold" color={t.danger}>{money(data.expenses)}</Text>
        </View>
        <Text variant="caption" color={t.textMuted}>Last 6 months</Text>
      </View>
      <Sparkline data={series.length ? series : [0, 0]} color={t.danger} height={52} />
    </Section>
  );
}

// ---------------------------------------------------------------- Cash ledger (general)
function CashLedger({ data }: WidgetProps) {
  const t = useTheme();
  const { money, accent } = useApp();
  const series = data.trend.map((p) => p.profit);
  const balance = data.revenue - data.expenses;
  return (
    <Section id="ledger" title="Cash book" icon="book-outline" gap={Spacing.md}>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={t.textSecondary}>Money in</Text>
          <Text variant="subtitle" weight="bold" color={t.success}>{money(data.revenue)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={t.textSecondary}>Money out</Text>
          <Text variant="subtitle" weight="bold" color={t.danger}>{money(data.expenses)}</Text>
        </View>
      </View>
      <View>
        <Text variant="caption" color={t.textSecondary}>Balance</Text>
        <AnimatedCounter value={balance} format={money} variant="display" weight="bold" color={balance >= 0 ? t.text : t.danger} />
      </View>
      <Sparkline data={series.length ? series : [0, 0]} color={accent} height={54} />
    </Section>
  );
}

export const WIDGET_COMPONENTS: Record<string, React.FC<WidgetProps>> = {
  hero: HeroRevenue,
  quickActions: QuickActions as React.FC<WidgetProps>,
  profit: ProfitPulse,
  stats: StatGrid,
  pipeline: OrdersPipeline,
  appointments: AppointmentsToday,
  lowStock: LowStockAlerts,
  production: ProductionQueue,
  bestSellers: BestSellers,
  clients: ClientsSnapshot,
  debts: DebtsOwed,
  reminders: UpcomingReminders,
  expenses: ExpensesBreakdown,
  ledger: CashLedger,
};
