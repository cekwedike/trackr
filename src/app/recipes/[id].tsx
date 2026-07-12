import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { RecipeForm } from '@/components/forms/recipe-form';
import { AppHeader, Button, Card, Chip, Divider, IconButton, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { getIngredient } from '@/db/repos/ingredients';
import { getProduct } from '@/db/repos/products';
import { getRecipe, getRecipeItems } from '@/db/repos/recipes';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatQty } from '@/lib/money';

export default function RecipeDetail() {
  const t = useTheme();
  const { money } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  const [editing, setEditing] = useState(false);
  const [margin, setMargin] = useState('40');

  const { data, reload } = useAsyncData(async () => {
    const recipe = await getRecipe(recipeId);
    if (!recipe) return null;
    const items = await getRecipeItems(recipeId);
    const withCost = await Promise.all(
      items.map(async (it) => {
        const ing = it.ingredient_id ? await getIngredient(it.ingredient_id) : null;
        const unitCost = ing?.unit_cost ?? 0;
        return { ...it, unitCost, lineCost: Math.round(unitCost * it.qty) };
      }),
    );
    const product = recipe.product_id ? await getProduct(recipe.product_id) : null;
    return { recipe, items: withCost, product };
  }, [recipeId]);

  const batchCost = useMemo(() => (data?.items ?? []).reduce((s, i) => s + i.lineCost, 0), [data]);
  const perUnit = data && data.recipe.yield_qty > 0 ? Math.round(batchCost / data.recipe.yield_qty) : batchCost;
  const marginPct = Math.min(95, Math.max(0, parseFloat(margin) || 0));
  const suggested = marginPct < 100 ? Math.round(perUnit / (1 - marginPct / 100)) : perUnit;

  if (data === null) {
    return (
      <Screen>
        <AppHeader title="Recipe" back />
        <Text variant="body">Recipe not found.</Text>
      </Screen>
    );
  }
  if (!data) return null;

  if (editing) {
    return <RecipeForm initial={data.recipe} onDone={() => { setEditing(false); reload(); }} />;
  }

  const { recipe, items, product } = data;

  return (
    <Screen>
      <AppHeader title={recipe.name} back right={<IconButton icon="create-outline" tone="primary" onPress={() => setEditing(true)} />} />

      <Card style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color={t.textSecondary}>Cost per unit</Text>
          <Text variant="title" color={t.primary}>{money(perUnit)}</Text>
        </View>
        <Divider />
        <Row label="Yield" value={`${formatQty(recipe.yield_qty)} units`} />
        <Row label="Batch cost" value={money(batchCost)} />
        {product ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="caption" color={t.textSecondary}>Profit / unit (sells {money(product.price)})</Text>
            <Chip label={money(product.price - perUnit)} tone={product.price - perUnit >= 0 ? 'success' : 'danger'} />
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Ingredients" />
      <Card>
        {items.map((it, idx) => (
          <View key={it.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="medium">{it.name}</Text>
                <Text variant="caption" color={t.textSecondary}>{formatQty(it.qty)} {it.unit ?? ''} · {money(it.unitCost)}/{it.unit ?? 'unit'}</Text>
              </View>
              <Text variant="body" weight="semibold">{money(it.lineCost)}</Text>
            </View>
            {idx < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
        {items.length === 0 ? <Text variant="caption" color={t.textMuted}>No ingredients.</Text> : null}
      </Card>

      <SectionHeader title="Pricing helper" />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Target profit margin (%)" value={margin} onChangeText={setMargin} keyboardType="numeric" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="body" color={t.textSecondary}>Suggested selling price</Text>
          <Text variant="subtitle" color={t.success}>{money(suggested)}</Text>
        </View>
        <Text variant="caption" color={t.textMuted}>Profit per unit at this price: {money(suggested - perUnit)}</Text>
      </Card>

      {recipe.notes ? (
        <>
          <SectionHeader title="Notes" />
          <Card><Text variant="body" color={t.textSecondary}>{recipe.notes}</Text></Card>
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="caption" color={t.textSecondary}>{label}</Text>
      <Text variant="body" weight="medium">{value}</Text>
    </View>
  );
}
