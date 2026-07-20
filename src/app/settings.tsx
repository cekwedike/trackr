import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';

import { FadeSlide } from '@/components/anim';
import { useConfirm } from '@/components/confirm';
import { PassphraseModal } from '@/components/passphrase-modal';
import { AppHeader, Button, Card, Divider, ListRow, Screen, SectionHeader, Text, TextField, Toggle } from '@/components/ui';
import { SelectField, SelectModal } from '@/components/pickers';
import { CURRENCIES, findCurrency } from '@/constants/currencies';
import { getIndustry, INDUSTRIES } from '@/constants/industries';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { updateSettings } from '@/db/repos/settings';
import { useTheme } from '@/hooks/use-theme';
import {
  authenticateBiometric,
  clearPin,
  formatLockoutDuration,
  getPinLockoutRemainingMs,
  isBiometricAvailable,
  setPin,
  verifyPin,
} from '@/lib/auth';
import {
  exportBackup,
  importBackupWithPassphrase,
  importLegacyBackup,
  pickBackupFile,
} from '@/lib/backup';
import { dayjs } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { cancelDailyNudge, cancelWeeklyNudge, scheduleDailyNudge, scheduleWeeklyNudge } from '@/lib/notifications';
import {
  getAllNotifCategories,
  NOTIF_CATEGORY_META,
  setNotifCategoryEnabled,
  type NotifCategory,
} from '@/lib/notification-prefs';
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
  const router = useRouter();
  const confirm = useConfirm();
  const { settings, reloadSettings, industry, setIndustry } = useApp();
  const [name, setName] = useState('');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [industryModal, setIndustryModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [verifyPinModal, setVerifyPinModal] = useState<'disable' | 'change' | null>(null);
  const [exportPassModal, setExportPassModal] = useState(false);
  const [importPassModal, setImportPassModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    bytes: Uint8Array;
    kind: 'encrypted' | 'legacy-zip' | 'legacy-json';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [dailyNudge, setDailyNudge] = useState(false);
  const [weeklyNudge, setWeeklyNudge] = useState(false);
  const [dailyHour, setDailyHour] = useState(9);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [timeModal, setTimeModal] = useState(false);
  const [notifCats, setNotifCats] = useState<Record<NotifCategory, boolean> | null>(null);

  useEffect(() => {
    if (settings) setName(settings.business_name);
  }, [settings]);

  useEffect(() => {
    (async () => {
      try {
        const [d, w, h, m, cats] = await Promise.all([
          SecureStore.getItemAsync(NUDGE_DAILY_ENABLED_KEY),
          SecureStore.getItemAsync(NUDGE_WEEKLY_ENABLED_KEY),
          SecureStore.getItemAsync(NUDGE_DAILY_HOUR_KEY),
          SecureStore.getItemAsync(NUDGE_DAILY_MINUTE_KEY),
          getAllNotifCategories(),
        ]);
        setDailyNudge(d === '1');
        setWeeklyNudge(w === '1');
        if (h != null) setDailyHour(Number(h));
        if (m != null) setDailyMinute(Number(m));
        setNotifCats(cats);
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

  /** Prefer biometric, otherwise current PIN, before disabling lock or changing PIN. */
  const requireLockAuth = async (purpose: 'disable' | 'change'): Promise<boolean> => {
    if (settings.biometric_enabled === 1 && biometricAvailable) {
      const ok = await authenticateBiometric(
        purpose === 'disable' ? 'Confirm to turn off app lock' : 'Confirm to change your PIN',
      );
      if (ok) return true;
    }
    setVerifyPinModal(purpose);
    return false;
  };

  const finishDisableLock = async () => {
    await clearPin();
    await updateSettings({ lock_enabled: 0, biometric_enabled: 0 });
    await reloadSettings();
  };

  const toggleLock = async () => {
    if (settings.lock_enabled === 1) {
      const choice = await confirm({
        title: 'Turn off app lock?',
        message:
          'Trackr will open without a PIN. App lock slows casual access — it does not encrypt your books on disk. Continue?',
        actions: [
          { label: 'Turn off', style: 'destructive', value: 'off' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (choice !== 'off') return;
      const authed = await requireLockAuth('disable');
      if (authed) await finishDisableLock();
    } else {
      setPinModal(true);
    }
  };

  const onVerifiedPin = async (ok: boolean) => {
    const purpose = verifyPinModal;
    setVerifyPinModal(null);
    if (!ok || !purpose) return;
    if (purpose === 'disable') await finishDisableLock();
    else setPinModal(true);
  };

  const savePin = async (pin: string) => {
    await setPin(pin);
    await updateSettings({ lock_enabled: 1 });
    await reloadSettings();
    setPinModal(false);
  };

  const requestChangePin = async () => {
    if (settings.lock_enabled !== 1) {
      setPinModal(true);
      return;
    }
    const authed = await requireLockAuth('change');
    if (authed) setPinModal(true);
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

  const toggleNotifCategory = async (cat: NotifCategory) => {
    if (!notifCats) return;
    const next = !notifCats[cat];
    await setNotifCategoryEnabled(cat, next);
    setNotifCats({ ...notifCats, [cat]: next });

    // Apply immediately: schedule or cancel depending on the category.
    try {
      if (cat === 'crm') {
        const { listCustomers } = await import('@/db/repos/customers');
        const { syncBirthdayNotifications } = await import('@/lib/birthday-notifications');
        const customers = await listCustomers();
        if (next) await syncBirthdayNotifications(customers);
        else {
          for (const c of customers) {
            const { cancelBirthdayNotification } = await import('@/lib/birthday-notifications');
            await cancelBirthdayNotification(c.id);
          }
        }
      } else {
        const { syncEventNotifications } = await import('@/lib/event-notifications');
        await syncEventNotifications();
      }
    } catch {
      // best-effort apply
    }
  };

  const doExport = () => setExportPassModal(true);

  const runExport = async (passphrase: string) => {
    setExportPassModal(false);
    setBusy(true);
    try {
      await exportBackup(passphrase);
    } catch (e) {
      Alert.alert('Export failed', toUserMessage(e, 'Couldn’t export your backup. Please try again.'));
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
      const picked = await pickBackupFile();
      if (!picked.picked) return;

      if (picked.kind === 'encrypted') {
        setPendingImport({ bytes: picked.bytes, kind: 'encrypted' });
        setImportPassModal(true);
        return;
      }

      const legacy = await confirm({
        title: 'Unencrypted backup',
        message:
          'This older backup is not passphrase-protected. Anyone with the file can read your books. Restore it anyway?',
        actions: [
          { label: 'Restore anyway', style: 'destructive', value: 'ok' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (legacy !== 'ok') return;

      await importLegacyBackup(picked.bytes, picked.kind);
      await reloadSettings();
      Alert.alert('Restored', 'Your data has been restored.');
    } catch (e) {
      Alert.alert('Import failed', toUserMessage(e, 'Couldn’t restore that backup. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const runEncryptedImport = async (passphrase: string) => {
    if (!pendingImport || pendingImport.kind !== 'encrypted') {
      setImportPassModal(false);
      return;
    }
    setImportPassModal(false);
    setBusy(true);
    try {
      await importBackupWithPassphrase(pendingImport.bytes, passphrase);
      setPendingImport(null);
      await reloadSettings();
      Alert.alert('Restored', 'Your data has been restored.');
    } catch (e) {
      Alert.alert('Import failed', toUserMessage(e, 'Couldn’t restore that backup. Please try again.'));
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
        <SectionHeader title="Security" subtitle="App lock is a gate — not full encryption of your books" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ToggleRow icon="lock-closed" label="App lock (PIN)" value={settings.lock_enabled === 1} onToggle={toggleLock} hint="Asks for PIN or biometrics after you leave the app" />
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
              <ListRow icon="key" iconTone="primary" title="Change PIN" onPress={requestChangePin} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
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

      <FadeSlide delay={140}>
        <SectionHeader title="Event alerts" subtitle="Local only — never leaves this device" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          {(Object.keys(NOTIF_CATEGORY_META) as NotifCategory[]).map((cat, idx) => {
            const meta = NOTIF_CATEGORY_META[cat];
            return (
              <View key={cat}>
                {idx > 0 ? <Divider /> : null}
                <ToggleRow
                  icon={meta.icon}
                  label={meta.label}
                  value={notifCats?.[cat] ?? false}
                  onToggle={() => toggleNotifCategory(cat)}
                  hint={meta.hint}
                />
              </View>
            );
          })}
        </Card>
      </FadeSlide>

      <FadeSlide delay={160}>
        <SectionHeader title="Customers" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ListRow
            icon="people"
            iconTone="info"
            title="Import from contacts"
            subtitle="Add selected people as customers"
            onPress={() => router.push('/customers/import' as Href)}
            right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />}
          />
          <Divider />
          <ListRow
            icon="sync"
            iconTone="primary"
            title="Re-sync contacts"
            subtitle="Refresh names, phones & birthdays"
            onPress={() => router.push('/customers/import?mode=resync' as Href)}
            right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />}
          />
        </Card>
      </FadeSlide>

      <FadeSlide delay={180}>
        <SectionHeader title="Data" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ListRow
            icon="cloud-upload"
            iconTone="success"
            title="Export backup"
            subtitle={busy ? 'Preparing encrypted backup…' : 'Passphrase-protected zip of data + media'}
            onPress={doExport}
            right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />}
          />
          <Divider />
          <ListRow
            icon="cloud-download"
            iconTone="warning"
            title="Restore backup"
            subtitle="Encrypted, or older unprotected zip/JSON"
            onPress={doImport}
            right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />}
          />
        </Card>
      </FadeSlide>

      <FadeSlide delay={200}>
        <SectionHeader title="About" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <ListRow icon="sparkles" iconTone="accent" title="What's new" subtitle="See the latest features & changes" onPress={openWhatsNew} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
          <Divider />
          <ListRow icon="shield-checkmark" iconTone="info" title="Privacy Policy" subtitle="On-device data & permissions" onPress={() => router.push('/legal/privacy' as Href)} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
          <Divider />
          <ListRow icon="document-text" iconTone="primary" title="Terms of Use" subtitle="License & responsibilities" onPress={() => router.push('/legal/terms' as Href)} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
          <Divider />
          <ListRow icon="cloud-offline" iconTone="warning" title="Offline & Data" subtitle="Local storage & backups" onPress={() => router.push('/legal/offline' as Href)} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
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
      <VerifyPinModal
        visible={verifyPinModal != null}
        title={verifyPinModal === 'disable' ? 'Enter PIN to turn off lock' : 'Enter current PIN'}
        onClose={() => setVerifyPinModal(null)}
        onResult={onVerifiedPin}
      />
      <PassphraseModal
        visible={exportPassModal}
        mode="export"
        title="Protect this backup"
        message="Choose a passphrase. You’ll need it to restore. Don’t share the file without it."
        confirmLabel="Export"
        onClose={() => setExportPassModal(false)}
        onSubmit={runExport}
      />
      <PassphraseModal
        visible={importPassModal}
        mode="import"
        title="Enter backup passphrase"
        message="This backup is encrypted. Enter the passphrase used when it was exported."
        confirmLabel="Restore"
        onClose={() => {
          setImportPassModal(false);
          setPendingImport(null);
        }}
        onSubmit={runEncryptedImport}
      />
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
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPinValue('');
      setConfirmPin('');
      setError('');
    }
  }, [visible]);

  const submit = () => {
    if (pin.length < 4) return setError('PIN must be at least 4 digits.');
    if (pin !== confirmPin) return setError('PINs do not match.');
    onSave(pin);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: Spacing.xl }}>
        <View style={{ backgroundColor: t.background, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md }}>
          <Text variant="subtitle">Set PIN</Text>
          <TextField label="New PIN" value={pin} onChangeText={setPinValue} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <TextField label="Confirm PIN" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
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

function VerifyPinModal({
  visible,
  title,
  onClose,
  onResult,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onResult: (ok: boolean) => void;
}) {
  const t = useTheme();
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setPinValue('');
      setError('');
      setBusy(false);
    }
  }, [visible]);

  const submit = async () => {
    if (pin.length < 4) {
      setError('Enter your current PIN.');
      return;
    }
    setBusy(true);
    try {
      const remaining = await getPinLockoutRemainingMs();
      if (remaining > 0) {
        setError(`Too many attempts. Try again in ${formatLockoutDuration(remaining)}.`);
        return;
      }
      const result = await verifyPin(pin);
      if (result === 'ok') {
        onResult(true);
        return;
      }
      if (result === 'locked') {
        const ms = await getPinLockoutRemainingMs();
        setError(`Too many attempts. Try again in ${formatLockoutDuration(ms)}.`);
      } else {
        setError('Incorrect PIN.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: Spacing.xl }}>
        <View style={{ backgroundColor: t.background, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md }}>
          <Text variant="subtitle">{title}</Text>
          <TextField label="PIN" value={pin} onChangeText={setPinValue} keyboardType="number-pad" secureTextEntry maxLength={6} />
          {error ? <Text variant="caption" color={t.danger}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title={busy ? 'Checking…' : 'Confirm'} onPress={submit} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
