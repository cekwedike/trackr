import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { Button, Card, Screen, AppHeader, TextField } from '@/components/ui';
import { DateTimeField, SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { createExpense, deleteExpense, EXPENSE_CATEGORIES, updateExpense } from '@/db/repos/expenses';
import type { Expense } from '@/db/types';
import { fromMinor, parseMoney } from '@/lib/money';

const PAYMENT = ['Cash', 'Transfer', 'POS', 'Card', 'Other'];

export function ExpenseForm({ initial }: { initial?: Expense }) {
  const { currencySymbol } = useApp();
  const confirm = useConfirm();
  const { showUndo } = useUndo();
  const [amount, setAmount] = useState(initial ? String(fromMinor(initial.amount)) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [payment, setPayment] = useState(initial?.payment_method ?? 'Cash');
  const [taxRate, setTaxRate] = useState(initial?.tax_rate ? String(initial.tax_rate) : '');
  const [date, setDate] = useState(initial ? new Date(initial.occurred_at) : new Date());
  const [catModal, setCatModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const minor = parseMoney(amount);
    if (minor <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid expense amount.');
      return;
    }
    const tax = parseFloat(taxRate.replace(',', '.')) || 0;
    if (tax < 0 || tax > 100) {
      Alert.alert('Check tax rate', 'Tax / VAT should be between 0 and 100%.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        occurred_at: date.toISOString(),
        amount: minor,
        description: description.trim() || null,
        category: category || null,
        payment_method: payment,
        tax_rate: tax,
      };
      if (initial) await updateExpense(initial.id, payload);
      else await createExpense(payload);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const choice = await confirm({
      title: 'Delete expense',
      message: 'Remove this expense?',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      // Snapshot the expense before deleting so UNDO can re-create it (new id).
      // Best-effort: photo attachments are not restored.
      const snap = initial;
      await deleteExpense(snap.id);
      router.back();
      showUndo({
        message: 'Deleted expense',
        onUndo: () =>
          createExpense({
            occurred_at: snap.occurred_at,
            amount: snap.amount,
            description: snap.description,
            category: snap.category,
            payment_method: snap.payment_method,
            tax_rate: snap.tax_rate,
          }),
      });
    }
  };

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit expense' : 'New expense'} back />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" prefix={currencySymbol} placeholder="0" autoFocus={!initial} />
        <TextField label="Description" value={description} onChangeText={setDescription} placeholder="What was it for?" />
        <SelectField label="Category" value={category} placeholder="Select category" onPress={() => setCatModal(true)} />
        <SelectField label="Payment method" value={payment} onPress={() => setPayModal(true)} />
        <TextField
          label="Tax / VAT % (optional)"
          value={taxRate}
          onChangeText={setTaxRate}
          keyboardType="numeric"
          placeholder="0"
        />
        <DateTimeField label="Date" value={date} onChange={setDate} mode="date" />
      </Card>

      <Button title={initial ? 'Save changes' : 'Add expense'} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}

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
    </Screen>
  );
}
