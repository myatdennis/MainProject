import { Platform } from 'react-native';

// Expo Notifications — dynamic import so it degrades gracefully if not linked
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyMorningReminder(hour = 7, minute = 30): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('morning-reminder').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'morning-reminder',
      content: {
        title: 'Good morning',
        body: 'Check in with today.',
        sound: true,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      } as any,
    });
  } catch { /* non-critical */ }
}

export async function scheduleEveningJournalReminder(hour = 20, minute = 0): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('journal-reminder').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'journal-reminder',
      content: {
        title: 'Wind down',
        body: "Today's page is waiting.",
        sound: false,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      } as any,
    });
  } catch { /* non-critical */ }
}

export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

export function configureNotificationHandler(): void {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
