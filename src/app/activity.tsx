import { View } from 'react-native';

import { HelpTip } from '@/components/help';
import { useConfirm } from '@/components/confirm';
import {
  AppHeader,
  CardList,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Text,
  type IconName,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { AuditEntry } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { clearAuditLog, listAuditEntries } from '@/lib/audit';
import { dayjs, formatTime, fromNow } from '@/lib/date';
import { pressFeedback } from '@/lib/haptics';

/** How many recent entries to load — plenty for a scannable history without hurting perf. */
const MAX_ENTRIES = 200;

type Tone = 'success' | 'primary' | 'danger';

const ACTION_META: Record<AuditEntry['action'], { icon: IconName; tone: Tone; verb: string }> = {
  create: { icon: 'add-circle', tone: 'success', verb: 'Created' },
  update: { icon: 'create-outline', tone: 'primary', verb: 'Updated' },
  delete: { icon: 'trash', tone: 'danger', verb: 'Deleted' },
};

interface DayGroup {
  key: string;
  label: string;
  items: AuditEntry[];
}

/** Human day heading: Today / Yesterday / a full date. */
function dayLabel(iso: string): string {
  const day = dayjs(iso).startOf('day');
  const diff = day.diff(dayjs().startOf('day'), 'day');
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return dayjs(iso).format('DD MMM YYYY');
}

/** Group already-sorted (newest first) entries into contiguous day buckets. */
function groupByDay(entries: AuditEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const entry of entries) {
    const key = dayjs(entry.created_at).format('YYYY-MM-DD');
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(entry.created_at), items: [] };
      groups.push(current);
    }
    current.items.push(entry);
  }
  return groups;
}

export default function ActivityScreen() {
  const t = useTheme();
  const confirm = useConfirm();

  const { data, loading, reload, setData } = useAsyncData(() => listAuditEntries(MAX_ENTRIES), []);

  const entries = data ?? [];
  const hasEntries = entries.length > 0;
  const groups = groupByDay(entries);

  const onClear = async () => {
    pressFeedback();
    const choice = await confirm({
      title: 'Clear activity log?',
      message: 'This permanently removes every recorded change. Your sales, expenses and other data are not affected.',
      actions: [
        { label: 'Clear log', style: 'destructive', value: 'clear' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'clear') return;
    await clearAuditLog();
    setData([]);
    reload();
  };

  return (
    <Screen>
      <AppHeader
        title="Activity log"
        subtitle="Recent changes across your business"
        back
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <HelpTip
              title="Activity log"
              subtitle="A history of changes"
              paragraphs={[
                'Every time you add, edit or delete something — a sale, expense, customer, order, product and more — it is recorded here so you can see what changed and when.',
              ]}
              points={[
                { term: 'Created', desc: 'A new record was added.' },
                { term: 'Updated', desc: 'An existing record was changed.' },
                { term: 'Deleted', desc: 'A record was removed.' },
              ]}
              tip="Only the most recent changes are kept. Clearing the log does not affect any of your actual data."
            />
            {hasEntries ? <IconButton icon="trash-outline" tone="danger" onPress={onClear} /> : null}
          </View>
        }
      />

      {hasEntries ? (
        <>
          {groups.map((group) => (
            <View key={group.key} style={{ marginBottom: Spacing.lg }}>
              <SectionHeader title={group.label} subtitle={`${group.items.length} ${group.items.length === 1 ? 'change' : 'changes'}`} />
              <CardList
                data={group.items}
                keyExtractor={(entry) => entry.id}
                renderItem={(entry) => {
                  const meta = ACTION_META[entry.action] ?? ACTION_META.update;
                  return (
                    <ListRow
                      icon={meta.icon}
                      iconTone={meta.tone}
                      title={entry.summary}
                      subtitle={`${formatTime(entry.created_at)} · ${fromNow(entry.created_at)}`}
                    />
                  );
                }}
              />
            </View>
          ))}

          <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center', marginTop: Spacing.sm }}>
            Showing the {Math.min(entries.length, MAX_ENTRIES)} most recent changes.
          </Text>
        </>
      ) : loading ? null : (
        <EmptyState
          icon="time-outline"
          title="No activity yet"
          message="As you record sales, add customers, update products and make other changes, they'll appear here as a running history."
        />
      )}
    </Screen>
  );
}
