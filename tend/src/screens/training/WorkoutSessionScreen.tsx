import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { ExerciseBlock } from '@/components/training/ExerciseBlock';
import { RestTimer } from '@/components/training/RestTimer';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { colors, spacing } from '@/theme';

interface WorkoutSessionScreenProps {
  visible: boolean;
  recoveryScore: number;
  onClose: () => void;
  onComplete: () => void;
}

export function WorkoutSessionScreen({
  visible,
  recoveryScore,
  onClose,
  onComplete,
}: WorkoutSessionScreenProps) {
  const workout = useActiveWorkout(recoveryScore);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (workout.isStarted && visible) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [workout.isStarted, visible]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleFinish = async () => {
    Alert.alert('Finish workout?', 'Any incomplete sets will be skipped.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          await workout.finishWorkout();
          if (timerRef.current) clearInterval(timerRef.current);
          onComplete();
        },
      },
    ]);
  };

  const handleClose = () => {
    if (workout.isStarted) {
      Alert.alert('Leave workout?', 'Progress will be lost.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <TText variant="body" color="secondary">✕</TText>
          </Pressable>
          <View style={styles.headerCenter}>
            <TText variant="medium">{workout.exercises[0] ? "Today's Workout" : 'Rest Day'}</TText>
            {workout.isStarted && (
              <TText variant="caption" style={styles.timer}>{formatTime(elapsed)}</TText>
            )}
          </View>
          {workout.isStarted && (
            <Pressable onPress={handleFinish} style={styles.finishBtn}>
              <TText variant="small" style={styles.finishText}>Done</TText>
            </Pressable>
          )}
        </Animated.View>

        {/* Progress bar */}
        {workout.isStarted && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${workout.progress * 100}%` }]} />
          </View>
        )}

        {/* Rest timer */}
        {workout.restTimerActive && (
          <View style={styles.restTimerWrapper}>
            <RestTimer
              seconds={workout.restSecondsLeft}
              totalSeconds={90}
              onSkip={workout.skipRest}
            />
          </View>
        )}

        {/* Content */}
        {!workout.isStarted ? (
          <StartScreen
            exerciseCount={workout.exercises.length}
            workoutName={workout.exercises.length > 0 ? 'Today\'s Workout' : 'No workout today'}
            onStart={workout.startWorkout}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {workout.exercises.map((ex, i) => (
              <Animated.View key={ex.id} entering={FadeInDown.duration(400).delay(i * 50)}>
                <ExerciseBlock
                  exercise={ex}
                  log={workout.session!.exercises[i]}
                  isActive={i === workout.currentExerciseIndex}
                  onUpdateSet={(si, u) => workout.updateSet(i, si, u)}
                  onCompleteSet={si => workout.completeSet(i, si, ex.defaultRest)}
                  onAddSet={() => workout.addSet(i)}
                  onPress={() => workout.setCurrentExerciseIndex(i)}
                />
              </Animated.View>
            ))}
            <View style={{ height: 80 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function StartScreen({ exerciseCount, workoutName, onStart }: {
  exerciseCount: number;
  workoutName: string;
  onStart: () => void;
}) {
  return (
    <View style={styles.startScreen}>
      <TText variant="title" style={styles.startTitle}>{workoutName}</TText>
      <TText variant="body" color="secondary">
        {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} · Est. 45–50 min
      </TText>
      <Pressable onPress={onStart} style={styles.startBtn} accessibilityLabel="Start workout">
        <TText variant="medium" style={styles.startBtnText}>Start Workout</TText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  timer: {
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
  },
  finishBtn: {
    width: 52,
    height: 36,
    backgroundColor: colors.success,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishText: {
    color: '#fff',
    fontWeight: '700',
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  restTimerWrapper: {
    margin: spacing[4],
    marginBottom: 0,
  },
  scroll: {
    padding: spacing[4],
    gap: spacing[3],
  },
  startScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    padding: spacing[6],
  },
  startTitle: {
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  },
  startBtnText: {
    color: '#fff',
  },
});
