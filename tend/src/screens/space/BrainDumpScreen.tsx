import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import { CaptureInput } from '@/components/space/CaptureInput';
import { CardSortStack } from '@/components/space/CardSortStack';
import { SortedSummary } from '@/components/space/SortedSummary';
import { useBrainDump } from '@/hooks/useBrainDump';
import { colors, spacing } from '@/theme';

type DumpMode = 'capture' | 'sort' | 'summary';

export function BrainDumpScreen() {
  const {
    session,
    unsortedCaptures,
    sortedCaptures,
    addItem,
    actionItem,
    finishSort,
    totalCount,
    isSorted,
  } = useBrainDump();

  const [mode, setMode] = useState<DumpMode>(() => {
    if (isSorted && session.captures.length > 0) return 'summary';
    return 'capture';
  });

  const handleStartSort = () => {
    if (unsortedCaptures.length === 0) return;
    setMode('sort');
  };

  const handleFinishSort = () => {
    finishSort();
    setMode('summary');
  };

  const handleRestart = () => {
    setMode('capture');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View>
            <TText variant="title">Brain Dump</TText>
            <TText variant="caption" color="secondary">Get it all out, then sort</TText>
          </View>
          {mode === 'capture' && unsortedCaptures.length > 0 && (
            <Pressable onPress={handleStartSort} style={styles.sortBtn}>
              <TText variant="small" style={styles.sortBtnText}>
                Sort {unsortedCaptures.length} →
              </TText>
            </Pressable>
          )}
          {mode === 'sort' && (
            <Pressable onPress={handleRestart} style={styles.backBtn}>
              <TText variant="small" color="secondary">+ Add more</TText>
            </Pressable>
          )}
          {mode === 'summary' && (
            <Pressable onPress={handleRestart} style={styles.backBtn}>
              <TText variant="small" color="secondary">+ Add more</TText>
            </Pressable>
          )}
        </Animated.View>

        {mode === 'capture' && (
          <CaptureView
            captures={session.captures.map(c => c.text)}
            onAdd={addItem}
            onSort={handleStartSort}
            canSort={unsortedCaptures.length > 0}
          />
        )}

        {mode === 'sort' && (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.sortContainer}>
            <CardSortStack
              captures={unsortedCaptures}
              onAction={actionItem}
              onDone={handleFinishSort}
            />
          </Animated.View>
        )}

        {mode === 'summary' && (
          <ScrollView
            contentContainerStyle={styles.summaryScroll}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(400)}>
              <SortedSummary captures={session.captures} />
            </Animated.View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CaptureView({
  captures,
  onAdd,
  onSort,
  canSort,
}: {
  captures: string[];
  onAdd: (text: string) => void;
  onSort: () => void;
  canSort: boolean;
}) {
  return (
    <View style={styles.flex}>
      {/* Capture list */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.captureList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {captures.length === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyPrompt}>
            <TText variant="body" color="secondary" style={styles.emptyText}>
              No filter. No judgment.{'\n'}Just dump everything that's in your head.
            </TText>
          </Animated.View>
        )}

        {captures.map((text, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.duration(300)}
            layout={Layout.springify()}
            style={styles.captureItem}
          >
            <View style={styles.captureBullet} />
            <TText variant="body" style={styles.captureText}>{text}</TText>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Input + sort CTA */}
      <View style={styles.inputArea}>
        {canSort && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable onPress={onSort} style={styles.sortCta}>
              <TText variant="medium" style={styles.sortCtaText}>
                Sort {captures.length} thought{captures.length !== 1 ? 's' : ''} →
              </TText>
            </Pressable>
          </Animated.View>
        )}
        <CaptureInput onAdd={onAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sortBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 20,
  },
  sortBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  captureList: {
    padding: spacing[4],
    paddingBottom: spacing[2],
    gap: spacing[2],
    flexGrow: 1,
  },
  emptyPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[8],
    paddingHorizontal: spacing[4],
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  captureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  captureBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 8,
    flexShrink: 0,
  },
  captureText: {
    flex: 1,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  inputArea: {
    padding: spacing[4],
    paddingTop: spacing[2],
    gap: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sortCta: {
    backgroundColor: `${colors.accent}12`,
    borderRadius: 12,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
  },
  sortCtaText: {
    color: colors.accent,
  },
  sortContainer: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  summaryScroll: {
    padding: spacing[4],
    paddingBottom: 120,
  },
});
