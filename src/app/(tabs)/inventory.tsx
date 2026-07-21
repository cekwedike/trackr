import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SkeletonList } from '@/components/anim';
import { useConfirm } from '@/components/confirm';
import { MovableFab } from '@/components/nav';
import { AppHeader, CardList, Chip, EmptyState, IconButton, ListRow, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listIngredients } from '@/db/repos/ingredients';
import { listProducts, restockProduct, suggestedReorder } from '@/db/repos/products';
import { computeRecipeCost, listRecipes } from '@/db/repos/recipes';
import type { Product } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useQuickActionCandidates } from '@/hooks/use-fab-actions';
import { formatQty } from '@/lib/money';

type Tab = 'products' | 'ingredients' | 'recipes';
type StockFilter = 'all' | 'low';

function isLowProduct(p: Product): boolean {
  return p.low_stock_threshold > 0 && p.stock <= p.low_stock_threshold;
}

export default function Inventory() {
  const { money, terms, industry } = useApp();
  const { modules } = industry;
  const confirm = useConfirm();

  const tabs = useMemo(() => {
    const list: { value: Tab; label: string }[] = [{ value: 'products', label: terms.items }];
    if (modules.ingredients) list.push({ value: 'ingredients', label: terms.ingredients });
    if (modules.recipes) list.push({ value: 'recipes', label: terms.productionLabel });
    return list;
  }, [modules.ingredients, modules.recipes, terms.items, terms.ingredients, terms.productionLabel]);

  const [tab, setTab] = useState<Tab>('products');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const activeTab: Tab = tabs.some((x) => x.value === tab) ? tab : 'products';
  const { actions, defaultKeys } = useQuickActionCandidates();

  const { data, reload } = useAsyncData(async () => {
    const [products, ingredients, recipes] = await Promise.all([listProducts(), listIngredients(), listRecipes()]);
    const recipeCosts: Record<number, number> = {};
    for (const r of recipes) recipeCosts[r.id] = await computeRecipeCost(r.id);
    return { products, ingredients, recipes, recipeCosts };
  }, []);

  const lowProducts = useMemo(() => (data ? data.products.filter(isLowProduct) : []), [data]);
  const shownProducts = stockFilter === 'low' ? lowProducts : data?.products ?? [];

  const onRestock = async (p: Product) => {
    const qty = suggestedReorder(p);
    const choice = await confirm({
      title: `Restock ${p.name}?`,
      message: `Add ${formatQty(qty)} ${p.unit} to bring stock back above the ${formatQty(p.low_stock_threshold)} ${p.unit} threshold.`,
      actions: [
        { label: `Add ${formatQty(qty)} ${p.unit}`, style: 'default', value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'ok') return;
    setBusyId(p.id);
    try {
      await restockProduct(p.id, qty);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Screen>
        <AppHeader
          title={terms.inventoryLabel}
          right={<IconButton icon="scan-outline" tone="primary" onPress={() => router.push('/scan')} />}
        />
        {tabs.length > 1 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <Segmented value={activeTab} onChange={setTab} options={tabs} />
          </View>
        ) : null}

        {!data ? <SkeletonList rows={7} /> : null}

        {data && activeTab === 'products' ? (
          data.products.length > 0 ? (
            <>
              <View style={{ marginBottom: Spacing.lg }}>
                <Segmented
                  value={stockFilter}
                  onChange={setStockFilter}
                  options={[
                    { value: 'all', label: `All (${data.products.length})` },
                    { value: 'low', label: lowProducts.length > 0 ? `Needs restock (${lowProducts.length})` : 'Needs restock' },
                  ]}
                />
              </View>

              {shownProducts.length > 0 ? (
                <CardList
                  data={shownProducts}
                  keyExtractor={(p) => p.id}
                  renderItem={(p) => {
                    const low = isLowProduct(p);
                    return (
                      <ListRow
                        icon="cube"
                        iconTone={low ? 'warning' : 'primary'}
                        title={p.name}
                        subtitle={`${money(p.price)} · ${formatQty(p.stock)} ${p.unit}`}
                        onPress={() => router.push(`/products/${p.id}`)}
                        right={
                          low ? (
                            <Chip
                              label={busyId === p.id ? 'Adding…' : `Restock +${formatQty(suggestedReorder(p))}`}
                              tone="warning"
                              icon="add"
                              onPress={() => onRestock(p)}
                            />
                          ) : undefined
                        }
                      />
                    );
                  }}
                />
              ) : (
                <EmptyState
                  icon="checkmark-circle-outline"
                  title="All stocked up"
                  message={`Every ${terms.item.toLowerCase()} is above its low-stock threshold.`}
                  secondaryLabel="Show all"
                  onSecondary={() => setStockFilter('all')}
                />
              )}
            </>
          ) : (
            <EmptyState icon="cube-outline" title={`No ${terms.items.toLowerCase()}`} message={`Add the ${terms.items.toLowerCase()} you sell.`} actionLabel={`Add ${terms.item.toLowerCase()}`} onAction={() => router.push('/products/new')} />
          )
        ) : null}

        {data && activeTab === 'ingredients' ? (
          data.ingredients.length > 0 ? (
            <CardList
              data={data.ingredients}
              keyExtractor={(i) => i.id}
              renderItem={(i) => {
                const low = i.reorder_threshold > 0 && i.qty_on_hand <= i.reorder_threshold;
                return (
                  <ListRow
                    icon="flask"
                    iconTone={low ? 'warning' : 'accent'}
                    title={i.name}
                    subtitle={`${formatQty(i.qty_on_hand)} ${i.unit} · ${money(i.unit_cost)}/${i.unit}`}
                    onPress={() => router.push(`/ingredients/${i.id}`)}
                    right={low ? <Chip label="Reorder" tone="warning" /> : undefined}
                  />
                );
              }}
            />
          ) : (
            <EmptyState icon="flask-outline" title={`No ${terms.ingredients.toLowerCase()}`} message={`Track raw ${terms.ingredients.toLowerCase()} used in production.`} actionLabel={`Add ${terms.ingredient.toLowerCase()}`} onAction={() => router.push('/ingredients/new')} />
          )
        ) : null}

        {data && activeTab === 'recipes' ? (
          data.recipes.length > 0 ? (
            <CardList
              data={data.recipes}
              keyExtractor={(r) => r.id}
              renderItem={(r) => (
                <ListRow
                  icon="restaurant"
                  iconTone="info"
                  title={r.name}
                  subtitle={`Yields ${formatQty(r.yield_qty)} · cost ${money(data.recipeCosts[r.id] ?? 0)}`}
                  onPress={() => router.push(`/recipes/${r.id}`)}
                />
              )}
            />
          ) : (
            <EmptyState icon="restaurant-outline" title={`No ${terms.productionLabel.toLowerCase()}`} message={`Add ${terms.productionLabel.toLowerCase()} to calculate production cost and profit.`} actionLabel={`Add ${terms.productionLabel.toLowerCase().replace(/s$/, '')}`} onAction={() => router.push('/recipes/new')} />
          )
        ) : null}
      </Screen>
      <MovableFab actions={actions} defaultKeys={defaultKeys} storageKey="inventory" />
    </>
  );
}
