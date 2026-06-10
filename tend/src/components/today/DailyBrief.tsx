import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import { colors, spacing } from '@/theme';
import type { StoredTask } from '@/lib/tasks';

interface DailyBriefProps {
  openTaskCount: number;
  upcomingTasks: StoredTask[];
  recoveryScore: number;
  yogaScheduledToday: boolean;
}

export function DailyBrief({
  openTaskCount,
  upcomingTasks,
  recoveryScore,
  yogaScheduledToday,
}: DailyBriefProps) {
  const yogaSuggestion = getYogaSuggestion(recoveryScore, yogaScheduledToday);

  return (
    <View style={styles.container}>
      {/* Open tasks */}
      <BriefSection>
        {openTaskCount === 0 ? (
          <TText variant="body" color="secondary">No open tasks. A clean slate.</TText>
        ) : (
          <TText variant="body" color="secondary">
            {openTaskCount} task{openTaskCount !== 1 ? 's' : ''} in your list today.
          </TText>
        )}
      </BriefSection>

      {/* Upcoming deadlines */}
      {upcomingTasks.length > 0 && (
        <>
          <Divider />
          <BriefSection label="Coming up">
            {upcomingTasks.slice(0, 3).map((task) => (
              <View key={task.id} style={styles.upcomingRow}>
                <TText variant="body" style={styles.upcomingTitle} numberOfLines={1}>
                  {task.title}
                </TText>
                <TText variant="mono" color="secondary" style={styles.upcomingDate}>
                  {formatRelativeDate(task.dueDate!)}
                </TText>
              </View>
            ))}
          </BriefSection>
        </>
      )}

      {/* Yoga suggestion */}
      <Divider />
      <BriefSection label="Yoga">
        <TText variant="body" color="secondary">{yogaSuggestion}</TText>
      </BriefSection>
    </View>
  );
}

function BriefSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      {label && (
        <TText variant="caption" style={sectionStyles.label}>{label}</TText>
      )}
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

function getYogaSuggestion(score: number, isYogaDay: boolean): string {
  if (!isYogaDay) {
    if (score < 34) return 'Even 10 minutes of gentle stretching helps recovery.';
    if (score < 67) return 'A short mobility session would support today\'s training.';
    return 'Optional — any movement you enjoy.';
  }
  // It's a scheduled yoga day
  if (score < 34) return 'Back care or gentle flow today — let your body settle.';
  if (score < 67) return 'Flow yoga, 20–30 min. Keep it smooth.';
  return 'Any style works. You\'re ready to move.';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === 2) return 'In 2 days';
  if (diffDays === 3) return 'In 3 days';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: spacing[4],
    gap: 0,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: 32,
  },
  upcomingTitle: {
    flex: 1,
    color: colors.textPrimary,
  },
  upcomingDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
