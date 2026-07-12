import 'react-native-gesture-handler';

import {
  DarkTheme as NavDark,
  DefaultTheme as NavLight,
  Stack,
  ThemeProvider,
  usePathname,
  useRouter,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { Button, Text } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AppProvider, useApp } from '@/context/app-context';
import { useThemeName } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function BrandLoading() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reduced]);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
    opacity: 0.85 + pulse.value * 0.15,
  }));
  return (
    <View style={{ flex: 1, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl }}>
      <Animated.View style={logoStyle}>
        <Image
          source={require('../../assets/images/splash-icon.png')}
          style={{ width: 180, height: 180 }}
          contentFit="contain"
        />
      </Animated.View>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

function StartupError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg }}>
      <Text variant="title" color="#FFFFFF">Couldn&apos;t start</Text>
      <Text variant="body" color="#DBEAFE" style={{ textAlign: 'center' }}>{message}</Text>
      <Button title="Try again" icon="refresh" variant="secondary" onPress={onRetry} />
    </View>
  );
}

function RootNavigator() {
  const { settings, locked } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const c = Colors[useThemeName()];

  useEffect(() => {
    if (!settings) return;
    const onboarded = settings.onboarded === 1;
    if (!onboarded) {
      // Brand-new users land on the welcome/landing screen first; its "Get
      // started" CTA pushes them into the onboarding wizard. We gate purely on
      // `onboarded`, so once the wizard finishes (onboarded === 1) neither the
      // welcome nor the onboarding screen is ever shown again.
      if (pathname !== '/welcome' && pathname !== '/onboarding') router.replace('/welcome');
      return;
    }
    if (locked) {
      if (pathname !== '/lock') router.replace('/lock');
      return;
    }
    if (pathname === '/lock' || pathname === '/onboarding' || pathname === '/welcome') {
      router.replace('/');
    }
  }, [settings, locked, pathname, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 260,
        gestureEnabled: true,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="lock" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}

function AppGate() {
  const { ready, error, retry } = useApp();

  // Hide the native splash as soon as React can draw, so the user always sees
  // an in-app indicator instead of a frozen splash image.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 50);
    return () => clearTimeout(timer);
  }, []);

  if (error) return <StartupError message={error} onRetry={retry} />;
  if (!ready) return <BrandLoading />;
  return <RootNavigator />;
}

export default function RootLayout() {
  const themeName = useThemeName();
  const c = Colors[themeName];

  const navTheme =
    themeName === 'dark'
      ? { ...NavDark, colors: { ...NavDark.colors, background: c.background, card: c.card, text: c.text, border: c.border, primary: c.primary } }
      : { ...NavLight, colors: { ...NavLight.colors, background: c.background, card: c.card, text: c.text, border: c.border, primary: c.primary } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style="light" />
            <AppGate />
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
