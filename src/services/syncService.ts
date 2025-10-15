import { courseStore } from '../store/courseStore';
import { Course } from '../types/courseTypes';
import { supabase } from '../lib/supabase';

interface SyncEvent {
  type: 'course_updated' | 'course_created' | 'course_deleted' | 
        'user_progress' | 'user_enrolled' | 'user_completed' |
        'survey_created' | 'survey_updated' | 'survey_response' | 'refresh_all';
  data: any;
  timestamp: number;
  userId?: string;
  courseId?: string;
  source?: 'admin' | 'client';
}

class SyncService {
  private subscribers: { [key: string]: ((data: any) => void)[] } = {};
  private syncInterval: number | null = null;
  private lastSyncTime: number = Date.now();
  private isOnline: boolean = navigator.onLine;
  private pendingSync: SyncEvent[] = [];

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processPendingSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Start polling for changes every 30 seconds
    this.startSync();

    // Initialize real-time Supabase listeners
    this.initializeRealtimeSync();
  }

  // Initialize real-time Supabase synchronization
  private initializeRealtimeSync() {
    // Only set up real-time sync if Supabase is configured
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.log('Supabase not configured - using polling sync only');
      return;
    }

    try {
      // Listen for course changes
      supabase
        .channel('course_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'courses'
        }, (payload: any) => {
          console.log('Real-time course change detected:', payload);
          
          const eventType = payload.eventType === 'INSERT' ? 'course_created' :
                          payload.eventType === 'UPDATE' ? 'course_updated' : 'course_deleted';
          
          this.emit(eventType, {
            course: payload.new || payload.old,
            courseId: (payload.new || payload.old)?.id,
            timestamp: Date.now(),
            source: 'admin'
          });
        })
        .subscribe();

      // Listen for module changes
      supabase
        .channel('module_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'modules'
        }, (payload: any) => {
          console.log('Real-time module change detected:', payload);
          
          this.emit('course_updated', {
            module: payload.new || payload.old,
            courseId: (payload.new || payload.old)?.course_id,
            timestamp: Date.now(),
            source: 'admin'
          });
        })
        .subscribe();

      // Listen for lesson changes  
      supabase
        .channel('lesson_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'lessons'
        }, (payload: any) => {
          console.log('Real-time lesson change detected:', payload);
          
          // Get course ID from module
          this.getLessonCourseId((payload.new || payload.old)?.module_id)
            .then(courseId => {
              if (courseId) {
                this.emit('course_updated', {
                  lesson: payload.new || payload.old,
                  courseId,
                  timestamp: Date.now(),
                  source: 'admin'
                });
              }
            });
        })
        .subscribe();

      // Listen for user progress changes
      supabase
        .channel('progress_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_lesson_progress'
        }, (payload: any) => {
          console.log('Real-time progress change detected:', payload);
          
          this.emit('user_progress', {
            progress: payload.new || payload.old,
            userId: (payload.new || payload.old)?.user_id,
            timestamp: Date.now(),
            source: 'client'
          });
        })
        .subscribe();

      console.log('Real-time sync initialized successfully');
    } catch (error) {
      console.error('Failed to initialize real-time sync:', error);
    }
  }

  // Helper method to get course ID for a lesson
  private async getLessonCourseId(moduleId: string): Promise<string | null> {
    if (!moduleId) return null;
    
    try {
      const { data } = await supabase
        .from('modules')
        .select('course_id')
        .eq('id', moduleId)
        .single();
      
      return data?.course_id || null;
    } catch (error) {
      console.error('Error getting course ID for module:', moduleId, error);
      return null;
    }
  }

  // Subscribe to real-time updates
  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    this.subscribers[eventType].push(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers[eventType] = this.subscribers[eventType].filter(cb => cb !== callback);
    };
  }

  // Emit events to subscribers
  private emit(eventType: string, data: any) {
    if (this.subscribers[eventType]) {
      this.subscribers[eventType].forEach(callback => callback(data));
    }
  }

  // Manual refresh methods for immediate sync
  async refreshCourse(courseId: string): Promise<void> {
    try {
      console.log('Manual course refresh triggered:', courseId);
      
      // If Supabase is configured, fetch from database
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
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

        // Emit course updated event
        this.emit('course_updated', {
          course,
          courseId,
          timestamp: Date.now(),
          source: 'admin',
          manual: true
        });
      } else {
        // Fallback to localStorage refresh
        await courseStore.init();
        this.emit('course_updated', {
          courseId,
          timestamp: Date.now(),
          source: 'admin',
          manual: true
        });
      }
      
      console.log('Course refresh completed:', courseId);
    } catch (error) {
      console.error('Error refreshing course:', courseId, error);
      throw error;
    }
  }

  async refreshAll(): Promise<void> {
    try {
      console.log('Global refresh triggered');
      
      // Trigger course store re-initialization
      await courseStore.init();
      
      // Emit global refresh event
      this.emit('refresh_all', {
        timestamp: Date.now(),
        source: 'admin',
        manual: true
      });
      
      console.log('Global refresh completed');
    } catch (error) {
      console.error('Error during global refresh:', error);
      throw error;
    }
  }

  // Subscribe to specific course updates
  subscribeToCourseUpdates(callback: (data: any) => void) {
    return this.subscribe('course_updated', callback);
  }

  // Subscribe to user progress updates
  subscribeToUserProgress(callback: (data: any) => void) {
    return this.subscribe('user_progress', callback);
  }

  // Subscribe to all refresh events
  subscribeToRefresh(callback: (data: any) => void) {
    return this.subscribe('refresh_all', callback);
  }

  // Start periodic sync
  private startSync() {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      if (this.isOnline) {
        this.syncWithRemote();
      }
    }, 30000); // Sync every 30 seconds
  }

  // Stop periodic sync
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync with remote data source (simulated)
  private async syncWithRemote() {
    try {
      // In a real implementation, this would call your backend API
      // For now, we'll simulate checking for updates from localStorage timestamps
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

  // Simulate checking for remote updates
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

  // Handle remote updates
  private handleRemoteUpdate(event: SyncEvent) {
    switch (event.type) {
      case 'course_updated':
        courseStore.saveCourse(event.data as Course);
        this.emit('course_updated', event.data);
        break;
      
      case 'course_created':
        courseStore.saveCourse(event.data as Course);
        this.emit('course_created', event.data);
        break;
      
      case 'course_deleted':
        courseStore.deleteCourse(event.data.id);
        this.emit('course_deleted', event.data);
        break;
      
      case 'user_progress':
        this.emit('user_progress', event.data);
        break;
    }
  }

  // Log sync events
  logSyncEvent(event: SyncEvent) {
    try {
      const syncLog = localStorage.getItem('huddle_sync_log');
      const events: SyncEvent[] = syncLog ? JSON.parse(syncLog) : [];
      
      events.push({
        ...event,
        timestamp: Date.now()
      });
      
      // Keep only last 100 events
      const recentEvents = events.slice(-100);
      localStorage.setItem('huddle_sync_log', JSON.stringify(recentEvents));
      
      // If online, emit immediately for real-time updates
      if (this.isOnline) {
        this.emit(event.type, event.data);
      } else {
        // Queue for later sync
        this.pendingSync.push(event);
      }
    } catch (error) {
      console.error('Failed to log sync event:', error);
    }
  }

  // Process pending sync events when coming back online
  private processPendingSync() {
    if (this.pendingSync.length === 0) return;

    this.pendingSync.forEach(event => {
      this.emit(event.type, event.data);
    });
    
    this.pendingSync = [];
  }

  // Trigger immediate sync
  async forcSync() {
    if (this.isOnline) {
      await this.syncWithRemote();
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingEvents: this.pendingSync.length,
      isActive: this.syncInterval !== null
    };
  }
}

// Export singleton instance
export const syncService = new SyncService();
export default syncService;

// Hook for using sync service in components
export const useSyncService = () => {
  return {
    subscribe: syncService.subscribe.bind(syncService),
    logEvent: syncService.logSyncEvent.bind(syncService),
    forceSync: syncService.forcSync.bind(syncService),
    getStatus: syncService.getSyncStatus.bind(syncService)
  };
};