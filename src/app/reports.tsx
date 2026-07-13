import { router } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { PressableScale } from '@/components/anim/pressable';
import { HelpTip } from '@/components/help';
import {
  AppHeader,
  Card,
  CardList,
  Chip,
  Divider,
  EmptyState,
  Screen,
  SectionHeader,
  Segmented,
  StatCard,
  Text,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import {
  monthlySeries,
  periodTotals,
  topCustomers,
  topProducts,
  type MonthlySeriesPoint,
  type TopProductSort,
} from '@/db/repos/reports';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import {
  buildBarChart,
  buildProfitLine,
  formatCompactMoney,
  formatSignedPercent,
  hasSeriesData,
  monthlyDeltas,
  periodRange,
  REPORT_PERIODS,
  type Delta,
  type ReportPeriod,
} from '@/lib/reports';

const MONTHS_TREND = 6;

export default function ReportsScreen() {
  const t = useTheme();
  const { money, currencySymbol, terms } = useApp();
  const reduced = useReducedMotion();
  const [period, setPeriod] = useState<ReportPeriod>('this');
  const [productSort, setProductSort] = useState<TopProductSort>('revenue');

  const { data } = useAsyncData(async () => {
    const series = await monthlySeries(MONTHS_TREND);
    const { start, end, label } = periodRange(period);
    const [products, customers, totals] = await Promise.all([
      topProducts(start, end, 5, productSort),
      topCustomers(start, end, 5),
      periodTotals(start, end),
    ]);
    return { series, products, customers, totals, periodLabel: label };
  }, [period, productSort]);

  const series = data?.series ?? [];
  const deltas = monthlyDeltas(series);
  const showCharts = hasSeriesData(series);
  const thisMonthLabel = series[series.length - 1]?.label ?? '';

  return (
    <Screen>
      <AppHeader
        title="Reports"
        subtitle="Trends, top performers & receivables"
        back
        right={
          <HelpTip
            title="Understanding your reports"
            subtitle="What each section means"
            paragraphs={[
              'Reports summarise your recorded sales and expenses so you can spot trends at a glance. All figures are cash-basis — they count in the month you dated them, matching the Profit Calculator.',
            ]}
            points={[
              { term: 'Revenue vs Expenses', desc: 'Money in (sales) against money out (expenses) for each of the last 6 months.' },
              { term: 'Profit trend', desc: 'Net profit per month (revenue − COGS − expenses). It can dip below zero on a loss month.' },
              { term: 'MoM delta', desc: 'The percentage change this month versus last month — up or down.' },
              { term: 'Top products / customers', desc: 'Your best sellers and highest-spending customers for the selected period.' },
            ]}
            tip="Use the period selector to focus the top lists on this month, last month, or a longer window."
          />
        }
      />

      {/* Key stats — this month vs last month */}
      <SectionHeader title="This month" subtitle={thisMonthLabel ? `${thisMonthLabel} vs previous month` : undefined} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <StatCard
          style={{ flex: 1 }}
          label="Revenue"
          value={money(deltas.revenue.current)}
          icon="trending-up"
          tone="success"
          sub={deltaLabel(deltas.revenue)}
        />
        <StatCard
          style={{ flex: 1 }}
          label="Expenses"
          value={money(deltas.expenses.current)}
          icon="trending-down"
          tone="danger"
          sub={deltaLabel(deltas.expenses)}
        />
      </View>
      <StatCard
        style={{ marginBottom: Spacing.lg }}
        label="Net profit"
        value={money(deltas.profit.current)}
        icon="wallet"
        tone={deltas.profit.current >= 0 ? 'primary' : 'danger'}
        sub={deltaLabel(deltas.profit)}
      />

      {/* Revenue vs Expenses */}
      <SectionHeader title={`Revenue vs Expenses (${MONTHS_TREND} months)`} />
      <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
        {showCharts ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Text variant="caption" color={t.textMuted}>
                max {formatCompactMoney(buildBarChart(series, 1, 1).max, currencySymbol)}
              </Text>
            </View>
            <RevenueExpensesChart series={series} />
            <View style={{ flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' }}>
              <Legend color={t.success} label="Revenue" />
              <Legend color={t.danger} label="Expenses" />
            </View>
          </>
        ) : (
          <Text variant="caption" color={t.textMuted}>
            Record sales and expenses to see your monthly revenue and expense bars here.
          </Text>
        )}
      </Card>

      {/* Profit trend */}
      <SectionHeader title="Profit trend" />
      <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
        {showCharts ? (
          <>
            <ProfitTrendChart series={series} />
            <View style={{ flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' }}>
              <Legend color={t.primary} label="Net profit" />
            </View>
          </>
        ) : (
          <Text variant="caption" color={t.textMuted}>
            Once you have sales and expenses, your monthly net-profit line appears here.
          </Text>
        )}
      </Card>

      {/* Period selector for the lists / totals below */}
      <View style={{ marginBottom: Spacing.lg }}>
        <Segmented value={period} onChange={setPeriod} options={REPORT_PERIODS} scroll />
      </View>

      {/* Period totals */}
      {data ? (
        <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="label" color={t.textSecondary}>{data.periodLabel.toUpperCase()}</Text>
            <Chip
              label={`${data.totals.salesCount} ${data.totals.salesCount === 1 ? 'sale' : 'sales'}`}
              tone="primary"
              icon="receipt-outline"
            />
          </View>
          <TotalRow label="Revenue" value={money(data.totals.revenue)} color={t.success} />
          <TotalRow label="Expenses" value={`- ${money(data.totals.expenses)}`} color={t.danger} />
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm }}>
            <Text variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>Net profit</Text>
            <Text variant="subtitle" color={data.totals.netProfit >= 0 ? t.success : t.danger} numberOfLines={1}>
              {money(data.totals.netProfit)}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Top products */}
      <SectionHeader title="Top products" />
      <View style={{ marginBottom: Spacing.sm }}>
        <Segmented
          value={productSort}
          onChange={setProductSort}
          options={[
            { value: 'revenue', label: 'By revenue' },
            { value: 'qty', label: 'By quantity' },
          ]}
        />
      </View>
      {data && data.products.length > 0 ? (
        <CardList
          style={{ marginBottom: Spacing.lg }}
          data={data.products}
          stagger={!reduced}
          keyExtractor={(p) => p.name}
          renderItem={(p, idx) => (
            <RankRow
              rank={idx + 1}
              title={p.name}
              subtitle={`${formatQtyLocal(p.qty)} sold`}
              value={money(p.revenue)}
              valueColor={t.success}
            />
          )}
        />
      ) : (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <RowNote text="No product sales in this period." />
        </Card>
      )}

      {/* Top customers */}
      <SectionHeader title={`Top ${terms.customers.toLowerCase()}`} />
      {data && data.customers.length > 0 ? (
        <CardList
          data={data.customers}
          stagger={!reduced}
          keyExtractor={(c) => c.id}
          renderItem={(c, idx) => (
            <RankRow
              rank={idx + 1}
              title={c.name}
              subtitle={`${c.salesCount} ${c.salesCount === 1 ? 'sale' : 'sales'}`}
              value={money(c.total)}
              onPress={() => router.push(`/customers/${c.id}`)}
            />
          )}
        />
      ) : (
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
          <RowNote text={`No ${terms.customers.toLowerCase()} with sales in this period.`} />
        </Card>
      )}

      {!showCharts && data ? (
        <View style={{ marginTop: Spacing.lg }}>
          <EmptyState
            icon="bar-chart-outline"
            title="No data to report yet"
            message="Record a few sales and expenses and your trends, top performers and profit will appear here."
          />
        </View>
      ) : null}

      <View style={{ height: Spacing.xl }} />
      <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center' }}>
        Cash-basis figures — amounts count in the month you dated them, matching the Profit Calculator.
      </Text>
    </Screen>
  );
}

// ---------- Charts ----------

/** Grouped revenue/expense bars, sized to the measured container width. */
function RevenueExpensesChart({ series, height = 150 }: { series: MonthlySeriesPoint[]; height?: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const layout = buildBarChart(series, width, height);

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            {layout.groups.map((g) =>
              g.bars.map((b, i) => (
                <Rect
                  key={`${g.key}-${i}`}
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height={b.height}
                  rx={3}
                  fill={b.series === 'revenue' ? t.success : t.danger}
                />
              )),
            )}
            <Line x1={0} y1={height} x2={width} y2={height} stroke={t.border} strokeWidth={1} />
          </Svg>
          <AxisLabels series={series} />
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

/** Net-profit line with a soft fill toward the zero baseline (handles losses). */
function ProfitTrendChart({ series, height = 140 }: { series: MonthlySeriesPoint[]; height?: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const layout = buildProfitLine(series, width, height);

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.primary} stopOpacity={0.24} />
                <Stop offset="1" stopColor={t.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* zero baseline */}
            <Line
              x1={0}
              y1={layout.zeroY}
              x2={width}
              y2={layout.zeroY}
              stroke={t.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {layout.areaPath ? <Path d={layout.areaPath} fill="url(#profitArea)" /> : null}
            {layout.linePath ? (
              <Path
                d={layout.linePath}
                stroke={t.primary}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {layout.points.map((p) => (
              <Circle
                key={p.key}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={p.value >= 0 ? t.primary : t.danger}
                stroke={t.card}
                strokeWidth={1.5}
              />
            ))}
          </Svg>
          <AxisLabels series={series} />
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

/** Evenly spaced month labels beneath a chart (matches equal-width groups). */
function AxisLabels({ series }: { series: MonthlySeriesPoint[] }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginTop: Spacing.xs }}>
      {series.map((p) => (
        <View key={p.key} style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="caption" color={t.textMuted} numberOfLines={1}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- Small building blocks ----------

function RankRow({
  rank,
  title,
  subtitle,
  value,
  valueColor,
  onPress,
}: {
  rank: number;
  title: string;
  subtitle: string;
  value: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: Radius.sm,
          backgroundColor: t.cardAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="label" color={t.textSecondary}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" weight="semibold" numberOfLines={1}>{title}</Text>
        <Text variant="caption" color={t.textSecondary} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text variant="body" weight="semibold" color={valueColor}>{value}</Text>
    </View>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.98} opacityTo={0.7}>
        {inner}
      </PressableScale>
    );
  }
  return inner;
}

function TotalRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm }}>
      <Text variant="body" color={t.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
      <Text variant="body" weight="semibold" color={color} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RowNote({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: Spacing.md }}>
      <Text variant="caption" color={t.textMuted}>{text}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" color={t.textSecondary}>{label}</Text>
    </View>
  );
}

function deltaLabel(d: Delta): string {
  return `${formatSignedPercent(d.percent)} vs last month`;
}

function formatQtyLocal(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
}
