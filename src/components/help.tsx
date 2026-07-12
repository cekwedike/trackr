import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/anim/pressable';
import { Sheet } from '@/components/nav/sheet';
import { Text } from '@/components/ui';
import { PressScale } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';

export interface HelpPoint {
  term: string;
  desc: string;
}

/**
 * A tasteful "?" affordance that opens a themed bottom sheet explaining an
 * ambiguous part of the app in plain language. Reuses the app's Sheet so it
 * stays on-brand and accessible. Provide free-form `paragraphs` and/or a list
 * of `points` (term → explanation) plus an optional `tip`.
 */
export function HelpTip({
  title,
  subtitle,
  paragraphs,
  points,
  tip,
  size = 18,
}: {
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  points?: HelpPoint[];
  tip?: string;
  size?: number;
}) {
  const t = useTheme();
  const { accent } = useApp();
  const [open, setOpen] = useState(false);
  const circle = Math.round(size * 1.35);

  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        hitSlop={10}
        scaleTo={PressScale.icon}
        opacityTo={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Help: ${title}`}
        style={{
          width: circle,
          height: circle,
          borderRadius: circle / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexToRgba(accent, 0.12),
        }}
      >
        <Ionicons name="help" size={size} color={accent} />
      </PressableScale>

      <Sheet visible={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle} icon="help-circle" accent>
        <View style={{ gap: Spacing.md }}>
          {paragraphs?.map((p, i) => (
            <Text key={`p${i}`} variant="body" color={t.textSecondary}>
              {p}
            </Text>
          ))}

          {points && points.length > 0 ? (
            <View style={{ gap: Spacing.sm }}>
              {points.map((pt, i) => (
                <View
                  key={`pt${i}`}
                  style={{
                    gap: 2,
                    backgroundColor: t.cardAlt,
                    borderRadius: Radius.md,
                    padding: Spacing.md,
                  }}
                >
                  <Text variant="label" color={t.text}>
                    {pt.term}
                  </Text>
                  <Text variant="caption" color={t.textSecondary}>
                    {pt.desc}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {tip ? (
            <View
              style={{
                flexDirection: 'row',
                gap: Spacing.sm,
                alignItems: 'flex-start',
                backgroundColor: hexToRgba(accent, 0.1),
                borderRadius: Radius.md,
                padding: Spacing.md,
              }}
            >
              <Ionicons name="bulb" size={16} color={accent} style={{ marginTop: 1 }} />
              <Text variant="caption" color={t.textSecondary} style={{ flex: 1 }}>
                {tip}
              </Text>
            </View>
          ) : null}
        </View>
      </Sheet>
    </>
  );
}
