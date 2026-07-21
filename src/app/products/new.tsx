import { useLocalSearchParams } from 'expo-router';

import { ProductForm } from '@/components/forms/product-form';

export default function NewProduct() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  return <ProductForm initialBarcode={barcode} />;
}
