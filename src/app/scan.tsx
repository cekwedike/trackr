/**
 * Barcode / QR scanner (expo-camera, SDK 57 barcode scanning).
 *
 * Two modes via the `mode` param:
 *  - `lookup` (default): find an active product by the scanned code. Match →
 *    open it; no match → offer to create a product pre-filled with the code.
 *  - `capture`: hand the raw scanned code back to the opener (product/sale form)
 *    via `@/lib/scan-bridge` and pop back.
 *
 * Camera permission reuses the app's branded camera flow (`requestCamera`), the
 * same OS permission already used for product/receipt photos.
 */
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfirm } from '@/components/confirm';
import { Button, IconButton, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { findProductByBarcode } from '@/db/repos/products';
import { useTheme } from '@/hooks/use-theme';
import { pressFeedback } from '@/lib/haptics';
import {
  cameraPermissionMessage,
  openAppPermissionSettings,
  requestCamera,
  type PermissionOutcome,
} from '@/lib/permissions';
import { setScannedBarcode } from '@/lib/scan-bridge';

const BARCODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code39',
  'code93',
  'code128',
  'codabar',
  'itf14',
  'datamatrix',
  'pdf417',
  'aztec',
] as const;

export default function ScanScreen() {
  const t = useTheme();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const { terms } = useApp();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const captureMode = mode === 'capture';

  const [permission, setPermission] = useState<PermissionOutcome | 'undetermined'>('undetermined');
  // Guard so a fast camera doesn't fire the handler many times before we navigate.
  const handled = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const outcome = await requestCamera();
      if (active) setPermission(outcome);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (handled.current) return;
      const value = result.data?.trim();
      if (!value) return;
      handled.current = true;
      pressFeedback();

      if (captureMode) {
        setScannedBarcode(value);
        router.back();
        return;
      }

      const product = await findProductByBarcode(value);
      if (product) {
        router.replace(`/products/${product.id}`);
        return;
      }

      const choice = await confirm({
        title: 'No match found',
        message: `No ${terms.item.toLowerCase()} uses the code ${value}. Add a new one with this barcode?`,
        actions: [
          { label: `Add ${terms.item.toLowerCase()}`, value: 'add' },
          { label: 'Scan again', value: 'again' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (choice === 'add') {
        router.replace(`/products/new?barcode=${encodeURIComponent(value)}`);
      } else if (choice === 'again') {
        handled.current = false;
      } else {
        router.back();
      }
    },
    [captureMode, confirm, terms],
  );

  if (permission !== 'granted') {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.lg }}>
        {permission === 'undetermined' ? (
          <Text variant="body" color={t.textSecondary} style={{ textAlign: 'center' }}>
            Preparing the camera…
          </Text>
        ) : (
          <>
            <Text variant="title" style={{ textAlign: 'center' }}>
              {cameraPermissionMessage(permission).title}
            </Text>
            <Text variant="body" color={t.textSecondary} style={{ textAlign: 'center' }}>
              {cameraPermissionMessage(permission).message}
            </Text>
            {permission === 'blocked' ? (
              <Button title="Open Settings" icon="settings-outline" onPress={() => void openAppPermissionSettings()} />
            ) : null}
            <Button title="Go back" variant="ghost" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={handleScan}
      />

      <View style={{ position: 'absolute', top: insets.top + Spacing.sm, left: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: Radius.pill }}>
          <IconButton icon="close" color="#FFFFFF" onPress={() => router.back()} />
        </View>
        <Text variant="body" weight="semibold" color="#FFFFFF" style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill }}>
          {captureMode ? 'Scan a barcode' : `Scan to find ${terms.item.toLowerCase()}`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 260,
              height: 180,
              borderRadius: Radius.lg,
              borderWidth: 3,
              borderColor: 'rgba(255,255,255,0.9)',
              backgroundColor: 'transparent',
            }}
          />
          <Text variant="caption" color="#FFFFFF" style={{ marginTop: Spacing.md, textAlign: 'center', paddingHorizontal: Spacing.xl }}>
            Point the camera at a barcode or QR code
          </Text>
        </View>
      </View>
    </View>
  );
}
