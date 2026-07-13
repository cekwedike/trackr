import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { Button, Card, AppHeader, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { HelpTip } from '@/components/help';
import { SelectField, SelectModal } from '@/components/pickers';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { adjustProductStock, createProduct, deleteProduct, updateProduct } from '@/db/repos/products';
import type { Product } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { fromMinor, formatQty, parseMoney } from '@/lib/money';

const UNITS = ['pcs', 'pack', 'box', 'kg', 'g', 'litre', 'ml', 'plate', 'bottle', 'bag'];

export function ProductForm({ initial }: { initial?: Product }) {
  const t = useTheme();
  const confirm = useConfirm();
  const { showUndo } = useUndo();
  const { currencySymbol, money } = useApp();

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(initial ? String(fromMinor(initial.price)) : '');
  const [cost, setCost] = useState(initial ? String(fromMinor(initial.cost)) : '');
  const [stock, setStock] = useState(initial ? String(initial.stock) : '0');
  const [unit, setUnit] = useState(initial?.unit ?? 'pcs');
  const [threshold, setThreshold] = useState(initial ? String(initial.low_stock_threshold) : '0');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [image, setImage] = useState<string | null>(initial?.image_uri ?? null);
  const [unitModal, setUnitModal] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets?.length) setImage(res.assets[0].uri);
  };

  const restock = async (sign: number) => {
    if (!initial) return;
    const delta = (parseFloat(adjustQty) || 0) * sign;
    if (delta === 0) return;
    await adjustProductStock(initial.id, delta, sign > 0 ? 'Manual restock' : 'Manual reduction');
    setStock((prev) => String((parseFloat(prev) || 0) + delta));
    setAdjustQty('');
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a product name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        price: parseMoney(price),
        cost: parseMoney(cost),
        stock: parseFloat(stock) || 0,
        unit,
        low_stock_threshold: parseFloat(threshold) || 0,
        image_uri: image,
        notes: notes.trim() || null,
      };
      if (initial) await updateProduct(initial.id, payload);
      else await createProduct(payload);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const choice = await confirm({
      title: 'Delete product',
      message: 'Remove this product?',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      // Snapshot the product before deleting so UNDO can re-create it (new id).
      // Best-effort: stock-movement history is not restored, but the current
      // stock level and all product fields are preserved.
      const snap = initial;
      await deleteProduct(snap.id);
      router.back();
      showUndo({
        message: 'Deleted product',
        onUndo: () =>
          createProduct({
            name: snap.name,
            category: snap.category,
            sku: snap.sku,
            price: snap.price,
            cost: snap.cost,
            stock: snap.stock,
            unit: snap.unit,
            low_stock_threshold: snap.low_stock_threshold,
            image_uri: snap.image_uri,
            notes: snap.notes,
          }),
      });
    }
  };

  const margin = parseMoney(price) - parseMoney(cost);

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit product' : 'New product'} back />

      <Card style={{ gap: Spacing.md }}>
        <Pressable onPress={pickImage} style={{ alignSelf: 'center' }}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: 96, height: 96, borderRadius: Radius.lg }} contentFit="cover" />
          ) : (
            <View style={{ width: 96, height: 96, borderRadius: Radius.lg, backgroundColor: t.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="caption" color={t.textMuted}>Add photo</Text>
            </View>
          )}
        </Pressable>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Chocolate cake" autoFocus={!initial} />
        <TextField label="Category" value={category} onChangeText={setCategory} placeholder="e.g. Cakes" />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <TextField style={{ flex: 1 }} label="Selling price" value={price} onChangeText={setPrice} keyboardType="numeric" prefix={currencySymbol} />
          <TextField style={{ flex: 1 }} label="Unit cost" value={cost} onChangeText={setCost} keyboardType="numeric" prefix={currencySymbol} />
        </View>
        <Text variant="caption" color={margin >= 0 ? t.success : t.danger}>Profit per unit: {money(margin)}</Text>
      </Card>

      <SectionHeader title="Stock" />
      <Card style={{ gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <TextField style={{ flex: 1 }} label="Quantity" value={stock} onChangeText={setStock} keyboardType="numeric" />
          <SelectField label="Unit" value={unit} onPress={() => setUnitModal(true)} />
        </View>
        <TextField
          label="Low-stock alert at"
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
          right={
            <HelpTip
              title="Low-stock alert"
              subtitle="Your reorder reminder"
              paragraphs={[
                'This is the quantity at which Trackr warns you it’s time to restock. When stock falls to this number or below, the item shows up in your dashboard’s low-stock alerts.',
                'Set it to a level that gives you enough time to reorder before you run out. Enter 0 to switch the alert off for this item.',
              ]}
            />
          }
        />
        {initial ? (
          <View style={{ gap: Spacing.sm }}>
            <Text variant="label" color={t.textSecondary}>Quick adjust (current: {formatQty(parseFloat(stock) || 0)} {unit})</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextField style={{ flex: 1 }} value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" placeholder="Qty" />
              <Button title="Add" icon="add" variant="secondary" size="md" onPress={() => restock(1)} />
              <Button title="Remove" icon="remove" variant="secondary" size="md" onPress={() => restock(-1)} />
            </View>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Notes" />
      <Card>
        <TextField value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
      </Card>

      <Button title={initial ? 'Save changes' : 'Add product'} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}

      <SelectModal visible={unitModal} title="Unit" searchable={false} onClose={() => setUnitModal(false)} onSelect={setUnit} options={UNITS.map((u) => ({ id: u, label: u }))} />
    </Screen>
  );
}
