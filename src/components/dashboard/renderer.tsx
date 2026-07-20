import React, { useState } from 'react';
import { View } from 'react-native';

import { Entrance, PressableScale } from '@/components/anim';
import { ErrorBoundary } from '@/components/error-boundary';
import { WIDGET_COMPONENTS, type WidgetProps } from '@/components/dashboard/widgets';
import { Text } from '@/components/ui';
import type { WidgetKey } from '@/constants/industries';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { visibleWidgets } from '@/lib/dashboard-visibility';

export function DashboardRenderer({ widgets, ...props }: { widgets: WidgetKey[] } & WidgetProps) {
  const t = useTheme();
  const [showAll, setShowAll] = useState(false);
  const { visible, hiddenCount } = visibleWidgets(widgets, props.data, showAll);
  const canCollapse = showAll && widgets.some((k) => k !== 'hero' && k !== 'quickActions');

  return (
    <>
      {visible.map((key, i) => {
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

      {hiddenCount > 0 || canCollapse ? (
        <View style={{ alignItems: 'center', marginBottom: Spacing.xl, paddingTop: Spacing.xs }}>
          <PressableScale
            onPress={() => setShowAll((v) => !v)}
            hitSlop={8}
            haptic
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={showAll ? 'Show fewer insights' : 'Show more insights'}
          >
            <Text variant="label" color={t.primary}>
              {showAll ? 'Show fewer insights' : `Show more insights${hiddenCount > 0 ? ` (${hiddenCount})` : ''}`}
            </Text>
          </PressableScale>
        </View>
      ) : null}
    </>
  );
}
