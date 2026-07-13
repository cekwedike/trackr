import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { HelpTip } from '@/components/help';
import { DateTimeField, SelectField, SelectModal } from '@/components/pickers';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  EmptyState,
  FAB,
  IconButton,
  Screen,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { EXPENSE_CATEGORIES } from '@/db/repos/expenses';
import {
  createRecurringRule,
  deleteRecurringRule,
  listRecurringRules,
  setRecurringActive,
  updateRecurringRule,
  type Cadence,
} from '@/db/repos/recurring';
import type { RecurringRule } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { fromMinor, parseMoney } from '@/lib/money';

const PAYMENT = ['Cash', 'Transfer', 'POS', 'Card', 'Other'];

const CADENCE_OPTIONS: { value: Cadence; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const CADENCE_LABEL: Record<Cadence, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function RecurringScreen() {
  const t = useTheme();
  const confirm = useConfirm();
  const { money } = useApp();
  const { data, reload } = useAsyncData(() => listRecurringRules(), []);
  const [editing, setEditing] = useState<RecurringRule | null | 'new'>(null);

  const toggleActive = async (rule: RecurringRule) => {
    await setRecurringActive(rule.id, rule.active !== 1);
    reload();
  };

  const remove = async (rule: RecurringRule) => {
    const choice = await confirm({
      title: 'Delete recurring expense',
      message: 'This stops future auto-entries. Expenses already created stay in your records.',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'delete') return;
    await deleteRecurringRule(rule.id);
    reload();
  };

  if (editing !== null) {
    return (
      <RuleForm
        initial={editing === 'new' ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    );
  }

  const rules = data ?? [];

  return (
    <>
      <Screen>
        <AppHeader
          title="Recurring expenses"
          back
          right={
            <HelpTip
              title="Recurring expenses"
              subtitle="Automate the bills you pay on a schedule"
              paragraphs={[
                'A recurring expense is a rule that automatically records an expense for you on a schedule — like rent, salaries or a subscription.',
                'Each time you open Trackr, any rule that has come due is logged as a real expense (catching up on any you missed while the app was closed).',
              ]}
              points={[
                { term: 'Cadence', desc: 'How often it repeats: daily, weekly or monthly.' },
                { term: 'Next due', desc: 'The date the next expense will be created.' },
                { term: 'Active', desc: 'Turn a rule off to pause it without deleting its history.' },
              ]}
              tip="Set the first run to the exact date the bill lands so your reports stay accurate."
            />
          }
        />

        {rules.length === 0 ? (
          <EmptyState
            icon="repeat"
            title="No recurring expenses"
            message="Automate bills you pay on a schedule — rent, salaries, subscriptions — so they're logged for you."
            actionLabel="Add recurring expense"
            onAction={() => setEditing('new')}
          />
        ) : (
          rules.map((rule) => (
            <Card
              key={rule.id}
              style={{ marginBottom: Spacing.md, gap: Spacing.md, opacity: rule.active === 1 ? 1 : 0.6 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {rule.description || rule.category || 'Recurring expense'}
                  </Text>
                  <Text variant="caption" color={t.textSecondary}>
                    {CADENCE_LABEL[rule.cadence]} · Next {formatDate(rule.next_run)}
                  </Text>
                </View>
                <Text variant="subtitle">{money(rule.amount)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                {rule.category ? <Chip label={rule.category} tone="danger" /> : null}
                <View style={{ flex: 1 }} />
                <Toggle value={rule.active === 1} onValueChange={() => toggleActive(rule)} />
                <IconButton icon="create-outline" tone="default" size={18} onPress={() => setEditing(rule)} />
                <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => remove(rule)} />
              </View>
            </Card>
          ))
        )}
      </Screen>
      {rules.length > 0 ? <FAB label="Recurring" onPress={() => setEditing('new')} /> : null}
    </>
  );
}

function RuleForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: RecurringRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currencySymbol } = useApp();
  const [amount, setAmount] = useState(initial ? String(fromMinor(initial.amount)) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [payment, setPayment] = useState(initial?.payment_method ?? 'Cash');
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? 'monthly');
  const [firstRun, setFirstRun] = useState(initial ? new Date(initial.next_run) : new Date());
  const [catModal, setCatModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [cadenceModal, setCadenceModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const minor = parseMoney(amount);
    if (minor <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid expense amount.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        amount: minor,
        description: description.trim() || null,
        category: category || null,
        payment_method: payment,
        cadence,
        next_run: firstRun.toISOString(),
      };
      if (initial) await updateRecurringRule(initial.id, payload);
      else await createRecurringRule(payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        title={initial ? 'Edit recurring expense' : 'New recurring expense'}
        right={<IconButton icon="close" onPress={onClose} />}
      />
      <Card style={{ gap: Spacing.md }}>
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          prefix={currencySymbol}
          placeholder="0"
          autoFocus={!initial}
        />
        <SelectField label="Category" value={category} placeholder="Select category" onPress={() => setCatModal(true)} />
        <TextField label="Description" value={description} onChangeText={setDescription} placeholder="What is it for?" />
        <SelectField label="Payment method" value={payment} onPress={() => setPayModal(true)} />
        <SelectField label="Repeats" value={CADENCE_LABEL[cadence]} onPress={() => setCadenceModal(true)} />
        <DateTimeField label="First run" value={firstRun} onChange={setFirstRun} mode="date" />
      </Card>

      <Button
        title={initial ? 'Save changes' : 'Add recurring expense'}
        icon="checkmark"
        onPress={save}
        loading={saving}
        size="lg"
        style={{ marginTop: Spacing.lg }}
      />
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: Spacing.md }} />

      <SelectModal
        visible={catModal}
        title="Category"
        searchable={false}
        onClose={() => setCatModal(false)}
        onSelect={(id) => setCategory(id)}
        options={EXPENSE_CATEGORIES.map((c) => ({ id: c, label: c }))}
      />
      <SelectModal
        visible={payModal}
        title="Payment method"
        searchable={false}
        onClose={() => setPayModal(false)}
        onSelect={(id) => setPayment(id)}
        options={PAYMENT.map((c) => ({ id: c, label: c }))}
      />
      <SelectModal
        visible={cadenceModal}
        title="Repeats"
        searchable={false}
        onClose={() => setCadenceModal(false)}
        onSelect={(id) => setCadence(id as Cadence)}
        options={CADENCE_OPTIONS.map((c) => ({ id: c.value, label: c.label }))}
      />
    </Screen>
  );
}
