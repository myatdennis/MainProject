import React from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { PressableCard } from '@/components/ui/Card';
import { colors, spacing } from '@/theme';

const SECTIONS = [
  {
    key: 'training',
    label: 'Training',
    symbol: '🏋️',
    description: 'Strength plans + workout logger',
  },
  {
    key: 'yoga',
    label: 'Yoga',
    symbol: '🧘',
    description: 'Recovery-matched sessions',
  },
  {
    key: 'goals',
    label: 'Goals',
    symbol: '🎯',
    description: 'Long-term goals + milestones',
  },
  {
    key: 'tasks',
    label: 'Tasks',
    symbol: '✓',
    description: 'Everything on your plate',
  },
  {
    key: 'nutrition',
    label: 'Nutrition',
    symbol: '🥗',
    description: 'Protein-first tracking',
  },
  {
    key: 'founder',
    label: 'Founder HQ',
    symbol: '⚡',
    description: 'Projects, clients, weekly review',
  },
];

export function BuildScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TText variant="title">Build</TText>
          <TText variant="caption" color="secondary">Goals, training, execution</TText>
        </View>

        <View style={styles.grid}>
          {SECTIONS.map((section) => (
            <PressableCard
              key={section.key}
              style={styles.card}
              onPress={() => {}}
              accessibilityLabel={section.label}
              accessibilityRole="button"
            >
              <TText style={styles.emoji}>{section.symbol}</TText>
              <View style={styles.cardText}>
                <TText variant="medium">{section.label}</TText>
                <TText variant="caption" color="secondary">{section.description}</TText>
              </View>
              <TText variant="caption" color="secondary">▸</TText>
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
  },
  grid: {
    gap: spacing[2],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  emoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});
