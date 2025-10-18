import { useEffect, useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import syncService, { SyncEventType } from '../services/syncService';
import type { SyncScope } from '../services/realtimeSyncEngine';

export interface RealtimeEvent {
  type: SyncEventType;
  payload: any;
  timestamp: number;
  userId?: string;
}

interface UseRealtimeSyncOptions {
  userId?: string;
  organizationId?: string;
  events?: SyncEventType[];
  onEvent?: (event: RealtimeEvent) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

const DEFAULT_EVENTS: SyncEventType[] = [
  'course_assigned',
  'course_updated',
  'user_progress',
  'user_enrolled',
  'user_completed',
  'notification_created',
  'survey_response',
  'analytics_updated',
];

const makeRealtimeEvent = (type: SyncEventType, payload: any, userId?: string): RealtimeEvent => ({
  type,
  payload,
  timestamp: Date.now(),
  userId,
});

const showToastForEvent = (event: RealtimeEvent) => {
  switch (event.type) {
    case 'course_assigned': {
      const courseName = event.payload?.assignment?.course_name || event.payload?.course?.title || 'course';
      toast.success(`New course assigned: ${courseName}`);
      break;
    }
    case 'course_updated': {
      const courseName = event.payload?.course?.title || event.payload?.course_name || 'Course';
      toast(`Course updated: ${courseName}`, { icon: 'ℹ️' });
      break;
    }
    case 'user_enrolled': {
      const courseName = event.payload?.enrollment?.course_name || 'course';
      toast.success(`Enrolled in ${courseName}`);
      break;
    }
    case 'user_completed': {
      const courseName = event.payload?.courseId || event.payload?.enrollment?.course_name || 'course';
      toast.success(`Course completed: ${courseName}`);
      break;
    }
    case 'notification_created': {
      toast(event.payload?.notification?.title || 'New notification received', { icon: '🔔' });
      break;
    }
    case 'survey_response': {
      toast.success('New survey response received');
      break;
    }
  }
};

export const useRealtimeSync = (options: UseRealtimeSyncOptions = {}) => {
  const {
    userId,
    organizationId,
    events = DEFAULT_EVENTS,
    onEvent,
    onError,
    enabled = true,
  } = options;

  const [isActive, setIsActive] = useState(enabled);
  const [connectionStatus, setConnectionStatus] = useState(syncService.getSyncStatus().connection);
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const lastEventsRef = useRef<string>('');

  useEffect(() => {
    setIsActive(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!isActive) {
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
      toast.dismiss('realtime-status');
      toast.dismiss('realtime-reconnect');
      return;
    }

    const eventsKey = JSON.stringify([...events].sort());
    if (eventsKey === lastEventsRef.current) {
      // Events unchanged, no need to resubscribe
    } else {
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
      lastEventsRef.current = eventsKey;
    }

    syncService.configureContext({ userId, organizationId });

    const handleSubscription = (eventType: SyncEventType) => {
      const unsubscribe = syncService.subscribe(eventType, payload => {
        const realtimeEvent = makeRealtimeEvent(eventType, payload, userId);
        try {
          onEvent?.(realtimeEvent);
          showToastForEvent(realtimeEvent);
        } catch (error) {
          console.error('[useRealtimeSync] Event handler error:', error);
          onError?.(error as Error);
        }
      });
      unsubscribersRef.current.push(unsubscribe);
    };

    events.forEach(handleSubscription);

    const connectionUnsub = syncService.subscribe('connection_status', status => {
      setConnectionStatus(status);
      if (!status.online) {
        toast.error('You appear to be offline. Realtime updates paused.', {
          id: 'realtime-offline',
          duration: 4000,
        });
        return;
      }

      if (!status.connected) {
        toast.loading('Reconnecting to realtime sync...', {
          id: 'realtime-reconnect',
        });
      } else {
        toast.dismiss('realtime-reconnect');
        toast.success('Real-time sync connected', {
          id: 'realtime-status',
          duration: 2000,
        });
      }
    });

    unsubscribersRef.current.push(connectionUnsub);

    return () => {
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
      toast.dismiss('realtime-status');
      toast.dismiss('realtime-reconnect');
      toast.dismiss('realtime-offline');
    };
  }, [isActive, userId, organizationId, JSON.stringify(events), onEvent, onError]);

  const connect = useCallback(() => {
    setIsActive(true);
  }, []);

  const disconnect = useCallback(() => {
    setIsActive(false);
  }, []);

  const broadcastUpdate = useCallback(
    (eventType: SyncEventType, data: any, scope?: SyncScope) => {
      try {
        syncService.logSyncEvent({
          type: eventType,
          data,
          timestamp: Date.now(),
          scope,
          userId,
        });
      } catch (error) {
        console.error('[useRealtimeSync] Broadcast failed', error);
        onError?.(error as Error);
      }
    },
    [userId, onError]
  );

  return {
    connect,
    disconnect,
    broadcastUpdate,
    isConnected: connectionStatus.connected,
    connectionStatus,
  };
};
