import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { Button, Text, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'export' | 'import' | 'confirm';

/**
 * Collect a backup passphrase. Export mode asks twice; import asks once;
 * confirm mode is for "type again to confirm" if needed by callers.
 */
export function PassphraseModal({
  visible,
  mode,
  title,
  message,
  confirmLabel = 'Continue',
  onClose,
  onSubmit,
}: {
  visible: boolean;
  mode: Mode;
  title: string;
  message?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (passphrase: string) => void;
}) {
  const t = useTheme();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPass('');
      setConfirm('');
      setError('');
    }
  }, [visible]);

  const submit = () => {
    const trimmed = pass.trim();
    if (trimmed.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (mode === 'export' && trimmed !== confirm.trim()) {
      setError('Passphrases do not match.');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: Spacing.xl }}>
        <View style={{ backgroundColor: t.background, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md }}>
          <Text variant="subtitle">{title}</Text>
          {message ? (
            <Text variant="body" color={t.textSecondary}>
              {message}
            </Text>
          ) : null}
          <TextField
            label="Passphrase"
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="At least 6 characters"
          />
          {mode === 'export' ? (
            <TextField
              label="Confirm passphrase"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}
          {error ? (
            <Text variant="caption" color={t.danger}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title={confirmLabel} onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
