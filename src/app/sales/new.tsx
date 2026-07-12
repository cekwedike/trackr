import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, IconButton, Screen, AppHeader, SectionHeader, Text, TextField } from '@/components/ui';
import { HelpTip } from '@/components/help';
import { DateTimeField, SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import { listProducts } from '@/db/repos/products';
import { createSale } from '@/db/repos/sales';
import type { Customer, PaymentMethod, Product } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { fromMinor, parseMoney } from '@/lib/money';

interface LineItem {
  key: string;
  product_id: number | null;
  name: string;
  qty: string;
  price: string; // major units
  unit_cost: number; // minor
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit (owed)' },
  { value: 'other', label: 'Other' },
];

let keyCounter = 0;
const nextKey = () => `item-${keyCounter++}`;

export default function NewSale() {
  const t = useTheme();
  const { money, currencySymbol } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [productModal, setProductModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [methodModal, setMethodModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProducts().then(setProducts);
    listCustomers().then(setCustomers);
  }, []);

  const total = useMemo(
    () => items.reduce((s, it) => s + Math.round(parseMoney(it.price) * (parseFloat(it.qty) || 0)), 0),
    [items],
  );

  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === Number(id));
    if (!p) return;
    setItems((prev) => [
      ...prev,
      { key: nextKey(), product_id: p.id, name: p.name, qty: '1', price: String(fromMinor(p.price)), unit_cost: p.cost },
    ]);
  };

  const addCustomItem = () => {
    setItems((prev) => [...prev, { key: nextKey(), product_id: null, name: '', qty: '1', price: '', unit_cost: 0 }]);
  };

  const updateItem = (key: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const customerName = customers.find((c) => c.id === customerId)?.name ?? null;

  const save = async () => {
    if (items.length === 0) {
      Alert.alert('Add items', 'Add at least one item to record a sale.');
      return;
    }
    setSaving(true);
    try {
      await createSale({
        occurred_at: occurredAt.toISOString(),
        payment_method: method,
        customer_id: customerId,
        note: note.trim() || null,
        items: items.map((it) => ({
          product_id: it.product_id,
          name: it.name.trim() || 'Item',
          qty: parseFloat(it.qty) || 0,
          unit_price: parseMoney(it.price),
          unit_cost: it.unit_cost,
        })),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="New sale" back />

      <SectionHeader title="Items" action="Custom item" onAction={addCustomItem} />
      <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
        {items.length === 0 ? (
          <Text variant="caption" color={t.textMuted}>No items added yet.</Text>
        ) : (
          items.map((it) => (
            <View key={it.key} style={{ gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  {it.product_id ? (
                    <Text variant="body" weight="semibold">{it.name}</Text>
                  ) : (
                    <TextField value={it.name} onChangeText={(v) => updateItem(it.key, { name: v })} placeholder="Item name" />
                  )}
                </View>
                <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => removeItem(it.key)} />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TextField
                  style={{ flex: 1 }}
                  label="Qty"
                  value={it.qty}
                  onChangeText={(v) => updateItem(it.key, { qty: v })}
                  keyboardType="numeric"
                />
                <TextField
                  style={{ flex: 1.4 }}
                  label="Unit price"
                  value={it.price}
                  onChangeText={(v) => updateItem(it.key, { price: v })}
                  keyboardType="numeric"
                  prefix={currencySymbol}
                />
                <View style={{ justifyContent: 'flex-end', paddingBottom: Spacing.sm }}>
                  <Text variant="caption" color={t.textSecondary}>Subtotal</Text>
                  <Text variant="body" weight="semibold">
                    {money(Math.round(parseMoney(it.price) * (parseFloat(it.qty) || 0)))}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
        <Button title="Add product" icon="add" variant="secondary" onPress={() => setProductModal(true)} />
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <Text variant="label" color={t.textSecondary}>DETAILS</Text>
        <HelpTip
          title="Payment methods"
          subtitle="How you were paid"
          points={[
            { term: 'Cash', desc: 'Paid in physical cash.' },
            { term: 'Transfer', desc: 'Sent to your bank account.' },
            { term: 'POS', desc: 'Paid via a POS terminal.' },
            { term: 'Card', desc: 'Paid by debit or credit card.' },
            { term: 'Credit (owed)', desc: 'Not paid yet. Trackr adds the amount to the customer’s debt balance automatically.' },
            { term: 'Other', desc: 'Anything that doesn’t fit the above.' },
          ]}
          tip="Choosing a customer with a Credit sale keeps their running debt accurate."
        />
      </View>
      <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
        <DateTimeField label="Date & time" value={occurredAt} onChange={setOccurredAt} />
        <SelectField label="Payment method" value={PAYMENT_METHODS.find((m) => m.value === method)?.label} onPress={() => setMethodModal(true)} />
        <SelectField label="Customer (optional)" value={customerName} placeholder="Walk-in / none" onPress={() => setCustomerModal(true)} />
        <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything to remember" multiline />
      </Card>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
        <Text variant="subtitle">Total</Text>
        <Text variant="title" color={t.success}>{money(total)}</Text>
      </Card>

      <Button title="Save sale" icon="checkmark" onPress={save} loading={saving} size="lg" />

      <SelectModal
        visible={productModal}
        title="Choose product"
        onClose={() => setProductModal(false)}
        onSelect={addProduct}
        options={products.map((p) => ({ id: String(p.id), label: p.name, sublabel: `${money(p.price)} · ${p.stock} ${p.unit}` }))}
        footerLabel="Create a product"
        onFooter={() => {
          setProductModal(false);
          router.push('/products/new');
        }}
      />
      <SelectModal
        visible={customerModal}
        title="Choose customer"
        onClose={() => setCustomerModal(false)}
        onSelect={(id) => setCustomerId(id ? Number(id) : null)}
        allowClear
        options={customers.map((c) => ({ id: String(c.id), label: c.name, sublabel: c.phone ?? undefined }))}
        footerLabel="Add customer"
        onFooter={() => {
          setCustomerModal(false);
          router.push('/customers/new');
        }}
      />
      <SelectModal
        visible={methodModal}
        title="Payment method"
        searchable={false}
        onClose={() => setMethodModal(false)}
        onSelect={(id) => setMethod(id as PaymentMethod)}
        options={PAYMENT_METHODS.map((m) => ({ id: m.value, label: m.label }))}
      />
    </Screen>
  );
}
