import { router } from 'expo-router';
import { View } from 'react-native';

import { AppHeader, Card, EmptyState, FAB, ListRow, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { computeRecipeCost, listRecipes } from '@/db/repos/recipes';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { formatQty } from '@/lib/money';

export default function RecipesScreen() {
  const t = useTheme();
  const { money } = useApp();
  const { data } = useAsyncData(async () => {
    const recipes = await listRecipes();
    const costs: Record<number, number> = {};
    for (const r of recipes) costs[r.id] = await computeRecipeCost(r.id);
    return { recipes, costs };
  }, []);

  return (
    <>
      <Screen>
        <AppHeader title="Recipes" back subtitle="Production cost & profit" />
        {data && data.recipes.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {data.recipes.map((r, idx) => {
              const cost = data.costs[r.id] ?? 0;
              const perUnit = r.yield_qty > 0 ? Math.round(cost / r.yield_qty) : cost;
              return (
                <View key={r.id}>
                  <ListRow
                    icon="restaurant"
                    iconTone="info"
                    title={r.name}
                    subtitle={`Yields ${formatQty(r.yield_qty)} · ${money(perUnit)}/unit`}
                    onPress={() => router.push(`/recipes/${r.id}`)}
                  />
                  {idx < data.recipes.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                </View>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon="restaurant-outline" title="No recipes" message="Calculate exactly what each batch costs and the profit to expect." actionLabel="Add recipe" onAction={() => router.push('/recipes/new')} />
        )}
      </Screen>
      <FAB label="Recipe" onPress={() => router.push('/recipes/new')} />
    </>
  );
}
