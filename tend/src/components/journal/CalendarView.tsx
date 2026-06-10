import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { MoodLevel } from '@/lib/journal';

interface CalendarViewProps {
  entryDates: string[];
  moodHistory: Array<{ date: string; mood: MoodLevel | null }>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const MOOD_COLORS: Record<MoodLevel, string> = {
  low: colors.danger,
  neutral: colors.warning,
  good: colors.success,
};

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarView({ entryDates, moodHistory, selectedDate, onSelectDate }: CalendarViewProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const prevMonth = () => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDow = viewDate.getDay();

  const moodMap: Record<string, MoodLevel | null> = {};
  for (const m of moodHistory) moodMap[m.date] = m.mood;

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn}>
          <TText variant="body" color="secondary">‹</TText>
        </Pressable>
        <TText variant="medium">{monthLabel}</TText>
        <Pressable
          onPress={nextMonth}
          disabled={viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear()}
          style={styles.navBtn}
        >
          <TText variant="body" color="secondary">›</TText>
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={styles.grid}>
        {DOW_LABELS.map(d => (
          <View key={d} style={styles.dayLabelCell}>
            <TText variant="small" color="secondary" style={styles.dayLabel}>{d}</TText>
          </View>
        ))}

        {/* Day cells */}
        {cells.map((cell, i) => {
          if (!cell.dateStr || !cell.day) {
            return <View key={`empty-${i}`} style={styles.cell} />;
          }

          const hasEntry = entryDates.includes(cell.dateStr);
          const mood = moodMap[cell.dateStr];
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === today.toISOString().slice(0, 10);
          const isFuture = cell.dateStr > today.toISOString().slice(0, 10);

          return (
            <Pressable
              key={cell.dateStr}
              onPress={() => !isFuture && onSelectDate(cell.dateStr!)}
              style={[
                styles.cell,
                isSelected && styles.cellSelected,
                isToday && !isSelected && styles.cellToday,
              ]}
              disabled={isFuture}
            >
              <TText
                variant="small"
                style={[
                  styles.dayNum,
                  isSelected && styles.dayNumSelected,
                  isFuture && styles.dayNumFuture,
                ]}
              >
                {cell.day}
              </TText>
              {hasEntry && (
                <View style={[
                  styles.dot,
                  { backgroundColor: mood ? MOOD_COLORS[mood] : colors.accent },
                ]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayLabelCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingBottom: spacing[1],
  },
  dayLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    gap: 2,
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  dayNum: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  dayNumSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  dayNumFuture: {
    color: colors.textSecondary,
    opacity: 0.4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
