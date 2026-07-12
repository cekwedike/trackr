import { useState } from 'react';

import { DashboardRenderer } from '@/components/dashboard/renderer';
import { MovableFab } from '@/components/nav';
import { Screen } from '@/components/ui';
import { useApp } from '@/context/app-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { useFabActions } from '@/hooks/use-fab-actions';
import { EMPTY_DASHBOARD, loadDashboard } from '@/lib/dashboard-data';
import type { RangeKey } from '@/lib/date';

export default function Dashboard() {
  const { settings, industry } = useApp();
  const [range, setRange] = useState<RangeKey>('month');
  const fabActions = useFabActions();

  const { data } = useAsyncData(
    () => loadDashboard(range, settings?.profit_allocation),
    [range, settings?.profit_allocation],
  );

  const dash = data ?? EMPTY_DASHBOARD;

  return (
    <>
      <Screen scroll>
        <DashboardRenderer widgets={industry.widgets} data={dash} range={range} setRange={setRange} />
      </Screen>
      <MovableFab actions={fabActions} storageKey="dashboard" />
    </>
  );
}
