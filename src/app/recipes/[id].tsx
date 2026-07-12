import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { RecipeForm } from '@/components/forms/recipe-form';
import { AppHeader, Card, Chip, DetailHero, Divider, IconButton, InfoRow, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { HelpTip } from '@/components/help';
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

      <DetailHero
        label="Cost per unit"
        value={money(perUnit)}
        valueColor={t.primary}
        icon="reader"
        tone="primary"
        meta={`Yields ${formatQty(recipe.yield_qty)} units · batch ${money(batchCost)}`}
      />

      <SectionHeader title="Costing" />
      <Card style={{ marginBottom: Spacing.lg }}>
        <InfoRow label="Yield" value={`${formatQty(recipe.yield_qty)} units`} />
        <Divider />
        <InfoRow label="Batch cost" value={money(batchCost)} />
        {product ? (
          <>
            <Divider />
            <InfoRow
              label={`Profit / unit (sells ${money(product.price)})`}
              right={<Chip label={money(product.price - perUnit)} tone={product.price - perUnit >= 0 ? 'success' : 'danger'} />}
            />
          </>
        ) : null}
      </Card>

      <SectionHeader title="Ingredients" subtitle={items.length ? `${items.length} used` : undefined} />
      <Card>
        {items.map((it, idx) => (
          <View key={it.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">{it.name}</Text>
                <Text variant="caption" color={t.textSecondary}>{formatQty(it.qty)} {it.unit ?? ''} · {money(it.unitCost)}/{it.unit ?? 'unit'}</Text>
              </View>
              <Text variant="body" weight="bold">{money(it.lineCost)}</Text>
            </View>
            {idx < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
        {items.length === 0 ? <Text variant="caption" color={t.textMuted}>No ingredients.</Text> : null}
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <Text variant="label" color={t.textSecondary}>PRICING HELPER</Text>
        <HelpTip
          title="Pricing helper"
          subtitle="Price for the profit you want"
          paragraphs={[
            'Enter the profit margin you’d like to earn and Trackr suggests a selling price that hits it, based on your cost per unit.',
            'Margin is the share of the selling price that is profit. For example, a 40% margin means 40% of the price is profit and 60% covers your cost.',
          ]}
          tip="Higher margins mean more profit per unit, but keep prices realistic for your market."
        />
      </View>
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
          <SectionHeader title="Notes" style={{ marginTop: Spacing.lg }} />
          <Card><Text variant="body" color={t.textSecondary}>{recipe.notes}</Text></Card>
        </>
      ) : null}
    </Screen>
  );
}
