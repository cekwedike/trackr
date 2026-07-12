import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { AllocationDonut, DONUT_COLORS } from '@/components/anim';
import { AppHeader, Button, Card, Chip, Divider, IconButton, Screen, SectionHeader, Segmented, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getIndustry } from '@/constants/industries';
import { useApp } from '@/context/app-context';
import { sumExpenses } from '@/db/repos/expenses';
import { sumSales } from '@/db/repos/sales';
import { updateSettings } from '@/db/repos/settings';
import type { AllocationBucket } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { rangeBounds, type RangeKey } from '@/lib/date';
import { parseMoney } from '@/lib/money';
import { allocationTotal, computeProfit, DEFAULT_ALLOCATION, parseAllocation, splitAllocation } from '@/lib/profit';

export default function ProfitScreen() {
  const t = useTheme();
  const { settings, money, reloadSettings, industry } = useApp();
  const [range, setRange] = useState<RangeKey>('month');
  const [editing, setEditing] = useState(false);
  const [buckets, setBuckets] = useState<AllocationBucket[]>(DEFAULT_ALLOCATION);
  const [manual, setManual] = useState('');

  useEffect(() => {
    setBuckets(parseAllocation(settings?.profit_allocation));
  }, [settings]);

  const { data } = useAsyncData(async () => {
    const { start, end } = rangeBounds(range);
    const sales = await sumSales(start, end);
    const expenses = await sumExpenses(start, end);
    return computeProfit(sales.revenue, sales.cogs, expenses);
  }, [range]);

  const net = data?.netProfit ?? 0;
  const manualMinor = parseMoney(manual);
  const baseForSplit = manualMinor > 0 ? manualMinor : Math.max(0, net);
  const split = useMemo(() => splitAllocation(baseForSplit, buckets), [baseForSplit, buckets]);
  const total = allocationTotal(buckets);

  const saveAllocation = async () => {
    if (Math.round(total) !== 100) {
      Alert.alert('Must total 100%', `Your allocation currently adds up to ${total}%.`);
      return;
    }
    await updateSettings({ profit_allocation: JSON.stringify(buckets) });
    await reloadSettings();
    setEditing(false);
  };

  const updateBucket = (idx: number, patch: Partial<AllocationBucket>) => {
    setBuckets((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const addBucket = () => setBuckets((prev) => [...prev, { name: 'New', percent: 0 }]);
  const removeBucket = (idx: number) => setBuckets((prev) => prev.filter((_, i) => i !== idx));
  const resetToDefault = () => {
    Alert.alert(
      `Reset to ${industry.name} default?`,
      'This replaces the buckets below with the recommended template. Nothing is saved until you tap Save.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: () => setBuckets(getIndustry(settings?.industry).defaultAllocation.map((b) => ({ ...b }))) },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader title="Profit" back />
      <View style={{ marginBottom: Spacing.lg }}>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
            { value: 'all', label: 'All' },
          ]}
          scroll
        />
      </View>

      <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <Row label="Revenue" value={money(data?.revenue ?? 0)} color={t.success} />
        <Row label="Cost of goods (COGS)" value={money(data?.cogs ?? 0)} />
        <Row label="Expenses" value={money(data?.expenses ?? 0)} color={t.danger} />
        <Divider />
        <Row label="Gross profit" value={money(data?.grossProfit ?? 0)} bold />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="subtitle">Net profit</Text>
          <Text variant="title" color={net >= 0 ? t.success : t.danger}>{money(net)}</Text>
        </View>
        <Chip label={`${Math.round((data?.margin ?? 0) * 100)}% margin`} tone={net >= 0 ? 'success' : 'danger'} />
      </Card>

      <SectionHeader title="Profit allocation" action={editing ? 'Cancel' : 'Edit split'} onAction={() => { setEditing((v) => !v); setBuckets(parseAllocation(settings?.profit_allocation)); }} />

      <Card style={{ gap: Spacing.md }}>
        {manualMinor > 0 ? (
          <Chip label={`Splitting ${money(manualMinor)} (manual)`} tone="primary" />
        ) : (
          <Text variant="caption" color={t.textSecondary}>Splitting net profit for the selected period. These percentages are your own editable targets — tap “Edit split” to change them.</Text>
        )}

        {editing ? (
          <>
            {buckets.map((b, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' }}>
                <TextField style={{ flex: 2 }} label={idx === 0 ? 'Bucket' : undefined} value={b.name} onChangeText={(v) => updateBucket(idx, { name: v })} />
                <TextField style={{ flex: 1 }} label={idx === 0 ? '%' : undefined} value={String(b.percent)} onChangeText={(v) => updateBucket(idx, { percent: parseFloat(v) || 0 })} keyboardType="numeric" />
                <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => removeBucket(idx)} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button title="Add bucket" icon="add" variant="ghost" size="sm" onPress={addBucket} />
              <Chip label={`Total ${total}%`} tone={Math.round(total) === 100 ? 'success' : 'danger'} />
            </View>
            <Button title="Save allocation" icon="checkmark" onPress={saveAllocation} />
            <Button title={`Reset to ${industry.name} default`} icon="refresh" variant="ghost" onPress={resetToDefault} />
          </>
        ) : (
          <>
            {split.length > 0 ? (
              <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
                <AllocationDonut data={split.map((s) => ({ label: s.name, percent: s.percent }))} size={148} trackColor={t.border} />
              </View>
            ) : null}
            {split.map((s, idx) => (
              <View key={idx}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                    <Text variant="body">{s.name}</Text>
                    <Text variant="caption" color={t.textMuted}>{s.percent}%</Text>
                  </View>
                  <Text variant="body" weight="semibold">{money(s.amount)}</Text>
                </View>
                {idx < split.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </>
        )}
      </Card>

      {!editing ? (
        <>
          <SectionHeader title="Split any amount" />
          <Card>
            <TextField label="Amount to split" value={manual} onChangeText={setManual} keyboardType="numeric" placeholder="e.g. 100000" />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" color={t.textSecondary}>{label}</Text>
      <Text variant="body" weight={bold ? 'bold' : 'medium'} color={color}>{value}</Text>
    </View>
  );
}
