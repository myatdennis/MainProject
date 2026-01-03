// (Removed initial lightweight dev server stub in favor of the full server below)
import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import {
  moduleCreateSchema,
  modulePatchSchema as modulePatchValidator,
  lessonCreateSchema,
  lessonPatchSchema as lessonPatchValidator,
  moduleReorderSchema,
  lessonReorderSchema,
  pickId,
  pickOrder,
  validateOr400,
  courseUpsertSchema,
} from './validators.js';
import { logger } from './lib/logger.js';
import {
  recordCourseProgress,
  recordLessonProgress,
  recordSupabaseHealth,
  getMetricsSnapshot,
} from './diagnostics/metrics.js';

// Import auth routes and middleware
import authRoutes from './routes/auth.js';
import adminAnalyticsRoutes from './routes/admin-analytics.js';
import adminAnalyticsExport from './routes/admin-analytics-export.js';
import adminAnalyticsSummary from './routes/admin-analytics-summary.js';
import {
  apiLimiter,
  securityHeaders,
  authenticate,
  requireAdmin,
  optionalAuthenticate,
} from './middleware/auth.js';
import { setDoubleSubmitCSRF, getCSRFToken } from './middleware/csrf.js';
import adminUsersRouter from './routes/admin-users.js';
import mfaRoutes from './routes/mfa.js';
import { attachRequestId, apiErrorHandler, createHttpError, withHttpError } from './middleware/apiErrorHandler.js';
import adminCoursesRouter from './routes/admin-courses.js';
import {
  NODE_ENV,
  isProduction,
  DEV_FALLBACK,
  E2E_TEST_MODE,
  demoLoginEnabled,
  describeDemoMode,
} from './config/runtimeFlags.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent storage file for demo mode
const STORAGE_FILE = path.join(__dirname, 'demo-data.json');
// Safety guard to avoid loading extremely large demo files that could trigger OOM (exit 137)
const MAX_DEMO_FILE_BYTES = parseInt(process.env.DEMO_DATA_MAX_BYTES || '', 10) || 25 * 1024 * 1024; // 25MB default

const initialDemoModeMetadata = describeDemoMode();
logger.info('demo_mode_configuration', { metadata: initialDemoModeMetadata });

const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'course-resources';
const DOCUMENT_UPLOAD_MAX_BYTES = Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const DOCUMENT_URL_TTL_SECONDS = Number(process.env.DOCUMENT_SIGN_TTL_SECONDS || 60 * 60 * 24 * 7);
const DOCUMENT_URL_REFRESH_BUFFER_SECONDS = Number(process.env.DOCUMENT_URL_REFRESH_BUFFER_SECONDS || 60 * 5);
const DOCUMENT_URL_REFRESH_BUFFER_MS = DOCUMENT_URL_REFRESH_BUFFER_SECONDS * 1000;
const COURSE_VIDEOS_BUCKET = process.env.SUPABASE_VIDEOS_BUCKET || 'course-videos';
const COURSE_VIDEO_UPLOAD_MAX_BYTES = Number(process.env.COURSE_VIDEO_UPLOAD_MAX_BYTES || 100 * 1024 * 1024);
const REQUIRED_SUPABASE_BUCKETS = Array.from(new Set([COURSE_VIDEOS_BUCKET, DOCUMENTS_BUCKET].filter(Boolean)));

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number.isFinite(DOCUMENT_UPLOAD_MAX_BYTES) ? DOCUMENT_UPLOAD_MAX_BYTES : 25 * 1024 * 1024,
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number.isFinite(COURSE_VIDEO_UPLOAD_MAX_BYTES) ? COURSE_VIDEO_UPLOAD_MAX_BYTES : 50 * 1024 * 1024,
  },
});

// Helper functions for persistent storage
function loadPersistedData() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      try {
        const stat = fs.statSync(STORAGE_FILE);
        if (stat.size > MAX_DEMO_FILE_BYTES) {
          logger.warn('demo_data_file_too_large', { bytes: stat.size, maxBytes: MAX_DEMO_FILE_BYTES });
          return { courses: [], surveys: [], surveyAssignments: [] };
        }
      } catch {}
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('demo_data_load_failed', { error: error instanceof Error ? error.message : error });
  }
  return { courses: new Map(), modules: new Map(), lessons: new Map(), surveys: new Map(), surveyAssignments: new Map() };
}

function savePersistedData(data) {
  try {
    // Convert Maps to arrays for JSON serialization
    // Modules and lessons are nested inside courses, not separate Maps
    const serializable = {
      courses: Array.from(data.courses.entries()),
      surveys: Array.from((data.surveys || new Map()).entries()),
      surveyAssignments: Array.from((data.surveyAssignments || new Map()).entries()),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(serializable, null, 2), 'utf8');
    logger.info('demo_data_persisted', { courseCount: data.courses.size, storageFile: STORAGE_FILE });
  } catch (error) {
    logger.error('demo_data_save_failed', { error: error instanceof Error ? error.message : error });
  }
}

const app = express();

const rawAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS || '';
const extraAllowedOrigins = rawAllowedOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  'https://the-huddle.co',
  'https://www.the-huddle.co',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...extraAllowedOrigins]));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isLocalDevOrigin = origin && origin.startsWith('http://localhost');
  const isLoopback = origin && origin.startsWith('http://127.');
  const isAllowed = origin && allowedOrigins.includes(origin);

  if (origin && (isAllowed || (!isProduction && (isLocalDevOrigin || isLoopback)))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (!origin && !isProduction) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, X-User-Id, X-User-Role, X-Org-Id, X-CSRF-Token, Accept'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Attach request ids early so health/diagnostics endpoints can include them even before
// the rest of the middleware stack (body parsers, auth, etc.) runs.
app.use(attachRequestId);

const OFFLINE_QUEUE_STATE_FILE = process.env.OFFLINE_QUEUE_STATE_FILE
  ? path.resolve(process.env.OFFLINE_QUEUE_STATE_FILE)
  : path.join(__dirname, 'diagnostics', 'offline-queue.json');
const OFFLINE_QUEUE_WARN_AT = Number(process.env.OFFLINE_QUEUE_WARN_AT || 50);

const readOfflineQueueBacklog = () => {
  try {
    if (process.env.OFFLINE_QUEUE_BACKLOG) {
      const envValue = Number(process.env.OFFLINE_QUEUE_BACKLOG);
      if (!Number.isNaN(envValue)) {
        return envValue;
      }
    }

    if (!fs.existsSync(OFFLINE_QUEUE_STATE_FILE)) {
      return 0;
    }

    const raw = JSON.parse(fs.readFileSync(OFFLINE_QUEUE_STATE_FILE, 'utf8'));
    if (typeof raw?.backlog === 'number') {
      return raw.backlog;
    }
    if (Array.isArray(raw?.items)) {
      return raw.items.length;
    }
    if (Array.isArray(raw?.queue)) {
      return raw.queue.length;
    }
    return 0;
  } catch (error) {
    console.warn('[health] Failed to read offline queue snapshot:', error);
    return -1;
  }
};

const getOfflineQueueHealth = () => {
  const backlog = readOfflineQueueBacklog();
  if (backlog < 0) {
    return { status: 'warn', backlog: null, message: 'Unable to read offline queue snapshot' };
  }
  return {
    status: backlog > OFFLINE_QUEUE_WARN_AT ? 'warn' : 'ok',
    backlog,
  };
};

const getSupabaseBucketHealth = async () => {
  if (REQUIRED_SUPABASE_BUCKETS.length === 0) {
    return { status: 'disabled', provider: 'supabase', message: 'No Supabase storage buckets configured' };
  }
  if (!supabase) {
    return {
      status: 'warn',
      provider: 'supabase',
      missingBuckets: REQUIRED_SUPABASE_BUCKETS,
      message: 'Supabase client unavailable for bucket verification',
    };
  }
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const missingBuckets = REQUIRED_SUPABASE_BUCKETS.filter(
      (bucket) => !(data || []).some((entry) => entry.name === bucket),
    );
    if (missingBuckets.length > 0) {
      return {
        status: 'warn',
        provider: 'supabase',
        buckets: REQUIRED_SUPABASE_BUCKETS,
        missingBuckets,
      };
    }
    return { status: 'ok', provider: 'supabase', buckets: REQUIRED_SUPABASE_BUCKETS };
  } catch (error) {
    return {
      status: 'warn',
      provider: 'supabase',
      buckets: REQUIRED_SUPABASE_BUCKETS,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const getStorageHealth = async () => {
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || null;
  const hasKeys = Boolean(
    (process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID) &&
      (process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY)
  );

  if (!bucket && !hasKeys) {
    return getSupabaseBucketHealth();
  }

  const missing = [];
  if (!bucket) missing.push('bucket');
  if (!hasKeys) missing.push('credentials');

  if (missing.length > 0) {
    return { status: 'warn', provider: 's3', missing, bucket: bucket ?? undefined };
  }

  return { status: 'ok', provider: 's3', bucket };
};

const buildHealthPayload = async () => {
  const supabaseStatus = await checkSupabaseHealth();
  const offlineQueue = getOfflineQueueHealth();
  const storage = await getStorageHealth();
  const metrics = getMetricsSnapshot({ offlineQueue, storage });
  const demoModeMetadata = describeDemoMode();
  const supabaseDisabled = supabaseStatus.status === 'disabled' || missingSupabaseEnvVars.length > 0;
  const supabaseOk = supabaseStatus.status === 'ok';
  const offlineQueueOk = offlineQueue.status === 'ok';
  const storageOk = storage.status === 'ok' || storage.status === 'disabled';

  const baseHealthy = supabaseOk && offlineQueueOk && storageOk && !supabaseDisabled;
  const demoModeHealthOverride = (!supabase || supabaseDisabled) && demoLoginEnabled;
  const healthy = baseHealthy || demoModeHealthOverride;
  const httpStatus = healthy ? 200 : 503;
  const statusLabel = baseHealthy ? 'ok' : demoModeHealthOverride ? 'demo-fallback' : 'degraded';

  return {
    httpStatus,
    body: {
      healthy,
      status: statusLabel,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || null,
      supabase: {
        ...supabaseStatus,
        missingEnvVars: missingSupabaseEnvVars,
        disabled: supabaseDisabled,
      },
      offlineQueue,
      storage,
      metrics,
      demoModeHealthOverride,
      demoMode: demoModeMetadata,
    },
  };
};

const respondToHealthRequest = async (req, res) => {
  try {
    const payload = await buildHealthPayload();
    const ok = payload.httpStatus === 200;
    res.status(payload.httpStatus).json({ ok, ...payload.body, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    logger.error('health_check_failed', {
      requestId: req.requestId,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(503).json({
      ok: false,
      healthy: false,
      status: 'error',
      message,
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      requestId: req.requestId,
    });
  }
};

app.get('/api/health', (req, res) => {
  void respondToHealthRequest(req, res);
});

app.get('/healthz', (req, res) => {
  void respondToHealthRequest(req, res);
});

app.get('/api/diagnostics/metrics', async (req, res, next) => {
  try {
    const snapshot = getMetricsSnapshot({
      offlineQueue: getOfflineQueueHealth(),
      storage: await getStorageHealth(),
    });
    res.json({ data: snapshot, requestId: req.requestId });
  } catch (error) {
    next(withHttpError(error, 500, 'metrics_snapshot_failed'));
  }
});

// When running behind a reverse proxy (Netlify, Vercel, Cloudflare, Railway),
// Express needs to trust proxy headers so req.secure reflects X-Forwarded-Proto.
// Enabling trust proxy ensures middleware and HSTS headers can operate correctly.
if (isProduction) {
  app.set('trust proxy', 1);
}
const PORT = process.env.PORT || 8888;
logger.info('server_port', { port: PORT });

app.use(express.json({ limit: '10mb' }));

// Security middleware
app.use(cookieParser());
app.use(securityHeaders);
app.use(setDoubleSubmitCSRF);

// Expose CSRF token endpoint for clients and scripts that use the double-submit cookie pattern
app.get('/api/auth/csrf', getCSRFToken);

// Dev fallback: allow in-memory server behavior when Supabase isn't configured.
// Enabled by default in non-production unless DEV_FALLBACK=false is set.

logger.info('diagnostics_cookies_and_cors', {
  allowedOrigins,
  cookieDomain: process.env.COOKIE_DOMAIN || null,
  cookieSameSite: process.env.COOKIE_SAMESITE || null,
});

const isAllowedOrigin = (origin) => {
  if (!origin) return !isProduction;
  if (allowedOrigins.includes(origin)) return true;
  if (!isProduction && (origin.startsWith('http://localhost') || origin.startsWith('http://127.'))) {
    return true;
  }
  return false;
};

// Basic request logging with request_id and timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const requestId = req.requestId || '-';
    logger.info('http_request_completed', {
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs: ms,
      requestId,
    });
  });
  next();
});

// Normalize server errors so they flow through the centralized handler
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && !res.headersSent) {
      const code = body && typeof body.error === 'string' ? body.error : 'server_error';
      const message = body && typeof body.message === 'string' ? body.message : undefined;
      const err = createHttpError(res.statusCode, code, message);
      return next(err);
    }
    return originalJson(body);
  };
  next();
});

// Optional: Enforce HTTPS in production when explicitly requested. This helps
// avoid SSL errors arising from proxy or DNS misconfiguration where requests
// arrive over HTTP on the host, but the public site expects HTTPS.
if (process.env.ENFORCE_HTTPS === 'true' && process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // If request was forwarded over HTTP by an upstream proxy, redirect.
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      const host = req.headers.host || '';
      const url = `https://${host}${req.originalUrl}`;
      return res.redirect(301, url);
    }
    next();
  });
}

// Optional periodic memory usage logging (enable with LOG_MEMORY=true)
if ((process.env.LOG_MEMORY || '').toLowerCase() === 'true') {
  setInterval(() => {
    const mu = process.memoryUsage();
    const fmt = (n) => (n / 1e6).toFixed(1);
    console.log(`[mem] rss=${fmt(mu.rss)}MB heapUsed=${fmt(mu.heapUsed)}MB heapTotal=${fmt(mu.heapTotal)}MB ext=${fmt(mu.external)}MB`);
  }, 30000);
}

// Text content endpoints used by the content editor (local file-backed)
const contentPath = path.join(__dirname, '../src/content/textContent.json');

app.get('/api/text-content', (_req, res, next) => {
  fs.readFile(contentPath, 'utf8', (err, data) => {
    if (err) {
      return next(createHttpError(500, 'text_content_load_failed', 'Failed to load content'));
    }
    try {
      const obj = JSON.parse(data);
      const items = Object.entries(obj).map(([key, value]) => ({ key, value }));
      res.json(items);
    } catch (e) {
      next(createHttpError(500, 'text_content_invalid', 'Invalid content JSON'));
    }
  });
});

app.put('/api/text-content', (req, res, next) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const contentJson = {};
  for (const item of items) {
    if (item && typeof item.key === 'string') {
      contentJson[item.key] = item.value;
    }
  }
  fs.writeFile(contentPath, JSON.stringify(contentJson, null, 2), (err) => {
    if (err) {
      return next(createHttpError(500, 'text_content_save_failed', 'Failed to save content'));
    }
    res.json({ success: true });
  });
});

app.get('/api/debug/whoami', authenticate, (req, res) => {
  res.json({
    ok: true,
    user: req.user || null,
  });
});

// Auth routes (login, register, refresh, logout)
app.use('/api/auth', authRoutes);
// MFA routes
app.use('/api/mfa', mfaRoutes);

// Enforce authentication + admin role on every /api/admin/* route before specific routers/handlers
app.use('/api/admin', authenticate, requireAdmin);

// Admin analytics endpoints (aggregates, exports, AI summary)
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/analytics/export', adminAnalyticsExport);
app.use('/api/admin/analytics/summary', adminAnalyticsSummary);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/courses', authenticate, requireAdmin, adminCoursesRouter);

// Honor explicit E2E test mode in child processes: when E2E_TEST_MODE is set we prefer the
// in-memory demo fallback even if Supabase credentials are present in the environment.

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const missingSupabaseEnvVars = [];
if (!supabaseUrl) missingSupabaseEnvVars.push('SUPABASE_URL or VITE_SUPABASE_URL');
if (!supabaseServiceRoleKey) missingSupabaseEnvVars.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');

// Log Supabase configuration for diagnostics
logger.info('diagnostics_supabase_env', {
  supabaseUrl: supabaseUrl || null,
  hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
});

let supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;
if (E2E_TEST_MODE) {
  console.log('[server] Running in E2E_TEST_MODE - ignoring Supabase credentials and using in-memory fallback');
  supabase = null;
}
let loggedMissingSupabaseConfig = false;

const checkSupabaseHealth = async () => {
  if (!supabase) {
    recordSupabaseHealth('disabled');
    return { status: 'disabled' };
  }
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const { error } = await supabase
      .from('courses')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
      .abortSignal(controller.signal);
    if (error) throw error;
    const latencyMs = Date.now() - start;
    recordSupabaseHealth('ok', latencyMs);
    return { status: 'ok', latencyMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Supabase error';
    const latencyMs = Date.now() - start;
    recordSupabaseHealth('error', latencyMs, message);
    logger.warn('supabase_health_failed', { message, latencyMs });
    return { status: 'error', latencyMs, message };
  } finally {
    clearTimeout(timeout);
  }
};

// Load persisted data if available
const persistedData = loadPersistedData();

const e2eStore = {
  courses: new Map(persistedData.courses || []), // id -> { id, slug, title, description, status, version, published_at, meta_json, modules: [{ id, title, description, order_index, lessons: [...] }] }
  assignments: [],
  courseProgress: new Map(), // key `${user_id}:${course_id}` -> { user_id, course_id, percent, status, time_spent_s, updated_at }
  lessonProgress: new Map(), // key `${user_id}:${lesson_id}` -> { user_id, lesson_id, percent, status, time_spent_s, resume_at_s, updated_at }
  progressEvents: new Set(), // idempotency keys (client_event_id)
  // generic idempotency keys for demo mode: map of id -> resourceId|null
  // null indicates the key was reserved/in-flight; a string value indicates the resource id produced
  idempotencyKeys: {},
  analyticsEvents: [], // stored analytics events in demo/E2E mode
  learnerJourneys: new Map(), // key `${user_id}:${course_id}` -> snapshot for demo mode
  surveys: new Map(persistedData.surveys || []),
  surveyAssignments: new Map(persistedData.surveyAssignments || []),
  auditLogs: [],
};

const clampPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const coerceString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const coerceNumber = (...values) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const deepClone = (value) => {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
};

const coerceIdArray = (raw) => {
  if (raw === null || raw === undefined) return [];
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? raw.split(',')
    : [raw];
  const normalized = list
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'number') return String(item);
      if (item && typeof item === 'object') {
        return coerceString(item.id, item.value, item.code) ?? undefined;
      }
      return undefined;
    })
    .filter((item) => typeof item === 'string' && item.length > 0);
  return Array.from(new Set(normalized));
};

const createEmptyAssignedTo = () => ({
  organizationIds: [],
  userIds: [],
  cohortIds: [],
  departmentIds: [],
});

const normalizeAssignedTargets = (payload = {}) => {
  const source =
    payload && typeof payload.assignedTo === 'object'
      ? payload.assignedTo
      : payload && typeof payload.assigned_to === 'object'
      ? payload.assigned_to
      : payload;

  const assignedTo = createEmptyAssignedTo();
  assignedTo.organizationIds = coerceIdArray(
    payload.organizationIds ?? payload.organization_ids ?? source?.organizationIds ?? source?.organization_ids,
  );
  assignedTo.userIds = coerceIdArray(source?.userIds ?? source?.user_ids);
  assignedTo.cohortIds = coerceIdArray(source?.cohortIds ?? source?.cohort_ids);
  assignedTo.departmentIds = coerceIdArray(
    payload.departmentIds ?? payload.department_ids ?? source?.departmentIds ?? source?.department_ids,
  );

  return {
    assignedTo,
    organizationIds: assignedTo.organizationIds,
    userIds: assignedTo.userIds,
    cohortIds: assignedTo.cohortIds,
    departmentIds: assignedTo.departmentIds,
  };
};

const applyAssignmentToSurvey = (survey, assignmentRecord) => {
  if (!survey) return survey;
  const fallback = normalizeAssignedTargets({ assignedTo: survey.assignedTo ?? survey.assigned_to }).assignedTo;
  const normalized = {
    ...createEmptyAssignedTo(),
    ...fallback,
  };

  if (assignmentRecord) {
    normalized.organizationIds = coerceIdArray(assignmentRecord.organization_ids);
    normalized.userIds = coerceIdArray(assignmentRecord.user_ids);
    normalized.cohortIds = coerceIdArray(assignmentRecord.cohort_ids);
    normalized.departmentIds = coerceIdArray(assignmentRecord.department_ids);
  }

  return {
    ...survey,
    assignedTo: normalized,
    assigned_to: normalized,
  };
};

const buildDefaultSurveyCompletionSettings = () => ({
  thankYouMessage: 'Thank you for completing our survey!',
  showResources: false,
  recommendedCourses: [],
});

const hasAssignmentPayload = (payload = {}) =>
  Object.prototype.hasOwnProperty.call(payload, 'assignedTo') ||
  Object.prototype.hasOwnProperty.call(payload, 'assigned_to') ||
  Object.prototype.hasOwnProperty.call(payload, 'organizationIds') ||
  Object.prototype.hasOwnProperty.call(payload, 'organization_ids') ||
  Object.prototype.hasOwnProperty.call(payload, 'userIds') ||
  Object.prototype.hasOwnProperty.call(payload, 'user_ids') ||
  Object.prototype.hasOwnProperty.call(payload, 'cohortIds') ||
  Object.prototype.hasOwnProperty.call(payload, 'cohort_ids') ||
  Object.prototype.hasOwnProperty.call(payload, 'departmentIds') ||
  Object.prototype.hasOwnProperty.call(payload, 'department_ids');

const buildSurveyPersistencePayload = (payload = {}) => {
  const shaped = {
    id: payload.id ?? undefined,
    title: payload.title,
    description: payload.description ?? null,
    type: payload.type ?? null,
    status: payload.status ?? 'draft',
    sections: payload.sections ?? [],
    blocks: payload.blocks ?? [],
    branding: payload.branding ?? {},
    settings: payload.settings ?? {},
    default_language: payload.defaultLanguage ?? payload.default_language ?? 'en',
    supported_languages: payload.supportedLanguages ?? payload.supported_languages ?? ['en'],
    completion_settings: payload.completionSettings ?? payload.completion_settings ?? buildDefaultSurveyCompletionSettings(),
    reflection_prompts: payload.reflectionPrompts ?? payload.reflection_prompts ?? [],
    updated_at: new Date().toISOString(),
  };

  return shaped;
};

const DEMO_SURVEY_SEED = [
  {
    id: 'pulse-2025',
    title: '2025 DEI Pulse Check',
    description: 'Quick quarterly sentiment survey for the leadership cohort.',
    type: 'pulse-check',
    status: 'published',
    organizationIds: ['org-huddle'],
  },
  {
    id: 'climate-2025-q1',
    title: 'Q1 2025 Climate Assessment',
    description: 'Quarterly organizational climate and culture assessment',
    type: 'climate-assessment',
    status: 'active',
    organizationIds: ['1', '4', '5'],
  },
  {
    id: 'inclusion-index-2025',
    title: 'Annual Inclusion Index',
    description: 'Comprehensive inclusion measurement with benchmarking',
    type: 'inclusion-index',
    status: 'draft',
    organizationIds: [],
  },
  {
    id: 'equity-lens-pilot',
    title: 'Equity Lens Pilot Study',
    description: 'Pilot assessment of equity in organizational practices',
    type: 'equity-lens',
    status: 'completed',
    organizationIds: ['3', '2'],
  },
  {
    id: 'leadership-360',
    title: 'Leadership 360 Assessment',
    description: 'Multi-rater feedback for inclusive leadership development',
    type: 'custom',
    status: 'paused',
    organizationIds: ['1'],
  },
];

const ensureDemoSurveysSeeded = () => {
  let changed = false;
  for (const seed of DEMO_SURVEY_SEED) {
    if (e2eStore.surveys.has(seed.id)) continue;
    const assignedTo = createEmptyAssignedTo();
    assignedTo.organizationIds = [...(seed.organizationIds || [])];
    const now = new Date().toISOString();
    const record = {
      id: seed.id,
      title: seed.title,
      description: seed.description,
      type: seed.type,
      status: seed.status,
      sections: [],
      blocks: [],
      branding: {},
      settings: {
        allowAnonymous: false,
        allowSaveAndContinue: true,
        showProgressBar: true,
        randomizeQuestions: false,
        randomizeOptions: false,
      },
      completion_settings: buildDefaultSurveyCompletionSettings(),
      reflection_prompts: [],
      default_language: 'en',
      supported_languages: ['en'],
      assigned_to: assignedTo,
      created_at: now,
      updated_at: now,
    };
    e2eStore.surveys.set(record.id, record);
    updateDemoSurveyAssignments(record.id, assignedTo);
    changed = true;
  }
  if (changed) {
    persistE2EStore();
  }
};

const listDemoSurveys = () => {
  ensureDemoSurveysSeeded();
  return Array.from(e2eStore.surveys.values())
    .map((survey) => applyAssignmentToSurvey(deepClone(survey), e2eStore.surveyAssignments.get(survey.id)))
    .sort((a, b) => {
      const left = new Date(a.updated_at || a.updatedAt || 0).getTime();
      const right = new Date(b.updated_at || b.updatedAt || 0).getTime();
      return right - left;
    });
};

const getDemoSurveyById = (id) => {
  if (!id) return null;
  ensureDemoSurveysSeeded();
  const survey = e2eStore.surveys.get(id);
  if (!survey) return null;
  return applyAssignmentToSurvey(deepClone(survey), e2eStore.surveyAssignments.get(id));
};

const updateDemoSurveyAssignments = (surveyId, assignedTo = createEmptyAssignedTo()) => {
  if (!surveyId) return;
  const payload = {
    survey_id: surveyId,
    organization_ids: [...(assignedTo.organizationIds || [])],
    user_ids: [...(assignedTo.userIds || [])],
    cohort_ids: [...(assignedTo.cohortIds || [])],
    department_ids: [...(assignedTo.departmentIds || [])],
    updated_at: new Date().toISOString(),
  };

  const hasAssignments =
    payload.organization_ids.length > 0 ||
    payload.user_ids.length > 0 ||
    payload.cohort_ids.length > 0 ||
    payload.department_ids.length > 0;

  if (!hasAssignments) {
    e2eStore.surveyAssignments.delete(surveyId);
  } else {
    e2eStore.surveyAssignments.set(surveyId, payload);
  }
};

const upsertDemoSurvey = (payload = {}) => {
  ensureDemoSurveysSeeded();
  const now = new Date().toISOString();
  const id = coerceString(payload.id) || `survey-${Date.now().toString(36)}`;
  const existing = e2eStore.surveys.get(id) || {};
  const assignmentUpdateRequested = hasAssignmentPayload(payload);
  let assignedTo;

  if (assignmentUpdateRequested) {
    ({ assignedTo } = normalizeAssignedTargets(payload));
  } else if (existing.assigned_to) {
    assignedTo = deepClone(existing.assigned_to);
  } else {
    assignedTo = createEmptyAssignedTo();
  }

  if (!assignmentUpdateRequested && e2eStore.surveyAssignments.has(id)) {
    const stored = e2eStore.surveyAssignments.get(id);
    assignedTo = {
      ...assignedTo,
      organizationIds: coerceIdArray(stored.organization_ids),
      userIds: coerceIdArray(stored.user_ids),
      cohortIds: coerceIdArray(stored.cohort_ids),
      departmentIds: coerceIdArray(stored.department_ids),
    };
  }

  const surveyRecord = {
    ...existing,
    id,
    title: payload.title ?? existing.title ?? 'Untitled Survey',
    description: payload.description ?? existing.description ?? '',
    type: payload.type ?? existing.type ?? 'custom',
    status: payload.status ?? existing.status ?? 'draft',
    sections: Array.isArray(payload.sections) ? payload.sections : existing.sections ?? [],
    blocks: Array.isArray(payload.blocks) ? payload.blocks : existing.blocks ?? [],
    branding: payload.branding ?? existing.branding ?? {},
    settings: payload.settings ?? existing.settings ?? {
      allowAnonymous: false,
      allowSaveAndContinue: true,
      showProgressBar: true,
      randomizeQuestions: false,
      randomizeOptions: false,
    },
    completion_settings: payload.completionSettings ?? existing.completion_settings ?? buildDefaultSurveyCompletionSettings(),
    reflection_prompts: payload.reflectionPrompts ?? existing.reflection_prompts ?? [],
    default_language: payload.defaultLanguage ?? existing.default_language ?? 'en',
    supported_languages: payload.supportedLanguages ?? existing.supported_languages ?? ['en'],
    assigned_to: assignedTo,
    created_at: existing.created_at ?? now,
    updated_at: now,
  };

  e2eStore.surveys.set(id, surveyRecord);
  if (assignmentUpdateRequested) {
    updateDemoSurveyAssignments(id, assignedTo);
  }
  persistE2EStore();
  return applyAssignmentToSurvey(deepClone(surveyRecord), e2eStore.surveyAssignments.get(id));
};

const removeDemoSurvey = (id) => {
  if (!id) return false;
  const deleted = e2eStore.surveys.delete(id);
  e2eStore.surveyAssignments.delete(id);
  if (deleted) {
    persistE2EStore();
  }
  return deleted;
};

const fetchSurveyAssignmentsMap = async (surveyIds = []) => {
  if (!Array.isArray(surveyIds) || surveyIds.length === 0) {
    return new Map();
  }

  if (!supabase) {
    const map = new Map();
    for (const id of surveyIds) {
      if (e2eStore.surveyAssignments.has(id)) {
        map.set(id, e2eStore.surveyAssignments.get(id));
      }
    }
    return map;
  }

  const { data, error } = await supabase
    .from('survey_assignments')
    .select('*')
    .in('survey_id', surveyIds.filter(Boolean));
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((row) => {
    if (row?.survey_id) {
      map.set(row.survey_id, row);
    }
  });
  return map;
};

const loadSurveyWithAssignments = async (id) => {
  if (!id) return null;
  if (!supabase) {
    return getDemoSurveyById(id);
  }
  const { data, error } = await supabase.from('surveys').select('*').eq('id', id).single();
  if (error) throw error;
  const assignments = await fetchSurveyAssignmentsMap([id]);
  return applyAssignmentToSurvey({ ...data }, assignments.get(id));
};

const syncSurveyAssignments = async (surveyId, assignedTo = createEmptyAssignedTo()) => {
  if (!surveyId || !supabase) return;
  const normalized = assignedTo ?? createEmptyAssignedTo();
  const payload = {
    survey_id: surveyId,
    organization_ids: coerceIdArray(normalized.organizationIds),
    user_ids: coerceIdArray(normalized.userIds),
    cohort_ids: coerceIdArray(normalized.cohortIds),
    department_ids: coerceIdArray(normalized.departmentIds),
    updated_at: new Date().toISOString(),
  };

  const hasAssignments =
    payload.organization_ids.length > 0 ||
    payload.user_ids.length > 0 ||
    payload.cohort_ids.length > 0 ||
    payload.department_ids.length > 0;

  if (!hasAssignments) {
    const { error } = await supabase.from('survey_assignments').delete().eq('survey_id', surveyId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('survey_assignments').upsert(payload);
  if (error) throw error;
};

const parseLessonIdsParam = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value)).filter(Boolean);
  }
  return String(raw)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

const normalizeLessonSnapshot = (input) => {
  if (!input) return null;
  const lessonId = coerceString(input.lessonId, input.lesson_id, input.id);
  if (!lessonId) return null;

  const percent = coerceNumber(input.progressPercent, input.progress_percent, input.percent) ?? 0;

  return {
    lessonId,
    progressPercent: clampPercent(percent),
    completed: typeof input.completed === 'boolean' ? input.completed : percent >= 100,
    positionSeconds: coerceNumber(input.positionSeconds, input.position_seconds, input.resume_at_s) ?? 0,
    lastAccessedAt: coerceString(input.lastAccessedAt, input.last_accessed_at),
  };
};

const normalizeSnapshotPayload = (body = {}, fallbackUserId) => {
  const userId = coerceString(body.userId, body.user_id, body.learnerId, body.learner_id, fallbackUserId);
  const courseId = coerceString(body.courseId, body.course_id, body.course?.courseId, body.course?.course_id);

  if (!userId || !courseId) {
    return null;
  }

  const rawLessons = Array.isArray(body.lessons)
    ? body.lessons
    : Array.isArray(body.lesson_progress)
    ? body.lesson_progress
    : [];

  const lessons = rawLessons.reduce((acc, item) => {
    const normalized = normalizeLessonSnapshot(item);
    if (normalized) acc.push(normalized);
    return acc;
  }, []);

  const courseBlock = body.course ?? body.course_progress ?? {};

  return {
    userId,
    courseId,
    lessons,
    course: {
      percent:
        coerceNumber(
          courseBlock.percent,
          courseBlock.progress_percent,
          courseBlock.progressPercent,
          body.overallPercent,
          body.overall_percent,
        ) ?? 0,
      completedAt: coerceString(courseBlock.completedAt, courseBlock.completed_at, body.completedAt, body.completed_at) ?? null,
      totalTimeSeconds: coerceNumber(courseBlock.totalTimeSeconds, courseBlock.total_time_seconds),
      lastLessonId: coerceString(courseBlock.lastLessonId, courseBlock.last_lesson_id),
    },
  };
};

const buildLessonRow = (lessonId, record) => ({
  lesson_id: lessonId,
  progress_percentage: clampPercent(record?.percent ?? record?.progressPercent ?? 0),
  completed: Boolean(record?.completed) || (record?.status ? record.status === 'completed' : (record?.percent ?? 0) >= 100),
  time_spent: record?.time_spent_s ?? record?.timeSpentSeconds ?? record?.positionSeconds ?? 0,
  last_accessed_at: record?.last_accessed_at || record?.updated_at || record?.lastAccessedAt || null,
});

// Log loaded courses
if (e2eStore.courses.size > 0) {
  console.log(`✅ Loaded ${e2eStore.courses.size} course(s) from persistent storage`);
  for (const [id, course] of e2eStore.courses.entries()) {
    console.log(`   - ${course.title} (${id})`);
  }
} else {
  // Seed a demo course if no courses exist
  console.log('📚 No courses found. Seeding demo course...');
  const demoCourse = {
    id: 'foundations',
    slug: 'foundations-of-inclusive-leadership',
    title: 'Foundations of Inclusive Leadership',
    description: 'Learn the fundamentals of inclusive leadership through interactive lessons, including TED Talks, quizzes, and practical frameworks.',
    status: 'published',
    version: 1,
    published_at: new Date().toISOString(),
    thumbnail: '/api/placeholder/400/300',
    difficulty: 'Beginner',
    duration: '2 hours',
    instructorName: 'Dr. Sarah Chen',
    estimatedDuration: 7200,
    keyTakeaways: [
      'Understand the core principles of inclusive leadership',
      'Learn how vulnerability strengthens leadership',
      'Build psychological safety in teams',
      'Apply practical leadership frameworks'
    ],
    meta_json: {
      tags: ['leadership', 'inclusion', 'management', 'professional development'],
      category: 'Leadership',
      level: 'beginner'
    },
    modules: [
      {
        id: 'mod-1',
        course_id: 'foundations',
        title: 'Introduction to Leadership',
        description: 'Core concepts and foundations',
        order_index: 0,
        lessons: [
          {
            id: 'lesson-video',
            module_id: 'mod-1',
            title: 'The Power of Vulnerability',
            description: 'Watch this inspiring TED Talk by Brené Brown',
            type: 'video',
            order_index: 0,
            duration_s: 1200,
            content_json: {
              videoUrl: 'https://www.ted.com/talks/brene_brown_the_power_of_vulnerability',
              videoType: 'ted'
            },
            completion_rule_json: { requiredPercent: 85 }
          },
          {
            id: 'lesson-quiz',
            module_id: 'mod-1',
            title: 'Leadership Knowledge Check',
            description: 'Test your understanding',
            type: 'quiz',
            order_index: 1,
            duration_s: 300,
            content_json: {
              questions: [
                {
                  id: 'q1',
                  question: 'What is the primary role of an inclusive leader?',
                  options: [
                    { id: 'a', text: 'To make all decisions alone' },
                    { id: 'b', text: 'To create an environment where all voices are heard' },
                    { id: 'c', text: 'To maintain strict hierarchy' },
                    { id: 'd', text: 'To avoid difficult conversations' }
                  ],
                  correctAnswer: 'b'
                },
                {
                  id: 'q2',
                  question: 'Which quality is essential for effective leadership?',
                  options: [
                    { id: 'a', text: 'Vulnerability' },
                    { id: 'b', text: 'Perfectionism' },
                    { id: 'c', text: 'Control' },
                    { id: 'd', text: 'Distance' }
                  ],
                  correctAnswer: 'a'
                }
              ]
            },
            completion_rule_json: { requiredScore: 70 }
          },
          {
            id: 'lesson-text',
            module_id: 'mod-1',
            title: 'Leadership Principles',
            description: 'Core principles of effective leadership',
            type: 'text',
            order_index: 2,
            duration_s: 600,
            content_json: {
              body: '# Leadership Principles\n\n## 1. Lead with Empathy\n\nEmpathy is the foundation of inclusive leadership...\n\n## 2. Foster Psychological Safety\n\nCreate an environment where team members feel safe...\n\n## 3. Embrace Vulnerability\n\nAs Brené Brown teaches, vulnerability is not weakness...'
            },
            completion_rule_json: null
          },
          {
            id: 'lesson-resource',
            module_id: 'mod-1',
            title: 'Leadership Framework Guide',
            description: 'Download the comprehensive leadership framework',
            type: 'resource',
            order_index: 3,
            duration_s: 0,
            content_json: {
              fileUrl: '/resources/leadership-framework.pdf',
              fileType: 'pdf',
              fileSize: '2.4 MB',
              fileName: 'Leadership Framework Guide.pdf'
            },
            completion_rule_json: null
          }
        ]
      }
    ]
  };
  e2eStore.courses.set('foundations', demoCourse);
  savePersistedData(e2eStore);
  console.log('✅ Demo course seeded successfully');
}

// E2E helpers
const e2eFindCourse = (identifier) => {
  if (!identifier) return null;
  const byId = e2eStore.courses.get(identifier);
  if (byId) return byId;
  const lower = String(identifier).toLowerCase();
  for (const course of e2eStore.courses.values()) {
    if ((course.slug && String(course.slug).toLowerCase() === lower) || String(course.id).toLowerCase() === lower) {
      return course;
    }
  }
  return null;
};

const e2eFindModule = (moduleId) => {
  for (const course of e2eStore.courses.values()) {
    const mod = (course.modules || []).find((m) => String(m.id) === String(moduleId));
    if (mod) return { course, module: mod };
  }
  return null;
};

const e2eFindLesson = (lessonId) => {
  for (const course of e2eStore.courses.values()) {
    for (const mod of course.modules || []) {
      const lesson = (mod.lessons || []).find((l) => String(l.id) === String(lessonId));
      if (lesson) return { course, module: mod, lesson };
    }
  }
  return null;
};

// Helper to persist data after any modification
const persistE2EStore = () => {
  if (DEV_FALLBACK || E2E_TEST_MODE) {
    savePersistedData(e2eStore);
  }
};

// Diagnostic helper: write a JSON file with request + error context when a server
// error occurs. This lets E2E runs capture a disk artifact we can later inspect
// and correlate with client-side x-request-id values.
const DIAG_DIR = path.join(__dirname, 'diagnostics');
function dumpErrorContext(req, err) {
  try {
    if (!fs.existsSync(DIAG_DIR)) fs.mkdirSync(DIAG_DIR, { recursive: true });
    const id = req && req.requestId ? req.requestId : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const payload = {
      timestamp: new Date().toISOString(),
      requestId: id,
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
      error: {
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : null
      }
    };
    const file = path.join(DIAG_DIR, `error-${id}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[diag] Wrote diagnostics file: ${file}`);
  } catch (e) {
    console.warn('Failed to write diagnostics file', e);
  }
}


const summarizeRequestBody = (body) => {
  if (body === null || body === undefined) return null;
  if (typeof body !== 'object') return typeof body;
  const summary = {};
  const keys = Object.keys(body);
  for (const key of keys) {
    const value = body[key];
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      summary[key] = `Array(${value.length})`;
    } else if (typeof value === 'object') {
      summary[key] = `Object(${Object.keys(value).length})`;
    } else {
      summary[key] = typeof value;
    }
  }
  return summary;
};

const logAdminCoursesError = (req, err, label) => {
  const endpoint = req?.method && req?.originalUrl ? `${req.method} ${req.originalUrl}` : req?.path || 'unknown';
  const meta = {
    endpoint,
    requestId: req?.requestId ?? null,
    params: req?.params ?? null,
    query: req?.query ?? null,
    bodySummary: summarizeRequestBody(req?.body ?? null),
  };
  console.error(`[admin-courses] ${label}`, meta, err);
  try {
    dumpErrorContext(req, err);
  } catch (_) {
    // swallow diagnostics errors
  }
};


const ensureSupabase = (res) => {
  if (!supabase) {
    // Allow tests to run with an in-memory fallback when explicitly enabled
    if (E2E_TEST_MODE || DEV_FALLBACK) return true;
    const missingEnv = missingSupabaseEnvVars.length > 0 ? missingSupabaseEnvVars : ['Unknown Supabase configuration'];
    if (!loggedMissingSupabaseConfig) {
      console.error('[Supabase] Missing required environment variables:', missingEnv.join(', '));
      loggedMissingSupabaseConfig = true;
    }
    res.status(503).json({
      error: 'Supabase service credentials not configured on server',
      missingEnv,
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or disable via DEV_FALLBACK=true for demo mode).'
    });
    return false;
  }
  return true;
};

const writableMembershipRoles = new Set(['owner', 'admin', 'editor', 'manager']);

const getRequestContext = (req) => {
  const userIdHeader = req.get('x-user-id');
  const userRoleHeader = req.get('x-user-role');
  const userId = userIdHeader && userIdHeader.trim().length > 0 ? userIdHeader.trim() : null;
  const userRole = userRoleHeader && userRoleHeader.trim().length > 0 ? userRoleHeader.trim().toLowerCase() : null;
  return { userId, userRole };
};

const requireUserContext = (req, res) => {
  const { userId, userRole } = getRequestContext(req);
  if (userRole === 'admin') {
    return { userId, userRole };
  }
  if (!userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }
  return { userId, userRole };
};

const fetchMembership = async (orgId, userId) => {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const requireOrgAccess = async (req, res, orgId, { write = false } = {}) => {
  const context = getRequestContext(req);
  if (context.userRole === 'admin') {
    return { userId: context.userId, role: 'admin' };
  }

  if (!context.userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }

  try {
    // If running in E2E test mode without Supabase, assume org access for convenience
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      return { userId: context.userId, role: 'admin' };
    }

    const membership = await fetchMembership(orgId, context.userId);
    if (!membership) {
      res.status(403).json({ error: 'Organization membership required' });
      return null;
    }

    const memberRole = (membership.role || 'member').toLowerCase();
    if (write && !writableMembershipRoles.has(memberRole)) {
      res.status(403).json({ error: 'Insufficient organization permissions' });
      return null;
    }

    return { userId: context.userId, role: memberRole };
  } catch (error) {
    console.error(`Failed to verify membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to verify organization access' });
    return null;
  }
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    return [value];
  }
  return [];
};

const toStrategicPlan = (row) => ({
  id: row.id,
  orgId: row.org_id,
  content: row.content ?? '',
  createdAt: row.created_at,
  createdBy: row.created_by ?? 'System',
  metadata: row.metadata ?? {}
});

const toSessionNote = (row) => ({
  id: row.id,
  orgId: row.org_id,
  title: row.title,
  body: row.body ?? '',
  date: row.note_date ? new Date(row.note_date).toISOString() : row.created_at,
  tags: safeArray(row.tags),
  attachments: safeArray(row.attachments),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? 'System'
});

const toActionItem = (row) => ({
  id: row.id,
  orgId: row.org_id,
  title: row.title,
  description: row.description ?? '',
  assignee: row.assignee ?? undefined,
  dueDate: row.due_at ? new Date(row.due_at).toISOString() : undefined,
  status: row.status ?? 'Not Started',
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const actionStatusOrder = {
  'Not Started': 0,
  'In Progress': 1,
  Completed: 2
};

const sortActionItems = (items) =>
  items.slice().sort((a, b) => {
    const statusDiff = (actionStatusOrder[a.status] ?? 3) - (actionStatusOrder[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return dueA - dueB;
  });

// Diagnostics endpoint (safe booleans only; no secrets returned) to help
// identify environment and connectivity issues during deployment and support.
app.get('/api/diagnostics', async (req, res) => {
  // Only expose detailed diagnostics in non-production or when DEBUG_DIAG=true
  const allowDiag = (process.env.DEBUG_DIAG || '').toLowerCase() === 'true' || (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  if (!allowDiag) {
    res.status(403).json({ error: 'Diagnostics disabled' });
    return;
  }

  const diagnostics = {
    supabaseConfigured: Boolean(supabase),
    supabaseUrlPresent: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
    supabaseServiceRoleKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_SERVICE_KEY,
    databaseUrlPresent: !!process.env.DATABASE_URL,
    jwtSecretPresent: !!process.env.JWT_SECRET,
    cookieDomain: !!process.env.COOKIE_DOMAIN,
    corsAllowedConfigured: allowedOrigins.length > 0,
    devFallbackMode: DEV_FALLBACK,
    e2eMode: E2E_TEST_MODE
    ,enforceHttpsEnabled: (process.env.ENFORCE_HTTPS || '').toLowerCase() === 'true'
  };

  // Optionally check DB connectivity if Database URL is configured and allowed
  let dbReachable = null;
  if (diagnostics.databaseUrlPresent) {
    try {
      // Use a minimal check: connect and run a simple query via postgres or pg
      // But we avoid importing heavy packages here; rely on supabase client if present
      if (supabase) {
        // simple RPC or select call
        const { data, error } = await supabase.rpc('pg_isready').catch(() => ({ data: null, error: null }));
        // If RPC not present, attempt a basic select on a system function safely
        if (error) {
          // fallback to a minimal table query: check tables exist or version
          try {
            const { data: verRes, error: verErr } = await supabase.rpc('version', {}).catch(() => ({ data: null, error: null }));
            dbReachable = !(verErr);
          } catch {
            dbReachable = null;
          }
        } else {
          dbReachable = !!data;
        }
      } else {
        dbReachable = null; // can't test without supabase client
      }
    } catch (err) {
      dbReachable = false;
    }
  }

  diagnostics.dbReachable = dbReachable;
  res.json(diagnostics);
});

// Simple in-memory topic subscriptions for WS clients
const topicSubscribers = new Map(); // topic -> Set(ws)

function subscribeClientToTopic(ws, topic) {
  if (!topicSubscribers.has(topic)) topicSubscribers.set(topic, new Set());
  topicSubscribers.get(topic).add(ws);
}

function unsubscribeClientFromTopic(ws, topic) {
  if (!topicSubscribers.has(topic)) return;
  topicSubscribers.get(topic).delete(ws);
}

function broadcastToTopic(topic, payload) {
  const set = topicSubscribers.get(topic);
  const message = JSON.stringify(payload);
  if (!set) return;
  for (const ws of set) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(message);
    } catch (err) {
      console.warn('Failed to send WS message', err);
    }
  }
}

// Simple in-memory token bucket limiter per key
const createRateLimiter = ({ tokensPerInterval = 10, intervalMs = 1000 } = {}) => {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: tokensPerInterval, last: now };
      buckets.set(key, bucket);
    }
    const elapsed = now - bucket.last;
    const refill = Math.floor((elapsed / intervalMs) * tokensPerInterval);
    if (refill > 0) {
      bucket.tokens = Math.min(tokensPerInterval, bucket.tokens + refill);
      bucket.last = now;
    }
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  };
};

const checkProgressLimit = createRateLimiter({ tokensPerInterval: 8, intervalMs: 1000 });

// ============================================================================
// Authentication Endpoints
// ============================================================================

// Authentication handler function
const handleLogin = async (req, res) => {
  const { email, password, type } = req.body || {};

  console.log('[AUTH] Login attempt:', { email, type, hasSupabase: Boolean(supabase), E2E_TEST_MODE, DEV_FALLBACK });

  // Opt-in verbose auth diagnostics: when AUTH_DIAG_VERBOSE=true write a per-attempt
  // JSON file under the server diagnostics directory so Playwright captures can be
  // correlated with server-side request/response context. We use req.requestId
  // which is set by the global middleware above.
  const AUTH_VERBOSE = (process.env.AUTH_DIAG_VERBOSE || '').toLowerCase() === 'true';
  const writeAuthAttempt = async (outcome, details = {}) => {
    if (!AUTH_VERBOSE) return;
    try {
      if (!fs.existsSync(DIAG_DIR)) fs.mkdirSync(DIAG_DIR, { recursive: true });
      const id = req.requestId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
      const payload = Object.assign({
        timestamp: new Date().toISOString(),
        requestId: id,
        route: '/api/auth/login',
        method: req.method,
        path: req.path,
        outcome,
        headers: req.headers,
        body: req.body
      }, details);
      const file = path.join(DIAG_DIR, `auth-attempt-${id}.json`);
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`[diag] Wrote auth attempt diagnostic: ${file}`);
    } catch (e) {
      console.warn('Failed to write auth attempt diagnostic', e);
    }
  };

  if (!email || !password) {
    await writeAuthAttempt('missing_credentials');
    res.status(400).json({ 
      error: 'Email and password are required',
      errorType: 'validation_error'
    });
    return;
  }

  // Demo/E2E mode - accept any login with test credentials
  // Use demo mode if: E2E_TEST_MODE is set, OR we're in dev fallback mode
  const useDemoMode = E2E_TEST_MODE || DEV_FALLBACK;
  
  if (useDemoMode) {
    console.log('[AUTH] Using demo mode authentication');
    // Test credentials for demo
    const validLogins = {
      'user@pacificcoast.edu': { password: 'user123', role: 'learner', name: 'Demo User' },
  'mya@the-huddle.co': { password: 'admin123', role: 'admin', name: 'Admin User' },
      'demo@example.com': { password: 'demo', role: 'learner', name: 'Demo Learner' }
    };

    const user = validLogins[email.toLowerCase()];
    
    if (user && user.password === password) {
      const userData = {
        id: `demo-${email.split('@')[0]}`,
        email: email.toLowerCase(),
        name: user.name,
        role: user.role,
        organizationId: 'demo-org'
      };

      await writeAuthAttempt('success', { mode: 'demo', user: { id: userData.id, email: userData.email, role: userData.role } });
      res.json({
        success: true,
        user: userData,
        accessToken: `demo-token-${Date.now()}`,
        refreshToken: `demo-refresh-${Date.now()}`,
        expiresAt: Date.now() + 86400000 // 24 hours
      });
      return;
    }

    await writeAuthAttempt('invalid_credentials_demo');
    res.status(401).json({
      error: 'Invalid credentials',
      errorType: 'invalid_credentials'
    });
    return;
  }

  // Supabase authentication (if configured)
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      await writeAuthAttempt('invalid_credentials_supabase', { error: error && error.message ? error.message : String(error) });
      res.status(401).json({
        error: error.message || 'Authentication failed',
        errorType: 'invalid_credentials'
      });
      return;
    }

    await writeAuthAttempt('success', { mode: 'supabase', user: { id: data.user.id, email: data.user.email } });
    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email,
        role: type === 'admin' ? 'admin' : 'learner',
        organizationId: data.user.user_metadata?.organization_id || null
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  } catch (error) {
    console.error('Login error:', error);
    try { await writeAuthAttempt('exception', { error: String(error) }); } catch (_) {}
    res.status(500).json({
      error: 'Authentication service error',
      errorType: 'network_error'
    });
  }
};

// Register login endpoint at both paths for compatibility
app.post('/api/auth/login', handleLogin);
app.post('/login', handleLogin); // Legacy path

// Token refresh endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  // Demo mode - just issue new tokens
  if (E2E_TEST_MODE || DEV_FALLBACK || !supabase) {
    res.json({
      accessToken: `demo-token-${Date.now()}`,
      refreshToken: `demo-refresh-${Date.now()}`,
      expiresAt: Date.now() + 86400000
    });
    return;
  }

  // Supabase refresh
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }

  // Demo mode - just acknowledge
  if (E2E_TEST_MODE || DEV_FALLBACK || !supabase) {
    res.json({ 
      success: true, 
      message: 'Password reset email sent (demo mode - not actually sent)' 
    });
    return;
  }

  // Supabase password reset
  if (!ensureSupabase(res)) return;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// HTTP endpoint to broadcast events. Secured by a server-only API key (BROADCAST_API_KEY).
// If BROADCAST_API_KEY is not set (dev), fallback to the previous x-user-role=admin header check.
app.post('/api/broadcast', (req, res) => {
  const { type, topic, data } = req.body || {};

  const broadcastApiKey = process.env.BROADCAST_API_KEY || null;

  // If a server broadcast API key is configured, require it via Authorization: Bearer <key>
  // or the x-broadcast-api-key header. This keeps the endpoint callable only from trusted
  // backend services. If not set, fall back to the legacy admin header check (dev convenience).
  if (broadcastApiKey) {
    const auth = (req.get('authorization') || '').trim();
    const headerKey = (req.get('x-broadcast-api-key') || '').trim();
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth;
    if (token !== broadcastApiKey && headerKey !== broadcastApiKey) {
      res.status(403).json({ error: 'Invalid broadcast API key' });
      return;
    }
  } else {
    const userRole = (req.get('x-user-role') || '').toLowerCase();
    if (userRole !== 'admin') {
      res.status(403).json({ error: 'Admin role required to broadcast' });
      return;
    }
  }

  if (!type) {
    res.status(400).json({ error: 'type is required' });
    return;
  }

  const payload = { type, data, timestamp: Date.now() };
  if (topic) broadcastToTopic(topic, payload);
  else {
    // broadcast to all topics
    for (const t of topicSubscribers.keys()) broadcastToTopic(t, payload);
  }

  res.json({ ok: true });
});

// Expose broadcast helper to other server modules
app.locals.broadcastToTopic = broadcastToTopic;

app.get('/api/admin/courses', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      const data = Array.from(e2eStore.courses.values()).map((c) => ({
        id: c.id,
        slug: c.slug ?? c.id,
        title: c.title,
        description: c.description ?? null,
        status: c.status ?? 'draft',
        version: c.version ?? 1,
        meta_json: c.meta_json ?? {},
        published_at: c.published_at ?? null,
        thumbnail: c.thumbnail ?? null,
        difficulty: c.difficulty ?? null,
        duration: c.duration ?? null,
        instructorName: c.instructorName ?? null,
        estimatedDuration: c.estimatedDuration ?? null,
        keyTakeaways: c.keyTakeaways ?? [],
        modules: (c.modules || []).map((m) => ({
          id: m.id,
          course_id: c.id,
          title: m.title,
          description: m.description ?? null,
          order_index: m.order_index ?? m.order ?? 0,
          lessons: (m.lessons || []).map((l) => ({
            id: l.id,
            module_id: m.id,
            title: l.title,
            description: l.description ?? null,
            type: l.type,
            order_index: l.order_index ?? l.order ?? 0,
            duration_s: l.duration_s ?? null,
            content_json: l.content_json ?? l.content ?? {},
            completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
          })),
        })),
      }));
      res.json({ data });
      return;
    } catch (err) {
      logAdminCoursesError(req, err, 'E2E fetch courses failed');
      res.status(500).json({ error: 'Unable to fetch courses' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    logAdminCoursesError(req, error, 'Failed to fetch courses');
    res.status(500).json({ error: 'Unable to fetch courses' });
  }
});

app.post('/api/admin/courses', async (req, res) => {
  // Validate incoming payload (accepting existing client shape)
  const valid = validateOr400(courseUpsertSchema, req, res);
  if (!valid) return;
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { course, modules = [] } = req.body || {};
    if (!course?.title) {
      res.status(400).json({ error: 'Course title is required' });
      return;
    }
    try {
      // Demo-mode idempotency: respect client-provided idempotency keys in E2E/demo fallback
      const demoIdempotencyKey = req.body?.idempotency_key ?? req.body?.client_event_id ?? null;
      if (demoIdempotencyKey) {
        // If we've already seen this idempotency key, return the previously-created resource if available
        const existingResourceId = e2eStore.idempotencyKeys[demoIdempotencyKey];
        if (existingResourceId) {
          const existingCourse = e2eStore.courses.get(existingResourceId);
          if (existingCourse) {
            res.json({ data: existingCourse, idempotent: true });
            return;
          }
          // Key exists but no resource recorded yet: indicate conflict/processing
          res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key (processing)' });
          return;
        }
        // Reserve the idempotency key (null = in-flight)
        e2eStore.idempotencyKeys[demoIdempotencyKey] = null;
      }

      // Idempotent upsert by id, slug, or external_id (stored in meta_json)
      let existingId = null;
      const incomingSlug = course.slug ?? null;
      const incomingExternalId = (course.external_id ?? course.meta?.external_id ?? null) || null;
      if (!course.id) {
        for (const c of e2eStore.courses.values()) {
          const cSlug = c.slug ?? c.id;
          const cExternal = c.meta_json?.external_id ?? null;
          if (incomingSlug && String(cSlug).toLowerCase() === String(incomingSlug).toLowerCase()) {
            existingId = c.id;
            break;
          }
          if (incomingExternalId && cExternal && String(cExternal) === String(incomingExternalId)) {
            existingId = c.id;
            break;
          }
        }
      }
      const id = course.id ?? existingId ?? `e2e-course-${Date.now()}`;
      const courseObj = {
        id,
        slug: course.slug ?? id,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: { ...(course.meta ?? {}), ...(incomingExternalId ? { external_id: incomingExternalId } : {}) },
        published_at: null,
        modules: [],
      };
      const modulesArr = modules || [];
      for (const [moduleIndex, module] of modulesArr.entries()) {
        const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}`;
        const moduleObj = {
          id: moduleId,
          course_id: id,
          title: module.title,
          description: module.description ?? null,
          order_index: module.order_index ?? moduleIndex,
          lessons: [],
        };
        const lessons = module.lessons || [];
        for (const [lessonIndex, lesson] of lessons.entries()) {
          const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}`;
          const lessonObj = {
            id: lessonId,
            module_id: moduleId,
            title: lesson.title,
            description: lesson.description ?? null,
            type: lesson.type,
            order_index: lesson.order_index ?? lessonIndex,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? lesson.content ?? {},
            completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
          };
          moduleObj.lessons.push(lessonObj);
        }
        courseObj.modules.push(moduleObj);
      }
      e2eStore.courses.set(id, courseObj);

      // If an idempotency key was provided in demo mode, record the resulting resource id
      if (demoIdempotencyKey) {
        try {
          e2eStore.idempotencyKeys[demoIdempotencyKey] = id;
        } catch (err) {
          console.warn('Failed to record demo idempotency mapping', err);
        }
      }

      // Save to persistent storage
      persistE2EStore();
      console.log(`✅ Saved course "${courseObj.title}" to persistent storage`);

      res.status(201).json({ data: courseObj });
      return;
    } catch (error) {
      logAdminCoursesError(req, error, 'E2E upsert course failed');
      res.status(500).json({ error: 'Unable to save course' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;

  const { course, modules = [] } = req.body || {};
  // Lightweight request tracing to aid debugging in CI/local runs
  try {
    console.log(
      `[srv] Upsert course request: requestId=${req.requestId} idempotency=${req.body?.idempotency_key ?? req.body?.client_event_id ?? null} hasSupabase=${Boolean(supabase)} E2E_TEST_MODE=${E2E_TEST_MODE}`
    );
    console.log('[srv] Upsert payload summary:', {
      title: course?.title ?? null,
      id: course?.id ?? null,
      slug: course?.slug ?? null,
      moduleCount: Array.isArray(modules) ? modules.length : 0
    });
  } catch (logErr) {
    // Swallow logging errors to avoid interfering with normal request flow
    console.warn('Failed to log upsert request summary', logErr);
  }

  if (!course?.title) {
    res.status(400).json({ error: 'Course title is required' });
    return;
  }

  try {
    const meta = course.meta ?? {};
    // Optional optimistic version check to avoid overwriting newer versions
    if (course.id) {
      const existing = await supabase.from('courses').select('id, version').eq('id', course.id).maybeSingle();
      if (existing.error) throw existing.error;
      const currVersion = existing.data?.version ?? null;
      if (currVersion !== null && typeof course.version === 'number' && course.version < currVersion) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${currVersion}` });
        return;
      }
    }

    // Optional idempotency: if the client provided an idempotency key (or client_event_id),
    // record it in the `idempotency_keys` table to avoid duplicate processing on retries.
    // If the key already exists, treat as idempotent and return a 409 indicating duplicate.
    const idempotencyKey = req.body?.idempotency_key ?? req.body?.client_event_id ?? null;
    if (idempotencyKey) {
      try {
        await supabase.from('idempotency_keys').insert({ id: idempotencyKey, key_type: 'course_upsert', resource_id: null, payload: { course: course, modules: modules } });
      } catch (ikErr) {
        // Duplicate idempotency key: try to fetch the recorded idempotency row and return
        console.warn(`Idempotency key ${idempotencyKey} already exists`);
        try {
          const { data: existing, error: fetchErr } = await supabase.from('idempotency_keys').select('*').eq('id', idempotencyKey).maybeSingle();
          if (!fetchErr && existing) {
            if (existing.resource_id) {
              // If we have a resource_id, try to fetch and return the created resource
              const { data: courseRow, error: courseFetchErr } = await supabase
                .from('courses')
                .select('*, modules(*, lessons(*))')
                .eq('id', existing.resource_id)
                .maybeSingle();
              if (!courseFetchErr && courseRow) {
                res.status(200).json({ data: courseRow, idempotent: true });
                return;
              }
              // Resource id present but resource not yet queryable
              res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key (resource not available yet)' });
              return;
            }
            // Key exists but resource_id not set yet; indicate conflict/processing
            res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key (processing)' });
            return;
          }
        } catch (fetchErr) {
          console.warn('Failed to lookup existing idempotency key row', fetchErr);
        }
        // Fallback response
        res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key' });
        return;
      }
    }

    // If Supabase supports the upsert_course_full RPC, try a single transactional upsert
    try {
      const organizationId = course.org_id ?? course.organizationId ?? null;
      const rpcPayload = {
        id: course.id ?? undefined,
        slug: course.slug ?? undefined,
        title: course.title || course.name,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        organization_id: organizationId,
        meta_json: meta,
      };
      try {
        console.log('[srv] Attempting RPC upsert_course_full', { rpcPayload, moduleCount: Array.isArray(modules) ? modules.length : 0 });
      } catch (_) {}
      const rpcRes = await supabase.rpc('upsert_course_full', { p_course: rpcPayload, p_modules: modules });
      try {
        console.log('[srv] rpcRes for upsert_course_full', { error: rpcRes?.error ?? null, data: rpcRes?.data ?? null });
      } catch (_) {}
      if (!rpcRes.error && rpcRes.data) {
        const sel = await supabase
          .from('courses')
          .select('*, modules(*, lessons(*))')
          .eq('id', rpcRes.data)
          .single();
        if (sel.error) throw sel.error;
        res.status(201).json({ data: sel.data });
        return;
      }
    } catch (rpcErr) {
      console.warn('RPC upsert_course_full failed, falling back to client-side sequence:', rpcErr);
    }

    // Upsert course row first to obtain courseRow.id
    const organizationId = course.org_id ?? course.organizationId ?? null;
    const upsertPayload = {
      id: course.id ?? undefined,
      slug: course.slug ?? undefined,
      title: course.title || course.name,
      description: course.description ?? null,
      status: course.status ?? 'draft',
      version: course.version ?? 1,
      organization_id: organizationId,
      meta_json: meta,
    };
    try {
      console.log('[srv] Performing course upsert', { upsertPayload });
    } catch (_) {}

    const courseRes = await supabase
      .from('courses')
      .upsert(upsertPayload)
      .select('*')
      .single();

    if (courseRes.error) throw courseRes.error;
    const courseRow = courseRes.data;

    // E2E fallback when Supabase isn't configured: keep an in-memory course store
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const id = course.id ?? `e2e-course-${Date.now()}`;
      const courseObj = {
        id,
        organization_id: course.organizationId ?? null,
        slug: course.slug ?? id,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: meta,
        published_at: meta.published_at ?? null,
        due_date: meta.due_date ?? null,
        modules: []
      };

      const modulesArr = modules || [];
      for (const [moduleIndex, module] of modulesArr.entries()) {
        const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}`;
        const moduleObj = {
          id: moduleId,
          course_id: id,
          order_index: module.order_index ?? moduleIndex,
          title: module.title,
          description: module.description ?? null,
          lessons: []
        };

        const lessons = module.lessons || [];
        for (const [lessonIndex, lesson] of lessons.entries()) {
          const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}`;
          const lessonObj = {
            id: lessonId,
            module_id: moduleId,
            order_index: lesson.order_index ?? lessonIndex,
            type: lesson.type,
            title: lesson.title,
            description: lesson.description ?? null,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? {},
            completion_rule_json: lesson.completion_rule_json ?? null
          };
          moduleObj.lessons.push(lessonObj);
        }

        courseObj.modules.push(moduleObj);
      }

      e2eStore.courses.set(id, courseObj);

      res.status(201).json({ data: courseObj });
      return;
    }

    const incomingModuleIds = modules.map((module) => module.id).filter(Boolean);
    if (incomingModuleIds.length > 0) {
      const { data: existingModules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseRow.id);

      const modulesToDelete = (existingModules || [])
        .map((row) => row.id)
        .filter((id) => !incomingModuleIds.includes(id));

      if (modulesToDelete.length > 0) {
        await supabase.from('modules').delete().in('id', modulesToDelete);
      }

      for (const [moduleIndex, module] of modules.entries()) {
        const { data: moduleRow, error: moduleError } = await supabase
          .from('modules')
          .upsert({
            id: module.id,
            course_id: courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null
          })
          .select('*')
          .single();

        if (moduleError) throw moduleError;

        const lessons = module.lessons || [];
        const incomingLessonIds = lessons.map((lesson) => lesson.id);

        if (incomingLessonIds.length > 0) {
          const { data: existingLessons } = await supabase
            .from('lessons')
            .select('id')
            .eq('module_id', moduleRow.id);

          const lessonsToDelete = (existingLessons || [])
            .map((row) => row.id)
            .filter((id) => !incomingLessonIds.includes(id));

          if (lessonsToDelete.length > 0) {
            await supabase.from('lessons').delete().in('id', lessonsToDelete);
          }

          for (const [lessonIndex, lesson] of lessons.entries()) {
            const { error: lessonError } = await supabase
              .from('lessons')
              .upsert({
                id: lesson.id,
                module_id: moduleRow.id,
                order_index: lesson.order_index ?? lessonIndex,
                type: lesson.type,
                title: lesson.title,
                description: lesson.description ?? null,
                duration_s: lesson.duration_s ?? null,
                content_json: lesson.content_json ?? {},
                completion_rule_json: lesson.completion_rule_json ?? null
              });

            if (lessonError) throw lessonError;
          }
        } else {
          await supabase.from('lessons').delete().eq('module_id', moduleRow.id);
        }
      }
    } else {
  await supabase.from('modules').delete().eq('course_id', courseRow.id);
    }

    const refreshed = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
  .eq('id', courseRow.id)
      .single();

    if (refreshed.error) throw refreshed.error;

    // If an idempotency key was provided, record the resulting resource id
    if (idempotencyKey) {
      try {
        await supabase.from('idempotency_keys').update({ resource_id: refreshed.data?.id }).eq('id', idempotencyKey);
      } catch (updErr) {
        console.warn('Failed to update idempotency_keys with resource id', updErr);
      }
    }

    res.status(201).json({ data: refreshed.data });
  } catch (error) {
    logAdminCoursesError(req, error, 'Failed to upsert course');
    // Provide more details to the client for debugging
    const errorMessage = error?.message || 'Unable to save course';
    const errorDetails = error?.details || error?.hint || null;
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handler to capture unexpected errors and produce a diagnostics file
app.use((err, req, res, _next) => {
  try {
    console.error('Unhandled server error:', err);
    dumpErrorContext(req || { requestId: null, method: 'UNKNOWN', path: req ? req.path : 'UNKNOWN', headers: {} }, err);
  } catch (e) {
    console.warn('Failed while dumping error context', e);
  }
  try {
    res.status(500).json({ error: 'Internal server error', timestamp: new Date().toISOString() });
  } catch (e) {
    // nothing more we can do
  }
});

// Batch import endpoint (best-effort transactional behavior in E2E/DEV fallback)
app.post('/api/admin/courses/import', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  // In demo/E2E, snapshot and rollback on failure
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const snapshot = new Map(e2eStore.courses);
    const results = [];
    try {
      for (const payload of items) {
        const { course, modules = [] } = payload || {};
        if (!course?.title) throw new Error('Course title is required');

        // Reuse the same logic as the single upsert route: upsert by id/slug/external_id
        let existingId = null;
        const incomingSlug = course.slug ?? null;
        const incomingExternalId = (course.external_id ?? course.meta?.external_id ?? null) || null;
        if (!course.id) {
          for (const c of e2eStore.courses.values()) {
            const cSlug = c.slug ?? c.id;
            const cExternal = c.meta_json?.external_id ?? null;
            if (incomingSlug && String(cSlug).toLowerCase() === String(incomingSlug).toLowerCase()) {
              existingId = c.id;
              break;
            }
            if (incomingExternalId && cExternal && String(cExternal) === String(incomingExternalId)) {
              existingId = c.id;
              break;
            }
          }
        }
        const id = course.id ?? existingId ?? `e2e-course-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const courseObj = {
          id,
          slug: course.slug ?? id,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          meta_json: { ...(course.meta ?? {}), ...(incomingExternalId ? { external_id: incomingExternalId } : {}) },
          published_at: null,
          modules: [],
        };
        const modulesArr = modules || [];
        for (const [moduleIndex, module] of modulesArr.entries()) {
          const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}-${Math.floor(Math.random()*1000)}`;
          const moduleObj = {
            id: moduleId,
            course_id: id,
            title: module.title,
            description: module.description ?? null,
            order_index: module.order_index ?? moduleIndex,
            lessons: [],
          };
          const lessons = module.lessons || [];
          for (const [lessonIndex, lesson] of lessons.entries()) {
            const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}-${Math.floor(Math.random()*1000)}`;
            const lessonObj = {
              id: lessonId,
              module_id: moduleId,
              title: lesson.title,
              description: lesson.description ?? null,
              type: lesson.type,
              order_index: lesson.order_index ?? lesson.order ?? lessonIndex,
              duration_s: lesson.duration_s ?? null,
              content_json: lesson.content_json ?? lesson.content ?? {},
              completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
            };
            moduleObj.lessons.push(lessonObj);
          }
          courseObj.modules.push(moduleObj);
        }
        e2eStore.courses.set(id, courseObj);
        results.push({ id, slug: courseObj.slug, title: courseObj.title });
      }
      persistE2EStore();
      res.status(201).json({ data: results });
    } catch (err) {
      // Rollback
      e2eStore.courses = snapshot;
      persistE2EStore();
      logAdminCoursesError(req, err, 'E2E import failed');
      res.status(400).json({ error: 'Import failed', details: String(err?.message || err) });
    }
    return;
  }

  // Supabase-backed path: sequential upsert (no transaction here)
  if (!ensureSupabase(res)) return;
  try {
    const results = [];
    for (const payload of items) {
      const { course, modules = [] } = payload || {};
      if (!course?.title) throw new Error('Course title is required');
      const upsertRes = await supabase
        .from('courses')
        .upsert({
          id: course.id ?? undefined,
          slug: course.slug ?? undefined,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          organization_id: course.organizationId ?? course.org_id ?? null,
          meta_json: { ...(course.meta ?? {}), ...(course.external_id ? { external_id: course.external_id } : {}) },
        })
        .select('*')
        .single();
      if (upsertRes.error) throw upsertRes.error;
      const courseRow = upsertRes.data;
      // naive: clear and reinsert modules/lessons for this course
      const existingModulesRes = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseRow.id);
      if (existingModulesRes.error) throw existingModulesRes.error;
      const existingModuleIds = (existingModulesRes.data || []).map((row) => row.id);

      if (existingModuleIds.length > 0) {
        const deleteLessonsRes = await supabase
          .from('lessons')
          .delete()
          .in('module_id', existingModuleIds);
        if (deleteLessonsRes.error) throw deleteLessonsRes.error;
      }

      const deleteModulesRes = await supabase
        .from('modules')
        .delete()
        .eq('course_id', courseRow.id);
      if (deleteModulesRes.error) throw deleteModulesRes.error;

      for (const [moduleIndex, module] of (modules || []).entries()) {
        const modIns = await supabase
          .from('modules')
          .insert({
            id: module.id ?? undefined,
            course_id: courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null,
          })
          .select('*')
          .single();
        if (modIns.error) throw modIns.error;
        const modRow = modIns.data;
        for (const [lessonIndex, lesson] of (module.lessons || []).entries()) {
          const lesIns = await supabase.from('lessons').insert({
            id: lesson.id ?? undefined,
            module_id: modRow.id,
            order_index: lesson.order_index ?? lessonIndex,
            type: lesson.type,
            title: lesson.title,
            description: lesson.description ?? null,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? lesson.content ?? {},
            completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
          });
          if (lesIns.error) throw lesIns.error;
        }
      }
      results.push({ id: courseRow.id, slug: courseRow.slug, title: courseRow.title });
    }
    res.status(201).json({ data: results });
  } catch (error) {
    logAdminCoursesError(req, error, 'Import failed');
    res.status(500).json({
      error: 'Import failed',
      details: error?.message || error?.hint || null,
    });
  }
});

// Assignments listing for client: return active assignments for a user
app.get('/api/client/assignments', optionalAuthenticate, async (req, res) => {
  const queryUserId = typeof req.query.user_id === 'string' ? req.query.user_id : typeof req.query.userId === 'string' ? req.query.userId : '';
  const headerUserId = (req.get('x-user-id') || '').trim();
  const sessionUserId = (req.user && (req.user.id || req.user.userId)) || '';
  const rawUserId = queryUserId || headerUserId || sessionUserId;
  const normalizedUserId = rawUserId ? rawUserId.toString().trim().toLowerCase() : '';
  const orgFilter = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : null;
  const includeCompletedAssignments =
    String(req.query.includeCompleted || req.query.include_completed || 'true').toLowerCase() === 'true';
  const requestId = req.requestId;

  const respond = (rows = [], meta = {}) =>
    res.json({
      data: rows,
      meta: {
        requestId,
        ...meta,
      },
    });

  if (!normalizedUserId) {
    logger.warn('client_assignments_missing_user', { requestId, query: req.query });
    respond([], { warning: 'missing_user_id' });
    return;
  }

  if (!supabase) {
    if (E2E_TEST_MODE || DEV_FALLBACK) {
      const rows = (e2eStore.assignments || []).filter((assignment) => {
        if (!assignment || assignment.active === false) return false;
        return String(assignment.user_id || '').toLowerCase() === normalizedUserId;
      });
      respond(rows, { source: 'demo' });
      return;
    }
    respond([], { source: 'disabled' });
    return;
  }

  try {
    const tablesToTry = ['course_assignments', 'assignments'];
    let assignments = [];

    for (const table of tablesToTry) {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', normalizedUserId)
        .order('updated_at', { ascending: false });

      if (table === 'assignments') {
        if (includeCompletedAssignments) {
          query = query.or('active.eq.true,status.eq.completed,status.eq.in-progress,status.eq.assigned');
        } else {
          query = query.eq('active', true);
        }
      }

      if (orgFilter) {
        const orgColumn = table === 'course_assignments' ? 'organization_id' : 'org_id';
        query = query.or(`${orgColumn}.eq.${orgFilter},${orgColumn}.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        const missingRelation = typeof error.message === 'string' && /relation/.test(error.message);
        if (missingRelation) {
          continue;
        }
        throw error;
      }

      assignments = data || [];
      break;
    }

    respond(assignments, { source: 'supabase' });
  } catch (err) {
    logger.error('client_assignments_fetch_failed', {
      requestId,
      userId: normalizedUserId,
      error: err instanceof Error ? err.message : err,
    });
    respond([], { warning: 'fetch_failed', source: 'fallback' });
  }
});

app.get('/api/client/surveys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
  const statusFilter = rawStatus && rawStatus !== 'all' ? rawStatus : null;
  const wantsAllStatuses = rawStatus === 'all';
  const fallbackStatus = statusFilter ?? (wantsAllStatuses ? null : 'published');
  const orgHeader = req.get('x-org-id');
  const orgQuery = (req.query.orgId || req.query.organizationId || '').toString().trim();
  const orgFilter = orgHeader?.trim() || (orgQuery.length > 0 ? orgQuery : null);

  try {
    if (!supabase) {
      let records = listDemoSurveys();
      if (fallbackStatus) {
        records = records.filter((survey) => {
          const normalized = String(survey.status || '').toLowerCase();
          return normalized === fallbackStatus;
        });
      }

      if (orgFilter) {
        records = records.filter((survey) => {
          const orgIds =
            survey.assignedTo?.organizationIds ||
            survey.assigned_to?.organizationIds ||
            [];
          if (!Array.isArray(orgIds) || orgIds.length === 0) return true;
          return orgIds.map(String).includes(orgFilter);
        });
      }

      res.json({ data: records });
      return;
    }

    let query = supabase
      .from('surveys')
      .select('*')
      .order('updated_at', { ascending: false });
    if (fallbackStatus) {
      query = query.eq('status', fallbackStatus);
    }

    const { data, error } = await query;
    if (error) throw error;

    const ids = (data || []).map((survey) => survey.id).filter(Boolean);
    const assignmentMap = await fetchSurveyAssignmentsMap(ids);
    let shaped = (data || []).map((survey) => applyAssignmentToSurvey({ ...survey }, assignmentMap.get(survey.id)));

    if (orgFilter) {
      shaped = shaped.filter((survey) => {
        const orgIds = survey.assignedTo?.organizationIds ?? survey.assigned_to?.organizationIds ?? [];
        if (!Array.isArray(orgIds) || orgIds.length === 0) return true;
        return orgIds.map(String).includes(orgFilter);
      });
    }

    res.json({ data: shaped });
  } catch (error) {
    console.error('Failed to fetch client surveys:', error);
    res.status(500).json({ error: 'Unable to fetch client surveys' });
  }
});

app.post('/api/admin/courses/:id/publish', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    // E2E fallback when Supabase isn't configured
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const existing = e2eStore.courses.get(id);
      if (!existing) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      existing.status = 'published';
      existing.version = req.body?.version ?? existing.version ?? 1;
      existing.published_at = new Date().toISOString();

      // Broadcast publish event to org and global listeners
      try {
        const orgId = existing.organization_id || existing.org_id || null;
        const payload = { type: 'course_updated', data: existing, timestamp: Date.now() };
        if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
        broadcastToTopic('course:updates', payload);
      } catch (bErr) {
        console.warn('Failed to broadcast course publish event', bErr);
      }

      res.json({ data: existing });
      return;
    }

    // Normal Supabase-backed path
    // 1) Fetch existing course
    const existing = await supabase
      .from('courses')
      .select('*, organization_id, org_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const nextVersion = req.body?.version ?? existing.data.version ?? 1;
    const publishedAt = new Date().toISOString();

    // 2) Update status -> published
    const updated = await supabase
      .from('courses')
      .update({ status: 'published', published_at: publishedAt, version: nextVersion })
      .eq('id', id)
      .select('*, modules(*, lessons(*))')
      .single();

    if (updated.error) throw updated.error;

    // 3) Broadcast publish event to org and global listeners
    try {
      const orgId = updated.data?.organization_id || updated.data?.org_id || null;
      const payload = { type: 'course_updated', data: updated.data, timestamp: Date.now() };
      if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
      broadcastToTopic('course:updates', payload);
    } catch (bErr) {
      console.warn('Failed to broadcast course publish event', bErr);
    }

    res.json({ data: updated.data });
  } catch (error) {
    logAdminCoursesError(req, error, `Failed to publish course ${id}`);
    res.status(500).json({ error: 'Unable to publish course' });
  }
});

app.post('/api/admin/courses/:id/assign', async (req, res) => {
  console.log('Assign handler called - supabase present?', Boolean(supabase), 'E2E_TEST_MODE=', E2E_TEST_MODE, 'body=', JSON.stringify(req.body));
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const { organization_id, user_ids = [], due_at } = req.body || {};

  if (!organization_id) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, organization_id, { write: true });
  if (!access && context.userRole !== 'admin') return;

  try {
    // Build desired payloads (one per target user or org-wide if no user_ids)
    const desired = (user_ids.length > 0 ? user_ids : [null]).map((userId) => ({
      organization_id,
      course_id: id,
      user_id: userId,
      due_at: due_at ?? null,
      active: true
    }));

    // E2E in-memory fallback branch will run before any Supabase queries
    // when Supabase isn't configured but E2E_TEST_MODE is enabled.
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const existingAssignments = [];
      const toInsert = [];

      for (const item of desired) {
        const found = e2eStore.assignments.find((a) => {
          if (!a) return false;
          if (String(a.organization_id) !== String(item.organization_id)) return false;
          if (String(a.course_id) !== String(item.course_id)) return false;
          if (!a.active) return false;
          if (a.user_id === null && item.user_id === null) return true;
          if (a.user_id === null || item.user_id === null) return false;
          return String(a.user_id) === String(item.user_id);
        });

        if (found) {
          existingAssignments.push(found);
        } else {
          toInsert.push(item);
        }
      }

      const inserted = [];
      for (const it of toInsert) {
        const newAsn = Object.assign({}, it, {
          id: `e2e-asn-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          created_at: new Date().toISOString()
        });
        e2eStore.assignments.push(newAsn);
        inserted.push(newAsn);
      }

      const assignments = [...existingAssignments, ...inserted];

      // Broadcast assignment events for newly created assignments only
      try {
        for (const asn of inserted) {
          const orgId = asn.organization_id || asn.org_id || asn.organization_id || null;
          const topicOrg = orgId ? `assignment:org:${orgId}` : 'assignment:org:global';
          const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
          broadcastToTopic(topicOrg, payload);
          if (asn.user_id) {
            broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
          }
        }
      } catch (bErr) {
        console.warn('Failed to broadcast assignment events', bErr);
      }

      res.status(201).json({ data: assignments });
      return;
    }

    const existingAssignments = [];
    const toInsert = [];

    // Check for existing active assignments to avoid duplicates
    for (const item of desired) {
      let query = supabase.from('assignments').select('*').eq('organization_id', item.organization_id).eq('course_id', item.course_id).eq('active', true).limit(1);
      if (item.user_id === null) {
        query = query.is('user_id', null);
      } else {
        query = query.eq('user_id', item.user_id);
      }

      const { data: existing, error: fetchErr } = await query.maybeSingle();
      if (fetchErr) throw fetchErr;

      if (existing) {
        existingAssignments.push(existing);
      } else {
        toInsert.push(item);
      }
    }

   

    let inserted = [];
    if (toInsert.length > 0) {
      const { data: insData, error: insErr } = await supabase
        .from('assignments')
        .insert(toInsert)
        .select('*');
      if (insErr) throw insErr;
      inserted = insData || [];
    }

    const assignments = [...existingAssignments, ...inserted];

    // Broadcast assignment events for newly created assignments only
    try {
      for (const asn of inserted) {
  const orgId = asn.organization_id || asn.org_id || asn.organization_id || null;
        const topicOrg = orgId ? `assignment:org:${orgId}` : 'assignment:org:global';
        const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
        broadcastToTopic(topicOrg, payload);
        if (asn.user_id) {
          broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
        }
      }
    } catch (bErr) {
      console.warn('Failed to broadcast assignment events', bErr);
    }

    res.status(201).json({ data: assignments });
  } catch (error) {
    logAdminCoursesError(req, error, `Failed to assign course ${id}`);
    res.status(500).json({ error: 'Unable to assign course' });
  }
});

app.delete('/api/admin/courses/:id', async (req, res) => {
  const { id } = req.params;

  // Dev/E2E fallback
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      e2eStore.courses.delete(id);
      persistE2EStore();
      console.log(`✅ Deleted course ${id} from persistent storage`);
      res.status(204).end();
    } catch (error) {
      logAdminCoursesError(req, error, `E2E delete course ${id} failed`);
      res.status(500).json({ error: 'Unable to delete course' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    logAdminCoursesError(req, error, `Failed to delete course ${id}`);
    res.status(500).json({ error: 'Unable to delete course' });
  }
});

app.get('/api/client/courses', async (req, res) => {
  const assignedOnly = String(req.query.assigned || 'false').toLowerCase() === 'true';
  const orgIdRaw = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : null;

  if (assignedOnly && !orgIdRaw) {
    res.status(400).json({ error: 'orgId is required when assigned=true' });
    return;
  }

  const orgId = orgIdRaw;

  const respondWithDemoCourses = () => {
    // In dev/demo mode, show ALL courses (not just published)
    let courses = Array.from(e2eStore.courses.values());

    if (assignedOnly && orgId) {
      const assignedIds = new Set(
        (e2eStore.assignments || [])
          .filter(
            (asn) =>
              asn &&
              asn.active !== false &&
              String(asn.organization_id || asn.org_id || '').trim() === orgId &&
              (asn.user_id === null || typeof asn.user_id === 'undefined')
          )
          .map((asn) => String(asn.course_id))
      );
      courses = courses.filter((course) => assignedIds.has(String(course.id)) || assignedIds.has(String(course.slug)));
    }

    const data = courses.map((c) => ({
      id: c.id,
      slug: c.slug ?? c.id,
      title: c.title,
      description: c.description ?? null,
      status: c.status ?? 'draft',
      version: c.version ?? 1,
      meta_json: c.meta_json ?? {},
      published_at: c.published_at ?? null,
      thumbnail: c.thumbnail ?? null,
      difficulty: c.difficulty ?? null,
      duration: c.duration ?? null,
      instructorName: c.instructorName ?? null,
      estimatedDuration: c.estimatedDuration ?? null,
      keyTakeaways: c.keyTakeaways ?? [],
      modules: (c.modules || []).map((m) => ({
        id: m.id,
        course_id: c.id,
        title: m.title,
        description: m.description ?? null,
        order_index: m.order_index ?? m.order ?? 0,
        lessons: (m.lessons || []).map((l) => ({
          id: l.id,
          module_id: m.id,
          title: l.title,
          description: l.description ?? null,
          type: l.type,
          order_index: l.order_index ?? l.order ?? 0,
          duration_s: l.duration_s ?? null,
          content_json: l.content_json ?? l.content ?? {},
          completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
        })),
      })),
    }));
    res.json({ data });
  };

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    respondWithDemoCourses();
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    let courseQuery = supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' });

    if (assignedOnly && orgId) {
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('assignments')
        .select('course_id')
        .eq('organization_id', orgId)
        .eq('active', true)
        .is('user_id', null);

      if (assignmentError) throw assignmentError;
      const courseIds = Array.from(new Set((assignmentRows || []).map((row) => row.course_id).filter(Boolean)));
      if (courseIds.length === 0) {
        res.json({ data: [] });
        return;
      }
      courseQuery = courseQuery.in('id', courseIds);
    }

    const { data, error } = await courseQuery;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch published courses:', error);
    if (DEV_FALLBACK) {
      console.warn('[client/courses] Falling back to demo dataset because Supabase query failed.');
      respondWithDemoCourses();
      return;
    }
    res.json({ data: [], meta: { warning: 'catalog_unavailable' } });
  }
});

app.get('/api/client/courses/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const includeDrafts = String(req.query.includeDrafts || '').toLowerCase() === 'true';

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      const course = e2eFindCourse(identifier);
      if (!course) {
        res.json({ data: null });
        return;
      }
      // In dev/demo mode, show all courses regardless of status
      // (ignore the includeDrafts query param)

      const data = {
        id: course.id,
        slug: course.slug ?? course.id,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: course.meta_json ?? {},
        published_at: course.published_at ?? null,
        thumbnail: course.thumbnail ?? null,
        difficulty: course.difficulty ?? null,
        duration: course.duration ?? null,
        instructorName: course.instructorName ?? null,
        estimatedDuration: course.estimatedDuration ?? null,
        keyTakeaways: course.keyTakeaways ?? [],
        modules: (course.modules || []).map((m) => ({
          id: m.id,
          course_id: course.id,
          title: m.title,
          description: m.description ?? null,
          order_index: m.order_index ?? m.order ?? 0,
          lessons: (m.lessons || []).map((l) => ({
            id: l.id,
            module_id: m.id,
            title: l.title,
            description: l.description ?? null,
            type: l.type,
            order_index: l.order_index ?? l.order ?? 0,
            duration_s: l.duration_s ?? null,
            content: l.content_json ?? l.content ?? {},
            content_json: l.content_json ?? l.content ?? {},
            completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
          })),
        })),
      };
      res.json({ data });
      return;
    } catch (error) {
      console.error(`E2E fetch course ${identifier} failed:`, error);
      res.status(500).json({ error: 'Unable to load course' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;
  const buildQuery = (column, value) => {
    let query = supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq(column, value)
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' })
      .maybeSingle();
    if (!includeDrafts) query = query.eq('status', 'published');
    return query;
  };
  try {
    let { data, error } = await buildQuery('id', identifier);
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) {
      ({ data, error } = await buildQuery('slug', identifier));
      if (error && error.code !== 'PGRST116') throw error;
    }
    res.json({ data: data ?? null });
  } catch (error) {
    console.error(`Failed to fetch course ${identifier}:`, error);
    res.status(500).json({ error: 'Unable to load course' });
  }
});

// Admin Modules (E2E fallback)
app.post('/api/admin/modules', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(moduleCreateSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const metadata = parsed.metadata ?? {};
    if (!courseId || !title) {
      res.status(400).json({ error: 'courseId and title are required' });
      return;
    }
    const course = e2eFindCourse(courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    // Optional optimistic check: ensure client is targeting expected course version
    if (typeof expectedCourseVersion === 'number') {
      const current = course.version ?? 1;
      if (expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
        return;
      }
    }
    const id = `e2e-mod-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mod = { id, course_id: course.id, title, description, order_index: orderIndex, lessons: [], metadata: metadata ?? {} };
    course.modules = course.modules || [];
    course.modules.push(mod);
    persistE2EStore();
    console.log(`✅ Created module "${title}" in course "${course.title}"`);
    res.status(201).json({ data: { id, course_id: course.id, title, description, order_index: orderIndex } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(moduleCreateSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    if (!courseId || !title) {
      res.status(400).json({ error: 'courseId and title are required' });
      return;
    }
    // Optional optimistic check against parent course version to avoid stale edits
    if (typeof expectedCourseVersion === 'number') {
      const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
      if (fetchErr) throw fetchErr;
      const current = courseRow?.version ?? null;
      if (current !== null && expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
        return;
      }
    }
    const { data, error } = await supabase
      .from('modules')
      .insert({ course_id: courseId, title, description, order_index: orderIndex })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data: { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to create module:', error);
    res.status(500).json({ error: 'Unable to create module' });
  }
});

app.patch('/api/admin/modules/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    const parsed = validateOr400(modulePatchValidator, req, res);
    if (!parsed) return;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const found = e2eFindModule(id);
    if (!found) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    // Optional optimistic check: ensure client is targeting expected course version
    if (typeof expectedCourseVersion === 'number') {
      const current = found.module.version ?? 1;
      if (expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Module has newer version ${current}` });
        return;
      }
    }
    if (typeof title === 'string') found.module.title = title;
    if (description !== undefined) found.module.description = description;
    if (typeof orderIndex === 'number') found.module.order_index = orderIndex;
    persistE2EStore();
    console.log(`✅ Updated module ${id}`);
    res.json({ data: { id: found.module.id, course_id: found.course.id, title: found.module.title, description: found.module.description, order_index: found.module.order_index ?? 0 } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    const parsed = validateOr400(modulePatchValidator, req, res);
    if (!parsed) return;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const patch = {};
    if (typeof title === 'string') patch.title = title;
    if (description !== undefined) patch.description = description;
    if (typeof orderIndex === 'number') patch.order_index = orderIndex;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    // If client provided expected course version, validate against course to avoid stale updates
    if (typeof expectedCourseVersion === 'number') {
      // Fetch parent course id for this module
      const { data: modRow, error: modErr } = await supabase.from('modules').select('id,course_id').eq('id', id).maybeSingle();
      if (modErr) throw modErr;
      const courseId = modRow?.course_id ?? null;
      if (courseId) {
        const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
        if (fetchErr) throw fetchErr;
        const current = courseRow?.version ?? null;
        if (current !== null && expectedCourseVersion < current) {
          res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
          return;
        }
      }
    }
    const { data, error } = await supabase
      .from('modules')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data: { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to update module:', error);
    res.status(500).json({ error: 'Unable to update module' });
  }
});

app.delete('/api/admin/modules/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    const found = e2eFindModule(id);
    if (!found) {
      res.status(204).end();
      return;
    }
    found.course.modules = (found.course.modules || []).filter((m) => String(m.id) !== String(id));
    persistE2EStore();
    console.log(`✅ Deleted module ${id}`);
    res.status(204).end();
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    // Delete lessons first (in case FK cascade not set)
    await supabase.from('lessons').delete().eq('module_id', id);
    await supabase.from('modules').delete().eq('id', id);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete module:', error);
    res.status(500).json({ error: 'Unable to delete module' });
  }
});

app.post('/api/admin/modules/reorder', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(moduleReorderSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const modules = parsed.modules;
    const course = e2eFindCourse(courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const orderMap = new Map((modules || []).map((m) => [String(m.id), pickOrder(m)]));
    (course.modules || []).forEach((m) => {
      const idx = orderMap.get(String(m.id));
      if (typeof idx === 'number') m.order_index = idx;
    });
    const sorted = (course.modules || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    course.modules = sorted;
    persistE2EStore();
    console.log(`✅ Reordered modules in course "${course.title}"`);
    const response = sorted.map((m) => ({ id: m.id, order_index: m.order_index ?? 0 }));
    res.json({ data: response });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(moduleReorderSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const modules = parsed.modules;
    if (!courseId || !Array.isArray(modules)) {
      res.status(400).json({ error: 'courseId and modules are required' });
      return;
    }
    const updates = (modules || []).map((m) => {
      return supabase.from('modules').update({ order_index: pickOrder(m) }).eq('id', m.id);
    });
    await Promise.all(updates);
    const order = modules.map((m) => ({ id: m.id, order_index: pickOrder(m) }));
    res.json({ data: order });
  } catch (error) {
    console.error('Failed to reorder modules:', error);
    res.status(500).json({ error: 'Unable to reorder modules' });
  }
});

// Admin Lessons (E2E fallback)
app.post('/api/admin/lessons', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(lessonCreateSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    if (!moduleId || !title || !type) {
      res.status(400).json({ error: 'moduleId, title and type are required' });
      return;
    }
    const found = e2eFindModule(moduleId);
    if (!found) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    // Optional optimistic check: ensure client targets expected course version
    if (typeof expectedCourseVersion === 'number') {
      const course = found.course;
      const current = course.version ?? 1;
      if (expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
        return;
      }
    }
    const id = `e2e-less-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const lesson = {
      id,
      module_id: moduleId,
      title,
      description,
      type,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: (content && typeof content === 'object') ? (content.body ?? content) : {},
      completion_rule_json: completionRule ?? null,
    };
    found.module.lessons = found.module.lessons || [];
    found.module.lessons.push(lesson);
    persistE2EStore();
    console.log(`✅ Created lesson "${title}" in module "${found.module.title}"`);
    res.status(201).json({ data: { id, module_id: moduleId, title, type, order_index: orderIndex } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(lessonCreateSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    if (!moduleId || !title || !type) {
      res.status(400).json({ error: 'moduleId, title and type are required' });
      return;
    }
    // Optional optimistic check: if client provided expected course version, compare
    if (typeof expectedCourseVersion === 'number') {
      // fetch module to get parent course id
      const { data: modRow, error: modErr } = await supabase.from('modules').select('id,course_id').eq('id', moduleId).maybeSingle();
      if (modErr) throw modErr;
      const courseId = modRow?.course_id ?? null;
      if (courseId) {
        const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
        if (fetchErr) throw fetchErr;
        const current = courseRow?.version ?? null;
        if (current !== null && expectedCourseVersion < current) {
          res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
          return;
        }
      }
    }
    const payload = {
      module_id: moduleId,
      title,
      type,
      description,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: content && typeof content === 'object' ? content.body ?? content : {},
      completion_rule_json: completionRule ?? null,
    };
    const { data, error } = await supabase
      .from('lessons')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data: { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to create lesson:', error);
    res.status(500).json({ error: 'Unable to create lesson' });
  }
});

app.patch('/api/admin/lessons/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    const parsed = validateOr400(lessonPatchValidator, req, res);
    if (!parsed) return;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    const found = e2eFindLesson(id);
    if (!found) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    // Optional optimistic check: ensure client is targeting expected course version
    if (typeof expectedCourseVersion === 'number') {
      const current = found.module.version ?? 1;
      if (expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Module has newer version ${current}` });
        return;
      }
    }
    if (typeof title === 'string') found.lesson.title = title;
    if (typeof type === 'string') found.lesson.type = type;
    if (description !== undefined) found.lesson.description = description;
    if (typeof orderIndex === 'number') found.lesson.order_index = orderIndex;
    if (typeof durationSeconds === 'number') found.lesson.duration_s = durationSeconds;
    if (content !== undefined) found.lesson.content_json = (content && typeof content === 'object') ? (content.body ?? content) : {};
    if (completionRule !== undefined) found.lesson.completion_rule_json = completionRule;
    persistE2EStore();
    console.log(`✅ Updated lesson ${id}`);
    res.json({ data: { id: found.lesson.id, module_id: found.module.id, title: found.lesson.title, type: found.lesson.type, order_index: found.lesson.order_index ?? 0 } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    const parsed = validateOr400(lessonPatchValidator, req, res);
    if (!parsed) return;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const patch = {};
    if (typeof title === 'string') patch.title = title;
    if (typeof type === 'string') patch.type = type;
    if (description !== undefined) patch.description = description;
    if (typeof orderIndex === 'number') patch.order_index = orderIndex;
    if (typeof durationSeconds === 'number') patch.duration_s = durationSeconds;
    if (content !== undefined) patch.content_json = content && typeof content === 'object' ? content.body ?? content : {};
    if (completionRule !== undefined) patch.completion_rule_json = completionRule;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    // If client provided expected course version, validate against parent course to avoid stale edits
    if (typeof expectedCourseVersion === 'number') {
      // resolve parent course via module
      const { data: lessonRow, error: lErr } = await supabase.from('lessons').select('id,module_id').eq('id', id).maybeSingle();
      if (lErr) throw lErr;
      const moduleId = lessonRow?.module_id ?? null;
      if (moduleId) {
        const { data: modRow, error: mErr } = await supabase.from('modules').select('id,course_id').eq('id', moduleId).maybeSingle();
        if (mErr) throw mErr;
        const courseId = modRow?.course_id ?? null;
        if (courseId) {
          const { data: courseRow, error: cErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
          if (cErr) throw cErr;
          const current = courseRow?.version ?? null;
          if (current !== null && expectedCourseVersion < current) {
            res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
            return;
          }
        }
      }
    }
    const { data, error } = await supabase.from('lessons').update(patch).eq('id', id).select('id,module_id,title,type,order_index').maybeSingle();
    if (error) throw error;
    res.json({ data: { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to update lesson:', error);
    res.status(500).json({ error: 'Unable to update lesson' });
  }
});

app.delete('/api/admin/lessons/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    for (const course of e2eStore.courses.values()) {
      for (const mod of course.modules || []) {
        const before = (mod.lessons || []).length;
        mod.lessons = (mod.lessons || []).filter((l) => String(l.id) !== String(id));
        if (mod.lessons.length !== before) {
          persistE2EStore();
          console.log(`✅ Deleted lesson ${id}`);
          res.status(204).end();
          return;
        }
      }
    }
    res.status(204).end();
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    await supabase.from('lessons').delete().eq('id', id);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete lesson:', error);
    res.status(500).json({ error: 'Unable to delete lesson' });
  }
});

app.post('/api/admin/lessons/reorder', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(lessonReorderSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessons = parsed.lessons;
    const found = e2eFindModule(moduleId);
    if (!found) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    const orderMap = new Map((lessons || []).map((l) => [String(l.id), pickOrder(l)]));
    (found.module.lessons || []).forEach((l) => {
      const idx = orderMap.get(String(l.id));
      if (typeof idx === 'number') l.order_index = idx;
    });
    found.module.lessons = (found.module.lessons || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    persistE2EStore();
    console.log(`✅ Reordered lessons in module "${found.module.title}"`);
    const response = (found.module.lessons || []).map((l) => ({ id: l.id, order_index: l.order_index ?? 0 }));
    res.json({ data: response });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(lessonReorderSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessons = parsed.lessons;
    if (!moduleId || !Array.isArray(lessons)) {
      res.status(400).json({ error: 'moduleId and lessons are required' });
      return;
    }
    const updates = (lessons || []).map((l) => {
      return supabase.from('lessons').update({ order_index: pickOrder(l) }).eq('id', l.id);
    });
    await Promise.all(updates);
    const order = lessons.map((l) => ({ id: l.id, order_index: pickOrder(l) }));
    res.json({ data: order });
  } catch (error) {
    console.error('Failed to reorder lessons:', error);
    res.status(500).json({ error: 'Unable to reorder lessons' });
  }
});

// Learner progress endpoint (used by progressService.ts)
app.post('/api/learner/progress', async (req, res) => {
  const snapshot = normalizeSnapshotPayload(req.body || {});

  if (!snapshot) {
    res.status(400).json({ error: 'Invalid progress snapshot payload' });
    return;
  }

  const { userId, courseId, lessons, course } = snapshot;
  const nowIso = new Date().toISOString();

  if (DEV_FALLBACK || E2E_TEST_MODE) {
    console.log('Progress sync request:', {
      userId,
      courseId,
      lessonCount: lessons.length,
      overallPercent: course.percent,
    });
  }

  // Demo/E2E path: persist to in-memory store
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      lessons.forEach((lesson) => {
        const key = `${userId}:${lesson.lessonId}`;
        const record = {
          user_id: userId,
          lesson_id: lesson.lessonId,
          percent: clampPercent(lesson.progressPercent),
          status: lesson.completed ? 'completed' : 'in_progress',
          time_spent_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
          resume_at_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
          updated_at: lesson.lastAccessedAt || nowIso,
        };
        e2eStore.lessonProgress.set(key, record);
        try {
          const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
          broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
          broadcastToTopic(`progress:lesson:${lesson.lessonId}`, payload);
          broadcastToTopic('progress:all', payload);
        } catch (err) {
          console.warn('Failed to broadcast demo lesson progress', err);
        }
      });

      const courseRecord = {
        user_id: userId,
        course_id: courseId,
        percent: clampPercent(course.percent),
        status: course.percent >= 100 ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(course.totalTimeSeconds ?? 0)),
        updated_at: nowIso,
        last_lesson_id: course.lastLessonId ?? null,
        completed_at: course.completedAt ?? null,
      };
      e2eStore.courseProgress.set(`${userId}:${courseId}`, courseRecord);
      persistE2EStore();

      try {
        const payload = { type: 'course_progress', data: courseRecord, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
        broadcastToTopic(`progress:course:${courseId}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch (err) {
        console.warn('Failed to broadcast demo course progress', err);
      }

      res.status(202).json({
        success: true,
        mode: 'demo',
        data: {
          userId,
          courseId,
          updatedLessons: lessons.length,
        },
      });
    } catch (error) {
      console.error('E2E: Failed to sync learner progress snapshot:', error);
      res.status(500).json({ error: 'Unable to sync progress in demo mode' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    let lessonRows = [];
    if (lessons.length > 0) {
      const payload = lessons.map((lesson) => ({
        user_id: userId,
        lesson_id: lesson.lessonId,
        percent: clampPercent(lesson.progressPercent),
        status: lesson.completed ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
        resume_at_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
        last_accessed_at: lesson.lastAccessedAt || nowIso,
      }));

      const { data, error } = await supabase
        .from('user_lesson_progress')
        .upsert(payload, { onConflict: 'user_id,lesson_id' })
        .select('*');

      if (error) throw error;
      lessonRows = data || [];
    }

    const { data: courseRow, error: courseError } = await supabase
      .from('user_course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          percent: clampPercent(course.percent),
          status: course.percent >= 100 ? 'completed' : 'in_progress',
          time_spent_s: Math.max(0, Math.round(course.totalTimeSeconds ?? 0)),
        },
        { onConflict: 'user_id,course_id' },
      )
      .select('*')
      .single();

    if (courseError) throw courseError;

    try {
      const userTopic = `progress:user:${String(userId).toLowerCase()}`;
      lessonRows.forEach((record) => {
        const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
        broadcastToTopic(userTopic, payload);
        if (record.lesson_id) {
          broadcastToTopic(`progress:lesson:${record.lesson_id}`, payload);
        }
        broadcastToTopic('progress:all', payload);
      });

      if (courseRow) {
        const payload = { type: 'course_progress', data: courseRow, timestamp: Date.now() };
        broadcastToTopic(userTopic, payload);
        if (courseRow.course_id) {
          broadcastToTopic(`progress:course:${courseRow.course_id}`, payload);
        }
        broadcastToTopic('progress:all', payload);
      }
    } catch (err) {
      console.warn('Failed to broadcast persisted progress snapshot', err);
    }

    res.status(202).json({
      success: true,
      mode: 'supabase',
      data: {
        userId,
        courseId,
        updatedLessons: lessonRows.length,
      },
    });
  } catch (error) {
    console.error('Failed to sync learner progress:', error);
    dumpErrorContext(req, error);
    res.status(500).json({ error: 'Unable to sync progress' });
  }
});

// GET learner progress endpoint (fetching progress)
app.get('/api/learner/progress', async (req, res) => {
  const lessonIds = parseLessonIdsParam(req.query.lessonIds || req.query.lesson_ids);
  const userId = coerceString(req.query.userId, req.query.user_id, req.query.learnerId, req.query.learner_id);

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  if (lessonIds.length === 0) {
    res.status(400).json({ error: 'lessonIds is required' });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const lessons = lessonIds.map((lessonId) => {
      const record = e2eStore.lessonProgress.get(`${userId}:${lessonId}`) || null;
      return buildLessonRow(lessonId, record);
    });

    res.json({
      data: {
        lessons,
      },
    });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id, percent, status, time_spent_s, last_accessed_at, updated_at')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds);

    if (error) throw error;

    const byLessonId = new Map();
    (data || []).forEach((row) => {
      const lessonId = row.lesson_id || row.lessonId;
      if (!lessonId) return;
      byLessonId.set(String(lessonId), buildLessonRow(String(lessonId), {
        percent: row.percent,
        status: row.status,
        time_spent_s: row.time_spent_s,
        last_accessed_at: row.last_accessed_at,
        updated_at: row.updated_at,
      }));
    });

    const lessons = lessonIds.map((lessonId) => byLessonId.get(lessonId) || buildLessonRow(lessonId, null));

    res.json({
      data: {
        lessons,
      },
    });
  } catch (error) {
    console.error('Failed to fetch learner progress:', error);
    dumpErrorContext(req, error);
    res.status(500).json({ error: 'Unable to fetch progress' });
  }
});

app.post('/api/client/progress/course', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { user_id, course_id, percent, status, time_spent_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;

    if (!user_id || !course_id) {
      res.status(400).json({ error: 'user_id and course_id are required' });
      return;
    }

    // Rate limit per user to avoid abuse
    const rlKey = `course:${String(user_id).toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) {
      res.status(429).json({ error: 'Too many progress updates, please slow down' });
      return;
    }

    const opStart = Date.now();
    try {
      if (clientEventId) {
        if (e2eStore.progressEvents.has(clientEventId)) {
          const key = `${user_id}:${course_id}`;
          const existing = e2eStore.courseProgress.get(key) || null;
          res.json({ data: existing, idempotent: true });
          return;
        }
        e2eStore.progressEvents.add(clientEventId);
      }

      const key = `${user_id}:${course_id}`;
      const now = new Date().toISOString();
      const record = {
        user_id,
        course_id,
        percent: typeof percent === 'number' ? percent : 0,
        status: status || 'in_progress',
        time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0,
        updated_at: now,
      };
      e2eStore.courseProgress.set(key, record);

      try {
        const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(user_id).toLowerCase()}`, payload);
        broadcastToTopic(`progress:course:${course_id}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch (bErr) {
        logger.warn('progress_broadcast_failed', {
          mode: 'demo-store',
          scope: 'course',
          error: bErr instanceof Error ? bErr.message : bErr,
        });
      }

      recordCourseProgress('demo-store', Date.now() - opStart, {
        status: 'success',
        userId: user_id,
        courseId: course_id,
        percent: record.percent,
      });
      res.json({ data: record });
    } catch (error) {
      recordCourseProgress('demo-store', Date.now() - opStart, {
        status: 'error',
        userId: user_id,
        courseId: course_id,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('course_progress_e2e_failed', { error: error instanceof Error ? error.message : error });
      res.status(500).json({ error: 'Unable to save course progress' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  const { user_id, course_id, percent, status, time_spent_s } = req.body || {};
  const clientEventId = req.body?.client_event_id ?? null;

  if (!user_id || !course_id) {
    res.status(400).json({ error: 'user_id and course_id are required' });
    return;
  }

  const rlKey = `course:${String(user_id).toLowerCase()}`;
  if (!checkProgressLimit(rlKey)) {
    res.status(429).json({ error: 'Too many progress updates, please slow down' });
    return;
  }

  try {
    // If client provided an idempotency key, record the event first to avoid double-processing
    if (clientEventId) {
      try {
        await supabase.from('progress_events').insert({ id: clientEventId, user_id, course_id, lesson_id: null, payload: req.body });
      } catch (evErr) {
        // If the event already exists, treat as idempotent and return current progress
        try {
          const existing = await supabase
            .from('user_course_progress')
            .select('*')
            .eq('user_id', user_id)
            .eq('course_id', course_id)
            .maybeSingle();
          if (existing && !existing.error && existing.data) {
            res.json({ data: existing.data, idempotent: true });
            return;
          }
        } catch (fetchErr) {
          // fall through to normal processing
        }
      }
    }
    const { data, error } = await supabase
      .from('user_course_progress')
      .upsert({
        user_id,
        course_id,
        percent: percent ?? 0,
        status: status ?? 'in_progress',
        time_spent_s: time_spent_s ?? 0
      }, { onConflict: 'user_id,course_id' })
      .select('*')
      .single();

    if (error) throw error;
    try {
      const userId = data?.user_id || user_id;
      const courseId = data?.course_id || course_id;
      const payload = { type: 'course_progress', data, timestamp: Date.now() };
      if (userId) broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
      if (courseId) broadcastToTopic(`progress:course:${courseId}`, payload);
      broadcastToTopic('progress:all', payload);
    } catch (bErr) {
      logger.warn('progress_broadcast_failed', {
        scope: 'course',
        mode: 'supabase',
        error: bErr instanceof Error ? bErr.message : bErr,
      });
    }
    recordCourseProgress('supabase', Date.now() - opStart, {
      status: 'success',
      userId: user_id,
      courseId: course_id,
      percent: data?.percent ?? percent ?? 0,
    });

    res.json({ data });
  } catch (error) {
    recordCourseProgress('supabase', Date.now() - opStart, {
      status: 'error',
      userId: user_id,
      courseId: course_id,
      message: error instanceof Error ? error.message : String(error),
    });
    logger.error('course_progress_supabase_failed', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ error: 'Unable to save course progress' });
  }
});

app.post('/api/client/progress/lesson', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;

    if (!user_id || !lesson_id) {
      res.status(400).json({ error: 'user_id and lesson_id are required' });
      return;
    }

    const rlKey = `lesson:${String(user_id).toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) {
      res.status(429).json({ error: 'Too many progress updates, please slow down' });
      return;
    }

    const opStart = Date.now();
    try {
      if (clientEventId) {
        if (e2eStore.progressEvents.has(clientEventId)) {
          const key = `${user_id}:${lesson_id}`;
          const existing = e2eStore.lessonProgress.get(key) || null;
          res.json({ data: existing, idempotent: true });
          return;
        }
        e2eStore.progressEvents.add(clientEventId);
      }

      const key = `${user_id}:${lesson_id}`;
      const now = new Date().toISOString();
      const record = {
        user_id,
        lesson_id,
        percent: typeof percent === 'number' ? percent : 0,
        status: status || 'in_progress',
        time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0,
        resume_at_s: typeof resume_at_s === 'number' ? resume_at_s : null,
        updated_at: now,
      };
      e2eStore.lessonProgress.set(key, record);

      try {
        const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(user_id).toLowerCase()}`, payload);
        broadcastToTopic(`progress:lesson:${lesson_id}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch (bErr) {
        logger.warn('progress_broadcast_failed', {
          mode: 'demo-store',
          scope: 'lesson',
          error: bErr instanceof Error ? bErr.message : bErr,
        });
      }

      recordLessonProgress('demo-store', Date.now() - opStart, {
        status: 'success',
        userId: user_id,
        lessonId: lesson_id,
        percent: record.percent,
      });
      res.json({ data: record });
    } catch (error) {
      recordLessonProgress('demo-store', Date.now() - opStart, {
        status: 'error',
        userId: user_id,
        lessonId: lesson_id,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('lesson_progress_e2e_failed', { error: error instanceof Error ? error.message : error });
      res.status(500).json({ error: 'Unable to save lesson progress' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
  const clientEventId = req.body?.client_event_id ?? null;

  if (!user_id || !lesson_id) {
    res.status(400).json({ error: 'user_id and lesson_id are required' });
    return;
  }

  const rlKey = `lesson:${String(user_id).toLowerCase()}`;
  if (!checkProgressLimit(rlKey)) {
    res.status(429).json({ error: 'Too many progress updates, please slow down' });
    return;
  }

  try {
    if (clientEventId) {
      try {
        await supabase.from('progress_events').insert({ id: clientEventId, user_id, course_id: null, lesson_id, payload: req.body });
      } catch (evErr) {
        try {
          const existing = await supabase
            .from('user_lesson_progress')
            .select('*')
            .eq('user_id', user_id)
            .eq('lesson_id', lesson_id)
            .maybeSingle();
          if (existing && !existing.error && existing.data) {
            res.json({ data: existing.data, idempotent: true });
            return;
          }
        } catch (fetchErr) {}
      }
    }
    const { data, error } = await supabase
      .from('user_lesson_progress')
      .upsert({
        user_id,
        lesson_id,
        percent: percent ?? 0,
        status: status ?? 'in_progress',
        time_spent_s: time_spent_s ?? 0,
        resume_at_s: resume_at_s ?? null
      }, { onConflict: 'user_id,lesson_id' })
      .select('*')
      .single();

    if (error) throw error;
    try {
      const userId = data?.user_id || user_id;
      const lessonId = data?.lesson_id || lesson_id;
      const payload = { type: 'lesson_progress', data, timestamp: Date.now() };
      if (userId) broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
      if (lessonId) broadcastToTopic(`progress:lesson:${lessonId}`, payload);
      broadcastToTopic('progress:all', payload);
    } catch (bErr) {
      logger.warn('progress_broadcast_failed', {
        scope: 'lesson',
        mode: 'supabase',
        error: bErr instanceof Error ? bErr.message : bErr,
      });
    }
    recordLessonProgress('supabase', Date.now() - opStart, {
      status: 'success',
      userId: user_id,
      lessonId: lesson_id,
      percent: data?.percent ?? percent ?? 0,
    });

    res.json({ data });
  } catch (error) {
    recordLessonProgress('supabase', Date.now() - opStart, {
      status: 'error',
      userId: user_id,
      lessonId: lesson_id,
      message: error instanceof Error ? error.message : String(error),
    });
    logger.error('lesson_progress_supabase_failed', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ error: 'Unable to save lesson progress' });
  }
});

// ---------------------------------------------------------------------------
// Batch Progress Endpoint (demo/E2E + Supabase placeholder)
// ---------------------------------------------------------------------------
app.post('/api/client/progress/batch', async (req, res) => {
  const payload = req.body || {};
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length === 0) {
    res.status(400).json({ error: 'events array is required' });
    return;
  }
  if (events.length > 25) {
    res.status(400).json({ error: 'too_many_events', message: 'Max 25 events per batch' });
    return;
  }

  // Demo/E2E mode: apply in-memory updates
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of events) {
      try {
        const id = evt.clientEventId || evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const userId = evt.userId || evt.user_id;
        const lessonId = evt.lessonId || evt.lesson_id || null;
        const courseId = evt.courseId || evt.course_id || null;
        const percentRaw = evt.percent;
        const percent = typeof percentRaw === 'number' ? Math.min(100, Math.max(0, Math.round(percentRaw))) : 0;

        if (!userId) {
          failed.push({ id, reason: 'missing_user' });
          continue;
        }
        if (!courseId && !lessonId) {
          failed.push({ id, reason: 'missing_target' });
          continue;
        }
        if (e2eStore.progressEvents.has(id)) {
          duplicates.push(id);
          continue;
        }
        e2eStore.progressEvents.add(id);

        const nowIso = new Date().toISOString();
        if (lessonId) {
          const key = `${userId}:${lessonId}`;
          const record = {
            user_id: userId,
            lesson_id: lessonId,
            percent,
            status: evt.status || 'in_progress',
            time_spent_s: typeof evt.time_spent_s === 'number' ? evt.time_spent_s : 0,
            resume_at_s: typeof evt.position === 'number' ? evt.position : (typeof evt.resume_at_s === 'number' ? evt.resume_at_s : null),
            updated_at: nowIso,
          };
          e2eStore.lessonProgress.set(key, record);
          try {
            const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
            broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
            broadcastToTopic(`progress:lesson:${lessonId}`, payload);
            broadcastToTopic('progress:all', payload);
          } catch {}
        } else if (courseId) {
          const key = `${userId}:${courseId}`;
          const record = {
            user_id: userId,
            course_id: courseId,
            percent,
            status: evt.status || 'in_progress',
            time_spent_s: typeof evt.time_spent_s === 'number' ? evt.time_spent_s : 0,
            updated_at: nowIso,
          };
            e2eStore.courseProgress.set(key, record);
          try {
            const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
            broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
            broadcastToTopic(`progress:course:${courseId}`, payload);
            broadcastToTopic('progress:all', payload);
          } catch {}
        }
        accepted.push(id);
      } catch (err) {
        failed.push({ id: evt.clientEventId || evt.client_event_id || 'unknown', reason: 'exception' });
      }
    }
    res.json({ accepted, duplicates, failed });
    return;
  }

  // Supabase path placeholder: treat as accepted and respond (Phase 3 will persist)
  if (!ensureSupabase(res)) return;
  try {
    const accepted = events.map((e) => e.clientEventId || e.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    res.json({ accepted, duplicates: [], failed: [] });
  } catch (error) {
    console.error('Failed to process progress batch:', error);
    res.status(500).json({ error: 'Unable to process batch' });
  }
});

// ---------------------------------------------------------------------------
// Batch Analytics Events Endpoint (demo/E2E only for now)
// ---------------------------------------------------------------------------
app.post('/api/analytics/events/batch', async (req, res) => {
  const payload = req.body || {};
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length === 0) {
    res.status(400).json({ error: 'events array is required' });
    return;
  }
  if (events.length > 50) {
    res.status(400).json({ error: 'too_many_events', message: 'Max 50 events per batch' });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of events) {
      const id = evt.clientEventId || evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (e2eStore.progressEvents.has(id)) { // reuse idempotency set
        duplicates.push(id);
        continue;
      }
      try {
        e2eStore.progressEvents.add(id);
        e2eStore.analyticsEvents.push({ ...evt, clientEventId: id, timestamp: evt.timestamp || Date.now() });
        accepted.push(id);
      } catch (err) {
        failed.push({ id, reason: 'exception' });
      }
    }
    res.json({ accepted, duplicates, failed });
    return;
  }

  // Supabase placeholder: just accept (Phase 3 persistence)
  if (!ensureSupabase(res)) return;
  try {
    const accepted = events.map((e) => e.clientEventId || e.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    res.json({ accepted, duplicates: [], failed: [] });
  } catch (error) {
    console.error('Failed to process analytics batch:', error);
    res.status(200).json({ accepted: [], duplicates: [], failed: events.map((evt) => ({ id: evt.clientEventId || evt.client_event_id || 'unknown', reason: 'exception' })) });
  }
});

// ---------------------------------------------------------------------------
// Audit log endpoint (best-effort, never blocks UX)
// ---------------------------------------------------------------------------
app.post('/api/audit-log', async (req, res) => {
  const { action, details = {}, timestamp } = req.body || {};

  if (!action) {
    res.status(400).json({ error: 'action is required' });
    return;
  }

  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    details,
    timestamp: timestamp || new Date().toISOString(),
  };

  const fallback = () => res.status(200).json({ stored: false, status: 'queued' });

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    e2eStore.auditLogs.unshift(entry);
    if (e2eStore.auditLogs.length > 500) {
      e2eStore.auditLogs.length = 500;
    }
    persistE2EStore();
    res.status(201).json({ data: entry, demo: true });
    return;
  }

  if (!supabase) {
    console.warn('[audit-log] Supabase unavailable, acknowledging without persistence');
    fallback();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        action,
        details,
        timestamp: entry.timestamp,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data, stored: true });
  } catch (error) {
    console.error('Failed to persist audit log entry:', error);
    fallback();
  }
});

app.post('/api/client/certificates/:courseId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { courseId } = req.params;
  const { id, user_id, pdf_url, metadata = {} } = req.body || {};

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('certificates')
      .insert({
        id: id ?? undefined,
        user_id,
        course_id: courseId,
        pdf_url: pdf_url ?? null,
        metadata
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create certificate:', error);
    res.status(500).json({ error: 'Unable to create certificate' });
  }
});

app.get('/api/client/certificates', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id } = req.query;

  try {
    let query = supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false });

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

  const { data, error } = await query;

  if (error) throw error;
  await refreshDocumentSignedUrls(data || []);
  res.json({ data });
  } catch (error) {
    console.error('Failed to fetch certificates:', error);
    res.status(500).json({ error: 'Unable to fetch certificates' });
  }
});

// Organization management
app.get('/api/admin/organizations', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    res.status(500).json({ error: 'Unable to fetch organizations' });
  }
});

app.post('/api/admin/organizations', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.name || !payload.contact_email || !payload.subscription) {
    res.status(400).json({ error: 'name, contact_email, and subscription are required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        id: payload.id ?? undefined,
        name: payload.name,
        type: payload.type ?? null,
        description: payload.description ?? null,
        logo: payload.logo ?? null,
        contact_person: payload.contactPerson ?? null,
        contact_email: payload.contactEmail ?? payload.contact_email,
        contact_phone: payload.contactPhone ?? null,
        website: payload.website ?? null,
        address: payload.address ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        country: payload.country ?? null,
        postal_code: payload.postalCode ?? null,
        subscription: payload.subscription,
        billing_email: payload.billingEmail ?? null,
        billing_cycle: payload.billingCycle ?? null,
        custom_pricing: payload.customPricing ?? null,
        max_learners: payload.maxLearners ?? null,
        max_courses: payload.maxCourses ?? null,
        max_storage: payload.maxStorage ?? null,
        features: payload.features ?? {},
        settings: payload.settings ?? {},
        status: payload.status ?? 'active',
        enrollment_date: payload.enrollmentDate ?? null,
        contract_start: payload.contractStart ?? null,
        contract_end: payload.contractEnd ?? null,
        total_learners: payload.totalLearners ?? 0,
        active_learners: payload.activeLearners ?? 0,
        completion_rate: payload.completionRate ?? 0,
        cohorts: payload.cohorts ?? [],
        last_activity: payload.lastActivity ?? null,
        modules: payload.modules ?? {},
        notes: payload.notes ?? null,
        tags: payload.tags ?? []
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create organization:', error);
    res.status(500).json({ error: 'Unable to create organization' });
  }
});

app.put('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const updatePayload = {
      name: patch.name,
      type: patch.type,
      description: patch.description,
      logo: patch.logo,
      contact_person: patch.contactPerson,
      contact_email: patch.contactEmail,
      contact_phone: patch.contactPhone,
      website: patch.website,
      address: patch.address,
      city: patch.city,
      state: patch.state,
      country: patch.country,
      postal_code: patch.postalCode,
      subscription: patch.subscription,
      billing_email: patch.billingEmail,
      billing_cycle: patch.billingCycle,
      custom_pricing: patch.customPricing,
      max_learners: patch.maxLearners,
      max_courses: patch.maxCourses,
      max_storage: patch.maxStorage,
      features: patch.features,
      settings: patch.settings,
      status: patch.status,
      enrollment_date: patch.enrollmentDate,
      contract_start: patch.contractStart,
      contract_end: patch.contractEnd,
      total_learners: patch.totalLearners,
      active_learners: patch.activeLearners,
      completion_rate: patch.completionRate,
      cohorts: patch.cohorts,
      last_activity: patch.lastActivity,
      modules: patch.modules,
      notes: patch.notes,
      tags: patch.tags
    };

    const { data, error } = await supabase
      .from('organizations')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update organization:', error);
    res.status(500).json({ error: 'Unable to update organization' });
  }
});

app.delete('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete organization:', error);
    res.status(500).json({ error: 'Unable to delete organization' });
  }
});

// Organization memberships
app.get('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access && context.userRole !== 'admin') return;

  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('id, user_id, role, invited_by, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    console.error(`Failed to list organization members for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to load organization members' });
  }
});

app.post('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const { userId, role = 'member' } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access && context.userRole !== 'admin') return;

  try {
    const normalizedRole = String(role || 'member').toLowerCase();
    const payload = {
      org_id: orgId,
      user_id: userId,
      role: normalizedRole,
      invited_by: context.userId ?? null
    };

    const { data, error } = await supabase
      .from('organization_memberships')
      .upsert(payload, { onConflict: 'org_id,user_id' })
      .select('id, org_id, user_id, role, invited_by, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error(`Failed to add organization member for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to add organization member' });
  }
});

app.delete('/api/admin/organizations/:orgId/members/:membershipId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, membershipId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const existing = await supabase
      .from('organization_memberships')
      .select('id, org_id, user_id, role')
      .eq('id', membershipId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const membership = existing.data;

    if (!membership) {
      res.status(204).end();
      return;
    }

    if (membership.org_id !== orgId) {
      res.status(400).json({ error: 'Membership does not belong to organization' });
      return;
    }

    const access = await requireOrgAccess(req, res, orgId, { write: true });
    if (!access && context.userRole !== 'admin' && context.userId !== membership.user_id) {
      return;
    }

    const { error } = await supabase
      .from('organization_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to remove organization member ${membershipId}:`, error);
    res.status(500).json({ error: 'Unable to remove organization member' });
  }
});

// Organization workspace
app.get('/api/orgs/:orgId/workspace/access', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  res.json({ data: { orgId, role: access.role } });
});

app.get('/api/orgs/:orgId/workspace', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const [plans, notes, items] = await Promise.all([
      supabase
        .from('org_workspace_strategic_plans')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('org_workspace_session_notes')
        .select('*')
        .eq('org_id', orgId)
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('org_workspace_action_items')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
    ]);

    if (plans.error) throw plans.error;
    if (notes.error) throw notes.error;
    if (items.error) throw items.error;

    const strategicPlans = (plans.data ?? []).map(toStrategicPlan);
    const sessionNotes = (notes.data ?? []).map(toSessionNote);
    const actionItems = sortActionItems((items.data ?? []).map(toActionItem));

    res.json({
      data: {
        orgId,
        strategicPlans,
        sessionNotes,
        actionItems
      }
    });
  } catch (error) {
    console.error(`Failed to load workspace for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to load organization workspace' });
  }
});

app.get('/api/orgs/:orgId/workspace/strategic-plans', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: (data ?? []).map(toStrategicPlan) });
  } catch (error) {
    console.error(`Failed to fetch strategic plans for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch strategic plans' });
  }
});

app.get('/api/orgs/:orgId/workspace/strategic-plans/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Strategic plan version not found' });
      return;
    }

    res.json({ data: toStrategicPlan(data) });
  } catch (error) {
    console.error(`Failed to fetch strategic plan ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch strategic plan version' });
  }
});

app.post('/api/orgs/:orgId/workspace/strategic-plans', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  if (!payload.content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    const insertPayload = {
      org_id: orgId,
      content: payload.content,
      created_by: payload.createdBy ?? null,
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toStrategicPlan(data) });
  } catch (error) {
    console.error(`Failed to create strategic plan for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create strategic plan version' });
  }
});

app.delete('/api/orgs/:orgId/workspace/strategic-plans/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const { error } = await supabase
      .from('org_workspace_strategic_plans')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete strategic plan ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete strategic plan version' });
  }
});

app.get('/api/orgs/:orgId/workspace/session-notes', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_session_notes')
      .select('*')
      .eq('org_id', orgId)
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: (data ?? []).map(toSessionNote) });
  } catch (error) {
    console.error(`Failed to fetch session notes for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch session notes' });
  }
});

app.post('/api/orgs/:orgId/workspace/session-notes', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    const insertPayload = {
      org_id: orgId,
      title: payload.title,
      body: payload.body ?? null,
      note_date: payload.date ?? new Date().toISOString(),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      created_by: payload.createdBy ?? null
    };

    const { data, error } = await supabase
      .from('org_workspace_session_notes')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toSessionNote(data) });
  } catch (error) {
    console.error(`Failed to create session note for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create session note' });
  }
});

app.get('/api/orgs/:orgId/workspace/action-items', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .select('*')
      .eq('org_id', orgId);

    if (error) throw error;
    res.json({ data: sortActionItems((data ?? []).map(toActionItem)) });
  } catch (error) {
    console.error(`Failed to fetch action items for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch action items' });
  }
});

app.post('/api/orgs/:orgId/workspace/action-items', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    const insertPayload = {
      org_id: orgId,
      title: payload.title,
      description: payload.description ?? null,
      assignee: payload.assignee ?? null,
      due_at: payload.dueDate ?? null,
      status: payload.status ?? 'Not Started',
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toActionItem(data) });
  } catch (error) {
    console.error(`Failed to create action item for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create action item' });
  }
});

app.put('/api/orgs/:orgId/workspace/action-items/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const updatePayload = {};
    const map = {
      title: 'title',
      description: 'description',
      assignee: 'assignee',
      dueDate: 'due_at',
      status: 'status',
      metadata: 'metadata'
    };

    Object.entries(map).forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updatePayload[column] = payload[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase
        .from('org_workspace_action_items')
        .select('*')
        .eq('org_id', orgId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'Action item not found' });
        return;
      }

      res.json({ data: toActionItem(data) });
      return;
    }

    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data: toActionItem(data) });
  } catch (error) {
    console.error(`Failed to update action item ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to update action item' });
  }
});

app.delete('/api/orgs/:orgId/workspace/action-items/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const { error } = await supabase
      .from('org_workspace_action_items')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete action item ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete action item' });
  }
});

app.post(
  '/api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/video-upload',
  authenticate,
  requireAdmin,
  videoUpload.single('file'),
  async (req, res) => {
    if (!ensureSupabase(res)) return;

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    if (!file.mimetype || !file.mimetype.startsWith('video/')) {
      res.status(400).json({ error: 'Only video files can be uploaded to lessons' });
      return;
    }

    const courseId = (req.body?.courseId || req.params.courseId || '').trim();
    const moduleId = (req.body?.moduleId || req.params.moduleId || '').trim();
    const lessonId = (req.body?.lessonId || req.params.lessonId || '').trim();

    if (!courseId || !lessonId) {
      res.status(400).json({ error: 'courseId and lessonId are required' });
      return;
    }

    const storagePath = buildLessonVideoStoragePath({
      courseId,
      moduleId: moduleId || 'module',
      lessonId,
      filename: file.originalname || file.fieldname || 'video-upload',
    });

    try {
      const { error: uploadError } = await supabase.storage
        .from(COURSE_VIDEOS_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || 'video/mp4',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = supabase.storage
        .from(COURSE_VIDEOS_BUCKET)
        .getPublicUrl(storagePath);

      if (urlError) throw urlError;

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        res.status(500).json({ error: 'Unable to resolve uploaded video URL' });
        return;
      }

      res.status(201).json({
        data: {
          courseId,
          moduleId,
          lessonId,
          storagePath,
          publicUrl,
          fileName: file.originalname || file.fieldname,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      });
    } catch (error) {
      console.error('[course-videos] Failed to upload lesson video:', error);
      res.status(500).json({ error: 'Unable to upload video file' });
    }
  },
);

const sanitizeFilename = (name = '', fallback = 'file') => {
  const normalized = String(name || fallback)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized : fallback;
};

const sanitizeDocumentFilename = (name = '') => sanitizeFilename(name, 'document');
const sanitizeVideoFilename = (name = '') => sanitizeFilename(name, 'video');
const sanitizePathSegment = (value = '', fallback = 'segment') => sanitizeFilename(value, fallback).replace(/\.+/g, '_');

const buildDocumentStoragePath = ({ orgId, documentId, filename }) => {
  const ownerSegment = orgId ? `org-${orgId}` : 'global';
  const safeName = sanitizeDocumentFilename(filename);
  return [ownerSegment, documentId || randomUUID(), safeName].join('/');
};

const buildLessonVideoStoragePath = ({ courseId, moduleId, lessonId, filename }) => {
  const safeCourse = sanitizePathSegment(courseId, 'course');
  const safeModule = sanitizePathSegment(moduleId, 'module');
  const safeLesson = sanitizePathSegment(lessonId, 'lesson');
  const safeName = sanitizeVideoFilename(filename);
  const timestamp = Date.now();
  return ['courses', safeCourse, safeModule, `${safeLesson}-${timestamp}`, safeName].join('/');
};

const createSignedDocumentUrl = async (storagePath, ttlSeconds = DOCUMENT_URL_TTL_SECONDS) => {
  if (!supabase || !storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, ttlSeconds);
    if (error) throw error;
    if (!data?.signedUrl) return null;
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  } catch (error) {
    console.error(`[documents] Failed to create signed URL for ${storagePath}:`, error);
    return null;
  }
};

const needsSignedUrlRefresh = (record) => {
  const storagePath = record?.storage_path ?? record?.storagePath;
  if (!storagePath) return false;
  const expiresAtRaw = record?.url_expires_at ?? record?.urlExpiresAt;
  if (!expiresAtRaw || !record?.url) return true;
  const expiresAt = Date.parse(expiresAtRaw);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - Date.now() <= DOCUMENT_URL_REFRESH_BUFFER_MS;
};

const refreshDocumentSignedUrls = async (records = []) => {
  if (!supabase) return records;
  const updates = [];

  await Promise.all(
    records.map(async (record) => {
      if (!needsSignedUrlRefresh(record)) return;
      const storagePath = record?.storage_path ?? record?.storagePath;
      const signed = await createSignedDocumentUrl(storagePath);
      if (!signed) return;
      record.url = signed.url;
      record.url_expires_at = signed.expiresAt;
      updates.push({ id: record.id, url: signed.url, url_expires_at: signed.expiresAt });
    }),
  );

  if (updates.length > 0) {
    await Promise.all(
      updates.map(async ({ id, url, url_expires_at }) => {
        const { error } = await supabase
          .from('documents')
          .update({ url, url_expires_at })
          .eq('id', id);
        if (error) {
          console.warn(`[documents] Failed to persist refreshed URL for ${id}:`, error);
        }
      }),
    );
  }

  return records;
};

// Document library
app.post(
  '/api/admin/documents/upload',
  authenticate,
  requireAdmin,
  documentUpload.single('file'),
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    try {
      const rawDocumentId = req.body?.documentId;
      const documentId = typeof rawDocumentId === 'string' && rawDocumentId.trim().length > 0
        ? rawDocumentId
        : rawDocumentId
        ? String(rawDocumentId)
        : `doc_${Date.now()}`;
      const rawOrgId = req.body?.orgId;
      const orgId = typeof rawOrgId === 'string' && rawOrgId.trim().length > 0 ? rawOrgId : rawOrgId ? String(rawOrgId) : null;
      const storagePath = buildDocumentStoragePath({
        orgId,
        documentId,
        filename: file.originalname || file.fieldname || 'upload.bin',
      });

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const signed = await createSignedDocumentUrl(storagePath);
      if (!signed) {
        res.status(500).json({ error: 'Unable to generate signed URL' });
        return;
      }

      res.status(201).json({
        data: {
          documentId,
          storagePath,
          signedUrl: signed.url,
          urlExpiresAt: signed.expiresAt,
          fileType: file.mimetype,
          fileSize: file.size,
        },
      });
    } catch (error) {
      console.error('[documents] Failed to upload file:', error);
      res.status(500).json({ error: 'Unable to upload document file' });
    }
  },
);
app.get('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { org_id, user_id, tag, category, search, visibility } = req.query;

  try {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (org_id) {
      query = query.eq('org_id', org_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

app.post('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.name || !payload.category) {
    res.status(400).json({ error: 'name and category are required' });
    return;
  }

  try {
    let storagePath = payload.storagePath ?? null;
    let url = payload.url ?? null;
    let urlExpiresAt = payload.urlExpiresAt ?? null;

    if (storagePath && (!url || !urlExpiresAt)) {
      const signed = await createSignedDocumentUrl(storagePath);
      if (signed) {
        url = signed.url;
        urlExpiresAt = signed.expiresAt;
      }
    }

    const insertPayload = {
      id: payload.id ?? undefined,
      name: payload.name,
      filename: payload.filename ?? null,
      url,
      category: payload.category,
      subcategory: payload.subcategory ?? null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      file_type: payload.fileType ?? null,
      file_size: typeof payload.fileSize === 'number' ? payload.fileSize : null,
      storage_path: storagePath,
      url_expires_at: urlExpiresAt,
      visibility: payload.visibility ?? 'global',
      org_id: payload.orgId ?? null,
      user_id: payload.userId ?? null,
      created_by: payload.createdBy ?? null,
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create document:', error);
    res.status(500).json({ error: 'Unable to create document' });
  }
});

app.put('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const updatePayload = {};
    const map = {
      name: 'name',
      filename: 'filename',
      url: 'url',
      category: 'category',
      subcategory: 'subcategory',
      tags: 'tags',
      fileType: 'file_type',
      fileSize: 'file_size',
      storagePath: 'storage_path',
      urlExpiresAt: 'url_expires_at',
      visibility: 'visibility',
      orgId: 'org_id',
      userId: 'user_id',
      metadata: 'metadata'
    };

    Object.entries(map).forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        updatePayload[column] = patch[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
      if (error) throw error;
      res.json({ data });
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Unable to update document' });
  }
});

app.post('/api/admin/documents/:id/download', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase.rpc('increment_document_download', { doc_id: id });
    if (error) throw error;
    await refreshDocumentSignedUrls(data ? [data] : []);
    res.json({ data });
  } catch (error) {
    console.error('Failed to record document download:', error);
    res.status(500).json({ error: 'Unable to record download' });
  }
});

app.delete('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data: existing } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;

    if (existing?.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([existing.storage_path]);
      if (storageError) {
        console.warn(`[documents] Failed to delete storage object ${existing.storage_path}:`, storageError);
      }
    }

    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Unable to delete document' });
  }
});

// Surveys
app.get('/api/admin/surveys', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    if (!supabase) {
      res.json({ data: listDemoSurveys() });
      return;
    }

    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const ids = (data || []).map((survey) => survey.id).filter(Boolean);
    const assignmentMap = await fetchSurveyAssignmentsMap(ids);
    const shaped = (data || []).map((survey) => applyAssignmentToSurvey({ ...survey }, assignmentMap.get(survey.id)));
    res.json({ data: shaped });
  } catch (error) {
    console.error('Failed to fetch surveys:', error);
    res.status(500).json({ error: 'Unable to fetch surveys' });
  }
});

app.get('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    if (!supabase) {
      const survey = getDemoSurveyById(id);
      if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
      }
      res.json({ data: survey });
      return;
    }

    const survey = await loadSurveyWithAssignments(id);
    res.json({ data: survey });
  } catch (error) {
    console.error(`Failed to fetch survey ${id}:`, error);
    res.status(500).json({ error: 'Unable to fetch survey' });
  }
});

app.post('/api/admin/surveys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    if (!supabase) {
      const survey = upsertDemoSurvey(payload);
      res.status(201).json({ data: survey });
      return;
    }

    const { assignedTo } = normalizeAssignedTargets(payload);
    const insertPayload = buildSurveyPersistencePayload(payload);

    const { data, error } = await supabase
      .from('surveys')
      .upsert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;

    await syncSurveyAssignments(data.id, assignedTo);
    const survey = await loadSurveyWithAssignments(data.id);
    res.status(201).json({ data: survey });
  } catch (error) {
    console.error('Failed to save survey:', error);
    res.status(500).json({ error: 'Unable to save survey' });
  }
});

app.put('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    if (!supabase) {
      const survey = upsertDemoSurvey({ ...patch, id });
      res.json({ data: survey });
      return;
    }

    const assignmentUpdateRequested = hasAssignmentPayload(patch);
    const { assignedTo } = assignmentUpdateRequested
      ? normalizeAssignedTargets(patch)
      : { assignedTo: undefined };

    const updatePayload = buildSurveyPersistencePayload({ ...patch, id });
    delete updatePayload.id;

    const { data, error } = await supabase
      .from('surveys')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (assignmentUpdateRequested) {
      await syncSurveyAssignments(id, assignedTo);
    }
    const survey = await loadSurveyWithAssignments(id);
    res.json({ data: survey });
  } catch (error) {
    console.error('Failed to update survey:', error);
    res.status(500).json({ error: 'Unable to update survey' });
  }
});

app.delete('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    if (!supabase) {
      const deleted = removeDemoSurvey(id);
      res.status(deleted ? 204 : 404).end();
      return;
    }

    await supabase.from('survey_assignments').delete().eq('survey_id', id);
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete survey:', error);
    res.status(500).json({ error: 'Unable to delete survey' });
  }
});

// Notifications
app.get('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { org_id, user_id } = req.query;
  const context = requireUserContext(req, res);
  if (!context) return;

  const isAdmin = context.userRole === 'admin';

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (org_id) {
      const access = await requireOrgAccess(req, res, org_id);
      if (!access && !isAdmin) return;
      query = query.eq('org_id', org_id);
    }

    if (user_id) {
      if (!isAdmin && context.userId && user_id !== context.userId) {
        res.status(403).json({ error: 'Cannot view notifications for another user' });
        return;
      }
      query = query.eq('user_id', user_id);
    } else if (!isAdmin) {
      if (!context.userId) {
        res.status(400).json({ error: 'user_id is required for non-admin queries' });
        return;
      }
      query = query.eq('user_id', context.userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const filtered = isAdmin
      ? data
      : (data || []).filter((note) => {
          if (note.user_id) return note.user_id === context.userId;
          if (note.org_id) return true;
          return false;
        });

    res.json({ data: filtered });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Unable to fetch notifications' });
  }
});

app.post('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  if (payload.orgId) {
    const access = await requireOrgAccess(req, res, payload.orgId, { write: true });
    if (!access && !isAdmin) return;
  } else if (payload.userId) {
    if (!isAdmin && payload.userId !== context.userId) {
      res.status(403).json({ error: 'Cannot create notifications for another user' });
      return;
    }
  } else if (!isAdmin) {
    res.status(403).json({ error: 'Only admins can create global notifications' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        id: payload.id ?? undefined,
        title: payload.title,
        body: payload.body ?? null,
        org_id: payload.orgId ?? null,
        user_id: payload.userId ?? null,
        read: payload.read ?? false
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Unable to create notification' });
  }
});

app.post('/api/admin/notifications/:id/read', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const { read = true } = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const note = existing.data;
    if (!note) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({ error: 'Cannot modify another user\'s notification' });
          return;
        }
      } else if (note.org_id) {
        const access = await requireOrgAccess(req, res, note.org_id);
        if (!access) return;
      } else {
        res.status(403).json({ error: 'Cannot modify global notification' });
        return;
      }
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ read })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update notification status:', error);
    res.status(500).json({ error: 'Unable to update notification' });
  }
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const note = existing.data;
    if (!note) {
      res.status(204).end();
      return;
    }

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({ error: 'Cannot delete another user\'s notification' });
          return;
        }
      } else if (note.org_id) {
        const access = await requireOrgAccess(req, res, note.org_id, { write: true });
        if (!access) return;
      } else {
        res.status(403).json({ error: 'Cannot delete global notification' });
        return;
      }
    }

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Unable to delete notification' });
  }
});

app.post('/api/analytics/events', async (req, res) => {
  const { id, user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload, org_id } = req.body || {};

  const normalizedEvent = typeof event_type === 'string' ? event_type.trim() : '';
  if (!normalizedEvent) {
    res.status(400).json({ error: 'event_type is required' });
    return;
  }

  const respondQueued = (meta = {}) => res.json({ status: 'queued', stored: false, ...meta });
  const respondStored = (meta = {}) => res.json({ status: 'stored', stored: true, ...meta });

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const eventId = id || `demo-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id: eventId,
      user_id: user_id ?? null,
      org_id: org_id ?? null,
      course_id: course_id ?? null,
      lesson_id: lesson_id ?? null,
      module_id: module_id ?? null,
      event_type: normalizedEvent,
      session_id: session_id ?? null,
      user_agent: user_agent ?? null,
      payload: payload ?? {},
      created_at: new Date().toISOString(),
    };
    e2eStore.analyticsEvents.unshift(record);
    if (e2eStore.analyticsEvents.length > 500) {
      e2eStore.analyticsEvents.length = 500;
    }
    persistE2EStore();
    respondStored({ data: record, demo: true });
    return;
  }

  if (!supabase) {
    console.warn('[analytics.events] Supabase unavailable, acknowledging event without persistence.');
    respondQueued({ reason: 'supabase_disabled' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        id: id ?? undefined,
        user_id: user_id ?? null,
        org_id: org_id ?? null,
        course_id: course_id ?? null,
        lesson_id: lesson_id ?? null,
        module_id: module_id ?? null,
        event_type: normalizedEvent,
        session_id: session_id ?? null,
        user_agent: user_agent ?? null,
        payload: payload ?? {},
      })
      .select('*')
      .single();

    if (error) throw error;
    respondStored({ data });
  } catch (error) {
    console.error('Failed to record analytics event:', error);
    respondQueued({ reason: 'persistence_failed' });
  }
});

app.post('/api/audit-log', async (req, res) => {
  const { action, details = {}, timestamp, userId, user_id, orgId, org_id } = req.body || {};

  const normalizedAction = typeof action === 'string' ? action.trim() : '';
  if (!normalizedAction) {
    res.status(400).json({ error: 'action is required' });
    return;
  }

  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: normalizedAction,
    details,
    user_id: userId ?? user_id ?? null,
    org_id: orgId ?? org_id ?? null,
    timestamp: timestamp || new Date().toISOString(),
  };

  const respondOk = (meta = {}) => res.json({ ok: true, ...meta });

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    e2eStore.auditLogs.unshift(entry);
    if (e2eStore.auditLogs.length > 500) {
      e2eStore.auditLogs.length = 500;
    }
    persistE2EStore();
    respondOk({ demo: true, stored: true, entry });
    return;
  }

  if (!supabase) {
    console.warn('[audit-log] Supabase unavailable, acknowledging without persistence');
    respondOk({ stored: false, reason: 'supabase_disabled' });
    return;
  }

  try {
    const { error } = await supabase.from('audit_logs').insert({
      action: entry.action,
      details: entry.details,
      user_id: entry.user_id,
      org_id: entry.org_id,
      timestamp: entry.timestamp,
    });

    if (error) throw error;
    respondOk({ stored: true });
  } catch (error) {
    console.error('Failed to persist audit log entry:', error);
    respondOk({ stored: false, reason: 'persistence_failed' });
  }
});

app.post('/api/analytics/journeys', async (req, res) => {
  const { user_id, course_id, journey } = req.body || {};

  if (!user_id || !course_id) {
    res.status(400).json({ error: 'user_id and course_id are required' });
    return;
  }

  const payload = {
    user_id,
    course_id,
    started_at: journey?.startedAt ?? new Date().toISOString(),
    last_active_at: journey?.lastActiveAt ?? new Date().toISOString(),
    completed_at: journey?.completedAt ?? null,
    total_time_spent: journey?.totalTimeSpent ?? 0,
    sessions_count: journey?.sessionsCount ?? 0,
    progress_percentage: journey?.progressPercentage ?? 0,
    engagement_score: journey?.engagementScore ?? 0,
    milestones: journey?.milestones ?? [],
    drop_off_points: journey?.dropOffPoints ?? [],
    path_taken: journey?.pathTaken ?? [],
    updated_at: new Date().toISOString(),
  };

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const key = `${user_id}:${course_id}`;
    e2eStore.learnerJourneys.set(key, { id: key, ...payload });
    persistE2EStore();
    res.status(201).json({ data: e2eStore.learnerJourneys.get(key), demo: true });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('learner_journeys')
      .upsert(payload, { onConflict: 'user_id,course_id' })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to upsert learner journey:', error);
    res.status(500).json({ error: 'Unable to save learner journey' });
  }
});

app.get('/api/analytics/journeys', async (req, res) => {
  const { user_id, course_id } = req.query;

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    let data = Array.from(e2eStore.learnerJourneys.values());
    if (user_id) {
      data = data.filter((journey) => journey.user_id === user_id);
    }
    if (course_id) {
      data = data.filter((journey) => journey.course_id === course_id);
    }
    res.json({ data, demo: true });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    let query = supabase
      .from('learner_journeys')
      .select('*');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch learner journeys:', error);
    res.status(500).json({ error: 'Unable to fetch learner journeys' });
  }
});

const distPath = path.resolve(__dirname, '../dist');

// Serve static files from the dist directory
app.use(express.static(distPath));

// Ensure a simple root handler exists for platforms that hit the root URL for health checks
app.get('/', (_req, res) => {
  const indexFile = path.join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  return res.status(200).send('OK');
});

// For SPA client-side routing — serve index.html for unknown routes
// Use a non-wildcard param pattern to avoid path-to-regexp parsing issues on some Node/express versions.
// Serve index.html for SPA routes that aren't API or WS. Use a middleware to avoid
// registering a path pattern that trips path-to-regexp in some environments.
app.use((req, res, next) => {
  // Only handle GET requests that are not API or WS paths
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/_next')) return next();

  const indexFile = path.join(distPath, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) return next(err);
  });
});

app.use(apiErrorHandler);

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving production build from ${distPath} at http://0.0.0.0:${PORT}`);
});

// Initialize WebSocket server (ws) to handle realtime broadcasts at /ws
try {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const originHeader = req.headers.origin;

    if (!isAllowedOrigin(originHeader)) {
      console.warn('[WS] Connection attempt blocked', { origin: originHeader || '(none)' });
      try {
        ws.close(1008, 'Origin not allowed');
      } catch (e) {
        console.warn('[WS] Error closing blocked socket', e);
      }
      return;
    }

    console.log('[WS] Client connected', {
      ip: req.socket.remoteAddress,
      origin: originHeader || '(none)'
    });

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === 'subscribe' && msg.topic) {
          subscribeClientToTopic(ws, msg.topic);
        } else if (msg.type === 'unsubscribe' && msg.topic) {
          unsubscribeClientFromTopic(ws, msg.topic);
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
        console.warn('[WS] Invalid message payload', err);
      }
    });

    ws.on('close', () => {
      for (const [, set] of topicSubscribers) set.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WS] Client error', err);
    });
  });

  console.log('WebSocket server initialized at /ws');
} catch (err) {
  console.warn('Failed to initialize WebSocket server:', err);
}
