/**
 * Enhanced Sync Service with Advanced Features
 * Implements conflict resolution, intelligent caching, and real-time analytics
 */
import { getSupabase, hasSupabaseConfig } from '../lib/supabase';
import { EventEmitter } from 'events';
class EnhancedSyncService extends EventEmitter {
    constructor() {
        super();
        this.subscriptions = new Map();
        this.cache = new Map();
        this.conflictQueue = [];
        this.metrics = {
            syncLatency: 0,
            conflictResolutions: 0,
            cacheHitRate: 0,
            errorRate: 0,
            throughput: 0
        };
        this.isOnline = navigator.onLine;
        this.retryQueue = [];
        this.initializeAdvancedFeatures();
    }
    initializeAdvancedFeatures() {
        // Network status monitoring
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.emit('networkStatusChanged', { online: true });
            this.processRetryQueue();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.emit('networkStatusChanged', { online: false });
        });
        // Periodic cache cleanup
        setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
        // Metrics collection
        setInterval(() => this.calculateMetrics(), 30 * 1000); // Every 30 seconds
    }
    /**
     * Enhanced subscription with conflict detection
     */
    async subscribeToTableChanges(tableName, callback, options = {}) {
        const startTime = Date.now();
        try {
            const supabase = await getSupabase();
            if (!supabase) {
                if (hasSupabaseConfig)
                    this.emit('syncError', { table: tableName, error: new Error('Supabase unavailable') });
                return;
            }
            const subscription = supabase
                .channel(`enhanced_${tableName}_changes`)
                .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: tableName,
            }, async (payload) => {
                const syncLatency = Date.now() - startTime;
                this.metrics.syncLatency = (this.metrics.syncLatency + syncLatency) / 2;
                if (options.enableConflictDetection) {
                    const conflict = await this.detectConflict(tableName, payload);
                    if (conflict) {
                        this.conflictQueue.push(conflict);
                        this.emit('conflictDetected', conflict);
                        return;
                    }
                }
                if (options.cacheStrategy && options.cacheStrategy !== 'none') {
                    this.updateCache(tableName, payload.new || payload.old, options.cacheStrategy);
                }
                callback(payload);
                this.emit('dataSync', { table: tableName, payload, latency: syncLatency });
            })
                .subscribe();
            this.subscriptions.set(tableName, subscription);
            this.emit('subscribed', { table: tableName, options });
        }
        catch (error) {
            this.metrics.errorRate++;
            this.emit('syncError', { table: tableName, error });
            if (options.retryOnError) {
                this.addToRetryQueue(() => this.subscribeToTableChanges(tableName, callback, options));
            }
        }
    }
    /**
     * Intelligent cache management
     */
    updateCache(key, data, strategy) {
        const ttl = strategy === 'aggressive' ? 30 * 60 * 1000 : 10 * 60 * 1000; // 30min or 10min
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
        return cached.data;
    }
    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Advanced conflict detection and resolution
     */
    async detectConflict(table, payload) {
        const cached = this.getFromCache(`${table}_${payload.new?.id || payload.old?.id}`);
        if (!cached)
            return null;
        // Check for concurrent edits
        if (payload.new && cached.updated_at && payload.new.updated_at) {
            const remoteUpdate = new Date(payload.new.updated_at);
            const cachedUpdate = new Date(cached.updated_at);
            if (Math.abs(remoteUpdate.getTime() - cachedUpdate.getTime()) < 5000) { // 5 second window
                return {
                    id: `conflict_${Date.now()}`,
                    table,
                    localData: cached,
                    remoteData: payload.new,
                    timestamp: new Date(),
                    conflictType: 'concurrent_edit'
                };
            }
        }
        return null;
    }
    /**
     * Automatic conflict resolution strategies
     */
    async resolveConflict(conflict, strategy) {
        this.metrics.conflictResolutions++;
        switch (strategy) {
            case 'newest_wins': {
                const localTime = new Date(conflict.localData.updated_at || 0).getTime();
                const remoteTime = new Date(conflict.remoteData.updated_at || 0).getTime();
                return remoteTime > localTime ? conflict.remoteData : conflict.localData;
            }
            case 'merge':
                return this.mergeConflictData(conflict.localData, conflict.remoteData);
            case 'manual':
                this.emit('manualResolutionRequired', conflict);
                return null;
        }
    }
    mergeConflictData(local, remote) {
        // Smart merge logic - prefer non-null values and newer timestamps
        const merged = { ...local };
        for (const [key, value] of Object.entries(remote)) {
            if (value !== null && value !== undefined) {
                if (key.includes('updated_at') || key.includes('timestamp')) {
                    // Keep newer timestamp
                    if (new Date(value) > new Date(merged[key] || 0)) {
                        merged[key] = value;
                    }
                }
                else if (merged[key] === null || merged[key] === undefined) {
                    // Fill in missing values
                    merged[key] = value;
                }
            }
        }
        return merged;
    }
    /**
     * Enhanced data fetching with caching and optimization
     */
    async fetchWithCache(query, cacheKey, options = {}) {
        const { ttl = 5 * 60 * 1000, forceRefresh = false, fallbackToCache = true } = options;
        // Check cache first
        if (!forceRefresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached)
                return cached;
        }
        try {
            const result = await query();
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now(),
                ttl
            });
            return result;
        }
        catch (error) {
            if (fallbackToCache) {
                const cached = this.cache.get(cacheKey);
                if (cached)
                    return cached.data;
            }
            throw error;
        }
    }
    /**
     * Batch operations for improved performance
     */
    async batchSync(operations) {
        const startTime = Date.now();
        const results = [];
        try {
            const supabase = await getSupabase();
            if (!supabase)
                throw new Error('Supabase unavailable');
            for (const op of operations) {
                let result;
                switch (op.operation) {
                    case 'insert':
                        result = await supabase.from(op.table).insert(op.data);
                        break;
                    case 'update':
                        result = await supabase.from(op.table).update(op.data).eq('id', op.data.id);
                        break;
                    case 'delete':
                        result = await supabase.from(op.table).delete().eq('id', op.data.id);
                        break;
                }
                results.push(result);
            }
            const batchTime = Date.now() - startTime;
            this.metrics.throughput = operations.length / (batchTime / 1000);
            this.emit('batchComplete', { operations: operations.length, time: batchTime });
            return results;
        }
        catch (error) {
            this.metrics.errorRate++;
            this.emit('batchError', { error, operations });
            throw error;
        }
    }
    /**
     * Retry queue for offline operations
     */
    addToRetryQueue(operation) {
        this.retryQueue.push({ operation, retries: 0 });
    }
    async processRetryQueue() {
        while (this.retryQueue.length > 0 && this.isOnline) {
            const item = this.retryQueue.shift();
            if (!item)
                break;
            try {
                await item.operation();
            }
            catch (error) {
                item.retries++;
                if (item.retries < 3) {
                    this.retryQueue.push(item);
                }
                else {
                    this.emit('retryFailed', { operation: item, error });
                }
            }
        }
    }
    /**
     * Real-time metrics calculation
     */
    calculateMetrics() {
        const cacheSize = this.cache.size;
        const conflictCount = this.conflictQueue.length;
        const subscriptionCount = this.subscriptions.size;
        this.emit('metricsUpdate', {
            ...this.metrics,
            cacheSize,
            conflictCount,
            subscriptionCount,
            isOnline: this.isOnline,
            retryQueueSize: this.retryQueue.length
        });
    }
    /**
     * Get current performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            conflictCount: this.conflictQueue.length,
            subscriptionCount: this.subscriptions.size,
            isOnline: this.isOnline
        };
    }
    /**
     * Manual refresh with optimizations
     */
    async manualRefresh(tables = []) {
        const startTime = Date.now();
        try {
            if (tables.length === 0) {
                // Refresh all subscriptions
                for (const [tableName] of this.subscriptions) {
                    await this.refreshTable(tableName);
                }
            }
            else {
                // Refresh specific tables
                for (const tableName of tables) {
                    await this.refreshTable(tableName);
                }
            }
            const refreshTime = Date.now() - startTime;
            this.emit('manualRefreshComplete', { tables, time: refreshTime });
        }
        catch (error) {
            this.emit('manualRefreshError', { tables, error });
            throw error;
        }
    }
    async refreshTable(tableName) {
        // Invalidate cache for this table
        for (const [key] of this.cache) {
            if (key.startsWith(tableName)) {
                this.cache.delete(key);
            }
        }
        // Trigger data refetch
        this.emit('tableRefresh', { table: tableName });
    }
    /**
     * Enhanced cleanup
     */
    async cleanup() {
        // Clean up subscriptions
        for (const [, subscription] of this.subscriptions) {
            await subscription.unsubscribe();
        }
        this.subscriptions.clear();
        // Clear cache
        this.cache.clear();
        // Clear conflict queue
        this.conflictQueue = [];
        // Clear retry queue
        this.retryQueue = [];
        this.emit('cleanupComplete');
    }
}
// Export singleton instance
export const enhancedSyncService = new EnhancedSyncService();
export default enhancedSyncService;
