import { router } from 'expo-router';

import { SkeletonList } from '@/components/anim';
import { AppHeader, CardList, EmptyState, FAB, ListRow, Screen } from '@/components/ui';
import { useApp } from '@/context/app-context';
import { computeRecipeCost, listRecipes } from '@/db/repos/recipes';
import { useAsyncData } from '@/hooks/use-async-data';
import { formatQty } from '@/lib/money';

export default function RecipesScreen() {
  const { money, terms } = useApp();
  const { data } = useAsyncData(async () => {
    const recipes = await listRecipes();
    const costs: Record<number, number> = {};
    for (const r of recipes) costs[r.id] = await computeRecipeCost(r.id);
    return { recipes, costs };
  }, []);

  return (
    <>
      <Screen>
        <AppHeader title={terms.productionLabel} back subtitle="Production cost & profit" />
        {!data ? (
          <SkeletonList rows={6} />
        ) : data.recipes.length > 0 ? (
          <CardList
            data={data.recipes}
            keyExtractor={(r) => r.id}
            renderItem={(r) => {
              const cost = data.costs[r.id] ?? 0;
              const perUnit = r.yield_qty > 0 ? Math.round(cost / r.yield_qty) : cost;
              return (
                <ListRow
                  icon="restaurant"
                  iconTone="info"
                  title={r.name}
                  subtitle={`Yields ${formatQty(r.yield_qty)} · ${money(perUnit)}/unit`}
                  onPress={() => router.push(`/recipes/${r.id}`)}
                />
              );
            }}
          />
        ) : (
          <EmptyState icon="restaurant-outline" title={`No ${terms.productionLabel.toLowerCase()}`} message="Calculate exactly what each batch costs and the profit to expect." actionLabel={`Add ${terms.productionLabel.toLowerCase().replace(/s$/, '')}`} onAction={() => router.push('/recipes/new')} />
        )}
      </Screen>
      <FAB label="Recipe" onPress={() => router.push('/recipes/new')} />
    </>
  );
}
