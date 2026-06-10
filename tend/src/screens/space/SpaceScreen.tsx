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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TText variant="title">Space</TText>
          <TText variant="caption" color="secondary">Your thinking place</TText>
        </View>

        <View style={styles.grid}>
          {SECTIONS.map((section) => (
            <PressableCard
              key={section.key}
              style={styles.sectionCard}
              onPress={() => setActiveSection(section.key)}
              accessibilityLabel={section.label}
              accessibilityRole="button"
            >
              <TText style={styles.sectionEmoji}>{section.symbol}</TText>
              <TText variant="medium">{section.label}</TText>
              <TText variant="caption" color="secondary">{section.description}</TText>
            </PressableCard>
          ))}
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
});
