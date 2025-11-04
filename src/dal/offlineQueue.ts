// Thin DAL facade over offline queue utilities to keep UI off services/
export type { OfflineQueueItem, OfflineQueuePriority, ProcessResult } from '../services/offlineQueue';
export {
  initializeOfflineQueue,
  getOfflineQueueSnapshot,
  subscribeOfflineQueue,
  setQueueFullHandler,
  setStorageErrorHandler,
  enqueueOfflineItem,
  enqueueProgressSnapshot,
  processOfflineQueue,
  hasPendingItems,
  clearOfflineQueue,
  removeOfflineItem,
} from '../services/offlineQueue';
