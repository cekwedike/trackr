import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { FadeSlide } from '@/components/anim';
import { AppHeader, Card, EmptyState, IconButton, ListRow, Screen, SectionHeader, Text, TextField, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { searchCustomers, type CustomerSearchRow } from '@/db/repos/customers';
import { searchExpenses } from '@/db/repos/expenses';
import { searchNotes } from '@/db/repos/notes';
import { searchOrders, type OrderSearchRow } from '@/db/repos/orders';
import { searchProducts, type ProductSearchRow } from '@/db/repos/products';
import { searchSales, type SaleSearchRow } from '@/db/repos/sales';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { tapFeedback } from '@/lib/haptics';

type ResultTone = 'success' | 'danger' | 'info' | 'warning' | 'primary';

interface ResultItem {
  key: string;
  icon: IconName;
  tone: ResultTone;
  title: string;
  subtitle?: string;
  amount?: number;
  amountTone?: 'danger';
  href: Href;
}

interface ResultGroup {
  key: string;
  title: string;
  items: ResultItem[];
}

const DEBOUNCE_MS = 250;

function snippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export default function SearchScreen() {
  const t = useTheme();
  const { money, industry, terms } = useApp();
  const { modules } = industry;

  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [searching, setSearching] = useState(false);

  // Monotonic id so out-of-order (stale) responses from rapid typing are discarded.
  const latestReq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (term: string, reqId: number) => {
      try {
      const [sales, expenses, customers, orders, notes, products] = await Promise.all([
        modules.sales ? searchSales(term) : Promise.resolve<SaleSearchRow[]>([]),
        searchExpenses(term),
        modules.customers ? searchCustomers(term) : Promise.resolve<CustomerSearchRow[]>([]),
        modules.orders ? searchOrders(term) : Promise.resolve<OrderSearchRow[]>([]),
        searchNotes(term),
        modules.inventory ? searchProducts(term) : Promise.resolve<ProductSearchRow[]>([]),
      ]);

      if (reqId !== latestReq.current) return; // a newer query superseded this one

      const next: ResultGroup[] = [];

      if (sales.length) {
        next.push({
          key: 'sales',
          title: terms.sales,
          items: sales.map((s) => ({
            key: `sale-${s.id}`,
            icon: 'cart',
            tone: 'success',
            title: s.customer_name ?? terms.sale,
            subtitle: s.note ? `${formatDate(s.occurred_at)} · ${snippet(s.note)}` : formatDate(s.occurred_at),
            amount: s.total,
            href: `/sales/${s.id}`,
          })),
        });
      }

      if (expenses.length) {
        next.push({
          key: 'expenses',
          title: 'Expenses',
          items: expenses.map((e) => ({
            key: `expense-${e.id}`,
            icon: 'wallet',
            tone: 'danger',
            title: e.description || e.category || 'Expense',
            subtitle: e.category ? `${formatDate(e.occurred_at)} · ${e.category}` : formatDate(e.occurred_at),
            amount: e.amount,
            amountTone: 'danger',
            href: `/expenses/${e.id}`,
          })),
        });
      }

      if (customers.length) {
        next.push({
          key: 'customers',
          title: terms.customers,
          items: customers.map((c) => ({
            key: `customer-${c.id}`,
            icon: 'people',
            tone: 'info',
            title: c.name,
            subtitle: c.phone || c.email || undefined,
            amount: c.debt_balance > 0 ? c.debt_balance : undefined,
            amountTone: 'danger',
            href: `/customers/${c.id}`,
          })),
        });
      }

      if (orders.length) {
        next.push({
          key: 'orders',
          title: terms.orders,
          items: orders.map((o) => ({
            key: `order-${o.id}`,
            icon: 'clipboard',
            tone: 'warning',
            title: o.customer_name || terms.order,
            subtitle: o.due_at ? `${o.status} · due ${formatDate(o.due_at)}` : o.status,
            amount: o.total,
            href: `/orders/${o.id}`,
          })),
        });
      }

      if (products.length) {
        next.push({
          key: 'products',
          title: terms.items,
          items: products.map((p) => ({
            key: `product-${p.id}`,
            icon: 'cube',
            tone: 'primary',
            title: p.name,
            subtitle: p.category || p.sku || `${p.stock} ${p.unit}`,
            amount: p.price,
            href: `/products/${p.id}`,
          })),
        });
      }

      if (notes.length) {
        next.push({
          key: 'notes',
          title: 'Notes',
          items: notes.map((n) => ({
            key: `note-${n.id}`,
            icon: 'document-text',
            tone: 'info',
            title: n.title || 'Untitled',
            subtitle: snippet(n.body) || undefined,
            href: `/notes/${n.id}`,
          })),
        });
      }

      setGroups(next);
      } catch {
        // A failed query shouldn't strand the UI in a "searching" state (which
        // previously hid the clear button behind a permanent spinner).
        if (reqId === latestReq.current) setGroups([]);
      } finally {
        if (reqId === latestReq.current) setSearching(false);
      }
    },
    [modules.sales, modules.customers, modules.orders, modules.inventory, terms],
  );

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      if (timer.current) clearTimeout(timer.current);
      const term = text.trim();
      const reqId = ++latestReq.current;
      if (!term) {
        setGroups([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      timer.current = setTimeout(() => {
        void runSearch(term, reqId);
      }, DEBOUNCE_MS);
    },
    [runSearch],
  );

  const clear = useCallback(() => {
    tapFeedback();
    onChangeQuery('');
  }, [onChangeQuery]);

  const go = useCallback((href: Href) => {
    tapFeedback();
    router.push(href);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const trimmed = query.trim();
  const showPrompt = trimmed === '';
  const showNoResults = !showPrompt && !searching && groups.length === 0;
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Screen>
      <AppHeader title="Search" back />

      <TextField
        value={query}
        onChangeText={onChangeQuery}
        placeholder="Search everything…"
        autoFocus
        style={{ marginBottom: Spacing.lg }}
        right={
          query.length > 0 ? (
            // Keep the clear (×) button mounted and tappable even while a search
            // is in flight — show the spinner beside it, never in place of it.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              {searching ? <ActivityIndicator size="small" color={t.textMuted} /> : null}
              <IconButton icon="close-circle" size={18} color={t.textMuted} onPress={clear} />
            </View>
          ) : (
            <Ionicons name="search" size={18} color={t.textMuted} />
          )
        }
      />

      {showPrompt ? (
        <EmptyState
          icon="search-outline"
          title="Search your business"
          message={`Find ${terms.sales.toLowerCase()}, expenses, ${terms.customers.toLowerCase()}, notes and more.`}
        />
      ) : showNoResults ? (
        <EmptyState icon="sad-outline" title="No matches" message={`Nothing found for “${trimmed}”. Try a different word.`} />
      ) : (
        <>
          {totalCount > 0 ? (
            <Text variant="caption" color={t.textMuted} style={{ marginBottom: Spacing.md }}>
              {totalCount} {totalCount === 1 ? 'result' : 'results'}
            </Text>
          ) : null}
          {groups.map((grp, gi) => (
            <FadeSlide key={grp.key} delay={Math.min(gi * 60, 300)} style={{ marginBottom: Spacing.lg }}>
              <SectionHeader title={`${grp.title} · ${grp.items.length}`} />
              <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
                {grp.items.map((it, idx) => (
                  <View key={it.key}>
                    <ListRow
                      icon={it.icon}
                      iconTone={it.tone}
                      title={it.title}
                      subtitle={it.subtitle}
                      onPress={() => go(it.href)}
                      right={
                        it.amount !== undefined ? (
                          <Text variant="body" weight="bold" color={it.amountTone === 'danger' ? t.danger : t.text}>
                            {money(it.amount)}
                          </Text>
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                        )
                      }
                    />
                    {idx < grp.items.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                  </View>
                ))}
              </Card>
            </FadeSlide>
          ))}
        </>
      )}
    </Screen>
  );
}
