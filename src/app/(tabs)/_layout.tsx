import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { AnimatedTabBar, type AnimatedTabBarProps } from '@/components/nav/animated-tab-bar';
import type { NavTabKey } from '@/constants/industries';
import { useApp } from '@/context/app-context';

export default function TabsLayout() {
  const { industry, terms } = useApp();

  const shows = (key: NavTabKey) => industry.navTabs.includes(key);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
      }}
      tabBar={(props) => <AnimatedTabBar {...(props as unknown as AnimatedTabBarProps)} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: terms.sales,
          href: shows('sales') ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: terms.orders,
          href: shows('orders') ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: terms.inventoryLabel,
          href: shows('inventory') ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: terms.customers,
          href: shows('customers') ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
