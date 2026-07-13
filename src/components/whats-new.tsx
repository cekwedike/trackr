import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Sheet } from '@/components/nav/sheet';
import type { IconName } from '@/components/ui';
import { Button, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';

export interface Release {
  version: string;
  date?: string;
  highlights: string[];
}

/**
 * User-facing changelog, newest first. The first entry is what the "What's new"
 * sheet shows after an update. Keep highlights short and benefit-led — this is
 * marketing copy the user reads once, not a technical diff.
 */
export const CHANGELOG: Release[] = [
  {
    version: '1.0.0',
    date: 'July 2026',
    highlights: [
      'Reports & analytics — see profit, trends and best sellers at a glance',
      'Receivables & debtors — track who owes you and chase what’s due',
      'Record payments against sales and debts as money comes in',
      'Recurring expenses so regular bills log themselves',
      'Attach photos & receipts to your records',
      'Backup & restore, plus CSV export of your data',
      'Biometric unlock to keep your books private',
      'Restock view to spot low stock fast',
      'One-tap demo data to explore the app',
      'A collapsible, customisable dashboard',
      'Refined themed dialogs and smoother keyboard handling',
    ],
  },
];

const LAST_SEEN_KEY = 'whatsNew.lastSeenVersion';

/** Version string shown/gated against — the installed app version. */
function currentVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/** Last app version the user has seen the "What's new" sheet for (null if never). */
export async function getLastSeenVersion(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Marks a version as seen so the sheet won't reappear until the next update. */
export async function setLastSeenVersion(version: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_SEEN_KEY, version).catch(() => {});
}

// Lightweight module-level emitter so a future Settings/More entry can trigger
// the (single, already-mounted) sheet on demand via `openWhatsNew()` without
// prop-drilling or a shared ref.
type Listener = () => void;
const listeners = new Set<Listener>();

/** Imperatively open the "What's new" sheet (e.g. from a "What's new" menu row). */
export function openWhatsNew(): void {
  listeners.forEach((l) => l());
}

/**
 * Shows the latest changelog once after the app version changes.
 *
 * Gate: only when the user is onboarded and unlocked, and the stored last-seen
 * version differs from the installed version. New-user no-op: when nothing has
 * been stored yet (brand-new install, or the first build to ship this feature)
 * we silently seed the current version instead of popping the sheet — so users
 * who just onboarded never see it, and only genuine updates trigger it from
 * then on. Can also be opened on demand via the exported `openWhatsNew()`.
 */
export function WhatsNewSheet() {
  const t = useTheme();
  const { accent, settings, locked } = useApp();
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);

  const onboarded = settings?.onboarded === 1;
  const latest = CHANGELOG[0];

  // On-demand trigger (ignores the version gate — always shows the latest).
  useEffect(() => {
    const open = () => setVisible(true);
    listeners.add(open);
    return () => {
      listeners.delete(open);
    };
  }, []);

  // Automatic post-update check. Never runs during onboarding or while locked.
  useEffect(() => {
    if (!onboarded || locked) return;
    const version = currentVersion();
    if (!version) return;

    let cancelled = false;
    (async () => {
      const lastSeen = await getLastSeenVersion();
      if (cancelled) return;
      if (lastSeen == null) {
        // No baseline yet: treat as already-seen so brand-new users aren't
        // greeted by a changelog for features they never had a previous version without.
        await setLastSeenVersion(version);
        return;
      }
      if (lastSeen !== version) setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [onboarded, locked]);

  const handleClose = useCallback(() => {
    setVisible(false);
    const version = currentVersion();
    if (version) void setLastSeenVersion(version);
  }, []);

  if (!latest) return null;

  const bulletIcon: IconName = 'checkmark-circle';

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title="What’s new"
      subtitle={latest.date ? `Version ${latest.version} · ${latest.date}` : `Version ${latest.version}`}
      icon="sparkles"
      accent
    >
      <ScrollView
        style={{ maxHeight: height * 0.5 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.xs }}
      >
        {latest.highlights.map((highlight, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: Radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hexToRgba(accent, 0.14),
                marginTop: 1,
              }}
            >
              <Ionicons name={bulletIcon} size={16} color={accent} />
            </View>
            <Text variant="body" color={t.text} style={{ flex: 1 }}>
              {highlight}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Button title="Got it" icon="checkmark" onPress={handleClose} style={{ marginTop: Spacing.lg }} />
    </Sheet>
  );
}
