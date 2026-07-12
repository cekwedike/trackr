import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { FabAction } from '@/components/nav';
import type { QuickActionKey } from '@/constants/industries';
import { QUICK_ACTION_META } from '@/constants/quick-actions';
import { useApp } from '@/context/app-context';

const ALL_QUICK_ACTION_KEYS = Object.keys(QUICK_ACTION_META) as QuickActionKey[];

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

/**
 * The full set of quick actions available to the editable FAB, plus the keys
 * that should be shown by default for the active industry. Screens pass the
 * whole candidate list to `MovableFab`, which then filters it down to the
 * user's saved selection (falling back to `defaultKeys`).
 */
export function useQuickActionCandidates(defaultKeys?: QuickActionKey[]): {
  actions: FabAction[];
  defaultKeys: QuickActionKey[];
} {
  const router = useRouter();
  const { industry, terms } = useApp();
  const fallback = defaultKeys ?? industry.quickActions;

  const actions = useMemo(
    () =>
      ALL_QUICK_ACTION_KEYS.map((key) => {
        const meta = QUICK_ACTION_META[key];
        return {
          key,
          icon: meta.icon,
          label: meta.label(terms),
          onPress: () => router.push(meta.href),
        } satisfies FabAction;
      }),
    [terms, router],
  );

  return { actions, defaultKeys: fallback };
}
