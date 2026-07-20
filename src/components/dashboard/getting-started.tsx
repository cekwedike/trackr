import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { FadeSlide } from '@/components/anim';
import { useConfirm } from '@/components/confirm';
import { Collapsible, IconButton, ListRow, Text } from '@/components/ui';
import { Duration, Ease } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { dismissChecklist, isChecklistDismissed, loadOnboardingProgress } from '@/lib/onboarding';

/**
 * A dismissible "Getting started" widget for the top of the dashboard. It derives
 * each step's done-state from real data, shows live progress, celebrates at 100%,
 * and can be permanently hidden (persisted via expo-secure-store).
 */
export function GettingStarted() {
  const t = useTheme();
  const confirm = useConfirm();
  const { industry, settings, accent } = useApp();
  const [hidden, setHidden] = useState(false);

  const { data } = useAsyncData(async () => {
    const dismissed = await isChecklistDismissed();
    if (dismissed) return { dismissed: true as const, progress: null };
    const progress = await loadOnboardingProgress(industry, settings);
    return { dismissed: false as const, progress };
  }, [industry.id, settings?.onboarded, settings?.profit_allocation]);

  if (hidden || !data || data.dismissed || !data.progress) return null;

  const { items, doneCount, total, complete } = data.progress;
  const pct = total > 0 ? doneCount / total : 0;

  const hide = async () => {
    const choice = await confirm({
      title: complete ? 'Hide checklist' : 'Hide getting started?',
      message: complete
        ? 'Nice work! You can still find everything in the Help Center.'
        : 'You can always learn the app from the Help Center in the More tab.',
      actions: [
        { label: 'Hide', style: complete ? 'default' : 'destructive', value: 'hide' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice === 'hide') {
      dismissChecklist();
      setHidden(true);
    }
  };

  return (
    <FadeSlide style={{ marginBottom: Spacing.lg }}>
      <Collapsible
        card
        persistKey="getting-started"
        icon={complete ? 'trophy' : 'rocket'}
        title={complete ? 'You’re all set!' : 'Getting started'}
        subtitle={complete ? 'Every step done — you’re a pro.' : `${doneCount} of ${total} done`}
        headerRight={<IconButton icon="close" onPress={hide} size={18} color={t.textMuted} />}
        contentStyle={{ gap: Spacing.md, paddingBottom: Spacing.md }}
      >
        <ProgressBar pct={pct} color={accent} track={t.cardAlt} />

        {complete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs }}>
            <Ionicons name="sparkles" size={16} color={accent} />
            <Text variant="caption" color={t.textSecondary} style={{ flex: 1 }}>
              You’ve set up the essentials. Tap the ✕ above to tuck this away.
            </Text>
          </View>
        ) : (
          <View>
            {items.map((it, idx) => (
              <View key={it.key}>
                <ListRow
                  icon={it.done ? 'checkmark-circle' : it.icon}
                  iconTone={it.done ? 'success' : it.tone}
                  title={it.label}
                  subtitle={it.done ? 'Done' : it.hint}
                  onPress={() => router.push(it.href)}
                  right={
                    it.done ? (
                      <Ionicons name="checkmark" size={18} color={t.success} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                    )
                  }
                />
                {idx < items.length - 1 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 54 }} /> : null}
              </View>
            ))}
          </View>
        )}
      </Collapsible>
    </FadeSlide>
  );
}

function ProgressBar({ pct, color, track }: { pct: number; color: string; track: string }) {
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, pct));
  const progress = useSharedValue(0);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  useEffect(() => {
    const duration = reduced ? Duration.instant : Duration.slow;
    progress.value = withDelay(120, withTiming(target, { duration, easing: Ease.standard }));
  }, [target, reduced, progress]);

  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: color }, fillStyle]} />
    </View>
  );
}
