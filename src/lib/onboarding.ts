import type { Href } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import type { IconName } from '@/components/ui';
import type { IndustryConfig } from '@/constants/industries';
import { countCustomers } from '@/db/repos/customers';
import { countExpenses } from '@/db/repos/expenses';
import { countProfitRecords } from '@/db/repos/profit';
import { countProducts } from '@/db/repos/products';
import { countRecipes } from '@/db/repos/recipes';
import { countReminders } from '@/db/repos/reminders';
import { countSales } from '@/db/repos/sales';
import type { Settings } from '@/db/types';

const DISMISS_KEY = 'onboarding.checklist.dismissed';
const FAQ_VISITED_KEY = 'onboarding.faqVisited';
const PROFIT_SPLIT_KEY = 'onboarding.profitSplitSet';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'info';

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  tone: Tone;
  href: Href;
  done: boolean;
}

export interface OnboardingProgress {
  items: ChecklistItem[];
  doneCount: number;
  total: number;
  complete: boolean;
}

/** Records that the user has opened the Help Center at least once. */
export async function markFaqVisited(): Promise<void> {
  await SecureStore.setItemAsync(FAQ_VISITED_KEY, '1').catch(() => {});
}

/**
 * Records that the user has saved a profit split from the Profit screen.
 * Onboarding seeds `settings.profit_allocation` with an industry default, so
 * presence of that field alone cannot mean "done" — this flag is set when the
 * Profit UI actually writes the split (Done / Record).
 */
export async function markProfitSplitSet(): Promise<void> {
  await SecureStore.setItemAsync(PROFIT_SPLIT_KEY, '1').catch(() => {});
}

/** True once the user has permanently hidden the Getting-started checklist. */
export async function isChecklistDismissed(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(DISMISS_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function dismissChecklist(): Promise<void> {
  await SecureStore.setItemAsync(DISMISS_KEY, '1').catch(() => {});
}

/**
 * Builds the "Getting started" checklist for the active industry, deriving each
 * item's done-state from real data (counts) so it stays honest as the user works.
 */
export async function loadOnboardingProgress(
  industry: IndustryConfig,
  settings: Settings | null,
): Promise<OnboardingProgress> {
  const { modules, terms } = industry;

  const [sales, products, customers, expenses, recipes, reminders, profitMonths, faqRaw, profitSplitRaw] =
    await Promise.all([
      modules.sales ? countSales() : Promise.resolve(0),
      modules.inventory ? countProducts() : Promise.resolve(0),
      modules.customers ? countCustomers() : Promise.resolve(0),
      countExpenses(),
      modules.recipes ? countRecipes() : Promise.resolve(0),
      countReminders(),
      countProfitRecords(),
      SecureStore.getItemAsync(FAQ_VISITED_KEY).catch(() => null),
      SecureStore.getItemAsync(PROFIT_SPLIT_KEY).catch(() => null),
    ]);

  const items: ChecklistItem[] = [];

  items.push({
    key: 'business',
    label: 'Set up your business',
    hint: 'Name, industry, currency & security',
    icon: 'business',
    tone: 'primary',
    href: '/settings',
    done: settings?.onboarded === 1,
  });

  if (modules.sales) {
    items.push({
      key: 'sale',
      label: `Record your first ${terms.sale.toLowerCase()}`,
      hint: 'Log income the moment money comes in',
      icon: 'cart',
      tone: 'success',
      href: '/sales/new',
      done: sales > 0,
    });
  }

  if (modules.inventory) {
    items.push({
      key: 'product',
      label: `Add your first ${terms.item.toLowerCase()}`,
      hint: `Set prices & track ${terms.items.toLowerCase()}`,
      icon: 'cube',
      tone: 'primary',
      href: '/products/new',
      done: products > 0,
    });
  }

  if (modules.customers) {
    items.push({
      key: 'customer',
      label: `Add a ${terms.customer.toLowerCase()}`,
      hint: 'Keep contacts, debts & birthdays',
      icon: 'people',
      tone: 'info',
      href: '/customers/new',
      done: customers > 0,
    });
  }

  items.push({
    key: 'expense',
    label: 'Log an expense',
    hint: 'Track what you spend to see true profit',
    icon: 'wallet',
    tone: 'danger',
    href: '/expenses/new',
    done: expenses > 0,
  });

  if (modules.recipes) {
    items.push({
      key: 'recipe',
      label: `Cost a ${terms.productionLabel.toLowerCase().replace(/s$/, '')}`,
      hint: 'Work out cost & profit per batch',
      icon: 'restaurant',
      tone: 'success',
      href: '/recipes/new',
      done: recipes > 0,
    });
  }

  // Prefer the Profit-screen save flag (settings.profit_allocation write). Fall
  // back to recorded months so older installs that already closed a month still
  // count as done without re-saving the split.
  const profitSplitDone = profitSplitRaw === '1' || profitMonths > 0;

  items.push({
    key: 'profit',
    label: 'Set your profit split',
    hint: 'Decide where each month’s profit goes',
    icon: 'calculator',
    tone: 'accent',
    href: '/profit',
    done: profitSplitDone,
  });

  items.push({
    key: 'reminder',
    label: 'Create a reminder',
    hint: 'Never forget a task or follow-up',
    icon: 'alarm',
    tone: 'warning',
    href: '/reminders/new',
    done: reminders > 0,
  });

  items.push({
    key: 'faq',
    label: 'Explore the Help Center',
    hint: 'Answers to common questions',
    icon: 'help-circle',
    tone: 'info',
    href: '/faq',
    done: faqRaw === '1',
  });

  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, total: items.length, complete: doneCount === items.length };
}
