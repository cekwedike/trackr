import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSettings } from '@/db/repos/settings';
import type { Settings } from '@/db/types';
import { formatMoney as fmtMoney } from '@/lib/money';
import { ensureNotificationHandler } from '@/lib/notifications';

interface AppContextValue {
  ready: boolean;
  settings: Settings | null;
  locked: boolean;
  reloadSettings: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
  money: (minor: number, opts?: { decimals?: 'auto' | 0 | 2; signed?: boolean }) => string;
  currencySymbol: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locked, setLocked] = useState(false);

  const reloadSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    return;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      ensureNotificationHandler();
      const s = await getSettings();
      if (!mounted) return;
      setSettings(s);
      setLocked(s.lock_enabled === 1 && s.onboarded === 1);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  const currencySymbol = settings?.currency_symbol ?? '₦';

  const money = useCallback(
    (minor: number, opts?: { decimals?: 'auto' | 0 | 2; signed?: boolean }) => fmtMoney(minor, currencySymbol, opts),
    [currencySymbol],
  );

  const value = useMemo<AppContextValue>(
    () => ({ ready, settings, locked, reloadSettings, lock, unlock, money, currencySymbol }),
    [ready, settings, locked, reloadSettings, lock, unlock, money, currencySymbol],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
