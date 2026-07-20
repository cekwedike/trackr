import { View } from 'react-native';

import { AppHeader, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { LEGAL_LAST_UPDATED, type LegalSection } from '@/lib/legal-copy';
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
