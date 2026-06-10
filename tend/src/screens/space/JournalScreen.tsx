import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { CalendarView } from '@/components/journal/CalendarView';
import { JournalEntryView } from '@/components/journal/JournalEntry';
import { useJournal } from '@/hooks/useJournal';
import { colors, spacing } from '@/theme';

type JournalView = 'calendar' | 'entry';

export function JournalScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<JournalView>('entry');
  const { entryDates, moodHistory, refresh } = useJournal();

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setView('entry');
    refresh();
  };

  const isToday = selectedDate === today;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerLeft}>
          {view === 'entry' && !isToday && (
            <Pressable onPress={() => setView('calendar')} style={styles.backBtn}>
              <TText variant="body" color="secondary">‹</TText>
            </Pressable>
          )}
          <View>
            <TText variant="title">Journal</TText>
            {!isToday && (
              <TText variant="caption" color="secondary">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </TText>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setView(v => v === 'calendar' ? 'entry' : 'calendar')}
            style={styles.headerBtn}
            accessibilityLabel={view === 'calendar' ? 'Close calendar' : 'Open calendar'}
          >
            <TText variant="body">{view === 'calendar' ? '✕' : '📅'}</TText>
          </Pressable>
          {selectedDate !== today && (
            <Pressable
              onPress={() => handleSelectDate(today)}
              style={styles.headerBtn}
              accessibilityLabel="Go to today"
            >
              <TText variant="small" style={styles.todayBtn}>Today</TText>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Calendar overlay */}
      {view === 'calendar' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.calendarContainer}>
          <CalendarView
            entryDates={entryDates}
            moodHistory={moodHistory}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        </Animated.View>
      ) : (
        <JournalEntryView key={selectedDate} date={selectedDate} />
      )}
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    color: colors.accent,
    fontWeight: '600',
  },
  calendarContainer: {
    padding: spacing[4],
  },
});
