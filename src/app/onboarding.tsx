import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Aurora, FadeSlide } from '@/components/anim';
import { AnimatedGrid } from '@/components/nav';
import { Brand, Button, Card, Screen, Text, TextField, Toggle } from '@/components/ui';
import { CURRENCIES } from '@/constants/currencies';
import { getIndustry, INDUSTRIES } from '@/constants/industries';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { updateSettings } from '@/db/repos/settings';
import { useTheme } from '@/hooks/use-theme';
import { isBiometricAvailable, setPin } from '@/lib/auth';
import { hexToRgba } from '@/lib/color';
import { successFeedback } from '@/lib/haptics';
import { PermissionRationale, requestNotifications, type PermissionOutcome } from '@/lib/permissions';

export default function Onboarding() {
  const t = useTheme();
  const { reloadSettings, unlock } = useApp();
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [industryId, setIndustryId] = useState('general');
  const [industryQuery, setIndustryQuery] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [enableLock, setEnableLock] = useState(false);
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometric, setBiometric] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifOutcome, setNotifOutcome] = useState<PermissionOutcome | null>(null);
  const [requestingNotif, setRequestingNotif] = useState(false);

  const enableNotifications = async () => {
    setRequestingNotif(true);
    try {
      setNotifOutcome(await requestNotifications());
    } finally {
      setRequestingNotif(false);
    }
  };

  const finish = async () => {
    setError('');
    if (enableLock) {
      if (pin.length < 4) return setError('PIN must be at least 4 digits.');
      if (pin !== confirmPin) return setError('PINs do not match.');
    }
    setSaving(true);
    try {
      const cur = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
      let bio = false;
      if (enableLock) {
        await setPin(pin);
        if (biometric) bio = await isBiometricAvailable();
      }
      await updateSettings({
        business_name: name.trim() || 'My Business',
        currency_code: cur.code,
        currency_symbol: cur.symbol,
        industry: industryId,
        profit_allocation: JSON.stringify(getIndustry(industryId).defaultAllocation),
        lock_enabled: enableLock ? 1 : 0,
        biometric_enabled: bio ? 1 : 0,
        onboarded: 1,
      });
      await reloadSettings();
      successFeedback();
      unlock();
    } finally {
      setSaving(false);
    }
  };

  const filteredIndustries = INDUSTRIES.filter((ind) =>
    industryQuery.trim() === '' ? true : `${ind.name} ${ind.tagline}`.toLowerCase().includes(industryQuery.trim().toLowerCase()),
  );

  return (
    <Screen scroll>
      <View style={{ overflow: 'hidden', borderRadius: Radius.xl, marginTop: Spacing.xl, marginBottom: Spacing.xl }}>
        <Aurora colors={[t.primary, t.accent, t.info]} opacity={0.4} />
        <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
          <Brand size={76} showWordmark subtitle="Your business, in your pocket" />
        </View>
      </View>

      {step === 0 ? (
        <FadeSlide key="s0">
        <Card style={{ gap: Spacing.lg }}>
          <Text variant="subtitle">Let&apos;s set up your business</Text>
          <Text variant="body" color={t.textSecondary}>
            Track sales, expenses, inventory, orders and profit — all in one place, right on your phone.
          </Text>
          <TextField label="Business name" value={name} onChangeText={setName} placeholder="e.g. Thrive Bakery" autoFocus />
          <Button title="Continue" icon="arrow-forward" onPress={() => setStep(1)} />
        </Card>
        </FadeSlide>
      ) : null}

      {step === 1 ? (
        <FadeSlide key="s1">
        <Card style={{ gap: Spacing.md }}>
          <Text variant="subtitle">What do you do?</Text>
          <Text variant="body" color={t.textSecondary}>
            Pick the closest fit — this tailors your dashboard, terminology and profit template. You can change it anytime.
          </Text>
          <TextField value={industryQuery} onChangeText={setIndustryQuery} placeholder="Search industries" />
          {filteredIndustries.length === 0 ? (
            <Text variant="caption" color={t.textSecondary}>No match. Try another word or pick “General”.</Text>
          ) : (
            <AnimatedGrid
              data={filteredIndustries}
              columns={2}
              keyExtractor={(ind) => ind.id}
              renderItem={(ind) => {
                const active = ind.id === industryId;
                return (
                  <Pressable
                    onPress={() => setIndustryId(ind.id)}
                    style={{
                      padding: Spacing.md,
                      borderRadius: Radius.md,
                      borderWidth: 1.5,
                      borderColor: active ? ind.accent : t.border,
                      backgroundColor: active ? hexToRgba(ind.accent, 0.1) : t.card,
                      gap: Spacing.xs,
                    }}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: hexToRgba(ind.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={ind.icon} size={20} color={ind.accent} />
                    </View>
                    <Text variant="body" weight="semibold" numberOfLines={1}>{ind.name}</Text>
                    <Text variant="caption" color={t.textSecondary} numberOfLines={1}>{ind.tagline}</Text>
                  </Pressable>
                );
              }}
            />
          )}
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Back" variant="ghost" onPress={() => setStep(0)} style={{ flex: 1 }} />
            <Button title="Continue" icon="arrow-forward" onPress={() => setStep(2)} style={{ flex: 1 }} />
          </View>
        </Card>
        </FadeSlide>
      ) : null}

      {step === 2 ? (
        <FadeSlide key="s2">
        <Card style={{ gap: Spacing.md }}>
          <Text variant="subtitle">Choose your currency</Text>
          <View style={{ gap: Spacing.sm }}>
            {CURRENCIES.map((c) => {
              const active = c.code === currency;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => setCurrency(c.code)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: Spacing.md,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: active ? t.primary : t.border,
                    backgroundColor: active ? t.primarySoft : t.card,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    <Text variant="subtitle" color={active ? t.primary : t.text} style={{ width: 44 }}>{c.symbol}</Text>
                    <View>
                      <Text variant="body" weight="semibold">{c.code}</Text>
                      <Text variant="caption" color={t.textSecondary}>{c.name}</Text>
                    </View>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={t.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Back" variant="ghost" onPress={() => setStep(1)} style={{ flex: 1 }} />
            <Button title="Continue" icon="arrow-forward" onPress={() => setStep(3)} style={{ flex: 1 }} />
          </View>
        </Card>
        </FadeSlide>
      ) : null}

      {step === 3 ? (
        <FadeSlide key="s3n">
        <Card style={{ gap: Spacing.lg }}>
          <Text variant="subtitle">{PermissionRationale.notifications.title}</Text>
          <Text variant="body" color={t.textSecondary}>
            {PermissionRationale.notifications.message}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.md,
              padding: Spacing.md,
              borderRadius: Radius.md,
              backgroundColor: t.primarySoft,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hexToRgba(t.primary, 0.16), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications" size={22} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">Reminders</Text>
              <Text variant="caption" color={t.textSecondary}>Payments, restocks and follow-ups — never miss one.</Text>
            </View>
            {notifOutcome === 'granted' ? <Ionicons name="checkmark-circle" size={24} color={t.success} /> : null}
          </View>

          {notifOutcome === 'granted' ? (
            <Text variant="caption" color={t.success}>Notifications enabled. You&apos;re all set.</Text>
          ) : notifOutcome === 'denied' ? (
            <Text variant="caption" color={t.textSecondary}>
              No problem — you can turn reminders on anytime from Settings.
            </Text>
          ) : null}

          {notifOutcome !== 'granted' ? (
            <Button
              title={notifOutcome === 'denied' ? 'Try again' : 'Enable reminders'}
              icon="notifications-outline"
              onPress={enableNotifications}
              loading={requestingNotif}
            />
          ) : null}

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Back" variant="ghost" onPress={() => setStep(2)} style={{ flex: 1 }} />
            <Button
              title={notifOutcome === 'granted' ? 'Continue' : 'Skip for now'}
              icon="arrow-forward"
              variant={notifOutcome === 'granted' ? 'primary' : 'secondary'}
              onPress={() => setStep(4)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
        </FadeSlide>
      ) : null}

      {step === 4 ? (
        <FadeSlide key="s4">
        <Card style={{ gap: Spacing.lg }}>
          <Text variant="subtitle">Secure your data</Text>
          <Text variant="body" color={t.textSecondary}>
            Lock Trackr with a PIN so only you can open your books. You can change this later in Settings.
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: Spacing.md,
              borderRadius: Radius.md,
              borderWidth: 1.5,
              borderColor: enableLock ? t.primary : t.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Ionicons name="lock-closed" size={20} color={enableLock ? t.primary : t.textSecondary} />
              <Text variant="body" weight="semibold">Enable app lock</Text>
            </View>
            <Toggle value={enableLock} onValueChange={setEnableLock} />
          </View>

          {enableLock ? (
            <View style={{ gap: Spacing.md }}>
              <TextField
                label="PIN (4-6 digits)"
                value={pin}
                onChangeText={setPinValue}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="••••"
              />
              <TextField
                label="Confirm PIN"
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="••••"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <Ionicons name="finger-print" size={20} color={t.textSecondary} />
                  <Text variant="body">Use fingerprint / face unlock</Text>
                </View>
                <Toggle value={biometric} onValueChange={setBiometric} />
              </View>
            </View>
          ) : null}

          {error ? <Text variant="caption" color={t.danger}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Back" variant="ghost" onPress={() => setStep(3)} style={{ flex: 1 }} />
            <Button title="Finish" icon="checkmark" onPress={finish} loading={saving} style={{ flex: 1 }} />
          </View>
        </Card>
        </FadeSlide>
      ) : null}
    </Screen>
  );
}
