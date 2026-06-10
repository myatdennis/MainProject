import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';

interface BaselineBannerProps {
  daysOfData: number;
}

export function BaselineBanner({ daysOfData }: BaselineBannerProps) {
  if (daysOfData >= 14) return null;

  const remaining = 14 - daysOfData;

  return (
    <View style={styles.banner}>
      <TText variant="caption" style={styles.text}>
        Building your baseline — scores improve after {remaining} more day
        {remaining !== 1 ? 's' : ''} of wear.
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: `${colors.accent}12`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
    padding: spacing[3],
  },
  text: {
    color: colors.accent,
    lineHeight: 18,
  },
});
