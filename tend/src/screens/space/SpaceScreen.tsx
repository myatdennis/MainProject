import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { Card, PressableCard } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { SpaceInbox } from '@/components/SpaceInbox';
import { JournalScreen } from './JournalScreen';
import { BrainDumpScreen } from './BrainDumpScreen';
import { getUnsortedCount, getTodaySessionId } from '@/lib/braindump';
import { colors, spacing, radius } from '@/theme';
import type { CaptureItem } from '@/types';

type SpaceSection = 'inbox' | 'journal' | 'braindump' | 'mindspace' | 'voice';

const SECTIONS: { key: SpaceSection; label: string; symbol: string; description: string }[] = [
  { key: 'inbox', label: 'Inbox', symbol: '📥', description: 'All quick captures' },
  { key: 'journal', label: 'Journal', symbol: '📓', description: "Today's entry" },
  { key: 'braindump', label: 'Brain Dump', symbol: '🧠', description: 'Dump → prioritize → plan' },
  { key: 'mindspace', label: 'Mind Space', symbol: '💭', description: 'Freeform notes + ideas' },
  { key: 'voice', label: 'Voice Memos', symbol: '🎙', description: 'Recordings + transcripts' },
];

export function SpaceScreen() {
  const [activeSection, setActiveSection] = useState<SpaceSection | null>(null);
  const [inboxItems] = useState<CaptureItem[]>([]);
  const unsortedCount = getUnsortedCount(getTodaySessionId());

  if (activeSection === 'inbox') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => setActiveSection(null)} accessibilityLabel="Back" accessibilityRole="button">
            <TText variant="body" color="accent">← Space</TText>
          </Pressable>
          <TText variant="heading">Inbox</TText>
        </View>
        <SpaceInbox items={inboxItems} />
      </SafeAreaView>
    );
  }

  if (activeSection === 'journal') {
    return <JournalScreen />;
  }

  if (activeSection === 'braindump') {
    return <BrainDumpScreen />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TText variant="title">Space</TText>
          <TText variant="caption" color="secondary">Your thinking place</TText>
        </View>

        <View style={styles.grid}>
          {SECTIONS.map((section) => {
            const badge = section.key === 'braindump' && unsortedCount > 0 ? unsortedCount : null;
            return (
              <PressableCard
                key={section.key}
                style={styles.sectionCard}
                onPress={() => setActiveSection(section.key)}
                accessibilityLabel={section.label}
                accessibilityRole="button"
              >
                <View style={styles.cardRow}>
                  <TText style={styles.sectionEmoji}>{section.symbol}</TText>
                  {badge !== null && (
                    <View style={styles.badge}>
                      <TText style={styles.badgeText}>{badge}</TText>
                    </View>
                  )}
                </View>
                <TText variant="medium">{section.label}</TText>
                <TText variant="caption" color="secondary">{section.description}</TText>
              </PressableCard>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing[4],
    paddingBottom: 120,
    gap: spacing[6],
  },
  header: {
    gap: spacing[1],
    paddingTop: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  grid: {
    gap: spacing[3],
  },
  sectionCard: {
    padding: spacing[4],
    gap: spacing[2],
  },
  sectionEmoji: {
    fontSize: 28,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
