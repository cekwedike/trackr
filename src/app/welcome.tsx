import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Aurora, FadeSlide } from '@/components/anim';
import { PressableScale } from '@/components/anim/pressable';
import { Text } from '@/components/ui';
import { FontSize, FontWeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

const BRAND = '#2563EB';
const BRAND_DEEP = '#1D4ED8';

type Feature = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: 'trending-up',
    title: 'Track every sale & expense',
    body: 'Log income and spending in seconds, so you always know where your money is going.',
  },
  {
    icon: 'pie-chart',
    title: 'Know your real profit',
    body: 'Trackr does the maths and splits your profit into savings, reinvestment and pay.',
  },
  {
    icon: 'cube',
    title: 'Inventory & orders, sorted',
    body: 'Manage stock, orders and customers with a dashboard tailored to your trade.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Private & offline',
    body: 'Your books live on your device. No account needed, and it works with no internet.',
  },
];

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    const w = interpolate(scrollX.value, input, [8, 22, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.4, 1, 0.4], Extrapolation.CLAMP);
    return { width: w, opacity };
  });
  return (
    <Animated.View
      style={[
        { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
        style,
      ]}
    />
  );
}

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const slideWidth = Math.min(width, MaxContentWidth);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[BRAND, BRAND_DEEP, '#172554']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Aurora colors={['#60A5FA', '#7C3AED', '#38BDF8']} opacity={0.4} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }}>
          <FadeSlide>
            <View style={{ alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.md }}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={{ width: 68, height: 68, borderRadius: 18 }}
                contentFit="cover"
              />
              <Text variant="display" color="#FFFFFF">Trackr</Text>
              <Text variant="body" color="#DBEAFE" style={{ textAlign: 'center', paddingHorizontal: Spacing.xl }}>
                Your whole business, in your pocket.
              </Text>
            </View>
          </FadeSlide>

          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ flexGrow: 0, marginTop: Spacing.xl }}
          >
            {FEATURES.map((f) => (
              <View
                key={f.title}
                style={{ width: slideWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.xl }}
              >
                <View
                  style={{
                    width: 132,
                    height: 132,
                    borderRadius: 66,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.22)',
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 44,
                      backgroundColor: 'rgba(255,255,255,0.16)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={f.icon} size={44} color="#FFFFFF" />
                  </View>
                </View>
                <View style={{ gap: Spacing.sm, alignItems: 'center' }}>
                  <Text variant="title" color="#FFFFFF" style={{ textAlign: 'center' }}>{f.title}</Text>
                  <Text variant="body" color="#DBEAFE" style={{ textAlign: 'center', maxWidth: 320, lineHeight: 22 }}>
                    {f.body}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl }}>
            {FEATURES.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} width={slideWidth} />
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <FadeSlide from="up" delay={120}>
            <View style={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md }}>
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
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <Text variant="body" weight="bold" color={BRAND} style={{ fontSize: FontSize.lg }}>Get started</Text>
                <Ionicons name="arrow-forward" size={20} color={BRAND} />
              </PressableScale>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={13} color="#BFDBFE" />
                <Text variant="caption" color="#BFDBFE" style={{ fontWeight: FontWeight.medium }}>
                  Works offline · Private on your device
                </Text>
              </View>
            </View>
          </FadeSlide>
        </View>
      </SafeAreaView>
    </View>
  );
}
