const createProgressBucket = () => ({
  success: 0,
  error: 0,
  avgDurationMs: 0,
  sources: {},
  lastEvent: null,
});

const courseProgressMetrics = createProgressBucket();
const lessonProgressMetrics = createProgressBucket();

const supabaseHealthMetrics = {
  lastStatus: 'unknown',
  lastLatencyMs: null,
  lastMessage: null,
  checkedAt: null,
  consecutiveErrors: 0,
};

const updateProgressBucket = (bucket, source, durationMs, status, meta = {}) => {
  const totalBefore = bucket.success + bucket.error;
  const nextCount = totalBefore + 1;
  const safeDuration = Number.isFinite(durationMs) ? durationMs : 0;
  bucket.avgDurationMs = Number((((bucket.avgDurationMs * totalBefore) + safeDuration) / Math.max(nextCount, 1)).toFixed(2));
  if (status === 'error') {
    bucket.error += 1;
  } else {
    bucket.success += 1;
  }
  if (source) {
    bucket.sources[source] = (bucket.sources[source] || 0) + 1;
  }
  bucket.lastEvent = {
    ...meta,
    status,
    source,
    durationMs: safeDuration,
    at: new Date().toISOString(),
  };
};

export const recordCourseProgress = (source, durationMs, meta = {}) => {
  const { userId = null, courseId = null, percent = null, status = 'success', message = null } = meta;
  updateProgressBucket(courseProgressMetrics, source, durationMs, status, { userId, courseId, percent, message });
};

export const recordLessonProgress = (source, durationMs, meta = {}) => {
  const { userId = null, lessonId = null, percent = null, status = 'success', message = null } = meta;
  updateProgressBucket(lessonProgressMetrics, source, durationMs, status, { userId, lessonId, percent, message });
};

export const recordSupabaseHealth = (status, latencyMs = null, message = null) => {
  if (status === 'error') {
    supabaseHealthMetrics.consecutiveErrors += 1;
  } else if (status === 'ok') {
    supabaseHealthMetrics.consecutiveErrors = 0;
  }
  supabaseHealthMetrics.lastStatus = status;
  supabaseHealthMetrics.lastLatencyMs = latencyMs;
  supabaseHealthMetrics.lastMessage = message;
  supabaseHealthMetrics.checkedAt = new Date().toISOString();
};

export const getMetricsSnapshot = (extras = {}) => ({
  generatedAt: new Date().toISOString(),
  uptimeSeconds: Number(process.uptime().toFixed(2)),
  courseProgress: JSON.parse(JSON.stringify(courseProgressMetrics)),
  lessonProgress: JSON.parse(JSON.stringify(lessonProgressMetrics)),
  supabase: { ...supabaseHealthMetrics },
  ...extras,
});
