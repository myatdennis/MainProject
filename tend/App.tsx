import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '@/navigation/RootNavigator';
import { HealthProvider } from '@/contexts/HealthContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { configureNotificationHandler, scheduleDailyMorningReminder, scheduleEveningJournalReminder } from '@/lib/notifications';
import { startSyncQueueListener, stopSyncQueueListener } from '@/lib/syncQueue';
import { colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60,
      retry: 2,
    },
  },
});

configureNotificationHandler();

export default function App() {
  useEffect(() => {
    scheduleDailyMorningReminder(7, 30);
    scheduleEveningJournalReminder(20, 0);
    startSyncQueueListener();
    return () => stopSyncQueueListener();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <HealthProvider>
            <StatusBar style="dark" backgroundColor={colors.background} />
            <RootNavigator />
          </HealthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
