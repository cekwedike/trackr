import { View } from 'react-native';

import { AppHeader, Card, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { LEGAL_LAST_UPDATED, LEGAL_REVIEW_NOTE, type LegalSection } from '@/lib/legal-copy';
import { useTheme } from '@/hooks/use-theme';

export function LegalDoc({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: string;
  sections: LegalSection[];
}) {
  const t = useTheme();

  return (
    <Screen>
      <AppHeader title={title} subtitle={`Last updated ${LEGAL_LAST_UPDATED}`} back />

      <Card style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
        <Text variant="caption" color={t.warning} weight="semibold">
          Owner review before store submit
        </Text>
        <Text variant="caption" color={t.textSecondary}>
          {LEGAL_REVIEW_NOTE}
        </Text>
      </Card>

      {intro ? (
        <Text variant="body" color={t.textSecondary} style={{ marginBottom: Spacing.lg, lineHeight: 22 }}>
          {intro}
        </Text>
      ) : null}

      {sections.map((section) => (
        <View key={section.heading} style={{ marginBottom: Spacing.xl, gap: Spacing.sm }}>
          <Text variant="subtitle">{section.heading}</Text>
          {section.body.map((para, i) => (
            <Text key={i} variant="body" color={t.textSecondary} style={{ lineHeight: 22 }}>
              {para}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}
