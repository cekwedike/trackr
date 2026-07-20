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

/**
 * Human label for a linked entity. Never surfaces bare DB ids, "Order #12"
 * leftovers, or UUID/hex strings as the primary title.
 */
export function linkDisplayTitle(title: string | null | undefined, type: LinkTargetType | string): string {
  const fallback = entityMeta(type).label;
  const trimmed = title?.trim();
  if (!trimmed) return fallback;
  if (/^(order|sale|invoice|receipt|customer|product|note|expense)\s*#\s*\d+$/i.test(trimmed)) {
    return fallback;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return fallback;
  }
  if (/^[0-9a-f]{24,}$/i.test(trimmed)) return fallback;
  if (/^\d{10,}$/.test(trimmed)) return fallback;
  return trimmed;
}
