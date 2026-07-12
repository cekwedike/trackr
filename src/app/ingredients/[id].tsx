import { useLocalSearchParams } from 'expo-router';

import { IngredientForm } from '@/components/forms/ingredient-form';
import { AppHeader, Screen, Text } from '@/components/ui';
import { getIngredient } from '@/db/repos/ingredients';
import { useAsyncData } from '@/hooks/use-async-data';

export default function EditIngredient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsyncData(() => getIngredient(Number(id)), [id]);
  if (loading) return null;
  if (!data) {
    return (
      <Screen>
        <AppHeader title="Ingredient" back />
        <Text variant="body">Ingredient not found.</Text>
      </Screen>
    );
  }
  return <IngredientForm initial={data} />;
}
