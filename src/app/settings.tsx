import { Ionicons } from '@expo/vector-icons';
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

export default function Settings() {
  const t = useTheme();
  const confirm = useConfirm();
  const { settings, reloadSettings, industry, setIndustry } = useApp();
  const [name, setName] = useState('');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [industryModal, setIndustryModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) setName(settings.business_name);
  }, [settings]);

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
    if (settings.biometric_enabled === 1) {
      await updateSettings({ biometric_enabled: 0 });
    } else {
      const ok = await isBiometricAvailable();
      if (!ok) {
        Alert.alert('Not available', 'No fingerprint or face unlock is set up on this device.');
        return;
      }
      await updateSettings({ biometric_enabled: 1 });
    }
    await reloadSettings();
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
              <ToggleRow icon="finger-print" label="Biometric unlock" value={settings.biometric_enabled === 1} onToggle={toggleBiometric} />
              <Divider />
              <ListRow icon="key" iconTone="primary" title="Change PIN" onPress={() => setPinModal(true)} right={<Ionicons name="chevron-forward" size={16} color={t.textMuted} />} />
            </>
          ) : null}
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

      <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center', marginTop: Spacing.md }}>
        Trackr v1.0.0
      </Text>

      <SelectModal visible={industryModal} title="Industry" onClose={() => setIndustryModal(false)} onSelect={chooseIndustry} options={INDUSTRIES.map((i) => ({ id: i.id, label: i.name, sublabel: i.tagline }))} />
      <SelectModal visible={currencyModal} title="Currency" onClose={() => setCurrencyModal(false)} onSelect={setCurrency} options={CURRENCIES.map((c) => ({ id: c.code, label: `${c.symbol}  ${c.code}`, sublabel: c.name }))} />
      <PinModal visible={pinModal} onClose={() => setPinModal(false)} onSave={savePin} />
      {busy ? <View style={{ position: 'absolute' }} /> : null}
    </Screen>
  );
}

function ToggleRow({ icon, label, value, onToggle }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <Ionicons name={icon} size={20} color={t.textSecondary} />
        <Text variant="body" weight="medium">{label}</Text>
      </View>
      <Toggle value={value} onValueChange={onToggle} />
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
