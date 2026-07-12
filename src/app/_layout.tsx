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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/context/app-context';
import { Colors } from '@/constants/theme';
import { useThemeName } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, settings, locked } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || !settings) return;
    SplashScreen.hideAsync();

    const onboarded = settings.onboarded === 1;
    if (!onboarded) {
      if (pathname !== '/onboarding') router.replace('/onboarding');
      return;
    }
    if (locked) {
      if (pathname !== '/lock') router.replace('/lock');
      return;
    }
    if (pathname === '/lock' || pathname === '/onboarding') {
      router.replace('/');
    }
  }, [ready, settings, locked, pathname, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="lock" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
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
            <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
            <RootNavigator />
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
