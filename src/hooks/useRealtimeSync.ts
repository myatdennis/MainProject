import { useEffect, useCallback, useRef } from 'react';
import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export interface RealtimeEvent {
  type: 'course_assigned' | 'course_updated' | 'progress_sync' | 'enrollment_changed' | 'user_status_changed';
  payload: any;
  timestamp: number;
  userId?: string;
}

interface UseRealtimeSyncOptions {
  userId?: string;
  channels?: string[];
  onEvent?: (event: RealtimeEvent) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

export const useRealtimeSync = (options: UseRealtimeSyncOptions = {}) => {
  const {
    userId,
    channels = ['course_assignments', 'user_progress', 'enrollments'],
    onEvent,
    onError,
    enabled = true
  } = options;

  const subscriptionsRef = useRef<any[]>([]);
  const supabaseRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const handleRealtimeEvent = useCallback((payload: any, eventType: string, channel: string) => {
    const event: RealtimeEvent = {
      type: eventType as RealtimeEvent['type'],
      payload,
      timestamp: Date.now(),
      userId: payload.user_id || userId
    };

    console.log(`[RealtimeSync] Event received on ${channel}:`, event);
    
    // Call custom event handler if provided
    onEvent?.(event);

    // Handle specific event types with user notifications
    switch (event.type) {
      case 'course_assigned':
        toast.success(`New course assigned: ${payload.course_name || 'Course'}`);
        break;
      case 'course_updated':
        toast(`Course updated: ${payload.course_name || 'Course'}`, { icon: 'ℹ️' });
        break;
      case 'enrollment_changed':
        if (payload.status === 'enrolled') {
          toast.success(`Successfully enrolled in ${payload.course_name || 'course'}`);
        } else if (payload.status === 'unenrolled') {
          toast(`Unenrolled from ${payload.course_name || 'course'}`, { icon: 'ℹ️' });
        }
        break;
      case 'user_status_changed':
        if (payload.status === 'suspended') {
          toast.error('Your account has been suspended. Please contact support.');
        } else if (payload.status === 'activated') {
          toast.success('Your account has been activated!');
        }
        break;
    }
  }, [onEvent, userId]);

  const connect = useCallback(async () => {
    if (!enabled || !hasSupabaseConfig()) {
      console.log('[RealtimeSync] Connection disabled or Supabase not configured');
      return;
    }

    try {
      console.log('[RealtimeSync] Establishing realtime connections...');
      const client = await getSupabase();
      if (!client) {
        console.log('[RealtimeSync] Supabase client unavailable (lazy load failed)');
        return;
      }
      supabaseRef.current = client;
      
      // Clear any existing subscriptions
      subscriptionsRef.current.forEach(sub => {
        supabaseRef.current?.removeChannel(sub);
      });
      subscriptionsRef.current = [];

      // Subscribe to each channel
      for (const channelName of channels) {
        const channel = supabaseRef.current.channel(channelName)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public',
              table: channelName,
              filter: userId ? `user_id=eq.${userId}` : undefined
            }, 
            (payload: any) => {
              handleRealtimeEvent(payload.new || payload.old, payload.eventType, channelName);
            }
          )
          .on('broadcast', 
            { event: 'sync_update' },
            (payload: any) => {
              handleRealtimeEvent(payload, 'progress_sync', channelName);
            }
          )
          .subscribe((status: any) => {
            console.log(`[RealtimeSync] Channel ${channelName} status:`, status);
            
            if (status === 'SUBSCRIBED') {
              reconnectAttemptsRef.current = 0;
              toast.success('Real-time sync connected', { 
                id: 'realtime-status',
                duration: 2000 
              });
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              handleReconnection();
            }
          });

        subscriptionsRef.current.push(channel);
      }

    } catch (error) {
      console.error('[RealtimeSync] Connection error:', error);
      onError?.(error as Error);
      handleReconnection();
    }
  }, [enabled, channels, userId, handleRealtimeEvent, onError]);

  const handleReconnection = useCallback(() => {
    const maxRetries = 5;
    const baseDelay = 1000;
    
    if (reconnectAttemptsRef.current < maxRetries) {
      reconnectAttemptsRef.current++;
      const delay = baseDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
      
      console.log(`[RealtimeSync] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxRetries})`);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
      
      toast.loading(`Reconnecting... (${reconnectAttemptsRef.current}/${maxRetries})`, {
        id: 'realtime-reconnect'
      });
    } else {
      toast.error('Real-time sync disconnected. Please refresh the page.', {
        id: 'realtime-error',
        duration: 5000
      });
    }
  }, [connect]);

  const disconnect = useCallback(() => {
    console.log('[RealtimeSync] Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    subscriptionsRef.current.forEach(sub => {
      supabaseRef.current?.removeChannel(sub);
    });
    subscriptionsRef.current = [];
    
    toast.dismiss('realtime-status');
    toast.dismiss('realtime-reconnect');
    toast.dismiss('realtime-error');
  }, []);

  const broadcastUpdate = useCallback(async (eventType: string, data: any) => {
    if (!supabaseRef.current || subscriptionsRef.current.length === 0) {
      console.warn('[RealtimeSync] Cannot broadcast - no active connections');
      return;
    }

    try {
      const channel = subscriptionsRef.current[0];
      await channel.send({
        type: 'broadcast',
        event: 'sync_update',
        payload: {
          type: eventType,
          data,
          timestamp: Date.now(),
          userId
        }
      });
      
      console.log('[RealtimeSync] Broadcast sent:', { eventType, data });
    } catch (error) {
      console.error('[RealtimeSync] Broadcast error:', error);
      onError?.(error as Error);
    }
  }, [userId, onError]);

  // Auto-connect on mount and when options change
  useEffect(() => {
    if (enabled) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    broadcastUpdate,
    isConnected: subscriptionsRef.current.length > 0,
    reconnectAttempts: reconnectAttemptsRef.current
  };
};
