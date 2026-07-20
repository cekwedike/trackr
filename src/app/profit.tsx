import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AllocationDonut, DONUT_COLORS, FadeSlide, Stagger } from '@/components/anim';
import { useConfirm } from '@/components/confirm';
import { HelpTip } from '@/components/help';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
  Text,
  TextField,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { getIndustry } from '@/constants/industries';
import { useApp } from '@/context/app-context';
import { sumExpenses } from '@/db/repos/expenses';
import { getProfitRecord, listProfitRecords, setProfitRecordLocked, upsertProfitRecord } from '@/db/repos/profit';
import { sumSales } from '@/db/repos/sales';
import { updateSettings } from '@/db/repos/settings';
import type { AllocationBucket, AllocationSlice, ProfitRecord } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import {
  allocationTotal,
  computeProfit,
  currentMonthKey,
  formatMonthKey,
  formatMonthKeyShort,
  isCurrentOrPastMonth,
  monthBounds,
  parseAllocation,
  parseAllocationSlices,
  realizedProfit,
  shiftMonthKey,
  splitAllocation,
} from '@/lib/profit';

interface DraftBucket {
  name: string;
  percent: string;
}

function toBuckets(draft: DraftBucket[]): AllocationBucket[] {
  return draft.map((d) => ({ name: d.name.trim() || 'Untitled', percent: parseFloat(d.percent) || 0 }));
}

function toDraft(buckets: { name: string; percent: number }[]): DraftBucket[] {
  return buckets.map((b) => ({ name: b.name, percent: String(b.percent) }));
}

export default function ProfitScreen() {
  const t = useTheme();
  const confirm = useConfirm();
  const { settings, money, reloadSettings, industry, accent } = useApp();
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftBucket[]>(() => toDraft(parseAllocation(settings?.profit_allocation)));
  const seedRef = useRef<string>('');

  const { data, reload } = useAsyncData(async () => {
    const { start, end } = monthBounds(monthKey);
    const sales = await sumSales(start, end);
    const expenses = await sumExpenses(start, end);
    const summary = computeProfit(sales.revenue, sales.cogs, expenses);
    const record = await getProfitRecord(monthKey);
    const history = await listProfitRecords();
    return { summary, record, history };
  }, [monthKey]);

  // Seed the editable buckets once per (month, saved-version). This preserves the
  // user's in-progress edits across focus reloads, but refreshes when the month
  // changes or the saved snapshot is updated.
  useEffect(() => {
    if (!data) return;
    const sig = `${monthKey}:${data.record?.updated_at ?? 'none'}`;
    if (sig === seedRef.current) return;
    seedRef.current = sig;
    const seed: { name: string; percent: number }[] = data.record
      ? parseAllocationSlices(data.record.allocation)
      : parseAllocation(settings?.profit_allocation);
    setDraft(toDraft(seed.length > 0 ? seed : parseAllocation(settings?.profit_allocation)));
    setEditing(false);
  }, [data, monthKey, settings?.profit_allocation]);

  const summary = data?.summary;
  const net = summary?.netProfit ?? 0;
  const realized = realizedProfit(net);
  const buckets = useMemo(() => toBuckets(draft), [draft]);
  const total = useMemo(() => allocationTotal(buckets), [buckets]);
  const balanced = Math.round(total) === 100;
  const split = useMemo(() => splitAllocation(realized, buckets), [realized, buckets]);

  const nextKey = shiftMonthKey(monthKey, 1);
  const canGoNext = isCurrentOrPastMonth(nextKey);
  const isCurrent = monthKey === currentMonthKey();
  const record = data?.record ?? null;

  const goPrev = () => setMonthKey((k) => shiftMonthKey(k, -1));
  const goNext = () => {
    if (canGoNext) setMonthKey((k) => shiftMonthKey(k, 1));
  };

  const updateBucket = (idx: number, patch: Partial<DraftBucket>) =>
    setDraft((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  const addBucket = () => setDraft((prev) => [...prev, { name: '', percent: '0' }]);
  const removeBucket = (idx: number) => setDraft((prev) => prev.filter((_, i) => i !== idx));

  const distributeEvenly = () => {
    setDraft((prev) => {
      if (prev.length === 0) return prev;
      const base = Math.floor(100 / prev.length);
      const remainder = 100 - base * prev.length;
      return prev.map((b, i) => ({ ...b, percent: String(base + (i === 0 ? remainder : 0)) }));
    });
  };

  const loadIndustryDefault = async () => {
    const choice = await confirm({
      title: `Use ${industry.name} template?`,
      message:
        'This replaces the buckets below with the recommended split. Nothing is saved until you record the month.',
      actions: [
        { label: 'Use template', value: 'use' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'use') {
      setDraft(toDraft(getIndustry(settings?.industry).defaultAllocation.map((b) => ({ ...b }))));
    }
  };

  const copyPreviousMonth = async () => {
    const prevKey = shiftMonthKey(monthKey, -1);
    const prev = await getProfitRecord(prevKey);
    if (!prev) {
      Alert.alert('Nothing to copy', `No recorded split for ${formatMonthKey(prevKey)} yet.`);
      return;
    }
    const slices = parseAllocationSlices(prev.allocation);
    if (slices.length === 0) {
      Alert.alert('Nothing to copy', `${formatMonthKey(prevKey)} has no allocation buckets.`);
      return;
    }
    setDraft(slices.map((s) => ({ name: s.name, percent: String(s.percent) })));
  };

  const recordMonth = async () => {
    if (!balanced) {
      Alert.alert('Allocation must total 100%', `Your buckets currently add up to ${round1(total)}%.`);
      return;
    }
    if (record?.locked === 1) {
      Alert.alert('Month locked', 'Unlock this month before updating the recorded close.');
      return;
    }
    const cleanBuckets = toBuckets(draft);
    const slices = splitAllocation(realized, cleanBuckets);
    try {
      await upsertProfitRecord({
        month: monthKey,
        revenue: summary?.revenue ?? 0,
        cogs: summary?.cogs ?? 0,
        expenses: summary?.expenses ?? 0,
        net_profit: net,
        allocation: JSON.stringify(slices),
      });
    } catch (e) {
      Alert.alert('Couldn’t save', toUserMessage(e, 'Couldn’t record this month. Please try again.'));
      return;
    }
    // Only the current month updates the global starting template for future months.
    if (isCurrent) {
      await updateSettings({ profit_allocation: JSON.stringify(cleanBuckets) });
      await reloadSettings();
    }
    seedRef.current = ''; // force reseed from the freshly saved snapshot
    await reload();
    setEditing(false);
    Alert.alert('Recorded', `${formatMonthKey(monthKey)} saved to your profit history.`);
  };

  const toggleLock = async () => {
    if (!record) {
      Alert.alert('Record first', 'Save this month’s profit snapshot before locking it.');
      return;
    }
    const next = record.locked !== 1;
    if (next) {
      const choice = await confirm({
        title: `Close ${formatMonthKey(monthKey)}?`,
        message: 'Locking prevents accidental overwrites. You can unlock later if you need to revise.',
        actions: [
          { label: 'Lock month', value: 'lock' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (choice !== 'lock') return;
    }
    await setProfitRecordLocked(monthKey, next);
    await reload();
  };

  return (
    <Screen>
      <AppHeader title="Profit Calculator" subtitle="Cash-basis monthly profit & allocation" back />

      {/* Month selector */}
      <Card style={{ marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon="chevron-back" onPress={goPrev} tone="primary" size={20} />
          <View style={{ alignItems: 'center' }}>
            <Text variant="subtitle" color={accent}>{formatMonthKey(monthKey)}</Text>
            <Text variant="caption" color={t.textMuted}>
              {isCurrent ? 'Current month' : record ? 'Recorded' : 'Not yet recorded'}
            </Text>
          </View>
          <IconButton
            icon="chevron-forward"
            onPress={goNext}
            tone={canGoNext ? 'primary' : undefined}
            color={canGoNext ? undefined : t.textMuted}
            size={20}
          />
        </View>
      </Card>

      {/* Income statement */}
      <FadeSlide>
        <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Text variant="label" color={t.textSecondary}>INCOME STATEMENT</Text>
              <HelpTip
                title="Reading your income statement"
                subtitle="How Trackr works out profit"
                points={[
                  { term: 'Revenue', desc: 'All the money your sales brought in for the month.' },
                  { term: 'Cost of goods sold (COGS)', desc: 'What the items you sold cost you to make or buy — the direct cost of each sale.' },
                  { term: 'Gross profit', desc: 'Revenue − COGS. What’s left after covering the cost of what you sold, before other bills.' },
                  { term: 'Operating expenses', desc: 'Your running costs like rent, transport and salaries.' },
                  { term: 'Net profit', desc: 'Gross profit − expenses. Your true bottom line for the month.' },
                  { term: 'Realized (distributable) profit', desc: 'The profit you can actually share out. If the month broke even or lost money, this is zero — you can’t distribute money you didn’t make.' },
                ]}
                tip="Trackr uses cash-basis figures: amounts count in the month you dated them."
              />
            </View>
            {record ? (
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                <Chip
                  label={record.locked === 1 ? 'Locked' : `Saved ${formatDate(record.updated_at)}`}
                  tone={record.locked === 1 ? 'warning' : 'success'}
                  icon={record.locked === 1 ? 'lock-closed' : 'checkmark-circle'}
                />
              </View>
            ) : null}
          </View>
          <Row label="Revenue (sales income)" value={money(summary?.revenue ?? 0)} color={t.success} />
          <Row label="Cost of goods sold (COGS)" value={`- ${money(summary?.cogs ?? 0)}`} />
          <Divider />
          <Row label="Gross profit" value={money(summary?.grossProfit ?? 0)} bold />
          <Row label="Operating expenses" value={`- ${money(summary?.expenses ?? 0)}`} color={t.danger} />
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm }}>
            <Text variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>Net profit</Text>
            <Text variant="title" color={net >= 0 ? t.success : t.danger} numberOfLines={1}>{money(net)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
            <Chip
              label={`${round1((summary?.margin ?? 0) * 100)}% net margin`}
              tone={net > 0 ? 'success' : net < 0 ? 'danger' : 'default'}
            />
            {net <= 0 ? <Chip label="No distributable profit" tone="warning" icon="alert-circle" /> : null}
          </View>
          <Text variant="caption" color={t.textMuted}>
            Gross profit = revenue − COGS. Net profit = gross profit − operating expenses. Profit is only realized and
            distributable when income exceeds expenditure (net profit above zero).
          </Text>
        </Card>
      </FadeSlide>

      {/* Allocation */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Text variant="label" color={t.textSecondary}>PROFIT ALLOCATION</Text>
          <HelpTip
            title="How profit allocation works"
            subtitle="Give every unit of profit a job"
            paragraphs={[
              'Allocation is your plan for splitting each month’s profit into "buckets" — like reinvesting in the business, savings, an emergency fund or your own pay.',
              'Give each bucket a percentage. The percentages must add up to 100%. Trackr then shows the exact amount that goes to each bucket based on your realized profit.',
            ]}
            points={[
              { term: 'Buckets', desc: 'Named pots of money you want to fund, e.g. Savings or Reinvest.' },
              { term: 'Percent (%)', desc: 'The share of profit each bucket receives. All buckets together must total 100%.' },
              { term: 'Recording a month', desc: 'Saves that month’s profit and split to your history. Recording the current month also sets your default split going forward.' },
            ]}
            tip="Try the industry template, an even split, or copy last month to start fast."
          />
        </View>
        <Pressable onPress={() => { if (record?.locked !== 1) setEditing((v) => !v); }} hitSlop={8}>
          <Text variant="label" color={record?.locked === 1 ? t.textMuted : t.primary}>
            {record?.locked === 1 ? 'Locked' : editing ? 'Done' : 'Edit split'}
          </Text>
        </Pressable>
      </View>

      <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
        {editing ? (
          <>
            <Text variant="caption" color={t.textSecondary}>
              Define where each month&apos;s profit goes. Percentages must total 100%.
            </Text>
            {draft.map((b, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' }}>
                <TextField
                  style={{ flex: 2 }}
                  label={idx === 0 ? 'Bucket' : undefined}
                  value={b.name}
                  onChangeText={(v) => updateBucket(idx, { name: v })}
                  placeholder="e.g. Savings"
                />
                <TextField
                  style={{ flex: 1 }}
                  label={idx === 0 ? '%' : undefined}
                  value={b.percent}
                  onChangeText={(v) => updateBucket(idx, { percent: sanitizePercent(v) })}
                  keyboardType="numeric"
                  placeholder="0"
                />
                <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => removeBucket(idx)} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button title="Add bucket" icon="add" variant="ghost" size="sm" onPress={addBucket} />
              <Chip
                label={balanced ? 'Balanced 100%' : `${round1(total)}% of 100%`}
                tone={balanced ? 'success' : 'danger'}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
              <Button title="Even split" icon="git-compare" variant="ghost" size="sm" onPress={distributeEvenly} />
              <Button title={`${industry.name} template`} icon="sparkles" variant="ghost" size="sm" onPress={loadIndustryDefault} />
              <Button title="Copy last month" icon="copy" variant="ghost" size="sm" onPress={copyPreviousMonth} />
            </View>
            <Button
              title={record ? 'Update recorded month' : `Record ${formatMonthKeyShort(monthKey)}`}
              icon="save"
              onPress={recordMonth}
              disabled={!balanced}
            />
          </>
        ) : (
          <>
            {net <= 0 ? (
              <Text variant="caption" color={t.textSecondary}>
                There is no realized profit to distribute for {formatMonthKey(monthKey)}. Your targets below are shown at
                their percentages; amounts appear once the month turns a net profit.
              </Text>
            ) : (
              <Text variant="caption" color={t.textSecondary}>
                Distributing {money(realized)} of realized net profit across your buckets.
              </Text>
            )}
            {buckets.length > 0 ? (
              <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
                <AllocationDonut data={buckets.map((b) => ({ label: b.name, percent: b.percent }))} size={156} trackColor={t.border} />
              </View>
            ) : null}
            <Stagger>
              {split.map((s, idx) => (
                <View key={idx}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                      <Text variant="body" numberOfLines={1}>{s.name}</Text>
                      <Text variant="caption" color={t.textMuted}>{round1(s.percent)}%</Text>
                    </View>
                    <Text variant="body" weight="semibold" color={realized > 0 ? t.text : t.textMuted}>{money(s.amount)}</Text>
                  </View>
                  {idx < split.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Stagger>
            {!balanced ? (
              <Chip label={`Heads up: buckets total ${round1(total)}%, not 100%`} tone="warning" icon="alert-circle" />
            ) : null}
            <Button
              title={record ? 'Update recorded month' : `Record ${formatMonthKeyShort(monthKey)}`}
              icon="save"
              variant={record ? 'secondary' : 'primary'}
              onPress={() => (balanced ? recordMonth() : setEditing(true))}
              disabled={record?.locked === 1}
            />
            {record ? (
              <Button
                title={record.locked === 1 ? 'Unlock month' : 'Lock / close month'}
                icon={record.locked === 1 ? 'lock-open' : 'lock-closed'}
                variant="ghost"
                onPress={toggleLock}
              />
            ) : null}
          </>
        )}
      </Card>

      {/* History */}
      <SectionHeader title="Monthly history" />
      {data && data.history.length > 0 ? (
        <Stagger>
          {data.history.map((r) => (
            <HistoryRow
              key={r.id}
              record={r}
              active={r.month === monthKey}
              money={money}
              onPress={() => setMonthKey(r.month)}
            />
          ))}
        </Stagger>
      ) : (
        <Card padded>
          <EmptyState
            icon="albums-outline"
            title="No months recorded yet"
            message="Record a month above to start building your profit history."
          />
        </Card>
      )}
      <View style={{ height: Spacing.xl }} />
      <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center' }}>
        Cash-basis bookkeeping: figures reflect sales and expenses dated within the month.
      </Text>
    </Screen>
  );
}

function HistoryRow({
  record,
  active,
  money,
  onPress,
}: {
  record: ProfitRecord;
  active: boolean;
  money: (minor: number, opts?: { decimals?: 'auto' | 0 | 2; signed?: boolean }) => string;
  onPress: () => void;
}) {
  const t = useTheme();
  const slices = parseAllocationSlices(record.allocation);
  const positive = record.net_profit > 0;
  return (
    <Card
      onPress={onPress}
      style={{
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
        borderColor: active ? t.primary : t.border,
        borderWidth: active ? 1.5 : undefined,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Text variant="subtitle">{formatMonthKey(record.month)}</Text>
          {active ? <Chip label="Viewing" tone="primary" /> : null}
          {record.locked === 1 ? <Chip label="Locked" tone="warning" icon="lock-closed" /> : null}
        </View>
        <Text variant="subtitle" color={positive ? t.success : record.net_profit < 0 ? t.danger : t.textSecondary}>
          {money(record.net_profit)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }}>
        <Text variant="caption" color={t.textMuted}>Rev {money(record.revenue)}</Text>
        <Text variant="caption" color={t.textMuted}>COGS {money(record.cogs)}</Text>
        <Text variant="caption" color={t.textMuted}>Exp {money(record.expenses)}</Text>
      </View>
      {slices.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
          {slices.map((s: AllocationSlice, i: number) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: t.cardAlt,
                paddingHorizontal: Spacing.sm,
                paddingVertical: 3,
                borderRadius: Radius.pill,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <Text variant="caption" color={t.textSecondary}>{s.name}</Text>
              <Text variant="caption" color={t.textMuted}>{money(s.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm }}>
      <Text variant="body" color={t.textSecondary} numberOfLines={2} style={{ flexShrink: 1 }}>{label}</Text>
      <Text variant="body" weight={bold ? 'bold' : 'medium'} color={color} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function sanitizePercent(v: string): string {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length <= 2 ? cleaned : `${parts[0]}.${parts.slice(1).join('')}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
