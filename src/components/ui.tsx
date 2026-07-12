import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/anim/pressable';
import { Duration, Ease, PressScale, Spring } from '@/constants/motion';
import { FontSize, FontWeight, MaxContentWidth, Radius, Shadow, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shade } from '@/lib/color';
import { selectionFeedback } from '@/lib/haptics';

const APP_ICON = require('../../assets/images/icon.png');

/** Logo mark (optionally with wordmark) used on onboarding, lock and loading screens. */
export function Brand({
  size = 64,
  showWordmark = false,
  wordmarkColor,
  subtitle,
}: {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  subtitle?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: Spacing.md }}>
      <Image
        source={APP_ICON}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
        contentFit="cover"
      />
      {showWordmark ? (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="display" color={wordmarkColor}>Trackr</Text>
          {subtitle ? <Text variant="caption" color={t.textSecondary}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Animated on/off switch with a springy thumb and selection haptics. */
export function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = reduced
      ? withTiming(value ? 1 : 0, { duration: Duration.fast })
      : withSpring(value ? 1 : 0, Spring.snappy);
  }, [value, reduced, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? t.primary : t.borderStrong,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 3 + progress.value * 22 }, { scale: 1 + progress.value * 0.04 }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        selectionFeedback();
        onValueChange(!value);
      }}
      hitSlop={10}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[{ width: 52, height: 30, borderRadius: 15, justifyContent: 'center' }, trackStyle]}>
        <Animated.View
          style={[
            { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
            Shadow.sm,
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'info';

function toneColor(t: ThemeColors, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'primary':
      return { fg: t.primary, bg: t.primarySoft };
    case 'success':
      return { fg: t.success, bg: t.successSoft };
    case 'warning':
      return { fg: t.warning, bg: t.warningSoft };
    case 'danger':
      return { fg: t.danger, bg: t.dangerSoft };
    case 'accent':
      return { fg: t.accent, bg: t.primarySoft };
    case 'info':
      return { fg: t.info, bg: t.primarySoft };
    default:
      return { fg: t.textSecondary, bg: t.cardAlt };
  }
}

// ---------- Text ----------
type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';
export function Text({
  children,
  variant = 'body',
  color,
  weight,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  weight?: keyof typeof FontWeight;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  const base: TextStyle = { color: color ?? t.text };
  const variants: Record<TextVariant, TextStyle> = {
    display: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, letterSpacing: -0.5 },
    title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
    subtitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
    body: { fontSize: FontSize.md, fontWeight: FontWeight.regular },
    label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    caption: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: t.textSecondary },
  };
  const w = weight ? { fontWeight: FontWeight[weight] } : null;
  return (
    <RNText numberOfLines={numberOfLines} style={[base, variants[variant], w, style]}>
      {children}
    </RNText>
  );
}

// ---------- Screen ----------
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const hPad = padded ? (width >= 480 ? Spacing.xl : Spacing.lg) : 0;
  const centered: ViewStyle = { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' };
  if (scroll) {
    return (
      <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: t.background }, style]}>
        <ScrollView
          contentContainerStyle={[{ paddingBottom: Spacing.xxxl * 2, paddingHorizontal: hPad, paddingTop: padded ? Spacing.md : 0 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={centered}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: t.background }, style]}>
      <View style={[{ flex: 1, paddingHorizontal: hPad, paddingTop: padded ? Spacing.md : 0 }, centered]}>{children}</View>
    </SafeAreaView>
  );
}

// ---------- Card ----------
export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    backgroundColor: t.card,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: padded ? Spacing.lg : 0,
    ...Shadow.sm,
  };
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={PressScale.card} style={[cardStyle, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[cardStyle, style]}>{children}</View>;
}

// ---------- Button ----------
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const heights = { sm: 38, md: 48, lg: 56 };
  const filled = variant === 'primary' || variant === 'danger';
  const bg =
    variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : variant === 'secondary' ? t.cardAlt : 'transparent';
  const fg = filled ? '#FFFFFF' : variant === 'ghost' ? t.primary : t.text;
  const border = variant === 'ghost' ? { borderWidth: 1, borderColor: t.border } : null;
  const gradient: [string, string] = [shade(bg, 0.12), shade(bg, -0.14)];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={PressScale.button}
      haptic={filled}
      style={[
        {
          height: heights[size],
          borderRadius: Radius.md,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          overflow: 'hidden',
          ...(filled ? Shadow.sm : null),
        },
        border,
        style,
      ]}
    >
      {filled ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
          <RNText style={{ color: fg, fontWeight: FontWeight.semibold, fontSize: size === 'sm' ? FontSize.sm : FontSize.md }}>
            {title}
          </RNText>
        </>
      )}
    </PressableScale>
  );
}

// ---------- IconButton ----------
export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  tone,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  tone?: Tone;
}) {
  const t = useTheme();
  const c = tone ? toneColor(t, tone) : null;
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      scaleTo={PressScale.icon}
      opacityTo={0.7}
      style={{
        width: 40,
        height: 40,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c ? c.bg : 'transparent',
      }}
    >
      <Ionicons name={icon} size={size} color={color ?? c?.fg ?? t.text} />
    </PressableScale>
  );
}

// ---------- Fields ----------
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  prefix,
  autoFocus,
  style,
  right,
  secureTextEntry,
  maxLength,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  prefix?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  right?: React.ReactNode;
  secureTextEntry?: boolean;
  maxLength?: number;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: Spacing.xs }, style]}>
      {label ? <Text variant="label" color={t.textSecondary}>{label}</Text> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: t.inputBg,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: focused ? t.primary : t.border,
          paddingHorizontal: Spacing.md,
          minHeight: multiline ? 96 : 50,
        }}
      >
        {prefix ? <RNText style={{ color: t.textSecondary, fontSize: FontSize.md, marginRight: 4 }}>{prefix}</RNText> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            color: t.text,
            fontSize: FontSize.md,
            paddingVertical: multiline ? Spacing.md : Spacing.sm,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {right}
      </View>
    </View>
  );
}

// ---------- Segmented ----------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const ix = useSharedValue(0);
  const iw = useSharedValue(0);
  const ready = useSharedValue(0);

  const activeLayout = layouts[value];
  React.useEffect(() => {
    if (!activeLayout) return;
    const cfg = reduced ? { duration: Duration.fast, easing: Ease.standard } : undefined;
    if (ready.value === 0) {
      ix.value = activeLayout.x;
      iw.value = activeLayout.width;
      ready.value = 1;
    } else if (cfg) {
      ix.value = withTiming(activeLayout.x, cfg);
      iw.value = withTiming(activeLayout.width, cfg);
    } else {
      ix.value = withSpring(activeLayout.x, Spring.snappy);
      iw.value = withSpring(activeLayout.width, Spring.snappy);
    }
  }, [activeLayout, reduced, ix, iw, ready]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: ready.value,
    width: iw.value,
    transform: [{ translateX: ix.value }],
  }));

  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  };

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.cardAlt,
        borderRadius: Radius.md,
        padding: 3,
        gap: 3,
        alignSelf: scroll ? 'flex-start' : 'auto',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: 0,
            borderRadius: Radius.sm,
            backgroundColor: t.card,
            ...Shadow.sm,
          },
          indicatorStyle,
        ]}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onLayout={onItemLayout(o.value)}
            onPress={() => {
              if (!active) selectionFeedback();
              onChange(o.value);
            }}
            style={{
              flex: scroll ? undefined : 1,
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.md,
              borderRadius: Radius.sm,
              alignItems: 'center',
            }}
          >
            <RNText
              style={{
                color: active ? t.primary : t.textSecondary,
                fontWeight: active ? FontWeight.semibold : FontWeight.medium,
                fontSize: FontSize.sm,
              }}
            >
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {inner}
      </ScrollView>
    );
  }
  return inner;
}

// ---------- Chip ----------
export function Chip({ label, tone = 'default', icon, onPress }: { label: string; tone?: Tone; icon?: IconName; onPress?: () => void }) {
  const t = useTheme();
  const c = toneColor(t, tone);
  const body = (
    <>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <RNText style={{ color: c.fg, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>{label}</RNText>
    </>
  );
  const chipStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  };
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={PressScale.chip} style={chipStyle}>
        {body}
      </PressableScale>
    );
  }
  return <View style={chipStyle}>{body}</View>;
}

// ---------- StatCard ----------
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  sub,
  style,
}: {
  label: string;
  value: string;
  icon?: IconName;
  tone?: Tone;
  sub?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const c = toneColor(t, tone);
  return (
    <Card style={[{ gap: Spacing.sm }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" color={t.textSecondary}>{label}</Text>
        {icon ? (
          <View style={{ width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={16} color={c.fg} />
          </View>
        ) : null}
      </View>
      <Text variant="title" numberOfLines={1}>{value}</Text>
      {sub ? <Text variant="caption" color={t.textMuted}>{sub}</Text> : null}
    </Card>
  );
}

// ---------- ListRow ----------
export function ListRow({
  title,
  subtitle,
  right,
  icon,
  iconTone = 'default',
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  icon?: IconName;
  iconTone?: Tone;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const c = toneColor(t, iconTone);
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={PressScale.row}
      opacityTo={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
      }}
    >
      {icon ? (
        <View style={{ width: 42, height: 42, borderRadius: Radius.md, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={c.fg} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" weight="semibold" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" color={t.textSecondary} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </PressableScale>
  );
}

// ---------- EmptyState ----------
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl }}>
      <View style={{ width: 72, height: 72, borderRadius: Radius.pill, backgroundColor: t.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={32} color={t.textMuted} />
      </View>
      <Text variant="subtitle">{title}</Text>
      {message ? <Text variant="body" color={t.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>{message}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} icon="add" style={{ marginTop: Spacing.sm }} /> : null}
    </View>
  );
}

// ---------- FAB ----------
export function FAB({ icon = 'add', onPress, label }: { icon?: IconName; onPress?: () => void; label?: string }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      scaleTo={0.92}
      style={{
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.xl,
        height: 56,
        borderRadius: Radius.pill,
        backgroundColor: t.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingHorizontal: label ? Spacing.xl : 0,
        width: label ? undefined : 56,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Ionicons name={icon} size={26} color="#FFFFFF" />
      {label ? <RNText style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.md }}>{label}</RNText> : null}
    </PressableScale>
  );
}

// ---------- SectionHeader ----------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
      <Text variant="label" color={t.textSecondary}>{title.toUpperCase()}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="label" color={t.primary}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Divider ----------
export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

// ---------- AppHeader ----------
export function AppHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg }}>
      {back ? <IconButton icon="chevron-back" onPress={() => router.back()} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" color={t.textSecondary}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
