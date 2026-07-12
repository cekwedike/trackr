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

const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 5;

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
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderLeftWidth: StyleSheet.hairlineWidth,
                  borderRightWidth: StyleSheet.hairlineWidth,
                  borderColor: t.border,
                  paddingTop: Spacing.md,
                  paddingBottom: insets.bottom + Spacing.lg,
                  paddingHorizontal: Spacing.lg,
                  ...Shadow.lg,
                },
                sheetStyle,
              ]}
            >
              {/* Grab handle — sits in a taller invisible band so the whole top edge feels draggable */}
              <View style={{ alignItems: 'center', paddingBottom: showHeader ? Spacing.md : Spacing.lg }}>
                <View
                  style={{
                    width: HANDLE_WIDTH,
                    height: HANDLE_HEIGHT,
                    borderRadius: Radius.pill,
                    backgroundColor: accent ? hexToRgba(accentColor, 0.5) : t.borderStrong,
                  }}
                />
              </View>

              {showHeader ? (
                <View style={{ marginBottom: Spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    {icon ? (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: Radius.md,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: hexToRgba(accentColor, 0.14),
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: hexToRgba(accentColor, 0.22),
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
                  {/* Full-bleed hairline separating the header from the body */}
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: t.border,
                      marginTop: Spacing.lg,
                      marginHorizontal: -Spacing.lg,
                    }}
                  />
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
