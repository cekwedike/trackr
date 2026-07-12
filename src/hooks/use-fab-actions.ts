import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { FabAction } from '@/components/nav';
import type { IndustryConfig, QuickActionKey } from '@/constants/industries';
import { isQuickActionAvailable, QUICK_ACTION_META } from '@/constants/quick-actions';
import { useApp } from '@/context/app-context';

const ALL_QUICK_ACTION_KEYS = Object.keys(QUICK_ACTION_META) as QuickActionKey[];

/** Universal actions used as a last-resort default so the FAB is never empty. */
const SAFE_MINIMUM: QuickActionKey[] = ['expense', 'profit'];

/**
 * The primary entity each entity screen creates. Defaults for that screen lead
 * with this action (when the industry supports it) before filling from the
 * industry's own quick-action ordering. Routes come from `usePathname()`, which
 * returns a normalized path like `/sales` (and `/` for the dashboard), so no
 * screen file needs to pass anything explicitly.
 */
const SCREEN_PRIMARY: Record<string, QuickActionKey> = {
  '/sales': 'sale',
  '/orders': 'order',
  '/customers': 'customer',
  '/inventory': 'product',
};

/** Keep only the actions whose module is enabled for the given industry. */
function filterByIndustry(keys: QuickActionKey[], industry: IndustryConfig): QuickActionKey[] {
  return keys.filter((key) => isQuickActionAvailable(key, industry.modules));
}

function dedupe(keys: QuickActionKey[]): QuickActionKey[] {
  return Array.from(new Set(keys));
}

/**
 * Resolve the default keys for the current screen: bias toward the screen's
 * primary entity, fill from the industry's quick actions, dedupe, and filter by
 * industry support. An explicit `defaultKeys` argument (still industry-filtered)
 * always wins. Guarantees a non-empty result.
 */
function resolveDefaultKeys(
  pathname: string,
  industry: IndustryConfig,
  explicit?: QuickActionKey[],
): QuickActionKey[] {
  const industryDefaults = filterByIndustry(industry.quickActions, industry);

  if (explicit) {
    const filtered = filterByIndustry(explicit, industry);
    if (filtered.length) return filtered.slice(0, 4);
  } else {
    const lead = SCREEN_PRIMARY[pathname];
    if (lead) {
      const tailored = filterByIndustry(dedupe([lead, ...industry.quickActions]), industry);
      if (tailored.length) return tailored.slice(0, 4);
    } else {
      // Dashboard `/` and any other route: use the industry ordering as-is.
      if (industryDefaults.length) return industryDefaults.slice(0, 4);
    }
  }

  if (industryDefaults.length) return industryDefaults.slice(0, 4);
  return filterByIndustry(SAFE_MINIMUM, industry);
}

/**
 * Build movable-FAB actions from the industry's quick actions (or an explicit
 * subset), resolving icons, labels and navigation from shared metadata. The
 * result is always filtered to actions the current industry supports.
 */
export function useFabActions(keys?: QuickActionKey[]): FabAction[] {
  const router = useRouter();
  const { industry, terms } = useApp();
  const source = filterByIndustry(keys ?? industry.quickActions, industry);

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
 * The set of quick actions available to the editable FAB (filtered to what the
 * current industry supports), plus the keys shown by default for the active
 * screen + industry. Screens pass the whole candidate list to `MovableFab`,
 * which then filters it down to the user's saved selection (falling back to
 * `defaultKeys`).
 */
export function useQuickActionCandidates(defaultKeys?: QuickActionKey[]): {
  actions: FabAction[];
  defaultKeys: QuickActionKey[];
} {
  const router = useRouter();
  const pathname = usePathname();
  const { industry, terms } = useApp();

  const availableKeys = useMemo(
    () => filterByIndustry(ALL_QUICK_ACTION_KEYS, industry),
    [industry],
  );

  const actions = useMemo(
    () =>
      availableKeys.map((key) => {
        const meta = QUICK_ACTION_META[key];
        return {
          key,
          icon: meta.icon,
          label: meta.label(terms),
          onPress: () => router.push(meta.href),
        } satisfies FabAction;
      }),
    [availableKeys, terms, router],
  );

  const resolvedDefaults = useMemo(
    () => resolveDefaultKeys(pathname, industry, defaultKeys),
    [pathname, industry, defaultKeys],
  );

  return { actions, defaultKeys: resolvedDefaults };
}
