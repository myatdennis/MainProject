import { courseStore } from '../store/courseStore';
import { getSupabase } from '../lib/supabase';
import { CourseValidationError } from './courseService';
import { wsClient } from './wsClient';
const normalizeAssignmentStatus = (status) => {
    if (status === 'in-progress' || status === 'completed') {
        return status;
    }
    return 'assigned';
};
const mapAssignmentFromSupabase = (record) => ({
    id: record?.id,
    courseId: record?.course_id,
    userId: (record?.user_id || '').toLowerCase(),
    status: normalizeAssignmentStatus(record?.status),
    progress: Number.isFinite(record?.progress) ? Number(record.progress) : 0,
    dueDate: record?.due_date ?? null,
    note: record?.note ?? null,
    assignedBy: record?.assigned_by ?? null,
    createdAt: record?.created_at || new Date().toISOString(),
    updatedAt: record?.updated_at || new Date().toISOString(),
});
class SyncService {
    constructor() {
        this.subscribers = {};
        this.syncInterval = null;
        this.lastSyncTime = 0;
        this.isOnline = navigator.onLine;
        this.pendingSync = [];
        this.eventLog = [];
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
        // Initialize WebSocket client if configured (fast realtime fallback)
        try {
            if (import.meta.env.VITE_WS_URL) {
                wsClient.connect();
                // Map incoming WS events to local emitters
                wsClient.on('event', (payload) => {
                    const t = payload.type;
                    const d = payload.data;
                    switch (t) {
                        case 'assignment_created':
                        case 'assignment_updated':
                        case 'assignment_deleted':
                            this.emit(t, d);
                            break;
                        case 'user_progress':
                            this.emit('user_progress', { progress: d, userId: d.user_id, timestamp: Date.now(), source: 'client' });
                            break;
                        case 'course_updated':
                        case 'course_created':
                        case 'course_deleted':
                            this.emit(t, { course: d, courseId: d?.id, timestamp: Date.now(), source: 'admin' });
                            break;
                        default:
                            this.emit('ws_event', payload);
                    }
                });
                wsClient.on('open', () => {
                    // optionally subscribe to org-specific channels after auth
                    this.emit('ws_connected', { timestamp: Date.now() });
                });
                wsClient.on('close', () => this.emit('ws_disconnected', { timestamp: Date.now() }));
            }
        }
        catch (err) {
            console.warn('WS client initialization failed', err);
        }
    }
    // Initialize real-time Supabase synchronization
    async initializeRealtimeSync() {
        // Only set up real-time sync if Supabase is configured
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
            console.log('Supabase not configured - using polling sync only');
            return;
        }
        try {
            const supabase = await getSupabase();
            if (!supabase) {
                console.log('Supabase client not available for realtime sync');
                return;
            }
            // Listen for course changes
            supabase
                .channel('course_changes')
                .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'courses'
            }, (payload) => {
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
            }, (payload) => {
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
            }, (payload) => {
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
            // Listen for assignment changes
            supabase
                .channel('assignment_changes')
                .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'course_assignments'
            }, (payload) => {
                console.log('Real-time assignment change detected:', payload);
                const record = payload.new || payload.old;
                if (!record)
                    return;
                const eventType = payload.eventType === 'DELETE'
                    ? 'assignment_deleted'
                    : payload.eventType === 'UPDATE'
                        ? 'assignment_updated'
                        : 'assignment_created';
                const assignment = mapAssignmentFromSupabase(record);
                this.emit(eventType, assignment);
            })
                .subscribe();
            // Listen for user progress changes
            supabase
                .channel('progress_changes')
                .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_lesson_progress'
            }, (payload) => {
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
        }
        catch (error) {
            console.error('Failed to initialize real-time sync:', error);
        }
    }
    // Helper method to get course ID for a lesson
    async getLessonCourseId(moduleId) {
        if (!moduleId)
            return null;
        try {
            const supabase = await getSupabase();
            if (!supabase)
                return null;
            const { data } = await supabase
                .from('modules')
                .select('course_id')
                .eq('id', moduleId)
                .single();
            return data?.course_id || null;
        }
        catch (error) {
            console.error('Error getting course ID for module:', moduleId, error);
            return null;
        }
    }
    // Subscribe to real-time updates
    subscribe(eventType, callback) {
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
    emit(eventType, data) {
        if (this.subscribers[eventType]) {
            this.subscribers[eventType].forEach(callback => callback(data));
        }
    }
    // Manual refresh methods for immediate sync
    async refreshCourse(courseId) {
        try {
            console.log('Manual course refresh triggered:', courseId);
            // If Supabase is configured, fetch from database
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                const supabase = await getSupabase();
                if (!supabase)
                    throw new Error('Supabase unavailable');
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
                if (error)
                    throw error;
                // Emit course updated event
                this.emit('course_updated', {
                    course,
                    courseId,
                    timestamp: Date.now(),
                    source: 'admin',
                    manual: true
                });
            }
            else {
                // Fallback to client-side refresh
                await courseStore.init();
                this.emit('course_updated', {
                    courseId,
                    timestamp: Date.now(),
                    source: 'admin',
                    manual: true
                });
            }
            console.log('Course refresh completed:', courseId);
        }
        catch (error) {
            console.error('Error refreshing course:', courseId, error);
            throw error;
        }
    }
    async refreshAll() {
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
        }
        catch (error) {
            console.error('Error during global refresh:', error);
            throw error;
        }
    }
    // Subscribe to specific course updates
    subscribeToCourseUpdates(callback) {
        return this.subscribe('course_updated', callback);
    }
    // Subscribe to user progress updates
    subscribeToUserProgress(callback) {
        return this.subscribe('user_progress', callback);
    }
    // Subscribe to all refresh events
    subscribeToRefresh(callback) {
        return this.subscribe('refresh_all', callback);
    }
    // Start periodic sync
    startSync() {
        if (this.syncInterval)
            return;
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
    async syncWithRemote() {
        try {
            // In a real implementation, this would call your backend API
            // For now, we'll simulate checking for updates from the in-memory event log
            const remoteData = this.checkForRemoteUpdates();
            if (remoteData.length > 0) {
                remoteData.forEach(update => {
                    this.handleRemoteUpdate(update);
                });
            }
        }
        catch (error) {
            console.error('Sync failed:', error);
        }
    }
    // Simulate checking for remote updates
    checkForRemoteUpdates() {
        const newEvents = this.eventLog.filter(event => event.timestamp > this.lastSyncTime);
        if (newEvents.length > 0) {
            this.lastSyncTime = Math.max(...newEvents.map((e) => e.timestamp));
        }
        return newEvents;
    }
    // Handle remote updates
    handleRemoteUpdate(event) {
        switch (event.type) {
            case 'course_updated':
                try {
                    courseStore.saveCourse(event.data, { skipRemoteSync: true });
                }
                catch (error) {
                    if (error instanceof CourseValidationError) {
                        console.warn('Remote update skipped due to validation issues:', error.issues);
                    }
                    else {
                        console.warn('Failed to apply remote course update', error);
                    }
                }
                this.emit('course_updated', event.data);
                break;
            case 'course_created':
                try {
                    courseStore.saveCourse(event.data, { skipRemoteSync: true });
                }
                catch (error) {
                    if (error instanceof CourseValidationError) {
                        console.warn('Remote course creation skipped due to validation issues:', error.issues);
                    }
                    else {
                        console.warn('Failed to add remote course', error);
                    }
                }
                this.emit('course_created', event.data);
                break;
            case 'course_deleted':
                courseStore.deleteCourse(event.data.id);
                this.emit('course_deleted', event.data);
                break;
            case 'user_progress':
                this.emit('user_progress', event.data);
                break;
            case 'assignment_created':
            case 'assignment_updated':
            case 'assignment_deleted':
                this.emit(event.type, event.data);
                break;
        }
    }
    // Log sync events
    logSyncEvent(event) {
        const enrichedEvent = {
            ...event,
            timestamp: Date.now()
        };
        this.eventLog.push(enrichedEvent);
        this.eventLog = this.eventLog.slice(-100);
        if (this.isOnline) {
            this.emit(enrichedEvent.type, enrichedEvent.data);
        }
        else {
            this.pendingSync.push(enrichedEvent);
        }
    }
    // Process pending sync events when coming back online
    processPendingSync() {
        if (this.pendingSync.length === 0)
            return;
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
