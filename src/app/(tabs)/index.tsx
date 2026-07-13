import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { DashboardRenderer } from '@/components/dashboard/renderer';
import { GettingStarted } from '@/components/dashboard/getting-started';
import { MovableFab } from '@/components/nav';
import { Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { useQuickActionCandidates } from '@/hooks/use-fab-actions';
import { EMPTY_DASHBOARD, loadDashboard } from '@/lib/dashboard-data';
import { RANGE_OPTIONS, type RangeKey } from '@/lib/date';

export default function Dashboard() {
  const { settings, industry } = useApp();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('month');
  const { actions: fabActions, defaultKeys } = useQuickActionCandidates();

  const { data, reload } = useAsyncData(
    () => loadDashboard(range, settings?.profit_allocation),
    [range, settings?.profit_allocation],
  );

  const dash = data ?? EMPTY_DASHBOARD;

  // Full labels fit as equal columns on wider screens; on phones the control
  // scrolls horizontally so every option (incl. "All time") stays reachable.
  const scrollRange = width < 480;

  return (
    <>
      <Screen scroll>
        <View style={{ marginBottom: Spacing.lg }}>
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} scroll={scrollRange} />
        </View>
        <GettingStarted />
        <DashboardRenderer widgets={industry.widgets} data={dash} range={range} setRange={setRange} reload={reload} />
      </Screen>
      <MovableFab actions={fabActions} defaultKeys={defaultKeys} storageKey="dashboard" />
    </>
  );
}
