import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui';
import type { IndustryTerms, QuickActionKey } from '@/constants/industries';

/** Shared metadata for every quick action, used by the dashboard grid and the movable FAB. */
export const QUICK_ACTION_META: Record<QuickActionKey, { icon: IconName; href: Href; label: (t: IndustryTerms) => string }> = {
  sale: { icon: 'cart', href: '/sales/new' as Href, label: (t) => `New ${t.sale.toLowerCase()}` },
  expense: { icon: 'trending-down', href: '/expenses/new' as Href, label: () => 'Add expense' },
  order: { icon: 'clipboard', href: '/orders/new' as Href, label: (t) => `New ${t.order.toLowerCase()}` },
  product: { icon: 'cube', href: '/products/new' as Href, label: (t) => `New ${t.item.toLowerCase()}` },
  customer: { icon: 'person-add', href: '/customers/new' as Href, label: (t) => `New ${t.customer.toLowerCase()}` },
  profit: { icon: 'calculator', href: '/profit' as Href, label: () => 'Profit' },
  reminder: { icon: 'alarm', href: '/reminders/new' as Href, label: () => 'Reminder' },
  recipe: { icon: 'reader', href: '/recipes/new' as Href, label: (t) => `New ${t.productionLabel.toLowerCase().replace(/s$/, '')}` },
};
