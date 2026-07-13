import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { useUndo } from '@/components/undo';
import { Button, Card, IconButton, AppHeader, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { HelpTip } from '@/components/help';
import { DateTimeField, SelectField, SelectModal } from '@/components/pickers';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import { listProducts } from '@/db/repos/products';
import { createOrder, deleteOrder, getOrderItems, ORDER_STATUSES, updateOrder } from '@/db/repos/orders';
import type { Customer, Order, OrderStatus, Product } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { fromMinor, parseMoney } from '@/lib/money';

interface Row {
  key: string;
  product_id: number | null;
  name: string;
  qty: string;
  price: string;
}

let counter = 0;
const nextKey = () => `o-${counter++}`;

export function OrderForm({ initial, onDone }: { initial?: Order; onDone?: () => void }) {
  const t = useTheme();
  const confirm = useConfirm();
  const { showUndo } = useUndo();
  const { money, currencySymbol, terms } = useApp();

  const [customerId, setCustomerId] = useState<number | null>(initial?.customer_id ?? null);
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? '');
  const [status, setStatus] = useState<OrderStatus>(initial?.status ?? 'pending');
  const [hasDue, setHasDue] = useState(!!initial?.due_at);
  const [due, setDue] = useState(initial?.due_at ? new Date(initial.due_at) : new Date());
  const [paid, setPaid] = useState(initial ? String(fromMinor(initial.amount_paid)) : '0');
  const [note, setNote] = useState(initial?.note ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productModal, setProductModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProducts().then(setProducts);
    listCustomers().then(setCustomers);
    if (initial) getOrderItems(initial.id).then((items) => setRows(items.map((it) => ({ key: nextKey(), product_id: it.product_id, name: it.name, qty: String(it.qty), price: String(fromMinor(it.unit_price)) }))));
  }, [initial]);

  const total = useMemo(() => rows.reduce((s, r) => s + Math.round(parseMoney(r.price) * (parseFloat(r.qty) || 0)), 0), [rows]);
  const balance = total - parseMoney(paid);

  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === Number(id));
    if (!p) return;
    setRows((prev) => [...prev, { key: nextKey(), product_id: p.id, name: p.name, qty: '1', price: String(fromMinor(p.price)) }]);
  };
  const addCustom = () => setRows((prev) => [...prev, { key: nextKey(), product_id: null, name: '', qty: '1', price: '' }]);
  const updateRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const save = async () => {
    if (rows.length === 0) {
      Alert.alert('Add items', 'Add at least one item to the order.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        customer_name: customerName.trim() || null,
        status,
        due_at: hasDue ? due.toISOString() : null,
        amount_paid: parseMoney(paid),
        note: note.trim() || null,
        items: rows.map((r) => ({ product_id: r.product_id, name: r.name.trim() || 'Item', qty: parseFloat(r.qty) || 0, unit_price: parseMoney(r.price) })),
      };
      if (initial) await updateOrder(initial.id, payload);
      else await createOrder(payload);
      if (onDone) onDone();
      else router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const label = terms.order.toLowerCase();
    const choice = await confirm({
      title: `Delete ${label}`,
      message: `Remove this ${label}?`,
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'delete') {
      // Snapshot the order + its line items before deleting so UNDO can re-create
      // it (new id). Best-effort: recorded payments history is not restored, but
      // amount_paid is preserved on the re-created order.
      const snap = initial;
      const snapItems = await getOrderItems(snap.id);
      await deleteOrder(snap.id);
      router.back();
      showUndo({
        message: `Deleted ${label}`,
        onUndo: () =>
          createOrder({
            customer_id: snap.customer_id,
            customer_name: snap.customer_name,
            status: snap.status,
            due_at: snap.due_at,
            amount_paid: snap.amount_paid,
            note: snap.note,
            items: snapItems.map((it) => ({
              product_id: it.product_id,
              name: it.name,
              qty: it.qty,
              unit_price: it.unit_price,
            })),
          }),
      });
    }
  };

  return (
    <Screen>
      <AppHeader title={initial ? `Edit ${terms.order.toLowerCase()}` : `New ${terms.order.toLowerCase()}`} back />

      <SectionHeader title={terms.customer} />
      <Card style={{ gap: Spacing.md }}>
        <SelectField label={`Existing ${terms.customer.toLowerCase()}`} value={customers.find((c) => c.id === customerId)?.name} placeholder="Select or type below" onPress={() => setCustomerModal(true)} />
        <TextField label="Or name" value={customerName} onChangeText={(v) => { setCustomerName(v); setCustomerId(null); }} placeholder={`${terms.customer} name`} />
      </Card>

      <SectionHeader title="Items" action="Custom item" onAction={addCustom} />
      <Card style={{ gap: Spacing.md }}>
        {rows.length === 0 ? <Text variant="caption" color={t.textMuted}>No items yet.</Text> : null}
        {rows.map((r) => (
          <View key={r.key} style={{ gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: Spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                {r.product_id ? <Text variant="body" weight="semibold">{r.name}</Text> : <TextField value={r.name} onChangeText={(v) => updateRow(r.key, { name: v })} placeholder="Item name" />}
              </View>
              <IconButton icon="trash-outline" tone="danger" size={18} onPress={() => removeRow(r.key)} />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <TextField style={{ flex: 1 }} label="Qty" value={r.qty} onChangeText={(v) => updateRow(r.key, { qty: v })} keyboardType="numeric" />
              <TextField style={{ flex: 1.4 }} label="Unit price" value={r.price} onChangeText={(v) => updateRow(r.key, { price: v })} keyboardType="numeric" prefix={currencySymbol} />
            </View>
          </View>
        ))}
        <Button title="Add product" icon="add" variant="secondary" onPress={() => setProductModal(true)} />
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <Text variant="label" color={t.textSecondary}>DETAILS</Text>
        <HelpTip
          title={`${terms.order} statuses`}
          subtitle="Track progress at a glance"
          points={[
            { term: 'Pending', desc: `A new ${terms.order.toLowerCase()} you haven’t started yet.` },
            { term: 'In progress', desc: 'You’re actively working on it.' },
            { term: 'Ready', desc: 'Finished and waiting for pickup or delivery.' },
            { term: 'Delivered', desc: 'Completed and handed over. It leaves your active pipeline.' },
            { term: 'Cancelled', desc: 'Called off. Also removed from the active pipeline.' },
          ]}
        />
      </View>
      <Card style={{ gap: Spacing.md }}>
        <SelectField label="Status" value={ORDER_STATUSES.find((s) => s.value === status)?.label} onPress={() => setStatusModal(true)} />
        <SelectField label="Due date" value={hasDue ? due.toDateString() : 'None'} onPress={() => setHasDue((v) => !v)} />
        {hasDue ? <DateTimeField value={due} onChange={setDue} /> : null}
        <TextField
          label="Amount paid"
          value={paid}
          onChangeText={setPaid}
          keyboardType="numeric"
          prefix={currencySymbol}
          right={
            <HelpTip
              title="Amount paid & balance"
              subtitle="Who owes what"
              paragraphs={[
                `Amount paid is how much the ${terms.customer.toLowerCase()} has given you so far for this ${terms.order.toLowerCase()}.`,
                'Balance = total − amount paid. It’s what they still owe. A balance above zero shows in amber until it’s fully settled; leave it as the total if nothing has been paid yet.',
              ]}
            />
          }
        />
        <TextField label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
      </Card>

      <Card style={{ gap: Spacing.sm, marginTop: Spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="body" color={t.textSecondary}>Total</Text><Text variant="body" weight="semibold">{money(total)}</Text></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="body" color={t.textSecondary}>Balance</Text><Text variant="subtitle" color={balance > 0 ? t.warning : t.success}>{money(balance)}</Text></View>
      </Card>

      <Button title={initial ? 'Save changes' : `Save ${terms.order.toLowerCase()}`} icon="checkmark" onPress={save} loading={saving} size="lg" style={{ marginTop: Spacing.lg }} />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}

      <SelectModal visible={productModal} title="Choose product" onClose={() => setProductModal(false)} onSelect={addProduct} options={products.map((p) => ({ id: String(p.id), label: p.name, sublabel: money(p.price) }))} footerLabel="Create product" onFooter={() => { setProductModal(false); router.push('/products/new'); }} />
      <SelectModal visible={customerModal} title="Choose customer" onClose={() => setCustomerModal(false)} onSelect={(id) => { setCustomerId(id ? Number(id) : null); const c = customers.find((x) => x.id === Number(id)); setCustomerName(c?.name ?? ''); }} allowClear options={customers.map((c) => ({ id: String(c.id), label: c.name, sublabel: c.phone ?? undefined }))} />
      <SelectModal visible={statusModal} title="Status" searchable={false} onClose={() => setStatusModal(false)} onSelect={(id) => setStatus(id as OrderStatus)} options={ORDER_STATUSES.map((s) => ({ id: s.value, label: s.label }))} />
    </Screen>
  );
}
