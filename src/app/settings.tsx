import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';

import { FadeSlide } from '@/components/anim';
import { useConfirm } from '@/components/confirm';
import { AppHeader, Button, Card, Divider, ListRow, Screen, SectionHeader, Text, TextField, Toggle } from '@/components/ui';
import { SelectField, SelectModal } from '@/components/pickers';
import { CURRENCIES, findCurrency } from '@/constants/currencies';
import { getIndustry, INDUSTRIES } from '@/constants/industries';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { updateSettings } from '@/db/repos/settings';
import { useTheme } from '@/hooks/use-theme';
import { clearPin, isBiometricAvailable, setPin } from '@/lib/auth';
import { exportBackup, importBackup } from '@/lib/backup';
import { dayjs } from '@/lib/date';
import { cancelDailyNudge, cancelWeeklyNudge, scheduleDailyNudge, scheduleWeeklyNudge } from '@/lib/notifications';
import { openWhatsNew } from '@/components/whats-new';

// Nudge preferences live in secure-store (the settings table has no columns for
// them), mirroring the onboarding flags. notifications.ts owns the scheduled
// notification ids; here we only persist the user's on/off choice + daily time.
const NUDGE_DAILY_ENABLED_KEY = 'nudge.daily.enabled';
const NUDGE_DAILY_HOUR_KEY = 'nudge.daily.hour';
const NUDGE_DAILY_MINUTE_KEY = 'nudge.daily.minute';
const NUDGE_WEEKLY_ENABLED_KEY = 'nudge.weekly.enabled';

// Weekly summary fires Monday morning (expo weekday: 1 = Sunday … 2 = Monday).
const WEEKLY_NUDGE_WEEKDAY = 2;
const WEEKLY_NUDGE_HOUR = 9;

/** Time-of-day options for the daily nudge, at 30-minute steps. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? 0 : 30;
  return { id: `${hour}:${minute}`, hour, minute, label: dayjs().hour(hour).minute(minute).format('h:mm A') };
});

function timeLabel(hour: number, minute: number): string {
  return dayjs().hour(hour).minute(minute).format('h:mm A');
}

export default function Settings() {
  const t = useTheme();
  const confirm = useConfirm();
  const { settings, reloadSettings, industry, setIndustry } = useApp();
  const [name, setName] = useState('');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [industryModal, setIndustryModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [dailyNudge, setDailyNudge] = useState(false);
  const [weeklyNudge, setWeeklyNudge] = useState(false);
  const [dailyHour, setDailyHour] = useState(9);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [timeModal, setTimeModal] = useState(false);

  useEffect(() => {
    if (settings) setName(settings.business_name);
  }, [settings]);

  useEffect(() => {
    (async () => {
      try {
        const [d, w, h, m] = await Promise.all([
          SecureStore.getItemAsync(NUDGE_DAILY_ENABLED_KEY),
          SecureStore.getItemAsync(NUDGE_WEEKLY_ENABLED_KEY),
          SecureStore.getItemAsync(NUDGE_DAILY_HOUR_KEY),
          SecureStore.getItemAsync(NUDGE_DAILY_MINUTE_KEY),
        ]);
        setDailyNudge(d === '1');
        setWeeklyNudge(w === '1');
        if (h != null) setDailyHour(Number(h));
        if (m != null) setDailyMinute(Number(m));
      } catch {
        // secure-store read is best-effort; fall back to defaults
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    isBiometricAvailable().then((ok) => {
      if (active) setBiometricAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!settings) return null;

  const saveName = async () => {
    await updateSettings({ business_name: name.trim() || 'My Business' });
    await reloadSettings();
  };

  const setCurrency = async (code: string) => {
    const c = findCurrency(code);
    await updateSettings({ currency_code: c.code, currency_symbol: c.symbol });
    await reloadSettings();
  };

  const chooseIndustry = (id: string) => {
    setIndustryModal(false);
    if (!settings || id === settings.industry) return;
    const target = getIndustry(id);
    // Defer so the picker's native Modal fully dismisses before the confirm
    // dialog's Modal mounts — two RN Modals presenting on the same frame race
    // on Android (the same class of bug the picker's `if (!visible)` guard
    // guards against).
    setTimeout(async () => {
      const choice = await confirm({
        title: `Switch to ${target.name}?`,
        message:
          'Your dashboard and labels will re-theme. Keep your current profit split, or replace it with this industry’s template?',
        actions: [
          { label: 'Keep my split', value: 'keep' },
          { label: 'Use template', value: 'template' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (choice === 'keep') {
        await setIndustry(id, false);
        await reloadSettings();
      } else if (choice === 'template') {
        await setIndustry(id, true);
        await reloadSettings();
      }
    }, 220);
  };

  const toggleLock = async () => {
    if (settings.lock_enabled === 1) {
      const choice = await confirm({
        title: 'Turn off app lock',
        message: 'Trackr will open without a PIN. Continue?',
        actions: [
          { label: 'Turn off', style: 'destructive', value: 'off' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (choice === 'off') {
        await clearPin();
        await updateSettings({ lock_enabled: 0, biometric_enabled: 0 });
        await reloadSettings();
      }
    } else {
      setPinModal(true);
    }
  };

  const savePin = async (pin: string) => {
    await setPin(pin);
    await updateSettings({ lock_enabled: 1 });
    await reloadSettings();
    setPinModal(false);
  };

  const toggleBiometric = async () => {
    // The row is disabled unless biometrics are available, but re-check to be safe.
    if (!biometricAvailable) {
      Alert.alert('Not available', 'No fingerprint or face unlock is set up on this device.');
      return;
    }
    await updateSettings({ biometric_enabled: settings.biometric_enabled === 1 ? 0 : 1 });
    await reloadSettings();
  };

  const toggleDailyNudge = async () => {
    const next = !dailyNudge;
    if (next) {
      const id = await scheduleDailyNudge(dailyHour, dailyMinute);
      if (!id) {
        Alert.alert('Notifications off', 'Enable notifications for Trackr to get daily nudges.');
        return;
      }
    } else {
      await cancelDailyNudge();
    }
    setDailyNudge(next);
    await SecureStore.setItemAsync(NUDGE_DAILY_ENABLED_KEY, next ? '1' : '0').catch(() => {});
  };

  const changeDailyTime = async (id: string) => {
    const opt = TIME_OPTIONS.find((o) => o.id === id);
    if (!opt) return;
    setDailyHour(opt.hour);
    setDailyMinute(opt.minute);
    await SecureStore.setItemAsync(NUDGE_DAILY_HOUR_KEY, String(opt.hour)).catch(() => {});
    await SecureStore.setItemAsync(NUDGE_DAILY_MINUTE_KEY, String(opt.minute)).catch(() => {});
    // Reschedule so the change takes effect immediately when the nudge is on.
    if (dailyNudge) await scheduleDailyNudge(opt.hour, opt.minute);
  };

  const toggleWeeklyNudge = async () => {
    const next = !weeklyNudge;
    if (next) {
      const id = await scheduleWeeklyNudge(WEEKLY_NUDGE_WEEKDAY, WEEKLY_NUDGE_HOUR, 0);
      if (!id) {
        Alert.alert('Notifications off', 'Enable notifications for Trackr to get weekly nudges.');
        return;
      }
    } else {
      await cancelWeeklyNudge();
    }
    setWeeklyNudge(next);
    await SecureStore.setItemAsync(NUDGE_WEEKLY_ENABLED_KEY, next ? '1' : '0').catch(() => {});
  };

  const doExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const choice = await confirm({
      title: 'Restore backup',
      message: 'This will REPLACE all current data with the backup file. Continue?',
      actions: [
        { label: 'Restore', style: 'destructive', value: 'restore' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'restore') return;
    setBusy(true);
    try {
      const res = await importBackup();
      if (res.imported) {
        await reloadSettings();
        Alert.alert('Restored', 'Your data has been restored.');
      }
    } catch (e) {
      Alert.alert('Import failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Settings" back />

      <FadeSlide delay={0}>
        <SectionHeader title="Business" />
        <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
          <TextField label="Business name" value={name} onChangeText={setName} right={<Pressable onPress={saveName}><Text variant="label" color={t.primary}>Save</Text></Pressable>} />
          <SelectField label="Industry / Dashboard" value={industry.name} onPress={() => setIndustryModal(true)} />
          <SelectField label="Currency" value={`${settings.currency_symbol} · ${settings.currency_code}`} onPress={() => setCurrencyModal(true)} />
        </Card>
      </FadeSlide>

      <FadeSlide delay={80}>
        <SectionHeader title="Security" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ToggleRow icon="lock-closed" label="App lock (PIN)" value={settings.lock_enabled === 1} onToggle={toggleLock} />
          {settings.lock_enabled === 1 ? (
            <>
              <Divider />
              <ToggleRow
                icon="finger-print"
                label="Unlock with biometrics"
                value={biometricAvailable && settings.biometric_enabled === 1}
                onToggle={toggleBiometric}
                disabled={!biometricAvailable}
                hint={!biometricAvailable ? 'No fingerprint or face unlock is set up on this device' : undefined}
              />
              <Divider />
              <ListRow icon="key" iconTone="primary" title="Change PIN" onPress={() => setPinModal(true)} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
            </>
          ) : null}
        </Card>
      </FadeSlide>

      <FadeSlide delay={120}>
        <SectionHeader title="Reminders & nudges" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ToggleRow
            icon="today"
            label="Daily summary"
            value={dailyNudge}
            onToggle={toggleDailyNudge}
            hint={`A gentle daily reminder at ${timeLabel(dailyHour, dailyMinute)}`}
          />
          {dailyNudge ? (
            <>
              <Divider />
              <ListRow
                icon="time"
                iconTone="primary"
                title="Nudge time"
                subtitle={timeLabel(dailyHour, dailyMinute)}
                onPress={() => setTimeModal(true)}
                right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />}
              />
            </>
          ) : null}
          <Divider />
          <ToggleRow
            icon="calendar"
            label="Weekly review"
            value={weeklyNudge}
            onToggle={toggleWeeklyNudge}
            hint={`Every Monday at ${timeLabel(WEEKLY_NUDGE_HOUR, 0)}`}
          />
        </Card>
      </FadeSlide>

      <FadeSlide delay={160}>
        <SectionHeader title="Data" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ListRow icon="cloud-upload" iconTone="success" title="Export backup" subtitle="Save all data to a file" onPress={doExport} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
          <Divider />
          <ListRow icon="cloud-download" iconTone="warning" title="Restore backup" subtitle="Replace data from a file" onPress={doImport} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
        </Card>
      </FadeSlide>

      <FadeSlide delay={200}>
        <SectionHeader title="About" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ListRow icon="sparkles" iconTone="accent" title="What's new" subtitle="See the latest features & changes" onPress={openWhatsNew} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
        </Card>
      </FadeSlide>

      <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center', marginTop: Spacing.md }}>
        Trackr v1.0.0
      </Text>

      <SelectModal visible={industryModal} title="Industry" onClose={() => setIndustryModal(false)} onSelect={chooseIndustry} options={INDUSTRIES.map((i) => ({ id: i.id, label: i.name, sublabel: i.tagline }))} />
      <SelectModal visible={currencyModal} title="Currency" onClose={() => setCurrencyModal(false)} onSelect={setCurrency} options={CURRENCIES.map((c) => ({ id: c.code, label: `${c.symbol}  ${c.code}`, sublabel: c.name }))} />
      <SelectModal
        visible={timeModal}
        title="Nudge time"
        onClose={() => setTimeModal(false)}
        onSelect={changeDailyTime}
        selectedId={`${dailyHour}:${dailyMinute}`}
        options={TIME_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
      />
      <PinModal visible={pinModal} onClose={() => setPinModal(false)} onSave={savePin} />
      {busy ? <View style={{ position: 'absolute' }} /> : null}
    </Screen>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  disabled,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, gap: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1, opacity: disabled ? 0.5 : 1 }}>
        <Ionicons name={icon} size={20} color={t.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="medium">{label}</Text>
          {hint ? <Text variant="caption" color={t.textMuted}>{hint}</Text> : null}
        </View>
      </View>
      <Toggle value={value} onValueChange={onToggle} disabled={disabled} />
    </View>
  );
}

function PinModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (pin: string) => void }) {
  const t = useTheme();
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPinValue('');
      setConfirm('');
      setError('');
    }
  }, [visible]);

  const submit = () => {
    if (pin.length < 4) return setError('PIN must be at least 4 digits.');
    if (pin !== confirm) return setError('PINs do not match.');
    onSave(pin);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: Spacing.xl }}>
        <View style={{ backgroundColor: t.background, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md }}>
          <Text variant="subtitle">Set PIN</Text>
          <TextField label="New PIN" value={pin} onChangeText={setPinValue} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <TextField label="Confirm PIN" value={confirm} onChangeText={setConfirm} keyboardType="number-pad" secureTextEntry maxLength={6} />
          {error ? <Text variant="caption" color={t.danger}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
