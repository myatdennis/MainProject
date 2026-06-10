import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { TText } from './TText';
import { colors, spacing } from '@/theme';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to crash reporting in production
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <TText variant="heading" style={styles.title}>Something went wrong</TText>
          <TText variant="body" color="secondary" style={styles.body}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </TText>
          <Pressable onPress={this.reset} style={styles.btn}>
            <TText variant="medium" style={styles.btnText}>Try again</TText>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[4],
    backgroundColor: colors.background,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', lineHeight: 24 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  btnText: { color: '#fff' },
});
