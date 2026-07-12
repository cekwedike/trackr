import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AllocationDonut, AnimatedCounter, Aurora, DONUT_COLORS, GradientBackdrop, ProfitGauge, Sparkline, TiltCard, Waveform } from '@/components/anim';
import { AnimatedGrid } from '@/components/nav';
import { Card, Chip, ListRow, SectionHeader, Text } from '@/components/ui';
import { useColumns } from '@/hooks/use-columns';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { QUICK_ACTION_META } from '@/constants/quick-actions';
import { useApp } from '@/context/app-context';
import { ORDER_STATUSES } from '@/db/repos/orders';
import type { DashboardData } from '@/lib/dashboard-data';
import { hexToRgba, shade } from '@/lib/color';
import { formatDate, fromNow, rangeBounds, type RangeKey } from '@/lib/date';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface WidgetProps {
  data: DashboardData;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
}

const WHITE = '#FFFFFF';
const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

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

function HeroRevenue({ data, range, setRange }: WidgetProps) {
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

        <View
          style={{
            flexDirection: 'row',
            backgroundColor: hexToRgba(WHITE, 0.16),
            borderRadius: Radius.pill,
            padding: 3,
          }}
        >
          {RANGES.map((r) => {
            const active = r.value === range;
            return (
              <Pressable
                key={r.value}
                onPress={() => setRange(r.value)}
                style={{
                  flex: 1,
                  paddingVertical: Spacing.xs + 2,
                  borderRadius: Radius.pill,
                  alignItems: 'center',
                  backgroundColor: active ? WHITE : 'transparent',
                }}
              >
                <Text variant="label" color={active ? accent : hexToRgba(WHITE, 0.9)}>{r.label}</Text>
              </Pressable>
            );
          })}
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
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <AnimatedGrid
        data={industry.quickActions}
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
      <SectionHeader title="Profit" action="Edit split" onAction={() => router.push('/profit' as Href)} />
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
    <>
      <SectionHeader title={terms.orders} action="See all" onAction={() => router.push('/orders' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.md }}>
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
              title={o.customer_name || `${terms.order} #${o.id}`}
              subtitle={o.due_at ? `Due ${fromNow(o.due_at)}` : ORDER_STATUSES.find((s) => s.value === o.status)?.label}
              right={<Text variant="body" weight="semibold" color={orderBalance(o.total, o.amount_paid) > 0 ? t.warning : t.success}>{money(orderBalance(o.total, o.amount_paid))}</Text>}
              onPress={() => router.push(`/orders/${o.id}` as Href)}
            />
          ))
        )}
      </Card>
    </>
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
    <>
      <SectionHeader title={`Upcoming ${terms.orders.toLowerCase()}`} action="See all" onAction={() => router.push('/orders' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
        {upcoming.length === 0 ? (
          <Text variant="caption" color={t.textSecondary}>Nothing scheduled. Enjoy the calm.</Text>
        ) : (
          upcoming.map((o) => (
            <ListRow
              key={o.id}
              icon="time-outline"
              title={o.customer_name || `${terms.order} #${o.id}`}
              subtitle={formatDate(o.due_at)}
              right={<Text variant="caption" color={t.textSecondary}>{fromNow(o.due_at)}</Text>}
              onPress={() => router.push(`/orders/${o.id}` as Href)}
            />
          ))
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Low stock
function LowStockAlerts({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { terms } = useApp();
  const items = [
    ...data.lowProducts.map((p) => ({ id: `p${p.id}`, name: p.name, qty: `${p.stock} ${p.unit}`, href: `/products/${p.id}` })),
    ...data.lowIngredients.map((i) => ({ id: `i${i.id}`, name: i.name, qty: `${i.qty_on_hand} ${i.unit}`, href: `/ingredients/${i.id}` })),
  ];

  return (
    <>
      <SectionHeader title={`${terms.inventoryLabel} alerts`} action="Manage" onAction={() => router.push('/products' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
        {items.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Ionicons name="checkmark-circle" size={18} color={t.success} />
            <Text variant="caption" color={t.textSecondary}>All stocked up — no low items.</Text>
          </View>
        ) : (
          items.slice(0, 5).map((it) => (
            <ListRow
              key={it.id}
              icon="alert-circle-outline"
              title={it.name}
              subtitle={`${it.qty} left`}
              iconTone="warning"
              onPress={() => router.push(it.href as Href)}
            />
          ))
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Production queue
function ProductionQueue({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { industry } = useApp();
  return (
    <>
      <SectionHeader title={industry.terms.productionLabel} action="See all" onAction={() => router.push('/recipes' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
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
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Best sellers
function BestSellers({ data }: WidgetProps) {
  const t = useTheme();
  const { money } = useApp();
  return (
    <>
      <SectionHeader title="Top sellers" />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
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
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Clients snapshot
function ClientsSnapshot({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money, terms, accent } = useApp();
  return (
    <>
      <SectionHeader title={terms.customers} action="See all" onAction={() => router.push('/customers' as Href)} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
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
    </>
  );
}

// ---------------------------------------------------------------- Debts owed
function DebtsOwed({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money } = useApp();
  const debtors = data.customers.filter((c) => c.debt_balance > 0).sort((a, b) => b.debt_balance - a.debt_balance).slice(0, 4);
  return (
    <>
      <SectionHeader title="Owed to you" action="See all" onAction={() => router.push('/customers' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
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
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Reminders
function UpcomingReminders({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  return (
    <>
      <SectionHeader title="Reminders" action="See all" onAction={() => router.push('/reminders' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
        {data.reminders.length === 0 ? (
          <Text variant="caption" color={t.textSecondary}>No upcoming reminders.</Text>
        ) : (
          data.reminders.map((r) => (
            <ListRow key={r.id} icon="alarm-outline" title={r.title} subtitle={fromNow(r.due_at)} />
          ))
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Expenses breakdown
function ExpensesBreakdown({ data }: WidgetProps) {
  const t = useTheme();
  const router = useRouter();
  const { money } = useApp();
  const series = data.trend.map((p) => p.expenses);
  return (
    <>
      <SectionHeader title="Expenses trend" action="See all" onAction={() => router.push('/expenses' as Href)} />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text variant="caption" color={t.textSecondary}>This period</Text>
            <Text variant="title" weight="bold" color={t.danger}>{money(data.expenses)}</Text>
          </View>
          <Text variant="caption" color={t.textMuted}>Last 6 months</Text>
        </View>
        <Sparkline data={series.length ? series : [0, 0]} color={t.danger} height={52} />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Cash ledger (general)
function CashLedger({ data }: WidgetProps) {
  const t = useTheme();
  const { money, accent } = useApp();
  const series = data.trend.map((p) => p.profit);
  const balance = data.revenue - data.expenses;
  return (
    <>
      <SectionHeader title="Cash book" />
      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.md }}>
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
      </Card>
    </>
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
