import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { Card, Text } from '@/components/ui';
import { AnimatedGrid } from '@/components/nav/animated-grid';
import { Sheet } from '@/components/nav/sheet';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { hexToRgba } from '@/lib/color';
import { pressFeedback } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

export interface FabAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

const SIZE = 60;
const MARGIN = Spacing.lg;
const TAB_BAR = 60;

function clampW(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

interface Persisted {
  side: 'left' | 'right';
  ty: number;
  key?: string;
}

/**
 * A draggable, editable floating action button.
 * - Drag anywhere; releases snap to the nearest screen edge and persist.
 * - Tap fires the currently selected action.
 * - Long-press opens a sheet to choose which action it triggers.
 */
export function MovableFab({ actions, storageKey = 'fab' }: { actions: FabAction[]; storageKey?: string }) {
  const t = useTheme();
  const { accent } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const maxLeft = -(width - SIZE - 2 * MARGIN);
  const contentHeight = height - insets.top - (TAB_BAR + insets.bottom);
  const minUp = -Math.max(0, contentHeight - SIZE - 2 * MARGIN);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pressed = useSharedValue(0);

  const [selectedKey, setSelectedKey] = useState<string>(actions[0]?.key ?? '');
  const [menuOpen, setMenuOpen] = useState(false);

  const selected = actions.find((a) => a.key === selectedKey) ?? actions[0];

  const persist = (side: 'left' | 'right', y: number, key: string) => {
    SecureStore.setItemAsync(`movablefab.${storageKey}`, JSON.stringify({ side, ty: y, key } satisfies Persisted)).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(`movablefab.${storageKey}`)
      .then((raw) => {
        if (!active || !raw) return;
        const p = JSON.parse(raw) as Persisted;
        tx.value = p.side === 'left' ? maxLeft : 0;
        ty.value = clampW(p.ty ?? 0, minUp, 0);
        if (p.key && actions.some((a) => a.key === p.key)) setSelectedKey(p.key);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, maxLeft, minUp]);

  const trigger = () => {
    pressFeedback();
    selected?.onPress();
  };
  const openMenu = () => setMenuOpen(true);

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onChange((e) => {
      tx.value = clampW(startX.value + e.translationX, maxLeft, 0);
      ty.value = clampW(startY.value + e.translationY, minUp, 0);
    })
    .onEnd(() => {
      const side: 'left' | 'right' = tx.value < maxLeft / 2 ? 'left' : 'right';
      tx.value = withSpring(side === 'left' ? maxLeft : 0, { damping: 18, stiffness: 200 });
      runOnJS(persist)(side, ty.value, selectedKey);
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      runOnJS(trigger)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(320)
    .onStart(() => {
      pressed.value = withSpring(1);
      runOnJS(openMenu)();
    })
    .onFinalize(() => {
      pressed.value = withSpring(0);
    });

  const gesture = Gesture.Race(pan, longPress, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + pressed.value * 0.06 }],
  }));

  if (!selected) return null;

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: MARGIN,
              bottom: MARGIN,
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 5 },
              elevation: 8,
            },
            style,
          ]}
        >
          <Ionicons name={selected.icon} size={28} color="#FFFFFF" />
        </Animated.View>
      </GestureDetector>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Quick action">
        <Text variant="caption" color={t.textSecondary} style={{ marginBottom: Spacing.md }}>
          Choose what this button does. Drag it anywhere; it snaps to the edge.
        </Text>
        <AnimatedGrid
          data={actions}
          columns={2}
          keyExtractor={(a) => a.key}
          renderItem={(a) => {
            const active = a.key === selectedKey;
            return (
              <Card
                onPress={() => {
                  setSelectedKey(a.key);
                  persist(tx.value < maxLeft / 2 ? 'left' : 'right', ty.value, a.key);
                  setMenuOpen(false);
                }}
                style={{
                  alignItems: 'center',
                  gap: Spacing.sm,
                  paddingVertical: Spacing.lg,
                  borderColor: active ? accent : t.border,
                  borderWidth: active ? 1.5 : 1,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: hexToRgba(accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={a.icon} size={22} color={accent} />
                </View>
                <Text variant="label" color={t.text}>{a.label}</Text>
              </Card>
            );
          }}
        />
      </Sheet>
    </>
  );
}
