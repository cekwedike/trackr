import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FadeSlide, SkeletonList } from '@/components/anim';
import { MovableFab, type FabAction } from '@/components/nav';
import { AppHeader, Card, Chip, EmptyState, ListRow, Screen, Segmented } from '@/components/ui';
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
  const { money, terms, industry } = useApp();
  const { modules } = industry;

  const tabs = useMemo(() => {
    const list: { value: Tab; label: string }[] = [{ value: 'products', label: terms.items }];
    if (modules.ingredients) list.push({ value: 'ingredients', label: terms.ingredients });
    if (modules.recipes) list.push({ value: 'recipes', label: terms.productionLabel });
    return list;
  }, [modules.ingredients, modules.recipes, terms.items, terms.ingredients, terms.productionLabel]);

  const [tab, setTab] = useState<Tab>('products');
  const activeTab: Tab = tabs.some((x) => x.value === tab) ? tab : 'products';

  const { data } = useAsyncData(async () => {
    const [products, ingredients, recipes] = await Promise.all([listProducts(), listIngredients(), listRecipes()]);
    const recipeCosts: Record<number, number> = {};
    for (const r of recipes) recipeCosts[r.id] = await computeRecipeCost(r.id);
    return { products, ingredients, recipes, recipeCosts };
  }, []);

  const fabActions = useMemo<FabAction[]>(() => {
    const list: FabAction[] = [
      { key: 'product', icon: 'cube', label: `New ${terms.item.toLowerCase()}`, onPress: () => router.push('/products/new') },
    ];
    if (modules.ingredients) list.push({ key: 'ingredient', icon: 'flask', label: `New ${terms.ingredient.toLowerCase()}`, onPress: () => router.push('/ingredients/new') });
    if (modules.recipes) list.push({ key: 'recipe', icon: 'reader', label: `New ${terms.productionLabel.toLowerCase().replace(/s$/, '')}`, onPress: () => router.push('/recipes/new') });
    return list;
  }, [modules.ingredients, modules.recipes, terms.item, terms.ingredient, terms.productionLabel]);

  return (
    <>
      <Screen>
        <AppHeader title={terms.inventoryLabel} />
        {tabs.length > 1 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <Segmented value={activeTab} onChange={setTab} options={tabs} />
          </View>
        ) : null}

        {!data ? <SkeletonList rows={7} /> : null}

        {data && activeTab === 'products' ? (
          data.products.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {data.products.map((p, idx) => {
                const low = p.low_stock_threshold > 0 && p.stock <= p.low_stock_threshold;
                return (
                  <FadeSlide key={p.id} delay={Math.min(idx * 45, 360)}>
                    <ListRow
                      icon="cube"
                      iconTone={low ? 'warning' : 'primary'}
                      title={p.name}
                      subtitle={`${money(p.price)} · ${formatQty(p.stock)} ${p.unit}`}
                      onPress={() => router.push(`/products/${p.id}`)}
                      right={low ? <Chip label="Low" tone="warning" /> : undefined}
                    />
                    {idx < data.products.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                  </FadeSlide>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="cube-outline" title={`No ${terms.items.toLowerCase()}`} message={`Add the ${terms.items.toLowerCase()} you sell.`} actionLabel={`Add ${terms.item.toLowerCase()}`} onAction={() => router.push('/products/new')} />
          )
        ) : null}

        {data && activeTab === 'ingredients' ? (
          data.ingredients.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {data.ingredients.map((i, idx) => {
                const low = i.reorder_threshold > 0 && i.qty_on_hand <= i.reorder_threshold;
                return (
                  <FadeSlide key={i.id} delay={Math.min(idx * 45, 360)}>
                    <ListRow
                      icon="flask"
                      iconTone={low ? 'warning' : 'accent'}
                      title={i.name}
                      subtitle={`${formatQty(i.qty_on_hand)} ${i.unit} · ${money(i.unit_cost)}/${i.unit}`}
                      onPress={() => router.push(`/ingredients/${i.id}`)}
                      right={low ? <Chip label="Reorder" tone="warning" /> : undefined}
                    />
                    {idx < data.ingredients.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                  </FadeSlide>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="flask-outline" title={`No ${terms.ingredients.toLowerCase()}`} message={`Track raw ${terms.ingredients.toLowerCase()} used in production.`} actionLabel={`Add ${terms.ingredient.toLowerCase()}`} onAction={() => router.push('/ingredients/new')} />
          )
        ) : null}

        {data && activeTab === 'recipes' ? (
          data.recipes.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {data.recipes.map((r, idx) => (
                <FadeSlide key={r.id} delay={Math.min(idx * 45, 360)}>
                  <ListRow
                    icon="restaurant"
                    iconTone="info"
                    title={r.name}
                    subtitle={`Yields ${formatQty(r.yield_qty)} · cost ${money(data.recipeCosts[r.id] ?? 0)}`}
                    onPress={() => router.push(`/recipes/${r.id}`)}
                  />
                  {idx < data.recipes.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                </FadeSlide>
              ))}
            </Card>
          ) : (
            <EmptyState icon="restaurant-outline" title={`No ${terms.productionLabel.toLowerCase()}`} message={`Add ${terms.productionLabel.toLowerCase()} to calculate production cost and profit.`} actionLabel={`Add ${terms.productionLabel.toLowerCase().replace(/s$/, '')}`} onAction={() => router.push('/recipes/new')} />
          )
        ) : null}
      </Screen>
      <MovableFab actions={fabActions} storageKey="inventory" />
    </>
  );
}
