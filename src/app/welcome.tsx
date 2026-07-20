import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aurora, FadeSlide } from '@/components/anim';
import { PressableScale } from '@/components/anim/pressable';
import { Text } from '@/components/ui';
import { FontSize, FontWeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

const BRAND = '#2563EB';
const BRAND_DEEP = '#1E3A8A';
const NAVY = '#0B1B3A';
const SURFACE = '#F0F4F8';
const INK = '#0F172A';
const MUTED = '#475569';

type Feature = {
  image: number;
  title: string;
  body: string;
  caption: string;
};

const FEATURES: Feature[] = [
  {
    image: require('../../assets/images/landing/market-stall.jpg'),
    title: 'Cash & customers, together',
    body: 'Log sales and spending in seconds, keep customer balances tidy, and see who owes you — without a separate spreadsheet.',
    caption: 'Counter & till',
  },
  {
    image: require('../../assets/images/landing/shop-counter.jpg'),
    title: 'Stock that matches the floor',
    body: 'Inventory, orders, and restock signals tuned to how you actually sell — stall, shop, or service bench.',
    caption: 'Shop floor',
  },
  {
    image: require('../../assets/images/landing/notebook-phone.jpg'),
    title: 'Profit you can act on',
    body: 'Trackr splits the maths into savings, reinvestment, and pay so you know what the week really earned.',
    caption: 'Books & phone',
  },
];

function FeatureBlock({
  feature,
  index,
  scrollY,
  reduced,
}: {
  feature: Feature;
  index: number;
  scrollY: SharedValue<number>;
  reduced: boolean | null | undefined;
}) {
  const parallax = useAnimatedStyle(() => {
    if (reduced) return {};
    // Soft parallax as each photo section enters — entrance feel without noise.
    const start = 280 + index * 360;
    const shift = interpolate(scrollY.value, [start - 160, start + 200], [18, -12], Extrapolation.CLAMP);
    return { transform: [{ translateY: shift }] };
  });

  return (
    <FadeSlide delay={reduced ? 0 : 40 + index * 40} from="up" offset={20}>
      <View style={{ marginBottom: Spacing.xxl, gap: Spacing.md }}>
        <View
          style={{
            borderRadius: Radius.lg,
            overflow: 'hidden',
            backgroundColor: '#E2E8F0',
            height: 220,
          }}
        >
          <Animated.View style={[{ flex: 1 }, parallax]}>
            <Image
              source={feature.image}
              style={{ width: '100%', height: 250 }}
              contentFit="cover"
              transition={reduced ? 0 : 280}
            />
          </Animated.View>
          <LinearGradient
            colors={['transparent', 'rgba(11,27,58,0.55)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, justifyContent: 'flex-end', padding: Spacing.md }}
          >
            <Text variant="caption" color="#E2E8F0" weight="semibold" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {feature.caption}
            </Text>
          </LinearGradient>
        </View>
        <Text variant="title" color={INK}>{feature.title}</Text>
        <Text variant="body" color={MUTED} style={{ lineHeight: 22 }}>
          {feature.body}
        </Text>
      </View>
    </FadeSlide>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const heroMin = Math.max(height - insets.top - insets.bottom, 560);

  return (
    <View style={{ flex: 1, backgroundColor: NAVY }}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        {/* —— Brand-led hero (first viewport) —— */}
        <View style={{ minHeight: heroMin, backgroundColor: NAVY }}>
          <LinearGradient
            colors={[NAVY, BRAND_DEEP, BRAND]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Blue / cyan only — no purple Aurora */}
          <Aurora colors={['#60A5FA', '#38BDF8', '#93C5FD']} opacity={0.28} />

          <View
            style={{
              flex: 1,
              minHeight: heroMin,
              paddingTop: insets.top + Spacing.xl,
              paddingHorizontal: Spacing.xl,
              paddingBottom: Spacing.xl,
              width: '100%',
              maxWidth: MaxContentWidth,
              alignSelf: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }}>
              <FadeSlide delay={0} from="down" offset={reduced ? 0 : 12}>
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={{ width: 88, height: 88, borderRadius: 22 }}
                  contentFit="cover"
                  accessibilityLabel="Trackr logo"
                />
              </FadeSlide>

              <FadeSlide delay={reduced ? 0 : 90} from="up" offset={reduced ? 0 : 14}>
                <View style={{ alignItems: 'center', gap: Spacing.md }}>
                  <Text
                    variant="display"
                    color="#FFFFFF"
                    style={{ fontSize: FontSize.xxxl + 8, letterSpacing: -0.5, textAlign: 'center' }}
                  >
                    Trackr
                  </Text>
                  <Text
                    variant="title"
                    color="#FFFFFF"
                    style={{ textAlign: 'center', maxWidth: 340, lineHeight: 30 }}
                  >
                    Your whole business office, in your pocket.
                  </Text>
                  <Text
                    variant="body"
                    color="#BFDBFE"
                    style={{ textAlign: 'center', maxWidth: 320, lineHeight: 22 }}
                  >
                    Cash, stock, customers, and profit — private on your device, ready offline.
                  </Text>
                </View>
              </FadeSlide>
            </View>

            <FadeSlide delay={reduced ? 0 : 180} from="up" offset={reduced ? 0 : 18}>
              <View style={{ gap: Spacing.md }}>
                <PressableScale
                  haptic
                  accessibilityLabel="Get started"
                  onPress={() => router.push('/onboarding')}
                  style={{
                    height: 56,
                    borderRadius: Radius.md,
                    backgroundColor: '#FFFFFF',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Spacing.sm,
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 6,
                  }}
                >
                  <Text variant="body" weight="bold" color={BRAND} style={{ fontSize: FontSize.lg }}>
                    Get started
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={BRAND} />
                </PressableScale>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="lock-closed" size={13} color="#93C5FD" />
                  <Text variant="caption" color="#93C5FD" style={{ fontWeight: FontWeight.medium }}>
                    Works offline · Private on your device
                  </Text>
                </View>
              </View>
            </FadeSlide>
          </View>
        </View>

        {/* —— Daylight feature sections with stock photos —— */}
        <View style={{ backgroundColor: SURFACE, paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl }}>
          <View style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }}>
            <Text
              variant="caption"
              color={BRAND}
              weight="bold"
              style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm }}
            >
              Built for the shop floor
            </Text>
            <Text variant="title" color={INK} style={{ marginBottom: Spacing.xl, maxWidth: 360 }}>
              One app for the work you already do.
            </Text>

            {FEATURES.map((f, i) => (
              <FeatureBlock key={f.title} feature={f} index={i} scrollY={scrollY} reduced={reduced} />
            ))}

            <View
              style={{
                paddingVertical: Spacing.xl,
                gap: Spacing.md,
                borderTopWidth: 1,
                borderTopColor: '#D8E0EA',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
                <Ionicons name="shield-checkmark" size={22} color={BRAND} style={{ marginTop: 2 }} />
                <Text variant="body" color={MUTED} style={{ flex: 1, lineHeight: 22 }}>
                  Your books live on this device. Export backups you control. No Trackr cloud account required.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm }}>
                {(
                  [
                    { label: 'Privacy Policy', href: '/legal/privacy' },
                    { label: 'Terms of Use', href: '/legal/terms' },
                    { label: 'Offline & Data', href: '/legal/offline' },
                  ] as const
                ).map((link) => (
                  <PressableScale
                    key={link.label}
                    accessibilityRole="link"
                    accessibilityLabel={link.label}
                    onPress={() => router.push(link.href as Href)}
                    style={{ paddingVertical: Spacing.sm, paddingRight: Spacing.md }}
                  >
                    <Text variant="caption" color={BRAND} weight="semibold" style={{ textDecorationLine: 'underline' }}>
                      {link.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
