import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { Button, Card, AppHeader, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { adjustIngredientStock, createIngredient, deleteIngredient, updateIngredient } from '@/db/repos/ingredients';
import type { Ingredient } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/errors';
import { fromMinor, formatQty, parseMoney } from '@/lib/money';

const UNITS = ['g', 'kg', 'ml', 'litre', 'pcs', 'pack', 'cup', 'tbsp', 'tsp', 'bag'];

export function IngredientForm({ initial }: { initial?: Ingredient }) {
  const t = useTheme();
  const confirm = useConfirm();
  const { currencySymbol } = useApp();

  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? 'g');
  const [qty, setQty] = useState(initial ? String(initial.qty_on_hand) : '0');
  const [unitCost, setUnitCost] = useState(initial ? String(fromMinor(initial.unit_cost)) : '');
  const [threshold, setThreshold] = useState(initial ? String(initial.reorder_threshold) : '0');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [unitModal, setUnitModal] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [saving, setSaving] = useState(false);

  const restock = async (sign: number) => {
    if (!initial) return;
    const delta = (parseFloat(adjustQty) || 0) * sign;
    if (delta === 0) return;
    await adjustIngredientStock(initial.id, delta, sign > 0 ? 'Manual restock' : 'Manual reduction');
    setQty((prev) => String((parseFloat(prev) || 0) + delta));
    setAdjustQty('');
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter an ingredient name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        unit,
        qty_on_hand: parseFloat(qty) || 0,
        unit_cost: parseMoney(unitCost),
        reorder_threshold: parseFloat(threshold) || 0,
        notes: notes.trim() || null,
      };
      if (initial) await updateIngredient(initial.id, payload);
      else await createIngredient(payload);
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t save', toUserMessage(e, 'Couldn’t save this ingredient. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const choice = await confirm({
      title: 'Delete ingredient',
      message: 'Remove this ingredient?',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      await deleteIngredient(initial.id);
      router.back();
    }
  };

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit ingredient' : 'New ingredient'} back />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Flour" autoFocus={!initial} />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <TextField style={{ flex: 1 }} label="Quantity on hand" value={qty} onChangeText={setQty} keyboardType="numeric" />
          <SelectField label="Unit" value={unit} onPress={() => setUnitModal(true)} />
        </View>
        <TextField label={`Cost per ${unit}`} value={unitCost} onChangeText={setUnitCost} keyboardType="numeric" prefix={currencySymbol} />
        <TextField label="Reorder alert at" value={threshold} onChangeText={setThreshold} keyboardType="numeric" />
      </Card>

      {initial ? (
        <>
          <SectionHeader title="Quick adjust" />
          <Card style={{ gap: Spacing.sm }}>
            <Text variant="label" color={t.textSecondary}>Current: {formatQty(parseFloat(qty) || 0)} {unit}</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextField style={{ flex: 1 }} value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" placeholder="Qty" />
              <Button title="Add" icon="add" variant="secondary" onPress={() => restock(1)} />
              <Button title="Use" icon="remove" variant="secondary" onPress={() => restock(-1)} />
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Notes" />
      <Card>
        <TextField value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
      </Card>

      <Button title={initial ? 'Save changes' : 'Add ingredient'} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}

      <SelectModal visible={unitModal} title="Unit" searchable={false} onClose={() => setUnitModal(false)} onSelect={setUnit} options={UNITS.map((u) => ({ id: u, label: u }))} />
    </Screen>
  );
}
