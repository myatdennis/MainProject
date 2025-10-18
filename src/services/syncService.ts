import { courseStore } from '../store/courseStore';
import { Course } from '../types/courseTypes';
import { supabase } from '../lib/supabase';
import realtimeSyncEngine, {
  EngineEvent,
  SyncEntity,
  SyncScope,
} from './realtimeSyncEngine';

export type SyncEventType =
  | 'course_updated'
  | 'course_created'
  | 'course_deleted'
  | 'course_assigned'
  | 'assignment_updated'
  | 'assignment_deleted'
  | 'survey_created'
  | 'survey_updated'
  | 'survey_deleted'
  | 'survey_response'
  | 'organization_updated'
  | 'user_updated'
  | 'notification_created'
  | 'notification_read'
  | 'user_progress'
  | 'user_enrolled'
  | 'user_completed'
  | 'analytics_updated'
  | 'refresh_all'
  | 'connection_status';

export interface SyncEvent {
  type: SyncEventType;
  data: any;
  timestamp: number;
  userId?: string;
  courseId?: string;
  source?: 'admin' | 'client';
  scope?: SyncScope;
}

interface SyncContext extends SyncScope {
  userId?: string;
}

const EVENT_ENTITY_MAP: Partial<Record<SyncEventType, SyncEntity>> = {
  course_created: 'courses',
  course_updated: 'courses',
  course_deleted: 'courses',
  course_assigned: 'assignments',
  assignment_updated: 'assignments',
  assignment_deleted: 'assignments',
  survey_created: 'surveys',
  survey_updated: 'surveys',
  survey_deleted: 'surveys',
  survey_response: 'survey_responses',
  organization_updated: 'organizations',
  user_updated: 'users',
  notification_created: 'notifications',
  notification_read: 'notifications',
  user_progress: 'user_lesson_progress',
  user_enrolled: 'user_course_enrollments',
  user_completed: 'user_course_enrollments',
  analytics_updated: 'user_course_enrollments',
};

class SyncService {
  private subscribers: { [K in SyncEventType]?: Set<(data: any) => void> } = {};
  private syncInterval: number | null = null;
  private lastSyncTime: number = Date.now();
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private pendingSync: SyncEvent[] = [];
  private context: SyncContext = {};
  private realtimeUnsubscribers: (() => void)[] = [];
  private realtimeInitialized = false;
  private connectionStatus: { online: boolean; connected: boolean } = {
    online: this.isOnline,
    connected: false,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.connectionStatus.online = true;
        this.emit('connection_status', { ...this.connectionStatus });
        this.processPendingSync();
        this.ensureRealtimeSubscriptions();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.connectionStatus.online = false;
        this.connectionStatus.connected = false;
        this.emit('connection_status', { ...this.connectionStatus });
      });
    }

    this.startSync();
    this.ensureRealtimeSubscriptions();
  }

  configureContext(context: SyncContext) {
    const hasChanges =
      context.userId !== this.context.userId ||
      context.organizationId !== this.context.organizationId;

    this.context = { ...this.context, ...context };

    if (hasChanges) {
      this.resetRealtimeSubscriptions();
    }
  }

  private resetRealtimeSubscriptions() {
    this.realtimeUnsubscribers.forEach(unsub => unsub());
    this.realtimeUnsubscribers = [];
    this.realtimeInitialized = false;
    this.ensureRealtimeSubscriptions();
  }

  private isSupabaseConfigured() {
    return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  }

  private ensureRealtimeSubscriptions() {
    if (!this.isSupabaseConfigured()) {
      console.log('[SyncService] Supabase not configured - realtime sync disabled, using polling only.');
      return;
    }

    if (this.realtimeInitialized) return;

    this.realtimeInitialized = true;

    const scope: SyncScope = {
      organizationId: this.context.organizationId || this.getStoredOrganizationId(),
      userId: this.context.userId,
    };

    const subscribe = (entity: SyncEntity, handler: (events: EngineEvent[]) => void, debounceMs = 150) => {
      const unsubscribe = realtimeSyncEngine.subscribe(entity, handler, {
        scope,
        debounceMs,
        onError: (error) => {
          console.error('[SyncService] Realtime subscription error:', error);
        },
      });
      this.realtimeUnsubscribers.push(unsubscribe);
    };

    subscribe('courses', events => this.handleCourseEvents(events));
    subscribe('modules', events => this.handleCourseEvents(events));
    subscribe('lessons', events => this.handleCourseEvents(events));
    subscribe('assignments', events => this.handleAssignmentEvents(events));
    subscribe('course_assignments', events => this.handleAssignmentEvents(events));
    subscribe('surveys', events => this.handleSurveyEvents(events));
    subscribe('survey_responses', events => this.handleSurveyResponseEvents(events));
    subscribe('organizations', events => this.handleOrganizationEvents(events));
    subscribe('users', events => this.handleUserEvents(events));
    subscribe('notifications', events => this.handleNotificationEvents(events, scope));
    subscribe('user_lesson_progress', events => this.handleProgressEvents(events));
    subscribe('user_course_enrollments', events => this.handleEnrollmentEvents(events));

    const connectionUnsub = realtimeSyncEngine.onConnectionStatus(status => {
      this.connectionStatus = status;
      this.emit('connection_status', status);
    });
    this.realtimeUnsubscribers.push(connectionUnsub);

    const errorUnsub = realtimeSyncEngine.onError(error => {
      console.error('[SyncService] Realtime engine error:', error);
    });
    this.realtimeUnsubscribers.push(errorUnsub);
  }

  private getStoredOrganizationId(): string | undefined {
    try {
      const stored = localStorage.getItem('huddle_user');
      if (!stored) return undefined;
      const parsed = JSON.parse(stored);
      return parsed?.organizationId || parsed?.organization || undefined;
    } catch {
      return undefined;
    }
  }

  private handleCourseEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const courseRecord = (event.record || event.previousRecord) as Course;
      if (!courseRecord) return;

      if (event.changeType === 'DELETE') {
        if (courseRecord.id) {
          courseStore.deleteCourse(courseRecord.id);
        }
        this.emit('course_deleted', {
          course: courseRecord,
          courseId: courseRecord.id,
          timestamp: event.timestamp,
          scope: this.context,
        });
        return;
      }

      // Update local store for optimistic UI
      courseStore.saveCourse(courseRecord);

      const payload = {
        course: courseRecord,
        courseId: courseRecord.id,
        timestamp: event.timestamp,
        scope: this.context,
      };

      if (event.changeType === 'INSERT') {
        this.emit('course_created', payload);
      } else {
        this.emit('course_updated', payload);
      }
    });
  }

  private handleAssignmentEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      const payload = {
        assignment: record,
        timestamp: event.timestamp,
        scope: this.context,
        courseId: record.course_id,
        organizationId: record.organization_id,
        userId: record.user_id,
      };

      switch (event.changeType) {
        case 'INSERT':
          this.emit('course_assigned', payload);
          break;
        case 'UPDATE':
          this.emit('assignment_updated', payload);
          break;
        case 'DELETE':
          this.emit('assignment_deleted', payload);
          break;
      }
    });
  }

  private handleSurveyEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      const payload = {
        survey: record,
        timestamp: event.timestamp,
        scope: this.context,
      };

      switch (event.changeType) {
        case 'INSERT':
          this.emit('survey_created', payload);
          break;
        case 'UPDATE':
          this.emit('survey_updated', payload);
          break;
        case 'DELETE':
          this.emit('survey_deleted', payload);
          break;
      }
    });
  }

  private handleSurveyResponseEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      this.emit('survey_response', {
        response: record,
        timestamp: event.timestamp,
        scope: this.context,
      });
      this.emit('analytics_updated', {
        source: 'survey',
        surveyId: record.survey_id,
        timestamp: event.timestamp,
        scope: this.context,
      });
    });
  }

  private handleOrganizationEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      this.emit('organization_updated', {
        organization: record,
        timestamp: event.timestamp,
        scope: this.context,
      });
    });
  }

  private handleUserEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      this.emit('user_updated', {
        user: record,
        timestamp: event.timestamp,
        scope: this.context,
      });
    });
  }

  private handleNotificationEvents(events: EngineEvent[], scope: SyncScope) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      const payload = {
        notification: record,
        timestamp: event.timestamp,
        scope,
      };

      if (event.changeType === 'DELETE') {
        this.emit('notification_read', payload);
      } else {
        this.emit('notification_created', payload);
      }
    });
  }

  private handleProgressEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      const payload = {
        progress: record,
        timestamp: event.timestamp,
        userId: record.user_id,
        courseId: record.course_id,
        lessonId: record.lesson_id,
        scope: this.context,
      };

      this.emit('user_progress', payload);

      if (record.completed) {
        this.emit('user_completed', {
          ...payload,
          completionType: 'lesson',
        });
      }
    });
  }

  private handleEnrollmentEvents(events: EngineEvent[]) {
    events.forEach(event => {
      const record = event.record || event.previousRecord;
      if (!record) return;

      const payload = {
        enrollment: record,
        timestamp: event.timestamp,
        userId: record.user_id,
        courseId: record.course_id,
        scope: this.context,
      };

      if (event.changeType === 'INSERT') {
        this.emit('user_enrolled', payload);
      }

      if (record.completed_at) {
        this.emit('user_completed', {
          ...payload,
          completionType: 'course',
        });
      }

      this.emit('analytics_updated', {
        source: 'course',
        courseId: record.course_id,
        timestamp: event.timestamp,
        scope: this.context,
      });
    });
  }

  subscribe(eventType: SyncEventType, callback: (data: any) => void) {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = new Set();
    }
    this.subscribers[eventType]!.add(callback);

    return () => {
      this.subscribers[eventType]!.delete(callback);
    };
  }

  private emit(eventType: SyncEventType, data: any) {
    if (this.subscribers[eventType]) {
      this.subscribers[eventType]!.forEach(callback => callback(data));
    }
  }

  async refreshCourse(courseId: string): Promise<void> {
    try {
      if (this.isSupabaseConfigured()) {
        const { data: course, error } = await supabase
          .from('courses')
          .select(`
            *,
            modules (
              *,
              lessons (*)
            )
          `)
          .eq('id', courseId)
          .single();

        if (error) throw error;

        if (course) {
          courseStore.saveCourse(course as Course);
        }

        this.emit('course_updated', {
          course,
          courseId,
          timestamp: Date.now(),
          scope: this.context,
          manual: true,
        });
      } else {
        await courseStore.init();
        this.emit('course_updated', {
          courseId,
          timestamp: Date.now(),
          scope: this.context,
          manual: true,
        });
      }
    } catch (error) {
      console.error('Error refreshing course:', courseId, error);
      throw error;
    }
  }

  async refreshAll(): Promise<void> {
    try {
      await courseStore.init();
      this.emit('refresh_all', {
        timestamp: Date.now(),
        scope: this.context,
        manual: true,
      });
    } catch (error) {
      console.error('Error during global refresh:', error);
      throw error;
    }
  }

  subscribeToCourseUpdates(callback: (data: any) => void) {
    return this.subscribe('course_updated', callback);
  }

  subscribeToUserProgress(callback: (data: any) => void) {
    return this.subscribe('user_progress', callback);
  }

  subscribeToRefresh(callback: (data: any) => void) {
    return this.subscribe('refresh_all', callback);
  }

  private startSync() {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      if (this.isOnline) {
        this.syncWithRemote();
      }
    }, 60000);
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async syncWithRemote() {
    try {
      const remoteData = this.checkForRemoteUpdates();

      if (remoteData.length > 0) {
        remoteData.forEach(update => {
          this.handleRemoteUpdate(update);
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  private checkForRemoteUpdates(): SyncEvent[] {
    try {
      const syncLog = localStorage.getItem('huddle_sync_log');
      if (!syncLog) return [];

      const events: SyncEvent[] = JSON.parse(syncLog);
      const newEvents = events.filter(event => event.timestamp > this.lastSyncTime);

      if (newEvents.length > 0) {
        this.lastSyncTime = Math.max(...newEvents.map(e => e.timestamp));
      }

      return newEvents;
    } catch {
      return [];
    }
  }

  private handleRemoteUpdate(event: SyncEvent) {
    switch (event.type) {
      case 'course_updated':
      case 'course_created':
        courseStore.saveCourse(event.data as Course);
        this.emit(event.type, event.data);
        break;

      case 'course_deleted':
        if (event.data?.id) {
          courseStore.deleteCourse(event.data.id);
        }
        this.emit(event.type, event.data);
        break;

      case 'user_progress':
      case 'user_completed':
      case 'user_enrolled':
        this.emit(event.type, event.data);
        break;

      default:
        this.emit(event.type, event.data);
        break;
    }
  }

  logSyncEvent(event: SyncEvent) {
    try {
      const syncLog = localStorage.getItem('huddle_sync_log');
      const events: SyncEvent[] = syncLog ? JSON.parse(syncLog) : [];

      const enrichedEvent: SyncEvent = {
        ...event,
        timestamp: Date.now(),
        scope: event.scope || this.context,
      };

      events.push(enrichedEvent);
      const recentEvents = events.slice(-100);
      localStorage.setItem('huddle_sync_log', JSON.stringify(recentEvents));

      if (this.isOnline) {
        this.emit(event.type, enrichedEvent.data);
        this.broadcastEvent(enrichedEvent);
      } else {
        this.pendingSync.push(enrichedEvent);
      }
    } catch (error) {
      console.error('Failed to log sync event:', error);
    }
  }

  private broadcastEvent(event: SyncEvent) {
    const entity = EVENT_ENTITY_MAP[event.type];
    if (!entity) return;

    realtimeSyncEngine.broadcast(entity, event.data, {
      scope: event.scope || this.context,
    });
  }

  private processPendingSync() {
    if (this.pendingSync.length === 0) return;

    this.pendingSync.forEach(event => {
      this.emit(event.type, event.data);
      this.broadcastEvent(event);
    });

    this.pendingSync = [];
  }

  async forcSync() {
    if (this.isOnline) {
      await this.syncWithRemote();
    }
  }

  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingEvents: this.pendingSync.length,
      isActive: this.syncInterval !== null,
      connection: this.connectionStatus,
    };
  }
}

export const syncService = new SyncService();
export default syncService;

export const useSyncService = (context?: SyncContext) => {
  if (context) {
    syncService.configureContext(context);
  }

  return {
    subscribe: syncService.subscribe.bind(syncService),
    logEvent: syncService.logSyncEvent.bind(syncService),
    forceSync: syncService.forcSync.bind(syncService),
    getStatus: syncService.getSyncStatus.bind(syncService),
    configureContext: syncService.configureContext.bind(syncService),
  };
};
