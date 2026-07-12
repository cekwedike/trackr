import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, Card, Chip, EmptyState, FAB, ListRow, Screen, Segmented, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listIngredients } from '@/db/repos/ingredients';
import { listProducts } from '@/db/repos/products';
import { computeRecipeCost, listRecipes } from '@/db/repos/recipes';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatQty } from '@/lib/money';

type Tab = 'products' | 'ingredients' | 'recipes';

export default function Inventory() {
  const t = useTheme();
  const { money } = useApp();
  const [tab, setTab] = useState<Tab>('products');

  const { data } = useAsyncData(async () => {
    const [products, ingredients, recipes] = await Promise.all([listProducts(), listIngredients(), listRecipes()]);
    const recipeCosts: Record<number, number> = {};
    for (const r of recipes) recipeCosts[r.id] = await computeRecipeCost(r.id);
    return { products, ingredients, recipes, recipeCosts };
  }, []);

  const addRoute = tab === 'products' ? '/products/new' : tab === 'ingredients' ? '/ingredients/new' : '/recipes/new';

  return (
    <>
      <Screen>
        <AppHeader title="Inventory" />
        <View style={{ marginBottom: Spacing.lg }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'products', label: 'Products' },
              { value: 'ingredients', label: 'Ingredients' },
              { value: 'recipes', label: 'Recipes' },
            ]}
          />
        </View>

        {tab === 'products' ? (
          data && data.products.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {data.products.map((p, idx) => {
                const low = p.low_stock_threshold > 0 && p.stock <= p.low_stock_threshold;
                return (
                  <View key={p.id}>
                    <ListRow
                      icon="cube"
                      iconTone={low ? 'warning' : 'primary'}
                      title={p.name}
                      subtitle={`${money(p.price)} · ${formatQty(p.stock)} ${p.unit}`}
                      onPress={() => router.push(`/products/${p.id}`)}
                      right={low ? <Chip label="Low" tone="warning" /> : undefined}
                    />
                    {idx < data.products.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                  </View>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="cube-outline" title="No products" message="Add the items you sell." actionLabel="Add product" onAction={() => router.push('/products/new')} />
          )
        ) : null}

        {tab === 'ingredients' ? (
          data && data.ingredients.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {data.ingredients.map((i, idx) => {
                const low = i.reorder_threshold > 0 && i.qty_on_hand <= i.reorder_threshold;
                return (
                  <View key={i.id}>
                    <ListRow
                      icon="flask"
                      iconTone={low ? 'warning' : 'accent'}
                      title={i.name}
                      subtitle={`${formatQty(i.qty_on_hand)} ${i.unit} · ${money(i.unit_cost)}/${i.unit}`}
                      onPress={() => router.push(`/ingredients/${i.id}`)}
                      right={low ? <Chip label="Reorder" tone="warning" /> : undefined}
                    />
                    {idx < data.ingredients.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                  </View>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="flask-outline" title="No ingredients" message="Track raw materials used in production." actionLabel="Add ingredient" onAction={() => router.push('/ingredients/new')} />
          )
        ) : null}

        {tab === 'recipes' ? (
          data && data.recipes.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {data.recipes.map((r, idx) => (
                <View key={r.id}>
                  <ListRow
                    icon="restaurant"
                    iconTone="info"
                    title={r.name}
                    subtitle={`Yields ${formatQty(r.yield_qty)} · cost ${money(data.recipeCosts[r.id] ?? 0)}`}
                    onPress={() => router.push(`/recipes/${r.id}`)}
                  />
                  {idx < data.recipes.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState icon="restaurant-outline" title="No recipes" message="Add recipes to calculate production cost and profit." actionLabel="Add recipe" onAction={() => router.push('/recipes/new')} />
          )
        ) : null}
      </Screen>
      <FAB label="Add" onPress={() => router.push(addRoute)} />
    </>
  );
}
