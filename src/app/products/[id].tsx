import { useLocalSearchParams } from 'expo-router';

import { ProductForm } from '@/components/forms/product-form';
import { AppHeader, Screen, Text } from '@/components/ui';
import { getProduct } from '@/db/repos/products';
import { useAsyncData } from '@/hooks/use-async-data';

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsyncData(() => getProduct(Number(id)), [id]);
  if (loading) return null;
  if (!data) {
    return (
      <Screen>
        <AppHeader title="Product" back />
        <Text variant="body">Product not found.</Text>
      </Screen>
    );
  }
  return <ProductForm initial={data} />;
}
