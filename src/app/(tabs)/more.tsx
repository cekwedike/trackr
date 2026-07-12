import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlide } from '@/components/anim';
import { CollapsibleSidebar, type SidebarItem } from '@/components/nav';
import { AppHeader, Card, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'info';
interface Item {
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
  href: Href;
}

export default function More() {
  const t = useTheme();
  const { settings, industry, terms } = useApp();
  const { modules } = industry;
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const groups = useMemo(() => {
    const g: { title: string; items: Item[] }[] = [];

    const money: Item[] = [];
    if (modules.sales) money.push({ icon: 'cart', tone: 'success', title: `${terms.sales} history`, subtitle: `All recorded ${terms.sales.toLowerCase()}`, href: '/sales' });
    money.push({ icon: 'wallet', tone: 'danger', title: 'Expenses', subtitle: 'Track what you spend', href: '/expenses' });
    money.push({ icon: 'calculator', tone: 'primary', title: 'Profit Calculator', subtitle: 'Profit & allocation', href: '/profit' });
    money.push({ icon: 'bar-chart', tone: 'accent', title: 'Analytics', subtitle: 'Trends & best sellers', href: '/analytics' });
    g.push({ title: 'Money', items: money });

    const rel: Item[] = [];
    if (modules.customers) rel.push({ icon: 'people', tone: 'info', title: terms.customers, subtitle: `Contacts, birthdays, debts`, href: '/customers' });
    if (modules.orders) rel.push({ icon: 'clipboard', tone: 'warning', title: terms.orders, subtitle: `Manage ${terms.customer.toLowerCase()} ${terms.orders.toLowerCase()}`, href: '/orders' });
    if (rel.length) g.push({ title: `${terms.customers} & ${terms.orders.toLowerCase()}`, items: rel });

    const cat: Item[] = [];
    if (modules.inventory) cat.push({ icon: 'cube', tone: 'primary', title: terms.inventoryLabel, subtitle: `Manage your ${terms.items.toLowerCase()}`, href: '/inventory' });
    if (modules.recipes) cat.push({ icon: 'restaurant', tone: 'success', title: terms.productionLabel, subtitle: 'Cost & profit per batch', href: '/recipes' });
    if (cat.length) g.push({ title: terms.inventoryLabel, items: cat });

    g.push({
      title: 'Productivity',
      items: [
        { icon: 'document-text', tone: 'info', title: 'Notes', subtitle: 'Jot down ideas & to-dos', href: '/notes' },
        { icon: 'alarm', tone: 'primary', title: 'Reminders', subtitle: 'Never forget a task', href: '/reminders' },
      ],
    });
    return g;
  }, [modules.sales, modules.customers, modules.orders, modules.inventory, modules.recipes, terms]);

  const sidebarItems = useMemo<SidebarItem[]>(
    () => [
      ...groups.flatMap((grp) => grp.items.map((it) => ({ key: String(it.href), icon: it.icon, label: it.title, onPress: () => router.push(it.href) }))),
      { key: 'settings', icon: 'settings' as IconName, label: 'Settings', onPress: () => router.push('/settings') },
    ],
    [groups],
  );

  if (wide) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <CollapsibleSidebar items={sidebarItems} activeKey="settings" />
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg }} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <AppHeader title="More" subtitle={settings?.business_name ?? undefined} />
            {groups.map((grp) => (
              <View key={grp.title} style={{ gap: Spacing.sm }}>
                <SectionHeader title={grp.title} />
                <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
                  {grp.items.map((it, idx) => (
                    <View key={it.title}>
                      <ListRow icon={it.icon} iconTone={it.tone} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.href)} right={<Chevron />} />
                      {idx < grp.items.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                    </View>
                  ))}
                </Card>
              </View>
            ))}
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              <ListRow icon="settings" iconTone="primary" title="Settings" subtitle="Business, currency, security, backup" onPress={() => router.push('/settings')} right={<Chevron />} />
            </Card>
            <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center' }}>Trackr v1.0.0</Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Screen>
      <AppHeader title="More" subtitle={settings?.business_name ?? undefined} />
      {groups.map((grp, gi) => (
        <FadeSlide key={grp.title} delay={Math.min(gi * 70, 320)} style={{ marginBottom: Spacing.lg }}>
          <SectionHeader title={grp.title} />
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {grp.items.map((it, idx) => (
              <View key={it.title}>
                <ListRow icon={it.icon} iconTone={it.tone} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.href)} right={<Chevron />} />
                {idx < grp.items.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </View>
            ))}
          </Card>
        </FadeSlide>
      ))}

      <SectionHeader title="App" />
      <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
        <ListRow icon="settings" iconTone="primary" title="Settings" subtitle="Business, currency, security, backup" onPress={() => router.push('/settings')} right={<Chevron />} />
      </Card>

      <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center', marginTop: Spacing.xl }}>
        Trackr v1.0.0
      </Text>
    </Screen>
  );
}

function Chevron() {
  const t = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={t.textMuted} />;
}
