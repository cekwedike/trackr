import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Friendly fallback when a route is missing or mistyped. */
export default function NotFoundScreen() {
  const t = useTheme();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View
        style={{
          flex: 1,
          backgroundColor: t.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing.xl,
          gap: Spacing.lg,
        }}
      >
        <Text variant="title" style={{ textAlign: 'center' }}>
          Page not found
        </Text>
        <Text variant="body" color={t.textSecondary} style={{ textAlign: 'center', maxWidth: 320 }}>
          That screen isn’t in Trackr. It may have moved, or the link is outdated.
        </Text>
        <Button title="Go to dashboard" icon="home-outline" onPress={() => router.replace('/')} />
      </View>
    </>
  );
}
