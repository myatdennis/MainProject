import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import { HandwritingCanvas } from './HandwritingCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { MoodSelector } from './MoodSelector';
import { AnchorQuestion } from './AnchorQuestion';
import { useJournalEntry } from '@/hooks/useJournalEntry';
import { useRecovery } from '@/hooks/useHealth';
import { getAnchorQuestion } from '@/lib/anchorQuestions';
import { PenConfig, PEN_DEFAULTS } from '@/lib/handwriting';
import type { Stroke } from '@/lib/handwriting';

interface JournalEntryProps {
  date: string;
}

const DEFAULT_PEN: PenConfig = {
  tool: 'ballpoint',
  color: '#1A1A1A',
  ...PEN_DEFAULTS.ballpoint,
};

export function JournalEntryView({ date }: JournalEntryProps) {
  const { width } = useWindowDimensions();
  const [penConfig, setPenConfig] = useState<PenConfig>(DEFAULT_PEN);
  const { score } = useRecovery();

  const { entry, addStroke, undoLastStroke, clearStrokes, setMood } = useJournalEntry(date);

  const question = getAnchorQuestion(new Date(date + 'T12:00:00'), score);

  const canvasWidth = Math.min(width - spacing[4] * 2, 680); // iPad max
  const canvasHeight = canvasWidth * 1.3; // roughly A5 ratio

  const handleStrokeComplete = useCallback((stroke: Stroke) => {
    addStroke(stroke);
  }, [addStroke]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date label */}
        <TText variant="caption" color="secondary" style={styles.dateLabel}>
          {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </TText>

        {/* Mood selector */}
        <MoodSelector value={entry.mood} onChange={setMood} />

        {/* Anchor question */}
        <AnchorQuestion question={question} />

        {/* Canvas */}
        <View style={[styles.page, { width: canvasWidth }]}>
          <HandwritingCanvas
            strokes={entry.strokes}
            penConfig={penConfig}
            width={canvasWidth}
            height={canvasHeight}
            onStrokeComplete={handleStrokeComplete}
          />
        </View>

        {entry.textContent ? (
          <View style={styles.ocrPreview}>
            <TText variant="caption" color="secondary" style={styles.ocrLabel}>
              Recognised text
            </TText>
            <TText variant="body" color="secondary" style={styles.ocrText}>
              {entry.textContent}
            </TText>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating toolbar */}
      <FloatingToolbar
        penConfig={penConfig}
        onPenChange={setPenConfig}
        onUndo={undoLastStroke}
        onClear={clearStrokes}
        canUndo={entry.strokes.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[4],
  },
  dateLabel: {
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
  },
  page: {
    backgroundColor: '#FEFDF9',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  ocrPreview: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: spacing[3],
    gap: spacing[1],
  },
  ocrLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 10,
  },
  ocrText: {
    lineHeight: 22,
  },
});
