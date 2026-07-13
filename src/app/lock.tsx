import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Aurora, PressableScale } from '@/components/anim';
import { Brand, Text } from '@/components/ui';
import { Spring } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { authenticateBiometric, isBiometricAvailable, verifyPin } from '@/lib/auth';
import { successFeedback, tapFeedback, warningFeedback } from '@/lib/haptics';

export default function Lock() {
  const t = useTheme();
  const { settings, unlock } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const autoPrompted = useRef(false);
  const shake = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Only offer biometrics when the user opted in AND the device can actually
  // do it (hardware present + a fingerprint/face enrolled).
  const biometricEnabled = settings?.biometric_enabled === 1;

  useEffect(() => {
    let active = true;
    // Resolve readiness asynchronously so we never call setState synchronously
    // in the effect body. Readiness = opted in AND device supports/enrolled.
    Promise.resolve(biometricEnabled ? isBiometricAvailable() : false).then((ok) => {
      if (active) setBiometricReady(ok);
    });
    return () => {
      active = false;
    };
  }, [biometricEnabled]);

  const tryBiometric = useCallback(async () => {
    if (!biometricEnabled || !biometricReady) return;
    const ok = await authenticateBiometric(`Unlock ${settings?.business_name ?? 'Trackr'}`);
    // On failure or cancel we stay locked and the PIN pad remains available.
    if (ok) {
      successFeedback();
      unlock();
    }
  }, [biometricEnabled, biometricReady, settings?.business_name, unlock]);

  useEffect(() => {
    // Auto-prompt exactly once, as soon as biometrics are confirmed available.
    if (biometricReady && !autoPrompted.current) {
      autoPrompted.current = true;
      tryBiometric();
    }
  }, [biometricReady, tryBiometric]);

  const attempt = useCallback(
    async (candidate: string) => {
      const ok = await verifyPin(candidate);
      if (ok) {
        successFeedback();
        unlock();
      } else if (candidate.length >= 6) {
        setError(true);
        warningFeedback();
        shake.value = withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-7, { duration: 50 }),
          withTiming(7, { duration: 50 }),
          withSpring(0, Spring.snappy),
        );
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    },
    [unlock, shake],
  );

  const press = (digit: string) => {
    setError(false);
    tapFeedback();
    const next = (pin + digit).slice(0, 6);
    setPin(next);
    if (next.length >= 4) attempt(next);
  };

  const backspace = () => {
    setError(false);
    tapFeedback();
    setPin((p) => p.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={{ flex: 1, backgroundColor: t.background, justifyContent: 'center', padding: Spacing.xl }}>
      <Aurora colors={[t.primary, t.accent, t.info]} opacity={0.22} />
      <View style={{ alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xxl }}>
        <Brand size={64} />
        <Text variant="title">{settings?.business_name ?? 'Trackr'}</Text>
        <Text variant="body" color={t.textSecondary}>Enter your PIN to unlock</Text>
      </View>

      <Animated.View style={[{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.xxl }, shakeStyle]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <PinDot key={i} filled={i < pin.length} error={error} />
        ))}
      </Animated.View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg, maxWidth: 300, alignSelf: 'center' }}>
        {keys.map((k) => (
          <PadButton key={k} label={k} onPress={() => press(k)} />
        ))}
        {biometricReady ? (
          <PadButton icon="finger-print" onPress={tryBiometric} />
        ) : (
          <View style={{ width: 76, height: 76 }} />
        )}
        <PadButton label="0" onPress={() => press('0')} />
        <PadButton icon="backspace-outline" onPress={backspace} />
      </View>

      {biometricReady ? (
        <PressableScale onPress={tryBiometric} hitSlop={8} style={{ alignSelf: 'center', marginTop: Spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Ionicons name="finger-print" size={18} color={t.primary} />
            <Text variant="label" color={t.primary}>Use biometrics</Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

function PinDot({ filled, error }: { filled: boolean; error: boolean }) {
  const t = useTheme();
  const scale = useSharedValue(filled ? 1 : 0.6);
  useEffect(() => {
    scale.value = withSpring(filled ? 1 : 0.6, Spring.bouncy);
  }, [filled, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: filled ? (error ? t.danger : t.primary) : 'transparent',
          borderWidth: 1.5,
          borderColor: error ? t.danger : filled ? t.primary : t.borderStrong,
        },
        style,
      ]}
    />
  );
}

function PadButton({ label, icon, onPress }: { label?: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.88}
      style={{
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: t.cardAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? <Ionicons name={icon} size={26} color={t.text} /> : <Text variant="title">{label}</Text>}
    </PressableScale>
  );
}
