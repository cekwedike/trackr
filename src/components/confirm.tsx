import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback } from '@/lib/haptics';

export type ConfirmActionStyle = 'default' | 'destructive' | 'cancel';

export interface ConfirmAction<V = string> {
  label: string;
  style?: ConfirmActionStyle;
  value: V;
}

export interface ConfirmOptions<V = string> {
  title: string;
  message?: string;
  actions: ConfirmAction<V>[];
}

type ConfirmFn = <V = string>(options: ConfirmOptions<V>) => Promise<V | undefined>;

export interface AlertOptions {
  title: string;
  message?: string;
  okLabel?: string;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * The most recently mounted provider's confirm function, exposed so plain
 * (non-React) modules — e.g. `lib/attachments`, `lib/permissions` — can present
 * the branded dialog instead of the grey native `Alert.alert`. It is registered
 * by {@link ConfirmProvider} while mounted.
 */
let registeredConfirm: ConfirmFn | null = null;

/** Native dialog fallback used only if no ConfirmProvider is mounted yet. */
function nativeFallback<V>(options: ConfirmOptions<V>): Promise<V | undefined> {
  return new Promise<V | undefined>((resolve) => {
    const cancel = options.actions.find((a) => a.style === 'cancel');
    Alert.alert(
      options.title,
      options.message,
      options.actions.map((a) => ({
        text: a.label,
        style: a.style === 'destructive' ? 'destructive' : a.style === 'cancel' ? 'cancel' : 'default',
        onPress: () => resolve(a.value),
      })),
      { cancelable: true, onDismiss: () => resolve(cancel ? cancel.value : undefined) },
    );
  });
}

/**
 * Imperative branded confirm usable anywhere (including outside React). Prefer
 * {@link useConfirm} inside components; use this from libs/utilities.
 */
export function confirmAsync<V = string>(options: ConfirmOptions<V>): Promise<V | undefined> {
  if (registeredConfirm) return registeredConfirm(options);
  return nativeFallback(options);
}

/** Imperative branded single-button alert (replacement for `Alert.alert`). */
export function alertAsync(options: AlertOptions): Promise<void> {
  return confirmAsync({
    title: options.title,
    message: options.message,
    actions: [{ label: options.okLabel ?? 'OK', style: 'default', value: 'ok' }],
  }).then(() => undefined);
}

/**
 * Mount once near the app root. Exposes an imperative, themed replacement for
 * `Alert.alert` confirmations via {@link useConfirm}. The dialog matches the
 * app + industry accent, dims the backdrop, closes on tap-outside / hardware
 * back (resolving the `cancel` action) and animates in with a transform-driven
 * entrance (a scale + opacity via `useAnimatedStyle`, NOT a reanimated
 * `entering` layout animation — so its buttons reliably receive taps on
 * Android, the same reason the picker sheet was reworked).
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ConfirmOptions<unknown> | null>(null);
  const resolver = useRef<((value: unknown) => void) | null>(null);

  const settle = useCallback((value: unknown) => {
    const resolve = resolver.current;
    resolver.current = null;
    setCurrent(null);
    if (resolve) resolve(value);
  }, []);

  const confirm = useCallback(
    <V,>(options: ConfirmOptions<V>): Promise<V | undefined> =>
      new Promise<V | undefined>((resolve) => {
        // If a dialog is somehow already open, resolve it as cancelled first.
        if (resolver.current) resolver.current(undefined);
        resolver.current = resolve as (value: unknown) => void;
        setCurrent(options as ConfirmOptions<unknown>);
      }),
    [],
  );

  // Expose this provider's confirm to the imperative API (for non-React callers).
  useEffect(() => {
    registeredConfirm = confirm;
    return () => {
      if (registeredConfirm === confirm) registeredConfirm = null;
    };
  }, [confirm]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current ? <ConfirmDialog options={current} onSettle={settle} /> : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}

/** Branded single-button alert hook (replacement for `Alert.alert`). */
export function useAlert(): (options: AlertOptions) => Promise<void> {
  const confirm = useConfirm();
  return useCallback(
    (options: AlertOptions) =>
      confirm({
        title: options.title,
        message: options.message,
        actions: [{ label: options.okLabel ?? 'OK', style: 'default', value: 'ok' }],
      }).then(() => undefined),
    [confirm],
  );
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions<unknown>;
  onSettle: (value: unknown) => void;
}) {
  const t = useTheme();
  const { accent } = useApp();

  const progress = useSharedValue(0);
  const scale = useSharedValue(0.94);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 180 });
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [progress, scale]);

  const cancelValue = useCallback(() => {
    const cancel = options.actions.find((a) => a.style === 'cancel');
    return cancel ? cancel.value : undefined;
  }, [options]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onSettle(cancelValue());
      return true;
    });
    return () => sub.remove();
  }, [onSettle, cancelValue]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: scale.value }],
  }));

  // Present the confirming action(s) first and any cancel action last.
  const ordered = [
    ...options.actions.filter((a) => a.style !== 'cancel'),
    ...options.actions.filter((a) => a.style === 'cancel'),
  ];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => onSettle(cancelValue())}>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={() => onSettle(cancelValue())} accessibilityLabel="Dismiss" />
        </Animated.View>

        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 400,
              backgroundColor: t.card,
              borderRadius: Radius.xl,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.border,
              padding: Spacing.lg,
              gap: Spacing.md,
              ...Shadow.lg,
            },
            cardStyle,
          ]}
        >
          <Text variant="title" numberOfLines={2}>
            {options.title}
          </Text>
          {options.message ? (
            <Text variant="body" color={t.textSecondary}>
              {options.message}
            </Text>
          ) : null}

          <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
            {ordered.map((action, i) => (
              <ConfirmButton
                key={`${action.label}-${i}`}
                action={action}
                accent={accent}
                onPress={() => {
                  selectionFeedback();
                  onSettle(action.value);
                }}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ConfirmButton({
  action,
  accent,
  onPress,
}: {
  action: ConfirmAction<unknown>;
  accent: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const style = action.style ?? 'default';
  const isCancel = style === 'cancel';
  const isDestructive = style === 'destructive';

  const bg = isDestructive ? t.danger : accent;
  const fg = isCancel ? t.textSecondary : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isCancel ? (pressed ? t.cardAlt : 'transparent') : bg,
        borderWidth: isCancel ? StyleSheet.hairlineWidth : 0,
        borderColor: t.border,
        opacity: pressed && !isCancel ? 0.85 : 1,
        ...(isCancel ? null : Shadow.sm),
      })}
    >
      <Text variant="body" weight="semibold" color={fg}>
        {action.label}
      </Text>
    </Pressable>
  );
}
