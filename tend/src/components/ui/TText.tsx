import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { colors, fontSizes, fontWeights } from '@/theme';

type Variant =
  | 'display'    // Section headers, scores
  | 'title'      // Screen titles
  | 'heading'    // Card headings
  | 'body'       // Default body text
  | 'medium'     // Emphasis in body
  | 'caption'    // Labels, metadata
  | 'mono'       // Metrics, numbers
  | 'small';     // Fine print

type Color = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'white';

interface TTextProps extends TextProps {
  variant?: Variant;
  color?: Color;
}

export function TText({ variant = 'body', color = 'primary', style, ...props }: TTextProps) {
  return (
    <Text
      style={[styles.base, variantStyles[variant], colorStyles[color], style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.textPrimary,
  },
});

const variantStyles = StyleSheet.create({
  display: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
    lineHeight: fontSizes['3xl'] * 1.2,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.3,
    lineHeight: fontSizes['2xl'] * 1.2,
  },
  heading: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * 1.3,
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.base * 1.5,
  },
  medium: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.base * 1.5,
  },
  caption: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * 1.4,
  },
  mono: {
    fontSize: fontSizes.sm,
    fontFamily: 'Courier',
    lineHeight: fontSizes.sm * 1.4,
  },
  small: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.xs * 1.4,
  },
});

const colorStyles = StyleSheet.create({
  primary: { color: colors.textPrimary },
  secondary: { color: colors.textSecondary },
  accent: { color: colors.accent },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  white: { color: '#FFFFFF' },
});
