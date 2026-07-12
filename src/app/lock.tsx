import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { authenticateBiometric, verifyPin } from '@/lib/auth';

export default function Lock() {
  const t = useTheme();
  const { settings, unlock } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const tryBiometric = useCallback(async () => {
    if (settings?.biometric_enabled === 1) {
      const ok = await authenticateBiometric();
      if (ok) unlock();
    }
  }, [settings, unlock]);

  useEffect(() => {
    tryBiometric();
  }, [tryBiometric]);

  const attempt = useCallback(
    async (candidate: string) => {
      const ok = await verifyPin(candidate);
      if (ok) {
        unlock();
      } else if (candidate.length >= 6) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    },
    [unlock],
  );

  const press = (digit: string) => {
    setError(false);
    const next = (pin + digit).slice(0, 6);
    setPin(next);
    if (next.length >= 4) attempt(next);
  };

  const backspace = () => {
    setError(false);
    setPin((p) => p.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={{ flex: 1, backgroundColor: t.background, justifyContent: 'center', padding: Spacing.xl }}>
      <View style={{ alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xxl }}>
        <View style={{ width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed" size={30} color="#FFFFFF" />
        </View>
        <Text variant="title">{settings?.business_name ?? 'Trackr'}</Text>
        <Text variant="body" color={t.textSecondary}>Enter your PIN to unlock</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.xxl }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const filled = i < pin.length;
          return (
            <View
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: filled ? (error ? t.danger : t.primary) : 'transparent',
                borderWidth: 1.5,
                borderColor: error ? t.danger : filled ? t.primary : t.borderStrong,
              }}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg, maxWidth: 300, alignSelf: 'center' }}>
        {keys.map((k) => (
          <PadButton key={k} label={k} onPress={() => press(k)} />
        ))}
        {settings?.biometric_enabled === 1 ? (
          <PadButton icon="finger-print" onPress={tryBiometric} />
        ) : (
          <View style={{ width: 76, height: 76 }} />
        )}
        <PadButton label="0" onPress={() => press('0')} />
        <PadButton icon="backspace-outline" onPress={backspace} />
      </View>
    </View>
  );
}

function PadButton({ label, icon, onPress }: { label?: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: pressed ? t.cardAlt : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {icon ? <Ionicons name={icon} size={26} color={t.text} /> : <Text variant="title">{label}</Text>}
    </Pressable>
  );
}
