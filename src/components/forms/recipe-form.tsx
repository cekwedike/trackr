import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, IconButton, AppHeader, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listIngredients } from '@/db/repos/ingredients';
import { listProducts } from '@/db/repos/products';
import { createRecipe, deleteRecipe, getRecipeItems, updateRecipe } from '@/db/repos/recipes';
import type { Ingredient, Product, Recipe } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

interface Row {
  key: string;
  ingredient_id: number | null;
  name: string;
  qty: string;
  unit: string | null;
}

let counter = 0;
const nextKey = () => `r-${counter++}`;

export function RecipeForm({ initial, onDone }: { initial?: Recipe; onDone?: () => void }) {
  const t = useTheme();
  const { money, currencySymbol } = useApp();

  const [name, setName] = useState(initial?.name ?? '');
  const [productId, setProductId] = useState<number | null>(initial?.product_id ?? null);
  const [yieldQty, setYieldQty] = useState(initial ? String(initial.yield_qty) : '1');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingModal, setIngModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listIngredients().then(setIngredients);
    listProducts().then(setProducts);
    if (initial) {
      getRecipeItems(initial.id).then((items) =>
        setRows(items.map((it) => ({ key: nextKey(), ingredient_id: it.ingredient_id, name: it.name, qty: String(it.qty), unit: it.unit }))),
      );
    }
  }, [initial]);

  const costMinor = useMemo(() => {
    return rows.reduce((sum, r) => {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      const unitCost = ing?.unit_cost ?? 0;
      return sum + Math.round(unitCost * (parseFloat(r.qty) || 0));
    }, 0);
  }, [rows, ingredients]);

  const perUnit = (parseFloat(yieldQty) || 1) > 0 ? Math.round(costMinor / (parseFloat(yieldQty) || 1)) : costMinor;

  const addIngredient = (id: string) => {
    const ing = ingredients.find((i) => i.id === Number(id));
    if (!ing) return;
    setRows((prev) => [...prev, { key: nextKey(), ingredient_id: ing.id, name: ing.name, qty: '0', unit: ing.unit }]);
  };

  const updateRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a recipe name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product_id: productId,
        name: name.trim(),
        yield_qty: parseFloat(yieldQty) || 1,
        notes: notes.trim() || null,
        items: rows.map((r) => ({ ingredient_id: r.ingredient_id, name: r.name, qty: parseFloat(r.qty) || 0, unit: r.unit })),
      };
      if (initial) await updateRecipe(initial.id, payload);
      else await createRecipe(payload);
      onDone ? onDone() : router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!initial) return;
    Alert.alert('Delete recipe', 'Remove this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRecipe(initial.id); router.back(); } },
    ]);
  };

  const linkedProduct = products.find((p) => p.id === productId);

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit recipe' : 'New recipe'} back />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Recipe name" value={name} onChangeText={setName} placeholder="e.g. Vanilla cake batch" autoFocus={!initial} />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <TextField style={{ flex: 1 }} label="Yield (units produced)" value={yieldQty} onChangeText={setYieldQty} keyboardType="numeric" />
        </View>
        <SelectField label="Linked product (optional)" value={linkedProduct?.name} placeholder="None" onPress={() => setProductModal(true)} />
      </Card>

      <SectionHeader title="Ingredients used" />
      <Card style={{ gap: Spacing.md }}>
        {rows.length === 0 ? <Text variant="caption" color={t.textMuted}>No ingredients added.</Text> : null}
        {rows.map((r) => {
          const ing = ingredients.find((i) => i.id === r.ingredient_id);
          const lineCost = Math.round((ing?.unit_cost ?? 0) * (parseFloat(r.qty) || 0));
          return (
            <View key={r.key} style={{ gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="body" weight="semibold">{r.name}</Text>
                <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => removeRow(r.key)} />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-end' }}>
                <TextField style={{ flex: 1 }} label={`Qty (${r.unit ?? ''})`} value={r.qty} onChangeText={(v) => updateRow(r.key, { qty: v })} keyboardType="numeric" />
                <View style={{ paddingBottom: Spacing.sm }}>
                  <Text variant="caption" color={t.textSecondary}>Cost</Text>
                  <Text variant="body" weight="semibold">{money(lineCost)}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <Button title="Add ingredient" icon="add" variant="secondary" onPress={() => setIngModal(true)} />
      </Card>

      <Card style={{ gap: Spacing.sm, marginTop: Spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" color={t.textSecondary}>Batch cost</Text>
          <Text variant="body" weight="semibold">{money(costMinor)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" color={t.textSecondary}>Cost per unit</Text>
          <Text variant="subtitle" color={t.primary}>{money(perUnit)}</Text>
        </View>
        {linkedProduct ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body" color={t.textSecondary}>Profit per unit (sells {money(linkedProduct.price)})</Text>
            <Text variant="body" weight="semibold" color={linkedProduct.price - perUnit >= 0 ? t.success : t.danger}>
              {money(linkedProduct.price - perUnit)}
            </Text>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Notes" />
      <Card>
        <TextField value={notes} onChangeText={setNotes} placeholder="Steps or notes" multiline />
      </Card>

      <Button title={initial ? 'Save changes' : 'Save recipe'} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}

      <SelectModal
        visible={ingModal}
        title="Choose ingredient"
        onClose={() => setIngModal(false)}
        onSelect={addIngredient}
        options={ingredients.map((i) => ({ id: String(i.id), label: i.name, sublabel: `${money(i.unit_cost)}/${i.unit}` }))}
        footerLabel="Create ingredient"
        onFooter={() => { setIngModal(false); router.push('/ingredients/new'); }}
      />
      <SelectModal
        visible={productModal}
        title="Link product"
        onClose={() => setProductModal(false)}
        onSelect={(id) => setProductId(id ? Number(id) : null)}
        allowClear
        options={products.map((p) => ({ id: String(p.id), label: p.name, sublabel: money(p.price) }))}
      />
    </Screen>
  );
}
