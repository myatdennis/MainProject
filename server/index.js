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
import { randomUUID, createHash } from 'crypto';
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
  analyticsBatchSchema,
  analyticsEventIngestSchema,
} from './validators.js';
import { logger } from './lib/logger.js';
import { isAllowedWsOrigin } from './lib/wsOrigins.js';
import { withCache, invalidateCacheKeys } from './services/cacheService.js';
import { enqueueJob, registerJobProcessor, hasQueueBackend } from './jobs/taskQueue.js';
import setupNotificationDispatcher from './services/notificationDispatcher.js';
import { validateCourse as validatePublishableCourse } from './lib/courseValidation.js';
import { getSupabaseConfig } from './config/supabaseConfig.js';
import { normalizeModuleLessonPayloads, shouldLogModuleNormalization, coerceTextId } from './lib/moduleLessonNormalizer.js';

// Import auth routes and middleware
import authRoutes from './routes/auth.js';
import adminAnalyticsRoutes from './routes/admin-analytics.js';
import adminAnalyticsExport from './routes/admin-analytics-export.js';
import adminAnalyticsSummary from './routes/admin-analytics-summary.js';
import { apiLimiter, securityHeaders, authenticate, requireAdmin, optionalAuthenticate } from './middleware/auth.js';
import supabaseJwtMiddleware from './middleware/supabaseJwt.js';
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
  FORCE_ORG_ENFORCEMENT,
  demoLoginEnabled,
  describeDemoMode,
  supabaseServerConfigured,
  parseFlag,
} from './config/runtimeFlags.js';
import { sendEmail } from './services/emailService.js';
import { createMediaService } from './services/mediaService.js';
import { isJwtSecretConfigured } from './utils/jwt.js';
import { writeErrorDiagnostics, summarizeRequestBody } from './utils/errorDiagnostics.js';
import {
  COURSE_WITH_MODULES_LESSONS_SELECT,
  MODULE_LESSONS_FOREIGN_TABLE,
  COURSE_MODULES_WITH_LESSON_FIELDS,
  COURSE_MODULES_NO_LESSONS_FIELDS,
} from './constants/courseSelect.js';
import { courseUpsertPayloadSchema } from '../shared/contracts/courseContract.js';
import sql from './db.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diagnostics/metrics helpers are optional; provide safe no-op fallbacks so
// the server never crashes if the diagnostics bundle is missing.
const recordCourseProgress = () => {};
const recordLessonProgress = () => {};
const recordProgressBatch = () => {};
const recordSupabaseHealth = () => {};
const getMetricsSnapshot = () => ({
  analyticsIngest: { lastBatch: null, status: 'unknown' },
  progressBatch: { lastSuccessAt: null, status: 'unknown' },
});

const shouldLogAuthDebug =
  NODE_ENV !== 'production' || String(process.env.ENABLE_AUTH_DEBUG || '').toLowerCase() === 'true';

const fatalEnvError = (message) => {
  console.error(`[env] ${message}`);
  process.exit(1);
};

const warnEnv = (message) => {
  console.warn(`[env] ${message}`);
};

const placeholderPatterns = [
  /REPLACE_ME/i,
  /CHANGE_ME/i,
  /your-very-secret/i,
  /public-anon-key-here/i,
  /service-role-secret/i,
];

const hasPlaceholderValue = (value) => {
  if (!value || typeof value !== 'string') return false;
  return placeholderPatterns.some((pattern) => pattern.test(value));
};

const isConflictConstraintMissing = (error) => {
  if (!error) return false;
  if (error.code === '42P10') return true;
  const message = typeof error.message === 'string' ? error.message : '';
  return /no unique or exclusion constraint matching the on conflict specification/i.test(message);
};

const isUserCourseProgressUuidColumnMissing = (error) => {
  if (!isMissingColumnError(error)) return false;
  const missing = normalizeColumnIdentifier(extractMissingColumnName(error));
  return missing === 'user_id_uuid';
};

const warnOnPlaceholderSecrets = () => {
  const sensitiveEnvVars = [
    'SUPABASE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
    'BROADCAST_API_KEY',
  ];
  const flagged = sensitiveEnvVars.filter((key) => hasPlaceholderValue(process.env[key]));
  if (flagged.length > 0) {
    warnEnv(`Placeholder values detected for sensitive env vars: ${flagged.join(', ')}. Update them before production.`);
  }
};

const logRouteError = (route, error) => {
  logger.error('api_route_error', {
    route,
    message: error?.message || String(error),
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    stack: error?.stack,
  });
};

const ORG_HEADER_KEYS = ['x-org-id', 'x-organization-id', 'x_org_id', 'x_organization_id'];

const ensureEnvironmentIsValid = () => {
  const baseRequired = ['CORS_ALLOWED_ORIGINS'];
  const missingBase = baseRequired.filter((key) => !(process.env[key] || '').trim());
  if (missingBase.length) {
    const msg = `Missing recommended environment variables: ${missingBase.join(', ')}`;
    if (isProduction) {
      fatalEnvError(msg);
    } else {
      warnEnv(msg);
    }
  }

  const prodRequired = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'];
  const missingProd = prodRequired.filter((key) => !(process.env[key] || '').trim());
  if (isProduction && missingProd.length) {
    fatalEnvError(`Missing required production environment variables: ${missingProd.join(', ')}`);
  }

  if (isProduction && !supabaseServerConfigured) {
    fatalEnvError('Supabase credentials are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (isProduction) {
    const demoFlags = ['ALLOW_DEMO', 'DEMO_MODE', 'DEV_FALLBACK'].filter((key) => parseFlag(process.env[key]));
    if (demoFlags.length) {
      fatalEnvError(`Demo fallback modes are disallowed in production. Remove: ${demoFlags.join(', ')}`);
    }
  }

  warnOnPlaceholderSecrets();
};

ensureEnvironmentIsValid();

// Persistent storage file for demo mode
const STORAGE_FILE = path.join(__dirname, 'demo-data.json');
// Safety guard to avoid loading extremely large demo files that could trigger OOM (exit 137)
const MAX_DEMO_FILE_BYTES = parseInt(process.env.DEMO_DATA_MAX_BYTES || '', 10) || 25 * 1024 * 1024; // 25MB default

const supabaseEnv = getSupabaseConfig();
const initialDemoModeMetadata = describeDemoMode();
const supabaseUrlHost = (() => {
  if (!supabaseEnv.url) return null;
  try {
    return new URL(supabaseEnv.url).host || null;
  } catch (_error) {
    return null;
  }
})();
logger.info('demo_mode_configuration', { metadata: initialDemoModeMetadata });
logger.info('startup_supabase_config', {
  supabaseConfigured: supabaseEnv.configured,
  devFallback: Boolean(DEV_FALLBACK),
  demoMode: initialDemoModeMetadata.enabled ? initialDemoModeMetadata.source || 'enabled' : 'disabled',
  supabaseUrlHost,
  serviceRoleKeyPresent: Boolean(supabaseEnv.serviceRoleKey),
});
if (supabaseEnv.configured && DEV_FALLBACK) {
  logger.warn('dev_fallback_overrides_supabase', {
    message: 'Supabase credentials detected but DEV_FALLBACK=true forces in-memory demo mode.',
  });
}

const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const inferredCookieDomain = process.env.COOKIE_DOMAIN || (isProduction ? '(request hostname derived)' : null);
const cookieSameSite = isProduction ? 'none' : 'lax';
const cookieSecure = isProduction;
logger.info('startup_env_diagnostics', {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 8888,
  supabaseConfigured: supabaseEnv.configured,
  jwtSecretConfigured: isJwtSecretConfigured,
  cookie: {
    domain: inferredCookieDomain,
    sameSite: cookieSameSite,
    secure: cookieSecure,
  },
  corsOrigins,
});

const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'course-resources';
const DOCUMENT_UPLOAD_MAX_BYTES = Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 150 * 1024 * 1024);
const DOCUMENT_URL_TTL_SECONDS = Number(process.env.DOCUMENT_SIGN_TTL_SECONDS || 60 * 60 * 24 * 7);
const DOCUMENT_URL_REFRESH_BUFFER_SECONDS = Number(process.env.DOCUMENT_URL_REFRESH_BUFFER_SECONDS || 60 * 5);
const DOCUMENT_URL_REFRESH_BUFFER_MS = DOCUMENT_URL_REFRESH_BUFFER_SECONDS * 1000;
const COURSE_VIDEOS_BUCKET = process.env.SUPABASE_VIDEOS_BUCKET || 'course-videos';
const COURSE_VIDEO_UPLOAD_MAX_BYTES = Number(process.env.COURSE_VIDEO_UPLOAD_MAX_BYTES || 750 * 1024 * 1024);
const REQUIRED_SUPABASE_BUCKETS = Array.from(new Set([COURSE_VIDEOS_BUCKET, DOCUMENTS_BUCKET].filter(Boolean)));

const WS_SERVER_PATH = process.env.WS_SERVER_PATH || '/ws';
const wsHealthSnapshot = {
  path: WS_SERVER_PATH,
  enabled: false,
  lastError: null,
  lastStartedAt: null,
};

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
app.set('etag', false);

import healthRouter from './routes/health.js';
import corsMiddleware, { resolvedCorsOrigins } from './middleware/cors.js';
import { getCookieOptions } from './middleware/cookieOptions.js';
import { describeCookiePolicy } from './utils/authCookies.js';
import { env } from './utils/env.js';
import { log } from './utils/logger.js';
import { handleError } from './utils/errorHandler.js';
import {
  isMissingColumnError,
  isMissingRelationError,
  normalizeColumnIdentifier,
  extractMissingColumnName,
} from './utils/errors.js';

const fsp = fs.promises;
const PROGRESS_BATCH_MAX_SIZE = Number(process.env.PROGRESS_BATCH_MAX_SIZE || 100);
const PROGRESS_BATCH_MAX_BYTES = Number(process.env.PROGRESS_BATCH_MAX_BYTES || 256 * 1024);
const HEALTH_STREAM_INTERVAL_MS = Number(process.env.HEALTH_STREAM_INTERVAL_MS || 5000);
const HEALTH_STREAM_RETRY_MS = Number(process.env.HEALTH_STREAM_RETRY_MS || 5000);
const HEALTH_STREAM_HEARTBEAT_MS = Number(process.env.HEALTH_STREAM_HEARTBEAT_MS || 15000);
const ANALYTICS_PII_SALT = process.env.ANALYTICS_PII_SALT || 'analytics-salt';
const ANALYTICS_PII_FIELDS = new Set([
  'email',
  'user_email',
  'useremail',
  'teacher_email',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'full_name',
  'fullname',
  'name',
  'phone',
  'phone_number',
  'phonenumber',
  'address',
  'street',
  'city',
  'state',
  'postal_code',
  'zip',
  'company',
  'title',
]);

const getSupabaseProjectRef = (url) => {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    if (!hostname) return null;
    const [subdomain] = hostname.split('.');
    return subdomain || null;
  } catch {
    return null;
  }
};

const cookiePolicySnapshot = describeCookiePolicy();
log('info', 'http_cookie_policy', cookiePolicySnapshot);
log('info', 'http_cors_policy', {
  allowedOrigins: resolvedCorsOrigins,
  allowCredentials: false,
});

app.get('/api/health/db', async (_req, res) => {
  try {
    const result = await checkSupabaseHealth();
    const ok = result.status === 'ok';
    const statusCode = ok ? 200 : result.status === 'disabled' ? 503 : 502;
    res.status(statusCode).json({
      ok,
      status: result.status,
      latencyMs: result.latencyMs ?? null,
      message: result.message ?? null,
      demoFallback: Boolean(DEV_FALLBACK || E2E_TEST_MODE),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'db_health_failed',
    });
  }
});

app.get('/api/admin/courses/health/upsert-course-rpc', authenticate, requireAdmin, async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || null;
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  let rpcExists = null;
  let rpcError = null;

  if (!process.env.DATABASE_URL) {
    rpcError = 'DATABASE_URL not configured';
  } else {
    try {
      const rows = await sql`
        select exists (
          select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'upsert_course_full'
            and pg_get_function_identity_arguments(p.oid) = 'jsonb, jsonb'
        ) as exists
      `;
      rpcExists = Boolean(rows?.[0]?.exists);
    } catch (error) {
      rpcError = error instanceof Error ? error.message : String(error);
    }
  }

  res.json({
    data: {
      supabaseUrl,
      projectRef,
      rpc: {
        name: 'public.upsert_course_full',
        args: ['jsonb', 'jsonb'],
        exists: rpcExists,
        error: rpcError,
      },
    },
  });
});

// ✅ PUBLIC runtime status (no auth)
// This endpoint is used by the frontend to decide if the API is reachable.
// It should NOT require a Bearer token.
app.get('/api/runtime-status', (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || process.env.ENV || 'production',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || process.env.VERSION || '0.0.0',
    apiHealthy: true,
    supabaseConfigured: Boolean(process.env.SUPABASE_URL),
  });
});

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

const hashPiiValue = (value) =>
  createHash('sha256').update(String(value || '')).update(ANALYTICS_PII_SALT).digest('hex');

const scrubAnalyticsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return {};

  const scrub = (value, key = '') => {
    if (Array.isArray(value)) {
      return value.map((item) => scrub(item, key));
    }
    if (value && typeof value === 'object') {
      const clone = {};
      Object.entries(value).forEach(([childKey, childValue]) => {
        clone[childKey] = scrub(childValue, childKey);
      });
      return clone;
    }
    if (typeof value === 'string' && key && ANALYTICS_PII_FIELDS.has(key.toLowerCase())) {
      return hashPiiValue(value.trim());
    }
    return value;
  };

  return scrub(payload);
};

const getOfflineQueueHealth = () => {
  const backlog = readOfflineQueueBacklog();
  if (backlog < 0) {
    return { status: 'unknown', backlog, warnAt: OFFLINE_QUEUE_WARN_AT };
  }
  if (backlog >= OFFLINE_QUEUE_WARN_AT) {
    return { status: 'degraded', backlog, warnAt: OFFLINE_QUEUE_WARN_AT };
  }
  return { status: 'ok', backlog, warnAt: OFFLINE_QUEUE_WARN_AT };
};

const getStorageHealth = async () => {
  try {
    const stats = await fsp.stat(STORAGE_FILE);
    return { status: 'ok', sizeBytes: stats.size, updatedAt: stats.mtime.toISOString() };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { status: 'ok', reason: 'snapshot_missing' };
    }
    return { status: 'degraded', message: error instanceof Error ? error.message : String(error) };
  }
};

const deriveOverallStatus = (statuses = []) => {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('degraded')) return 'degraded';
  return 'ok';
};

const buildHealthPayload = async (overrides = {}) => {
  const [supabaseHealth, storageHealth] = await Promise.all([
    checkSupabaseHealth().catch((error) => {
      logger.warn('supabase_health_probe_failed', { message: error instanceof Error ? error.message : error });
      return { status: 'error', message: 'probe_failed' };
    }),
    getStorageHealth().catch((error) => ({
      status: 'degraded',
      message: error instanceof Error ? error.message : String(error),
    })),
  ]);
  const offlineQueue = getOfflineQueueHealth();
  const metrics = getMetricsSnapshot();
  const lastBatchAt = metrics.analyticsIngest?.lastBatch?.at;
  const analyticsIngestLagMs = lastBatchAt ? Date.now() - Date.parse(lastBatchAt) : null;
  const overallStatus = deriveOverallStatus([
    supabaseHealth.status || 'unknown',
    offlineQueue.status || 'unknown',
    storageHealth.status || 'unknown',
  ]);

  return {
    status: overallStatus,
    generatedAt: new Date().toISOString(),
    supabase: supabaseHealth,
    offlineQueue,
    storage: storageHealth,
    analyticsIngestLagMs,
    metrics: {
      analyticsIngest: metrics.analyticsIngest,
      progressBatch: metrics.progressBatch,
    },
    featureFlags: {
      forceOrgEnforcement: Boolean(FORCE_ORG_ENFORCEMENT),
      devFallback: Boolean(DEV_FALLBACK),
    },
    orgEnforcement: {
      enforced: Boolean(FORCE_ORG_ENFORCEMENT),
      devFallback: Boolean(DEV_FALLBACK),
    },
    realtime: {
      wsEnabled: Boolean(wsHealthSnapshot.enabled),
      wsPath: wsHealthSnapshot.path,
      wsError: wsHealthSnapshot.lastError,
      wsLastStartedAt: wsHealthSnapshot.lastStartedAt,
    },
    ...overrides,
  };
};

app.post('/api/admin/courses/:id/assign', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const body = normalizeLegacyOrgInput(req.body ?? {}, {
    surface: 'admin.courses.assign',
    requestId: req.requestId,
  });
  const resolveOrgId = body.organization_id ?? body.organizationId;
  const organizationId = typeof resolveOrgId === 'string'
    ? resolveOrgId.trim()
    : resolveOrgId
      ? String(resolveOrgId).trim()
      : '';

  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  const hasBodyKey = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const rawUserIds = Array.isArray(body.user_ids)
    ? body.user_ids
    : Array.isArray(body.userIds)
      ? body.userIds
      : [];
  const normalizedUserIds = Array.from(
    new Set(
      rawUserIds
        .map((value) => {
          if (typeof value === 'string') return value.trim().toLowerCase();
          if (value === null || typeof value === 'undefined') return '';
          return String(value).trim().toLowerCase();
        })
        .filter(Boolean)
    )
  );
  const assignmentMode = body.mode === 'organization' ? 'organization' : normalizedUserIds.length > 0 ? 'learners' : 'organization';

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, organizationId, { write: true, requireOrgAdmin: true });
  if (!access && context.userRole !== 'admin') return;

  const dueProvided = hasBodyKey('due_at') || hasBodyKey('dueAt');
  const rawDueAt = body.due_at ?? body.dueAt ?? null;
  const dueAtValue = dueProvided ? (rawDueAt ? String(rawDueAt) : null) : null;

  const noteProvided = hasBodyKey('note');
  const rawNote = body.note ?? null;
  const noteValue = noteProvided ? (typeof rawNote === 'string' ? rawNote : rawNote === null ? null : String(rawNote)) : null;

  const assignedByRaw = body.assigned_by ?? body.assignedBy;
  const assignedBy = typeof assignedByRaw === 'string' && assignedByRaw.trim().length > 0
    ? assignedByRaw.trim()
    : context.userId;

  const statusProvided = typeof body.status === 'string';
  const allowedStatuses = new Set(['assigned', 'in-progress', 'completed']);
  const requestedStatus = statusProvided ? String(body.status).toLowerCase() : '';
  const statusValue = allowedStatuses.has(requestedStatus) ? requestedStatus : 'assigned';

  const progressProvided = typeof body.progress === 'number';
  let progressValue = progressProvided ? Math.min(100, Math.max(0, Number(body.progress))) : undefined;
  if (!progressProvided) {
    progressValue = statusValue === 'completed' ? 100 : statusValue === 'in-progress' ? 50 : 0;
  } else if (statusValue === 'completed' && progressValue < 100) {
    progressValue = 100;
  }

  const idempotencyKeyRaw = body.idempotency_key ?? body.idempotencyKey;
  const idempotencyKey = typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
    ? idempotencyKeyRaw.trim()
    : null;
  const clientRequestIdRaw = body.client_request_id ?? body.clientRequestId;
  const clientRequestId = typeof clientRequestIdRaw === 'string' && clientRequestIdRaw.trim().length > 0
    ? clientRequestIdRaw.trim()
    : null;

  const metadataInput = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};
  let metadata = {};
  try {
    metadata = JSON.parse(JSON.stringify(metadataInput));
  } catch (error) {
    metadata = {};
  }
  metadata = {
    ...metadata,
    mode: metadata.mode ?? assignmentMode,
    assigned_via: metadata.assigned_via ?? 'admin_api',
    request_user: context.userId,
    request_ip: req.ip,
    user_agent: req.headers['user-agent'] || null,
  };
  if (clientRequestId) metadata.client_request_id = clientRequestId;
  if (idempotencyKey) metadata.idempotency_key = idempotencyKey;

  const mergeMetadata = (existingMeta) => {
    if (!existingMeta || typeof existingMeta !== 'object') {
      return metadata;
    }
    return { ...existingMeta, ...metadata };
  };

  const buildRecord = (userId) => {
    const record = {
      organization_id: organizationId,
      organizationId: organizationId,
      org_id: organizationId,
      course_id: id,
      user_id: userId,
      user_id_uuid: userId ?? null,
      assigned_by: assignedBy ?? null,
      status: statusValue,
      progress: progressValue ?? 0,
      metadata,
      idempotency_key: idempotencyKey,
      client_request_id: clientRequestId,
      active: true,
      due_at: dueAtValue ?? null,
      note: noteValue ?? null,
    };
    return record;
  };

  const targetUserIds = normalizedUserIds.length > 0 ? normalizedUserIds : [null];
  const buildAssignmentKey = (value) => (value === null ? '__org__' : String(value).toLowerCase());
  const resolveRowKey = (row) => {
    if (!row) return '__org__';
    const candidate = row.user_id ?? row.user_id_uuid ?? null;
    return buildAssignmentKey(candidate);
  };

  try {
    if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const updated = [];
      const inserted = [];
      for (const userId of targetUserIds) {
        const match = e2eStore.assignments.find((record) => {
          if (!record) return false;
          if (String(record.organization_id) !== String(organizationId)) return false;
          if (String(record.course_id) !== String(id)) return false;
          if (record.active === false) return false;
          if (record.user_id === null && userId === null) return true;
          if (record.user_id === null || userId === null) return false;
          return String(record.user_id).toLowerCase() === String(userId).toLowerCase();
        });

        if (match) {
          if (dueProvided) match.due_at = dueAtValue ?? null;
          if (noteProvided) match.note = noteValue ?? null;
          match.status = statusProvided ? statusValue : match.status;
          match.progress = progressProvided ? progressValue ?? match.progress : match.progress;
          match.metadata = mergeMetadata(match.metadata);
          match.assigned_by = assignedBy ?? match.assigned_by ?? null;
          match.updated_at = new Date().toISOString();
          updated.push(match);
        } else {
          const record = {
            ...buildRecord(userId),
            id: `e2e-asn-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          e2eStore.assignments.push(record);
          inserted.push(record);
        }
      }

      try {
        for (const asn of inserted) {
          const orgTopicId = asn.organization_id || asn.org_id || null;
          const topicOrg = orgTopicId ? `assignment:org:${orgTopicId}` : 'assignment:org:global';
          const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
          broadcastToTopic(topicOrg, payload);
          if (asn.user_id) {
            broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
          }
        }
        for (const asn of updated) {
          const orgTopicId = asn.organization_id || asn.org_id || null;
          const topicOrg = orgTopicId ? `assignment:org:${orgTopicId}` : 'assignment:org:global';
          const payload = { type: 'assignment_updated', data: asn, timestamp: Date.now() };
          broadcastToTopic(topicOrg, payload);
          if (asn.user_id) {
            broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
          }
        }
      } catch (broadcastErr) {
        console.warn('Failed to broadcast assignment events (fallback)', broadcastErr);
      }

      const responseRows = [...updated, ...inserted];
      res.status(inserted.length > 0 ? 201 : 200).json({
        data: responseRows,
        meta: {
          fallback: true,
          organizationId,
          inserted: inserted.length,
          updated: updated.length,
        },
      });
      return;
    }

    if (idempotencyKey) {
      const { data: existingByKey, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', id)
        .eq('organization_id', organizationId)
        .eq('idempotency_key', idempotencyKey);
      if (error) throw error;
      if (existingByKey && existingByKey.length > 0) {
        res.status(200).json({ data: existingByKey, meta: { idempotent: true, key: idempotencyKey } });
        return;
      }
    } else if (clientRequestId) {
      const { data: existingByClient, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', id)
        .eq('organization_id', organizationId)
        .eq('client_request_id', clientRequestId);
      if (error) throw error;
      if (existingByClient && existingByClient.length > 0) {
        res.status(200).json({ data: existingByClient, meta: { idempotent: true, key: clientRequestId } });
        return;
      }
    }

    const existingMap = new Map();
    if (normalizedUserIds.length > 0) {
      const seenAssignmentIds = new Set();

      const fetchExistingByColumn = async (column) => {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('course_id', id)
          .eq('organization_id', organizationId)
          .eq('active', true)
          .in(column, normalizedUserIds);
        if (error) throw error;
        return data || [];
      };

      const rowsByUserId = await fetchExistingByColumn('user_id');
      rowsByUserId.forEach((row) => {
        if (!row) return;
        seenAssignmentIds.add(row.id);
        existingMap.set(resolveRowKey(row), row);
      });

      const rowsByUuid = await fetchExistingByColumn('user_id_uuid');
      rowsByUuid.forEach((row) => {
        if (!row || seenAssignmentIds.has(row.id)) return;
        seenAssignmentIds.add(row.id);
        existingMap.set(resolveRowKey(row), row);
      });
    } else {
      const { data: existingOrg, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', id)
        .eq('organization_id', organizationId)
        .eq('active', true)
        .is('user_id', null);
      if (error) throw error;
      (existingOrg || []).forEach((row) => {
        existingMap.set('__org__', row);
      });
    }

    const updates = [];
    const inserts = [];
    const nowIso = new Date().toISOString();
    for (const userId of targetUserIds) {
      const key = buildAssignmentKey(userId);
      const existing = existingMap.get(key);
      if (existing) {
        const patch = {
          id: existing.id,
          metadata: mergeMetadata(existing.metadata),
          updated_at: nowIso,
          active: true,
          user_id_uuid: existing.user_id_uuid ?? existing.user_id ?? null,
          user_id: existing.user_id ?? existing.user_id_uuid ?? null,
        };
        if (dueProvided) patch.due_at = dueAtValue ?? null;
        if (noteProvided) patch.note = noteValue ?? null;
        if (statusProvided) patch.status = statusValue;
        if (progressProvided) patch.progress = progressValue ?? existing.progress ?? 0;
        if (assignedBy) patch.assigned_by = assignedBy;
        updates.push(patch);
      } else {
        inserts.push(buildRecord(userId));
      }
    }

    const updatedRows = [];
    for (const patch of updates) {
      const { id: patchId, ...changes } = patch;
      const { data: updatedRow, error } = await supabase
        .from('assignments')
        .update(changes)
        .eq('id', patchId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (updatedRow) updatedRows.push(updatedRow);
    }

    let insertedRows = [];
    if (inserts.length > 0) {
      const { data: newRows, error } = await supabase
        .from('assignments')
        .insert(inserts)
        .select('*');
      if (error) throw error;
      insertedRows = newRows || [];
    }

    try {
      for (const asn of insertedRows) {
        const orgTopicId = asn.organization_id || asn.org_id || null;
        const topicOrg = orgTopicId ? `assignment:org:${orgTopicId}` : 'assignment:org:global';
        const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
        broadcastToTopic(topicOrg, payload);
        if (asn.user_id) {
          broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
        }
      }
      for (const asn of updatedRows) {
        const orgTopicId = asn.organization_id || asn.org_id || null;
        const topicOrg = orgTopicId ? `assignment:org:${orgTopicId}` : 'assignment:org:global';
        const payload = { type: 'assignment_updated', data: asn, timestamp: Date.now() };
        broadcastToTopic(topicOrg, payload);
        if (asn.user_id) {
          broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
        }
      }
    } catch (broadcastErr) {
      console.warn('Failed to broadcast assignment events', broadcastErr);
    }

    const responseRows = [...updatedRows, ...insertedRows];
    res.status(insertedRows.length > 0 ? 201 : 200).json({
      data: responseRows,
      meta: {
        organizationId,
        inserted: insertedRows.length,
        updated: updatedRows.length,
        targets: targetUserIds.length,
      },
    });
  } catch (error) {
    logAdminCoursesError(req, error, `Failed to assign course ${id}`);
    res.status(500).json({ error: 'Unable to assign course' });
  }
});

app.get('/api/admin/courses/:id/assignments', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);

  if (!organizationId) {
    res.status(400).json({ error: 'org_id_required', message: 'orgId query parameter is required.' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const activeOnly = String(req.query.active ?? 'true').toLowerCase() !== 'false';
    let query = supabase
      .from('assignments')
      .select('*')
      .eq('course_id', id)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (activeOnly) {
      query = query.eq('active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    logAdminCoursesError(req, error, `Failed to load assignments for course ${id}`);
    res.status(500).json({ error: 'Unable to load assignments' });
  }
});

app.delete('/api/admin/assignments/:assignmentId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { assignmentId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const { data: existing, error: lookupError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      res.status(404).json({ error: 'assignment_not_found' });
      return;
    }

    const orgId = existing.organization_id || existing.org_id || null;
    if (!orgId) {
      res.status(400).json({ error: 'assignment_missing_org' });
      return;
    }

    const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
    if (!access && context.userRole !== 'admin') return;

    const { data, error } = await supabase
      .from('assignments')
      .update({
        active: false,
        removed_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    res.json({ data });
  } catch (error) {
    logRouteError('DELETE /api/admin/assignments/:assignmentId', error);
    res.status(500).json({ error: 'Unable to remove assignment' });
  }
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
const PORT = Number(process.env.PORT) || 3000;
logger.info('server_port', { port: PORT });

// Core middleware ordering: CORS -> JSON -> request metadata.
app.use(cookieParser());
app.use(corsMiddleware);
app.options('*', corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(attachRequestId);

app.get('/api/health/stream', (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  res.write(`retry: ${HEALTH_STREAM_RETRY_MS}\n\n`);

  let cancelled = false;

  const sendSnapshot = async () => {
    if (cancelled) return;
    try {
      const payload = await buildHealthPayload({ stream: true });
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      logger.warn('health_stream_emit_failed', { error: error instanceof Error ? error.message : error });
    }
  };

  const heartbeat = setInterval(() => {
    if (!cancelled) {
      res.write(':heartbeat\n\n');
    }
  }, HEALTH_STREAM_HEARTBEAT_MS);

  const interval = setInterval(() => {
    void sendSnapshot();
  }, HEALTH_STREAM_INTERVAL_MS);

  void sendSnapshot();

  req.on('close', () => {
    cancelled = true;
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

app.get('/ws', (_req, res) => {
  res.json({ ok: true, message: 'Use WebSocket upgrade at wss://api.the-huddle.co/ws' });
});

app.get('/ws/health', (_req, res) => {
  res.json(wsHealthSnapshot);
});

// Security middleware
app.use(securityHeaders);

// Auth routes (login, refresh, logout) must run before CSRF enforcement so they can issue tokens
// without requiring the SPA to fetch a CSRF token first.
app.use('/api/auth', authRoutes);

// Health endpoints remain public and must be registered before JWT protection.
app.use('/', healthRouter);

app.use(setDoubleSubmitCSRF);

// Expose CSRF token endpoint for clients and scripts that use the double-submit cookie pattern
app.get('/api/auth/csrf', getCSRFToken);

// Dev fallback: allow in-memory server behavior when Supabase isn't configured.
// Enabled by default in non-production unless DEV_FALLBACK=false is set.

const diagnosticsAllowedOrigins = new Set(
  resolvedCorsOrigins.length > 0
    ? resolvedCorsOrigins
    : [
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'http://localhost:8888',
        'http://127.0.0.1:8888',
        'http://localhost:* (dev wildcard)',
      ],
);
const defaultCookieSameSite = (process.env.COOKIE_SAMESITE || '').trim() || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
const defaultCookieSecure = process.env.NODE_ENV === 'production';

logger.info('diagnostics_cookies_and_cors', {
  allowedOrigins: Array.from(diagnosticsAllowedOrigins),
  cookieDomain: process.env.COOKIE_DOMAIN || null,
  cookieSameSite: defaultCookieSameSite,
  cookieSecureDefault: defaultCookieSecure,
});

const API_AUTH_BYPASS_PREFIXES = ['/auth', '/mfa', '/health', '/diagnostics', '/broadcast'];
const API_AUTH_BYPASS_EXACT = new Set(['/auth/csrf']);

const matchesBypassPrefix = (path, prefixes) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const shouldBypassApiAuth = (path, method = 'GET') => {
  if (method === 'OPTIONS') return true;
  if (!path) return false;
  if (API_AUTH_BYPASS_EXACT.has(path)) {
    return true;
  }
  return matchesBypassPrefix(path, API_AUTH_BYPASS_PREFIXES);
};

const requireSupabaseUser = (req, res, next) => {
  if (!req.user && req.supabaseJwtUser) {
    req.user = req.supabaseJwtUser;
  }
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Supabase session required for admin access.',
    });
  }
  return next();
};

const ensureAuthenticatedForHandler = (req, res) => {
  if (req.user) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finalize = (result) => {
      if (!done) {
        done = true;
        resolve(result);
      }
    };
    authenticate(req, res, (err) => {
      if (err) {
        finalize(false);
        return;
      }
      finalize(Boolean(req.user));
    });
    setImmediate(() => {
      if (!done && res.headersSent) {
        finalize(false);
      }
    });
  });
};

app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.headers['if-none-match']) delete req.headers['if-none-match'];
    if (req.headers['if-modified-since']) delete req.headers['if-modified-since'];
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use('/api', apiLimiter);
app.use('/api', supabaseJwtMiddleware);
app.use('/api', (req, res, next) => {
  const path = req.path || '/';
  if (shouldBypassApiAuth(path, req.method)) {
    req.authBypassed = true;
    return next();
  }
  req.authBypassed = false;
  return authenticate(req, res, next);
});


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
      userId: req.user?.userId ?? null,
      organizationId: req.activeOrgId ?? req.user?.organizationId ?? null,
      authBypassed: Boolean(req.authBypassed),
      ip: req.ip,
    });
  });
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

app.get('/api/admin/users', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const orgId = pickOrgId(req.query.orgId, req.query.organizationId);
  if (!orgId) {
    res.status(400).json({ error: 'org_id_required', message: 'orgId query parameter is required.' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const members = await fetchOrgMembersWithProfiles(orgId);
    res.json({ data: members });
  } catch (error) {
    logRouteError('GET /api/admin/users', error);
    res.status(500).json({ error: 'Unable to load organization users' });
  }
});

app.patch('/api/admin/users/:userId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { userId } = req.params;
  const orgId = pickOrgId(req.body?.orgId, req.body?.organizationId);
  const { role, status } = req.body || {};

  if (!orgId) {
    res.status(400).json({ error: 'org_id_required', message: 'organizationId is required.' });
    return;
  }
  if (!role && !status) {
    res.status(400).json({ error: 'no_fields', message: 'role or status must be provided.' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    const { data: membership, error: lookupError } = await supabase
      .from('organization_memberships')
      .select('id, org_id, user_id, role, status')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!membership) {
      res.status(404).json({ error: 'membership_not_found' });
      return;
    }

    const updatePayload = {};
    if (role) {
      updatePayload.role = String(role).toLowerCase();
    }
    if (status) {
      const normalizedStatus = String(status).toLowerCase();
      if (!['pending', 'active', 'revoked'].includes(normalizedStatus)) {
        res.status(400).json({ error: 'invalid_status' });
        return;
      }
      updatePayload.status = normalizedStatus;
      if (normalizedStatus === 'active') {
        updatePayload.accepted_at = new Date().toISOString();
        updatePayload.last_seen_at = new Date().toISOString();
      }
    }

    const roleIsChangingFromOwner =
      membership.role === 'owner' && updatePayload.role && updatePayload.role !== 'owner';
    const statusRevokingOwner = membership.role === 'owner' && updatePayload.status === 'revoked';

    if (roleIsChangingFromOwner || statusRevokingOwner) {
      const { count, error: ownerCountError } = await supabase
        .from('organization_memberships')
        .select('id', { head: true, count: 'exact' })
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .eq('status', 'active');
      if (ownerCountError) throw ownerCountError;
      if (!count || count <= 1) {
        res.status(400).json({ error: 'owner_required', message: 'At least one active owner is required.' });
        return;
      }
    }

    const { data, error } = await supabase
      .from('organization_memberships')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    res.json({ data });
  } catch (error) {
    logRouteError('PATCH /api/admin/users/:userId', error);
    res.status(500).json({ error: 'Unable to update organization user' });
  }
});

// MFA routes
app.use('/api/mfa', mfaRoutes);

// Enforce authentication + admin role on every /api/admin/* route before specific routers/handlers
app.use('/api/admin', authenticate, requireAdmin);

// Admin analytics endpoints (aggregates, exports, AI summary)
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/analytics/export', adminAnalyticsExport);
app.use('/api/admin/analytics/summary', adminAnalyticsSummary);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/courses', authenticate, requireSupabaseUser, requireAdmin, adminCoursesRouter);

// All organization workspace endpoints require authentication
app.use('/api/orgs', authenticate);

// Honor explicit E2E test mode in child processes: when E2E_TEST_MODE is set we prefer the
// in-memory demo fallback even if Supabase credentials are present in the environment.

const supabaseUrl = supabaseEnv.url;
const supabaseServiceRoleKey = supabaseEnv.serviceRoleKey;
const supabaseAnonKey = supabaseEnv.anonKey;
const missingSupabaseEnvVars = [...supabaseEnv.missing];

logger.info('diagnostics_supabase_env', {
  supabaseUrlConfigured: Boolean(supabaseUrl),
  supabaseUrlHost,
  hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
  serviceKeySource: supabaseEnv.serviceKeySource || null,
});

console.log('[supabase] startup', {
  host: supabaseUrlHost || '(not set)',
  serviceRoleKeyPresent: Boolean(supabaseServiceRoleKey),
});

let supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;
let supabaseAuthClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
if (E2E_TEST_MODE) {
  console.log('[server] Running in E2E_TEST_MODE - ignoring Supabase credentials and using in-memory fallback');
  supabase = null;
  supabaseAuthClient = null;
}
let loggedMissingSupabaseConfig = false;

const auditUserCourseProgressUuid = async () => {
  if (!supabase) return;
  try {
    const { count, error } = await supabase
      .from('user_course_progress')
      .select('id', { head: true, count: 'exact' })
      .is('user_id_uuid', null);
    if (error) throw error;
    if (typeof count === 'number' && count > 0) {
      logger.error('user_course_progress_uuid_missing', {
        rowsWithoutUuid: count,
      });
    } else {
      logger.info('user_course_progress_uuid_verified', { rowsWithoutUuid: count || 0 });
    }
  } catch (error) {
    logger.warn('user_course_progress_uuid_audit_failed', {
      message: error?.message ?? String(error),
    });
  }
};

if (supabase) {
  auditUserCourseProgressUuid();
}

const mediaService = createMediaService({
  getSupabase: () => supabase,
  courseVideosBucket: COURSE_VIDEOS_BUCKET,
  documentsBucket: DOCUMENTS_BUCKET,
});

const notificationDispatcher = setupNotificationDispatcher({ supabase, emailSender: sendEmail });

const INVITE_REMINDER_JOB = 'invites.reminder';
const INVITE_REMINDER_LOOKBACK_HOURS = Number(
  process.env.CLIENT_INVITE_REMINDER_HOURS || process.env.ORG_INVITE_REMINDER_HOURS || 48
);
const INVITE_REMINDER_MAX_SENDS = Number(process.env.CLIENT_INVITE_REMINDER_MAX || 3);
const INVITE_REMINDER_INTERVAL_MS = Number(process.env.CLIENT_INVITE_REMINDER_INTERVAL_MS || 1000 * 60 * 60);
const INVITE_REMINDER_CRON = process.env.CLIENT_INVITE_REMINDER_CRON || '0 */6 * * *';

let inviteReminderIntervalId = null;
let inviteReminderSchedulerInitialized = false;

registerJobProcessor('audit.write', async (payload = {}) => {
  if (!supabase) {
    logger.warn('audit_write_skipped_supabase_unavailable');
    return null;
  }
  try {
    const normalizedOrgId = payload.organizationId ?? payload.organization_id ?? payload.org_id ?? null;
    await supabase.from('audit_logs').insert({
      action: payload.action,
      details: payload.details || {},
      user_id: payload.userId ?? payload.user_id ?? null,
      organization_id: normalizedOrgId ?? null,
      ip_address: payload.ipAddress ?? payload.ip_address ?? null,
      created_at: payload.createdAt ?? payload.created_at ?? new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('audit_write_failed', { message: error?.message || String(error) });
  }
});

registerJobProcessor(INVITE_REMINDER_JOB, async (payload = {}) => runInviteReminderSweep(payload));

scheduleInviteReminderRunner();

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




// --- Org ID Compatibility Helpers (must be above all usage) ---
class InvalidOrgIdentifierError extends Error {
  constructor(identifier) {
    super('invalid_org');
    this.code = 'invalid_org';
    this.identifier = identifier;
  }
}

const DEFAULT_SANDBOX_ORG_ID =
  process.env.E2E_SANDBOX_ORG_ID ||
  process.env.DEMO_SANDBOX_ORG_ID ||
  process.env.DEFAULT_SANDBOX_ORG_ID ||
  'demo-sandbox-org';

function normalizeOrgIdValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') {
      return null;
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value && typeof value === 'object') {
    const candidate = value.organization_id ?? value.org_id ?? value.id ?? null;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed || null;
    }
  }
  return null;
}

function pickOrgId(...candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeOrgIdValue(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

const respondInvalidOrg = (res, identifier) => {
  res.status(400).json({
    error: 'invalid_org',
    identifier,
    message: 'Organization not found. Please select a valid organization.',
  });
};

const logOrgResolutionEvent = (level, req, metadata = {}) => {
  try {
    const logger = typeof console[level] === 'function' ? console[level] : console.log;
    logger('[org-resolver]', {
      requestId: req?.requestId ?? null,
      ...metadata,
    });
  } catch (_) {}
};

const lookupOrgIdBySlug = async (slugCandidate) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id, slug')
    .ilike('slug', slugCandidate)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
};

const coerceOrgIdentifierToUuid = async (req, identifier) => {
  const normalized = normalizeOrgIdValue(identifier);
  if (!normalized) return null;

  // If Supabase isn't available or the identifier already looks like a UUID, return it unchanged.
  if (!supabase || isUuid(normalized)) {
    return normalized;
  }

  const slugCandidate = normalized.toLowerCase();
  try {
    const resolvedId = await lookupOrgIdBySlug(slugCandidate);
    if (resolvedId) {
      logOrgResolutionEvent('info', req, {
        event: 'slug_resolved',
        identifier: normalized,
        resolvedOrgId: resolvedId,
      });
      return resolvedId;
    }
    logOrgResolutionEvent('info', req, { event: 'slug_passthrough', identifier: normalized });
    return normalized;
  } catch (error) {
    console.error('[org-resolver] lookup_failed', {
      requestId: req?.requestId ?? null,
      identifier: normalized,
      error: {
        message: error?.message ?? null,
        code: error?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      },
    });
    return normalized;
  }
};

function userHasOrgMembership(req, orgId) {
  if (!req || !orgId) return false;
  if (req.user?.isPlatformAdmin || req.user?.platformRole === 'platform_admin') {
    return true;
  }
  if (req.orgMemberships && typeof req.orgMemberships.has === 'function' && req.orgMemberships.has(orgId)) {
    return true;
  }
  if (Array.isArray(req.user?.memberships)) {
    return req.user.memberships.some((membership) => normalizeOrgIdValue(membership.orgId) === orgId);
  }
  if (Array.isArray(req.user?.organizationIds)) {
    return req.user.organizationIds.some((candidate) => normalizeOrgIdValue(candidate) === orgId);
  }
  return false;
}

const PLATFORM_ADMIN_ORG_CACHE_KEY = Symbol('platformAdminOrgCache');

const fetchPrimaryOrgIdForUser = async (userId) => {
  if (!userId || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('org_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.org_id ?? null;
  } catch (err) {
    console.error('[admin-courses] primary_org_lookup_failed', { userId, error: err });
    return null;
  }
};

const resolveOrgIdForCourseRequest = async (req, context, candidates = []) => {
  if (!context) return pickOrgId(...candidates);
  const headerOrgId = getHeaderOrgId(req, { requireMembership: !context.isPlatformAdmin });
  const normalizedCandidates = [...candidates, headerOrgId, context.requestedOrgId];
  let orgId = pickOrgId(...normalizedCandidates);
  if (orgId) {
    orgId = await coerceOrgIdentifierToUuid(req, orgId);
  }
  if (!orgId && context.isPlatformAdmin) {
    if (!req[PLATFORM_ADMIN_ORG_CACHE_KEY]) {
      req[PLATFORM_ADMIN_ORG_CACHE_KEY] = await fetchPrimaryOrgIdForUser(context.userId);
    }
    orgId = req[PLATFORM_ADMIN_ORG_CACHE_KEY] ?? null;
    if (orgId) {
      orgId = await coerceOrgIdentifierToUuid(req, orgId);
    }
  }
  return orgId || null;
};

function getHeaderOrgId(req, { requireMembership = true } = {}) {
  if (!req || !req.headers) return null;
  for (const key of ORG_HEADER_KEYS) {
    const value = req.headers[key];
    if (typeof value !== 'string') continue;
    const normalized = normalizeOrgIdValue(value);
    if (!normalized) continue;
    if (requireMembership && !userHasOrgMembership(req, normalized)) {
      console.warn('[headers] Ignoring org id header without membership', {
        header: key,
        value: normalized,
        requestId: req.requestId ?? null,
        userId: req.user?.userId || req.user?.id || null,
      });
      continue;
    }
    return normalized;
  }
  return null;
}

function hydrateSandboxOrgFields(e2eStore) {
  for (const [courseId, course] of e2eStore.courses.entries()) {
    e2eStore.courses.set(
      courseId,
      ensureOrgFieldCompatibility(course, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || course,
    );
  }
  if (Array.isArray(e2eStore.assignments)) {
    for (let i = 0; i < e2eStore.assignments.length; i += 1) {
      ensureOrgFieldCompatibility(e2eStore.assignments[i], { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID });
    }
  }
}
// --- End Org ID Compatibility Helpers ---
// Hydrate org fields after e2eStore is defined
hydrateSandboxOrgFields(e2eStore);


const getCourseOrgId = async (courseId) => {
  if (!courseId) return undefined;
  if (!supabase) {
    if (E2E_TEST_MODE || DEV_FALLBACK) {
      const record = e2eStore.courses.get(courseId);
      if (!record) return undefined;
      return pickOrgId(record.organization_id, record.org_id, record.organizationId);
    }
    return undefined;
  }
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('organization_id')
      .eq('id', courseId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return normalizeOrgIdValue(data.organization_id);
  } catch (error) {
    console.error('getCourseOrgId_failed', { courseId, error: error instanceof Error ? error.message : error });
    return undefined;
  }
};

const MODULE_SELECT_WITH_LESSONS =
  'id,course_id,title,description,order_index,lessons:lessons!lessons_module_id_fkey(id,module_id,title,description,type,order_index,duration_s,content_json,completion_rule_json)';
const MODULE_SELECT_NO_LESSONS = 'id,course_id,title,description,order_index';

const normalizeModuleGraph = (modules, { includeLessons = false } = {}) => {
  if (!Array.isArray(modules)) {
    return [];
  }
  return modules.map((module) => {
    if (!includeLessons) {
      const { lessons, ...rest } = module;
      return rest;
    }
    return {
      ...module,
      lessons: Array.isArray(module.lessons) ? module.lessons : [],
    };
  });
};

const fetchModulesForCourse = async (courseId, { includeLessons = false } = {}) => {
  if (!supabase || !courseId) return [];
  const selectClause = includeLessons ? MODULE_SELECT_WITH_LESSONS : MODULE_SELECT_NO_LESSONS;
  const { data, error } = await supabase
    .from('modules')
    .select(selectClause)
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return normalizeModuleGraph(data || [], { includeLessons });
};

const ensureCourseStructureLoaded = async (courseRecord, { includeLessons = false } = {}) => {
  if (!courseRecord || !courseRecord.id) {
    return courseRecord;
  }
  if (!supabase) {
    if (Array.isArray(courseRecord.modules)) {
      return { ...courseRecord, modules: normalizeModuleGraph(courseRecord.modules, { includeLessons }) };
    }
    return { ...courseRecord, modules: [] };
  }
  if (Array.isArray(courseRecord.modules)) {
    const normalized = normalizeModuleGraph(courseRecord.modules, { includeLessons });
    return { ...courseRecord, modules: normalized };
  }
  try {
    const hydratedModules = await fetchModulesForCourse(courseRecord.id, { includeLessons });
    return { ...courseRecord, modules: hydratedModules };
  } catch (error) {
    console.warn('[admin.courses] Failed to hydrate modules for course', {
      courseId: courseRecord.id,
      message: error?.message || error,
    });
    return { ...courseRecord, modules: [] };
  }
};

const getDocumentOrgId = async (documentId) => {
  if (!documentId || !supabase) return undefined;
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('organization_id')
      .eq('id', documentId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return normalizeOrgIdValue(data.organization_id);
  } catch (error) {
    console.error('getDocumentOrgId_failed', { documentId, error: error instanceof Error ? error.message : error });
    return undefined;
  }
};
const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isAnalyticsClientEventDuplicate = (error) =>
  Boolean(
    error &&
      error.code === '23505' &&
      typeof error.message === 'string' &&
      error.message.includes('analytics_events_client_event_id_key'),
  );
const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const parseBooleanParam = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).toLowerCase().trim();
  return ['true', '1', 'yes', 'on'].includes(normalized);
};
const sanitizeIlike = (value) =>
  value
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim();
const parsePaginationParams = (req, { defaultSize = 25, maxSize = 100 } = {}) => {
  const page = clampNumber(parseInt(req.query.page, 10) || 1, 1, 100000);
  const pageSize = clampNumber(parseInt(req.query.pageSize, 10) || defaultSize, 1, maxSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
};

const OPTIONAL_NOTIFICATION_COLUMNS = ['dispatch_status', 'channels', 'metadata', 'scheduled_for', 'delivered_at'];
const OPTIONAL_NOTIFICATION_COLUMN_SET = new Set(OPTIONAL_NOTIFICATION_COLUMNS);
const notificationColumnSuppression = new Set();

const lessonColumnSupport = {
  durationSeconds: true,
  durationText: false,
  contentJson: true,
  contentLegacy: false,
  completionRuleJson: true,
  organizationId: true,
  courseId: true,
};

const moduleColumnSupport = {
  organizationId: true,
};

const formatLegacyDuration = (seconds) => {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return null;
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${minutes} min`;
};

const maybeHandleLessonColumnError = (error) => {
  const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
  if (!missingColumn) return false;
  switch (missingColumn) {
    case 'duration_s':
      if (lessonColumnSupport.durationSeconds) {
        lessonColumnSupport.durationSeconds = false;
        lessonColumnSupport.durationText = true;
        logger.warn('lessons_duration_seconds_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    case 'duration':
      if (lessonColumnSupport.durationText) {
        lessonColumnSupport.durationText = false;
        logger.warn('lessons_duration_column_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    case 'content_json':
      if (lessonColumnSupport.contentJson) {
        lessonColumnSupport.contentJson = false;
        lessonColumnSupport.contentLegacy = true;
        logger.warn('lessons_content_json_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    case 'content':
      if (lessonColumnSupport.contentLegacy) {
        lessonColumnSupport.contentLegacy = false;
        logger.warn('lessons_content_column_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    case 'completion_rule_json':
      if (lessonColumnSupport.completionRuleJson) {
        lessonColumnSupport.completionRuleJson = false;
        logger.warn('lessons_completion_rule_column_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    case 'organization_id':
      if (lessonColumnSupport.organizationId) {
        lessonColumnSupport.organizationId = false;
        logger.warn('lessons_organization_column_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    case 'course_id':
      if (lessonColumnSupport.courseId) {
        lessonColumnSupport.courseId = false;
        logger.warn('lessons_course_column_missing', { code: error.code ?? null });
        return true;
      }
      return false;
    default:
      return false;
  }
};

const maybeHandleModuleColumnError = (error) => {
  const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
  if (!missingColumn) return false;
  if (missingColumn === 'organization_id' && moduleColumnSupport.organizationId) {
    moduleColumnSupport.organizationId = false;
    logger.warn('modules_organization_column_missing', { code: error?.code ?? null });
    return true;
  }
  return false;
};

const logModuleNormalizationDiagnostics = (diagnostics, context = {}) => {
  if (!shouldLogModuleNormalization(diagnostics)) return;
  logger.warn('course_module_normalization', {
    requestId: context.requestId ?? null,
    courseId: context.courseId ?? null,
    source: context.source ?? 'unknown',
    ...diagnostics,
  });
};

const buildNotificationSelectColumns = () => {
  const base = ['id', 'title', 'body', 'org_id', 'user_id', 'created_at', 'read', 'updated_at'];
  OPTIONAL_NOTIFICATION_COLUMNS.forEach((column) => {
    if (!notificationColumnSuppression.has(column)) {
      base.push(column);
    }
  });
  return base.join(',');
};

async function runNotificationQuery(queryFactory, attempt = 0) {
  const selectColumns = buildNotificationSelectColumns();
  const query = queryFactory(selectColumns);
  const { data, error } = await query;

  if (error && isMissingColumnError(error) && attempt < OPTIONAL_NOTIFICATION_COLUMNS.length) {
    const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
    if (missingColumn && OPTIONAL_NOTIFICATION_COLUMN_SET.has(missingColumn) && !notificationColumnSuppression.has(missingColumn)) {
      notificationColumnSuppression.add(missingColumn);
      logger.warn('notifications_optional_column_missing', { column: missingColumn, code: error.code });
      return runNotificationQuery(queryFactory, attempt + 1);
    }
  }

  if (error) throw error;
  return data || [];
}

// Hardened guard for dev-only helpers so they never leak to real environments.
const devToolsEnabled = (process.env.DEV_TOOLS_ENABLED || '').toLowerCase() === 'true';
const requireDevToolsKey = (req) => {
  if (!devToolsEnabled) return false;
  const expectedKey = process.env.DEV_TOOLS_KEY || '';
  if (!expectedKey) return false;
  const headerKey = req.get('x-dev-tools-key') || '';
  if (!headerKey || headerKey !== expectedKey) return false;

  const remoteAddress = req.ip || req.connection?.remoteAddress || '';
  const forwardedFor = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  const candidateIp = forwardedFor || remoteAddress;
  const isLoopback = candidateIp.startsWith('127.') || candidateIp === '::1' || candidateIp === '::ffff:127.0.0.1';
  if (!isLoopback) return false;
  return true;
};

const withDevToolsGate = (handler) => (req, res, next) => {
  if (!requireDevToolsKey(req)) {
    res.status(404).send('Not Found');
    return;
  }
  return handler(req, res, next);
};

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/dev/diagnostics/courses', withDevToolsGate(async (req, res) => {
    const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
    const targetIds = idsParam
      ? idsParam.split(',').map((id) => id.trim()).filter(Boolean)
      : ['course-tlc-retreat-dei-2026'];
    const mode = supabase ? 'supabase' : 'demo';

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('courses')
          .select('id,status')
          .in('id', targetIds);
        if (error) throw error;
        const lookup = new Map((data || []).map((row) => [row.id, row]));
        return res.json({
          mode,
          courses: targetIds.map((id) => {
            const record = lookup.get(id) || null;
            return {
              id,
              found: Boolean(record),
              status: record?.status ?? null,
            };
          }),
        });
      }

      return res.json({
        mode,
        courses: targetIds.map((id) => {
          const record = e2eStore.courses.get(id) || null;
          return {
            id,
            found: Boolean(record),
            status: record?.status ?? null,
          };
        }),
      });
    } catch (error) {
      logger.error('dev_courses_diagnostics_failed', {
        error: error instanceof Error ? error.message : error,
      });
      res.status(500).json({ error: 'diagnostics_failed' });
    }
  }));

  app.post('/api/dev/publish-course', withDevToolsGate(async (req, res) => {
    const { id } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'id_required' });
      return;
    }
    const mode = supabase ? 'supabase' : 'demo';

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('courses')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          res.status(404).json({ error: 'not_found', id });
          return;
        }
        res.json({ mode, course: data });
        return;
      }

      const existing = e2eStore.courses.get(id);
      if (!existing) {
        res.status(404).json({ error: 'not_found', id });
        return;
      }
      const updated = {
        ...existing,
        status: 'published',
        published_at: existing.published_at || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      e2eStore.courses.set(id, updated);
      persistE2EStore();
      res.json({ mode, course: updated });
    } catch (error) {
      logger.error('dev_publish_course_failed', {
        id,
        error: error instanceof Error ? error.message : error,
      });
      res.status(500).json({ error: 'publish_failed' });
    }
  }));
}

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

const buildLessonRow = (lessonId, record) => {
  const percentValue = clampPercent(
    record?.percent ??
      record?.progress ??
      record?.progress_percentage ??
      record?.progressPercent ??
      0,
  );
  const completed =
    typeof record?.completed === 'boolean'
      ? record.completed
      : record?.status
      ? record.status === 'completed'
      : percentValue >= 100;
  const timeSpent =
    record?.time_spent ??
    record?.time_spent_s ??
    record?.time_spent_seconds ??
    record?.timeSpentSeconds ??
    record?.positionSeconds ??
    0;
  const lastAccessed =
    record?.last_accessed_at ||
    record?.updated_at ||
    record?.created_at ||
    record?.lastAccessedAt ||
    null;

  return {
    lesson_id: lessonId,
    progress_percentage: percentValue,
    completed,
    time_spent: Math.max(0, Math.round(timeSpent ?? 0)),
    last_accessed_at: lastAccessed,
  };
};

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
  organization_id: DEFAULT_SANDBOX_ORG_ID,
  organizationId: DEFAULT_SANDBOX_ORG_ID,
  org_id: DEFAULT_SANDBOX_ORG_ID,
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

const getPayloadSize = (req) => {
  try {
    const headerValue = req?.get ? req.get('content-length') : req?.headers?.['content-length'];
    const parsed = headerValue ? parseInt(headerValue, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  } catch {}
  try {
    const serialized = JSON.stringify(req?.body ?? {});
    return Buffer.byteLength(serialized, 'utf8');
  } catch {
    return 0;
  }
};

const schemaSupportFlags = {
  lessonProgress: 'unknown',
  courseProgress: 'unknown',
};

let courseVersionColumnAvailable = true;

const handleCourseVersionColumnError = (error) => {
  if (!courseVersionColumnAvailable || !error) {
    return false;
  }
  if (!isMissingColumnError(error)) {
    return false;
  }
  const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
  if (missingColumn && missingColumn.toLowerCase() === 'version') {
    courseVersionColumnAvailable = false;
    logger.warn('courses_version_column_missing', {
      code: error.code ?? null,
      message: error.message ?? null,
    });
    return true;
  }
  return false;
};

const logAdminCoursesError = (req, err, label, extraMeta = {}) => {
  const endpoint = req?.method && req?.originalUrl ? `${req.method} ${req.originalUrl}` : req?.path || 'unknown';
  const safeExtra = extraMeta && typeof extraMeta === 'object' ? extraMeta : {};
  const { organizationId: extraOrgId, ...restExtraMeta } = safeExtra;
  const fallbackOrg = normalizeOrgIdValue(
    extraOrgId ??
      req?.activeOrgId ??
      req?.body?.organization_id ??
      req?.body?.org_id ??
      req?.body?.orgId ??
      null,
  );
  const meta = {
    endpoint,
    requestId: req?.requestId ?? null,
    userId: extraMeta.userId ?? req?.user?.userId ?? req?.user?.id ?? null,
    organizationId: fallbackOrg ?? null,
    params: req?.params ?? null,
    query: req?.query ?? null,
    bodySummary: summarizeRequestBody(req?.body ?? null),
    ...restExtraMeta,
    error: err
      ? {
          message: err.message ?? null,
          code: err.code ?? null,
          details: err.details ?? null,
          hint: err.hint ?? null,
          stack: err.stack ?? null,
        }
      : null,
  };
  console.error(`[admin-courses] ${label}`, meta, err);
  try {
    writeErrorDiagnostics(req, err, { meta: { surface: 'admin_courses', label } });
  } catch (_) {
    // swallow diagnostics errors
  }
};

const logAdminCourseWriteFailure = (req, label, payload, error, meta = {}) => {
  const safePayload = payload && typeof payload === 'object' ? payload : null;
  const payloadKeys =
    safePayload && !Array.isArray(safePayload) ? Object.keys(safePayload).slice(0, 50) : [];
  const err =
    error && typeof error === 'object'
      ? {
          message: error.message ?? null,
          code: error.code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        }
      : null;
  console.error('[admin-courses] update failed', {
    label,
    requestId: req?.requestId ?? null,
    courseId: meta.courseId ?? null,
    moduleId: meta.moduleId ?? null,
    lessonId: meta.lessonId ?? null,
    payloadKeys,
    err,
  });
};

const TABLE_VERIFICATION_TTL_MS = 5 * 60 * 1000;
const SCHEMA_REFRESH_DEBOUNCE_MS = 5000;
const tableVerificationCache = new Map();
let lastSchemaRefreshAttempt = 0;

const isSchemaMismatchError = (error) => {
  if (!error) return false;
  if (isMissingRelationError(error) || isMissingColumnError(error)) return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('cached schema') || message.includes('schema cache');
};

const refreshSupabaseSchemaCache = async (label) => {
  if (!supabase) return false;
  const now = Date.now();
  if (now - lastSchemaRefreshAttempt < SCHEMA_REFRESH_DEBOUNCE_MS) {
    return false;
  }
  lastSchemaRefreshAttempt = now;
  try {
    const { error } = await supabase.rpc('refresh_schema');
    if (error) throw error;
    logger.info('supabase_schema_cache_refreshed', { label });
    return true;
  } catch (error) {
    logger.warn('supabase_schema_cache_refresh_failed', {
      label,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
    });
    return false;
  }
};

const executeWithSchemaRetry = async (label, operation) => {
  let attempt = 0;
  let lastError = null;
  // Attempt twice: initial + one retry after schema refresh
  while (attempt < 2) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSchemaMismatchError(error)) {
        throw error;
      }
      logger.warn('supabase_schema_retry', {
        label,
        attempt,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      const refreshed = await refreshSupabaseSchemaCache(label);
      if (!refreshed) {
        break;
      }
    }
    attempt += 1;
  }
  throw lastError;
};

const runSupabaseQueryWithRetry = async (label, buildQuery) => {
  return executeWithSchemaRetry(label, async () => {
    const result = await buildQuery();
    if (result?.error) throw result.error;
    return result;
  });
};

const ensureTablesReady = async (label, definitions = []) => {
  if (!supabase) return { ok: true };
  for (const definition of definitions) {
    const table = definition.table;
    if (!table) continue;
    const columns = Array.isArray(definition.columns) ? definition.columns : [];
    const cacheKey = `${table}:${columns.slice().sort().join(',')}`;
    const lastCheck = tableVerificationCache.get(cacheKey);
    if (lastCheck && Date.now() - lastCheck < TABLE_VERIFICATION_TTL_MS) {
      continue;
    }
    try {
      await executeWithSchemaRetry(`${label}.${table}.verify`, async () => {
        const selectList = columns.length ? columns.join(',') : 'id';
        const result = await supabase.from(table).select(selectList, { head: true }).limit(1);
        if (result.error) throw result.error;
      });
      tableVerificationCache.set(cacheKey, Date.now());
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        logger.error('supabase_table_verification_failed', {
          label,
          table,
          columns,
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        return { ok: false, table, error };
      }
      throw error;
    }
  }
  return { ok: true };
};

const respondSchemaUnavailable = (res, label, status) => {
  res.status(503).json({
    error: 'schema_unavailable',
    message: `Required database table "${status.table}" is unavailable for ${label}.`,
    table: status.table,
    label,
  });
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
const inviteAssignableRoles = new Set(['owner', 'admin', 'manager', 'editor', 'instructor', 'member', 'viewer']);

const normalizeOrgRole = (role, defaultRole = 'member') => {
  const normalized = String(role || defaultRole).trim().toLowerCase();
  if (inviteAssignableRoles.has(normalized)) {
    return normalized;
  }
  return defaultRole;
};



function ensureOrgFieldCompatibility(record, { fallbackOrgId = null } = {}) {
  if (!record || typeof record !== 'object') {
    return record;
  }
  const normalized = pickOrgId(record.organization_id, record.org_id, record.organizationId, fallbackOrgId);
  if (!normalized) {
    return record;
  }
  if (record.organization_id !== normalized) {
    record.organization_id = normalized;
  }
  if (record.organizationId !== normalized) {
    record.organizationId = normalized;
  }
  if (record.org_id !== normalized) {
    record.org_id = normalized;
  }
  return record;
}

const shouldWarnOnLegacyOrgId = (process.env.NODE_ENV || '').toLowerCase() !== 'production';

const normalizeLegacyOrgInput = (payload, { surface = 'unknown', requestId = null, path = 'body' } = {}) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const visited = new WeakSet();

  const walk = (value, currentPath) => {
    if (!value || typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Object.prototype.hasOwnProperty.call(value, 'org_id')) {
      if (shouldWarnOnLegacyOrgId) {
        console.warn('[org_id-deprecated] Received legacy org_id field', {
          surface,
          requestId,
          path: currentPath,
        });
      }
      if (value.organization_id === undefined) {
        value.organization_id = value.org_id;
      }
      if (value.organizationId === undefined) {
        value.organizationId = value.organization_id ?? value.org_id;
      }
      delete value.org_id;
    }

    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        walk(child, `${currentPath}[${index}]`);
      });
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      walk(child, nextPath);
    }
  };

  walk(payload, path);
  return payload;
};

const getRequestContext = (req) => {
  if (!req.user) {
    return { userId: null, userRole: null, memberships: [], organizationIds: [], requestedOrgId: null };
  }

  return {
    userId: req.user.userId || req.user.id || null,
    userRole: (req.user.role || req.user.platformRole || '').toLowerCase(),
    memberships: req.user.memberships || [],
    organizationIds: Array.isArray(req.user.organizationIds) ? req.user.organizationIds : [],
    isPlatformAdmin: Boolean(req.user.isPlatformAdmin),
    requestedOrgId: normalizeOrgIdValue(req.activeOrgId ?? req.user?.activeOrgId ?? null),
  };
};

const requireUserContext = (req, res) => {
  const context = getRequestContext(req);
  if (!context.userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }
  return context;
};

const resolveOrgMembership = async (req, orgId, userId) => {
  if (!orgId || !userId) return null;
  if (req.orgMemberships?.has(orgId)) {
    return req.orgMemberships.get(orgId);
  }

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role, status, invited_by, invited_email')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    orgId,
    role: data.role,
    status: data.status,
    invitedBy: data.invited_by,
    invitedEmail: data.invited_email,
  };
};

const logDeniedOrgAccess = (req, payload = {}) => {
  if (!shouldLogAuthDebug) {
    return;
  }
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const meta = {
    path: req?.originalUrl || req?.url,
    method: req?.method,
    requestId: req?.requestId,
    ...safePayload,
  };
  console.warn('[orgAccess] denied', meta);
};

const requireOrgAccess = async (
  req,
  res,
  orgId,
  { write = false, allowPlatformAdmin = true, requireOrgAdmin = false } = {},
) => {
  const context = requireUserContext(req, res);
  if (!context) return null;

  let normalizedOrgId;
  try {
    normalizedOrgId = await coerceOrgIdentifierToUuid(req, orgId);
  } catch (err) {
    if (err instanceof InvalidOrgIdentifierError) {
      respondInvalidOrg(res, err.identifier);
      return null;
    }
    throw err;
  }
  orgId = normalizedOrgId || orgId;

  if (!orgId) {
    res.status(400).json({ error: 'org_required', message: 'Organization identifier is required' });
    return null;
  }

  if (allowPlatformAdmin && context.isPlatformAdmin) {
    return { userId: context.userId, role: 'platform_admin', membership: null };
  }

  try {
    if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      if (FORCE_ORG_ENFORCEMENT) {
        res.status(503).json({
          error: 'org_membership_unavailable',
          message: 'Organization enforcement is enabled but membership verification is unavailable in this environment.',
        });
        return null;
      }
      return { userId: context.userId, role: 'owner', membership: null };
    }

    const membership = req.orgMemberships?.get(orgId) || (await resolveOrgMembership(req, orgId, context.userId));
    if (!membership || (membership.status && membership.status !== 'active')) {
      logDeniedOrgAccess(req, {
        reason: 'missing_membership',
        orgId,
        userId: context.userId,
        resolvedRole: context.userRole,
      });
      res.status(403).json({ error: 'Organization membership required' });
      return null;
    }

    const memberRole = String(membership.role || 'member').toLowerCase();

    if (requireOrgAdmin && memberRole !== 'admin') {
      logDeniedOrgAccess(req, {
        reason: 'org_admin_required',
        orgId,
        userId: context.userId,
        membershipRole: membership.role,
      });
      res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required for this organization' });
      return null;
    }

    if (write && !writableMembershipRoles.has(memberRole)) {
      logDeniedOrgAccess(req, {
        reason: 'insufficient_org_permissions',
        orgId,
        userId: context.userId,
        membershipRole: membership.role,
      });
      res.status(403).json({ error: 'Insufficient organization permissions' });
      return null;
    }

    return { userId: context.userId, role: memberRole, membership };
  } catch (error) {
    console.error(`Failed to verify membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to verify organization access' });
    return null;
  }
};

const verifyMediaAssetAccess = async (req, res, asset, context) => {
  if (!asset) return false;
  if (asset.org_id) {
    const membership = await requireOrgAccess(req, res, asset.org_id, { write: false });
    if (!membership) return false;
    return true;
  }
  if (asset.course_id && supabase) {
    const { data, error } = await supabase
      .from('courses')
      .select('organization_id')
      .eq('id', asset.course_id)
      .maybeSingle();
    if (error) {
      console.error('verifyMediaAssetAccess.courseLookup_failed', { assetId: asset.id, error });
      res.status(500).json({ error: 'Unable to verify course access for asset' });
      return false;
    }
    if (data?.organization_id) {
      const membership = await requireOrgAccess(req, res, data.organization_id, { write: false });
      if (!membership) return false;
      return true;
    }
  }
  if (context.isPlatformAdmin) return true;
  if (asset.uploaded_by && asset.uploaded_by === context.userId) return true;
  res.status(403).json({ error: 'Access denied for media asset' });
  return false;
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

const flattenLessonContentBody = (content) => {
  if (!content || typeof content !== 'object') {
    return {};
  }
  if (typeof content.body === 'object' && content.body !== null) {
    const { body, ...rest } = content;
    const schemaVersion =
      rest.schema_version ??
      body.schema_version ??
      rest.schemaVersion ??
      body.schemaVersion ??
      undefined;
    return {
      ...rest,
      ...body,
      ...(schemaVersion ? { schema_version: schemaVersion } : {}),
    };
  }
  return content;
};

const coerceLessonContent = (lesson) => {
  const candidate =
    lesson?.content_json ??
    lesson?.contentJson ??
    lesson?.content ??
    lesson?.content_body ??
    null;

  if (candidate && typeof candidate === 'object') {
    return flattenLessonContentBody(candidate);
  }

  return {};
};

const shapeCourseForValidation = (courseRow) => {
  const modules = Array.isArray(courseRow?.modules) ? courseRow.modules : [];
  return {
    id: courseRow?.id,
    title: courseRow?.title || courseRow?.name || '',
    description: courseRow?.description || courseRow?.meta_json?.description || '',
    status: courseRow?.status || 'draft',
    modules: modules.map((module) => ({
      id: module?.id,
      title: module?.title || '',
      lessons: (Array.isArray(module?.lessons) ? module.lessons : []).map((lesson) => ({
        id: lesson?.id,
        title: lesson?.title || '',
        type: lesson?.type || 'text',
        description: lesson?.description || '',
        content: coerceLessonContent(lesson),
      })),
    })),
  };
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

const requireAdminAccess = async (req, res) => {
  const context = getRequestContext(req);
  const isOrgAdmin = Array.isArray(context.memberships)
    ? context.memberships.some((membership) => String(membership.role || '').toLowerCase() === 'admin')
    : false;

  let isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');

  if (!isPlatformAdmin && context.userId && supabase) {
    try {
      const { data: profile, error } = await supabase.from('user_profiles').select('role').eq('id', context.userId).maybeSingle();
      if (!error && profile?.role) {
        const normalizedRole = String(profile.role).toLowerCase();
        if (normalizedRole === 'admin') {
          isPlatformAdmin = true;
          context.userRole = 'admin';
          context.isPlatformAdmin = true;
          if (req.user) {
            req.user.role = 'admin';
            req.user.isPlatformAdmin = true;
          }
        }
      }
    } catch (error) {
      console.warn('[adminAccess] profile lookup failed', {
        userId: context.userId,
        error: error?.message || error,
      });
    }
  }

  if (isPlatformAdmin || isOrgAdmin) {
    return true;
  }

  if (shouldLogAuthDebug) {
    console.warn('[adminAccess] denied', {
      path: req?.originalUrl,
      userId: context.userId,
      resolvedRole: context.userRole,
      orgIds: context.organizationIds,
      memberships: context.memberships?.map((m) => ({ orgId: m.orgId, role: m.role })) || [],
    });
  }

  res.status(403).json({ error: 'Platform admin access required' });
  return false;
};

const normalizeMembershipForAdminResponse = (membership = {}) => {
  const resolveOrgId = membership.orgId || membership.organizationId || membership.org_id || membership.organization_id;
  const role = membership.role ? String(membership.role).toLowerCase() : null;
  const status = membership.status ? String(membership.status).toLowerCase() : null;
  return {
    orgId: resolveOrgId || null,
    role,
    status: status || 'active',
    organizationName: membership.organizationName ?? membership.organization_name ?? null,
    organizationSlug: membership.organizationSlug ?? membership.organization_slug ?? membership.org_slug ?? null,
    organizationStatus: membership.organizationStatus ?? membership.organization_status ?? null,
    subscription: membership.subscription ?? null,
    features: membership.features ?? null,
    acceptedAt: membership.acceptedAt ?? membership.accepted_at ?? null,
    lastSeenAt: membership.lastSeenAt ?? membership.last_seen_at ?? null,
  };
};

const isActiveAdminMembership = (membership) => {
  if (!membership) return false;
  const role = String(membership.role || '').toLowerCase();
  if (role !== 'admin') {
    return false;
  }
  const status = String(membership.status || 'active').toLowerCase();
  return status === 'active' || status === 'accepted';
};

app.get('/api/admin/me', requireSupabaseUser, (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const userPayload = req.user || {};
  const rawMemberships = Array.isArray(userPayload.memberships) ? userPayload.memberships : context.memberships || [];
  const memberships = rawMemberships.map((membership) => normalizeMembershipForAdminResponse(membership));
  const adminMemberships = memberships.filter(isActiveAdminMembership);
  const adminOrgIds = Array.from(new Set(adminMemberships.map((membership) => membership.orgId).filter(Boolean)));
  const resolvedActiveOrgId = pickOrgId(
    req.activeOrgId,
    userPayload.activeOrgId,
    userPayload.organizationId,
    adminOrgIds[0],
    context.organizationIds?.[0],
  );

  const permissions = Array.isArray(userPayload.permissions)
    ? userPayload.permissions
    : Array.from(req.userPermissions || []);

  if (shouldLogAuthDebug) {
    console.info('[adminAccess] /api/admin/me granted', {
      userId: context.userId,
      via: context.isPlatformAdmin ? 'platform_admin' : 'org_admin',
      adminOrgIds,
      activeOrgId: resolvedActiveOrgId,
      requestId: req.requestId,
    });
  }

  res.json({
    user: {
      id: context.userId,
      email: userPayload.email || null,
      role: userPayload.role || context.userRole || null,
      platformRole: userPayload.platformRole || null,
      isPlatformAdmin: Boolean(context.isPlatformAdmin || userPayload.isPlatformAdmin),
      activeOrgId: resolvedActiveOrgId,
      organizationIds: context.organizationIds || [],
      memberships,
      adminOrgIds,
      activeMembership: memberships.find((membership) => membership.orgId === resolvedActiveOrgId) ?? null,
      permissions,
    },
    access: {
      allowed: true,
      via: context.isPlatformAdmin ? 'platform' : 'org_admin',
      reason: context.isPlatformAdmin ? 'platform_admin' : 'org_admin_membership',
      orgAdminCount: adminOrgIds.length,
      timestamp: new Date().toISOString(),
    },
    diagnostics: {
      membership: req.membershipDiagnostics || null,
    },
    context: {
      surface: 'admin',
      requestOrgId: pickOrgId(
        req.query?.orgId,
        req.query?.organizationId,
        getHeaderOrgId(req, { requireMembership: false }),
      ),
    },
  });
});

const defaultOrgProfileRow = (orgId) => ({
  org_id: orgId,
  mission: null,
  vision: null,
  core_values: [],
  dei_priorities: [],
  tone_guidelines: null,
  accessibility_commitments: null,
  preferred_languages: [],
  audience_segments: [],
  ai_context: {},
  metadata: {},
  last_ai_refresh_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const INVITE_TOKEN_TTL_HOURS = Number(process.env.CLIENT_INVITE_TTL_HOURS || process.env.ORG_INVITE_TTL_HOURS || 72);
const INVITE_BULK_LIMIT = Number(process.env.CLIENT_INVITE_BULK_LIMIT || 50);
const INVITE_PASSWORD_MIN_CHARS = Number(process.env.CLIENT_INVITE_PASSWORD_MIN || 8);
const INVITE_ACCEPTABLE_STATUSES = new Set(['pending', 'sent']);
const INVITE_LINK_BASE =
  process.env.CLIENT_PORTAL_URL ||
  process.env.APP_BASE_URL ||
  process.env.PUBLIC_APP_URL ||
  process.env.VITE_SITE_URL ||
  'https://the-huddle.co';
const DEFAULT_ORG_PLAN = process.env.DEFAULT_ORG_PLAN || 'standard';
const DEFAULT_ORG_TIMEZONE = process.env.DEFAULT_ORG_TIMEZONE || 'UTC';

const ONBOARDING_STEP_DEFINITIONS = [
  {
    id: 'org_created',
    label: 'Organization created',
    description: 'Organization record created and sandbox enabled.',
    autoComplete: true,
  },
  {
    id: 'assign_owner',
    label: 'Assign owner & backup admin',
    description: 'Ensure at least one owner and backup admin are assigned.',
  },
  {
    id: 'invite_team',
    label: 'Invite teammates',
    description: 'Send invites to core collaborators and managers.',
  },
  {
    id: 'brand_workspace',
    label: 'Configure branding',
    description: 'Upload logos, colors, and communication preferences.',
  },
  {
    id: 'launch_first_course',
    label: 'Publish first course',
    description: 'Publish initial content and share with learners.',
  },
  {
    id: 'review_analytics',
    label: 'Review analytics',
    description: 'Review dashboards to confirm data is flowing.',
  },
];

const slugify = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
};

const slugConstraintNames = new Set([
  'courses_org_slug_unique',
  'courses_slug_key',
  'idx_courses_slug',
  'courses_slug_org_unique',
]);

const isCourseSlugConstraintError = (error) => {
  if (!error || error.code !== '23505') return false;
  const constraint = typeof error.constraint === 'string' ? error.constraint.toLowerCase() : '';
  if (constraint && slugConstraintNames.has(constraint)) {
    return true;
  }
  const combined = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (combined.includes('slug')) return true;
  return false;
};

const buildInviteLink = (token) => {
  const base = INVITE_LINK_BASE?.replace(/\/$/, '') || 'https://the-huddle.co';
  return `${base}/invite/${token}`;
};

const buildOnboardingStepRows = (orgId, actor) => {
  const now = new Date().toISOString();
  return ONBOARDING_STEP_DEFINITIONS.map((step) => ({
    org_id: orgId,
    step: step.id,
    status: step.autoComplete ? 'completed' : 'pending',
    description: step.description,
    completed_at: step.autoComplete ? now : null,
    actor_id: step.autoComplete ? actor?.userId ?? null : null,
    actor_email: step.autoComplete ? actor?.email ?? null : null,
    metadata: {},
  }));
};

async function ensureUniqueOrgSlug(desiredSlug) {
  if (!supabase) return desiredSlug || `org-${randomUUID().slice(0, 8)}`;
  const baseSlug = slugify(desiredSlug) || `org-${randomUUID().slice(0, 8)}`;
  let attempt = 1;
  while (true) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[onboarding] Failed to verify slug uniqueness', { candidate, error });
      if (attempt > 5) {
        return `${baseSlug}-${randomUUID().slice(0, 4)}`;
      }
    }

    if (!data) {
      return candidate;
    }
    attempt += 1;
  }
}

async function ensureUniqueCourseSlug(desiredSlug, { excludeCourseId = null, baseSlug: baseOverride = null } = {}) {
  const normalizedDesired = slugify(desiredSlug) || `course-${randomUUID().slice(0, 8)}`;
  const baseSlug = slugify(baseOverride || normalizedDesired) || normalizedDesired;
  const normalizedExclude = excludeCourseId ? String(excludeCourseId).toLowerCase() : null;
  const candidateAvailable = async (candidate) => {
    if (supabase && !(DEV_FALLBACK || E2E_TEST_MODE)) {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id')
          .eq('slug', candidate)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') {
          console.warn('[courses] Failed to verify slug uniqueness', { candidate, error });
          return false;
        }
        if (!data) return true;
        if (normalizedExclude && String(data.id).toLowerCase() === normalizedExclude) {
          return true;
        }
        return false;
      } catch (error) {
        console.warn('[courses] Slug uniqueness check failed', { candidate, error });
        return false;
      }
    }
    for (const courseRecord of e2eStore.courses.values()) {
      if (normalizedExclude && String(courseRecord.id).toLowerCase() === normalizedExclude) {
        continue;
      }
      const slugValue = (courseRecord.slug ?? courseRecord.id ?? '').toLowerCase();
      if (slugValue && slugValue === candidate.toLowerCase()) {
        return false;
      }
    }
    return true;
  };

  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    if (await candidateAvailable(candidate)) {
      return candidate;
    }
  }
  return `${baseSlug}-${randomUUID().slice(0, 6)}`;
}

async function initializeActivationSteps(orgId, actor) {
  if (!supabase) return;
  try {
    const rows = buildOnboardingStepRows(orgId, actor);
    await supabase.from('org_activation_steps').upsert(rows, { onConflict: 'org_id,step' });
  } catch (error) {
    console.warn('[onboarding] Failed to initialize activation steps', { orgId, error });
  }
}

const respondWithCourseSlugConflict = async ({
  req,
  res,
  courseId,
  organizationId,
  attemptedSlug,
  suggestion,
  idempotencyKey = null,
}) => {
  logSlugConflict({
    courseId: courseId ?? null,
    orgId: organizationId ?? null,
    attemptedSlug: attemptedSlug ?? null,
    suggestion,
    requestId: req.requestId,
  });
  if (idempotencyKey && supabase) {
    try {
      await supabase.from('idempotency_keys').delete().eq('id', idempotencyKey);
    } catch (cleanupErr) {
      console.warn('Failed to release idempotency key after slug conflict', {
        idempotencyKey,
        error: cleanupErr?.message || cleanupErr,
      });
    }
  }
  // Regression check:
  // curl --request POST http://localhost:8888/api/admin/courses \
  //   --header 'Content-Type: application/json' \
  //   --data '{"course":{"title":"Demo Course","slug":"existing-slug","organizationId":"org-demo"}}'
  res.status(409).json({
    code: 'slug_taken',
    message: 'Slug already in use',
    suggestion,
  });
};

async function markActivationStep(orgId, stepId, { status = 'completed', actor, metadata = {} } = {}) {
  if (!supabase) return;
  const payload = {
    status,
    metadata,
  };
  if (status === 'completed') {
    payload.completed_at = new Date().toISOString();
    payload.actor_id = actor?.userId ?? null;
    payload.actor_email = actor?.email ?? null;
  }
  try {
    await supabase
      .from('org_activation_steps')
      .update(payload)
      .eq('org_id', orgId)
      .eq('step', stepId);
  } catch (error) {
    console.warn('[onboarding] Failed to update activation step', { orgId, stepId, error });
  }
}

async function recordActivationEvent(orgId, eventType, metadata = {}, actor) {
  if (!supabase) return;
  try {
    await supabase.from('org_activation_events').insert({
      org_id: orgId,
      event_type: eventType,
      metadata,
      actor_id: actor?.userId ?? null,
      actor_email: actor?.email ?? null,
    });
  } catch (error) {
    console.warn('[onboarding] Failed to record activation event', { orgId, eventType, error });
  }
}

async function createAuditLogEntry(action, details = {}, { userId = null, orgId = null, ip = null } = {}) {
  if (!supabase || !action) return;
  const normalizedOrgId = normalizeOrgIdValue(orgId);
  const payload = {
    action,
    details,
    userId,
    organizationId: normalizedOrgId ?? null,
    ipAddress: ip ?? null,
    createdAt: new Date().toISOString(),
  };
  try {
    await enqueueJob('audit.write', payload);
  } catch (error) {
    logger.warn('audit_queue_failed', { message: error?.message || String(error) });
    try {
      await supabase.from('audit_logs').insert({
        action: payload.action,
        details: payload.details,
        user_id: payload.userId ?? null,
        organization_id: payload.organizationId ?? null,
        ip_address: payload.ipAddress ?? null,
        created_at: payload.createdAt,
      });
    } catch (fallbackError) {
      console.warn('[audit] Failed to persist audit entry', { action, orgId, error: fallbackError });
    }
  }
}

const buildActorFromRequest = (req) => {
  const firstName = req.user?.userMetadata?.first_name || req.user?.appMetadata?.first_name;
  const lastName = req.user?.userMetadata?.last_name || req.user?.appMetadata?.last_name;
  const name = firstName ? `${firstName}${lastName ? ` ${lastName}` : ''}` : req.user?.email;
  return {
    userId: req.user?.userId || req.user?.id || null,
    email: req.user?.email || null,
    name,
  };
};

async function deliverInviteEmail(invite, { orgName, inviterName }) {
  const inviteLink = buildInviteLink(invite.invite_token);
  const subject = `You have been invited to ${orgName || 'The Huddle'}`;
  const summary = [
    inviterName ? `${inviterName} invited you to join ${orgName}.` : `You have been invited to join ${orgName}.`,
    'Click the button below to accept your invite. Your link expires in 72 hours.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="color:#111827;">You're invited!</h2>
      <p>${inviterName ? `<strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong>.` : `You've been invited to join <strong>${orgName}</strong>.`}</p>
      <p>Your invite link expires on <strong>${new Date(invite.expires_at).toUTCString()}</strong>.</p>
      <p style="text-align:center; margin:32px 0;">
        <a href="${inviteLink}" style="background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;display:inline-block;">
          Join ${orgName}
        </a>
      </p>
      <p>If the button doesn't work, copy and paste this URL:</p>
      <p style="word-break:break-all;">${inviteLink}</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
      <p style="color:#6b7280;font-size:0.875rem;">If you didn't expect this email, you can ignore it.</p>
    </div>
  `;

  const text = `${summary}\n\nLink: ${inviteLink}\nExpires: ${new Date(invite.expires_at).toUTCString()}`;
  const result = await sendEmail({ to: invite.email, subject, text, html });
  const sentAt = new Date().toISOString();
  const updatePayload = {
    last_sent_at: sentAt,
    status: result.delivered ? 'sent' : invite.status,
    reminder_count: (invite.reminder_count || 0) + 1,
  };

  if (result.reason === 'smtp_not_configured') {
    updatePayload.status = 'pending';
  }

  try {
    await supabase
      .from('org_invites')
      .update(updatePayload)
      .eq('id', invite.id);
  } catch (error) {
    console.warn('[onboarding] Failed to update invite after email send', { inviteId: invite.id, error });
  }

  return { ...invite, ...updatePayload };
}

async function createOrgInvite({
  orgId,
  email,
  role = 'member',
  inviter,
  orgName,
  metadata = {},
  sendEmail: shouldSendEmail = true,
  duplicateStrategy = 'return',
}) {
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('invalid_email');
  }

  const { data: existing } = await supabase
    .from('org_invites')
    .select('*')
    .eq('org_id', orgId)
    .eq('email', normalizedEmail)
    .in('status', ['pending', 'sent'])
    .maybeSingle();

  if (existing && duplicateStrategy === 'return') {
    if (shouldSendEmail) {
      await deliverInviteEmail(existing, { orgName, inviterName: inviter?.name });
    }
    return { invite: existing, duplicate: true };
  }

  const normalizedMetadata = metadata && typeof metadata === 'object' ? metadata : {};
  const token = randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const payload = {
    org_id: orgId,
    email: normalizedEmail,
    role,
    invite_token: token,
    status: 'pending',
    inviter_id: inviter?.userId ?? null,
    inviter_email: inviter?.email ?? null,
    invited_name: normalizedMetadata?.name ?? null,
    metadata: normalizedMetadata,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from('org_invites')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  let inviteRecord = data;

  if (shouldSendEmail) {
    inviteRecord = await deliverInviteEmail(inviteRecord, { orgName, inviterName: inviter?.name });
  }

  await recordActivationEvent(orgId, 'invite_created', { email: normalizedEmail, role }, inviter);
  await createAuditLogEntry('org_invite_sent', { email: normalizedEmail, role }, { userId: inviter?.userId, orgId });

  return { invite: inviteRecord, duplicate: false };
}

async function runInviteReminderSweep({ limit = 50, reason = 'scheduled' } = {}) {
  if (!supabase) {
    logger.warn('invite_reminder_skipped_supabase_offline');
    return { processed: 0 };
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - INVITE_REMINDER_LOOKBACK_HOURS * 60 * 60 * 1000);

  try {
    const { data, error } = await supabase
      .from('org_invites')
      .select('*')
      .in('status', ['pending', 'sent'])
      .gt('expires_at', now.toISOString())
      .lt('reminder_count', INVITE_REMINDER_MAX_SENDS)
      .order('last_sent_at', { ascending: true })
      .limit(Math.max(limit * 3, limit));

    if (error) {
      logger.warn('invite_reminder_query_failed', { message: error?.message || String(error) });
      return { processed: 0 };
    }

    const candidates = (data || [])
      .filter((invite) => {
        const lastTouch = invite.last_sent_at || invite.created_at;
        if (!lastTouch) return true;
        return new Date(lastTouch).getTime() <= threshold.getTime();
      })
      .slice(0, limit);

    if (!candidates.length) {
      logger.info('invite_reminder_idle', { reason, inspected: data?.length || 0 });
      return { processed: 0 };
    }

    const orgIds = [...new Set(candidates.map((invite) => invite.org_id).filter(Boolean))];
    let orgMap = new Map();
    if (orgIds.length) {
      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      orgMap = new Map((orgRows || []).map((row) => [row.id, row.name]));
    }

    let processed = 0;
    for (const invite of candidates) {
      try {
        await deliverInviteEmail(invite, {
          orgName: orgMap.get(invite.org_id) || 'Your organization',
          inviterName: invite.inviter_email || invite.metadata?.inviter_name || null,
        });
        await recordActivationEvent(invite.org_id, 'invite_reminder_sent', { inviteId: invite.id }, {
          userId: invite.inviter_id,
          email: invite.inviter_email,
        });
        processed += 1;
      } catch (error) {
        logger.warn('invite_reminder_delivery_failed', {
          inviteId: invite.id,
          message: error?.message || String(error),
        });
      }
    }

    logger.info('invite_reminder_completed', { processed, reason });
    return { processed };
  } catch (error) {
    logger.warn('invite_reminder_sweep_failed', { message: error?.message || String(error) });
    return { processed: 0 };
  }
}

function scheduleInviteReminderRunner() {
  if (inviteReminderSchedulerInitialized) return;
  inviteReminderSchedulerInitialized = true;

  if (hasQueueBackend()) {
    enqueueJob(INVITE_REMINDER_JOB, { reason: 'startup' }).catch((error) => {
      logger.warn('invite_reminder_startup_job_failed', { message: error?.message || String(error) });
    });
    enqueueJob(
      INVITE_REMINDER_JOB,
      { reason: 'repeat' },
      {
        repeat: { pattern: INVITE_REMINDER_CRON },
        jobId: `${INVITE_REMINDER_JOB}:repeat`,
      }
    ).catch((error) => {
      logger.warn('invite_reminder_repeat_registration_failed', { message: error?.message || String(error) });
    });
    return;
  }

  inviteReminderIntervalId = setInterval(() => {
    runInviteReminderSweep({ reason: 'interval' }).catch((error) => {
      logger.warn('invite_reminder_interval_failed', { message: error?.message || String(error) });
    });
  }, INVITE_REMINDER_INTERVAL_MS);

  runInviteReminderSweep({ reason: 'interval' }).catch((error) => {
    logger.warn('invite_reminder_initial_failed', { message: error?.message || String(error) });
  });

  logger.info('invite_reminder_interval_scheduled', { intervalMs: INVITE_REMINDER_INTERVAL_MS });
}

function deriveInviteStatus(invite) {
  if (!invite) return 'unknown';
  if (['accepted', 'revoked', 'bounced'].includes(invite.status)) {
    return invite.status;
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }
  return invite.status;
}

async function loadInviteByToken(token) {
  if (!supabase || !token) return null;
  const { data, error } = await supabase
    .from('org_invites')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) return null;
  const derived = deriveInviteStatus(data);
  if (derived === 'expired' && data.status !== 'expired') {
    try {
      await supabase
        .from('org_invites')
        .update({ status: 'expired' })
        .eq('id', data.id);
      data.status = 'expired';
    } catch (updateError) {
      logger.warn('invite_expire_flag_failed', {
        inviteId: data.id,
        message: updateError?.message || String(updateError),
      });
    }
  }
  return data;
}

const INVITE_LOGIN_URL = process.env.CLIENT_INVITE_LOGIN_URL || '/lms/login';

function buildPublicInvitePayload(invite, orgSummary) {
  return {
    id: invite.id,
    orgId: invite.org_id,
    orgName: orgSummary?.name || null,
    orgSlug: orgSummary?.slug || null,
    email: invite.email,
    role: invite.role,
    status: deriveInviteStatus(invite),
    expiresAt: invite.expires_at,
    invitedName: invite.invited_name,
    inviterEmail: invite.inviter_email,
    reminderCount: invite.reminder_count,
    lastSentAt: invite.last_sent_at,
    acceptedAt: invite.accepted_at ?? null,
    requiresAccount: true,
    passwordPolicy: {
      minLength: INVITE_PASSWORD_MIN_CHARS,
    },
    loginUrl: INVITE_LOGIN_URL,
  };
}

async function fetchOrgMembersWithProfiles(orgId) {
  if (!supabase) {
    return [];
  }

  const { data: memberships, error } = await supabase
    .from('organization_memberships')
    .select(
      'id, org_id, user_id, role, status, invited_by, invited_email, accepted_at, last_seen_at, created_at, updated_at',
    )
    .eq('org_id', orgId);
  if (error) throw error;

  const rows = Array.isArray(memberships) ? memberships : [];
  const userIds = rows.map((row) => row?.user_id).filter(Boolean);
  const profileMap = new Map();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('user_id', userIds);
    if (profileError) throw profileError;
    (profiles || []).forEach((profile) => {
      if (profile?.user_id) {
        profileMap.set(profile.user_id, profile);
      }
    });
  }

  return rows.map((membership) => ({
    ...membership,
    user_id_uuid: membership.user_id ?? membership.user_id_uuid ?? null,
    profile: profileMap.get(membership.user_id) || null,
  }));
}

async function upsertOrganizationMembership(orgId, userId, role, actor) {
  if (!supabase) return null;
  const payload = {
    org_id: orgId,
    user_id: userId,
    role,
    status: 'active',
    invited_by: actor?.userId ?? null,
    invited_email: actor?.email ?? null,
    accepted_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('organization_memberships')
    .upsert(payload, { onConflict: 'org_id,user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  await recordActivationEvent(orgId, 'membership_upserted', { userId, role }, actor);
  return data;
}

async function fetchOnboardingProgress(orgId) {
  if (!supabase) return null;
  try {
    const [{ data: progress }, { data: steps }, { data: invites }] = await Promise.all([
      supabase
        .from('org_onboarding_progress_vw')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('org_activation_steps')
        .select('*')
        .eq('org_id', orgId)
        .order('step'),
      supabase
        .from('org_invites')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    return {
      summary: progress,
      steps: steps || [],
      invites: invites || [],
    };
  } catch (error) {
    console.warn('[onboarding] Failed to fetch progress', { orgId, error });
    return null;
  }
}

async function fetchOrganizationSummary(orgId) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .maybeSingle();
    return data;
  } catch (error) {
    return null;
  }
}

const defaultOrgBrandingRow = (orgId) => ({
  org_id: orgId,
  logo_url: null,
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  typography: {},
  media: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const buildContactsMap = (rows = []) =>
  rows.reduce((acc, contact) => {
    const key = contact.org_id || contact.orgId;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(contact);
    return acc;
  }, {});

const buildOrgProfileBundle = (organization, profileRow, brandingRow, contactRows = []) => ({
  organization,
  profile: profileRow ?? defaultOrgProfileRow(organization.id),
  branding: brandingRow ?? defaultOrgBrandingRow(organization.id),
  contacts: contactRows,
});

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const toJsonValue = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') return parsed;
    } catch {}
  }
  return fallback;
};

const normalizeOrgProfileUpdatePayload = (orgId, input = {}) => {
  const payload = { org_id: orgId };
  let hasChanges = false;
  const assign = (key, value) => {
    payload[key] = value;
    hasChanges = true;
  };

  if ('mission' in input) assign('mission', input.mission ?? null);
  if ('vision' in input) assign('vision', input.vision ?? null);
  if ('coreValues' in input || 'core_values' in input) assign('core_values', toArray(input.coreValues ?? input.core_values));
  if ('deiPriorities' in input || 'dei_priorities' in input)
    assign('dei_priorities', toArray(input.deiPriorities ?? input.dei_priorities));
  if ('toneGuidelines' in input || 'tone_guidelines' in input)
    assign('tone_guidelines', input.toneGuidelines ?? input.tone_guidelines ?? null);
  if ('accessibilityCommitments' in input || 'accessibility_commitments' in input)
    assign('accessibility_commitments', input.accessibilityCommitments ?? input.accessibility_commitments ?? null);
  if ('preferredLanguages' in input || 'preferred_languages' in input)
    assign('preferred_languages', toArray(input.preferredLanguages ?? input.preferred_languages));
  if ('audienceSegments' in input || 'audience_segments' in input)
    assign('audience_segments', toJsonValue(input.audienceSegments ?? input.audience_segments, []));
  if ('aiContext' in input || 'ai_context' in input)
    assign('ai_context', toJsonValue(input.aiContext ?? input.ai_context, {}));
  if ('metadata' in input) assign('metadata', toJsonValue(input.metadata, {}));
  if ('lastAiRefreshAt' in input || 'last_ai_refresh_at' in input)
    assign('last_ai_refresh_at', input.lastAiRefreshAt ?? input.last_ai_refresh_at ?? null);

  return hasChanges ? payload : null;
};

const normalizeOrgBrandingUpdatePayload = (orgId, input = {}) => {
  const payload = { org_id: orgId };
  let hasChanges = false;
  const assign = (key, value) => {
    payload[key] = value;
    hasChanges = true;
  };

  if ('logoUrl' in input || 'logo_url' in input) assign('logo_url', input.logoUrl ?? input.logo_url ?? null);
  if ('primaryColor' in input || 'primary_color' in input)
    assign('primary_color', input.primaryColor ?? input.primary_color ?? null);
  if ('secondaryColor' in input || 'secondary_color' in input)
    assign('secondary_color', input.secondaryColor ?? input.secondary_color ?? null);
  if ('accentColor' in input || 'accent_color' in input)
    assign('accent_color', input.accentColor ?? input.accent_color ?? null);
  if ('typography' in input) assign('typography', toJsonValue(input.typography, {}));
  if ('media' in input) assign('media', Array.isArray(input.media) ? input.media : []);

  return hasChanges ? payload : null;
};

const mapContactResponse = (row) => ({
  id: row.id,
  orgId: row.org_id,
  name: row.name,
  email: row.email,
  role: row.role ?? null,
  type: row.type ?? null,
  phone: row.phone ?? null,
  isPrimary: Boolean(row.is_primary),
  notes: row.notes ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

const extractOrgProfileInputs = (body = {}) => {
  if (body && Object.prototype.hasOwnProperty.call(body, 'profile')) {
    return {
      profileInput: body.profile ?? {},
      brandingInput: body.branding ?? {},
    };
  }

  const { branding, ...rest } = body || {};
  return {
    profileInput: rest,
    brandingInput: branding ?? {},
  };
};

const respondWithOrgProfileBundle = (res, bundle, mode = 'bundle') => {
  if (!bundle) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }

  if (mode === 'profile') {
    res.json({ data: bundle.profile });
    return;
  }

  if (mode === 'context') {
    res.json({ data: buildOrgProfileContext(bundle) });
    return;
  }

  res.json({ data: bundle });
};

const handleOrgProfileBundleRequest = async (req, res, { mode = 'bundle', write = false } = {}) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write });
  if (!access) return;

  try {
    const bundle = await fetchOrgProfileBundle(orgId);
    respondWithOrgProfileBundle(res, bundle, mode);
  } catch (error) {
    console.error(`Failed to load organization profile for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to load organization profile' });
  }
};

const handleOrgProfileUpsert = async (req, res, transformBody) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  const rawBody = typeof transformBody === 'function' ? transformBody(req.body || {}) : req.body || {};
  const { profileInput, brandingInput } = extractOrgProfileInputs(rawBody);
  const profilePayload = normalizeOrgProfileUpdatePayload(orgId, profileInput || {});
  const brandingPayload = normalizeOrgBrandingUpdatePayload(orgId, brandingInput || {});

  if (!profilePayload && !brandingPayload) {
    res.status(400).json({ error: 'No profile or branding fields provided' });
    return;
  }

  try {
    if (profilePayload) {
      const { error: profileError } = await supabase
        .from('organization_profiles')
        .upsert(profilePayload, { onConflict: 'org_id' });
      if (profileError) throw profileError;
    }

    if (brandingPayload) {
      const { error: brandingError } = await supabase
        .from('organization_branding')
        .upsert(brandingPayload, { onConflict: 'org_id' });
      if (brandingError) throw brandingError;
    }

    const bundle = await fetchOrgProfileBundle(orgId);
    respondWithOrgProfileBundle(res, bundle, 'bundle');
  } catch (error) {
    console.error(`Failed to upsert organization profile for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to update organization profile' });
  }
};

const hydrateOrgProfileBundles = async (organizations) => {
  if (!organizations || organizations.length === 0) return [];
  const orgIds = organizations.map((org) => org.id);

  const [profilesRes, brandingRes, contactsRes] = await Promise.all([
    supabase.from('organization_profiles').select('*').in('org_id', orgIds),
    supabase.from('organization_branding').select('*').in('org_id', orgIds),
    supabase
      .from('organization_contacts')
      .select('*')
      .in('org_id', orgIds)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (brandingRes.error) throw brandingRes.error;
  if (contactsRes.error) throw contactsRes.error;

  const profilesByOrg = (profilesRes.data ?? []).reduce((acc, row) => {
    acc[row.org_id] = row;
    return acc;
  }, {});

  const brandingByOrg = (brandingRes.data ?? []).reduce((acc, row) => {
    acc[row.org_id] = row;
    return acc;
  }, {});

  const contactsByOrg = buildContactsMap(contactsRes.data ?? []);

  return organizations.map((org) =>
    buildOrgProfileBundle(org, profilesByOrg[org.id], brandingByOrg[org.id], contactsByOrg[org.id] || []),
  );
};

const fetchOrgProfileBundle = async (orgId) => {
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!organization) return null;

  const [profileRes, brandingRes, contactsRes] = await Promise.all([
    supabase.from('organization_profiles').select('*').eq('org_id', orgId).maybeSingle(),
    supabase.from('organization_branding').select('*').eq('org_id', orgId).maybeSingle(),
    supabase
      .from('organization_contacts')
      .select('*')
      .eq('org_id', orgId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (brandingRes.error) throw brandingRes.error;
  if (contactsRes.error) throw contactsRes.error;

  return buildOrgProfileBundle(
    organization,
    profileRes.data ?? undefined,
    brandingRes.data ?? undefined,
    contactsRes.data ?? [],
  );
};

const buildOrgProfileContext = (bundle) => {
  if (!bundle) return null;
  const { organization, profile, branding, contacts } = bundle;

  const context = {
    org: {
      id: organization.id,
      name: organization.name,
      type: organization.type,
      status: organization.status,
      total_learners: organization.total_learners ?? 0,
      active_learners: organization.active_learners ?? 0,
      completion_rate: organization.completion_rate ?? 0,
      cohorts: organization.cohorts ?? [],
      location: {
        city: organization.city,
        state: organization.state,
        country: organization.country,
      },
    },
    context: {
      mission: profile.mission,
      vision: profile.vision,
      core_values: profile.core_values ?? [],
      dei_priorities: profile.dei_priorities ?? [],
      tone_guidelines: profile.tone_guidelines,
      accessibility_commitments: profile.accessibility_commitments,
      preferred_languages: profile.preferred_languages ?? [],
      audience_segments: profile.audience_segments ?? [],
      ai_context: profile.ai_context ?? {},
      metadata: profile.metadata ?? {},
      last_ai_refresh_at: profile.last_ai_refresh_at,
      updated_at: profile.updated_at,
    },
    branding,
    contacts,
    prompts: {
      surveyQuestion:
        profile.mission
          ? `How does this initiative advance ${organization.name}'s mission: ${profile.mission}?`
          : `Personalize questions for ${organization.name} based on their mission and DEI priorities.`,
      coachingTip:
        profile.tone_guidelines
          ? `Use ${profile.tone_guidelines} tone when coaching this organization.`
          : 'Keep coaching tips aligned with the organization’s stated tone and values.',
      copyGuidelines:
        profile.tone_guidelines || branding.primary_color
          ? `Match tone ${profile.tone_guidelines || 'professional'} and highlight brand colors ${
              branding.primary_color || 'primary palette'
            }.`
          : 'Use inclusive, strengths-based language that reflects the organization values.',
    },
  };

  return context;
};

const mapUserProfileResponse = (profileRow, userRow, organizationRow) => {
  const orgId = profileRow?.organization_id || organizationRow?.id || userRow?.organization_id || null;
  return {
    id: profileRow?.id ?? null,
    userId: profileRow?.user_id ?? userRow?.id ?? null,
    name: profileRow?.name ?? [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ').trim(),
    email: profileRow?.email ?? userRow?.email ?? null,
    role: profileRow?.role ?? userRow?.role ?? null,
    organizationId: orgId,
    organization: organizationRow?.name ?? profileRow?.organization ?? null,
    title: profileRow?.title ?? null,
    department: profileRow?.department ?? null,
    location: profileRow?.location ?? null,
    timezone: profileRow?.timezone ?? null,
    phone: profileRow?.phone ?? null,
    language: profileRow?.language ?? null,
    pronouns: profileRow?.pronouns ?? null,
    preferences: profileRow?.preferences ?? {},
    accessibilityPrefs: profileRow?.accessibility_prefs ?? {},
    notificationSettings: profileRow?.notification_settings ?? {},
    createdAt: profileRow?.created_at ?? null,
    updatedAt: profileRow?.updated_at ?? null,
  };
};

const normalizeUserProfileUpdatePayload = (userId, input = {}, opts = {}) => {
  const payload = { user_id: userId };
  let hasChanges = false;
  const assign = (key, value) => {
    payload[key] = value;
    hasChanges = true;
  };

  if ('name' in input) assign('name', input.name ?? null);
  if ('email' in input) assign('email', input.email ?? null);
  if ('organization' in input) assign('organization', input.organization ?? null);
  if ('role' in input) assign('role', input.role ?? null);
  if ('cohort' in input) assign('cohort', input.cohort ?? null);
  if ('title' in input) assign('title', input.title ?? null);
  if ('department' in input) assign('department', input.department ?? null);
  if ('location' in input) assign('location', input.location ?? null);
  if ('timezone' in input) assign('timezone', input.timezone ?? null);
  if ('phone' in input) assign('phone', input.phone ?? null);
  if ('language' in input) assign('language', input.language ?? null);
  if ('pronouns' in input) assign('pronouns', input.pronouns ?? null);

  if ('preferences' in input) assign('preferences', toJsonValue(input.preferences, {}));
  if ('accessibilityPrefs' in input || 'accessibility_prefs' in input)
    assign('accessibility_prefs', toJsonValue(input.accessibilityPrefs ?? input.accessibility_prefs, {}));
  if ('notificationSettings' in input || 'notification_settings' in input)
    assign('notification_settings', toJsonValue(input.notificationSettings ?? input.notification_settings, {}));

  if ('organizationId' in input || 'organization_id' in input) {
    const orgId = input.organizationId ?? input.organization_id;
    if (!orgId) {
      assign('organization_id', null);
    } else if (opts.allowOrgChange) {
      assign('organization_id', orgId);
    }
  }

  return hasChanges ? payload : null;
};

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
    jwtAccessSecretPresent: !!process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecretPresent: !!process.env.JWT_REFRESH_SECRET,
    cookieDomain: !!process.env.COOKIE_DOMAIN,
    corsAllowedConfigured: resolvedCorsOrigins.length > 0,
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
const LOGIN_TIMEOUT_MS = 8000;

const withTimeout = (promise, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label || 'operation'} timed out after ${LOGIN_TIMEOUT_MS}ms`));
    }, LOGIN_TIMEOUT_MS);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const handleLogin = async (req, res) => {
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'missing_credentials',
        message: 'Email and password are required.',
      });
    }

    if (!supabaseAuthClient) {
      console.error('[handleLogin] Supabase auth client missing', { requestId });
      return res.status(500).json({
        ok: false,
        error: 'auth_not_configured',
        message: 'Authentication service unavailable.',
      });
    }

    const normalizedEmail =
      typeof normalizeEmail === 'function'
        ? normalizeEmail(email)
        : String(email ?? '').trim().toLowerCase();
    const { data, error: authError } = await withTimeout(
      supabaseAuthClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      }),
      'supabase.signInWithPassword',
    );

    if (authError || !data?.user || !data.session) {
      console.warn('[handleLogin] invalid credentials', {
        requestId,
        email: normalizedEmail,
        ip: clientIp,
        error: authError?.message || authError || null,
      });
      return res.status(401).json({
        ok: false,
        error: 'invalid_credentials',
        message: 'The email or password you entered is incorrect.',
      });
    }

    return res.status(200).json({
      ok: true,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('[handleLogin] unexpected error', {
      requestId,
      ip: clientIp,
      error: error instanceof Error ? error.message : error,
    });
    return res.status(500).json({
      ok: false,
      error: 'login_failed',
      message: 'Unable to complete login. Please try again.',
    });
  }
};

app.get('/api/auth/verify', authenticate, (req, res) => {
  if (!req.user) {
    res.status(401).json({ valid: false, error: 'unauthenticated' });
    return;
  }

  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      platformRole: req.user.platformRole || null,
      organizationIds: req.user.organizationIds || [],
      activeOrgId: req.activeOrgId || req.user.organizationId || null,
      memberships: req.user.memberships || [],
    },
  });
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
// If BROADCAST_API_KEY is not set (dev), fallback to an authenticated platform admin.
app.post('/api/broadcast', async (req, res) => {
  const { type, topic, data } = req.body || {};

  const requireAdminFallback = async () => {
    const authenticated = await ensureAuthenticatedForHandler(req, res);
    if (!authenticated) return false;
    if (!req.user?.isPlatformAdmin) {
      res.status(403).json({ error: 'Platform admin access required to broadcast' });
      return false;
    }
    return true;
  };

  const broadcastApiKey = process.env.BROADCAST_API_KEY || null;
  if (broadcastApiKey) {
    const auth = (req.get('authorization') || '').trim();
    const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth;
    const headerKey = (req.get('x-broadcast-api-key') || '').trim();
    const providedKey = bearerToken || headerKey;
    if (providedKey !== broadcastApiKey) {
      const allowed = await requireAdminFallback();
      if (!allowed) return;
    }
  } else {
    const allowed = await requireAdminFallback();
    if (!allowed) return;
  }

  if (!type) {
    res.status(400).json({ error: 'type is required' });
    return;
  }

  const payload = { type, data, timestamp: Date.now() };
  if (topic) {
    broadcastToTopic(topic, payload);
  } else {
    // broadcast to all topics
    for (const t of topicSubscribers.keys()) broadcastToTopic(t, payload);
  }

  res.json({ ok: true });
});

// Expose broadcast helper to other server modules
app.locals.broadcastToTopic = broadcastToTopic;

app.get('/api/admin/courses', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const requestedOrgId = pickOrgId(
    req.query?.orgId,
    req.query?.org_id,
    req.query?.organization_id,
    req.query?.organizationId,
    req.body?.orgId,
    req.body?.org_id,
    req.body?.organization_id,
    req.body?.organizationId
  );

  const isPlatformAdmin = Boolean(context.isPlatformAdmin);
  console.log('[admin.courses] access_context', {
    requestId: req.requestId,
    userId: context.userId || null,
    userRole: context.userRole || null,
    isPlatformAdmin,
    requestedOrgId: requestedOrgId || null,
  });
  let adminOrgIds = Array.isArray(context.memberships)
    ? context.memberships
        .filter((membership) => String(membership.role || '').toLowerCase() === 'admin' && membership.orgId)
        .map((membership) => normalizeOrgIdValue(membership.orgId))
        .filter(Boolean)
    : [];
  let allowedOrgIdSet = new Set(adminOrgIds);

  if (!isPlatformAdmin && adminOrgIds.length === 0 && supabase) {
    console.log('[admin.courses] membership_lookup_fallback', {
      requestId: req.requestId,
      userId: context.userId || null,
      reason: 'no_cached_admin_memberships',
    });
    try {
      const { data: adminMemberships, error: adminMembershipsError } = await supabase
        .from('organization_memberships')
        .select('organization_id, org_id, role, status')
        .eq('user_id', context.userId)
        .eq('status', 'active');

      if (adminMembershipsError) throw adminMembershipsError;

      adminOrgIds = (adminMemberships || [])
        .filter((membership) => String(membership.role || '').toLowerCase() === 'admin')
        .map((membership) => pickOrgId(membership.organization_id, membership.org_id))
        .filter(Boolean);

      allowedOrgIdSet = new Set(adminOrgIds);
      console.log('[admin.courses] membership_lookup_result', {
        requestId: req.requestId,
        userId: context.userId || null,
        resolvedOrgIds: adminOrgIds,
      });
    } catch (membershipLookupError) {
      logAdminCoursesError(req, membershipLookupError, 'Failed to load admin memberships');
      res.status(500).json({ error: 'Unable to verify admin organization memberships' });
      return;
    }
  }

  const restrictToAllowed = !isPlatformAdmin && !requestedOrgId;

  if (!isPlatformAdmin && adminOrgIds.length === 0) {
    res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required.' });
    return;
  }

  if (!isPlatformAdmin && !requestedOrgId && adminOrgIds.length === 0) {
    res.json({ data: [], pagination: { page: 1, pageSize: 0, total: 0, hasMore: false } });
    return;
  }

  if (requestedOrgId) {
    const access = await requireOrgAccess(req, res, requestedOrgId, { write: false, requireOrgAdmin: true });
    if (!access) return;
    if (!isPlatformAdmin && !allowedOrgIdSet.has(requestedOrgId)) {
      res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
      return;
    }
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      const shaped = Array.from(e2eStore.courses.values()).map((c) => ({
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
        organization_id: c.organization_id ?? c.org_id ?? null,
        organizationId: c.organizationId ?? c.organization_id ?? c.org_id ?? null,
        org_id: c.org_id ?? c.organization_id ?? null,
        instructorName: c.instructorName ?? null,
        estimatedDuration: c.estimatedDuration ?? null,
        keyTakeaways: c.keyTakeaways ?? [],
        modules: c.modules || [],
      }));
    const filtered = shaped.filter((course) => {
      const courseOrgId = pickOrgId(course.organization_id, course.org_id, course.organizationId);
      if (requestedOrgId) {
        return courseOrgId === requestedOrgId;
      }
      if (!isPlatformAdmin) {
          return courseOrgId ? allowedOrgIdSet.has(courseOrgId) : false;
        }
        return true;
      });
      const responseBody = {
        data: filtered,
        pagination: { page: 1, pageSize: filtered.length, total: filtered.length, hasMore: false },
      };
      if (NODE_ENV !== 'production') {
        responseBody.debug = {
          filterOrgId: requestedOrgId || null,
          totalCountForOrg: filtered.length,
          totalCountAllOrgs: shaped.length,
        };
      }
      res.json(responseBody);
      return;
    } catch (err) {
      logAdminCoursesError(req, err, 'E2E fetch courses failed');
      res.status(500).json({ error: 'Unable to fetch courses' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;

  const { page, pageSize, from, to } = parsePaginationParams(req, { defaultSize: 20, maxSize: 100 });
  const includeStructure = parseBooleanParam(req.query.includeStructure, false);
  const includeLessons = parseBooleanParam(req.query.includeLessons, includeStructure);
  const search = (req.query.search || '').toString().trim();
  const statusFilter = (req.query.status || '')
    .toString()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const orgFilter = requestedOrgId || '';

  const baseFields = [
    'id',
    'slug',
    'title',
    'description',
    'status',
    'meta_json',
    'published_at',
    'thumbnail',
    'difficulty',
    'duration',
    'organization_id',
    'org_id:organization_id',
    'organizationId:organization_id',
    'created_at',
    'updated_at',
  ];

  const moduleFields = includeStructure
    ? includeLessons
      ? COURSE_MODULES_WITH_LESSON_FIELDS
      : COURSE_MODULES_NO_LESSONS_FIELDS
    : '';

  try {
    let query = supabase
      .from('courses')
      .select(`${baseFields.join(',')}${moduleFields}`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      const term = sanitizeIlike(search);
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    if (statusFilter.length) {
      query = query.in('status', statusFilter);
    }

    if (orgFilter) {
      query = query.eq('organization_id', orgFilter);
    } else if (!isPlatformAdmin) {
      query = query.in('organization_id', adminOrgIds);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const normalizedData = Array.isArray(data) ? data : [];
    const responseData = includeStructure
      ? await Promise.all(
          normalizedData.map((courseRecord) =>
            ensureCourseStructureLoaded(courseRecord, { includeLessons }),
          ),
        )
      : normalizedData;

    let debugMeta = null;
    if (NODE_ENV !== 'production') {
      debugMeta = {
        filterOrgId: orgFilter || (restrictToAllowed ? '[allowed_orgs]' : null),
        totalCountForOrg: typeof count === 'number' ? count : 0,
        totalCountAllOrgs: typeof count === 'number' ? count : 0,
      };
      try {
        const { count: globalCount } = await supabase
          .from('courses')
          .select('id', { count: 'exact', head: true });
        if (typeof globalCount === 'number') {
          debugMeta.totalCountAllOrgs = globalCount;
        }
      } catch (countErr) {
        console.warn('[admin.courses] Failed to compute total course count for debug telemetry', countErr);
      }
    }

    const responseBody = {
      data: responseData,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: to + 1 < (count || 0),
      },
    };

    if (debugMeta) {
      responseBody.debug = debugMeta;
    }

    res.json(responseBody);
  } catch (error) {
    console.error('ADMIN COURSES ERROR:', error);
    logAdminCoursesError(req, error, 'Failed to fetch courses');
    res.status(500).json({ error: 'Unable to fetch courses' });
  }
});

app.get('/api/admin/courses/:identifier', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const identifier = (req.params?.identifier || '').trim();
  if (!identifier) {
    res.status(400).json({ error: 'course_identifier_required', message: 'Provide a course id or slug.' });
    return;
  }

  const requestedOrgId = pickOrgId(
    req.query?.orgId,
    req.query?.org_id,
    req.query?.organization_id,
    req.query?.organizationId,
    req.body?.orgId,
    req.body?.org_id,
    req.body?.organization_id,
    req.body?.organizationId,
  );
  const includeStructure = parseBooleanParam(req.query.includeStructure, true);
  const includeLessons = parseBooleanParam(req.query.includeLessons, true);
  const isPlatformAdmin = Boolean(context.isPlatformAdmin);
  const adminOrgIds = Array.isArray(context.memberships)
    ? context.memberships
        .filter((membership) => String(membership.role || '').toLowerCase() === 'admin' && membership.orgId)
        .map((membership) => normalizeOrgIdValue(membership.orgId))
        .filter(Boolean)
    : [];
  const allowedOrgIdSet = new Set(adminOrgIds);

  if (!isPlatformAdmin && adminOrgIds.length === 0) {
    res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required.' });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    let courseRecord = e2eStore.courses.get(identifier) || null;
    if (!courseRecord) {
      for (const record of e2eStore.courses.values()) {
        if ((record.slug && String(record.slug).trim() === identifier) || record.id === identifier) {
          courseRecord = record;
          break;
        }
      }
    }
    if (!courseRecord) {
      res.status(404).json({ error: 'course_not_found' });
      return;
    }
    const courseOrgId = pickOrgId(
      courseRecord.organization_id,
      courseRecord.org_id,
      courseRecord.organizationId,
    );
    if (requestedOrgId && courseOrgId && requestedOrgId !== courseOrgId) {
      res.status(404).json({ error: 'course_not_found' });
      return;
    }
    if (!isPlatformAdmin && courseOrgId && !allowedOrgIdSet.has(courseOrgId)) {
      res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
      return;
    }
    const responseCourse = includeStructure
      ? {
          ...courseRecord,
          modules: normalizeModuleGraph(courseRecord.modules || [], { includeLessons }),
        }
      : (() => {
          const { modules, ...rest } = courseRecord;
          return rest;
        })();
    res.json({ data: responseCourse });
    return;
  }

  if (!ensureSupabase(res)) return;

  const fetchCourseRecord = async (column, value) => {
    const { data, error } = await supabase
      .from('courses')
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
      .eq(column, value)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data;
  };

  let courseRecord = await fetchCourseRecord('id', identifier);
  if (!courseRecord) {
    courseRecord = await fetchCourseRecord('slug', identifier);
  }
  if (!courseRecord) {
    res.status(404).json({ error: 'course_not_found' });
    return;
  }

  const courseOrgId = pickOrgId(
    courseRecord.organization_id,
    courseRecord.org_id,
    courseRecord.organizationId,
  );
  if (requestedOrgId && courseOrgId && requestedOrgId !== courseOrgId) {
    res.status(404).json({ error: 'course_not_found' });
    return;
  }
  if (!isPlatformAdmin) {
    const targetOrgId = courseOrgId || requestedOrgId;
    if (!targetOrgId || !allowedOrgIdSet.has(targetOrgId)) {
      res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
      return;
    }
  }
  if (courseOrgId) {
    const access = await requireOrgAccess(req, res, courseOrgId, { write: false, requireOrgAdmin: true });
    if (!access) return;
  }

  const shapedCourse = includeStructure
    ? await ensureCourseStructureLoaded(courseRecord, { includeLessons })
    : (() => {
        const { modules, ...rest } = courseRecord;
        return rest;
      })();
  res.json({ data: shapedCourse });
});

async function handleAdminCourseUpsert(req, res, options = {}) {
  const { courseIdFromParams = null } = options;
  req.body = req.body || {};
  normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.upsert', requestId: req.requestId });
  let { course: courseLocal, modules: modulesLocal = [] } = req.body || {};
  if (!courseLocal) {
    res.status(400).json({ error: 'course_required', message: 'Missing course object in request body.' });
    return;
  }
  if (courseIdFromParams) {
    const incomingId = courseLocal?.id ?? null;
    if (incomingId && String(incomingId) !== String(courseIdFromParams)) {
      res.status(400).json({ error: 'course_id_mismatch', message: 'Course ID in payload must match URL parameter.' });
      return;
    }
    courseLocal = { ...(courseLocal || {}), id: courseIdFromParams };
    req.body.course = courseLocal;
  }

  // Validate incoming payload (accepting existing client shape)
  const valid = validateOr400(courseUpsertSchema, req, res);
  if (!valid) return;
  const context = requireUserContext(req, res);
  if (!context) return;
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const headerOrgId = getHeaderOrgId(req, { requireMembership: false });
    let organizationId = pickOrgId(
      courseLocal?.organization_id,
      courseLocal?.org_id,
      courseLocal?.organizationId,
      req.body?.organization_id,
      req.body?.org_id,
      req.body?.orgId,
      req.body?.organizationId,
      headerOrgId,
      context.requestedOrgId,
    );
    if (!organizationId && context.isPlatformAdmin) {
      organizationId =
        normalizeOrgIdValue(context.memberships?.[0]?.orgId) ??
        normalizeOrgIdValue(context.organizationIds?.[0]) ??
        null;
    }
    if (!organizationId && !context.isPlatformAdmin) {
      res
        .status(400)
        .json({ error: 'org_required', message: 'Organization required to create course' });
      return;
    }
    if (organizationId) {
      const access = await requireOrgAccess(req, res, organizationId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    }

    if (!courseLocal?.title) {
      res.status(400).json({ error: 'Course title is required' });
      return;
    }
    try {
      const rawSlugInput = typeof courseLocal.slug === 'string' ? courseLocal.slug.trim() : '';
      const slugNeedsDerivation = !rawSlugInput || rawSlugInput === 'new-course';
      const slugSource =
        slugNeedsDerivation && courseLocal
          ? courseLocal.title || courseLocal.name || courseLocal.id || `course-${Date.now().toString(36)}`
          : rawSlugInput;
      const normalizedSlug = slugify(slugSource) || `course-${Date.now().toString(36)}`;
      const derivedSlug = await ensureUniqueCourseSlug(normalizedSlug, {
        excludeCourseId: courseLocal.id ?? null,
        baseSlug: normalizedSlug,
      });
      courseLocal.slug = derivedSlug;

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

      // Idempotent upsert by id or external_id (stored in meta_json)
      let existingId = null;
      const incomingExternalId = (courseLocal.external_id ?? courseLocal.meta?.external_id ?? null) || null;
      if (!courseLocal.id) {
        for (const c of e2eStore.courses.values()) {
          const cExternal = c.meta_json?.external_id ?? null;
          if (incomingExternalId && cExternal && String(cExternal) === String(incomingExternalId)) {
            existingId = c.id;
            break;
          }
        }
      }
      const id = courseLocal.id ?? existingId ?? `e2e-course-${Date.now()}`;
      const resolvedSlug = courseLocal.slug;
      const courseObj = {
        id,
        slug: resolvedSlug,
        title: courseLocal.title,
        description: courseLocal.description ?? null,
        status: courseLocal.status ?? 'draft',
        version: courseLocal.version ?? 1,
        meta_json: { ...(courseLocal.meta ?? {}), ...(incomingExternalId ? { external_id: incomingExternalId } : {}) },
        published_at: null,
        organization_id: organizationId || null,
        organizationId: organizationId || null,
        org_id: organizationId || null,
        modules: [],
      };
      const modulesArr = modulesLocal || [];
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

  let { course, modules = [] } = req.body || {};
  modules = Array.isArray(modules) ? modules : [];
  const orgCandidates = [
    course?.organization_id,
    course?.org_id,
    course?.organizationId,
    req.body?.organization_id,
    req.body?.org_id,
    req.body?.orgId,
    req.body?.organizationId,
    req.activeOrgId,
    req.user?.activeOrgId,
    req.user?.organizationId,
  ];
  let organizationId;
  try {
    organizationId = await resolveOrgIdForCourseRequest(req, context, orgCandidates);
  } catch (orgErr) {
    if (orgErr instanceof InvalidOrgIdentifierError) {
      respondInvalidOrg(res, orgErr.identifier);
      return;
    }
    throw orgErr;
  }
  if (organizationId) {
    course.organization_id = organizationId;
    course.organizationId = organizationId;
    course.org_id = organizationId;
    if (req.body?.course) {
      req.body.course.organization_id = organizationId;
      req.body.course.organizationId = organizationId;
      req.body.course.org_id = organizationId;
    }
  }
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

  const initialNormalization = normalizeModuleLessonPayloads(modules, {
    courseId: course?.id ?? courseIdFromParams ?? null,
    organizationId,
    pickOrgId,
  });
  logModuleNormalizationDiagnostics(initialNormalization.diagnostics, {
    requestId: req.requestId,
    source: 'course_upsert.initial',
    courseId: course?.id ?? courseIdFromParams ?? null,
  });
  modules = initialNormalization.modules;

  if (!course?.title) {
    res.status(400).json({ error: 'Course title is required' });
    return;
  }
  const updateCourseSlug = (nextSlug) => {
    if (course) {
      course.slug = nextSlug;
      if (req.body?.course) {
        req.body.course.slug = nextSlug;
      }
    }
  };
  const slugRetryState = {
    base: null,
    attempts: 0,
    max: 5,
  };
  const applyUniqueSlug = async (baseSlug) => {
    const targetBase = slugify(baseSlug) || `course-${randomUUID().slice(0, 8)}`;
    const nextSlug = await ensureUniqueCourseSlug(targetBase, {
      excludeCourseId: course?.id ?? courseIdFromParams ?? null,
      baseSlug: targetBase,
    });
    slugRetryState.base = targetBase;
    updateCourseSlug(nextSlug);
    return nextSlug;
  };
  const applyNextSlugAfterConflict = async () => {
    if (slugRetryState.attempts >= slugRetryState.max) {
      return false;
    }
    const targetBase =
      slugRetryState.base || slugify(course?.slug || `course-${randomUUID().slice(0, 8)}`) || `course-${randomUUID().slice(0, 8)}`;
    const nextSlug = await ensureUniqueCourseSlug(targetBase, {
      excludeCourseId: course?.id ?? courseIdFromParams ?? null,
      baseSlug: targetBase,
    });
    if (nextSlug === course?.slug) {
      slugRetryState.attempts = slugRetryState.max;
      return false;
    }
    slugRetryState.base = targetBase;
    slugRetryState.attempts += 1;
    updateCourseSlug(nextSlug);
    return true;
  };

  const rawSlugInput = typeof course?.slug === 'string' ? course.slug.trim() : '';
  const slugNeedsDerivation = !rawSlugInput || rawSlugInput === 'new-course';
  const slugSource = slugNeedsDerivation
    ? course?.title || course?.name || course?.id || `course-${randomUUID().slice(0, 8)}`
    : rawSlugInput;
  const normalizedSlug = slugify(slugSource) || `course-${randomUUID().slice(0, 8)}`;
  await applyUniqueSlug(normalizedSlug);

  const desiredStatus = typeof course?.status === 'string' ? course.status.toLowerCase() : 'draft';
  if (desiredStatus === 'published') {
    const shapedForValidation = shapeCourseForValidation({ ...course, modules });
    const validation = validatePublishableCourse(shapedForValidation, { intent: 'publish' });
    if (!validation.isValid) {
      res.status(422).json({ error: 'validation_failed', issues: validation.issues });
      return;
    }
  }

  try {
    const meta = course.meta ?? {};
    const resolvedCourseVersion = typeof course?.version === 'number' ? course.version : 1;
    let includeCourseVersionField = courseVersionColumnAvailable;
    const maybeHandleMissingCourseVersion = (error) => {
      const flagged = handleCourseVersionColumnError(error);
      if (flagged) {
        includeCourseVersionField = false;
      }
      return flagged;
    };
    const buildCourseRecordPayload = (includeVersion = includeCourseVersionField) => {
      const payload = {
        id: course.id ?? undefined,
        slug: course.slug ?? undefined,
        title: course.title || course.name,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        organization_id: organizationId,
        meta_json: meta,
      };
      if (includeVersion) {
        payload.version = resolvedCourseVersion;
      }
      return payload;
    };

    // Optional optimistic version check to avoid overwriting newer versions
    if (course.id) {
      const existing = await supabase.from('courses').select('id, version, organization_id').eq('id', course.id).maybeSingle();
      if (existing.error) throw existing.error;
      const currVersion = existing.data?.version ?? null;
      if (currVersion !== null && typeof course.version === 'number' && course.version < currVersion) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${currVersion}` });
        return;
      }
      if (!organizationId && existing.data?.organization_id) {
        organizationId = existing.data.organization_id;
      }
      if (organizationId && !course.organization_id) {
        course.organization_id = organizationId;
        course.organizationId = organizationId;
        course.org_id = organizationId;
        if (req.body?.course) {
          req.body.course.organization_id = organizationId;
          req.body.course.organizationId = organizationId;
          req.body.course.org_id = organizationId;
        }
      }
    }

    if (!organizationId) {
      res.status(400).json({ error: 'org_required', message: 'Organization required to create course' });
      return;
    }

    if (organizationId) {
      const access = await requireOrgAccess(req, res, organizationId, { write: true, requireOrgAdmin: true });
      if (!access) return;
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
                .select(COURSE_WITH_MODULES_LESSONS_SELECT)
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

    const attemptRpcUpsert = async () => {
      if (!includeCourseVersionField) return false;
      while (true) {
        const rpcPayload = buildCourseRecordPayload(true);
        try {
          console.log('[srv] Attempting RPC upsert_course_full', { rpcPayload, moduleCount: Array.isArray(modules) ? modules.length : 0 });
        } catch (_) {}
        try {
          const rpcRes = await supabase.rpc('upsert_course_full', { p_course: rpcPayload, p_modules: modules });
          try {
            console.log('[srv] rpcRes for upsert_course_full', { error: rpcRes?.error ?? null, data: rpcRes?.data ?? null });
          } catch (_) {}
          if (rpcRes.error) {
            const rpcErrorMeta = {
              code: rpcRes.error?.code ?? null,
              message: rpcRes.error?.message ?? null,
              details: rpcRes.error?.details ?? null,
              hint: rpcRes.error?.hint ?? null,
            };
            console.error('[admin-courses] upsert_course_full_rpc_error', {
              requestId: req?.requestId ?? null,
              courseId: course?.id ?? null,
              orgId: organizationId ?? null,
              error: rpcErrorMeta,
            });
            if (isCourseSlugConstraintError(rpcRes.error)) {
              const incremented = await applyNextSlugAfterConflict();
              if (incremented) {
                continue;
              }
            }
          }
          if (!rpcRes.error && rpcRes.data) {
            const sel = await supabase
              .from('courses')
              .select(COURSE_WITH_MODULES_LESSONS_SELECT)
              .eq('id', rpcRes.data)
              .single();
            if (sel.error) throw sel.error;
            res.status(201).json({ data: sel.data });
            return true;
          }
          break;
        } catch (rpcErr) {
          const rpcErrorMeta = rpcErr && typeof rpcErr === 'object'
            ? {
                code: rpcErr.code ?? null,
                message: rpcErr.message ?? null,
                details: rpcErr.details ?? null,
                hint: rpcErr.hint ?? null,
              }
            : { code: null, message: rpcErr, details: null, hint: null };
          console.error('[admin-courses] upsert_course_full_rpc_exception', {
            requestId: req?.requestId ?? null,
            courseId: course?.id ?? null,
            orgId: organizationId ?? null,
            error: rpcErrorMeta,
          });
          const handled = maybeHandleMissingCourseVersion(rpcErr);
          if (!handled) {
            if (isCourseSlugConstraintError(rpcErr)) {
              const incremented = await applyNextSlugAfterConflict();
              if (incremented) {
                continue;
              }
            }
            console.warn('RPC upsert_course_full failed, falling back to client-side sequence:', rpcErr);
          } else {
            console.warn('RPC upsert_course_full skipped course version field due to missing column');
          }
          break;
        }
      }
      return false;
    };

    const rpcSucceeded = await attemptRpcUpsert();
    if (rpcSucceeded) {
      return;
    }

    // Upsert course row first to obtain courseRow.id
    let courseRow = null;
    let lastCourseError = null;
    while (!courseRow) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const upsertPayload = buildCourseRecordPayload(includeCourseVersionField);
        try {
          console.log('[srv] Performing course upsert', { upsertPayload });
        } catch (_) {}

        const courseRes = await supabase.from('courses').upsert(upsertPayload).select('*').single();

        if (!courseRes.error) {
          courseRow = courseRes.data;
          lastCourseError = null;
          break;
        }

        lastCourseError = courseRes.error;
        const errMeta = {
          message: courseRes.error?.message ?? null,
          code: courseRes.error?.code ?? null,
          details: courseRes.error?.details ?? null,
          hint: courseRes.error?.hint ?? null,
        };
        console.error('[admin-courses] course_upsert_error', {
          requestId: req?.requestId ?? null,
          courseId: course?.id ?? courseRow?.id ?? null,
          error: errMeta,
        });
        logAdminCourseWriteFailure(req, 'courses.upsert', upsertPayload, courseRes.error, {
          courseId: course?.id ?? courseRow?.id ?? null,
        });

        if (isCourseSlugConstraintError(courseRes.error)) {
          break;
        }

        if (includeCourseVersionField && maybeHandleMissingCourseVersion(courseRes.error)) {
          continue;
        }
        throw courseRes.error;
      }

      if (courseRow) break;

      if (lastCourseError && isCourseSlugConstraintError(lastCourseError)) {
        const incremented = await applyNextSlugAfterConflict();
        if (incremented) {
          lastCourseError = null;
          continue;
        }
      }

      if (lastCourseError) {
        throw lastCourseError;
      }

      throw new Error('Failed to upsert course record');
    }

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

    const persistenceNormalization = normalizeModuleLessonPayloads(modules, {
      courseId: courseRow.id,
      organizationId: organizationId ?? courseRow.organization_id ?? null,
      pickOrgId,
    });
    logModuleNormalizationDiagnostics(persistenceNormalization.diagnostics, {
      requestId: req.requestId,
      source: 'course_upsert.persist',
      courseId: courseRow.id,
    });
    const modulesForPersistence = persistenceNormalization.modules;

    const incomingModuleIds = modulesForPersistence.map((module) => module.id).filter(Boolean);
    if (incomingModuleIds.length > 0) {
      const { data: existingModules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseRow.id);

      const modulesToDelete = (existingModules || [])
        .map((row) => row.id)
        .filter((id) => !incomingModuleIds.includes(id));

      if (modulesToDelete.length > 0) {
        const { error: deleteModulesError } = await supabase.from('modules').delete().in('id', modulesToDelete);
        if (deleteModulesError) {
          logAdminCourseWriteFailure(
            req,
            'modules.delete',
            { count: modulesToDelete.length },
            deleteModulesError,
            { courseId: courseRow.id },
          );
          throw deleteModulesError;
        }
      }

      for (const [moduleIndex, module] of modulesForPersistence.entries()) {
        const buildModuleUpsertPayload = () => {
          const payload = {
            id: module.id,
            course_id: module.course_id ?? courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null,
          };
          const moduleOrgId = pickOrgId(
            module.organization_id,
            module.org_id,
            module.organizationId,
            organizationId ?? courseRow.organization_id ?? null,
          );
          if (moduleColumnSupport.organizationId && moduleOrgId) {
            payload.organization_id = moduleOrgId;
          }
          return payload;
        };

        let moduleRow = null;
        let moduleError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const modulePayload = buildModuleUpsertPayload();
          const moduleRes = await supabase.from('modules').upsert(modulePayload).select('*').single();
          if (!moduleRes.error) {
            moduleRow = moduleRes.data;
            moduleError = null;
            break;
          }
          moduleError = moduleRes.error;
          if (maybeHandleModuleColumnError(moduleError)) {
            continue;
          }
          throw moduleError;
        }

        if (!moduleRow) {
          logAdminCourseWriteFailure(
            req,
            'modules.upsert',
            module,
            moduleError || new Error('Failed to upsert module'),
            { courseId: courseRow.id, moduleId: module.id ?? null },
          );
          throw moduleError || new Error('Failed to upsert module');
        }

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
            const { error: deleteLessonsError } = await supabase
              .from('lessons')
              .delete()
              .in('id', lessonsToDelete);
            if (deleteLessonsError) {
              logAdminCourseWriteFailure(
                req,
                'lessons.delete',
                { count: lessonsToDelete.length },
                deleteLessonsError,
                { courseId: courseRow.id, moduleId: moduleRow.id },
              );
              throw deleteLessonsError;
            }
          }

          const buildLessonUpsertPayload = (lessonInput, moduleRowPayload, moduleData, lessonIndex) => {
            const baseDuration =
              typeof lessonInput.duration_s === 'number' && Number.isFinite(lessonInput.duration_s)
                ? lessonInput.duration_s
                : null;
            const contentPayload = lessonInput.content_json ?? lessonInput.content ?? {};
            const payload = {
              id: lessonInput.id,
              module_id: moduleRowPayload.id,
              order_index: lessonInput.order_index ?? lessonIndex,
              type: lessonInput.type,
              title: lessonInput.title,
              description: lessonInput.description ?? null,
            };
            if (lessonColumnSupport.durationSeconds) {
              payload.duration_s = baseDuration;
            }
            if (lessonColumnSupport.durationText) {
              const legacyDuration = lessonInput.duration ?? (baseDuration != null ? formatLegacyDuration(baseDuration) : null);
              if (legacyDuration) {
                payload.duration = legacyDuration;
              }
            }
            if (lessonColumnSupport.contentJson) {
              payload.content_json = contentPayload || {};
            }
            if (lessonColumnSupport.contentLegacy) {
              payload.content = contentPayload || {};
            }
            if (lessonColumnSupport.completionRuleJson && lessonInput.completion_rule_json) {
              payload.completion_rule_json = lessonInput.completion_rule_json;
            }
            const resolvedLessonOrgId = pickOrgId(
              lessonInput.organization_id,
              lessonInput.org_id,
              lessonInput.organizationId,
              moduleData?.organization_id,
              moduleRowPayload?.organization_id,
              organizationId ?? courseRow.organization_id ?? null,
            );
            if (lessonColumnSupport.organizationId && resolvedLessonOrgId) {
              payload.organization_id = resolvedLessonOrgId;
            }
            const resolvedLessonCourseId = coerceTextId(
              lessonInput.course_id,
              lessonInput.courseId,
              moduleData?.course_id,
              moduleRowPayload?.course_id,
              courseRow.id,
            );
            if (lessonColumnSupport.courseId && resolvedLessonCourseId) {
              payload.course_id = resolvedLessonCourseId;
            }
            return payload;
          };

          for (const [lessonIndex, lesson] of lessons.entries()) {
            let lessonPayload = buildLessonUpsertPayload(lesson, moduleRow, module, lessonIndex);
            for (let attempt = 0; attempt < 2; attempt += 1) {
              const { error: lessonError } = await supabase.from('lessons').upsert(lessonPayload);
              if (!lessonError) {
                break;
              }
              logAdminCourseWriteFailure(
                req,
                'lessons.upsert',
                lessonPayload,
                lessonError,
                { courseId: courseRow.id, moduleId: moduleRow.id, lessonId: lesson.id ?? null },
              );
              if (maybeHandleLessonColumnError(lessonError)) {
                lessonPayload = buildLessonUpsertPayload(lesson, moduleRow, module, lessonIndex);
                continue;
              }
              throw lessonError;
            }
          }
        } else {
          const { error: purgeLessonsError } = await supabase.from('lessons').delete().eq('module_id', moduleRow.id);
          if (purgeLessonsError) {
            logAdminCourseWriteFailure(
              req,
              'lessons.delete_module',
              { moduleId: moduleRow.id },
              purgeLessonsError,
              { courseId: courseRow.id, moduleId: moduleRow.id },
            );
            throw purgeLessonsError;
          }
        }
      }
    } else {
      const { error: purgeModulesError } = await supabase.from('modules').delete().eq('course_id', courseRow.id);
      if (purgeModulesError) {
        logAdminCourseWriteFailure(
          req,
          'modules.delete_course',
          { courseId: courseRow.id },
          purgeModulesError,
          { courseId: courseRow.id },
        );
        throw purgeModulesError;
      }
    }

    const refreshed = await supabase
      .from('courses')
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
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
    try {
      console.error('[admin-courses] upsert_error_detail', {
        message: error?.message ?? null,
        code: error?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
        stack: error?.stack ?? null,
        organizationId,
        requestId: req.requestId ?? null,
      });
    } catch (_) {}
    logAdminCoursesError(req, error, 'Failed to upsert course', {
      userId: context?.userId ?? null,
      organizationId,
    });
    // Provide more details to the client for debugging
    const errorMessage = error?.message || 'Unable to save course';
    const errorDetails = error?.details || error?.hint || null;
    res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      code: error?.code ?? null,
      hint: error?.hint ?? null,
      timestamp: new Date().toISOString(),
    });
  }
}

app.post('/api/admin/courses', async (req, res) => {
  await handleAdminCourseUpsert(req, res);
});

app.put('/api/admin/courses/:id', async (req, res) => {
  await handleAdminCourseUpsert(req, res, { courseIdFromParams: req.params.id });
});

// Batch import endpoint (best-effort transactional behavior in E2E/DEV fallback)
const COURSE_IMPORT_TABLES = [
  { table: 'courses', columns: ['id', 'slug', 'organization_id'] },
  { table: 'modules', columns: ['id', 'course_id'] },
  { table: 'lessons', columns: ['id', 'module_id'] },
];

app.post('/api/admin/courses/import', async (req, res) => {
  normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.import', requestId: req.requestId });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }
  const context = requireUserContext(req, res);
  if (!context) return;

  // In demo/E2E, snapshot and rollback on failure
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const snapshot = new Map(e2eStore.courses);
    const results = [];
    try {
      for (const payload of items) {
        const { course, modules = [] } = payload || {};
        if (!course?.title) throw new Error('Course title is required');

        const headerOrgId = getHeaderOrgId(req, { requireMembership: false });
        let resolvedOrgId = pickOrgId(
          course?.organization_id,
          course?.org_id,
          course?.organizationId,
          payload?.organization_id,
          payload?.org_id,
          payload?.organizationId,
          headerOrgId,
          context.requestedOrgId,
        );
        if (!resolvedOrgId && context.isPlatformAdmin) {
          resolvedOrgId =
            normalizeOrgIdValue(context.memberships?.[0]?.orgId) ??
            normalizeOrgIdValue(context.organizationIds?.[0]) ??
            null;
        }
        if (!resolvedOrgId) {
          res.status(400).json({ error: 'org_required', message: 'Organization required to create course' });
          return;
        }
        const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return;
        if (String(course.status || '').toLowerCase() === 'published') {
          const shaped = shapeCourseForValidation({ ...course, modules });
          const validation = validatePublishableCourse(shaped, { intent: 'publish' });
          if (!validation.isValid) {
            res.status(422).json({ error: 'validation_failed', issues: validation.issues });
            return;
          }
        }

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
          organization_id: resolvedOrgId,
          organizationId: resolvedOrgId,
          org_id: resolvedOrgId,
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
      logAdminCoursesError(req, err, 'E2E import failed', {
        userId: context?.userId ?? null,
      });
      res.status(400).json({ error: 'Import failed', details: String(err?.message || err) });
    }
    return;
  }

  // Supabase-backed path: sequential upsert (no transaction here)
  if (!ensureSupabase(res)) return;
  const schemaStatus = await ensureTablesReady('admin.courses.import', COURSE_IMPORT_TABLES);
  if (!schemaStatus.ok) {
    respondSchemaUnavailable(res, 'admin.courses.import', schemaStatus);
    return;
  }
  try {
    const results = [];
    for (const payload of items) {
      const { course, modules = [] } = payload || {};
      if (!course?.title) throw new Error('Course title is required');
      const orgCandidates = [
        course?.organization_id,
        course?.org_id,
        course?.organizationId,
        payload?.organization_id,
        payload?.org_id,
        payload?.organizationId,
        req.body?.organization_id,
        req.body?.org_id,
        req.body?.organizationId,
        req.activeOrgId,
        req.user?.activeOrgId,
        req.user?.organizationId,
      ];
      let resolvedOrgId;
      try {
        resolvedOrgId = await resolveOrgIdForCourseRequest(req, context, orgCandidates);
      } catch (orgErr) {
        if (orgErr instanceof InvalidOrgIdentifierError) {
          respondInvalidOrg(res, orgErr.identifier);
          return;
        }
        throw orgErr;
      }
      if (!resolvedOrgId) {
        res.status(400).json({ error: 'org_required', message: 'Organization required to create course' });
        return;
      }
      const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
      if (String(course.status || '').toLowerCase() === 'published') {
        const shaped = shapeCourseForValidation({ ...course, modules });
        const validation = validatePublishableCourse(shaped, { intent: 'publish' });
        if (!validation.isValid) {
          res.status(422).json({ error: 'validation_failed', issues: validation.issues });
          return;
        }
      }
      course.organization_id = resolvedOrgId;
      course.organizationId = resolvedOrgId;
      course.org_id = resolvedOrgId;
      const upsertRes = await runSupabaseQueryWithRetry('admin.courses.import.upsert_course', () =>
        supabase.from('courses').upsert({
          id: course.id ?? undefined,
          slug: course.slug ?? undefined,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          organization_id: resolvedOrgId,
          meta_json: { ...(course.meta ?? {}), ...(course.external_id ? { external_id: course.external_id } : {}) },
        }).select('*').single(),
      );
      const courseRow = upsertRes.data;
      // naive: clear and reinsert modules/lessons for this course
      const existingModulesRes = await runSupabaseQueryWithRetry('admin.courses.import.fetch_modules', () =>
        supabase.from('modules').select('id').eq('course_id', courseRow.id),
      );
      const existingModuleIds = (existingModulesRes.data || []).map((row) => row.id);

      if (existingModuleIds.length > 0) {
        await runSupabaseQueryWithRetry('admin.courses.import.delete_lessons', () =>
          supabase.from('lessons').delete().in('module_id', existingModuleIds),
        );
      }

      await runSupabaseQueryWithRetry('admin.courses.import.delete_modules', () =>
        supabase.from('modules').delete().eq('course_id', courseRow.id),
      );

      for (const [moduleIndex, module] of (modules || []).entries()) {
        const modIns = await runSupabaseQueryWithRetry('admin.courses.import.insert_module', () =>
          supabase.from('modules').insert({
            id: module.id ?? undefined,
            course_id: courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null,
          }).select('*').single(),
        );
        const modRow = modIns.data;
        for (const [lessonIndex, lesson] of (module.lessons || []).entries()) {
          await runSupabaseQueryWithRetry('admin.courses.import.insert_lesson', () =>
            supabase.from('lessons').insert({
              id: lesson.id ?? undefined,
              module_id: modRow.id,
              order_index: lesson.order_index ?? lessonIndex,
              type: lesson.type,
              title: lesson.title,
              description: lesson.description ?? null,
              duration_s: lesson.duration_s ?? null,
              content_json: lesson.content_json ?? lesson.content ?? {},
              completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
            }),
          );
        }
      }
      results.push({ id: courseRow.id, slug: courseRow.slug, title: courseRow.title });
    }
    res.status(201).json({ data: results });
  } catch (error) {
    logAdminCoursesError(req, error, 'Import failed', {
      userId: context?.userId ?? null,
      organizationId: context?.requestedOrgId ?? null,
    });
    res.status(500).json({
      error: 'Import failed',
      details: error?.message || error?.hint || null,
    });
  }
});

// Assignments listing for client: return active assignments for a user
app.get('/api/client/assignments', authenticate, async (req, res) => {
  const queryUserId =
    typeof req.query.user_id === 'string'
      ? req.query.user_id
      : typeof req.query.userId === 'string'
      ? req.query.userId
      : '';
  const normalizedQueryUserId = queryUserId ? queryUserId.toString().trim().toLowerCase() : '';
  const sessionUserId = (req.user && (req.user.userId || req.user.id)) || '';
  const normalizedSessionUserId = sessionUserId ? sessionUserId.toString().trim().toLowerCase() : '';
  const isAdminUser = (req.user?.role || '').toLowerCase() === 'admin';
  const targetUserId = isAdminUser && normalizedQueryUserId ? normalizedQueryUserId : normalizedSessionUserId;
  const includeCompletedAssignments =
    String(req.query.includeCompleted || req.query.include_completed || 'true').toLowerCase() === 'true';
  const requestId = req.requestId;

  if (!targetUserId) {
    res.status(401).json({ error: 'not_authenticated', message: 'Authentication required to fetch assignments' });
    return;
  }

  if (!isAdminUser && normalizedQueryUserId && normalizedQueryUserId !== normalizedSessionUserId) {
    logger.warn('client_assignments_user_override_blocked', {
      requestId,
      requestedUserId: normalizedQueryUserId,
      sessionUserId: normalizedSessionUserId,
    });
  }

  const resolvedOrgFilter = (() => {
    if (isAdminUser) {
      const orgParam =
        typeof req.query.orgId === 'string'
          ? req.query.orgId
          : typeof req.query.organizationId === 'string'
          ? req.query.organizationId
          : '';
      return orgParam ? orgParam.trim() : null;
    }
    if (req.user?.organizationId) {
      return String(req.user.organizationId).trim();
    }
    return null;
  })();

  const respond = (rows = [], meta = {}) =>
    res.json({
      data: rows,
      meta: {
        requestId,
        userId: targetUserId,
        orgFilter: resolvedOrgFilter,
        ...meta,
      },
    });

  if (!supabase) {
    if (E2E_TEST_MODE || DEV_FALLBACK) {
      const rows = (e2eStore.assignments || []).filter((assignment) => {
        if (!assignment || assignment.active === false) return false;
        return String(assignment.user_id || '').toLowerCase() === targetUserId;
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
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false });

      if (table === 'assignments') {
        if (includeCompletedAssignments) {
          query = query.or('active.eq.true,status.eq.completed,status.eq.in-progress,status.eq.assigned');
        } else {
          query = query.eq('active', true);
        }
      }

      if (resolvedOrgFilter) {
        if (table === 'assignments') {
          query = query.or(`organization_id.eq.${resolvedOrgFilter},organization_id.is.null`);
        }
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
      userId: targetUserId,
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
  const rawOrgQuery =
    typeof req.query.orgId === 'string'
      ? req.query.orgId
      : typeof req.query.organizationId === 'string'
      ? req.query.organizationId
      : '';
  const orgFilter = rawOrgQuery.trim() || req.activeOrgId || null;

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
  const context = requireUserContext(req, res);
  if (!context) return;
  normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.publish', requestId: req.requestId });

  const idempotencyKey = req.body?.idempotency_key ?? req.body?.client_event_id ?? null;

  try {
    if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const existing = e2eStore.courses.get(id);
      if (!existing) {
        res.status(404).json({ error: 'Course not found', code: 'not_found' });
        return;
      }

      const shaped = shapeCourseForValidation(existing);
      const validation = validatePublishableCourse(shaped, { intent: 'publish' });
      if (!validation.isValid) {
        res.status(422).json({ error: 'validation_failed', code: 'validation_failed', issues: validation.issues });
        return;
      }

      existing.status = 'published';
      const currentVersion = typeof existing.version === 'number' ? existing.version : 0;
      existing.version = currentVersion + 1;
      existing.published_at = new Date().toISOString();

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

    const existing = await supabase
      .from('courses')
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) {
      res.status(404).json({ error: 'Course not found', code: 'not_found' });
      return;
    }

    const courseOrgId = existing.data.organization_id || existing.data.org_id || null;
    if (courseOrgId) {
      const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'Organization membership required to publish', code: 'org_required' });
      return;
    }

    const incomingVersion = typeof req.body?.version === 'number' ? req.body.version : null;
    const currentVersion = typeof existing.data.version === 'number' ? existing.data.version : null;
    if (incomingVersion !== null && currentVersion !== null && incomingVersion !== currentVersion) {
      res.status(409).json({
        error: 'version_conflict',
        code: 'version_conflict',
        message: `Course has newer version ${currentVersion}`,
        currentVersion,
      });
      return;
    }

    const shaped = shapeCourseForValidation(existing.data);
    const validation = validatePublishableCourse(shaped, { intent: 'publish' });
    if (!validation.isValid) {
      res.status(422).json({ error: 'validation_failed', code: 'validation_failed', issues: validation.issues });
      return;
    }

    if (idempotencyKey) {
      try {
        await supabase
          .from('idempotency_keys')
          .insert({
            id: idempotencyKey,
            key_type: 'course_publish',
            resource_id: null,
            payload: { course_id: id, version: currentVersion },
          });
      } catch (ikErr) {
        try {
          const { data: existingKey } = await supabase
            .from('idempotency_keys')
            .select('*')
            .eq('id', idempotencyKey)
            .maybeSingle();
          if (existingKey?.resource_id) {
            const { data: publishedCourse } = await supabase
              .from('courses')
              .select(COURSE_WITH_MODULES_LESSONS_SELECT)
              .eq('id', existingKey.resource_id)
              .maybeSingle();
            if (publishedCourse) {
              res.json({ data: publishedCourse, idempotent: true });
              return;
            }
          }
        } catch (lookupErr) {
          console.warn('Failed to resolve existing publish idempotency key', lookupErr);
        }
        res.status(409).json({ error: 'idempotency_conflict', code: 'idempotency_conflict' });
        return;
      }
    }

    const publishedAt = new Date().toISOString();
    const nextVersion = (currentVersion ?? 0) + 1;
    const nextMeta = { ...(existing.data.meta_json || {}), published_at: publishedAt };

    const updated = await supabase
      .from('courses')
      .update({ status: 'published', published_at: publishedAt, version: nextVersion, meta_json: nextMeta })
      .eq('id', id)
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
      .single();

    if (updated.error) throw updated.error;

    if (idempotencyKey) {
      try {
        await supabase.from('idempotency_keys').update({ resource_id: updated.data?.id }).eq('id', idempotencyKey);
      } catch (updateErr) {
        console.warn('Failed to update publish idempotency key with resource id', updateErr);
      }
    }

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
    res.status(500).json({ error: 'Unable to publish course', code: 'publish_failed' });
  }
});

app.delete('/api/admin/courses/:id', async (req, res) => {
  const { id } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  // Dev/E2E fallback
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      const course = e2eStore.courses.get(id);
      if (!course) {
        res.status(204).end();
        return;
      }
  const courseOrgId = pickOrgId(course.organization_id, course.org_id, course.organizationId);
      if (courseOrgId) {
  const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return;
      } else if (!context.isPlatformAdmin) {
        res.status(403).json({ error: 'organization_required', message: 'Course is not scoped to an organization.' });
        return;
      }
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
    const courseOrgId = await getCourseOrgId(id);
    if (courseOrgId === undefined) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    if (courseOrgId) {
  const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'organization_required', message: 'Course is not scoped to an organization.' });
      return;
    }
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
  const sessionUserId =
    (req.user && (req.user.userId || req.user.id || req.user.sub)) || null;
  const normalizedSessionUserId = sessionUserId ? String(sessionUserId).trim().toLowerCase() : null;

  const resolveAssignmentCourseIds = async () => {
    if (!assignedOnly || !orgId) {
      return null;
    }

    const ids = new Set();

    const pushIds = (rows = []) => {
      rows.forEach((assignment) => {
        if (!assignment) return;
        const targetUser = typeof assignment.user_id === 'string' ? assignment.user_id.trim().toLowerCase() : null;
        if (
          assignment.active === false ||
          (normalizedSessionUserId && targetUser && targetUser !== normalizedSessionUserId)
        ) {
          return;
        }
        if (!targetUser && normalizedSessionUserId) {
          // only include org-level assignments with null user scope when caller belongs to org
          const isOrgMatch = String(assignment.organization_id || '').trim() === orgId;
          if (!isOrgMatch) {
            return;
          }
        }
        const courseId = assignment.course_id || assignment.courseId || null;
        if (courseId) {
          ids.add(String(courseId));
        }
      });
    };

    if (!supabase) {
      if (E2E_TEST_MODE || DEV_FALLBACK) {
        pushIds(e2eStore.assignments || []);
        return Array.from(ids);
      }
      return null;
    }

    const tablesToTry = ['assignments', 'course_assignments'];
    for (const table of tablesToTry) {
      let query = supabase
        .from(table)
        .select('course_id,organization_id,user_id,active')
        .eq('organization_id', orgId);
      if (normalizedSessionUserId) {
        query = query.or(
          `user_id.eq.${normalizedSessionUserId},user_id.is.null`
        );
      } else {
        query = query.is('user_id', null);
      }
      const { data, error } = await query;
      if (error) {
        const missingRelation = typeof error.message === 'string' && /relation/.test(error.message);
        if (missingRelation) {
          continue;
        }
        throw error;
      }
      pushIds(data || []);
      if (ids.size > 0 || table === tablesToTry[tablesToTry.length - 1]) {
        break;
      }
    }

    return Array.from(ids);
  };

  const respondWithDemoCourses = async () => {
    // In dev/demo mode, show ALL courses (not just published)
    let courses = Array.from(e2eStore.courses.values());

    if (assignedOnly && orgId) {
      const demoAssignments = (e2eStore.assignments || []).filter(
        (asn) =>
          asn &&
          asn.active !== false &&
          String(asn.organization_id || '').trim() === orgId &&
          (!normalizedSessionUserId ||
            asn.user_id === null ||
            String(asn.user_id).trim().toLowerCase() === normalizedSessionUserId)
      );
      const assignedIds = new Set(demoAssignments.map((asn) => String(asn.course_id)));
      courses = courses.filter((course) => assignedIds.has(String(course.id)) || assignedIds.has(String(course.slug)));
    }

    const data = courses.map((courseRecord) => {
      const c = ensureOrgFieldCompatibility(courseRecord, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || courseRecord;
      return {
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
        organization_id: c.organization_id ?? null,
        organizationId: c.organizationId ?? c.organization_id ?? null,
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
      };
    });
    res.json({ data });
  };

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    await respondWithDemoCourses();
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    let assignmentCourseIds = null;
    if (assignedOnly && orgId) {
      assignmentCourseIds = await resolveAssignmentCourseIds();
      if (assignedOnly && Array.isArray(assignmentCourseIds) && assignmentCourseIds.length === 0) {
        res.json({ data: [] });
        return;
      }
    }

    let courseQuery = supabase
      .from('courses')
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: MODULE_LESSONS_FOREIGN_TABLE });

    if (assignedOnly && orgId && Array.isArray(assignmentCourseIds)) {
      courseQuery = courseQuery.in('id', assignmentCourseIds);
    }

    const { data, error } = await courseQuery;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    const errorCode = typeof error?.code === 'string' ? error.code : null;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[client/courses] published_fetch_failed', {
      assignedOnly,
      orgId,
      code: errorCode,
      message: errorMessage,
    });
    if (DEV_FALLBACK) {
      console.warn('[client/courses] Falling back to demo dataset because Supabase query failed.');
      await respondWithDemoCourses();
      return;
    }
    res.json({ data: [], meta: { warning: 'catalog_unavailable', code: errorCode } });
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

      const normalizedCourse = ensureOrgFieldCompatibility(course, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || course;
      const data = {
        id: normalizedCourse.id,
        slug: normalizedCourse.slug ?? normalizedCourse.id,
        title: normalizedCourse.title,
        description: normalizedCourse.description ?? null,
        status: normalizedCourse.status ?? 'draft',
        version: normalizedCourse.version ?? 1,
        meta_json: normalizedCourse.meta_json ?? {},
        published_at: normalizedCourse.published_at ?? null,
        thumbnail: normalizedCourse.thumbnail ?? null,
        difficulty: normalizedCourse.difficulty ?? null,
        duration: normalizedCourse.duration ?? null,
        organization_id: normalizedCourse.organization_id ?? normalizedCourse.org_id ?? null,
        organizationId:
          normalizedCourse.organizationId ?? normalizedCourse.organization_id ?? normalizedCourse.org_id ?? null,
        org_id: normalizedCourse.org_id ?? normalizedCourse.organization_id ?? null,
        instructorName: normalizedCourse.instructorName ?? null,
        estimatedDuration: normalizedCourse.estimatedDuration ?? null,
        keyTakeaways: normalizedCourse.keyTakeaways ?? [],
        modules: (normalizedCourse.modules || []).map((m) => ({
          id: m.id,
          course_id: normalizedCourse.id,
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
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
      .eq(column, value)
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: MODULE_LESSONS_FOREIGN_TABLE })
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
    if (data) {
      const hydrated = await ensureCourseStructureLoaded(data, { includeLessons: true });
      res.json({ data: hydrated });
      return;
    }
    res.json({ data: null });
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

const logLessonEvent = (level, event, meta = {}) => {
  const fn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info;
  fn(event, meta);
};

const buildLessonLogMeta = (req, context) => ({
  requestId: req.requestId ?? null,
  userId: context?.userId ?? null,
  orgId: null,
  moduleId: null,
  lessonId: null,
  lessonType: null,
  orderIndex: null,
});

const respondLessonError = (res, logMeta, event, status, code, message, detail = null) => {
  logLessonEvent('error', event, { ...logMeta, status, code, message, detail });
  res.status(status).json({ code, message, detail });
};

// Admin Lessons (E2E fallback)
app.post('/api/admin/lessons', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const lessonLogMeta = buildLessonLogMeta(req, context);

  const parseResult = lessonCreateSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    respondLessonError(
      res,
      lessonLogMeta,
      'admin_lessons_create_error',
      400,
      'validation_failed',
      'Lesson payload validation failed',
      parseResult.error.issues,
    );
    return;
  }
  const parsed = parseResult.data;
  const { id } = req.params;
  lessonLogMeta.lessonId = id;

  const moduleId = pickId(parsed, 'module_id', 'moduleId');
  lessonLogMeta.moduleId = moduleId ?? null;

  const lessonId = parsed.id ?? randomUUID();
  const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
  const title = parsed.title;
  const type = parsed.type ?? null;
  if (type) lessonLogMeta.lessonType = type;

  const description = parsed.description ?? null;
  const orderIndex = pickOrder(parsed);
  if (orderIndex !== null) lessonLogMeta.orderIndex = orderIndex;

  const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;

  const normalizedContent =
    (parsed.content_json && Object.keys(parsed.content_json).length > 0 ? parsed.content_json : null) ??
    (parsed.content && typeof parsed.content === 'object' ? parsed.content.body ?? parsed.content : null) ??
    {};

  const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const found = e2eFindModule(moduleId);
    if (!found) {
      respondLessonError(res, lessonLogMeta, 'admin_lessons_create_error', 404, 'module_not_found', 'Module not found');
      return;
    }
    const resolvedOrgId = pickOrgId(
      found.course?.organization_id,
      found.course?.org_id,
      found.course?.organizationId,
    );
    lessonLogMeta.orgId = resolvedOrgId ?? null;
    if (resolvedOrgId) {
      const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_create_error',
        403,
        'organization_required',
        'Lesson creation requires an organization scope',
      );
      return;
    }
    if (typeof expectedCourseVersion === 'number') {
      const current = found.course?.version ?? 1;
      if (expectedCourseVersion < current) {
        respondLessonError(
          res,
          lessonLogMeta,
          'admin_lessons_create_error',
          409,
          'version_conflict',
          `Course has newer version ${current}`,
        );
        return;
      }
    }
    logLessonEvent('info', 'admin_lessons_create_request', lessonLogMeta);
    const id = lessonId.startsWith('e2e-') ? lessonId : `e2e-less-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const lesson = {
      id,
      module_id: moduleId,
      organization_id: resolvedOrgId ?? null,
      title,
      description,
      type,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: normalizedContent,
      completion_rule_json: completionRule ?? null,
    };
    found.module.lessons = found.module.lessons || [];
    found.module.lessons.push(lesson);
    persistE2EStore();
    res.status(201).json({ data: lesson });
    logLessonEvent('info', 'admin_lessons_create_success', { ...lessonLogMeta, lessonId: id, status: 201 });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id,course_id,organization_id,org_id')
      .eq('id', moduleId)
      .maybeSingle();
    if (moduleErr) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_create_error',
        500,
        'module_lookup_failed',
        'Unable to load module',
        moduleErr.message,
      );
      return;
    }
    if (!moduleRow) {
      respondLessonError(res, lessonLogMeta, 'admin_lessons_create_error', 404, 'module_not_found', 'Module not found');
      return;
    }
    const courseId = moduleRow.course_id ?? null;
    if (!courseId) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_create_error',
        400,
        'module_course_missing',
        'Module is not linked to a course',
      );
      return;
    }
    const { data: courseRow, error: courseErr } = await supabase
      .from('courses')
      .select('id,version,organization_id,org_id')
      .eq('id', courseId)
      .maybeSingle();
    if (courseErr) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_create_error',
        500,
        'course_lookup_failed',
        'Unable to load parent course',
        courseErr.message,
      );
      return;
    }
    if (!courseRow) {
      respondLessonError(res, lessonLogMeta, 'admin_lessons_create_error', 404, 'course_not_found', 'Parent course not found');
      return;
    }
    const resolvedOrgId = pickOrgId(
      moduleRow.organization_id,
      courseRow.organization_id,
      moduleRow.org_id,
      courseRow.org_id,
    );
    lessonLogMeta.orgId = resolvedOrgId ?? null;
    if (resolvedOrgId) {
      const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_create_error',
        403,
        'organization_required',
        'Lesson creation requires an organization scope',
      );
      return;
    }
    if (typeof expectedCourseVersion === 'number') {
      const currentVersion = courseRow.version ?? null;
      if (currentVersion !== null && expectedCourseVersion < currentVersion) {
        respondLessonError(
          res,
          lessonLogMeta,
          'admin_lessons_create_error',
          409,
          'version_conflict',
          `Course has newer version ${currentVersion}`,
        );
        return;
      }
    }
    logLessonEvent('info', 'admin_lessons_create_request', lessonLogMeta);
    const payload = {
      id: lessonId,
      module_id: moduleId,
      organization_id: resolvedOrgId ?? null,
      title,
      type,
      description,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: normalizedContent,
      completion_rule_json: completionRule ?? null,
    };
    const { data, error } = await supabase
      .from('lessons')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_create_error',
        500,
        'lesson_create_failed',
        'Unable to create lesson',
        error.message,
      );
      return;
    }
    lessonLogMeta.lessonId = data.id;
    res.status(201).json({ data });
    logLessonEvent('info', 'admin_lessons_create_success', { ...lessonLogMeta, status: 201 });
  } catch (error) {
    respondLessonError(
      res,
      lessonLogMeta,
      'admin_lessons_create_error',
      500,
      'lesson_create_failed',
      'Unable to create lesson',
      error instanceof Error ? error.message : null,
    );
  }
});

app.patch('/api/admin/lessons/:id', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const lessonLogMeta = buildLessonLogMeta(req, context);

  const parseResult = lessonPatchSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    respondLessonError(
      res,
      lessonLogMeta,
      'admin_lessons_update_error',
      400,
      'validation_failed',
      'Lesson payload validation failed',
      parseResult.error.issues,
    );
    return;
  }
  const parsed = parseResult.data;
  const { id } = req.params;
  lessonLogMeta.lessonId = id;
  const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
  const title = parsed.title;
  const type = parsed.type;
  if (type) lessonLogMeta.lessonType = type;
  const description = parsed.description ?? null;
  const orderIndex =
    parsed.order_index ?? parsed.orderIndex ?? null;
  if (orderIndex !== null) lessonLogMeta.orderIndex = orderIndex;
  const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
  const contentPayload =
    (parsed.content_json && Object.keys(parsed.content_json).length > 0 ? parsed.content_json : null) ??
    (parsed.content && typeof parsed.content === 'object' ? parsed.content.body ?? parsed.content : null);
  const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const found = e2eFindLesson(id);
    if (!found) {
      respondLessonError(res, lessonLogMeta, 'admin_lessons_update_error', 404, 'lesson_not_found', 'Lesson not found');
      return;
    }
    const resolvedOrgId = pickOrgId(
      found.course?.organization_id,
      found.course?.org_id,
      found.course?.organizationId,
      found.module?.organization_id,
      found.module?.org_id,
    );
    lessonLogMeta.orgId = resolvedOrgId ?? null;
    lessonLogMeta.moduleId = found.module?.id ?? null;
    if (resolvedOrgId) {
      const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        403,
        'organization_required',
        'Lesson updates require an organization scope',
      );
      return;
    }
    if (typeof expectedCourseVersion === 'number') {
      const current = found.module?.version ?? 1;
      if (expectedCourseVersion < current) {
        respondLessonError(
          res,
          lessonLogMeta,
          'admin_lessons_update_error',
          409,
          'version_conflict',
          `Module has newer version ${current}`,
        );
        return;
      }
    }
    logLessonEvent('info', 'admin_lessons_update_request', lessonLogMeta);
    if (typeof title === 'string') found.lesson.title = title;
    if (typeof type === 'string') found.lesson.type = type;
    if (description !== undefined) found.lesson.description = description;
    if (typeof orderIndex === 'number') found.lesson.order_index = orderIndex;
    if (typeof durationSeconds === 'number' || durationSeconds === null) found.lesson.duration_s = durationSeconds;
    if (contentPayload !== undefined) {
      found.lesson.content_json = contentPayload ?? {};
    }
    if (completionRule !== undefined) found.lesson.completion_rule_json = completionRule ?? null;
    persistE2EStore();
    res.json({ data: found.lesson });
    logLessonEvent('info', 'admin_lessons_update_success', { ...lessonLogMeta, status: 200 });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const patch = {};
    if (typeof title === 'string') patch.title = title;
    if (typeof type === 'string') patch.type = type;
    if (description !== undefined) patch.description = description;
    if (typeof orderIndex === 'number') patch.order_index = orderIndex;
    if (typeof durationSeconds === 'number' || durationSeconds === null) patch.duration_s = durationSeconds;
    if (contentPayload !== undefined) patch.content_json = contentPayload ?? {};
    if (completionRule !== undefined) patch.completion_rule_json = completionRule;
    if (Object.keys(patch).length === 0) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        400,
        'no_fields_to_update',
        'No fields to update',
      );
      return;
    }
    const { data: lessonRow, error: lessonErr } = await supabase
      .from('lessons')
      .select('id,module_id,type,order_index,organization_id')
      .eq('id', id)
      .maybeSingle();
    if (lessonErr) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        500,
        'lesson_lookup_failed',
        'Unable to load lesson',
        lessonErr.message,
      );
      return;
    }
    if (!lessonRow) {
      respondLessonError(res, lessonLogMeta, 'admin_lessons_update_error', 404, 'lesson_not_found', 'Lesson not found');
      return;
    }
    lessonLogMeta.moduleId = lessonRow.module_id ?? null;
    if (!lessonLogMeta.lessonType) lessonLogMeta.lessonType = lessonRow.type ?? null;
    if (!lessonLogMeta.orderIndex) lessonLogMeta.orderIndex = lessonRow.order_index ?? null;
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id,course_id,organization_id,org_id')
      .eq('id', lessonRow.module_id)
      .maybeSingle();
    if (moduleErr) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        500,
        'module_lookup_failed',
        'Unable to load module',
        moduleErr.message,
      );
      return;
    }
    if (!moduleRow) {
      respondLessonError(res, lessonLogMeta, 'admin_lessons_update_error', 404, 'module_not_found', 'Module not found');
      return;
    }
    const { data: courseRow, error: courseErr } = await supabase
      .from('courses')
      .select('id,version,organization_id,org_id')
      .eq('id', moduleRow.course_id)
      .maybeSingle();
    if (courseErr) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        500,
        'course_lookup_failed',
        'Unable to load parent course',
        courseErr.message,
      );
      return;
    }
    if (!courseRow) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        404,
        'course_not_found',
        'Parent course not found',
      );
      return;
    }

    const resolvedOrgId = pickOrgId(
      lessonRow.organization_id,
      moduleRow.organization_id,
      courseRow.organization_id,
      moduleRow.org_id,
      courseRow.org_id,
    );
    lessonLogMeta.orgId = resolvedOrgId ?? null;
    if (resolvedOrgId) {
      const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        403,
        'organization_required',
        'Lesson updates require an organization scope',
      );
      return;
    }
    logLessonEvent('info', 'admin_lessons_update_request', lessonLogMeta);
    if (typeof expectedCourseVersion === 'number') {
      const current = courseRow.version ?? null;
      if (current !== null && expectedCourseVersion < current) {
        respondLessonError(
          res,
          lessonLogMeta,
          'admin_lessons_update_error',
          409,
          'version_conflict',
          `Course has newer version ${current}`,
        );
        return;
      }
    }
    const { data, error } = await supabase
      .from('lessons')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      respondLessonError(
        res,
        lessonLogMeta,
        'admin_lessons_update_error',
        500,
        'lesson_update_failed',
        'Unable to update lesson',
        error.message,
      );
      return;
    }
    res.json({ data: { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 } });
    logLessonEvent('info', 'admin_lessons_update_success', { ...lessonLogMeta, status: 200 });
  } catch (error) {
    respondLessonError(
      res,
      lessonLogMeta,
      'admin_lessons_update_error',
      500,
      'lesson_update_failed',
      'Unable to update lesson',
      error instanceof Error ? error.message : null,
    );
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
app.post('/api/learner/progress', authenticate, async (req, res) => {
  let snapshot = normalizeSnapshotPayload(req.body || {});

  if (!snapshot) {
    res.status(400).json({ error: 'invalid_progress_payload', message: 'Invalid progress snapshot payload' });
    return;
  }

  const authUserId = req.user?.userId || req.user?.id || null;
  const effectiveUserId = !DEV_FALLBACK && !E2E_TEST_MODE ? authUserId : authUserId || snapshot.userId || null;

  if (!effectiveUserId) {
    res.status(401).json({
      error: 'unauthenticated_progress',
      message: 'Missing authenticated user id for progress update',
    });
    return;
  }

  snapshot = {
    ...snapshot,
    userId: effectiveUserId,
  };

  const { userId, courseId } = snapshot;
  const lessonList = Array.isArray(snapshot.lessons) ? snapshot.lessons : [];
  const courseProgress = snapshot.course || {};
  const nowIso = new Date().toISOString();
  const requestId = req.requestId ?? req.id ?? null;
  const payloadBytes = getPayloadSize(req);
  const baseLogMeta = {
    requestId,
    userId,
    courseId,
    lessonCount: lessonList.length,
    payloadBytes,
  };

  const logSnapshotSuccess = (mode) => {
    logger.info('learner_progress_snapshot_success', {
      ...baseLogMeta,
      mode,
      completedAt: courseProgress?.completed_at || courseProgress?.completedAt || null,
      overallPercent: courseProgress?.percent ?? null,
    });
  };

  logger.info('learner_progress_snapshot_received', baseLogMeta);

  const respondWithError = (status, code, message, error) => {
    if (error) {
      logger.error('learner_progress_snapshot_failed', {
        ...baseLogMeta,
        errorMessage: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      writeErrorDiagnostics(req, error instanceof Error ? error : new Error(String(error)), {
        meta: { surface: 'learner_progress_snapshot' },
      });
    }
    res.status(status).json({ error: code, message });
  };

  if (DEV_FALLBACK || E2E_TEST_MODE) {
    console.log('Progress sync request:', {
      userId,
      courseId,
      lessonCount: lessonList.length,
      overallPercent: courseProgress.percent,
    });
  }

  // Demo/E2E path: persist to in-memory store
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      lessonList.forEach((lesson) => {
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
        percent: clampPercent(courseProgress.percent),
        status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
        updated_at: nowIso,
        last_lesson_id: courseProgress.lastLessonId ?? null,
        completed_at: courseProgress.completedAt ?? courseProgress.completed_at ?? null,
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

      logSnapshotSuccess('demo');

      res.status(202).json({
        success: true,
        mode: 'demo',
        data: {
          userId,
          courseId,
          updatedLessons: lessonList.length,
        },
      });
    } catch (error) {
      respondWithError(500, 'progress_demo_failed', 'Unable to sync progress in demo mode', error);
    }
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const normalizeLessonRecord = (row) => ({
      user_id: row.user_id,
      course_id: row.course_id ?? courseId,
      lesson_id: row.lesson_id,
      percent: clampPercent(Number(row.progress ?? row.percent ?? 0)),
      status: row.completed ? 'completed' : 'in_progress',
      time_spent_s: Math.max(0, Math.round(row.time_spent_seconds ?? row.time_spent_s ?? 0)),
      last_accessed_at: row.updated_at ?? row.created_at ?? nowIso,
    });

    const courseRecordForBroadcast = () => ({
      user_id: userId,
      user_id_uuid: userId,
      course_id: courseId,
      percent: clampPercent(courseProgress.percent),
      status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
      time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
      last_lesson_id: courseProgress.lastLessonId ?? null,
      completed_at: courseProgress.completedAt ?? courseProgress.completed_at ?? null,
      updated_at: nowIso,
    });

    const upsertLessonProgressModern = async () => {
      const payload = lessonList.map((lesson) => ({
        user_id: userId,
        org_id: null,
        course_id: courseId,
        lesson_id: lesson.lessonId,
        progress: clampPercent(lesson.progressPercent),
        completed: Boolean(lesson.completed ?? lesson.progressPercent >= 100),
        time_spent_seconds: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
      }));
      const { data, error } = await supabase
        .from('user_lesson_progress')
        .upsert(payload, { onConflict: 'user_id,lesson_id' })
        .select('*');
      if (error) throw error;
      return (data || []).map((row) => normalizeLessonRecord(row));
    };

    const upsertLessonProgressLegacy = async () => {
      const payload = lessonList.map((lesson) => ({
        user_id: userId,
        org_id: null,
        course_id: courseId,
        lesson_id: lesson.lessonId,
        percent: clampPercent(lesson.progressPercent),
        status: Boolean(lesson.completed ?? lesson.progressPercent >= 100) ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
        updated_at: nowIso,
      }));
      const { data, error } = await supabase
        .from('user_lesson_progress')
        .upsert(payload, { onConflict: 'user_id,lesson_id' })
        .select('*');
      if (error) throw error;
      return (data || []).map((row) => normalizeLessonRecord(row));
    };

    let lessonRows = [];
    if (lessonList.length > 0) {
      if (schemaSupportFlags.lessonProgress === 'legacy') {
        lessonRows = await upsertLessonProgressLegacy();
      } else {
        try {
          lessonRows = await upsertLessonProgressModern();
          schemaSupportFlags.lessonProgress = 'modern';
        } catch (error) {
          if (isMissingColumnError(error)) {
            console.warn('[progress] Falling back to legacy lesson progress schema', { code: error.code });
            schemaSupportFlags.lessonProgress = 'legacy';
            lessonRows = await upsertLessonProgressLegacy();
          } else {
            throw error;
          }
        }
      }
    }

    const upsertCourseProgressModern = async () => {
      const payload = {
        user_id_uuid: userId,
        user_id: userId,
        course_id: courseId,
        progress: clampPercent(courseProgress.percent),
        completed: (courseProgress.percent ?? 0) >= 100,
      };
      try {
        const { data, error } = await supabase
          .from('user_course_progress')
          .upsert(payload, { onConflict: 'user_id_uuid,course_id' })
          .select('*')
          .single();
        if (error) throw error;
        return data;
      } catch (error) {
        if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
          logger.warn('user_course_progress_uuid_modern_fallback', {
            code: error?.code ?? null,
            message: error?.message ?? null,
          });
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_id_uuid;
          const { data, error: legacyError } = await supabase
            .from('user_course_progress')
            .upsert(fallbackPayload, { onConflict: 'user_id,course_id' })
            .select('*')
            .single();
          if (legacyError) throw legacyError;
          return data;
        }
        throw error;
      }
    };

    const upsertCourseProgressLegacy = async () => {
      const payload = {
        user_id_uuid: userId,
        user_id: userId,
        course_id: courseId,
        percent: clampPercent(courseProgress.percent),
        status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
      };
      try {
        const { data, error } = await supabase
          .from('user_course_progress')
          .upsert(payload, { onConflict: 'user_id_uuid,course_id' })
          .select('*')
          .single();
        if (error) throw error;
        return data;
      } catch (error) {
        if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
          logger.warn('user_course_progress_uuid_legacy_fallback', {
            code: error?.code ?? null,
            message: error?.message ?? null,
          });
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_id_uuid;
          const { data, error: legacyError } = await supabase
            .from('user_course_progress')
            .upsert(fallbackPayload, { onConflict: 'user_id,course_id' })
            .select('*')
            .single();
          if (legacyError) throw legacyError;
          return data;
        }
        throw error;
      }
    };

    let courseRow;
    if (schemaSupportFlags.courseProgress === 'legacy') {
      courseRow = await upsertCourseProgressLegacy();
    } else {
      try {
        courseRow = await upsertCourseProgressModern();
        schemaSupportFlags.courseProgress = 'modern';
      } catch (error) {
        if (isMissingColumnError(error)) {
          console.warn('[progress] Falling back to legacy course progress schema', { code: error.code });
          schemaSupportFlags.courseProgress = 'legacy';
          courseRow = await upsertCourseProgressLegacy();
        } else {
          throw error;
        }
      }
    }
    const courseRecord = courseRow
      ? {
          user_id: courseRow.user_id,
          course_id: courseRow.course_id,
          percent: clampPercent(Number(courseRow.progress ?? courseRow.percent ?? courseProgress.percent ?? 0)),
          status: courseRow.completed ? 'completed' : 'in_progress',
          time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
          last_lesson_id: courseProgress.lastLessonId ?? null,
          completed_at: courseProgress.completedAt ?? courseProgress.completed_at ?? null,
          updated_at: courseRow.updated_at ?? nowIso,
        }
      : courseRecordForBroadcast();

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

      if (courseRecord) {
        const payload = { type: 'course_progress', data: courseRecord, timestamp: Date.now() };
        broadcastToTopic(userTopic, payload);
        if (courseRecord.course_id) {
          broadcastToTopic(`progress:course:${courseRecord.course_id}`, payload);
        }
        broadcastToTopic('progress:all', payload);
      }
    } catch (err) {
      console.warn('Failed to broadcast persisted progress snapshot', err);
    }

    logSnapshotSuccess('supabase');

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
    const message = error?.message || 'Unable to sync progress';
    respondWithError(500, 'progress_sync_failed', message, error);
  }
});

// GET learner progress endpoint (fetching progress)
app.get('/api/learner/progress', authenticate, async (req, res) => {
  const lessonIds = parseLessonIdsParam(req.query.lessonIds || req.query.lesson_ids);
  const requestedUserId = coerceString(req.query.userId, req.query.user_id, req.query.learnerId, req.query.learner_id);
  const sessionUserId = coerceString(req.user?.userId, req.user?.id);
  const isAdminUser = (req.user?.role || '').toLowerCase() === 'admin';
  const effectiveUserId = requestedUserId || sessionUserId;

  if (!effectiveUserId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  if (lessonIds.length === 0) {
    res.status(400).json({ error: 'lessonIds is required' });
    return;
  }

  const normalizedSessionUserId = sessionUserId ? sessionUserId.toLowerCase() : null;
  const normalizedUserId = effectiveUserId.toLowerCase();

  if (!isAdminUser && normalizedSessionUserId && normalizedUserId !== normalizedSessionUserId) {
    res.status(403).json({ error: 'forbidden', message: 'You can only view your own progress.' });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const lessons = lessonIds.map((lessonId) => {
      const record = e2eStore.lessonProgress.get(`${normalizedUserId}:${lessonId}`) || null;
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
      .select('*')
      .eq('user_id', normalizedUserId)
      .in('lesson_id', lessonIds);

    if (error) throw error;

    const byLessonId = new Map();
    (data || []).forEach((row) => {
      const lessonId = row.lesson_id || row.lessonId;
      if (!lessonId) return;
      byLessonId.set(String(lessonId), buildLessonRow(String(lessonId), row));
    });

    const lessons = lessonIds.map((lessonId) => byLessonId.get(lessonId) || buildLessonRow(lessonId, null));

    res.json({
      data: {
        lessons,
      },
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('learner_progress_table_missing', {
        code: error.code ?? null,
        message: error.message ?? null,
        requestId: req.requestId ?? null,
      });
      res.json({
        data: {
          lessons: lessonIds.map((lessonId) => buildLessonRow(lessonId, null)),
        },
        fallback: 'empty_progress',
      });
      return;
    }
    console.error('Failed to fetch learner progress:', error);
    writeErrorDiagnostics(req, error, { meta: { surface: 'learner_progress_commit' } });
    res.status(500).json({ error: 'Unable to fetch progress' });
  }
});

app.post('/api/client/progress/course', authenticate, async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { user_id: bodyUserId, course_id, percent, status, time_spent_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;
    const sessionUserId = req.user?.userId || req.user?.id || null;
    const resolvedUserId = sessionUserId || (typeof bodyUserId === 'string' ? bodyUserId : null);

    if (!resolvedUserId || !course_id) {
      res.status(400).json({ error: 'user_id and course_id are required' });
      return;
    }

    // Rate limit per user to avoid abuse
    const rlKey = `course:${String(resolvedUserId).toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) {
      res.status(429).json({ error: 'Too many progress updates, please slow down' });
      return;
    }

    const opStart = Date.now();
    try {
      if (clientEventId) {
        if (e2eStore.progressEvents.has(clientEventId)) {
          const key = `${resolvedUserId}:${course_id}`;
          const existing = e2eStore.courseProgress.get(key) || null;
          res.json({ data: existing, idempotent: true });
          return;
        }
        e2eStore.progressEvents.add(clientEventId);
      }

      const key = `${resolvedUserId}:${course_id}`;
      const now = new Date().toISOString();
      const record = {
        user_id: resolvedUserId,
        course_id,
        percent: typeof percent === 'number' ? percent : 0,
        status: status || 'in_progress',
        time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0,
        updated_at: now,
      };
      e2eStore.courseProgress.set(key, record);

      try {
        const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(resolvedUserId).toLowerCase()}`, payload);
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
        userId: resolvedUserId,
        courseId: course_id,
        percent: record.percent,
      });
      res.json({ data: record });
    } catch (error) {
      recordCourseProgress('demo-store', Date.now() - opStart, {
        status: 'error',
        userId: resolvedUserId,
        courseId: course_id,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('course_progress_e2e_failed', { error: error instanceof Error ? error.message : error });
      res.status(500).json({ error: 'Unable to save course progress' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  const { user_id: bodyUserId, course_id, percent, status, time_spent_s } = req.body || {};
  const clientEventId = req.body?.client_event_id ?? null;
  const context = requireUserContext(req, res);
  if (!context) return;
  const sessionUserIdRaw = typeof context.userId === 'string' ? context.userId.trim() : '';
  if (!isUuid(sessionUserIdRaw)) {
    res.status(400).json({ error: 'invalid_user_context', message: 'Authenticated user id must be a uuid.' });
    return;
  }
  const canonicalUserId = sessionUserIdRaw;
  if (!course_id) {
    res.status(400).json({ error: 'course_id is required' });
    return;
  }

  if (bodyUserId && bodyUserId !== canonicalUserId) {
    logger.warn('progress_course_user_mismatch', {
      providedUserId: bodyUserId,
      authenticatedUserId: canonicalUserId,
      requestId: req.requestId ?? null,
    });
  }

  const rlKey = `course:${canonicalUserId.toLowerCase()}`;
  if (!checkProgressLimit(rlKey)) {
    res.status(429).json({ error: 'Too many progress updates, please slow down' });
    return;
  }

  const opStart = Date.now();
  try {
    const toApiCourseRecord = (row, fallbackTimeSpent) => {
      const resolvedUserId = row?.user_id_uuid || row?.user_id || canonicalUserId;
      return {
        user_id: resolvedUserId,
        user_id_uuid: row?.user_id_uuid ?? resolvedUserId,
        course_id: row?.course_id ?? course_id,
        percent: clampPercent(Number(row?.progress ?? row?.percent ?? percent ?? 0)),
        status: row?.completed ?? (typeof status === 'string' ? status === 'completed' : (percent ?? 0) >= 100)
          ? 'completed'
          : 'in_progress',
        time_spent_s: typeof row?.time_spent_s === 'number'
          ? row.time_spent_s
          : typeof row?.time_spent_seconds === 'number'
          ? row.time_spent_seconds
          : typeof fallbackTimeSpent === 'number'
          ? fallbackTimeSpent
          : 0,
        updated_at: row?.updated_at ?? row?.created_at ?? new Date().toISOString(),
      };
    };

    const normalizedPercent = clampPercent(typeof percent === 'number' ? percent : 0);
    const normalizedCompleted = typeof status === 'string' ? status === 'completed' : normalizedPercent >= 100;

    // If client provided an idempotency key, record the event first to avoid double-processing
    if (clientEventId) {
      try {
        await supabase
          .from('progress_events')
          .insert({ id: clientEventId, user_id: canonicalUserId, course_id, lesson_id: null, payload: req.body });
      } catch (evErr) {
        // If the event already exists, treat as idempotent and return current progress
        try {
          const existingQuery = supabase
            .from('user_course_progress')
            .select('*')
            .eq('course_id', course_id)
            .or(`user_id_uuid.eq.${canonicalUserId},user_id.eq.${canonicalUserId}`);
          const existing = await existingQuery.maybeSingle();
          if (existing && !existing.error && existing.data) {
            res.json({ data: toApiCourseRecord(existing.data, time_spent_s), idempotent: true });
            return;
          }
        } catch (fetchErr) {
          // fall through to normal processing
        }
      }
    }
    const upsertPayload = {
      user_id_uuid: canonicalUserId,
      user_id: canonicalUserId,
      course_id,
      progress: normalizedPercent,
      completed: normalizedCompleted,
    };
    const upsertCourseProgress = async (payload, conflictTarget) =>
      supabase.from('user_course_progress').upsert(payload, { onConflict: conflictTarget }).select('*').single();

    let upsertResult;
    try {
      upsertResult = await upsertCourseProgress(upsertPayload, 'user_id_uuid,course_id');
      if (upsertResult.error) throw upsertResult.error;
    } catch (error) {
      if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
        logger.warn('user_course_progress_uuid_fallback_runtime', {
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        const fallbackPayload = { ...upsertPayload };
        delete fallbackPayload.user_id_uuid;
        upsertResult = await upsertCourseProgress(fallbackPayload, 'user_id,course_id');
        if (upsertResult.error) throw upsertResult.error;
      } else {
        throw error;
      }
    }
    const data = upsertResult.data;
    try {
      const apiRecord = toApiCourseRecord(data, time_spent_s);
      const userId = apiRecord?.user_id || canonicalUserId;
      const courseId = apiRecord?.course_id || course_id;
      const payload = { type: 'course_progress', data: apiRecord, timestamp: Date.now() };
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
      userId: canonicalUserId,
      courseId: course_id,
      percent: normalizedPercent,
    });

    res.json({ data: toApiCourseRecord(data, time_spent_s) });
  } catch (error) {
    recordCourseProgress('supabase', Date.now() - opStart, {
      status: 'error',
      userId: canonicalUserId,
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

  const opStart = Date.now();
  try {
    const toApiLessonRecord = (row, fallbackTimeSpent, fallbackResume) => ({
      user_id: row?.user_id ?? user_id,
      course_id: row?.course_id ?? null,
      lesson_id: row?.lesson_id ?? lesson_id,
      percent: clampPercent(Number(row?.progress ?? row?.percent ?? percent ?? 0)),
      status:
        row?.completed ?? (typeof status === 'string' ? status === 'completed' : (percent ?? 0) >= 100)
          ? 'completed'
          : 'in_progress',
      time_spent_s: Math.max(
        0,
        Math.round(
          row?.time_spent_seconds ??
            row?.time_spent_s ??
            (typeof fallbackTimeSpent === 'number' ? fallbackTimeSpent : 0),
        ),
      ),
      resume_at_s: typeof fallbackResume === 'number' ? fallbackResume : null,
      updated_at: row?.updated_at ?? row?.created_at ?? new Date().toISOString(),
    });

    const normalizedPercent = clampPercent(typeof percent === 'number' ? percent : 0);
    const normalizedCompleted = typeof status === 'string' ? status === 'completed' : normalizedPercent >= 100;

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
            res.json({ data: toApiLessonRecord(existing.data, time_spent_s, resume_at_s), idempotent: true });
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
        progress: normalizedPercent,
        completed: normalizedCompleted,
        time_spent_seconds: Math.max(0, Math.round(typeof time_spent_s === 'number' ? time_spent_s : 0)),
      }, { onConflict: 'user_id,lesson_id' })
      .select('*')
      .single();

    if (error) throw error;
    try {
      const apiRecord = toApiLessonRecord(data, time_spent_s, resume_at_s);
      const userId = apiRecord?.user_id || user_id;
      const lessonId = apiRecord?.lesson_id || lesson_id;
      const payload = { type: 'lesson_progress', data: apiRecord, timestamp: Date.now() };
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
      percent: normalizedPercent,
    });

    res.json({ data: toApiLessonRecord(data, time_spent_s, resume_at_s) });
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
  if (events.length > PROGRESS_BATCH_MAX_SIZE) {
    res.status(400).json({
      error: 'too_many_events',
      message: `Max ${PROGRESS_BATCH_MAX_SIZE} events per batch`,
    });
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

  if (!ensureSupabase(res)) return;

  const approxBytes = Buffer.byteLength(JSON.stringify(events));
  if (approxBytes > PROGRESS_BATCH_MAX_BYTES) {
    res.status(413).json({ error: 'batch_payload_too_large', limitBytes: PROGRESS_BATCH_MAX_BYTES });
    return;
  }

  const normalizedEvents = events.map((evt) => {
    const normalizedOrgIdRaw = evt.org_id ?? evt.orgId ?? '';
    const normalizedOrgId = typeof normalizedOrgIdRaw === 'string' ? normalizedOrgIdRaw.trim() : '';
    const normalizedUserIdRaw = evt.user_id ?? evt.userId ?? '';
    const normalizedCourseId = evt.course_id ?? evt.courseId ?? null;
    const normalizedLessonId = evt.lesson_id ?? evt.lessonId ?? null;
    const normalizedClientEventId = evt.client_event_id || evt.clientEventId || randomUUID();
    return {
      client_event_id: normalizedClientEventId,
      user_id: typeof normalizedUserIdRaw === 'string' ? normalizedUserIdRaw.trim() : null,
      course_id: typeof normalizedCourseId === 'string' ? normalizedCourseId.trim() : null,
      lesson_id: typeof normalizedLessonId === 'string' ? normalizedLessonId.trim() : null,
      org_id: normalizedOrgId,
      percent: typeof evt.percent === 'number' ? evt.percent : evt.progress ?? null,
      time_spent_seconds: evt.time_spent_seconds ?? evt.time_spent_s ?? evt.timeSpentSeconds ?? null,
      resume_at_seconds: evt.resume_at_seconds ?? evt.resume_at_s ?? evt.position ?? null,
      status: evt.status ?? evt.event_status ?? null,
      event_type: evt.event_type ?? evt.type ?? null,
      occurred_at: evt.occurred_at ?? evt.occurredAt ?? null,
    };
  });

  const invalidEvents = normalizedEvents.filter((evt) => {
    if (!evt.user_id) return true;
    if (!evt.course_id && !evt.lesson_id) return true;
    if (!isUuid(evt.org_id || '')) return true;
    return false;
  });

  if (invalidEvents.length) {
    res.status(400).json({
      error: 'invalid_events',
      invalid: invalidEvents.map((evt) => evt.client_event_id),
    });
    return;
  }

  const start = Date.now();
  try {
    const { data, error } = await supabase.rpc('upsert_progress_batch', {
      events_json: normalizedEvents,
    });
    if (error) throw error;
    const resultRow = Array.isArray(data) ? data[0] || {} : data || {};
    const accepted = Array.isArray(resultRow.accepted) ? resultRow.accepted : [];
    const duplicates = Array.isArray(resultRow.duplicates) ? resultRow.duplicates : [];
    recordProgressBatch({
      accepted: accepted.length,
      duplicates: duplicates.length,
      failed: 0,
      durationMs: Date.now() - start,
      batchSize: normalizedEvents.length,
    });
    res.json({ accepted, duplicates, failed: [] });
  } catch (error) {
    recordProgressBatch({
      accepted: 0,
      duplicates: 0,
      failed: normalizedEvents.length,
      durationMs: null,
      batchSize: normalizedEvents.length,
    });
    logger.error('progress_batch_supabase_failed', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ error: 'Unable to process batch' });
  }
});

// ---------------------------------------------------------------------------
// Batch Analytics Events Endpoint (demo/E2E only for now)
// ---------------------------------------------------------------------------
app.post('/api/analytics/events/batch', async (req, res) => {
  const parsed = validateOr400(analyticsBatchSchema, req, res);
  if (!parsed) return;
  const events = parsed.events;

  const normalizedEvents = events.map((evt) => {
    const normalizedOrgId = typeof (evt.org_id ?? evt.orgId) === 'string'
      ? (evt.org_id ?? evt.orgId).trim()
      : null;
    const normalizedClientEventId = evt.clientEventId || evt.client_event_id || `analytics-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return {
      ...evt,
      client_event_id: normalizedClientEventId,
      org_id: normalizedOrgId,
      user_id: evt.user_id ?? evt.userId ?? null,
      course_id: evt.course_id ?? evt.courseId ?? null,
      lesson_id: evt.lesson_id ?? evt.lessonId ?? null,
      payload: scrubAnalyticsPayload(evt.payload ?? {}),
    };
  });

  const invalidOrgEvents = normalizedEvents.filter((evt) => !isUuid(typeof evt.org_id === 'string' ? evt.org_id : ''));
  if (invalidOrgEvents.length) {
    res.status(400).json({
      error: 'org_id is required for all analytics events',
      invalid: invalidOrgEvents.map((evt) => evt.client_event_id),
    });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of normalizedEvents) {
      const id = evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    const accepted = normalizedEvents.map((e) => e.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    res.json({ accepted, duplicates: [], failed: [] });
  } catch (error) {
    console.error('Failed to process analytics batch:', error);
    res.status(200).json({ accepted: [], duplicates: [], failed: normalizedEvents.map((evt) => ({ id: evt.client_event_id || 'unknown', reason: 'exception' })) });
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
const ADMIN_ORG_TABLES = [
  { table: 'organizations', columns: ['id', 'name', 'status', 'subscription', 'created_at'] },
  { table: 'organization_memberships', columns: ['org_id', 'user_id', 'role', 'status'] },
  { table: 'organization_profiles', columns: ['org_id', 'name'] },
  { table: 'organization_branding', columns: ['org_id'] },
];

const ensureAdminOrgSchemaOrRespond = async (res, label) => {
  const status = await ensureTablesReady(label, ADMIN_ORG_TABLES);
  if (!status.ok) {
    respondSchemaUnavailable(res, label, status);
    return false;
  }
  return true;
};

app.get('/api/admin/organizations', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await requireAdminAccess(req, res))) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.list'))) return;

  const context = requireUserContext(req, res);
  if (!context) return;

  const adminMemberships = Array.isArray(context.memberships)
    ? context.memberships.filter(
        (membership) => String(membership.role || '').toLowerCase() === 'admin' && membership.orgId,
      )
    : [];
  const adminOrgIds = adminMemberships.map((membership) => membership.orgId).filter(Boolean);
  const requestedOrgId = pickOrgId(
    req.query?.orgId,
    req.query?.organizationId,
    req.body?.orgId,
    req.body?.organizationId,
    req.params?.orgId,
  );

  const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');
  if (!isPlatformAdmin && adminOrgIds.length === 0) {
    res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required.' });
    return;
  }

  if (!isPlatformAdmin && requestedOrgId && !adminOrgIds.includes(requestedOrgId)) {
    res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted.' });
    return;
  }

  const { page, pageSize, from, to } = parsePaginationParams(req, { defaultSize: 25, maxSize: 100 });
  const search = (req.query.search || '').toString().trim();
  const statuses = (req.query.status || '')
    .toString()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const subscriptions = (req.query.subscription || '')
    .toString()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const includeProgress = parseBooleanParam(req.query.includeProgress);
  const allowedSortFields = new Set(['created_at', 'updated_at', 'name']);
  const sort = allowedSortFields.has(String(req.query.sort)) ? String(req.query.sort) : 'created_at';
  const ascending = String(req.query.direction).toLowerCase() === 'asc';

  const buildOrgQuery = () => {
    let query = supabase
      .from('organizations')
      .select(
        'id,name,slug,type,description,logo,contact_person,contact_email,contact_phone,subscription,status,total_learners,active_learners,completion_rate,modules,timezone,onboarding_status,created_at,updated_at',
        { count: 'exact' },
      )
      .order(sort, { ascending })
      .range(from, to);

    if (search) {
      const term = sanitizeIlike(search);
      query = query.or(`name.ilike.%${term}%,contact_person.ilike.%${term}%,contact_email.ilike.%${term}%`);
    }

    if (statuses.length) {
      query = query.in('status', statuses);
    }

    if (subscriptions.length) {
      query = query.in('subscription', subscriptions);
    }

    if (requestedOrgId) {
      query = query.eq('id', requestedOrgId);
    } else if (!isPlatformAdmin) {
      query = query.in('id', adminOrgIds);
    }
    return query;
  };

  try {
    const { data, count } = await runSupabaseQueryWithRetry('admin.organizations.list', () => buildOrgQuery());

    let progressMap = {};
    if (includeProgress && Array.isArray(data) && data.length > 0) {
      const ids = data.map((org) => org.id).filter(Boolean);
      if (ids.length) {
        const cacheKey = `org-progress:${ids.sort().join(',')}`;
        const rows = await withCache(
          cacheKey,
          async () => {
            const result = await runSupabaseQueryWithRetry('admin.organizations.progress', () =>
              supabase.from('org_onboarding_progress_vw').select('*').in('org_id', ids),
            );
            return result.data || [];
          },
          { ttlSeconds: 60 },
        );
        progressMap = (rows || []).reduce((acc, row) => {
          acc[row.org_id] = row;
          return acc;
        }, {});
      }
    }

    res.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: to + 1 < (count || 0),
      },
      progress: progressMap,
    });
  } catch (error) {
    logRouteError('GET /api/admin/organizations', error);
    res.status(500).json({ error: 'Unable to fetch organizations' });
  }
});

app.post('/api/admin/organizations', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await requireAdminAccess(req, res))) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.create'))) return;
  const payload = req.body || {};

  if (!payload.name || !payload.contact_email || !payload.subscription) {
    res.status(400).json({ error: 'name, contact_email, and subscription are required' });
    return;
  }

  try {
    const result = await runSupabaseQueryWithRetry('admin.organizations.create', () =>
      supabase.from('organizations').insert({
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
      }).select('*').single(),
    );

    res.status(201).json({ data: result.data });
  } catch (error) {
    logRouteError('POST /api/admin/organizations', error);
    res.status(500).json({ error: 'Unable to create organization' });
  }
});

app.get('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.detail'))) return;
  const { id } = req.params;

  const access = await requireOrgAccess(req, res, id, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const result = await runSupabaseQueryWithRetry('admin.organizations.detail', () =>
      supabase.from('organizations').select('*').eq('id', id).maybeSingle(),
    );
    const data = result.data;
    if (!data) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ data });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:id', error);
    res.status(500).json({ error: 'Unable to fetch organization' });
  }
});

app.put('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.update'))) return;
  const { id } = req.params;
  const patch = req.body || {};

  const access = await requireOrgAccess(req, res, id, { write: true, requireOrgAdmin: true });
  if (!access) return;

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

    const result = await runSupabaseQueryWithRetry('admin.organizations.update', () =>
      supabase.from('organizations').update(updatePayload).eq('id', id).select('*').single(),
    );
    res.json({ data: result.data });
  } catch (error) {
    logRouteError('PUT /api/admin/organizations/:id', error);
    res.status(500).json({ error: 'Unable to update organization' });
  }
});

app.delete('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.delete'))) return;
  const { id } = req.params;

  const access = await requireOrgAccess(req, res, id, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    await runSupabaseQueryWithRetry('admin.organizations.delete', () =>
      supabase.from('organizations').delete().eq('id', id),
    );
    res.status(204).end();
  } catch (error) {
    logRouteError('DELETE /api/admin/organizations/:id', error);
    res.status(500).json({ error: 'Unable to delete organization' });
  }
});

// Organization memberships
app.get('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.list'))) return;
  const { orgId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('id, user_id, role, status, invited_by, invited_email, accepted_at, last_seen_at, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:orgId/members', error);
    res.status(500).json({ error: 'Unable to load organization members' });
  }
});

app.post('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.create'))) return;
  const { orgId } = req.params;
  const { userId, role = 'member', status, inviteEmail } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    const normalizedRole = String(role || 'member').toLowerCase();
    const normalizedStatus = (() => {
      const candidate = String(status || '').toLowerCase();
      if (['pending', 'active', 'revoked'].includes(candidate)) {
        return candidate;
      }
      return 'pending';
    })();
    const payload = {
      org_id: orgId,
      user_id: userId,
      role: normalizedRole,
      invited_by: context.userId ?? null,
      status: normalizedStatus,
      invited_email: inviteEmail ?? null,
      accepted_at: normalizedStatus === 'active' ? new Date().toISOString() : null,
      last_seen_at: normalizedStatus === 'active' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('organization_memberships')
    .upsert(payload, { onConflict: 'org_id,user_id' })
    .select('id, org_id, user_id, role, status, invited_by, invited_email, accepted_at, last_seen_at, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    logRouteError('POST /api/admin/organizations/:orgId/members', error);
    res.status(500).json({ error: 'Unable to add organization member' });
  }
});

app.patch('/api/admin/organizations/:orgId/members/:membershipId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.update'))) return;
  const { orgId, membershipId } = req.params;
  const { role, status } = req.body || {};

  if (!role && !status) {
    res.status(400).json({ error: 'role or status required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    const { data: existing, error: existingError } = await supabase
      .from('organization_memberships')
      .select('id, org_id, role, status, user_id')
      .eq('id', membershipId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    const updatePayload = {};
    if (role) {
      updatePayload.role = String(role).toLowerCase();
    }
    if (status) {
      const normalizedStatus = String(status).toLowerCase();
      if (!['pending', 'active', 'revoked'].includes(normalizedStatus)) {
        res.status(400).json({ error: 'Invalid status value' });
        return;
      }
      updatePayload.status = normalizedStatus;
      if (normalizedStatus === 'active') {
        updatePayload.accepted_at = new Date().toISOString();
        updatePayload.last_seen_at = new Date().toISOString();
      }
    }

    const roleIsChangingFromOwner =
      existing.role === 'owner' && updatePayload.role && updatePayload.role !== 'owner';
    const statusRevokingOwner = existing.role === 'owner' && updatePayload.status === 'revoked';

    if (roleIsChangingFromOwner || statusRevokingOwner) {
      const { count, error: countError } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .eq('status', 'active');

      if (countError) throw countError;
      if (!count || count <= 1) {
        res.status(400).json({ error: 'At least one active owner is required' });
        return;
      }
    }

    const { data, error } = await supabase
      .from('organization_memberships')
      .update(updatePayload)
      .eq('id', membershipId)
      .eq('org_id', orgId)
      .select('id, org_id, user_id, role, status, invited_by, invited_email, accepted_at, last_seen_at, created_at, updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Membership not found after update' });
      return;
    }

    res.json({ data });
  } catch (error) {
    logRouteError('PATCH /api/admin/organizations/:orgId/members/:membershipId', error);
    res.status(500).json({ error: 'Unable to update organization member' });
  }
});

app.delete('/api/admin/organizations/:orgId/members/:membershipId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.delete'))) return;
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
    logRouteError('DELETE /api/admin/organizations/:orgId/members/:membershipId', error);
    res.status(500).json({ error: 'Unable to remove organization member' });
  }
});

app.get('/api/admin/organizations/:orgId/users', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.users.list'))) return;
  const { orgId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const members = await fetchOrgMembersWithProfiles(orgId);
    res.json({ data: members });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:orgId/users', error);
    res.status(500).json({ error: 'Unable to load organization users' });
  }
});

app.post('/api/admin/organizations/:orgId/invites', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const { email, role = 'member', metadata = {}, sendEmail = true } = req.body || {};

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) {
    res.status(400).json({ error: 'email_required', message: 'Invite email is required.' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id,name,slug')
      .eq('id', orgId)
      .maybeSingle();

    const actor = buildActorFromRequest(req);
    const { invite, duplicate } = await createOrgInvite({
      orgId,
      email: normalizedEmail,
      role,
      inviter: actor,
      orgName: orgRow?.name ?? null,
      metadata,
      sendEmail,
      duplicateStrategy: 'return',
    });

    res.status(201).json({
      data: buildPublicInvitePayload(invite, orgRow || null),
      duplicate,
    });
  } catch (error) {
    logRouteError('POST /api/admin/organizations/:orgId/invites', error);
    if (error?.message === 'invalid_email') {
      res.status(400).json({ error: 'invalid_email', message: 'Invite email is invalid.' });
      return;
    }
    res.status(500).json({ error: 'Unable to create organization invite' });
  }
});

// ---------------------------------------------------------------------------
// Public invite acceptance endpoints
// ---------------------------------------------------------------------------

app.get('/api/invite/:token', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const token = (req.params?.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'invite_token_required' });
    return;
  }

  try {
    const invite = await loadInviteByToken(token);
    if (!invite) {
      res.status(404).json({ error: 'invite_not_found' });
      return;
    }
    const orgSummary = await fetchOrganizationSummary(invite.org_id);
    res.json({ data: buildPublicInvitePayload(invite, orgSummary) });
  } catch (error) {
    logger.warn('invite_lookup_failed', { token: token.slice(0, 6), message: error?.message || String(error) });
    res.status(500).json({ error: 'Unable to load invite' });
  }
});

app.post('/api/invite/:token/accept', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const token = (req.params?.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'invite_token_required' });
    return;
  }

  try {
    const invite = await loadInviteByToken(token);
    if (!invite) {
      res.status(404).json({ error: 'invite_not_found' });
      return;
    }

    const derivedStatus = deriveInviteStatus(invite);
    if (!INVITE_ACCEPTABLE_STATUSES.has(derivedStatus)) {
      res.status(409).json({ error: 'invite_unavailable', status: derivedStatus });
      return;
    }

    const orgSummary = await fetchOrganizationSummary(invite.org_id);
    const fullName = (req.body?.fullName || invite.invited_name || '').trim();
    const password = req.body?.password ? String(req.body.password) : '';

    let authUser = null;
    try {
      const { data, error } = await supabase.auth.admin.getUserByEmail(invite.email);
      if (error && error.message !== 'User not found') {
        throw error;
      }
      authUser = data?.user ?? null;
    } catch (error) {
      logger.error('invite_accept_lookup_failed', { message: error?.message || String(error) });
      res.status(500).json({ error: 'Unable to validate invite email' });
      return;
    }

    if (!authUser) {
      if (!password || password.length < INVITE_PASSWORD_MIN_CHARS) {
        res.status(400).json({
          error: 'invalid_password',
          message: `Password must be at least ${INVITE_PASSWORD_MIN_CHARS} characters`,
        });
        return;
      }
      const { data, error } = await supabase.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || invite.invited_name || null,
          onboarding_org_id: invite.org_id,
        },
      });
      if (error) {
        logger.error('invite_accept_user_create_failed', { message: error?.message || String(error) });
        res.status(500).json({ error: 'Unable to create account for invite' });
        return;
      }
      authUser = data?.user || null;
    } else if (password) {
      if (password.length < INVITE_PASSWORD_MIN_CHARS) {
        res.status(400).json({
          error: 'invalid_password',
          message: `Password must be at least ${INVITE_PASSWORD_MIN_CHARS} characters`,
        });
        return;
      }
      try {
        await supabase.auth.admin.updateUserById(authUser.id, { password });
      } catch (error) {
        logger.warn('invite_accept_password_update_failed', { userId: authUser.id, message: error?.message || String(error) });
      }
    }

    if (!authUser) {
      res.status(500).json({ error: 'Unable to resolve invite user' });
      return;
    }

    const actor = {
      userId: authUser.id,
      email: authUser.email,
      name: fullName || authUser.user_metadata?.full_name || invite.email,
    };

    await upsertOrganizationMembership(invite.org_id, authUser.id, normalizeOrgRole(invite.role), actor);

    const nowIso = new Date().toISOString();
    await supabase
      .from('org_invites')
      .update({ status: 'accepted', accepted_at: nowIso, accepted_user_id: authUser.id })
      .eq('id', invite.id);

    await recordActivationEvent(invite.org_id, 'invite_accepted_public', { inviteId: invite.id }, actor);
    await createAuditLogEntry('org_invite_accepted', { inviteId: invite.id }, { userId: authUser.id, orgId: invite.org_id });

    const { count: remainingInvites } = await supabase
      .from('org_invites')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', invite.org_id)
      .in('status', ['pending', 'sent']);

    if (!remainingInvites) {
      await markActivationStep(invite.org_id, 'invite_team', { status: 'completed', actor });
    } else {
      await markActivationStep(invite.org_id, 'invite_team', { status: 'in_progress', actor });
    }

    res.json({
      data: {
        status: 'accepted',
        orgId: invite.org_id,
        orgName: orgSummary?.name || null,
        email: invite.email,
        loginUrl: INVITE_LOGIN_URL,
      },
    });
  } catch (error) {
    logger.error('invite_accept_failed', { message: error?.message || String(error) });
    res.status(500).json({ error: 'Unable to accept invite' });
  }
});

// ---------------------------------------------------------------------------
// Client onboarding orchestration
// ---------------------------------------------------------------------------

app.post('/api/admin/onboarding/orgs', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  const actor = buildActorFromRequest(req);
  const body = req.body || {};
  const errors = [];

  const name = String(body.name || '').trim();
  const type = body.type ?? body.orgType ?? null;
  const contactPerson = body.contactPerson || body.contact_person || '';
  const contactEmail = (body.contactEmail || body.contact_email || '').trim().toLowerCase();
  const timezone = body.timezone || DEFAULT_ORG_TIMEZONE;
  const ownerInput = body.owner || {};

  if (!name) errors.push({ field: 'name', message: 'Organization name is required.' });
  if (!contactEmail) errors.push({ field: 'contactEmail', message: 'Primary contact email is required.' });
  if (!ownerInput.userId && !ownerInput.email) {
    errors.push({ field: 'owner', message: 'An owner user ID or email is required.' });
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'validation_error', details: errors });
    return;
  }

  try {
    const slug = await ensureUniqueOrgSlug(body.slug || name);
    const subscription = body.subscription || DEFAULT_ORG_PLAN;
    const orgInsert = {
      id: body.id ?? undefined,
      name,
      slug,
      type,
      description: body.description ?? null,
      logo: body.logo ?? null,
      contact_person: contactPerson,
      contact_email: contactEmail,
      contact_phone: body.contactPhone ?? null,
      website: body.website ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      country: body.country ?? null,
      postal_code: body.postalCode ?? null,
      subscription,
      billing_email: body.billingEmail ?? contactEmail,
      billing_cycle: body.billingCycle ?? 'annual',
      custom_pricing: body.customPricing ?? null,
      max_learners: body.maxLearners ?? null,
      max_courses: body.maxCourses ?? null,
      max_storage: body.maxStorage ?? null,
      features: {
        sandbox_enabled: true,
        onboarding_checklist: true,
        ...(body.features || {}),
      },
      settings: {
        timezone,
        autoEnrollment: true,
        ...(body.settings || {}),
      },
      status: body.status || 'active',
      tags: body.tags || [],
      onboarding_status: 'pending',
      timezone,
    };

    const { data: org, error } = await supabase
      .from('organizations')
      .insert(orgInsert)
      .select('*')
      .single();

    if (error) throw error;

    await initializeActivationSteps(org.id, actor);
    await recordActivationEvent(org.id, 'org_created', { name }, actor);
    await createAuditLogEntry('org_created', { slug, name }, { userId: actor.userId, orgId: org.id });

    const ownerRole = normalizeOrgRole(ownerInput.role || 'owner', 'owner');
    const inviteResults = [];

    if (ownerInput.userId) {
      await upsertOrganizationMembership(org.id, ownerInput.userId, ownerRole, actor);
      await markActivationStep(org.id, 'assign_owner', { actor });
    } else if (ownerInput.email) {
      const { invite } = await createOrgInvite({
        orgId: org.id,
        email: ownerInput.email,
        role: ownerRole,
        inviter: actor,
        orgName: org.name,
        metadata: { type: 'owner' },
      });
      inviteResults.push({ email: invite.email, id: invite.id, role: invite.role });
    }

    if (body.backupAdmin?.email || body.backupAdmin?.userId) {
      const backupRole = normalizeOrgRole(body.backupAdmin.role || 'admin', 'admin');
      if (body.backupAdmin.userId) {
        await upsertOrganizationMembership(org.id, body.backupAdmin.userId, backupRole, actor);
      } else if (body.backupAdmin.email) {
        const { invite } = await createOrgInvite({
          orgId: org.id,
          email: body.backupAdmin.email,
          role: backupRole,
          inviter: actor,
          orgName: org.name,
          metadata: { type: 'backup_admin' },
        });
        inviteResults.push({ email: invite.email, id: invite.id, role: invite.role });
      }
    }

    const initialInvites = Array.isArray(body.invites) ? body.invites.slice(0, INVITE_BULK_LIMIT) : [];
    for (const invite of initialInvites) {
      if (!invite || !invite.email) continue;
      try {
        const normalizedRole = normalizeOrgRole(invite.role || 'member');
        const { invite: createdInvite } = await createOrgInvite({
          orgId: org.id,
          email: invite.email,
          role: normalizedRole,
          inviter: actor,
          orgName: org.name,
          metadata: invite.metadata || {},
        });
        inviteResults.push({ email: createdInvite.email, id: createdInvite.id, role: createdInvite.role });
      } catch (inviteError) {
        inviteResults.push({ email: invite.email, error: inviteError.message });
      }
    }

    if (inviteResults.length > 0) {
      await markActivationStep(org.id, 'invite_team', { status: 'in_progress', actor });
    }

    const progress = await fetchOnboardingProgress(org.id);
    res.status(201).json({ data: org, invites: inviteResults, progress });
  } catch (error) {
    console.error('Failed to create onboarding organization', error);
    res.status(500).json({ error: 'Unable to create organization', details: error.message });
  }
});

app.get('/api/admin/onboarding/:orgId/invites', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Failed to list org invites', error);
    res.status(500).json({ error: 'Unable to fetch invites' });
  }
});

app.post('/api/admin/onboarding/:orgId/invites', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  const actor = buildActorFromRequest(req);
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const orgSummary = await fetchOrganizationSummary(orgId);
    const orgName = orgSummary?.name || body.orgName || 'Your organization';
    const normalizedRole = normalizeOrgRole(body.role || 'member');
    const { invite, duplicate } = await createOrgInvite({
      orgId,
      email,
      role: normalizedRole,
      inviter: actor,
      orgName,
      metadata: body.metadata || {},
      sendEmail: body.sendEmail !== false,
      duplicateStrategy: body.allowDuplicate ? 'create' : 'return',
    });

    if (!duplicate) {
      await markActivationStep(orgId, 'invite_team', { status: 'in_progress', actor });
    }

    res.status(201).json({ data: invite, duplicate });
  } catch (error) {
    console.error('Failed to create invite', error);
    res.status(500).json({ error: 'Unable to create invite', details: error.message });
  }
});

app.post('/api/admin/onboarding/:orgId/invites/bulk', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;
  const actor = buildActorFromRequest(req);
  const entries = Array.isArray(req.body?.invites) ? req.body.invites : [];
  if (entries.length === 0) {
    res.status(400).json({ error: 'No invites provided' });
    return;
  }

  const orgSummary = await fetchOrganizationSummary(orgId);
  const orgName = orgSummary?.name || req.body?.orgName || 'Your organization';
  const sliced = entries.slice(0, INVITE_BULK_LIMIT);
  const results = [];
  for (const entry of sliced) {
    const email = (entry?.email || '').trim().toLowerCase();
    if (!email) {
      results.push({ error: 'missing_email' });
      continue;
    }
    try {
      const { invite, duplicate } = await createOrgInvite({
        orgId,
        email,
        role: normalizeOrgRole(entry?.role || 'member'),
        inviter: actor,
        orgName,
        metadata: entry?.metadata || {},
        sendEmail: entry?.sendEmail !== false,
      });
      results.push({ email: invite.email, id: invite.id, duplicate });
    } catch (error) {
      results.push({ email, error: error.message });
    }
  }

  await markActivationStep(orgId, 'invite_team', { status: 'in_progress', actor });
  res.status(201).json({ results });
});

app.post('/api/admin/onboarding/:orgId/invites/:inviteId/resend', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;
  const actor = buildActorFromRequest(req);

  try {
    const { data: invite, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) throw error;
    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    if (invite.status === 'accepted' || invite.status === 'revoked') {
      res.status(400).json({ error: 'Invite can no longer be resent' });
      return;
    }

    const orgSummary = await fetchOrganizationSummary(orgId);
    const updated = await deliverInviteEmail(invite, { orgName: orgSummary?.name || '', inviterName: actor.name });
    await recordActivationEvent(orgId, 'invite_resent', { inviteId }, actor);
    res.json({ data: updated });
  } catch (error) {
    console.error('Failed to resend invite', error);
    res.status(500).json({ error: 'Unable to resend invite' });
  }
});

app.delete('/api/admin/onboarding/:orgId/invites/:inviteId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const { error } = await supabase
      .from('org_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('org_id', orgId);
    if (error) throw error;
    await recordActivationEvent(orgId, 'invite_revoked', { inviteId }, buildActorFromRequest(req));
    res.status(204).end();
  } catch (error) {
    console.error('Failed to revoke invite', error);
    res.status(500).json({ error: 'Unable to revoke invite' });
  }
});

app.get('/api/admin/onboarding/:orgId/progress', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access) return;

  const progress = await fetchOnboardingProgress(orgId);
  res.json({ data: progress });
});

app.patch('/api/admin/onboarding/:orgId/steps/:stepId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, stepId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  const status = req.body?.status;
  if (!['pending', 'in_progress', 'completed', 'blocked'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  await markActivationStep(orgId, stepId, { status, actor: buildActorFromRequest(req) });
  const progress = await fetchOnboardingProgress(orgId);
  res.json({ data: progress });
});

app.post('/api/orgs/:orgId/memberships/accept', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('organization_memberships')
      .update({ status: 'active', accepted_at: now, last_seen_at: now })
      .eq('org_id', orgId)
      .eq('user_id', context.userId)
      .select('id, org_id, user_id, role, status, invited_email, accepted_at, last_seen_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (req.user?.email) {
      try {
        await supabase
          .from('org_invites')
          .update({ status: 'accepted' })
          .eq('org_id', orgId)
          .eq('email', req.user.email.toLowerCase())
          .in('status', ['pending', 'sent']);
      } catch (inviteError) {
        console.warn('[onboarding] Failed to sync invite acceptance', inviteError);
      }
      const { count } = await supabase
        .from('org_invites')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['pending', 'sent']);
      const actor = buildActorFromRequest(req);
      await recordActivationEvent(orgId, 'invite_accepted', { membershipId: data.id }, actor);
      if (!count || count === 0) {
        await markActivationStep(orgId, 'invite_team', { status: 'completed', actor });
      }
    }

    res.json({ data });
  } catch (error) {
    console.error(`Failed to accept membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to accept membership' });
  }
});

app.post('/api/orgs/:orgId/memberships/leave', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const { data: membership, error } = await supabase
      .from('organization_memberships')
      .select('id, role, status')
      .eq('org_id', orgId)
      .eq('user_id', context.userId)
      .maybeSingle();

    if (error) throw error;
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (membership.role === 'owner') {
      const { count, error: countError } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .eq('status', 'active');

      if (countError) throw countError;
      if (!count || count <= 1) {
        res.status(400).json({ error: 'Cannot leave as the last active owner' });
        return;
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('organization_memberships')
      .update({ status: 'revoked', last_seen_at: now })
      .eq('org_id', orgId)
      .eq('user_id', context.userId);

    if (updateError) throw updateError;
    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to leave organization ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to leave organization' });
  }
});

// Organization profile + branding admin APIs
app.get('/api/admin/org-profiles', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await requireAdminAccess(req, res))) return;

  const { search, status } = req.query || {};

  try {
    let query = supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search && String(search).trim().length > 0) {
      const term = `%${String(search).trim()}%`;
      query = query.or(`name.ilike.${term},contact_person.ilike.${term},contact_email.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const bundles = await hydrateOrgProfileBundles(data || []);
    res.json({ data: bundles });
  } catch (error) {
    console.error('Failed to list organization profiles:', error);
    res.status(500).json({ error: 'Unable to list organization profiles' });
  }
});

app.get('/api/admin/org-profiles/:orgId', (req, res) => handleOrgProfileBundleRequest(req, res));
app.get('/api/admin/org-profiles/:orgId/context', (req, res) =>
  handleOrgProfileBundleRequest(req, res, { mode: 'context' }),
);
app.put('/api/admin/org-profiles/:orgId', (req, res) => handleOrgProfileUpsert(req, res));

app.delete('/api/admin/org-profiles/:orgId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    await Promise.all([
      supabase.from('organization_profiles').delete().eq('org_id', orgId),
      supabase.from('organization_branding').delete().eq('org_id', orgId),
      supabase.from('organization_contacts').delete().eq('org_id', orgId),
    ]);
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete organization profile for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete organization profile' });
  }
});

app.post('/api/admin/org-profiles/:orgId/contacts', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  const { name, email, role, type, phone, notes, isPrimary = false } = req.body || {};
  if (!name || !email) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }

  try {
    const payload = {
      org_id: orgId,
      name,
      email,
      role: role ?? null,
      type: type ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
      is_primary: Boolean(isPrimary),
    };

    const { data, error } = await supabase
      .from('organization_contacts')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: mapContactResponse(data) });
  } catch (error) {
    console.error(`Failed to create contact for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create contact' });
  }
});

app.put('/api/admin/org-profiles/:orgId/contacts/:contactId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, contactId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  const body = req.body || {};
  const updatePayload = {};

  ['name', 'email', 'role', 'type', 'phone', 'notes'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updatePayload[field] = body[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(body, 'isPrimary') || Object.prototype.hasOwnProperty.call(body, 'is_primary')) {
    updatePayload.is_primary = Boolean(body.isPrimary ?? body.is_primary);
  }

  if (Object.keys(updatePayload).length === 0) {
    res.status(400).json({ error: 'No contact fields provided' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('organization_contacts')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', contactId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json({ data: mapContactResponse(data) });
  } catch (error) {
    console.error(`Failed to update contact ${contactId} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to update contact' });
  }
});

app.delete('/api/admin/org-profiles/:orgId/contacts/:contactId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, contactId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    await supabase.from('organization_contacts').delete().eq('org_id', orgId).eq('id', contactId);
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete contact ${contactId} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete contact' });
  }
});

['/api/admin/orgs/:orgId/profile', '/api/admin/organizations/:orgId/profile'].forEach((path) => {
  app.get(path, (req, res) => handleOrgProfileBundleRequest(req, res, { mode: 'profile' }));
  app.put(path, (req, res) => handleOrgProfileUpsert(req, res, (body) => ({ profile: body })));
});

app.get('/api/admin/orgs/:orgId/profile/context', (req, res) =>
  handleOrgProfileBundleRequest(req, res, { mode: 'context' }),
);

// User profile self-service endpoints
app.get('/api/users/me', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const [{ data: profileRow, error: profileError }, { data: userRow, error: userError }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', context.userId).maybeSingle(),
      supabase
        .from('users')
        .select('id, email, first_name, last_name, role, organization_id, organizationId')
        .eq('id', context.userId)
        .maybeSingle(),
    ]);

    if (profileError) throw profileError;
    if (userError) throw userError;

    let organizationRow = null;
    const orgId = profileRow?.organization_id || userRow?.organization_id || userRow?.organizationId;
    if (orgId) {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .maybeSingle();
      if (orgError) throw orgError;
      organizationRow = orgData;
    }

    const payload = mapUserProfileResponse(profileRow, userRow, organizationRow);
    res.json({ data: payload });
  } catch (error) {
    console.error('Failed to load current user profile:', error);
    res.status(500).json({ error: 'Unable to load profile' });
  }
});

app.put('/api/users/me', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  const body = req.body || {};

  try {
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', context.userId)
      .maybeSingle();

    if (profileError) throw profileError;

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, organization_id, organizationId')
      .eq('id', context.userId)
      .maybeSingle();

    if (userError) throw userError;

    const allowOrgChange = context.userRole === 'admin';
    const profilePayload = normalizeUserProfileUpdatePayload(context.userId, body, { allowOrgChange });

    if (!profilePayload) {
      res.status(400).json({ error: 'No profile fields provided' });
      return;
    }

    if (existingProfile?.id) {
      profilePayload.id = existingProfile.id;
    }

    const { data: upsertedProfile, error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    let organizationRow = null;
    const orgId = upsertedProfile.organization_id || userRow?.organization_id || userRow?.organizationId;
    if (orgId) {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .maybeSingle();
      if (orgError) throw orgError;
      organizationRow = orgData;
    }

    const payload = mapUserProfileResponse(upsertedProfile, userRow, organizationRow);
    res.json({ data: payload });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    res.status(500).json({ error: 'Unable to update profile' });
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
    if (!supabase) {
      res.status(503).json({ error: 'Supabase storage is not configured in this environment' });
      return;
    }

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

    const context = requireUserContext(req, res);
    if (!context) return;

    const storagePath = buildLessonVideoStoragePath({
      courseId,
      moduleId: moduleId || 'module',
      lessonId,
      filename: file.originalname || file.fieldname || 'video-upload',
    });

    try {
  let orgId = null;
      if (supabase) {
        const { data: courseRow, error: courseError } = await supabase
          .from('courses')
          .select('id, organization_id')
          .eq('id', courseId)
          .maybeSingle();
        if (courseError) throw courseError;
        if (!courseRow) {
          res.status(404).json({ error: 'Course not found' });
          return;
        }
        orgId = courseRow.organization_id ?? null;
        if (orgId) {
          const membership = await requireOrgAccess(req, res, orgId, { write: true });
          if (!membership) return;
        }
      }

      const uploadResult = await mediaService.uploadLessonVideo({
        file,
        storagePath,
        courseId,
        moduleId,
        lessonId,
        orgId,
        userId: context.userId,
      });

      res.status(201).json({
        data: {
          assetId: uploadResult.asset.id,
          courseId,
          moduleId,
          lessonId,
          bucket: uploadResult.asset.bucket,
          storagePath: uploadResult.asset.storage_path,
          signedUrl: uploadResult.signedUrl,
          urlExpiresAt: uploadResult.expiresAt,
          fileName: file.originalname || file.fieldname,
          fileSize: file.size,
          mimeType: file.mimetype,
          checksum: uploadResult.asset.checksum,
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
    if (!supabase) {
      res.status(503).json({ error: 'Supabase storage is not configured in this environment' });
      return;
    }
    const file = req.file;
    normalizeLegacyOrgInput(req.body, { surface: 'admin.documents.upload', requestId: req.requestId });
    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    try {
      const context = requireUserContext(req, res);
      if (!context) return;
      const rawDocumentId = req.body?.documentId;
      const documentId = typeof rawDocumentId === 'string' && rawDocumentId.trim().length > 0
        ? rawDocumentId
        : rawDocumentId
        ? String(rawDocumentId)
        : `doc_${Date.now()}`;
      const orgId = pickOrgId(req.body?.organization_id, req.body?.organizationId, req.body?.orgId);
      if (orgId) {
        const membership = await requireOrgAccess(req, res, orgId, { write: true });
        if (!membership) return;
      }
      const storagePath = buildDocumentStoragePath({
        orgId,
        documentId,
        filename: file.originalname || file.fieldname || 'upload.bin',
      });

      const metadata = {
        visibility: req.body?.visibility ?? 'global',
        category: req.body?.category ?? null,
        name: req.body?.name ?? file.originalname,
        documentId,
        courseId: req.body?.courseId ?? null,
        moduleId: req.body?.moduleId ?? null,
        lessonId: req.body?.lessonId ?? null,
      };

      const uploadResult = await mediaService.uploadDocument({
        file,
        storagePath,
        orgId,
        userId: context.userId,
        metadata,
      });

      res.status(201).json({
        data: {
          documentId,
          assetId: uploadResult.asset.id,
          storagePath: uploadResult.asset.storage_path,
          bucket: uploadResult.asset.bucket,
          signedUrl: uploadResult.signedUrl,
          urlExpiresAt: uploadResult.expiresAt,
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
  if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.list'))) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  const { user_id, tag, category, search, visibility } = req.query;
  const requestedOrgId = pickOrgId(req.query?.orgId, req.query?.org_id, req.query?.organization_id);
  const isPlatformAdmin = Boolean(context.isPlatformAdmin);
  const adminOrgIds = Array.isArray(context.memberships)
    ? context.memberships
        .filter((membership) => String(membership.role || '').toLowerCase() === 'admin' && membership.orgId)
        .map((membership) => normalizeOrgIdValue(membership.orgId))
        .filter(Boolean)
    : [];
  const allowedOrgIdSet = new Set(adminOrgIds);

  if (requestedOrgId) {
    const access = await requireOrgAccess(req, res, requestedOrgId, { write: false, requireOrgAdmin: true });
    if (!access) return;
    if (!isPlatformAdmin && !allowedOrgIdSet.has(requestedOrgId)) {
      res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
      return;
    }
  } else if (!isPlatformAdmin) {
    if (!adminOrgIds.length) {
      res.json({ data: [] });
      return;
    }
  }

  const buildDocumentsQuery = () => {
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });

    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (requestedOrgId) {
      query = query.eq('organization_id', requestedOrgId);
    } else if (!isPlatformAdmin) {
      query = query.in('organization_id', adminOrgIds);
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
    return query;
  };

  try {
    const { data } = await runSupabaseQueryWithRetry('admin.documents.list', () => buildDocumentsQuery());
    res.json({ data: data ?? [] });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

app.post('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.create'))) return;
  normalizeLegacyOrgInput(req.body, { surface: 'admin.documents.create', requestId: req.requestId });
  const context = requireUserContext(req, res);
  if (!context) return;

  const payload = req.body || {};

  if (!payload.name || !payload.category) {
    res.status(400).json({ error: 'name and category are required' });
    return;
  }

  const organizationId = pickOrgId(payload.organization_id, payload.organizationId, payload.orgId);

  try {
    if (organizationId) {
      const access = await requireOrgAccess(req, res, organizationId, { write: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'organization_scope_required', message: 'Document must be assigned to an organization.' });
      return;
    }

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
      organization_id: organizationId ?? null,
      user_id: payload.userId ?? null,
      created_by: payload.createdBy ?? context.userId ?? null,
      metadata: payload.metadata ?? {},
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
  const context = requireUserContext(req, res);
  if (!context) return;
  const patch = normalizeLegacyOrgInput(req.body || {}, { surface: 'admin.documents.update', requestId: req.requestId });

  try {
    const { data: existingDoc, error: existingError } = await supabase
      .from('documents')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existingDoc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const currentOrgId = normalizeOrgIdValue(existingDoc.organization_id);
    if (currentOrgId) {
      const access = await requireOrgAccess(req, res, currentOrgId, { write: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'organization_scope_required', message: 'Document is platform scoped' });
      return;
    }

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
      userId: 'user_id',
      metadata: 'metadata',
      organizationId: 'organization_id',
      organization_id: 'organization_id',
      orgId: 'organization_id',
    };

    Object.entries(map).forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        updatePayload[column] = patch[key];
      }
    });

    if (Object.prototype.hasOwnProperty.call(updatePayload, 'organization_id')) {
      const nextOrgId = normalizeOrgIdValue(updatePayload.organization_id);
      if (!nextOrgId) {
        res.status(400).json({ error: 'organization_id_required', message: 'organization_id cannot be empty.' });
        return;
      }
      if (nextOrgId !== currentOrgId) {
        const access = await requireOrgAccess(req, res, nextOrgId, { write: true });
        if (!access) return;
      }
      updatePayload.organization_id = nextOrgId;
    }

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
  const context = requireUserContext(req, res);
  if (!context) return;

  const docOrgId = await getDocumentOrgId(id);
  if (docOrgId === undefined) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  if (docOrgId) {
    const access = await requireOrgAccess(req, res, docOrgId, { write: false });
    if (!access) return;
  } else if (!context.isPlatformAdmin) {
    res.status(403).json({ error: 'organization_scope_required', message: 'Document is platform scoped' });
    return;
  }

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
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const { data: existing, error: existingError } = await supabase
      .from('documents')
      .select('storage_path, organization_id')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      res.status(204).end();
      return;
    }

    const docOrgId = normalizeOrgIdValue(existing.organization_id);
    if (docOrgId) {
      const access = await requireOrgAccess(req, res, docOrgId, { write: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'organization_scope_required', message: 'Document is platform scoped' });
      return;
    }

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;

    if (existing.storage_path) {
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

app.post('/api/media/assets/:assetId/sign', authenticate, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!supabase) {
    res.status(503).json({ error: 'Supabase storage is not configured in this environment' });
    return;
  }
  const { assetId } = req.params;
  if (!assetId) {
    res.status(400).json({ error: 'assetId is required' });
    return;
  }

  try {
    const context = requireUserContext(req, res);
    if (!context) return;
    const asset = await mediaService.getAssetById(assetId);
    if (!asset) {
      res.status(404).json({ error: 'Media asset not found' });
      return;
    }
    const allowed = await verifyMediaAssetAccess(req, res, asset, context);
    if (!allowed) return;
    const { signedUrl, expiresAt } = await mediaService.signAssetById({ assetId });
    res.json({
      data: {
        assetId,
        signedUrl,
        urlExpiresAt: expiresAt,
        bucket: asset.bucket,
        storagePath: asset.storage_path,
        mimeType: asset.mime_type,
        bytes: asset.bytes,
        metadata: asset.metadata || {},
      },
    });
  } catch (error) {
    console.error('[media] Failed to sign asset', error);
    res.status(500).json({ error: 'Unable to sign media asset' });
  }
});

// Surveys
const ADMIN_SURVEY_TABLES = [
  { table: 'surveys', columns: ['id', 'title', 'status', 'updated_at'] },
  { table: 'survey_assignments', columns: ['survey_id', 'organization_id'] },
];

const ensureAdminSurveySchemaOrRespond = async (res, label) => {
  const status = await ensureTablesReady(label, ADMIN_SURVEY_TABLES);
  if (!status.ok) {
    respondSchemaUnavailable(res, label, status);
    return false;
  }
  return true;
};

app.get('/api/admin/surveys', async (_req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.list'))) return;

  try {
    if (!supabase) {
      res.json({ data: listDemoSurveys() });
      return;
    }

    const { data } = await runSupabaseQueryWithRetry('admin.surveys.list', () =>
      supabase.from('surveys').select('*').order('updated_at', { ascending: false }),
    );

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
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.detail'))) return;
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
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.upsert'))) return;
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

    const { data } = await runSupabaseQueryWithRetry('admin.surveys.upsert', () =>
      supabase.from('surveys').upsert(insertPayload).select('*').single(),
    );

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
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.update'))) return;
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

    const { data } = await runSupabaseQueryWithRetry('admin.surveys.update', () =>
      supabase.from('surveys').update(updatePayload).eq('id', id).select('*').single(),
    );

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
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.delete'))) return;
  const { id } = req.params;

  try {
    if (!supabase) {
      const deleted = removeDemoSurvey(id);
      res.status(deleted ? 204 : 404).end();
      return;
    }

    await runSupabaseQueryWithRetry('admin.surveys.delete.assignments', () =>
      supabase.from('survey_assignments').delete().eq('survey_id', id),
    );
    await runSupabaseQueryWithRetry('admin.surveys.delete', () => supabase.from('surveys').delete().eq('id', id));
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete survey:', error);
    res.status(500).json({ error: 'Unable to delete survey' });
  }
});

app.get('/api/learner/notifications', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const limit = clampNumber(parseInt(req.query.limit, 10) || 20, 1, 100);
  const sinceIso = typeof req.query.since === 'string' ? req.query.since : null;
  const readFilter = typeof req.query.read === 'string' ? req.query.read.trim().toLowerCase() : null;

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    res.json({ data: [] });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const queryFactories = [];

    queryFactories.push((selectColumns) =>
      supabase
        .from('notifications')
        .select(selectColumns)
        .eq('user_id', context.userId)
        .order('created_at', { ascending: false })
        .limit(limit),
    );

    const orgIds = Array.isArray(context.organizationIds)
      ? context.organizationIds.filter((value) => typeof value === 'string' && value.trim())
      : [];

    if (orgIds.length) {
      queryFactories.push((selectColumns) =>
        supabase
          .from('notifications')
          .select(selectColumns)
          .in('org_id', orgIds)
          .is('user_id', null)
          .order('created_at', { ascending: false })
          .limit(limit),
      );
    }

    queryFactories.push((selectColumns) =>
      supabase
        .from('notifications')
        .select(selectColumns)
        .is('org_id', null)
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(Math.max(5, limit)),
    );

    const resultSets = await Promise.all(queryFactories.map((factory) => runNotificationQuery(factory)));

    let merged = resultSets.flat();
    const deduped = new Map();
    for (const note of merged) {
      if (note && !deduped.has(note.id)) {
        deduped.set(note.id, note);
      }
    }
    merged = Array.from(deduped.values());

    if (readFilter === 'true' || readFilter === 'false') {
      const flag = readFilter === 'true';
      merged = merged.filter((note) => Boolean(note?.read) === flag);
    }

    if (sinceIso) {
      const sinceTs = Date.parse(sinceIso);
      if (!Number.isNaN(sinceTs)) {
        merged = merged.filter((note) => {
          const noteTs = Date.parse(note?.created_at || note?.scheduled_for || '');
          if (Number.isNaN(noteTs)) return true;
          return noteTs >= sinceTs;
        });
      }
    }

    merged.sort((a, b) => {
      const aTs = Date.parse(a?.created_at || '') || 0;
      const bTs = Date.parse(b?.created_at || '') || 0;
      return bTs - aTs;
    });

    res.json({ data: merged.slice(0, limit) });
  } catch (error) {
    if (isMissingColumnError(error)) {
      logger.warn('learner_notifications_schema_mismatch', {
        code: error.code,
        message: error.message,
      });
      res.json({ data: [], degraded: true });
      return;
    }
    console.error('Failed to load learner notifications:', error);
    res.status(500).json({ error: 'Unable to load notifications' });
  }
});

// Notifications
app.get('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  const isAdmin = context.userRole === 'admin';
  const requestedOrgId = (req.query.org_id || req.query.orgId || '').toString().trim();
  const requestedUserId = (req.query.user_id || req.query.userId || '').toString().trim();
  const { page, pageSize, from, to } = parsePaginationParams(req, { defaultSize: 25, maxSize: 200 });
  const search = (req.query.search || '').toString().trim();
  const dispatchStatuses = (req.query.dispatchStatus || req.query.dispatch_status || '')
    .toString()
    .split(',')
    .map((status) => status.trim())
    .filter(Boolean);

  try {
    if (requestedOrgId) {
      const access = await requireOrgAccess(req, res, requestedOrgId, { write: false });
      if (!access && !isAdmin) return;
    }

    let query = supabase
      .from('notifications')
      .select('id,title,body,org_id,user_id,created_at,read,dispatch_status,channels,metadata,scheduled_for,delivered_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (requestedOrgId) {
      query = query.eq('org_id', requestedOrgId);
    }

    if (requestedUserId) {
      if (!isAdmin && requestedUserId !== context.userId) {
        res.status(403).json({ error: 'Cannot view notifications for another user' });
        return;
      }
      query = query.eq('user_id', requestedUserId);
    } else if (!isAdmin && !requestedOrgId) {
      if (!context.userId) {
        res.status(400).json({ error: 'user_id is required for non-admin queries' });
        return;
      }
      query = query.eq('user_id', context.userId);
    }

    if (dispatchStatuses.length) {
      query = query.in('dispatch_status', dispatchStatuses);
    }

    if (search) {
      const term = sanitizeIlike(search);
      query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: to + 1 < (count || 0),
      },
    });
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

  const channels = Array.isArray(payload.channels) && payload.channels.length ? payload.channels : ['in_app'];
  const scheduledFor = payload.scheduledFor || payload.scheduled_for || null;
  const dispatchStatus = scheduledFor ? 'pending' : 'queued';
  const sendEmailFlag = payload.sendEmail ?? payload.send_email ?? channels.includes('email');

  try {
    const insertPayload = {
      id: payload.id ?? undefined,
      title: payload.title,
      body: payload.body ?? null,
      org_id: payload.orgId ?? null,
      user_id: payload.userId ?? null,
      read: payload.read ?? false,
      channels,
      scheduled_for: scheduledFor,
      dispatch_status: dispatchStatus,
      metadata: payload.metadata ?? {},
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;

    if (!scheduledFor && notificationDispatcher?.enqueueDispatch) {
      notificationDispatcher.enqueueDispatch({
        notificationId: data.id,
        channels,
        sendEmail: sendEmailFlag,
      });
    }

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

app.get('/api/analytics/events', optionalAuthenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const requestedOrgId = pickOrgId(
    req.query?.orgId,
    req.query?.org_id,
    req.query?.organizationId,
    req.query?.organization_id,
    getHeaderOrgId(req),
    req.activeOrgId,
  );
  const resolvedOrgIds = new Set(
    requestedOrgId
      ? [requestedOrgId]
      : context.isPlatformAdmin
      ? []
      : (context.organizationIds || []).map((orgId) => normalizeOrgIdValue(orgId)).filter(Boolean),
  );
  const limitParam = Number.parseInt(String(req.query?.limit ?? ''), 10);
  const limit = clampNumber(Number.isNaN(limitParam) ? 50 : limitParam, 1, 500);
  const sinceParam = req.query?.since ? String(req.query.since) : null;
  const sinceIso = (() => {
    if (!sinceParam) return null;
    const ms = Date.parse(sinceParam);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  })();

  const filterEventByOrg = (orgId) => {
    if (!resolvedOrgIds.size) return true;
    if (!orgId) return false;
    return resolvedOrgIds.has(orgId);
  };

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const events = Array.isArray(e2eStore.analyticsEvents) ? e2eStore.analyticsEvents : [];
    const filtered = events.filter((event) => {
      const eventOrgId = pickOrgId(event.org_id, event.organization_id, event.orgId);
      if (!filterEventByOrg(eventOrgId)) {
        return false;
      }
      if (!sinceIso) {
        return true;
      }
      const ts = event.created_at || event.timestamp;
      return ts ? Date.parse(ts) >= Date.parse(sinceIso) : false;
    });
    res.json({
      data: filtered.slice(0, limit),
      pagination: { limit, hasMore: filtered.length > limit },
      demo: true,
    });
    return;
  }

  if (!ensureSupabase(res)) return;

  if (!context.isPlatformAdmin && !resolvedOrgIds.size) {
    res.json({ data: [], pagination: { limit, hasMore: false }, reason: 'org_scope_required' });
    return;
  }

  try {
    let query = supabase
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (resolvedOrgIds.size === 1) {
      query = query.eq('org_id', Array.from(resolvedOrgIds)[0]);
    } else if (resolvedOrgIds.size > 1) {
      query = query.in('org_id', Array.from(resolvedOrgIds));
    }

    if (sinceIso) {
      query = query.gte('created_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    res.json({
      data: rows,
      pagination: { limit, hasMore: rows.length === limit },
    });
  } catch (error) {
    console.error('[analytics.events] fetch_failed', {
      requestId: req.requestId,
      message: error?.message || error,
    });
    res.status(500).json({ error: 'Unable to fetch analytics events' });
  }
});

app.post('/api/analytics/events', optionalAuthenticate, async (req, res) => {
  const parseResult = analyticsEventIngestSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: 'ANALYTICS_PAYLOAD_INVALID',
      message: 'Validation failed',
      details: parseResult.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
      receivedKeys: Object.keys(req.body || {}),
    });
    return;
  }
  const { id, user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload, org_id } =
    parseResult.data;

  logger.info('analytics_events_ingest_request', {
    requestId: req.requestId,
    userId: req.user?.userId || req.user?.id || null,
    receivedKeys: Object.keys(req.body || {}),
  });

  const trustedHeaderOrgId = getHeaderOrgId(req) || null;
  const derivedOrgId = req.activeOrgId || req.user?.activeOrgId || req.user?.organizationId || trustedHeaderOrgId;

  let normalizedOrgCandidate = typeof org_id === 'string' ? org_id.trim() : '';
  if (!isUuid(normalizedOrgCandidate) && isUuid(derivedOrgId)) {
    normalizedOrgCandidate = derivedOrgId;
  }
  const resolvedOrgId = isUuid(normalizedOrgCandidate) ? normalizedOrgCandidate : null;
  const orgMissing = !resolvedOrgId;

  if (orgMissing) {
    logger.warn('analytics_event_missing_org', {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id || null,
      headerOrgId: trustedHeaderOrgId,
      derivedOrgId,
    });
  }

  const sanitizedPayload = scrubAnalyticsPayload(payload ?? {});

  const normalizedEvent = event_type.trim();
  const rawClientEventId = typeof id === 'string' ? id.trim() : null;
  const normalizedClientEventId = rawClientEventId || null;
  const useCustomPrimaryKey = normalizedClientEventId ? isUuid(normalizedClientEventId) : false;

  const respondQueued = (meta = {}) =>
    res.json({ status: 'queued', stored: false, missingOrgContext: orgMissing, ...meta });
  const respondStored = (meta = {}) =>
    res.json({ status: 'stored', stored: true, missingOrgContext: orgMissing, ...meta });

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const eventId = useCustomPrimaryKey
      ? normalizedClientEventId
      : id || `demo-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id: eventId,
      user_id: user_id ?? null,
      org_id: resolvedOrgId,
      course_id: course_id ?? null,
      lesson_id: lesson_id ?? null,
      module_id: module_id ?? null,
      event_type: normalizedEvent,
      session_id: session_id ?? null,
      user_agent: user_agent ?? null,
      payload: sanitizedPayload,
      client_event_id: normalizedClientEventId,
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
    const insertPayload = {
      user_id: user_id ?? null,
      org_id: resolvedOrgId,
      course_id: course_id ?? null,
      lesson_id: lesson_id ?? null,
      module_id: module_id ?? null,
      event_type: normalizedEvent,
      session_id: session_id ?? null,
      user_agent: user_agent ?? null,
      payload: sanitizedPayload,
      client_event_id: normalizedClientEventId,
    };

    if (useCustomPrimaryKey) {
      insertPayload.id = normalizedClientEventId;
    }

    let { data, error } = await supabase
      .from('analytics_events')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
      if (missingColumn === 'client_event_id') {
        logger.warn('analytics_events_client_event_id_missing', {
          message: error.message,
          code: error.code,
        });
        delete insertPayload.client_event_id;
        const retry = await supabase
          .from('analytics_events')
          .insert(insertPayload)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      if (isAnalyticsClientEventDuplicate(error)) {
        logger.info('analytics_event_duplicate_client_id', {
          clientEventId: normalizedClientEventId,
          eventType: normalizedEvent,
        });
        respondStored({ duplicate: true, clientEventId: normalizedClientEventId });
        return;
      }
      throw error;
    }

    respondStored({ data });
  } catch (error) {
    console.error('Failed to record analytics event:', {
      error,
      clientEventId: normalizedClientEventId,
      eventType: normalizedEvent,
    });
    respondQueued({
      reason: error?.code || 'persistence_failed',
      errorCode: error?.code || null,
      message: error?.message || null,
    });
  }
});

app.post('/api/audit-log', async (req, res) => {
  const { action, details = {}, timestamp, userId, user_id, orgId, org_id } = req.body || {};
  const sessionUser = req.user || req.supabaseJwtUser || null;
  if (!sessionUser) {
    console.info('[audit-log] missing authenticated user; acknowledging best-effort');
    return res.status(202).json({ ok: true, stored: false, reason: 'unauthenticated' });
  }
  const sessionUserId = sessionUser?.userId || sessionUser?.id || null;

  const normalizedAction = typeof action === 'string' ? action.trim() : '';
  if (!normalizedAction) {
    res.status(400).json({ error: 'action is required' });
    return;
  }

  const normalizedOrgId = normalizeOrgIdValue(orgId ?? org_id ?? null);
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: normalizedAction,
    details,
    user_id: sessionUserId ?? userId ?? user_id ?? null,
    organization_id: normalizedOrgId ?? null,
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
      organization_id: entry.organization_id ?? null,
      created_at: entry.timestamp,
    });

    if (error) throw error;
    respondOk({ stored: true });
  } catch (error) {
    console.error('Failed to persist audit log entry:', error);
    respondOk({
      stored: false,
      reason: error?.code || 'persistence_failed',
      errorCode: error?.code || null,
      message: error?.message || null,
    });
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

const clampJourneyLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1000;
  return Math.min(Math.max(Math.floor(parsed), 1), 5000);
};

const parseIsoTimestamp = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const extractProgressFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.progress,
    payload.progressPercent,
    payload.progress_percentage,
    payload.completion,
    payload.completionPercent,
  ];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(100, numeric));
    }
  }
  return null;
};

const summarizeEventsAsJourneys = (events) => {
  const journeys = new Map();

  for (const event of events) {
    if (!event?.user_id || !event?.course_id) continue;
    const key = `${event.user_id}:${event.course_id}`;
    let summary = journeys.get(key);
    if (!summary) {
      summary = {
        user_id: event.user_id,
        course_id: event.course_id,
        org_id: event.org_id ?? null,
        started_at: event.created_at,
        last_active_at: event.created_at,
        completed_at: null,
        progress_percentage: 0,
        total_events: 0,
        sessions: new Set(),
        eventTypes: new Set(),
      };
      journeys.set(key, summary);
    }
    summary.org_id = summary.org_id || event.org_id || null;
    if (!summary.started_at || new Date(event.created_at) < new Date(summary.started_at)) {
      summary.started_at = event.created_at;
    }
    if (!summary.last_active_at || new Date(event.created_at) > new Date(summary.last_active_at)) {
      summary.last_active_at = event.created_at;
    }
    summary.total_events += 1;
    if (event.session_id) summary.sessions.add(event.session_id);
    if (event.event_type) summary.eventTypes.add(event.event_type);
    if (!summary.completed_at && event.event_type === 'course_completed') {
      summary.completed_at = event.created_at;
    }
    const progressCandidate = extractProgressFromPayload(event.payload);
    if (progressCandidate !== null) {
      summary.progress_percentage = Math.max(summary.progress_percentage ?? 0, progressCandidate);
    }
  }

  return Array.from(journeys.values())
    .map((summary) => ({
      user_id: summary.user_id,
      course_id: summary.course_id,
      org_id: summary.org_id,
      started_at: summary.started_at,
      last_active_at: summary.last_active_at,
      completed_at: summary.completed_at,
      progress_percentage: summary.progress_percentage ?? 0,
      total_events: summary.total_events,
      sessions_count: summary.sessions.size,
      event_types: Array.from(summary.eventTypes),
    }))
    .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
};

app.get('/api/analytics/journeys', async (req, res) => {
  const { user_id, course_id } = req.query;
  const org_id = (req.query?.org_id || req.query?.orgId || '').toString().trim();
  const sinceIso = parseIsoTimestamp(req.query?.since || req.query?.since_at);
  const limit = clampJourneyLimit(req.query?.limit);
  console.log('[analytics.journeys] request', {
    requestId: req.requestId,
    user_id: user_id || null,
    course_id: course_id || null,
    org_id: org_id || null,
    since: sinceIso,
    limit,
  });

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    let data = Array.from(e2eStore.learnerJourneys.values());
    if (user_id) {
      data = data.filter((journey) => journey.user_id === user_id);
    }
    if (course_id) {
      data = data.filter((journey) => journey.course_id === course_id);
    }
    if (org_id) {
      data = data.filter((journey) => journey.org_id === org_id);
    }
    res.json({ data, demo: true });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    let query = supabase
      .from('analytics_events')
      .select('user_id,course_id,org_id,event_type,session_id,created_at,payload')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    if (org_id) {
      query = query.eq('org_id', org_id);
    }

    if (sinceIso) {
      query = query.gte('created_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    const events = Array.isArray(data) ? data : [];
    const payload = summarizeEventsAsJourneys(events);

    res.json({
      data: payload,
      meta: {
        scannedEvents: events.length,
        limit,
        since: sinceIso,
        filters: {
          user_id: user_id || null,
          course_id: course_id || null,
          org_id: org_id || null,
        },
      },
    });
  } catch (error) {
    console.error('[analytics.journeys] fetch_failed', {
      requestId: req.requestId,
      message: error?.message || error,
      stack: error?.stack,
    });
    console.error('ANALYTICS JOURNEYS ERROR:', error);
    res.status(500).json({ error: 'Unable to fetch learner journeys' });
  }
});

if (NODE_ENV !== 'production') {
  app.get('/api/dev/diagnostics/rls/courses', async (_req, res) => {
    if (!supabase) {
      res.status(503).json({ ok: false, error: 'supabase_not_configured' });
      return;
    }

    const diagnostics = {
      table: 'courses',
      supabaseUrlHost,
      serviceRoleKeyPresent: Boolean(supabaseServiceRoleKey),
      rlsEnabled: false,
      checkedAt: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('pg_policies')
        .select('schemaname,tablename,policyname,roles,cmd,permissive')
        .eq('tablename', 'courses');
      if (error) {
        diagnostics.policiesError = { message: error.message, code: error.code };
      } else {
        diagnostics.policies = data || [];
        diagnostics.rlsEnabled = Array.isArray(data) && data.length > 0;
      }
    } catch (err) {
      diagnostics.policiesError = { message: err?.message || String(err) };
    }

    try {
      const { data, error } = await supabase.from('courses').select('id').limit(1);
      if (error) {
        diagnostics.selectProbe = { ok: false, error: { message: error.message, code: error.code } };
      } else {
        diagnostics.selectProbe = {
          ok: true,
          rowCount: Array.isArray(data) ? data.length : 0,
          sampleIds: Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [],
        };
      }
    } catch (err) {
      diagnostics.selectProbe = { ok: false, error: { message: err?.message || String(err) } };
    }

    res.json({ ok: true, diagnostics });
  });
}

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

const redactEnv = (input) => {
  if (!input || typeof input !== 'object') {
    return input;
  }
  return Object.keys(input).reduce((acc, key) => {
    if (/(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)/i.test(key)) {
      acc[key] = '***redacted***';
    } else {
      acc[key] = input[key];
    }
    return acc;
  }, {});
};

// Example usage of shared utils
log('info', 'Server started', { env: redactEnv(env) });


// Use the structured API error handler for all errors
app.use(apiErrorHandler);

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving production build from ${distPath} at http://0.0.0.0:${PORT}`);
});

// Initialize WebSocket server (ws) to handle realtime broadcasts at /ws
try {
  const wss = new WebSocketServer({ server, path: WS_SERVER_PATH });
  wsHealthSnapshot.enabled = true;
  wsHealthSnapshot.lastError = null;
  wsHealthSnapshot.lastStartedAt = new Date().toISOString();

  wss.on('connection', (ws, req) => {
    const originHeader = req.headers.origin;
    const { allowed, reason } = isAllowedWsOrigin(originHeader);
    console.info('[WS] Origin evaluation', {
      origin: originHeader || '(none)',
      allowed,
      reason,
    });
    if (!allowed) {
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

  wss.on('error', (err) => {
    wsHealthSnapshot.enabled = false;
    wsHealthSnapshot.lastError = err instanceof Error ? err.message : String(err);
  });

  console.log(`WebSocket server initialized at ${WS_SERVER_PATH}`);
} catch (err) {
  wsHealthSnapshot.enabled = false;
  wsHealthSnapshot.lastError = err instanceof Error ? err.message : String(err);
  console.warn('Failed to initialize WebSocket server:', err);
}
