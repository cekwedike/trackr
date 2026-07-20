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
    body: 'Log sales and spending in seconds, keep balances tidy, and see who owes you.',
    caption: 'Counter & till',
  },
  {
    image: require('../../assets/images/landing/shop-counter.jpg'),
    title: 'Stock that matches the floor',
    body: 'Inventory, orders, and restock signals tuned to how you actually sell.',
    caption: 'Shop floor',
  },
  {
    image: require('../../assets/images/landing/notebook-phone.jpg'),
    title: 'Profit you can act on',
    body: 'Splits the maths into savings, reinvestment, and pay — so you know what the week earned.',
    caption: 'Books & phone',
  },
];

function Dot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    const w = interpolate(scrollX.value, input, [8, 22, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP);
    return { width: w, opacity };
  });
  return (
    <Animated.View
      style={[{ height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }, style]}
    />
  );
}

function FeatureSlide({
  feature,
  index,
  slideWidth,
  scrollX,
  reduced,
}: {
  feature: Feature;
  index: number;
  slideWidth: number;
  scrollX: SharedValue<number>;
  reduced: boolean | null | undefined;
}) {
  const mediaStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const input = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
    const scale = interpolate(scrollX.value, input, [0.92, 1, 0.92], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.55, 1, 0.55], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <View
      style={{
        width: slideWidth,
        paddingHorizontal: Spacing.xl,
        justifyContent: 'center',
      }}
    >
      <Animated.View style={[{ gap: Spacing.md }, mediaStyle]}>
        <View
          style={{
            borderRadius: Radius.lg,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.08)',
            height: 200,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Image
            source={feature.image}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={reduced ? 0 : 240}
          />
          <LinearGradient
            colors={['transparent', 'rgba(11,27,58,0.72)']}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 72,
              justifyContent: 'flex-end',
              paddingHorizontal: Spacing.md,
              paddingBottom: Spacing.sm,
            }}
          >
            <Text
              variant="caption"
              color="#E2E8F0"
              weight="semibold"
              style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}
            >
              {feature.caption}
            </Text>
          </LinearGradient>
        </View>
        <View style={{ gap: Spacing.sm, alignItems: 'center' }}>
          <Text variant="title" color="#FFFFFF" style={{ textAlign: 'center' }}>
            {feature.title}
          </Text>
          <Text
            variant="body"
            color="#BFDBFE"
            style={{ textAlign: 'center', maxWidth: 320, lineHeight: 22 }}
          >
            {feature.body}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const slideWidth = Math.min(width, MaxContentWidth);

  return (
    <View style={{ flex: 1, backgroundColor: NAVY }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[NAVY, BRAND_DEEP, BRAND]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Aurora colors={['#60A5FA', '#38BDF8', '#93C5FD']} opacity={0.3} />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.md,
          width: '100%',
          maxWidth: MaxContentWidth,
          alignSelf: 'center',
        }}
      >
        {/* Brand-led hero — first viewport signal */}
        <FadeSlide delay={0} from="down" offset={reduced ? 0 : 12}>
          <View style={{ alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md }}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={{ width: 76, height: 76, borderRadius: 20 }}
              contentFit="cover"
              accessibilityLabel="Trackr logo"
            />
            <Text
              variant="display"
              color="#FFFFFF"
              style={{ fontSize: FontSize.xxxl + 6, letterSpacing: -0.5, textAlign: 'center' }}
            >
              Trackr
            </Text>
            <Text
              variant="title"
              color="#FFFFFF"
              style={{ textAlign: 'center', maxWidth: 340, lineHeight: 28 }}
            >
              Your whole business office, in your pocket.
            </Text>
            <Text
              variant="body"
              color="#BFDBFE"
              style={{ textAlign: 'center', maxWidth: 300, lineHeight: 21 }}
            >
              Cash, stock, customers, and profit — private on your device.
            </Text>
          </View>
        </FadeSlide>

        {/* Horizontal feature carousel */}
        <FadeSlide delay={reduced ? 0 : 100} from="up" offset={reduced ? 0 : 16} style={{ flex: 1, marginTop: Spacing.lg }}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ flexGrow: 0 }}
          >
            {FEATURES.map((f, i) => (
              <FeatureSlide
                key={f.title}
                feature={f}
                index={i}
                slideWidth={slideWidth}
                scrollX={scrollX}
                reduced={reduced}
              />
            ))}
          </Animated.ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: Spacing.md,
            }}
          >
            {FEATURES.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} width={slideWidth} />
            ))}
          </View>
        </FadeSlide>

        {/* CTA + compact legal footer */}
        <FadeSlide delay={reduced ? 0 : 180} from="up" offset={reduced ? 0 : 14}>
          <View style={{ paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingTop: Spacing.md }}>
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

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: Spacing.md,
                paddingTop: Spacing.xs,
              }}
            >
              {(
                [
                  { label: 'Privacy', href: '/legal/privacy' },
                  { label: 'Terms', href: '/legal/terms' },
                  { label: 'Offline', href: '/legal/offline' },
                ] as const
              ).map((link) => (
                <PressableScale
                  key={link.label}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  onPress={() => router.push(link.href as Href)}
                  style={{ paddingVertical: Spacing.xs }}
                >
                  <Text
                    variant="caption"
                    color="#93C5FD"
                    weight="semibold"
                    style={{ textDecorationLine: 'underline' }}
                  >
                    {link.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </FadeSlide>
      </View>
    </View>
  );
}
