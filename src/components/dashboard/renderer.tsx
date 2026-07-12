import React from 'react';

import { Entrance } from '@/components/anim';
import { ErrorBoundary } from '@/components/error-boundary';
import { WIDGET_COMPONENTS, type WidgetProps } from '@/components/dashboard/widgets';
import type { WidgetKey } from '@/constants/industries';

export function DashboardRenderer({ widgets, ...props }: { widgets: WidgetKey[] } & WidgetProps) {
  return (
    <>
      {widgets.map((key, i) => {
        const Widget = WIDGET_COMPONENTS[key];
        if (!Widget) return null;
        return (
          <Entrance key={key} delay={Math.min(i * 60, 400)}>
            <ErrorBoundary label={key}>
              <Widget {...props} />
            </ErrorBoundary>
          </Entrance>
        );
      })}
    </>
  );
}
