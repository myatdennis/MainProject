import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { PressableCard } from '@/components/ui/Card';
import { GoalsScreen } from './GoalsScreen';
import { TasksScreen } from './TasksScreen';
import { HabitsScreen } from './HabitsScreen';
import { NutritionScreen } from './NutritionScreen';
import { WorkoutSessionScreen } from '@/screens/training/WorkoutSessionScreen';
import { useTasks } from '@/hooks/useTasks';
import { loadGoals, getGoalProgress } from '@/lib/goals';
import { getActiveHabitsForDate, isCompleted } from '@/lib/habits';
import { colors, spacing } from '@/theme';

type BuildSection = 'goals' | 'tasks' | 'habits' | 'nutrition' | 'training' | 'founder';

export function BuildScreen() {
  const [section, setSection] = useState<BuildSection | null>(null);
  const [workoutVisible, setWorkoutVisible] = useState(false);
  const { openTaskCount } = useTasks();

  const today = new Date().toISOString().slice(0, 10);
  const activeGoals = loadGoals().filter(g => !g.archived && !g.completedAt);
  const todayHabits = getActiveHabitsForDate(today);
  const doneHabits = todayHabits.filter(h => isCompleted(h.id, today));

  if (section === 'goals') return <GoalsScreen />;
  if (section === 'tasks') return <TasksScreen />;
  if (section === 'habits') return <HabitsScreen />;
  if (section === 'nutrition') return <NutritionScreen />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={styles.header}>
            <TText variant="title">Build</TText>
            <TText variant="caption" color="secondary">Goals, training, execution</TText>
          </View>
        </Animated.View>

        <View style={styles.grid}>
          {/* Training — direct launch */}
          <PressableCard style={styles.card} onPress={() => setWorkoutVisible(true)} accessibilityRole="button">
            <TText style={styles.emoji}>🏋️</TText>
            <View style={styles.cardText}>
              <TText variant="medium">Training</TText>
              <TText variant="caption" color="secondary">Start today's workout</TText>
            </View>
            <TText variant="caption" color="secondary">▸</TText>
          </PressableCard>

          {/* Goals */}
          <PressableCard style={styles.card} onPress={() => setSection('goals')} accessibilityRole="button">
            <TText style={styles.emoji}>🎯</TText>
            <View style={styles.cardText}>
              <TText variant="medium">Goals</TText>
              <TText variant="caption" color="secondary">
                {activeGoals.length > 0 ? `${activeGoals.length} active` : 'What are you building?'}
              </TText>
            </View>
            <TText variant="caption" color="secondary">▸</TText>
          </PressableCard>

          {/* Tasks */}
          <PressableCard style={styles.card} onPress={() => setSection('tasks')} accessibilityRole="button">
            <TText style={styles.emoji}>✓</TText>
            <View style={styles.cardText}>
              <TText variant="medium">Tasks</TText>
              <TText variant="caption" color="secondary">
                {openTaskCount > 0 ? `${openTaskCount} open today` : 'All clear'}
              </TText>
            </View>
            {openTaskCount > 0 && (
              <View style={styles.badge}>
                <TText style={styles.badgeText}>{openTaskCount}</TText>
              </View>
            )}
          </PressableCard>

          {/* Habits */}
          <PressableCard style={styles.card} onPress={() => setSection('habits')} accessibilityRole="button">
            <TText style={styles.emoji}>🌱</TText>
            <View style={styles.cardText}>
              <TText variant="medium">Habits</TText>
              <TText variant="caption" color="secondary">
                {todayHabits.length > 0 ? `${doneHabits.length}/${todayHabits.length} today` : 'Build your practice'}
              </TText>
            </View>
            <TText variant="caption" color="secondary">▸</TText>
          </PressableCard>

          {/* Nutrition */}
          <PressableCard style={styles.card} onPress={() => setSection('nutrition')} accessibilityRole="button">
            <TText style={styles.emoji}>🥗</TText>
            <View style={styles.cardText}>
              <TText variant="medium">Nutrition</TText>
              <TText variant="caption" color="secondary">Protein-first tracking</TText>
            </View>
            <TText variant="caption" color="secondary">▸</TText>
          </PressableCard>

          {/* Founder HQ — stub for Sprint 8+ */}
          <PressableCard style={styles.card} onPress={() => {}} accessibilityRole="button">
            <TText style={styles.emoji}>⚡</TText>
            <View style={styles.cardText}>
              <TText variant="medium">Founder HQ</TText>
              <TText variant="caption" color="secondary">Projects, clients, weekly review</TText>
            </View>
            <TText variant="caption" color="secondary">▸</TText>
          </PressableCard>
        </View>
      </ScrollView>

      <WorkoutSessionScreen
        visible={workoutVisible}
        recoveryScore={0}
        onClose={() => setWorkoutVisible(false)}
        onComplete={() => setWorkoutVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[4], paddingBottom: 120, gap: spacing[6] },
  header: { gap: spacing[1], paddingTop: spacing[2] },
  grid: { gap: spacing[2] },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  emoji: { fontSize: 24, width: 36, textAlign: 'center' },
  cardText: { flex: 1, gap: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
