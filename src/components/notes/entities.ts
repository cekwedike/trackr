import type { IconName } from '@/components/ui';
import type { LinkTargetType } from '@/db/types';

/** Visual + navigation metadata for the entity types a note can be attached to. */
export const ENTITY_META: Record<string, { icon: IconName; label: string; plural: string }> = {
  customer: { icon: 'person', label: 'Customer', plural: 'Customers' },
  product: { icon: 'cube', label: 'Product', plural: 'Products' },
  order: { icon: 'clipboard', label: 'Order', plural: 'Orders' },
  note: { icon: 'document-text', label: 'Note', plural: 'Notes' },
};

export const ENTITY_ROUTE: Record<string, string> = {
  customer: '/customers',
  product: '/products',
  order: '/orders',
};

export function entityMeta(type: LinkTargetType | string) {
  return ENTITY_META[type] ?? { icon: 'link' as IconName, label: String(type), plural: String(type) };
}
