import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { Text } from '@/components/ui';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba } from '@/lib/color';

/**
 * Lightweight bottom sheet built on gesture-handler + reanimated.
 * Slides up over a dimmed backdrop and can be swiped down to dismiss. Themed to
 * the active industry: an accented grab handle and an optional accent header
 * (icon + title + subtitle) keep it on-brand and premium.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  accent = false,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: IconName;
  accent?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const { accent: accentColor } = useApp();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(height);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
    } else {
      progress.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(height, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, height, progress, translateY]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd((e) => {
      if (translateY.value > 120 || e.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const showHeader = Boolean(title || subtitle || icon);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }, backdropStyle]}>
            <Pressable style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: t.card,
                  borderTopLeftRadius: Radius.xl,
                  borderTopRightRadius: Radius.xl,
                  paddingTop: Spacing.sm,
                  paddingBottom: insets.bottom + Spacing.lg,
                  paddingHorizontal: Spacing.lg,
                  ...Shadow.lg,
                },
                sheetStyle,
              ]}
            >
              <View
                style={{
                  alignSelf: 'center',
                  width: 44,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: accent ? hexToRgba(accentColor, 0.55) : t.borderStrong,
                  marginBottom: Spacing.md,
                }}
              />

              {showHeader ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg }}>
                  {icon ? (
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: Radius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: hexToRgba(accentColor, 0.14),
                      }}
                    >
                      <Ionicons name={icon} size={22} color={accentColor} />
                    </View>
                  ) : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    {title ? <Text variant="subtitle">{title}</Text> : null}
                    {subtitle ? (
                      <Text variant="caption" color={t.textSecondary}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
