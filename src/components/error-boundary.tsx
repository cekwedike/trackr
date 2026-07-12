import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  label?: string;
}
interface State {
  hasError: boolean;
}

/** Prevents a single failing widget/screen from blanking the whole app. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('ErrorBoundary caught', this.props.label, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            padding: Spacing.lg,
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.4)',
            gap: 4,
          }}
        >
          <Text variant="label">Something went wrong</Text>
          <Text variant="caption">{this.props.label ? `Couldn't load ${this.props.label}.` : 'This section failed to load.'}</Text>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
