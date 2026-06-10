import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { AnchorQuestion as AnchorQuestionType } from '@/lib/anchorQuestions';

interface AnchorQuestionProps {
  question: AnchorQuestionType;
}

export function AnchorQuestion({ question }: AnchorQuestionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.accent} />
      <TText variant="body" style={styles.text}>{question.text}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: `${colors.accent}08`,
    borderRadius: 12,
  },
  accent: {
    width: 3,
    minHeight: 20,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginTop: 2,
  },
  text: {
    flex: 1,
    color: colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
