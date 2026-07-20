import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FadeSlide } from '@/components/anim';
import { AppHeader, Card, Screen, Text, TextField } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { Duration, Ease } from '@/constants/motion';
import type { IndustryTerms } from '@/constants/industries';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { hexToRgba, shade } from '@/lib/color';
import { markFaqVisited } from '@/lib/onboarding';

interface Faq {
  q: string;
  a: string;
}

interface FaqCategory {
  key: string;
  title: string;
  icon: IconName;
  items: Faq[];
}

function buildFaqs(terms: IndustryTerms): FaqCategory[] {
  const sale = terms.sale.toLowerCase();
  const sales = terms.sales.toLowerCase();
  const item = terms.item.toLowerCase();
  const items = terms.items.toLowerCase();
  const customer = terms.customer.toLowerCase();
  const customers = terms.customers.toLowerCase();
  const order = terms.order.toLowerCase();
  const orders = terms.orders.toLowerCase();
  const production = terms.productionLabel.toLowerCase();
  const inventory = terms.inventoryLabel.toLowerCase();

  return [
    {
      key: 'start',
      title: 'Getting started',
      icon: 'rocket',
      items: [
        {
          q: 'What is Trackr?',
          a: `Trackr is your pocket business book. It records ${sales}, expenses, ${customers}, ${orders} and stock, then shows your profit and where your money should go — all in one tidy place.`,
        },
        {
          q: 'Do I need internet? Is my data private?',
          a: 'No internet needed. Trackr works fully offline and everything is stored privately on your device — nothing is uploaded to any server. Because it lives on your phone, remember to make backups (see Backup & data).',
        },
        {
          q: 'How do I add my first records?',
          a: `Tap the round + button (the floating action button) on the dashboard for quick actions, or open the "More" tab to reach every screen. Start by recording a ${sale}, adding an ${item}, or logging an expense.`,
        },
        {
          q: 'What is the Getting started checklist?',
          a: 'The card at the top of your dashboard walks you through the first useful tasks. Each step ticks itself off automatically as you use the app. Once you feel at home, tap the menu on the card and choose "Hide" to dismiss it.',
        },
        {
          q: 'Can I change the wording to fit my trade?',
          a: 'Yes. Trackr adapts its labels, dashboard and tabs to your industry. Change it any time in Settings → Industry / Dashboard.',
        },
      ],
    },
    {
      key: 'nav',
      title: 'Dashboard & navigation',
      icon: 'grid',
      items: [
        {
          q: 'What do the cards on my dashboard mean?',
          a: 'The dashboard summarises your business for the selected time range. The big banner shows revenue, expenses and net profit. Below it you get profit, key stats, alerts and shortcuts chosen for your industry.',
        },
        {
          q: 'How do I change the time period (day/week/month/year)?',
          a: 'Use the Day · Week · Month · Year switch inside the revenue banner at the top. Every figure on the dashboard updates to match.',
        },
        {
          q: 'What is the floating + button, and can I move it?',
          a: 'It is your quick-actions button. Tap it to open shortcuts like new ' + sale + ', expense or ' + order + '. Drag it anywhere — it snaps to the nearest edge. Long-press it (or tap "Edit menu") to choose which actions appear.',
        },
        {
          q: 'Where do I find features that aren’t on the dashboard?',
          a: 'Open the "More" tab. It groups everything — money, ' + customers + ', ' + inventory + ', notes, reminders, search and settings.',
        },
      ],
    },
    {
      key: 'sales',
      title: `${terms.sales} & income`,
      icon: 'cart',
      items: [
        {
          q: `How do I record a ${sale}?`,
          a: `Tap + → ${terms.sale}, or go to More → ${terms.sales} history → add. Add items (pick a saved ${item} or type a custom one), set quantity and price, choose a payment method and, optionally, a ${customer}. Tap Save.`,
        },
        {
          q: 'What do the payment methods mean?',
          a: 'They record HOW you were paid: Cash, Transfer, POS, Card, Credit or Other. Choose "Credit (owed)" when the ' + customer + ' hasn’t paid yet — Trackr adds it to their debt balance automatically.',
        },
        {
          q: `Does recording a ${sale} reduce my stock?`,
          a: `Yes. When a line item is linked to a saved ${item}, its stock goes down by the quantity sold and the movement is logged, so your ${inventory} stays accurate.`,
        },
        {
          q: `Can I edit or delete a ${sale}?`,
          a: `Open More → ${terms.sales} history and tap the ${sale} to view it. From there you can share a receipt or delete it. Deleting removes it from your totals.`,
        },
      ],
    },
    {
      key: 'expenses',
      title: 'Expenses',
      icon: 'wallet',
      items: [
        {
          q: 'How do I log an expense?',
          a: 'Tap + → Expense, or open More → Expenses → add. Enter the amount, an optional description and a category, then save. Logging expenses is what makes your profit figures honest.',
        },
        {
          q: 'Why should I categorise expenses?',
          a: 'Categories (Rent, Supplies, Transport, Salaries, and so on) let Analytics show where your money goes, so you can spot leaks and cut costs.',
        },
        {
          q: 'Do expenses affect my profit?',
          a: 'Yes. Expenses are your operating costs. Net profit = revenue − cost of goods sold − expenses. See Profit & allocation for the full picture.',
        },
      ],
    },
    {
      key: 'inventory',
      title: `${terms.inventoryLabel} & ${items}`,
      icon: 'cube',
      items: [
        {
          q: `How do I add an ${item}?`,
          a: `Open More → ${inventory} → add (or + → ${terms.item} where available). Enter a name, selling price and unit cost. Trackr shows your profit per unit as you type.`,
        },
        {
          q: 'What is the "Low-stock alert at" number?',
          a: `It is the reorder point. When an ${item}'s quantity falls to this number or below, it appears in your ${inventory} alerts so you can restock in time. Set it to 0 to turn the alert off for that ${item}.`,
        },
        {
          q: 'What’s the difference between price and cost?',
          a: 'Selling price is what the ' + customer + ' pays you. Unit cost is what the item costs YOU. The gap between them is your profit per unit, and cost feeds into cost of goods sold (COGS).',
        },
        {
          q: 'How do I restock or adjust quantity?',
          a: `Open the ${item}, use the "Quick adjust" box to add or remove quantity. Every change is logged as a stock movement.`,
        },
      ],
    },
    {
      key: 'production',
      title: `${terms.productionLabel} & costing`,
      icon: 'restaurant',
      items: [
        {
          q: `What is the ${production} / recipe cost calculator?`,
          a: `It works out what one batch costs to make. Add the ingredients you use and their quantities; Trackr multiplies each by its unit cost, totals the batch, and divides by your yield to give a cost per unit.`,
        },
        {
          q: 'How is cost per unit calculated?',
          a: 'Cost per unit = total batch cost ÷ yield (units produced). Link a product to also see your profit per unit at its selling price.',
        },
        {
          q: 'What does the pricing helper do?',
          a: 'Enter a target profit margin and Trackr suggests a selling price that hits it, based on your cost per unit. Great for pricing new items with confidence.',
        },
      ],
    },
    {
      key: 'orders',
      title: `${terms.orders} & ${customers}`,
      icon: 'people',
      items: [
        {
          q: `How do I create an ${order}?`,
          a: `Tap + → ${terms.order}, or More → ${orders} → add. Choose or type a ${customer}, add items, set a status and due date, and record how much has been paid.`,
        },
        {
          q: 'What do the order statuses mean?',
          a: 'Pending = not started. In progress = being worked on. Ready = done and awaiting pickup/delivery. Delivered = completed and handed over. Cancelled = called off. Delivered and cancelled ' + orders + ' drop out of your active pipeline.',
        },
        {
          q: 'What are "amount paid" and "balance"?',
          a: 'Amount paid is what the ' + customer + ' has given you so far. Balance = total − amount paid, i.e. what they still owe. A balance above zero shows in amber until it’s settled.',
        },
        {
          q: `How do ${customers} and debts work?`,
          a: `Add ${customers} under More → ${terms.customers}. Each has contact details, a birthday and a debt balance. Selling on "Credit" or leaving an ${order} balance builds their debt; record payments to reduce it.`,
        },
      ],
    },
    {
      key: 'profit',
      title: 'Profit & allocation',
      icon: 'calculator',
      items: [
        {
          q: 'How is my profit calculated?',
          a: 'Gross profit = revenue − cost of goods sold (COGS). Net profit = gross profit − operating expenses. Trackr uses cash-basis accounting: figures reflect ' + sales + ' and expenses dated within the month.',
        },
        {
          q: 'What is "realized" or distributable profit?',
          a: 'It’s the profit that actually exists to share out. You can only distribute money you truly made, so a break-even or loss month gives zero to distribute — the calculator won’t split a loss.',
        },
        {
          q: 'What is profit allocation / the profit split?',
          a: 'It’s your plan for every unit of profit — for example 50% back into the business, 20% savings, 10% emergency fund, and so on. You set buckets and percentages (which must total 100%), and Trackr shows the exact amount for each.',
        },
        {
          q: 'How do I set and save my split?',
          a: `Open More → Profit Calculator. Tap "Edit split", add buckets and percentages until they total 100%, then tap Record. Recording the current month also saves the split as your starting template for future months.`,
        },
        {
          q: 'Handy shortcuts in the calculator',
          a: 'Use "Even split" to divide evenly, your industry "template" for a recommended split, or "Copy last month" to reuse a previous plan. Swipe between months with the arrows at the top.',
        },
      ],
    },
    {
      key: 'receipts',
      title: 'Receipts & invoices',
      icon: 'document-text',
      items: [
        {
          q: 'Can I send a receipt or invoice?',
          a: `Yes. Open a ${sale} to share a branded receipt, or an ${order} to send an invoice (which also shows amount paid and balance due). Trackr builds a clean PDF using your business name and industry colour.`,
        },
        {
          q: 'How do I share or print it?',
          a: 'From the ' + sale + '/' + order + ' screen tap Share to open your phone’s share sheet (WhatsApp, email, etc.) or Print to use AirPrint / Android printing. If sharing isn’t available, the PDF is saved instead.',
        },
        {
          q: 'How do I brand my documents?',
          a: 'Set your business name in Settings, and pick an industry — its accent colour is used on every receipt and invoice.',
        },
      ],
    },
    {
      key: 'reminders',
      title: 'Reminders & notifications',
      icon: 'alarm',
      items: [
        {
          q: 'How do I create a reminder?',
          a: 'Tap + → Reminder, or open More → Reminders → add. Give it a title, a due date/time and an optional repeat (daily, weekly, monthly). It appears on your dashboard and can notify you.',
        },
        {
          q: 'Why didn’t I get a notification?',
          a: 'Make sure you allowed notifications for Trackr when prompted. If you tapped "Don’t allow", enable them in your phone’s Settings → Apps → Trackr → Notifications, then reopen the app.',
        },
        {
          q: 'How do I mark a reminder done?',
          a: 'Open Reminders and tick it off. Repeating reminders roll forward to their next occurrence.',
        },
      ],
    },
    {
      key: 'search',
      title: 'Search',
      icon: 'search',
      items: [
        {
          q: 'What can I search for?',
          a: `Open More → Search to look across ${sales}, ${customers}, ${orders}, ${items}, expenses and notes in one place. Type a name, note or amount and tap a result to jump straight to it.`,
        },
        {
          q: 'Tips for finding things fast',
          a: 'Search matches partial words, so a few letters are enough. Try a ' + customer + ' name, an item name, or a word from a note.',
        },
      ],
    },
    {
      key: 'security',
      title: 'Security & app lock',
      icon: 'lock-closed',
      items: [
        {
          q: 'How do I lock the app with a PIN?',
          a: 'Go to Settings → Security → App lock (PIN) and set a 4–6 digit PIN. Trackr asks for it when you open the app and again after you leave it in the background for a short time.',
        },
        {
          q: 'Does app lock encrypt my books?',
          a: 'No. App lock is a gate that slows casual access (PIN or biometrics). It does not encrypt the database on disk. Use a strong device screen lock, and always protect backups with a passphrase when you export them.',
        },
        {
          q: 'Can I use fingerprint or face unlock?',
          a: 'Yes — once a PIN is set, turn on "Unlock with biometrics" in Settings → Security. You’ll need biometrics already set up on your device. The PIN stays as a fallback.',
        },
        {
          q: 'I forgot my PIN — what now?',
          a: 'For your privacy the PIN can’t be recovered. If you have a passphrase-protected backup, you can reinstall the app and restore it. Otherwise the app data must be cleared to reset the lock, which erases local data — so keep regular backups.',
        },
      ],
    },
    {
      key: 'backup',
      title: 'Backup & data',
      icon: 'cloud-upload',
      items: [
        {
          q: 'How do I back up my data?',
          a: 'Open Settings → Data → Export backup (or Data & backup → Back up now). Choose a passphrase — new backups are encrypted with it. Store the file in Files, email or a cloud drive you control. Do this regularly, especially before sharing a backup.',
        },
        {
          q: 'How do I restore a backup?',
          a: 'Settings → Data → Restore backup (or Data & backup). Pick your file. Encrypted backups ask for the passphrase. Older unprotected zip/JSON files still work, but you’ll see a warning that anyone with that file can read your books. Restoring REPLACES all current data.',
        },
        {
          q: 'Will I lose my data if I uninstall?',
          a: 'Possibly — data lives on your device. Uninstalling can remove it. Always export a passphrase-protected backup before uninstalling, switching phones or clearing app storage.',
        },
      ],
    },
    {
      key: 'industries',
      title: 'Industries & customization',
      icon: 'color-palette',
      items: [
        {
          q: 'How does choosing an industry change the app?',
          a: 'It re-themes Trackr: labels (for example ' + terms.orders + ', ' + terms.customers + '), the dashboard cards and shortcuts, the accent colour, and a recommended profit split — all tuned to how your trade works.',
        },
        {
          q: 'How do I switch industries?',
          a: 'Settings → Industry / Dashboard. When switching, you can keep your current profit split or replace it with the new industry’s template. Your records stay intact.',
        },
        {
          q: 'Can I change currency and business name?',
          a: 'Yes, both in Settings → Business. Currency updates every amount and every receipt across the app.',
        },
      ],
    },
    {
      key: 'trouble',
      title: 'Troubleshooting',
      icon: 'construct',
      items: [
        {
          q: 'A number looks wrong on my dashboard',
          a: 'Check the time range in the top banner (Day/Week/Month/Year) — figures only cover the selected period. Also confirm each record’s date, since Trackr sorts money by the date you set on it.',
        },
        {
          q: 'My profit seems too low or negative',
          a: 'That usually means expenses (or COGS) are high for the period, or income for the period hasn’t been recorded yet. Review Expenses and make sure every ' + sale + ' is logged with the right date.',
        },
        {
          q: 'Something isn’t updating',
          a: 'Screens refresh when you open them. Navigate away and back, or pull the app to the foreground. If a figure still looks off, double-check the record’s date and amount.',
        },
        {
          q: 'Still stuck?',
          a: 'Export a backup to keep your data safe, then try closing and reopening Trackr. Most hiccups clear with a fresh start — and your offline data stays put.',
        },
        {
          q: 'Where are Privacy and Terms?',
          a: 'Open Settings → About, or More → Legal. The in-app Privacy Policy, Terms of Use, and Offline & Data notice are drafts for product use — have a lawyer review them before submitting Trackr to the App Store or Play Store.',
        },
      ],
    },
  ];
}

export default function FaqScreen() {
  const t = useTheme();
  const { accent, terms } = useApp();
  const [query, setQuery] = useState('');
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    markFaqVisited();
  }, []);

  const categories = useMemo(() => buildFaqs(terms), [terms]);
  const searching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({ ...cat, items: cat.items.filter((it) => (it.q + ' ' + it.a).toLowerCase().includes(q)) }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, query]);

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Screen>
      <AppHeader title="Help Center" subtitle="Answers & how-tos" back />

      <FadeSlide>
        <View style={{ borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadow.md }}>
          <LinearGradient
            colors={[accent, shade(accent, -0.35)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: Spacing.xl, gap: Spacing.sm }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: hexToRgba('#FFFFFF', 0.2),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={24} color="#FFFFFF" />
            </View>
            <Text variant="title" color="#FFFFFF">How can we help?</Text>
            <Text variant="body" color={hexToRgba('#FFFFFF', 0.9)}>
              Everything you need to run your business with Trackr — short, friendly answers with step-by-step directions.
            </Text>
          </LinearGradient>
        </View>
      </FadeSlide>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search questions…"
        prefix="🔍"
        style={{ marginBottom: Spacing.lg }}
        right={
          query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.textMuted} />
            </Pressable>
          ) : undefined
        }
      />

      {filtered.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl }}>
          <Ionicons name="search" size={28} color={t.textMuted} />
          <Text variant="subtitle">No matches</Text>
          <Text variant="caption" color={t.textSecondary} style={{ textAlign: 'center' }}>
            Try a different word, or clear the search to browse all topics.
          </Text>
        </Card>
      ) : (
        filtered.map((cat, ci) => (
          <FadeSlide key={cat.key} delay={Math.min(ci * 50, 300)} style={{ marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: Radius.sm,
                  backgroundColor: hexToRgba(accent, 0.14),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={cat.icon} size={16} color={accent} />
              </View>
              <Text variant="label" color={t.textSecondary}>
                {cat.title.toUpperCase()}
              </Text>
            </View>
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg }}>
              {cat.items.map((it, idx) => {
                const key = `${cat.key}-${idx}`;
                return (
                  <View key={key}>
                    <AccordionItem
                      question={it.q}
                      answer={it.a}
                      open={searching || openKeys.has(key)}
                      onToggle={() => toggle(key)}
                      accent={accent}
                    />
                    {idx < cat.items.length - 1 ? <View style={{ height: 1, backgroundColor: t.border }} /> : null}
                  </View>
                );
              })}
            </Card>
          </FadeSlide>
        ))
      )}

      <Card style={{ gap: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Ionicons name="heart" size={18} color={accent} />
          <Text variant="subtitle">Still stuck?</Text>
        </View>
        <Text variant="body" color={t.textSecondary}>
          Your data lives safely on this device. Before troubleshooting, export a backup from Settings → Data. Then a
          quick restart of Trackr fixes most hiccups.
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
          hitSlop={8}
        >
          <Text variant="label" color={accent}>Open Settings</Text>
          <Ionicons name="arrow-forward" size={14} color={accent} />
        </Pressable>
      </Card>
    </Screen>
  );
}

function AccordionItem({
  question,
  answer,
  open,
  onToggle,
  accent,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
  accent: string;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    const duration = reduced ? Duration.instant : Duration.base;
    progress.value = withTiming(open ? 1 : 0, { duration, easing: Ease.standard });
  }, [open, reduced, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: height * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  const onMeasure = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  };

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text variant="body" weight="semibold" style={{ flex: 1 }}>
          {question}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={18} color={open ? accent : t.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[{ overflow: 'hidden' }, bodyStyle]}>
        <View style={{ position: 'absolute', left: 0, right: 0, paddingBottom: Spacing.md }} onLayout={onMeasure}>
          <Text variant="body" color={t.textSecondary} style={{ lineHeight: 21 }}>
            {answer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
