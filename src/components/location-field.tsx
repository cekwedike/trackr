/**
 * Reusable "tag a location" field. Foreground-only: it captures a coordinate
 * only when the user taps, requesting permission just-in-time with the branded
 * rationale / blocked → Open Settings flow used elsewhere in the app.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAlert, useConfirm } from '@/components/confirm';
import { Button, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/errors';
import { captureCurrentLocation, formatCoords, type CapturedLocation } from '@/lib/location';
import {
  locationPermissionMessage,
  openAppPermissionSettings,
  requestLocation,
} from '@/lib/permissions';

export type LocationValue = CapturedLocation | null;

export function LocationField({
  label = 'Location',
  value,
  onChange,
  onCaptured,
}: {
  label?: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  /** Optional hook fired after a fresh capture (e.g. to auto-fill an address). */
  onCaptured?: (value: CapturedLocation) => void;
}) {
  const t = useTheme();
  const confirm = useConfirm();
  const alert = useAlert();
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await requestLocation();
      if (outcome !== 'granted') {
        const msg = locationPermissionMessage(outcome);
        if (outcome === 'blocked') {
          const choice = await confirm({
            title: msg.title,
            message: msg.message,
            actions: [
              { label: 'Open Settings', value: 'settings' },
              { label: 'Cancel', style: 'cancel', value: 'cancel' },
            ],
          });
          if (choice === 'settings') void openAppPermissionSettings();
        } else {
          void alert({ title: msg.title, message: msg.message });
        }
        return;
      }
      const captured = await captureCurrentLocation();
      onChange(captured);
      onCaptured?.(captured);
    } catch (e) {
      void alert({ title: 'Couldn’t get location', message: toUserMessage(e, 'Try again in a moment.') });
    } finally {
      setBusy(false);
    }
  };

  const display = value ? value.label ?? formatCoords(value.lat, value.lng) : null;

  return (
    <View style={{ gap: Spacing.xs }}>
      <Text variant="label" color={t.textSecondary}>{label}</Text>
      {value ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            backgroundColor: t.inputBg,
            borderRadius: Radius.md,
            borderWidth: 1.5,
            borderColor: t.border,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minHeight: 50,
          }}
        >
          <Ionicons name="location" size={18} color={t.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="body" numberOfLines={2}>{display}</Text>
            {value.label ? (
              <Text variant="caption" color={t.textMuted}>{formatCoords(value.lat, value.lng)}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear location"
          >
            <Ionicons name="close-circle" size={20} color={t.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Button
          title={busy ? 'Getting location…' : 'Use current location'}
          icon="location-outline"
          variant="secondary"
          onPress={capture}
          loading={busy}
        />
      )}
    </View>
  );
}
