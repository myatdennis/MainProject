import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SyncEntity =
  | 'courses'
  | 'modules'
  | 'lessons'
  | 'assignments'
  | 'course_assignments'
  | 'surveys'
  | 'survey_responses'
  | 'organizations'
  | 'users'
  | 'notifications'
  | 'user_lesson_progress'
  | 'user_course_enrollments';

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncScope {
  organizationId?: string;
  userId?: string;
}

export interface EngineEvent {
  entity: SyncEntity;
  changeType: ChangeType;
  record: any;
  previousRecord?: any;
  timestamp: number;
  scopeKey: string;
}

export interface SubscribeOptions {
  scope?: SyncScope;
  debounceMs?: number;
  eventTypes?: ChangeType[];
  onError?: (error: Error) => void;
}

export interface BroadcastOptions {
  scope?: SyncScope;
}

interface ChannelEntry {
  entity: SyncEntity;
  channel: RealtimeChannel | null;
  subscribers: Set<(events: EngineEvent[]) => void>;
  options: SubscribeOptions;
  pending: EngineEvent[];
  debounceTimer?: number;
  scopeKey: string;
  isSubscribed: boolean;
}

interface EngineOptions {
  fallbackPollInterval?: number;
}

interface LastSyncState {
  [scopeKey: string]: {
    [entity in SyncEntity]?: number;
  };
}

const DEFAULT_FALLBACK_INTERVAL = 60000; // 60 seconds

export class RealTimeSyncEngine {
  private channels: Map<string, ChannelEntry> = new Map();
  private lastSyncTimestamps: LastSyncState = {};
  private fallbackTimer: number | null = null;
  private fallbackPollInterval: number = DEFAULT_FALLBACK_INTERVAL;
  private online: boolean = typeof window !== 'undefined' ? navigator.onLine : true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts = 5;
  private connectionListeners: Set<(status: { online: boolean; connected: boolean }) => void> = new Set();
  private errorListeners: Set<(error: Error) => void> = new Set();
  private connected: boolean = false;

  constructor(options: EngineOptions = {}) {
    if (options.fallbackPollInterval) {
      this.fallbackPollInterval = options.fallbackPollInterval;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    this.restoreLastSyncState();
  }

  destroy() {
    this.channels.forEach(entry => {
      if (entry.channel) {
        supabase.removeChannel(entry.channel);
      }
    });
    this.channels.clear();
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  onConnectionStatus(listener: (status: { online: boolean; connected: boolean }) => void) {
    this.connectionListeners.add(listener);
    listener({ online: this.online, connected: this.connected });
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  onError(listener: (error: Error) => void) {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  subscribe(entity: SyncEntity, handler: (events: EngineEvent[]) => void, options: SubscribeOptions = {}) {
    const scopeKey = this.getScopeKey(entity, options.scope);
    const existingEntry = this.channels.get(scopeKey);

    if (existingEntry) {
      existingEntry.subscribers.add(handler);
      return () => {
        existingEntry.subscribers.delete(handler);
        if (existingEntry.subscribers.size === 0) {
          this.teardownChannel(scopeKey);
        }
      };
    }

    const channelName = this.buildChannelName(entity, options.scope);
    const channelEntry: ChannelEntry = {
      entity,
      channel: null,
      subscribers: new Set([handler]),
      options,
      pending: [],
      scopeKey,
      isSubscribed: false,
    };

    this.channels.set(scopeKey, channelEntry);
    this.initializeChannel(channelEntry, channelName);

    return () => {
      const entry = this.channels.get(scopeKey);
      if (!entry) return;
      entry.subscribers.delete(handler);
      if (entry.subscribers.size === 0) {
        this.teardownChannel(scopeKey);
      }
    };
  }

  async broadcast(entity: SyncEntity, payload: any, options: BroadcastOptions = {}) {
    const scopeKey = this.getScopeKey(entity, options.scope);
    const entry = this.channels.get(scopeKey);

    if (!entry || !entry.channel) {
      console.warn('[RealTimeSyncEngine] No active channel for broadcast', { entity, scope: options.scope });
      return;
    }

    try {
      await entry.channel.send({
        type: 'broadcast',
        event: 'sync_update',
        payload: {
          entity,
          data: payload,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('[RealTimeSyncEngine] Broadcast failed', error);
      this.emitError(error as Error);
    }
  }

  getLastSync(entity: SyncEntity, scope?: SyncScope): number | null {
    const scopeKey = this.getScopeKey(entity, scope);
    return this.lastSyncTimestamps[scopeKey]?.[entity] || null;
  }

  private initializeChannel(entry: ChannelEntry, channelName: string) {
    if (!supabase) {
      console.warn('[RealTimeSyncEngine] Supabase client is not available. Falling back to polling only.');
      this.ensureFallbackPolling();
      return;
    }

    try {
      const filter = this.buildFilter(entry.options.scope);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: entry.entity,
            filter,
          },
          (payload: any) => {
            this.handleRealtimePayload(entry, payload);
          }
        )
        .on('broadcast', { event: 'sync_update' }, (payload: any) => {
          this.handleBroadcastPayload(entry, payload);
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            entry.isSubscribed = true;
            this.reconnectAttempts = 0;
            this.connected = true;
            this.emitConnectionStatus();
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            entry.isSubscribed = false;
            this.connected = false;
            this.emitConnectionStatus();
            this.retryChannel(entry, channelName);
          }
        });

      entry.channel = channel;
      this.ensureFallbackPolling();
    } catch (error) {
      console.error('[RealTimeSyncEngine] Failed to initialize channel', { entity: entry.entity, error });
      this.emitError(error as Error);
      this.retryChannel(entry, channelName);
    }
  }

  private retryChannel(entry: ChannelEntry, channelName: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RealTimeSyncEngine] Max reconnect attempts reached for', channelName);
      this.ensureFallbackPolling();
      return;
    }

    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    this.reconnectAttempts += 1;

    setTimeout(() => {
      if (this.channels.has(entry.scopeKey)) {
        this.initializeChannel(entry, channelName);
      }
    }, delay);
  }

  private handleRealtimePayload(entry: ChannelEntry, payload: any) {
    const { eventType, new: newRecord, old } = payload;
    const changeType = (eventType || 'UPDATE') as ChangeType;
    const record = newRecord || old;

    if (!record) return;

    // Additional client-side filtering for scope
    if (!this.matchesScope(record, entry.options.scope)) {
      return;
    }

    const event: EngineEvent = {
      entity: entry.entity,
      changeType,
      record: newRecord,
      previousRecord: old,
      timestamp: Date.now(),
      scopeKey: entry.scopeKey,
    };

    this.queueEvent(entry, event);
    this.updateLastSync(entry, record);
  }

  private handleBroadcastPayload(entry: ChannelEntry, payload: any) {
    if (!payload) return;
    const data = payload.data || payload.payload?.data;
    const timestamp = payload.timestamp || payload.payload?.timestamp || Date.now();

    if (!data) return;

    const event: EngineEvent = {
      entity: entry.entity,
      changeType: 'UPDATE',
      record: data,
      timestamp,
      scopeKey: entry.scopeKey,
    };

    this.queueEvent(entry, event);
    this.updateLastSync(entry, data);
  }

  private queueEvent(entry: ChannelEntry, event: EngineEvent) {
    entry.pending.push(event);

    if (!entry.options.debounceMs || entry.options.debounceMs <= 0) {
      this.flushEvents(entry);
      return;
    }

    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }

    entry.debounceTimer = window.setTimeout(() => {
      this.flushEvents(entry);
    }, entry.options.debounceMs);
  }

  private flushEvents(entry: ChannelEntry) {
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
      entry.debounceTimer = undefined;
    }

    if (entry.pending.length === 0) return;

    const events = [...entry.pending];
    entry.pending = [];

    entry.subscribers.forEach(handler => {
      try {
        handler(events);
      } catch (error) {
        console.error('[RealTimeSyncEngine] Subscriber error', error);
        entry.options.onError?.(error as Error);
      }
    });
  }

  private matchesScope(record: any, scope?: SyncScope) {
    if (!scope) return true;
    if (scope.organizationId && record?.organization_id && record.organization_id !== scope.organizationId) {
      return false;
    }
    if (scope.userId && record?.user_id && record.user_id !== scope.userId) {
      return false;
    }
    return true;
  }

  private updateLastSync(entry: ChannelEntry, record: any) {
    if (!record) return;
    const updatedAt = record.updated_at || record.inserted_at || record.created_at;
    const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    const scopeState = (this.lastSyncTimestamps[entry.scopeKey] ||= {});
    scopeState[entry.entity] = Math.max(scopeState[entry.entity] || 0, timestamp);
    this.persistLastSyncState();
  }

  private ensureFallbackPolling() {
    if (this.fallbackTimer) return;

    this.fallbackTimer = window.setInterval(() => {
      this.pollAllChannels();
    }, this.fallbackPollInterval);
  }

  private pollAllChannels() {
    this.channels.forEach(entry => {
      this.pollChannel(entry);
    });
  }

  private async pollChannel(entry: ChannelEntry) {
    try {
      const lastSync = this.getLastSync(entry.entity, entry.options.scope) || 0;
      const since = new Date(lastSync).toISOString();

      const filters: Record<string, any> = {};
      if (entry.options.scope?.organizationId) {
        filters.organization_id = entry.options.scope.organizationId;
      }
      if (entry.options.scope?.userId) {
        filters.user_id = entry.options.scope.userId;
      }

      let query = supabase.from(entry.entity).select('*').gt('updated_at', since).order('updated_at', { ascending: true }).limit(200);
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const events: EngineEvent[] = data.map((record: any) => ({
          entity: entry.entity,
          changeType: 'UPDATE',
          record,
          timestamp: Date.now(),
          scopeKey: entry.scopeKey,
        }));

        entry.subscribers.forEach(handler => handler(events));
        const latestRecord = data[data.length - 1];
        this.updateLastSync(entry, latestRecord);
      }
    } catch (error) {
      console.error('[RealTimeSyncEngine] Polling error', error);
      this.emitError(error as Error);
    }
  }

  private teardownChannel(scopeKey: string) {
    const entry = this.channels.get(scopeKey);
    if (!entry) return;

    if (entry.channel) {
      supabase.removeChannel(entry.channel);
    }
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }

    this.channels.delete(scopeKey);
  }

  private buildChannelName(entity: SyncEntity, scope?: SyncScope) {
    const parts = [`rt`, entity];
    if (scope?.organizationId) {
      parts.push(`org_${scope.organizationId}`);
    }
    if (scope?.userId) {
      parts.push(`user_${scope.userId}`);
    }
    return parts.join(':');
  }

  private buildFilter(scope?: SyncScope) {
    if (!scope) return undefined;
    if (scope.userId) {
      return `user_id=eq.${scope.userId}`;
    }
    if (scope.organizationId) {
      return `organization_id=eq.${scope.organizationId}`;
    }
    return undefined;
  }

  private getScopeKey(entity: SyncEntity, scope?: SyncScope) {
    const org = scope?.organizationId || 'global';
    const user = scope?.userId || 'all-users';
    return `${entity}:${org}:${user}`;
  }

  private persistLastSyncState() {
    try {
      localStorage.setItem('huddle_last_sync_state', JSON.stringify(this.lastSyncTimestamps));
    } catch (error) {
      console.warn('[RealTimeSyncEngine] Failed to persist last sync state', error);
    }
  }

  private restoreLastSyncState() {
    try {
      const stored = localStorage.getItem('huddle_last_sync_state');
      if (stored) {
        this.lastSyncTimestamps = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[RealTimeSyncEngine] Failed to restore last sync state', error);
    }
  }

  private emitConnectionStatus() {
    const status = { online: this.online, connected: this.connected };
    this.connectionListeners.forEach(listener => listener(status));
  }

  private emitError(error: Error) {
    this.errorListeners.forEach(listener => listener(error));
  }

  private handleOnline = () => {
    this.online = true;
    this.emitConnectionStatus();
    this.channels.forEach((entry, scopeKey) => {
      const channelName = this.buildChannelName(entry.entity, entry.options.scope);
      this.initializeChannel(entry, channelName);
    });
  };

  private handleOffline = () => {
    this.online = false;
    this.connected = false;
    this.emitConnectionStatus();
  };
}

export const realtimeSyncEngine = new RealTimeSyncEngine();
export default realtimeSyncEngine;
