import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { AppHeader, Card, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';

interface Item {
  icon: IconName;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'info';
  title: string;
  subtitle: string;
  href: Href;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Money',
    items: [
      { icon: 'wallet', tone: 'danger', title: 'Expenses', subtitle: 'Track what you spend', href: '/expenses' },
      { icon: 'calculator', tone: 'primary', title: 'Profit calculator', subtitle: 'Profit & allocation', href: '/profit' },
      { icon: 'bar-chart', tone: 'accent', title: 'Analytics', subtitle: 'Trends & best sellers', href: '/analytics' },
    ],
  },
  {
    title: 'Customers & orders',
    items: [
      { icon: 'people', tone: 'info', title: 'Customers', subtitle: 'Contacts, birthdays, debts', href: '/customers' },
      { icon: 'clipboard', tone: 'warning', title: 'Orders', subtitle: 'Manage customer orders', href: '/orders' },
    ],
  },
  {
    title: 'Production',
    items: [
      { icon: 'restaurant', tone: 'success', title: 'Recipes', subtitle: 'Cost & profit per batch', href: '/recipes' },
    ],
  },
  {
    title: 'Productivity',
    items: [
      { icon: 'alarm', tone: 'primary', title: 'Reminders', subtitle: 'Never forget a task', href: '/reminders' },
    ],
  },
];

export default function More() {
  const t = useTheme();
  const { settings } = useApp();

  return (
    <Screen>
      <AppHeader title="More" subtitle={settings?.business_name ?? undefined} />
      {GROUPS.map((g) => (
        <View key={g.title} style={{ marginBottom: Spacing.lg }}>
          <SectionHeader title={g.title} />
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
            {g.items.map((it, idx) => (
              <View key={it.title}>
                <ListRow icon={it.icon} iconTone={it.tone} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.href)} right={<Chevron />} />
                {idx < g.items.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
              </View>
            ))}
          </Card>
        </View>
      ))}

      <SectionHeader title="App" />
      <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
        <ListRow icon="settings" iconTone="primary" title="Settings" subtitle="Business, currency, security, backup" onPress={() => router.push('/settings')} right={<Chevron />} />
      </Card>

      <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center', marginTop: Spacing.xl }}>
        Trackr · by Siryus Creative Media Ltd
      </Text>
    </Screen>
  );
}

function Chevron() {
  const t = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={t.textMuted} />;
}
