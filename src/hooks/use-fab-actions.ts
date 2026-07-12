import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { FabAction } from '@/components/nav';
import type { QuickActionKey } from '@/constants/industries';
import { QUICK_ACTION_META } from '@/constants/quick-actions';
import { useApp } from '@/context/app-context';

/**
 * Build movable-FAB actions from the industry's quick actions (or an explicit
 * subset), resolving icons, labels and navigation from shared metadata.
 */
export function useFabActions(keys?: QuickActionKey[]): FabAction[] {
  const router = useRouter();
  const { industry, terms } = useApp();
  const source = keys ?? industry.quickActions;

  return useMemo(
    () =>
      source.map((key) => {
        const meta = QUICK_ACTION_META[key];
        return {
          key,
          icon: meta.icon,
          label: meta.label(terms),
          onPress: () => router.push(meta.href),
        } satisfies FabAction;
      }),
    [source, terms, router],
  );
}
