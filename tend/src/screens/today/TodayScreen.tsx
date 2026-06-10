import React, { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import { RecoveryRing } from '@/components/RecoveryRing';
import { BaselineBanner } from '@/components/health/BaselineBanner';
import { PriorityItem } from '@/components/today/PriorityItem';
import { RolloverSection } from '@/components/today/RolloverSection';
import { WorkoutCard, getWorkoutForToday } from '@/components/today/WorkoutCard';
import { DailyBrief } from '@/components/today/DailyBrief';
import { useHealth } from '@/hooks/useHealth';
import { useTodayPriorities } from '@/hooks/useTodayPriorities';
import { useTasks } from '@/hooks/useTasks';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getRecoveryZone, getRecoveryMessage } from '@/types';
import { colors, spacing } from '@/theme';

export function TodayScreen() {
  const { today, baseline, isLoading } = useHealth();
  const {
    priorities,
    rolloverItems,
    rolloverExpanded,
    showWelcomeBack,
    hasAnyText,
    update,
    complete,
    promoteRollover,
    dismissRollover,
    toggleRolloverExpanded,
  } = useTodayPriorities();
  const { openTaskCount, upcomingTasks } = useTasks();
  const { displayName } = useUserProfile();
  const [briefExpanded, setBriefExpanded] = useState(false);

  // Refs for keyboard focus chaining between priority inputs
  const inputRef0 = useRef<TextInput>(null);
  const inputRef1 = useRef<TextInput>(null);
  const inputRef2 = useRef<TextInput>(null);
  const inputRefs = [inputRef0, inputRef1, inputRef2];

  const recoveryScore = today?.recoveryScore ?? 0;
  const zone = getRecoveryZone(recoveryScore);
  const stressInferred = today?.stressInferred ?? false;
  const displayScore = today ? recoveryScore : 0;

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const greeting = buildGreeting(displayName);

  // Coach message: welcome-back trumps stress/recovery
  const coachMessage = showWelcomeBack
    ? null  // shown separately
    : stressInferred
    ? "Your nervous system is working hard today. Keep demands light."
    : getRecoveryMessage(zone);

  const workout = getWorkoutForToday();
  const isYogaDay = workout.isYoga;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Greeting ───────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <TText variant="title">{greeting}</TText>
          <TText variant="caption" color="secondary">{dateLabel}</TText>
        </Animated.View>

        {/* ── Welcome back (after 3+ day gap) ───────────────────── */}
        {showWelcomeBack && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <View style={styles.welcomeBack}>
              <TText variant="medium" style={styles.welcomeText}>
                Welcome back. Today is a fresh page.
              </TText>
            </View>
          </Animated.View>
        )}

        {/* ── Baseline building notice ───────────────────────────── */}
        {!baseline.isReliable && baseline.daysOfData > 0 && (
          <BaselineBanner daysOfData={baseline.daysOfData} />
        )}

        {/* ── Recovery Ring ──────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          style={styles.ringSection}
        >
          {isLoading && !today ? (
            <View style={styles.ringPlaceholder}>
              <ActivityIndicator color={colors.accent} size="large" />
              <TText variant="caption" color="secondary" style={{ marginTop: spacing[3] }}>
                Reading health data…
              </TText>
            </View>
          ) : (
            <RecoveryRing score={displayScore} size={180} showScore showMessage={false} />
          )}

          {coachMessage && (
            <TText variant="body" style={styles.coachMessage}>
              {coachMessage}
            </TText>
          )}

          {stressInferred && !showWelcomeBack && (
            <View style={styles.stressPill}>
              <TText variant="small" style={styles.stressPillText}>
                Stress signal detected
              </TText>
            </View>
          )}
        </Animated.View>

        {/* ── Top 3 Priorities ───────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.section}
        >
          <TText style={styles.sectionLabel}>Top 3</TText>

          {!hasAnyText && (
            <Pressable
              onPress={() => inputRefs[0].current?.focus()}
              accessibilityLabel="Tap to add your first priority"
            >
              <TText variant="body" color="secondary" style={styles.emptyPrompt}>
                {showWelcomeBack
                  ? 'One thing is enough. What's your one thing?'
                  : 'What's one thing that would make today feel complete?'}
              </TText>
            </Pressable>
          )}

          <View style={styles.priorityList}>
            {priorities.map((p, i) => (
              <PriorityItem
                key={p.id}
                number={i + 1}
                priority={p}
                onComplete={() => complete(p.id)}
                onChangeText={(text) => update(p.id, text)}
                inputRef={inputRefs[i]}
                nextRef={i < 2 ? inputRefs[i + 1] : undefined}
              />
            ))}
          </View>

          {/* Rollover section (yesterday's uncompleted items) */}
          <RolloverSection
            items={rolloverItems}
            expanded={rolloverExpanded}
            onToggle={toggleRolloverExpanded}
            onPromote={promoteRollover}
            onDismiss={dismissRollover}
          />
        </Animated.View>

        <Divider />

        {/* ── Today's Workout ────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(250)}
          style={styles.section}
        >
          <TText style={styles.sectionLabel}>
            {workout.isYoga ? "Today's Practice" : "Today's Workout"}
          </TText>
          <WorkoutCard recoveryScore={recoveryScore} />
        </Animated.View>

        <Divider />

        {/* ── Daily Brief ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Pressable
            onPress={() => setBriefExpanded((e) => !e)}
            style={styles.briefHeader}
            accessibilityLabel={briefExpanded ? 'Collapse daily brief' : 'Expand daily brief'}
            accessibilityRole="button"
            accessibilityState={{ expanded: briefExpanded }}
          >
            <TText variant="heading">Daily Brief</TText>
            <View style={styles.briefMeta}>
              {openTaskCount > 0 && !briefExpanded && (
                <View style={styles.taskCountPill}>
                  <TText variant="small" style={styles.taskCountText}>
                    {openTaskCount}
                  </TText>
                </View>
              )}
              <TText variant="body" color="secondary">
                {briefExpanded ? '▾' : '▸'}
              </TText>
            </View>
          </Pressable>

          {briefExpanded && (
            <DailyBrief
              openTaskCount={openTaskCount}
              upcomingTasks={upcomingTasks}
              recoveryScore={recoveryScore}
              yogaScheduledToday={isYogaDay}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGreeting(name: string | null): string {
  const h = new Date().getHours();
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${time}, ${name.split(' ')[0]}` : time;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  welcomeBack: {
    backgroundColor: `${colors.accent}10`,
    borderRadius: 12,
    padding: spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  welcomeText: {
    color: colors.accent,
    lineHeight: 22,
  },
  ringSection: {
    alignItems: 'center',
    gap: spacing[3],
  },
  ringPlaceholder: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachMessage: {
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 260,
    lineHeight: 22,
  },
  stressPill: {
    backgroundColor: `${colors.warning}18`,
    borderRadius: 20,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
  },
  stressPillText: {
    color: colors.warning,
  },
  section: {
    gap: spacing[3],
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyPrompt: {
    fontStyle: 'italic',
    lineHeight: 22,
    paddingVertical: spacing[1],
  },
  priorityList: {
    gap: 0,
  },
  briefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  briefMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  taskCountPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  taskCountText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
