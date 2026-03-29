/**
 * Minimal diagnostics metrics implementation to keep production safe.
 * All methods are no-ops so the server boots even when the optional metrics
 * pipeline is not installed.
 */

export const getMetricsSnapshot = () => ({
  analyticsIngest: { lastBatch: null, status: 'unknown' },
  progressBatch: { lastSuccessAt: null, status: 'unknown' },
});

export const recordCourseProgress = () => {};
export const recordLessonProgress = () => {};
export const recordProgressBatch = () => {};
export const recordSupabaseHealth = () => {};

export default {
  getMetricsSnapshot,
  recordCourseProgress,
  recordLessonProgress,
  recordProgressBatch,
  recordSupabaseHealth,
};
