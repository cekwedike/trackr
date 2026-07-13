import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getIndustry, type IndustryConfig, type IndustryTerms } from '@/constants/industries';
import { getSettings, updateSettings } from '@/db/repos/settings';
import type { Settings } from '@/db/types';
import { formatMoney as fmtMoney } from '@/lib/money';
import { ensureNotificationHandler } from '@/lib/notifications';
import { runDueRecurring } from '@/lib/recurring';

interface AppContextValue {
  ready: boolean;
  error: string | null;
  settings: Settings | null;
  locked: boolean;
  industry: IndustryConfig;
  terms: IndustryTerms;
  accent: string;
  setIndustry: (id: string, applyDefaultAllocation?: boolean) => Promise<void>;
  reloadSettings: () => Promise<void>;
  retry: () => void;
  lock: () => void;
  unlock: () => void;
  money: (minor: number, opts?: { decimals?: 'auto' | 0 | 2; signed?: boolean }) => string;
  currencySymbol: string;
}

const AppContext = createContext<AppContextValue | null>(null);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locked, setLocked] = useState(false);

  const reloadSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    return;
  }, []);

  const init = useCallback(async () => {
    setError(null);
    setReady(false);
    try {
      try {
        ensureNotificationHandler();
      } catch {
        // notifications are non-critical for startup
      }
      const s = await withTimeout(getSettings(), 15000, 'Loading your data');
      setSettings(s);
      setLocked(s.lock_enabled === 1 && s.onboarded === 1);
      setReady(true);

      // Materialise any due recurring expenses in the background. Fire-and-forget
      // and fully guarded so it can never block or break startup. Only runs once
      // the user has finished onboarding (so we don't touch a half-set-up app).
      if (s.onboarded === 1) {
        runDueRecurring().catch(() => {
          // recurring materialisation is non-critical for startup
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  const industry = useMemo(() => getIndustry(settings?.industry), [settings?.industry]);
  const terms = industry.terms;
  const accent = industry.accent;

  const setIndustry = useCallback(
    async (id: string, applyDefaultAllocation = false) => {
      const patch: Partial<Settings> = { industry: id };
      if (applyDefaultAllocation) {
        patch.profit_allocation = JSON.stringify(getIndustry(id).defaultAllocation);
      }
      const updated = await updateSettings(patch);
      setSettings(updated);
    },
    [],
  );

  const currencySymbol = settings?.currency_symbol ?? '₦';

  const money = useCallback(
    (minor: number, opts?: { decimals?: 'auto' | 0 | 2; signed?: boolean }) => fmtMoney(minor, currencySymbol, opts),
    [currencySymbol],
  );

  const value = useMemo<AppContextValue>(
    () => ({ ready, error, settings, locked, industry, terms, accent, setIndustry, reloadSettings, retry: init, lock, unlock, money, currencySymbol }),
    [ready, error, settings, locked, industry, terms, accent, setIndustry, reloadSettings, init, lock, unlock, money, currencySymbol],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
