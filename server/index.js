import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import multer from 'multer';
import { randomUUID, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
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
  analyticsBatchSchema,
  analyticsEventIngestSchema,
} from './validators.js';
import { validateCoursePayload } from './validators/coursePayload.js';
import { parsePublishRequestBody, parseUpsertRequestBody } from './validators/courseWriteContract.js';
import { normalizeImportEntries, normalizeModuleForImport } from './lib/courseImporter.js';
import { logger } from './lib/logger.js';
import { isAllowedWsOrigin } from './lib/wsOrigins.js';

const logRouteError = (route, error) => {
  logger.error('route_error', {
    route,
    message: error instanceof Error ? error.message : String(error),
    stack: error?.stack ?? null,
    isHandledRouteError: true,
  });
};

// ---------------------------------------------------------------------------
// Standardized API response helpers — use these on ALL new/updated routes.
// Shape: { ok, data, code, message, meta }
// ---------------------------------------------------------------------------
const sendApiResponse = (res, data, options = {}) => {
  const {
    statusCode = 200,
    code = null,
    message = null,
    meta = null,
  } = options;
  return res.status(statusCode).json({
    ok: true,
    data: data ?? null,
    code,
    message,
    meta: meta && typeof meta === 'object' ? meta : null,
  });
};

const sendApiError = (res, statusCode, code, message, extra = {}) => {
  const {
    meta = null,
    ...rest
  } = extra ?? {};
  const resolvedMeta =
    meta && typeof meta === 'object'
      ? meta
      : extra?.requestId
      ? { requestId: extra.requestId }
      : null;
  return res.status(statusCode).json({
    ok: false,
    data: null,
    code: code ?? null,
    message: message ?? null,
    meta: resolvedMeta,
    ...rest,
  });
};
import { withCache, invalidateCacheKeys } from './services/cacheService.js';
import { enqueueJob, registerJobProcessor, hasQueueBackend } from './jobs/taskQueue.js';
import setupNotificationDispatcher from './services/notificationDispatcher.js';
import { validateCourse as validatePublishableCourse } from './lib/courseValidation.js';
import { getSupabaseConfig } from './config/supabaseConfig.js';
import { normalizeModuleLessonPayloads, shouldLogModuleNormalization, coerceTextId } from './lib/moduleLessonNormalizer.js';
import { isSupabaseAuthCreateUserAlreadyExists, isSupabaseAuthCreateUserDatabaseError } from './utils/authHelpers.js';
import { deriveSurveyAssignmentOrgScope } from './utils/surveyAssignmentOrgScope.js';

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
  requireOrgAdmin,
  optionalAuthenticate,
  resolveOrganizationContext,
  invalidateMembershipCache,
  getRequestedOrgId,
} from './middleware/auth.js';
import requireAdminAccess from './middleware/requireAdminAccess.js';
import supabaseJwtMiddleware, {
  SUPABASE_JWT_SECRET_CONFIGURED,
  getSupabaseJwtSecretDiagnostics,
} from './middleware/supabaseJwt.js';
import { setDoubleSubmitCSRF, getCSRFToken, doubleSubmitCSRF } from './middleware/csrf.js';
import adminUsersRouter from './routes/admin-users.js';
import mfaRoutes from './routes/mfa.js';
import { attachRequestId, apiErrorHandler, createHttpError, withHttpError } from './middleware/apiErrorHandler.js';
import adminCoursesRouter from './routes/admin-courses.js';
import {
  NODE_ENV,
  isProduction,
  isDemoMode,
  isTestMode,
  E2E_TEST_MODE,
  FORCE_ORG_ENFORCEMENT,
  demoLoginEnabled,
  describeDemoMode,
  supabaseServerConfigured,
  parseFlag,
  TEST_IDEMPOTENCY_FALLBACK_MODE,
} from './config/runtimeFlags.js';

const isDemoOrTestMode = E2E_TEST_MODE;
const isFallbackMode = isDemoMode || E2E_TEST_MODE || TEST_IDEMPOTENCY_FALLBACK_MODE;
import { sendEmail, configureEmailLogging, getEmailConfigSummary, isEmailEnabled } from './services/emailService.js';
import { createMediaService } from './services/mediaService.js';
import { createNotificationService } from './services/notificationService.js';
import { isJwtSecretConfigured } from './utils/jwt.js';
import { writeErrorDiagnostics, summarizeRequestBody } from './utils/errorDiagnostics.js';
import getUserMemberships, { buildMembershipFilterString } from './utils/memberships.js';
import {
  COURSE_WITH_MODULES_LESSONS_SELECT,
  MODULE_LESSONS_FOREIGN_TABLE,
  COURSE_MODULES_WITH_LESSON_FIELDS,
  COURSE_MODULES_NO_LESSONS_FIELDS,
} from './constants/courseSelect.js';
import { isPlatformAdminActor, canInviteToOrg } from './utils/adminAuthz.js';
import { createOrProvisionOrganizationUser } from './services/userProvisioning.js';
import {
  getMetricsSnapshot,
  recordCourseProgress,
  recordLessonProgress,
  recordProgressBatch,
  recordSupabaseHealth,
} from './diagnostics/metrics.js';
import { buildHdiSurveyTemplate, isHdiAssessment } from './lib/hdiTemplate.js';
import { scoreHdiSubmission } from './lib/hdiScoring.js';
import { buildHdiProfile } from './lib/hdiProfiles.js';
import { buildHdiReport } from './lib/hdiReportBuilder.js';
import { compareHdiReports } from './lib/hdiComparison.js';
import {
  buildHdiParticipantRows,
  buildHdiCohortAnalytics,
  buildHdiComparison,
  toHdiRecord,
} from './lib/hdiAnalytics.js';
import {
  HDI_METADATA_CONTRACT_VERSION,
  normalizeHdiAdministrationType,
  normalizeHdiLinkedAssessmentId,
  buildParticipantIdentity,
  validateHdiSubmissionContract,
} from './lib/hdiContracts.js';
import { createHdiResponseEnvelope, HDI_RESPONSE_SHAPES } from './lib/hdiResponseContracts.js';
// ...existing code...

// Helper to resolve non-UUID course identifiers (e.g., slug) to UUID
async function resolveCourseIdentifierToUuid(identifier) {
  if (!identifier || (!supabase && !isDemoOrTestMode)) return null;
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) return null;
  if (!supabase && isDemoOrTestMode) {
    const direct = e2eStore.courses.get(normalizedIdentifier);
    if (direct && direct.id) {
      return direct.id;
    }
    for (const course of e2eStore.courses.values()) {
      if (course && course.slug && String(course.slug).trim().toLowerCase() === normalizedIdentifier.toLowerCase()) {
        return course.id;
      }
      if (course && course.id && String(course.id).trim() === normalizedIdentifier) {
        return course.id;
      }
    }
    return null;
  }
  try {
    const { data: idMatch, error: idError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', normalizedIdentifier)
      .maybeSingle();
    if (idError) {
      // proceed to slug lookup
    } else if (idMatch && idMatch.id) {
      return idMatch.id;
    }

    const { data: slugMatch, error: slugError } = await supabase
      .from('courses')
      .select('id')
      .eq('slug', normalizedIdentifier)
      .maybeSingle();
    if (slugError) {
      return null;
    }
    return slugMatch?.id ?? null;
  } catch (err) {
    return null;
  }
}

function assertUuid(value) {
  if (!isUuid(value)) {
    throw new Error(`Invalid UUID: ${String(value)}`);
  }
}

function isEmailIdentifier(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized);
}

const resolveUserIdentifierToUuid = async (req, identifier) => {
  if (identifier === null || identifier === undefined) return null;
  const raw = String(identifier).trim();
  if (!raw) return null;
  if (isUuid(raw)) return raw;

  if ((isDemoMode || isTestMode) && Array.isArray(e2eStore.users)) {
    const lower = raw.toLowerCase();
    console.info('[resolveUserIdentifierToUuid] candidate', { raw, isDemoMode, isTestMode, e2eStoreUsers: e2eStore.users.length });
    const found = e2eStore.users.find((user) => {
      if (!user || typeof user !== 'object') return false;
      const candidateId = String(user.id || user.user_id || '').trim();
      const candidateEmail = String(user.email || user.profile?.email || '').trim().toLowerCase();
      const match = candidateId === raw || candidateEmail === lower;
      if (match) {
        console.info('[resolveUserIdentifierToUuid] e2eStore match', { raw, candidateId, candidateEmail, foundId: user.id });
      }
      return match;
    });
    if (found && isUuid(found.id)) {
      console.info('[resolveUserIdentifierToUuid] e2eStore resolved', { raw, foundId: found.id });
      return found.id;
    }
  }

  if (!supabase) return null;

  const lookups = [];
  if (isEmailIdentifier(raw)) {
    lookups.push(async () => await supabase.from('user_profiles').select('id').ilike('email', raw).maybeSingle());
  }
  lookups.push(async () => await supabase.from('user_profiles').select('id').eq('id', raw).maybeSingle());
  for (const field of ['external_id', 'username']) {
    lookups.push(async () => {
      try {
        return await supabase.from('user_profiles').select('id').eq(field, raw).maybeSingle();
      } catch (_) {
        return { data: null, error: null };
      }
    });
  }

  for (const lookup of lookups) {
    try {
      const { data, error } = await lookup();
      if (!error && data && data.id && isUuid(data.id)) {
        return data.id;
      }
    } catch (_err) {
      continue;
    }
  }

  return null;
};

import sql, { pool, getDatabaseConnectionInfo } from './db.js';
// ...existing imports...
import { normalizeMembershipStatus, isMembershipActive, mergeMembershipWithProfile, resolveMembershipStatusUpdate } from './lib/membershipUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[startup] server file path', __filename);

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

if (typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch (error) {
    console.warn('[server] Failed to set DNS default result order', error);
  }
}

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
const databaseConnectionInfo = getDatabaseConnectionInfo();
const databaseHost =
  databaseConnectionInfo.host && databaseConnectionInfo.port
    ? `${databaseConnectionInfo.host}:${databaseConnectionInfo.port}`
    : databaseConnectionInfo.host || null;
const deriveProjectRefFromHost = (host) => {
  if (!host) return null;
  const match = host.match(/^([a-z0-9]{15,})\.supabase\.(?:co|net)$/i);
  return match ? match[1].toLowerCase() : null;
};
const supabaseProjectRef = deriveProjectRefFromHost(supabaseUrlHost);
const databaseProjectRef = databaseConnectionInfo.projectRef ?? null;
const supabaseProjectAlignment =
  supabaseProjectRef && databaseProjectRef
    ? supabaseProjectRef === databaseProjectRef
      ? 'match'
      : 'mismatch'
    : 'partial';
if (supabaseProjectRef && databaseProjectRef && supabaseProjectRef !== databaseProjectRef) {
  console.warn('[env] Supabase URL and database connection appear to reference different project IDs.', {
    supabaseProjectRef,
    databaseProjectRef,
    supabaseHost: supabaseUrlHost,
    databaseHost: databaseConnectionInfo.host ?? null,
    databaseSource: databaseConnectionInfo.sourceEnv ?? null,
  });
}

const schemaHealth = {
  membership: {
    status: 'unknown',
    reason: null,
    checkedAt: null,
  },
};
class ExplicitOrgSelectionRequiredError extends Error {
  constructor(message = 'Explicit organization selection required for this write operation.') {
    super(message);
    this.name = 'ExplicitOrgSelectionRequiredError';
    this.code = 'explicit_org_selection_required';
    this.status = 400;
  }
}
const STRICT_STARTUP_GUARDS = isProduction || parseFlag(process.env.STRICT_STARTUP_GUARDS);
const ALLOW_NON_PERSISTENT_ASSIGNMENTS =
  !isProduction && parseFlag(
    process.env.ALLOW_NON_PERSISTENT_ASSIGNMENTS,
    isDemoMode || isTestMode || E2E_TEST_MODE,
  );
const assignmentPersistenceSimulated =
  isFallbackMode && ALLOW_NON_PERSISTENT_ASSIGNMENTS;
const fallbackTriggerReasons = [
  isDemoMode ? `isDemoMode=true(source=${initialDemoModeMetadata.source || 'unknown'})` : null,
  E2E_TEST_MODE ? 'E2E_TEST_MODE=true' : null,
  TEST_IDEMPOTENCY_FALLBACK_MODE ? 'TEST_IDEMPOTENCY_FALLBACK_MODE=true' : null,
].filter(Boolean);
const startupExecutionMode = isFallbackMode ? 'in-memory-fallback' : 'db-backed';
const ASSIGNMENT_INFRASTRUCTURE_ERROR_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '57P01',
  '57P02',
  '57P03',
  '53300',
  '53400',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'SELF_SIGNED_CERT_IN_CHAIN',
]);

const isInfrastructureUnavailableError = (error) => {
  if (!error) return false;
  const code = String(error?.code || '').trim();
  if (code && ASSIGNMENT_INFRASTRUCTURE_ERROR_CODES.has(code)) {
    return true;
  }
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('connection terminated') ||
    message.includes('connection refused') ||
    message.includes('could not connect') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('self-signed certificate')
  );
};

const isStartupBlockingError = (error) => {
  if (!STRICT_STARTUP_GUARDS) {
    return false;
  }
  return !isInfrastructureUnavailableError(error);
};

function validateCriticalStartupEnv() {
  if (!STRICT_STARTUP_GUARDS) {
    return;
  }
  const requiredEnv = [
    ['SUPABASE_URL'],
    ['SUPABASE_JWT_SECRET'],
    ['JWT_ACCESS_SECRET'],
    ['JWT_REFRESH_SECRET'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_KEY'],
  ];
  const missing = requiredEnv
    .filter((group) => group.every((key) => !String(process.env[key] || '').trim()))
    .map((group) => group.join(' | '));

  if (!databaseConnectionInfo.connectionStringDefined) {
    missing.push('DATABASE_POOLER_URL | SUPABASE_DB_POOLER_URL | SUPABASE_DB_URL | DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(`critical_env_missing:${missing.join(',')}`);
  }
}

function setMembershipSchemaHealth(status, reason = null) {
  schemaHealth.membership = {
    status,
    reason,
    checkedAt: new Date().toISOString(),
  };
  const payload = {
    status,
    reason,
    supabaseHost: supabaseUrlHost,
    dbHost: databaseHost,
  };
  if (status === 'ok') {
    logger.info('membership_schema_status_ok', payload);
  } else {
    logger.warn('membership_schema_status_changed', payload);
  }
}

async function requireCriticalSchema () {
  const failStartup = (reason, extra = {}) => {
    setMembershipSchemaHealth('degraded', reason);
    logger.warn('membership_schema_status_changed', {
      status: 'degraded',
      reason,
      ...extra,
    });
    if (STRICT_STARTUP_GUARDS) {
      throw new Error(reason);
    }
  };

  if (!databaseConnectionInfo.connectionStringDefined) {
    console.warn('[schema] Database connection string missing; skipping critical schema verification.');
    failStartup('database_url_missing');
    return;
  }
  try {
    const rows = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          table_name = 'organization_memberships'
          or table_name = 'user_organizations_vw'
        )
    `;
    const getColumns = (tableName) =>
      rows
        .filter((row) => row.table_name === tableName)
        .map((row) => row.column_name);
    const membershipColumns = getColumns('organization_memberships');
    const membershipRequiredColumns = ['organization_id', 'user_id'];
    const membershipMissing = membershipRequiredColumns.filter((column) => !membershipColumns.includes(column));
    const membershipViewColumns = getColumns('user_organizations_vw');
    const membershipViewRequiredColumns = ['organization_id', 'user_id', 'role', 'status'];
    const membershipViewMissing = membershipViewRequiredColumns.filter((column) => !membershipViewColumns.includes(column));
    const missing = [...membershipMissing, ...membershipViewMissing.map((column) => `user_organizations_vw.${column}`)];
    if (missing.length) {
      failStartup(`Missing columns: ${missing.join(', ')}`, {
        missing,
        dbHost: databaseHost,
      });
      return;
    }

    const indexRows = await sql`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'courses_org_slug_unique_idx',
          'user_course_progress_unique',
          'user_course_progress_pkey',
          'user_lesson_progress_unique',
          'organization_memberships_unique',
          'organization_memberships_unique_organization_id_user_id'
        )
    `;
    const indexNames = new Set(indexRows.map((row) => row.indexname));
    const requiredIndexGroups = [
      ['courses_org_slug_unique_idx'],
      ['user_course_progress_unique', 'user_course_progress_pkey'],
      ['user_lesson_progress_unique'],
      ['organization_memberships_unique', 'organization_memberships_unique_organization_id_user_id'],
    ];
    const missingIndexGroups = requiredIndexGroups.filter((group) => group.every((name) => !indexNames.has(name)));
    if (missingIndexGroups.length > 0) {
      const missingIndexes = missingIndexGroups.map((group) => group.join(' | '));
      failStartup(`Missing critical indexes: ${missingIndexes.join(', ')}`, {
        missingIndexes,
        dbHost: databaseHost,
      });
      return;
    }

    const functionRows = await sql`
      select proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and proname in ('upsert_course_graph')
    `;
    const functionNames = new Set(functionRows.map((row) => row.proname));
    if (!functionNames.has('upsert_course_graph')) {
      failStartup('Missing critical function: upsert_course_graph', {
        dbHost: databaseHost,
      });
      return;
    }
    setMembershipSchemaHealth('ok', null);
  } catch (error) {
    const reason = error?.message || 'schema_check_failed';
    if (!String(reason).startsWith('Missing columns:')) {
      setMembershipSchemaHealth('degraded', reason);
    }
    console.warn('[schema] membership schema degraded', {
      message: error?.message || error,
      dbHost: databaseHost,
    });
    if (isStartupBlockingError(error)) {
      throw error;
    }
  }
}

const runSchemaDoctor = async () => {
  if (!databaseConnectionInfo.connectionStringDefined) {
    logger.warn('schema_doctor_skipped', { reason: 'missing_database_url' });
    return;
  }
  const checks = [
    { table: 'organization_memberships', column: 'organization_id', level: 'error' },
    { table: 'org_invites', column: 'organization_id|org_id', level: 'warn' },
    { table: 'organizations', column: 'id', level: 'error' },
    { table: 'organizations', column: 'name', level: 'warn' },
    { table: 'organizations', column: 'features', level: 'warn' },
    { table: 'user_profiles', column: 'id', level: 'error' },
    { table: 'user_profiles', column: 'email', level: 'warn' },
    { table: 'course_assignments', column: 'updated_at', level: 'warn' },
  ];
  try {
    const rows = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public' and (
        (table_name = 'organization_memberships' and column_name = 'organization_id') or
        (table_name = 'org_invites' and column_name in ('organization_id', 'org_id')) or
        (table_name = 'organizations' and column_name = 'id') or
        (table_name = 'organizations' and column_name = 'name') or
        (table_name = 'organizations' and column_name = 'features') or
        (table_name = 'user_profiles' and column_name = 'id') or
        (table_name = 'user_profiles' and column_name = 'email') or
        (table_name = 'course_assignments' and column_name = 'updated_at')
      )
    `;
    const hasColumn = (table, column) =>
      rows.some((row) => row.table_name === table && row.column_name === column);
    checks.forEach((check) => {
      const acceptableColumns = String(check.column).split('|');
      const matchedColumn = acceptableColumns.find((column) => hasColumn(check.table, column)) || null;
      const ok = Boolean(matchedColumn);
      const payload = {
        table: check.table,
        column: check.column,
        ok,
        ...(matchedColumn ? { matchedColumn } : {}),
      };
      if (ok) {
        logger.info('schema_doctor_check', payload);
      } else if (check.level === 'error') {
        logger.error('schema_doctor_check_failed', payload);
      } else {
        logger.warn('schema_doctor_check_warn', payload);
      }
    });
  } catch (error) {
    logger.error('schema_doctor_unreachable', {
      message: error?.message || String(error),
      code: error?.code || null,
    });
  }
};

const runStorageDoctor = async () => {
  if (!supabaseEnv.configured || !supabase) {
    logger.warn('storage_doctor_skipped', { reason: 'supabase_unavailable' });
    return;
  }
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const bucketNames = (data || []).map((bucket) => bucket.name).filter(Boolean);
    const available = new Set(bucketNames);
    REQUIRED_SUPABASE_BUCKETS.forEach((bucket) => {
      const ok = available.has(bucket);
      const payload = { bucket, ok };
      if (ok) {
        logger.info('storage_bucket_check', payload);
      } else {
        logger.error('storage_bucket_check_failed', payload);
      }
    });
    logger.info('storage_bucket_inventory', {
      count: bucketNames.length,
      buckets: bucketNames,
    });
  } catch (error) {
    logger.error('storage_doctor_unreachable', {
      message: error?.message || String(error),
      code: error?.code || null,
    });
  }
};

const runStartupChecks = async () => {
  validateCriticalStartupEnv();
  try {
    await requireCriticalSchema();
  } catch (error) {
    const reason = error?.message || 'schema_probe_failed';
    setMembershipSchemaHealth('degraded', reason);
    logger.warn('membership_schema_probe_failed', { reason, message: reason });
    if (isStartupBlockingError(error)) {
      throw error;
    }
  }
  await runSchemaDoctor();
};

const startupChecksPromise = runStartupChecks().catch((error) => {
  logger.warn('startup_schema_checks_failed', {
    message: error?.message || String(error),
    startupBlocking: isStartupBlockingError(error),
  });
  if (isStartupBlockingError(error)) {
    throw error;
  }
});

// Persistent storage file for demo mode
const STORAGE_FILE = path.join(__dirname, 'demo-data.json');
const COURSE_IMPORT_TEMPLATE_PATH = path.join(__dirname, '../docs/course-import-template.json');
// Safety guard to avoid loading extremely large demo files that could trigger OOM (exit 137)
const MAX_DEMO_FILE_BYTES = parseInt(process.env.DEMO_DATA_MAX_BYTES || '', 10) || 25 * 1024 * 1024; // 25MB default

logger.info('demo_mode_configuration', { metadata: initialDemoModeMetadata });
logger.info('startup_supabase_config', {
  supabaseConfigured: supabaseEnv.configured,
  devFallback: Boolean(isDemoMode),
  demoMode: initialDemoModeMetadata.enabled ? initialDemoModeMetadata.source || 'enabled' : 'disabled',
  supabaseUrlHost,
  supabaseProjectRef,
  databaseProjectRef,
  projectAlignment: supabaseProjectAlignment,
  serviceRoleKeyPresent: Boolean(supabaseEnv.serviceRoleKey),
});
logger.info('startup_runtime_mode', {
  mode: startupExecutionMode,
  surveyAssignmentPersistence: assignmentPersistenceSimulated ? 'simulated' : 'real',
  fallbackTriggers: fallbackTriggerReasons,
  // Explicitly expose the decision path so test-mode startup is auditable.
  decisionPath: {
    nodeEnv: NODE_ENV || process.env.NODE_ENV || 'development',
    isDemoMode,
    e2eTestMode: E2E_TEST_MODE,
    testIdempotencyFallbackMode: TEST_IDEMPOTENCY_FALLBACK_MODE,
    allowNonPersistentAssignments: ALLOW_NON_PERSISTENT_ASSIGNMENTS,
  },
});
if (isFallbackMode) {
  console.log(
    `[startup] in-memory fallback mode | survey assignment persistence: ${assignmentPersistenceSimulated ? 'simulated' : 'real-db'}`,
  );
} else {
  console.log('[startup] DB-backed mode | survey assignment persistence: real-db');
}
if (supabaseEnv.configured && isDemoMode) {
  logger.warn('dev_fallback_overrides_supabase', {
    message: 'Supabase credentials detected but isDemoMode=true forces in-memory demo mode.',
  });
}

const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const cookiePolicySnapshot = describeCookiePolicy();
log('info', 'http_cookie_policy', cookiePolicySnapshot);
const inferredCookieDomain = process.env.COOKIE_DOMAIN || cookiePolicySnapshot.domain || '(request hostname derived)';
const cookieSameSite = cookiePolicySnapshot.sameSite;
const cookieSecure = cookiePolicySnapshot.secure;

// Confirm Supabase JWT secret status at startup using the same value the
// JWT middleware captured at module-load time (SUPABASE_JWT_SECRET_CONFIGURED).
// Never log the secret value itself.
if (!SUPABASE_JWT_SECRET_CONFIGURED) {
  logger.error('startup_supabase_jwt_secret_missing', {
    message: 'SUPABASE_JWT_SECRET is not set or is still a placeholder. All authenticated API requests will fail with 401. ' +
      'Set it in Railway → Project → Variables from Supabase Dashboard → Settings → API → JWT Settings. Then REDEPLOY.',
    envKeyName: 'SUPABASE_JWT_SECRET',
    isPlaceholder: (process.env.SUPABASE_JWT_SECRET || '').startsWith('PASTE_'),
    isEmpty: !(process.env.SUPABASE_JWT_SECRET || '').trim(),
  });
}

logger.info('startup_env_diagnostics', {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 8888,
  supabaseConfigured: supabaseEnv.configured,
  supabaseUrlHost,
  supabaseProjectRef,
  databaseProjectRef,
  projectAlignment: supabaseProjectAlignment,
  appJwtSecretConfigured: isJwtSecretConfigured,
  supabaseJwtSecretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
  cookie: {
    domain: inferredCookieDomain,
    sameSite: cookieSameSite,
    secure: cookieSecure,
  },
  corsOrigins,
});

logger.info('startup_supabase_jwt_secret_state', {
  ...getSupabaseJwtSecretDiagnostics(),
});

const STORAGE_BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const resolveStorageBucketName = ({ envKey, fallback }) => {
  const rawValue = typeof process.env[envKey] === 'string' ? process.env[envKey].trim() : '';
  if (!rawValue) return fallback;
  if (STORAGE_BUCKET_NAME_PATTERN.test(rawValue)) return rawValue;

  logger.warn('storage_bucket_env_invalid', {
    envKey,
    invalidValue: rawValue,
    fallbackBucket: fallback,
  });
  return fallback;
};

const DOCUMENTS_BUCKET = resolveStorageBucketName({
  envKey: 'SUPABASE_DOCUMENTS_BUCKET',
  fallback: 'course-resources',
});
const DOCUMENT_UPLOAD_MAX_BYTES = Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 150 * 1024 * 1024);
const DOCUMENT_URL_TTL_SECONDS = Number(process.env.DOCUMENT_SIGN_TTL_SECONDS || 60 * 60 * 24 * 7);
const DOCUMENT_URL_REFRESH_BUFFER_SECONDS = Number(process.env.DOCUMENT_URL_REFRESH_BUFFER_SECONDS || 60 * 5);
const DOCUMENT_URL_REFRESH_BUFFER_MS = DOCUMENT_URL_REFRESH_BUFFER_SECONDS * 1000;
const COURSE_VIDEOS_BUCKET = resolveStorageBucketName({
  envKey: 'SUPABASE_VIDEOS_BUCKET',
  fallback: 'course-videos',
});
const COURSE_VIDEO_UPLOAD_MAX_BYTES = Number(process.env.COURSE_VIDEO_UPLOAD_MAX_BYTES || 750 * 1024 * 1024);
const REQUIRED_SUPABASE_BUCKETS = Array.from(new Set([COURSE_VIDEOS_BUCKET, DOCUMENTS_BUCKET].filter(Boolean)));

logger.info('startup_storage_config', {
  documentsBucket: DOCUMENTS_BUCKET,
  courseVideosBucket: COURSE_VIDEOS_BUCKET,
  requiredBuckets: REQUIRED_SUPABASE_BUCKETS,
});

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

const isVideoTooLargeError = (error) => {
  if (!error) return false;
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return true;
  }
  const status = Number(error.statusCode ?? error.status ?? 0);
  if (status === 413) {
    return true;
  }
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('exceeded the maximum allowed size') || message.includes('payload too large');
};

const sendVideoTooLargeResponse = (res, source = 'upload') => {
  const maxBytes = Number.isFinite(COURSE_VIDEO_UPLOAD_MAX_BYTES)
    ? COURSE_VIDEO_UPLOAD_MAX_BYTES
    : 50 * 1024 * 1024;
  const maxMegabytes = Math.round(maxBytes / (1024 * 1024));
  res.status(413).json({
    error: 'video_too_large',
    code: 'video_too_large',
    message: `Video exceeds the size limit (${maxMegabytes}MB). Upload a smaller file or use an external URL.`,
    maxBytes,
    meta: {
      source,
      maxBytes,
    },
  });
};

const parseVideoUpload = (req, res, next) => {
  videoUpload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (isVideoTooLargeError(error)) {
      sendVideoTooLargeResponse(res, error instanceof multer.MulterError ? 'multer' : 'request');
      return;
    }

    console.error('[course-videos] Invalid upload request payload:', error);
    res.status(400).json({
      error: 'invalid_video_upload',
      code: 'invalid_video_upload',
      message: 'Unable to process video upload payload.',
    });
  });
};

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
    // Convert Maps to arrays for JSON serialization, stripping E2E/test courses at
    // write time so they can never accumulate in demo-data.json across test runs.
    // isE2ECourseEntry is defined later in the file; use a safe inline guard here.
    const isE2EId = (id) =>
      typeof id === 'string' && (
        /^e2e-course-/i.test(id) ||
        /\be2e\b/i.test(id) ||
        /\bintegration[_\s-]?test\b/i.test(id) ||
        /\bplaywright\b/i.test(id) ||
        /\bcypress\b/i.test(id) ||
        /^test[-_\s]/i.test(id) ||
        /__test__/i.test(id) ||
        /_e2e_/i.test(id)
      );
    const isE2ECourse = (course) => {
      if (!course) return false;
      if (course.isTestData === true || course.is_test_data === true) return true;
      if (course.meta_json?.isTestData === true) return true;
      return [course.id, course.title, course.slug].some(isE2EId);
    };
    const filteredCourseEntries = Array.from(data.courses.entries())
      .filter(([, course]) => !isE2ECourse(course));
    const serializable = {
      courses: filteredCourseEntries,
      surveys: Array.from((data.surveys || new Map()).entries()),
      surveyAssignments: Array.from((data.surveyAssignments || new Map()).entries()),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(serializable, null, 2), 'utf8');
    const strippedCount = data.courses.size - filteredCourseEntries.length;
    if (strippedCount > 0) {
      logger.info('demo_data_e2e_courses_stripped_on_save', { strippedCount });
    }
    logger.info('demo_data_persisted', { courseCount: filteredCourseEntries.length, storageFile: STORAGE_FILE });
  } catch (error) {
    logger.error('demo_data_save_failed', { error: error instanceof Error ? error.message : error });
  }
}

const app = express();
console.log('[startup] Express app created');
app.locals.schemaHealth = schemaHealth;
app.set('etag', false);
// CORS must run first — before any route handler — so that 401/403 responses
// from authenticate() always include the correct Access-Control-Allow-Origin header.
// Previously corsMiddleware was registered at line ~1643 (after early routes),
// which meant browsers received CORS-less 401 responses and reported them as
// network errors instead of auth errors.
app.use(corsMiddleware);
console.log('[startup] CORS middleware registered');

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(attachRequestId);

// ---------------------------------------------------------------------------
// API Response Normalizer — ensures every /api/* response includes the
// standardized envelope: { ok, data, code, message, meta }.
// Legacy fields are preserved for backward compatibility.
// ---------------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  const originalJson = res.json.bind(res);

  const isPlainObject = (value) =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const hasContractShape = (value) =>
    isPlainObject(value) &&
    ['ok', 'data', 'code', 'message', 'meta'].every((key) => Object.prototype.hasOwnProperty.call(value, key));

  const inferData = (source, ok) => {
    if (!isPlainObject(source)) {
      return source ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'data')) return source.data;
    if (Object.prototype.hasOwnProperty.call(source, 'payload')) return source.payload;
    if (Object.prototype.hasOwnProperty.call(source, 'result')) return source.result;
    if (Object.prototype.hasOwnProperty.call(source, 'results')) return source.results;
    if (Object.prototype.hasOwnProperty.call(source, 'items')) return source.items;
    if (Object.prototype.hasOwnProperty.call(source, 'users')) return source.users;
    if (Object.prototype.hasOwnProperty.call(source, 'courses')) return source.courses;
    if (!ok) return null;

    const keys = Object.keys(source).filter((key) => !['ok', 'code', 'message', 'meta', 'requestId'].includes(key));
    if (keys.length === 1) {
      return source[keys[0]];
    }
    return null;
  };

  const inferCode = (source, ok) => {
    if (isPlainObject(source)) {
      if (typeof source.code === 'string' && source.code.trim()) return source.code;
      if (typeof source.error_code === 'string' && source.error_code.trim()) return source.error_code;
      if (!ok && typeof source.error === 'string' && source.error.trim()) return source.error;
    }
    return ok ? null : 'request_failed';
  };

  const inferMessage = (source, ok) => {
    if (isPlainObject(source)) {
      if (typeof source.message === 'string' && source.message.trim()) return source.message;
      if (!ok && typeof source.error === 'string' && source.error.trim()) return source.error;
    }
    return null;
  };

  const inferMeta = (source) => {
    if (isPlainObject(source) && isPlainObject(source.meta)) {
      return source.meta;
    }
    if (isPlainObject(source) && source.requestId) {
      return { requestId: source.requestId };
    }
    return null;
  };

  res.json = function normalizedJson(body) {
    if (hasContractShape(body)) {
      return originalJson(body);
    }

    const statusCode = res.statusCode || 200;
    const ok = isPlainObject(body) && typeof body.ok === 'boolean' ? body.ok : statusCode < 400;
    const data = inferData(body, ok);
    const code = inferCode(body, ok);
    const message = inferMessage(body, ok);
    const meta = inferMeta(body);

    const normalized = isPlainObject(body)
      ? {
          ...body,
          ok,
          data,
          code,
          message,
          meta,
        }
      : {
          ok,
          data,
          code,
          message,
          meta,
        };

    return originalJson(normalized);
  };
  next();
});

// Guard against unsafe header-based overrides in production.
// These headers (X-User-Role, X-Org-Id, X-Organization-Id, X-User-Id) were
// used as auth bypass mechanisms in dev/demo mode. In production they are
// informational/audit headers sent by the client alongside a real Bearer token.
// Only block them when NO Authorization header is present — i.e. when they
// would be the sole basis for authentication, which is the actual attack vector.
app.use((req, res, next) => {
  if (
    isProduction &&
    !req.headers['authorization'] &&
    (req.headers['x-user-role'] || req.headers['x-org-id'] || req.headers['x-organization-id'])
  ) {
    return res.status(400).json({
      error: 'header_override_forbidden',
      message: 'Request header overrides are not permitted in production',
    });
  }
  next();
});
console.log('[startup] JSON middleware registered before routes');

import healthRouter from './routes/health.js';
import corsMiddleware, { resolveCorsOriginDecision, resolvedCorsOrigins, corsAllowedHeaders } from './middleware/cors.js';
import { describeCookiePolicy, getActiveOrgFromRequest } from './utils/authCookies.js';
import { env } from './utils/env.js';
import { log } from './utils/logger.js';
import { handleError } from './utils/errorHandler.js';
import {
  isMissingColumnError,
  isMissingRelationError,
  isMissingFunctionError,
  isMembershipConflictTargetError,
  normalizeColumnIdentifier,
  extractMissingColumnName,
} from './utils/errors.js';
import { buildOrgInviteInsertAttemptPayloads } from './utils/orgInvites.js';
import { validateOrgId, logInviteInsertAttempt } from './lib/inviteHelper.js';

const fsp = fs.promises;
const PROGRESS_BATCH_MAX_SIZE = Number(process.env.PROGRESS_BATCH_MAX_SIZE || 100);
const PROGRESS_BATCH_MAX_BYTES = Number(process.env.PROGRESS_BATCH_MAX_BYTES || 256 * 1024);
const HEALTH_STREAM_INTERVAL_MS = Number(process.env.HEALTH_STREAM_INTERVAL_MS || 5000);
const HEALTH_STREAM_RETRY_MS = Number(process.env.HEALTH_STREAM_RETRY_MS || 5000);
const HEALTH_STREAM_HEARTBEAT_MS = Number(process.env.HEALTH_STREAM_HEARTBEAT_MS || 15000);
const ANALYTICS_PII_SALT = process.env.ANALYTICS_PII_SALT || 'analytics-salt';
const shouldLogAuthDebug =
  process.env.AUTH_DEBUG === 'true' ||
  process.env.LOG_AUTH_DEBUG === 'true' ||
  process.env.DEBUG_AUTH === 'true';
const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'org_admin', 'organization_admin', 'super_admin']);
const hasOrgAdminRole = (role) => ORG_ADMIN_ROLES.has(String(role || '').toLowerCase());
const ENABLE_NOTIFICATIONS =
  (process.env.ENABLE_NOTIFICATIONS ?? '')
    .toString()
    .trim()
    .toLowerCase() !== 'false';
const PRIMARY_ADMIN_EMAIL = String(process.env.PRIMARY_ADMIN_EMAIL || 'mya@the-huddle.co')
  .trim()
  .toLowerCase();
const FEEDBACK_ADMIN_EMAILS_ENV = String(process.env.FEEDBACK_ADMIN_EMAILS || '').trim();
const normalizeUnknownError = (error) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : JSON.stringify(error),
  };
};
const emitConsolePayload = (label, payload) => {
  try {
    console.warn(label, payload);
  } catch (_error) {
    // no-op
  }
};
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

log('info', 'http_cors_policy', {
  allowedOrigins: resolvedCorsOrigins,
  allowCredentials: true,
  allowedHeaders: corsAllowedHeaders,
});

app.get('/api/admin/courses/health/upsert-course-rpc', authenticate, requireAdmin, async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || null;
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  let rpcExists = null;
  let rpcError = null;

  if (!databaseConnectionInfo.connectionStringDefined) {
    rpcError = 'database_url_not_configured';
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

const normalizeHealthStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized === 'healthy') return 'ok';
  if (normalized === 'warn') return 'degraded';
  return normalized;
};

const mapHealthStatusToAlertLevel = (status) => {
  const normalized = normalizeHealthStatus(status);
  if (normalized === 'error') return 'critical';
  if (['degraded', 'disabled', 'unknown'].includes(normalized)) return 'warning';
  return 'info';
};

const buildHealthSignal = ({
  payload,
  dbHealth,
  forceHealthyForDev,
  requestId = null,
} = {}) => {
  const checks = [
    {
      component: 'database',
      status: normalizeHealthStatus(dbHealth?.status),
      code: dbHealth?.code ?? null,
      message: dbHealth?.message ?? dbHealth?.note ?? null,
    },
    {
      component: 'supabase',
      status: normalizeHealthStatus(payload?.supabase?.status),
      code: payload?.supabase?.code ?? null,
      message: payload?.supabase?.message ?? null,
    },
    {
      component: 'offlineQueue',
      status: normalizeHealthStatus(payload?.offlineQueue?.status),
      code: null,
      message: null,
    },
    {
      component: 'storage',
      status: normalizeHealthStatus(payload?.storage?.status),
      code: payload?.storage?.code ?? null,
      message: payload?.storage?.message ?? null,
    },
    {
      component: 'realtime',
      status: payload?.realtime?.wsEnabled ? 'ok' : 'degraded',
      code: payload?.realtime?.wsError ? 'ws_unavailable' : null,
      message: payload?.realtime?.wsError ?? null,
    },
  ].map((entry) => ({
    ...entry,
    alertLevel: mapHealthStatusToAlertLevel(entry.status),
  }));

  const probeStatus = normalizeHealthStatus(payload?.status);
  const forcedHealthy = Boolean(forceHealthyForDev && probeStatus === 'error');
  const effectiveStatus = forcedHealthy ? 'degraded_tolerated' : probeStatus;
  const alertLevel = forcedHealthy ? 'warning' : mapHealthStatusToAlertLevel(probeStatus);
  const reasons = checks
    .filter((check) => check.status !== 'ok')
    .map((check) => `${check.component}:${check.status}`);

  return {
    probeStatus,
    effectiveStatus,
    alertLevel,
    forcedHealthy,
    reasons,
    checks,
    requestId,
  };
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
      devFallback: Boolean(isDemoMode),
      // This reflects the VALUE AT STARTUP — not the current env — because supabaseJwt.js
      // captures SUPABASE_JWT_SECRET into a module-level const at import time.
      // If this is false after you set the env var in Railway, you need to REDEPLOY.
      supabaseJwtSecretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
    },
    runtime: {
      mode: startupExecutionMode,
      fallbackTriggers: fallbackTriggerReasons,
      surveyAssignmentPersistence: assignmentPersistenceSimulated ? 'simulated' : 'real',
    },
    orgEnforcement: {
      enforced: Boolean(FORCE_ORG_ENFORCEMENT),
      devFallback: Boolean(isDemoMode),
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

const resolveAppVersion = () =>
  process.env.APP_VERSION ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.RAILWAY_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GIT_SHA ||
  process.env.HEROKU_RELEASE_VERSION ||
  'dev';

const probeDatabaseHealth = async ({ requireWritable = true } = {}) => {
  if (!databaseConnectionInfo.connectionStringDefined) {
    return {
      ok: false,
      status: 'disabled',
      code: 'database_url_missing',
      message: 'Database connection string is not configured.',
      host: databaseHost,
      sourceEnv: databaseConnectionInfo.sourceEnv ?? null,
    };
  }
  const startedAt = Date.now();
  let client = null;
  try {
    client = await pool.connect();
    await client.query('select 1');

    let writable = true;
    if (requireWritable) {
      await client.query('begin');
      try {
        await client.query('create temp table if not exists health_write_probe (id integer) on commit drop');
        await client.query('insert into health_write_probe(id) values (1)');
      } finally {
        await client.query('rollback');
      }
    } else {
      writable = false;
    }

    return {
      ok: true,
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      writable,
      host: databaseHost,
      sourceEnv: databaseConnectionInfo.sourceEnv ?? null,
    };
  } catch (error) {
    const message = error?.message || String(error);
    const code = error?.code || null;
    const sslSelfSigned =
      code === 'SELF_SIGNED_CERT_IN_CHAIN' || /self-?signed certificate/i.test(message || '');

  // If the DB layer is configured to allow self-signed certs (dev/E2E),
  // consider self-signed certificate errors tolerated so local health checks
  // and test harnesses don't fail. We still surface the original error
  // message in the payload for visibility.
  if (import.meta?.env?.DEV || process.env.NODE_ENV !== 'production') {
    console.warn('[health] probeDatabaseHealth caught DB error', { code, message, allowSelfSigned: databaseConnectionInfo?.allowSelfSigned });
  }
  if (sslSelfSigned && !isProduction && databaseConnectionInfo?.allowSelfSigned) {
      return {
        ok: true,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        writable: false,
        host: databaseHost,
        sourceEnv: databaseConnectionInfo.sourceEnv ?? null,
        toleratedSelfSigned: true,
        note: 'self-signed certificate in chain tolerated for dev/E2E',
        original: { code, message },
      };
    }

    return {
      ok: false,
      status: 'error',
      code: code ?? 'db_unavailable',
      message: message ?? 'Database connection unavailable.',
      writable: false,
      host: databaseHost,
      sourceEnv: databaseConnectionInfo.sourceEnv ?? null,
    };
  } finally {
    try {
      client?.release();
    } catch {
      // no-op
    }
  }
};

const respondWithHealthPayload = async (_req, res) => {
  try {
    const dbHealth = await probeDatabaseHealth();
    const overrides = { database: dbHealth };
    if (!dbHealth.ok || dbHealth.writable === false) {
      const dbStatus = normalizeHealthStatus(dbHealth.status);
      overrides.status = dbStatus === 'error' || dbStatus === 'disabled' ? 'error' : 'degraded';
    }
    const payload = await buildHealthPayload(overrides);
    // In local/dev/e2e modes we prefer the health endpoint to remain HTTP 200
    // so test harnesses and UI connectivity checks can still inspect the
    // payload even when the database probe reports degraded. The payload
    // will still contain the real database status under `database`.
  const isDevEnv = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const forceHealthyForDev = Boolean(isDevEnv || isDemoMode || isTestMode);
  const probeStatus = normalizeHealthStatus(payload.status);
  const isCriticalProbe = probeStatus === 'error';
  const statusCode = isCriticalProbe && !forceHealthyForDev ? 503 : 200;
  const returnedOk = Boolean(!isCriticalProbe || forceHealthyForDev);
  const healthSignal = buildHealthSignal({
    payload,
    dbHealth,
    forceHealthyForDev,
    requestId: _req?.requestId ?? null,
  });
    // If we're forcing healthy for dev/E2E, surface the real DB details but
    // report overall ok=true to avoid blocking test harnesses. Keep database
    // payload intact so callers can still inspect the real condition.
    res.status(statusCode).json({
      ok: returnedOk,
      timestamp: new Date().toISOString(),
      version: resolveAppVersion(),
      status: payload.status,
      supabase: payload.supabase,
      offlineQueue: payload.offlineQueue,
      storage: payload.storage,
      realtime: payload.realtime,
      metrics: payload.metrics,
      database: payload.database ?? dbHealth,
      featureFlags: payload.featureFlags,
      healthSignal,
    });
  } catch (error) {
    logger.warn('health_check_failed', { message: error?.message || String(error), code: error?.code || null });
    res.status(500).json({
      ok: false,
      code: error?.code ?? 'health_check_failed',
      message: error?.message ?? 'Unable to verify system health.',
      timestamp: new Date().toISOString(),
    });
  }
};

app.post('/api/admin/courses/:id/assign', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const assignmentFallbackEnabled = shouldUseAssignmentWriteFallback();
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    sendApiError(res, 404, 'course_not_found', `Course not found for identifier ${id}`, {
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }
  const courseId = resolvedCourseId;
  const body = normalizeLegacyOrgInput(req.body ?? {}, {
    surface: 'admin.courses.assign',
    requestId: req.requestId,
  });

  // If the client provided an org id via headers (common in E2E helpers), inject
  // it into the normalized body so the rest of the handler resolves it reliably.
  try {
    const headerOrg = req.headers['x-org-id'] || req.headers['x-organization-id'];
    const maybeHeaderValue = Array.isArray(headerOrg) ? headerOrg[0] : headerOrg;
    if (maybeHeaderValue && (!body || !body.organization_id) && !body?.organization) {
      const headerValStr = String(maybeHeaderValue).trim();
      if (headerValStr) {
        body.organization_id = headerValStr;
        body.organizationId = headerValStr;
        body.orgId = headerValStr;
        console.info('[assign] injected org id from header into body', { headerValStr, requestId: req.requestId ?? null });
      }
    }
  } catch (_) {}

  // Compute finalOrganizationId up-front in a safe, deterministic way.
  // Probe common locations: top-level keys, nested organization object, headers, and query.
  let finalOrganizationId = null;
  // If the request explicitly provided a top-level organization identifier, trust it.
  try {
    const directOrg = body && (body.organization_id || body.organizationId || body.orgId || body.org_id);
    if (directOrg) {
      finalOrganizationId = String(directOrg).trim();
      console.info('[assign] using direct top-level org from body', { finalOrganizationId, requestId: req.requestId ?? null });
    }
  } catch (_) {}
  try {
    finalOrganizationId = pickOrgId(
      body.organization_id,
      body.organizationId,
      body.orgId,
      body.org_id,
      body.organization && body.organization.id,
      body.organization && body.organization.organization_id,
      body.organization && body.organization.organizationId,
      req.headers['x-org-id'],
      req.headers['x-organization-id'],
      req.query && (req.query.organization_id || req.query.organizationId || req.query.orgId),
    );
  } catch (err) {
    try {
      console.warn('[assign] org id probe failed', { err: err?.message || String(err), requestId: req.requestId ?? null });
    } catch (_) {}
  }

  // Force demo sandbox org in explicit demo mode as a last-resort (demo-only bypass)
  // This ensures demo helpers that rely on sandbox org can run even if org resolution fails.
  if (!finalOrganizationId && isDemoOrTestMode) {
     finalOrganizationId = DEFAULT_SANDBOX_ORG_ID;
     console.info('[assign][demo] forcing sandbox org for demo mode', { finalOrganizationId, requestId: req.requestId ?? null });
  }

  console.info('[assign] initial org debug', {
    resolvedCandidate: finalOrganizationId,
    isTestMode: !!isTestMode,
    isDemoMode: !!isDemoMode,
    isProduction: !!isProduction,
    DEFAULT_SANDBOX_ORG_ID,
    requestId: req.requestId ?? null,
  });

  // Normalize police for alias/slug org IDs (e.g., demo-sandbox-org) before DB writes.
  try {
    const resolvedOrg = await coerceOrgIdentifierToUuid(req, finalOrganizationId);
    if (resolvedOrg) {
      finalOrganizationId = resolvedOrg;
      console.info('[assign] resolved org id to canonical UUID', { finalOrganizationId, requestId: req.requestId ?? null });
    }
  } catch (err) {
    console.warn('[assign] failed to resolve org identifier', { error: err?.message || String(err), requestId: req.requestId ?? null });
  }

  // Additional strict header fallback: if client included an x-org-id/header and the
  // request is coming from an admin header (test helpers), accept it directly.
  if (!finalOrganizationId) {
    try {
      const headerOrgStrict = req.headers['x-org-id'] || req.headers['x-organization-id'];
      if (headerOrgStrict) {
        finalOrganizationId = Array.isArray(headerOrgStrict) ? String(headerOrgStrict[0]).trim() : String(headerOrgStrict).trim();
        console.info('[assign] using strict headerOrgStrict fallback', { headerOrgStrict: finalOrganizationId, requestId: req.requestId ?? null });
      }
    } catch (_) {}
  }

  // If not found, allow demo/E2E/local/admin header fallbacks to use the sandbox org id.
  if (!finalOrganizationId) {
    const userRoleHeader = String(req.headers['x-user-role'] || '').toLowerCase();
    const hostHeader = String(req.headers.host || '');
    const remoteIp = String(req.ip || req.connection?.remoteAddress || '');
    const looksLocal = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1') || remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp.startsWith('::ffff:127.');

    if (!isProduction && (isDemoOrTestMode || userRoleHeader === 'admin' || looksLocal)) {
      finalOrganizationId = DEFAULT_SANDBOX_ORG_ID;
      console.info('[assign] using DEFAULT_SANDBOX_ORG_ID for demo/E2E/admin-header/localhost fallback', { finalOrganizationId, requestId: req.requestId ?? null, remoteIp, hostHeader });
    } else {
      res.locals = res.locals || {};
      res.locals.errorCode = 'organization_required';
      try {
        console.error('[assign][ERR] organization_id missing', {
          requestId: req.requestId ?? null,
          headers: req.headers,
          sampleBody: typeof req.body === 'object' ? JSON.stringify(req.body).slice(0, 2000) : String(req.body),
          finalOrganizationId: finalOrganizationId ?? null,
        });
      } catch (_) {}
      res.status(400).json({ error: 'organization_id is required' });
      return;
    }
  }
  // Ensure the resolved organization identifier is a UUID.
  if ((!finalOrganizationId || !isUuid(finalOrganizationId)) && !isDemoOrTestMode) {
    try {
      const coerced = await coerceOrgIdentifierToUuid(req, finalOrganizationId);
      if (coerced && isUuid(coerced)) {
        finalOrganizationId = coerced;
      }
    } catch (_) {
      // ignore, validation below will handle
    }
  }

  if ((!finalOrganizationId || !isUuid(finalOrganizationId)) && !isDemoOrTestMode) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'invalid_organization_id';
    console.error('[assign][ERR] organization_id invalid', { finalOrganizationId, requestId: req.requestId ?? null });
    res.status(400).json({ error: 'invalid_organization_id', message: 'organization_id must be a valid UUID.' });
    return;
  }

  if (!isDemoOrTestMode) {
    try {
      assertUuid(finalOrganizationId);
    } catch (error) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'invalid_organization_id';
      res.status(400).json({ error: 'invalid_organization_id', message: error.message || 'organization_id must be a valid UUID.' });
      return;
    }
  }

  // continuing normal flow; finalOrganizationId has been resolved above (or fallback applied)
  const hasBodyKey = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const rawUserIds = Array.isArray(body.user_ids)
    ? body.user_ids
    : Array.isArray(body.userIds)
      ? body.userIds
      : Array.isArray(body.assignedTo?.user_ids)
        ? body.assignedTo.user_ids
        : Array.isArray(body.assignedTo?.userIds)
          ? body.assignedTo.userIds
          : [];

  const resolvedUserIdSet = new Set();
  const unresolvedUserIdSet = new Set();

  for (const value of rawUserIds) {
    if (value === null || value === undefined) {
      continue;
    }
    const candidate = String(value).trim();
    if (!candidate) {
      continue;
    }

    console.info('[assign] resolve candidate', { candidate, requestId: req.requestId ?? null });

    if (isUuid(candidate)) {
      resolvedUserIdSet.add(candidate);
      continue;
    }

    try {
      const resolvedUserId = await resolveUserIdentifierToUuid(req, candidate);
      console.info('[assign] resolved user id', { candidate, resolvedUserId, requestId: req.requestId ?? null });
      if (resolvedUserId && isUuid(resolvedUserId)) {
        resolvedUserIdSet.add(resolvedUserId);
      } else {
        unresolvedUserIdSet.add(candidate);
      }
    } catch (err) {
      console.warn('[assign] resolveUserIdentifierToUuid failed', { candidate, error: err?.message || String(err), requestId: req.requestId ?? null });
      unresolvedUserIdSet.add(candidate);
    }
  }

  const normalizedUserIds = Array.from(resolvedUserIdSet);
  const invalidTargetIds = Array.from(new Set([...(unresolvedUserIdSet || [])]));

  if (unresolvedUserIdSet.size > 0) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'invalid_user_ids';
    console.warn('[assign] invalid_user_ids path', {
      rawUserIds,
      normalizedUserIds,
      unresolvedUserIds: Array.from(unresolvedUserIdSet),
      requestId: req.requestId ?? null,
    });
    res.status(400).json({
      error: 'invalid_user_ids',
      message: 'Some provided user_ids could not be resolved to UUIDs.',
      invalidUserIds: Array.from(unresolvedUserIdSet),
    });
    return;
  }

  const assignmentMode = body.mode === 'organization' ? 'organization' : normalizedUserIds.length > 0 ? 'learners' : 'organization';

  // ...existing code...

  const context = requireUserContext(req, res);
  if (!context) return;
  // Always enforce org access — demo/test mode uses the demo org UUID, not a bypass.
  const access = await requireOrgAccess(req, res, finalOrganizationId, { write: true, requireOrgAdmin: true });
  if (!access) return;
  const organizationIds = finalOrganizationId ? [finalOrganizationId] : [];
  const assignLogMeta = {
    requestId: req.requestId ?? null,
    userId: context.userId ?? null,
    courseId: courseId,
    orgId: finalOrganizationId,
  };
  const assignmentLogBase = {
    courseId: courseId,
    organizationIds,
    organizationCount: organizationIds.length,
    userCount: normalizedUserIds.length,
    invalidTargetIds,
    requestId: req.requestId ?? null,
  };
  logger.info('course_assignment_attempted', {
    ...assignmentLogBase,
    fallbackEnabled: assignmentFallbackEnabled,
  });
  let assignmentInsertedCount = 0;
  let assignmentUpdatedCount = 0;
  let assignmentSkippedCount = 0;
  logCourseRequestEvent('admin.courses.assign.start', assignLogMeta);
  res.once('finish', () => {
    logCourseRequestEvent('admin.courses.assign.finish', {
      ...assignLogMeta,
      status: res.statusCode ?? null,
      errorCode: res.locals?.errorCode ?? null,
    });
  });

  const dueProvided = hasBodyKey('due_at') || hasBodyKey('dueAt');
  const rawDueAt = body.due_at ?? body.dueAt ?? null;
  const dueAtValue = dueProvided ? (rawDueAt ? String(rawDueAt) : null) : null;

  const noteProvided = hasBodyKey('note');
  const rawNote = body.note ?? null;
  const noteValue = noteProvided ? (typeof rawNote === 'string' ? rawNote : rawNote === null ? null : String(rawNote)) : null;

  const assignedByRaw = body.assigned_by ?? body.assignedBy;
  let assignedBy = typeof assignedByRaw === 'string' && assignedByRaw.trim().length > 0
    ? assignedByRaw.trim()
    : context.userId;

  if (assignedBy && !isUuid(assignedBy)) {
    try {
      const resolvedAssignedBy = await resolveUserIdentifierToUuid(req, assignedBy);
      if (resolvedAssignedBy && isUuid(resolvedAssignedBy)) {
        assignedBy = resolvedAssignedBy;
      } else {
        assignedBy = null;
      }
    } catch (_) {
      assignedBy = null;
    }
  }

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

  const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
  const assignmentsOrgColumn = await getAssignmentsOrgColumnName();

  const buildRecord = (userId) => {
    const record = {
      course_id: courseId,
      user_id: userId,
      assigned_by: assignedBy ?? null,
      status: statusValue,
      progress: progressValue ?? 0,
      metadata,
      idempotency_key: assignmentIdempotencyKey,
      client_request_id: clientRequestId,
      active: true,
      due_at: dueAtValue ?? null,
      note: noteValue ?? null,
    };
    if (assignmentsSupportUserIdUuid) {
      record.user_id_uuid = userId ?? null;
    }
    record[assignmentsOrgColumn] = finalOrganizationId;
    return record;
  };

  let targetUserIds = normalizedUserIds.length > 0 ? [...normalizedUserIds] : [];
  const shouldCreateOrgLevelAssignment = assignmentMode === 'organization';
  let assignmentIdempotencyKey = null;
  const buildAssignmentKey = (value) => (value === null ? '__org__' : String(value).toLowerCase());
  const resolveRowKey = (row) => {
    if (!row) return '__org__';
    const candidate = row.user_id ?? row.user_id_uuid ?? null;
    return buildAssignmentKey(candidate);
  };
  const verifyPersistedCourseAssignments = async () => {
    if (targetUserIds.length === 0) {
      return [];
    }

    const expectedKeys = new Set(targetUserIds.map((value) => buildAssignmentKey(value)));
    const persistedById = new Map();
    const userScopedTargetIds = targetUserIds.filter((value) => value !== null);
    const includesOrgLevelTarget = targetUserIds.some((value) => value === null);

    const collectRowsByColumn = async (column) => {
      if (userScopedTargetIds.length === 0) return;
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq(assignmentsOrgColumn, finalOrganizationId)
        .eq('active', true)
        .in(column, userScopedTargetIds);
      if (error) throw error;
      for (const row of data || []) {
        if (!row || persistedById.has(row.id)) continue;
        persistedById.set(row.id, row);
      }
    };

    await collectRowsByColumn('user_id');
    if (assignmentsSupportUserIdUuid) {
      await collectRowsByColumn('user_id_uuid');
    }

    if (includesOrgLevelTarget) {
      const { data: orgRows, error: orgError } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq(assignmentsOrgColumn, finalOrganizationId)
        .eq('active', true)
        .is('user_id', null);
      if (orgError) throw orgError;
      for (const row of orgRows || []) {
        if (!row || persistedById.has(row.id)) continue;
        persistedById.set(row.id, row);
      }
    }

    const persistedRows = Array.from(persistedById.values());
    const persistedKeys = new Set(persistedRows.map((row) => resolveRowKey(row)));
    const missingKeys = Array.from(expectedKeys).filter((key) => !persistedKeys.has(key));
    if (missingKeys.length > 0) {
      const verificationError = new Error('assignment_persistence_verification_failed');
      verificationError.code = 'assignment_persistence_verification_failed';
      verificationError.meta = {
        courseId,
        organizationId: finalOrganizationId,
        missingKeys,
        expectedCount: expectedKeys.size,
        persistedCount: persistedRows.length,
      };
      throw verificationError;
    }

    return persistedRows;
  };

  try {
    if (targetUserIds.length === 0) {
      if (assignmentFallbackEnabled) {
        const fallbackResolved = (Array.isArray(e2eStore.users) ? e2eStore.users : [])
          .filter((member) => {
            const memberOrg = normalizeOrgIdValue(member?.organization_id ?? member?.org_id ?? member?.organizationId ?? member?.orgId ?? null);
            return memberOrg && String(memberOrg) === String(finalOrganizationId);
          })
          .map((member) => {
            const candidate = member?.user_id ?? member?.userId ?? member?.id ?? null;
            return typeof candidate === 'string' ? candidate.trim() : '';
          })
          .filter((candidate) => candidate && isUuid(candidate));
        targetUserIds = Array.from(new Set(fallbackResolved));
      } else {
        const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
        const statusColumn = await getOrganizationMembershipsStatusColumnName();
        const membershipSelect =
          statusColumn === 'is_active'
            ? buildMembershipSelect('user_id', 'is_active')
            : buildMembershipSelect('user_id', 'status');
        let membershipQuery = supabase
          .from('organization_memberships')
          .select(membershipSelect)
          .eq(membershipOrgColumn, finalOrganizationId);

        if (statusColumn === 'is_active') {
          membershipQuery = membershipQuery.eq('is_active', true);
        } else {
          membershipQuery = membershipQuery.eq('status', 'active');
        }

        const { data: membershipRows, error: membershipError } = await membershipQuery;
        if (membershipError) throw membershipError;

        const resolvedFromOrg = (membershipRows || [])
          .map((row) => (typeof row?.user_id === 'string' ? row.user_id.trim() : ''))
          .filter((candidate) => candidate && isUuid(candidate));
        targetUserIds = Array.from(new Set(resolvedFromOrg));
      }

      if (shouldCreateOrgLevelAssignment && targetUserIds.length === 0) {
        targetUserIds = [null];
      }
    }

    assignmentIdempotencyKey = idempotencyKey && targetUserIds.length <= 1 ? idempotencyKey : null;
    if (idempotencyKey && !assignmentIdempotencyKey) {
      logger.info('course_assignment_idempotency_key_skipped_for_multi_target', {
        ...assignmentLogBase,
        targetCount: targetUserIds.length,
      });
    }

    if (assignmentFallbackEnabled) {
      const updated = [];
      const inserted = [];
      for (const userId of targetUserIds) {
        const match = e2eStore.assignments.find((record) => {
          if (!record) return false;
          if (String(record.organization_id) !== String(finalOrganizationId)) return false;
          if (String(record.course_id) !== String(courseId)) return false;
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
      const persistedKeys = new Set(responseRows.map((row) => resolveRowKey(row)));
      const expectedKeys = new Set(targetUserIds.map((value) => buildAssignmentKey(value)));
      const missingKeys = Array.from(expectedKeys).filter((key) => !persistedKeys.has(key));
      if (missingKeys.length > 0) {
        const verificationError = new Error('assignment_persistence_verification_failed');
        verificationError.code = 'assignment_persistence_verification_failed';
        verificationError.meta = {
          courseId,
          organizationId: finalOrganizationId,
          missingKeys,
          expectedCount: expectedKeys.size,
          persistedCount: responseRows.length,
          fallbackMode: true,
        };
        throw verificationError;
      }

      assignmentInsertedCount = inserted.length;
      assignmentUpdatedCount = updated.length;
      assignmentSkippedCount = Math.max(targetUserIds.length - assignmentInsertedCount - assignmentUpdatedCount, 0);
      if (assignmentInsertedCount > 0) {
        logger.info('course_assignment_created', {
          ...assignmentLogBase,
          insertedRowCount: assignmentInsertedCount,
        });
      }
      if (assignmentUpdatedCount > 0) {
        logger.info('course_assignment_updated', {
          ...assignmentLogBase,
          insertedRowCount: assignmentInsertedCount,
          updatedRowCount: assignmentUpdatedCount,
          skippedRowCount: assignmentSkippedCount,
        });
      }
      if (assignmentInsertedCount === 0 && assignmentUpdatedCount === 0 && assignmentSkippedCount > 0) {
        logger.info('course_assignment_skipped_duplicate', {
          ...assignmentLogBase,
          skippedRowCount: assignmentSkippedCount,
        });
      }
      if (inserted.length > 0) {
        try {
          await notifyAssignmentRecipients({
            assignmentType: 'course',
            assignments: inserted,
            actor: { userId: assignedBy ?? context.userId ?? null },
          });
        } catch (error) {
          logger.warn('course_assignment_notification_skipped', {
            message: error?.message || String(error),
          });
        }
      }
      // Always return 200 — idempotent upsert semantics (insert OR update both succeed).
      res.status(200).json({
        ok: true,
        data: responseRows,
        meta: {
          fallback: true,
          organizationId: finalOrganizationId,
          inserted: inserted.length,
          updated: updated.length,
        },
      });
      return;
    }

    if (!supabase) {
      const unavailableError = new Error('database_unavailable');
      unavailableError.code = 'database_unavailable';
      unavailableError.statusCode = 503;
      unavailableError.meta = { fallbackEnabled: assignmentFallbackEnabled };
      throw unavailableError;
    }

    if (assignmentIdempotencyKey) {
      const { data: existingByKey, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq(assignmentsOrgColumn, finalOrganizationId)
        .eq('idempotency_key', assignmentIdempotencyKey);
      if (error) throw error;
      if (existingByKey && existingByKey.length > 0) {
        res.status(200).json({ data: existingByKey, idempotent: true, meta: { idempotent: true, key: assignmentIdempotencyKey } });
        return;
      }
    } else if (clientRequestId) {
      const { data: existingByClient, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq(assignmentsOrgColumn, finalOrganizationId)
        .eq('client_request_id', clientRequestId);
      if (error) throw error;
      if (existingByClient && existingByClient.length > 0) {
        res.status(200).json({ data: existingByClient, meta: { idempotent: true, key: clientRequestId } });
        return;
      }
    }

    const existingMap = new Map();
    if (targetUserIds.length > 0) {
      const userScopedTargetIds = targetUserIds.filter((value) => value !== null);
      const includesOrgLevelTarget = targetUserIds.some((value) => value === null);
      const seenAssignmentIds = new Set();

      const fetchExistingByColumn = async (column) => {
        if (userScopedTargetIds.length === 0) {
          return [];
        }
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('course_id', courseId)
          .eq(assignmentsOrgColumn, finalOrganizationId)
          .eq('active', true)
          .in(column, userScopedTargetIds);
        if (error) throw error;
        return data || [];
      };

      const rowsByUserId = await fetchExistingByColumn('user_id');
      rowsByUserId.forEach((row) => {
        if (!row) return;
        seenAssignmentIds.add(row.id);
        existingMap.set(resolveRowKey(row), row);
      });

      if (assignmentsSupportUserIdUuid) {
        const rowsByUuid = await fetchExistingByColumn('user_id_uuid');
        rowsByUuid.forEach((row) => {
          if (!row || seenAssignmentIds.has(row.id)) return;
          seenAssignmentIds.add(row.id);
          existingMap.set(resolveRowKey(row), row);
        });
      }

      if (includesOrgLevelTarget) {
        const { data: existingOrg, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('course_id', courseId)
          .eq(assignmentsOrgColumn, finalOrganizationId)
          .eq('active', true)
          .is('user_id', null);
        if (error) throw error;
        (existingOrg || []).forEach((row) => {
          if (!row || seenAssignmentIds.has(row.id)) return;
          seenAssignmentIds.add(row.id);
          existingMap.set('__org__', row);
        });
      }
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
          user_id: existing.user_id ?? existing.user_id_uuid ?? null,
        };
        if (assignmentsSupportUserIdUuid) {
          patch.user_id_uuid = existing.user_id_uuid ?? existing.user_id ?? null;
        }
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
        .update(sanitizeAssignmentRecordForSchema(changes, { includeUserIdUuid: assignmentsSupportUserIdUuid }))
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
        .insert(inserts.map((record) => sanitizeAssignmentRecordForSchema(record, { includeUserIdUuid: assignmentsSupportUserIdUuid })))
        .select('*');
      if (error) {
        const errorText = `${error?.constraint || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
        const isIdempotencyConflict =
          error?.code === '23505' &&
          (errorText.includes('idempotency_key') || errorText.includes('assignments_idempotency_key_idx'));
        if (isIdempotencyConflict && assignmentIdempotencyKey) {
          const { data: existingByKey, error: existingByKeyError } = await supabase
            .from('assignments')
            .select('*')
            .eq('course_id', courseId)
            .eq(assignmentsOrgColumn, finalOrganizationId)
            .eq('idempotency_key', assignmentIdempotencyKey);
          if (!existingByKeyError && existingByKey && existingByKey.length > 0) {
            logger.info('course_assignment_idempotency_conflict_recovered', {
              ...assignmentLogBase,
              key: assignmentIdempotencyKey,
              recoveredRows: existingByKey.length,
            });
            res.status(200).json({
              ok: true,
              data: existingByKey,
              idempotent: true,
              meta: {
                organizationId: finalOrganizationId,
                idempotent: true,
                key: assignmentIdempotencyKey,
                recoveredFromConflict: true,
              },
            });
            return;
          }
        }
        throw error;
      }
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

  const verifiedRows = await verifyPersistedCourseAssignments();
  const responseRows = verifiedRows.length > 0 ? verifiedRows : [...updatedRows, ...insertedRows];
    assignmentInsertedCount = insertedRows.length;
    assignmentUpdatedCount = updatedRows.length;
    assignmentSkippedCount = Math.max(targetUserIds.length - assignmentInsertedCount - assignmentUpdatedCount, 0);
    if (assignmentInsertedCount > 0) {
      logger.info('course_assignment_created', {
        ...assignmentLogBase,
        insertedRowCount: assignmentInsertedCount,
        updatedRowCount: assignmentUpdatedCount,
        skippedRowCount: assignmentSkippedCount,
      });
    }
    if (assignmentUpdatedCount > 0) {
      logger.info('course_assignment_updated', {
        ...assignmentLogBase,
        insertedRowCount: assignmentInsertedCount,
        updatedRowCount: assignmentUpdatedCount,
        skippedRowCount: assignmentSkippedCount,
      });
    }
    if (assignmentInsertedCount === 0 && assignmentUpdatedCount === 0 && assignmentSkippedCount > 0) {
      logger.info('course_assignment_skipped_duplicate', {
        ...assignmentLogBase,
        skippedRowCount: assignmentSkippedCount,
      });
    }
    if (insertedRows.length > 0) {
      try {
        await notifyAssignmentRecipients({
          assignmentType: 'course',
          assignments: insertedRows,
          actor: { userId: assignedBy ?? context.userId ?? null },
        });
      } catch (error) {
        logger.warn('course_assignment_notification_skipped', {
          message: error?.message || String(error),
        });
      }
    }
    res.status(200).json({
      ok: true,
      data: responseRows,
      meta: {
        organizationId: finalOrganizationId,
        inserted: insertedRows.length,
        updated: updatedRows.length,
        targets: targetUserIds.length,
      },
    });
    logger.info('course_assignment_persisted', {
      ...assignmentLogBase,
      insertedRowCount: assignmentInsertedCount,
      updatedRowCount: assignmentUpdatedCount,
      skippedRowCount: assignmentSkippedCount,
      persistedRowCount: responseRows.length,
    });
  } catch (error) {
    logger.error('course_assignment_failed', {
      ...assignmentLogBase,
      insertedRowCount: assignmentInsertedCount,
      updatedRowCount: assignmentUpdatedCount,
      skippedRowCount: assignmentSkippedCount,
      error: safeSerializeError(error),
    });
    logAdminCoursesError(req, error, `Failed to assign course ${id}`);
    res.locals = res.locals || {};
    res.locals.errorCode = error?.code ?? 'assignment_failed';
    if (error?.statusCode === 400 || error?.code === 'invalid_organization_id' || error?.code === 'invalid_user_ids') {
      res.status(400).json({
        error: error?.code || 'invalid_assignment_payload',
        message: error?.message || 'Assignment payload contains invalid identifiers.',
      });
      return;
    }
    if (error?.statusCode === 403 || error?.code === 'org_access_denied') {
      res.status(403).json({
        error: 'org_access_denied',
        message: 'You do not have admin access to assign for this organization.',
      });
      return;
    }
    if (
      error?.statusCode === 503 ||
      error?.code === 'assignment_persistence_verification_failed' ||
      error?.code === 'database_unavailable' ||
      isInfrastructureUnavailableError(error)
    ) {
      res.status(503).json({
        error: error?.code === 'assignment_persistence_verification_failed'
          ? 'assignment_persistence_verification_failed'
          : 'database_unavailable',
        message:
          error?.code === 'assignment_persistence_verification_failed'
            ? 'Assignment write could not be verified. No success was returned.'
            : 'Assignment write failed because the database is unavailable.',
      });
      return;
    }
    res.status(500).json({ error: 'Unable to assign course' });
  }
});

app.get('/api/admin/courses/:id/assignments', authenticate, async (req, res) => {
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  let organizationId = pickOrgId(req.query.orgId, req.query.organizationId);

  try {
    const resolvedOrgId = await coerceOrgIdentifierToUuid(req, organizationId);
    if (resolvedOrgId) {
      organizationId = resolvedOrgId;
    }
  } catch (err) {
    console.warn('[admin.courses.assignments] failed to resolve organization id', { organizationId, error: err?.message || String(err), requestId: req.requestId ?? null });
  }

  if ((!organizationId || !isUuid(organizationId)) && !isFallbackMode) {
    res.status(400).json({ error: 'invalid_organization_id', message: 'orgId must be a valid organization UUID.' });
    return;
  }

  if (!organizationId && !isFallbackMode) {
    res.status(400).json({ error: 'org_id_required', message: 'orgId query parameter is required.' });
    return;
  }

  // In fallback/E2E mode with no orgId supplied, default to the sandbox org so
  // downstream filtering and requireOrgAccess still work correctly.
  if (!organizationId && isFallbackMode) {
    organizationId = DEFAULT_SANDBOX_ORG_ID;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  // In fallback/demo mode requireOrgAccess always returns {role:'owner'} anyway;
  // skip it when orgId was not supplied to avoid the org_required guard.
  if (!isFallbackMode) {
    const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: true });
    if (!access) return;
  }

  try {
    const activeOnly = String(req.query.active ?? 'true').toLowerCase() !== 'false';
      if (isDemoOrTestMode) {
      const rows = (Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [])
        .filter((assignment) => {
          if (!assignment) return false;
          if (String(assignment.course_id) !== String(courseId)) return false;
          const assignmentOrgId = pickOrgId(
            assignment.organization_id,
            assignment.organizationId,
            assignment.org_id,
            assignment.orgId,
          );
          if (String(assignmentOrgId) !== String(organizationId)) return false;
          if (activeOnly && assignment.active === false) return false;
          return true;
        })
        .sort((left, right) => {
          const a = String(left?.created_at || '');
          const b = String(right?.created_at || '');
          return a < b ? 1 : a > b ? -1 : 0;
        });
      res.json({ data: rows, demo: true });
      return;
    }

    if (!ensureSupabase(res)) return;
    const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
    let query = supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId)
      .eq(assignmentsOrgColumn, organizationId)
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

app.delete('/api/admin/assignments/:assignmentId', authenticate, async (req, res) => {
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
    if (!access) return;

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

// Core middleware ordering: cookies -> JSON -> request metadata.
// NOTE: corsMiddleware is registered at app creation (above) so it runs before
// every route handler, including the early pre-2092 /api/admin routes.
// (Moved cookieParser, express.json, and attachRequestId before routes)

const createCorsRouteLogger = (label) => (req, res, next) => {
  const origin = req.headers?.origin ?? null;
  res.on('finish', () => {
    logger.debug('cors_route_trace', {
      route: label,
      origin,
      requestId: req.requestId ?? null,
      statusCode: res.statusCode,
    });
  });
  next();
};

app.use('/api/admin/surveys', createCorsRouteLogger('/api/admin/surveys'));
app.use('/api/admin/organizations', createCorsRouteLogger('/api/admin/organizations'));
app.use(['/api/health', '/api/health/'], createCorsRouteLogger('/api/health'));

app.get(['/api/health', '/health'], respondWithHealthPayload);

app.get('/api/health/db', async (_req, res) => {
  try {
    const result = await probeDatabaseHealth({ requireWritable: true });
    const ok = Boolean(result.ok && result.writable !== false);
    const statusCode = ok ? 200 : 503;
    const code = result.code ?? (result.ok && result.writable === false ? 'db_not_writable' : null);
    const message = result.message ?? (result.ok && result.writable === false
      ? 'Database reachable but write probe failed.'
      : null);
    res.status(statusCode).json({
      ok,
      status: result.status,
      latencyMs: result.latencyMs ?? null,
      writable: result.writable ?? null,
      code,
      message,
      demoFallback: Boolean(isDemoMode),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'db_health_failed',
    });
  }
});

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

// Protect all non-auth state-changing endpoints with CSRF tokens.
app.use((req, res, next) => {
  const path = req.path || '';
  console.log('[csrf] check', { path, method: req.method });
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/health') ||
    path.startsWith('/api/ws') ||
    path.startsWith('/api/analytics') ||
    path.startsWith('/api/audit-log') ||
    path.startsWith('/api/admin')
  ) {
    console.log('[csrf] bypass', { path });
    return next();
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  return doubleSubmitCSRF(req, res, next);
});

// Expose CSRF token endpoint for clients and scripts that use the double-submit cookie pattern
app.get('/api/auth/csrf', getCSRFToken);

// Dev fallback: allow in-memory server behavior when Supabase isn't configured.
// Enabled by default in non-production unless isDemoMode=false is set.

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

logger.debug('diagnostics_cookies_and_cors', {
  allowedOrigins: Array.from(diagnosticsAllowedOrigins),
  resolvedCorsOrigins,
  corsAllowCredentials: true,
  cookieDomain: process.env.COOKIE_DOMAIN || '.the-huddle.co',
  cookieSameSite: defaultCookieSameSite,
  cookieSecureDefault: defaultCookieSecure,
});

const API_AUTH_BYPASS_PREFIXES = ['/auth', '/mfa', '/health', '/diagnostics', '/broadcast', '/audit-log', '/analytics', '/client/courses', '/admin/me'];
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
    const path = req.originalUrl || req.path || '/';
    const isHealthCheck = path === '/api/health' || path === '/health' || path.startsWith('/api/health/');
    const statusCode = res.statusCode;
    // In production, 2xx/3xx responses generate enormous volume with no actionable signal.
    // Log them at debug (invisible in Railway unless LOG_LEVEL=debug) and promote only
    // 4xx/5xx to info so failures are always visible.  Health-check 2xx stay at debug too.
    const isSuccess = statusCode >= 200 && statusCode < 400;
    const logFn = isSuccess || isHealthCheck
      ? logger.debug.bind(logger)
      : logger.info.bind(logger);
    logFn('http_request_completed', {
      method: req.method,
      path,
      statusCode,
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

app.put('/api/text-content', requireAdminAccess, (req, res, next) => {
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

const shouldUseAdminUsersFallback = (req) => {
  if (isDemoOrTestMode) return true;
  const roleHeader = String(req?.headers?.['x-user-role'] || '').toLowerCase();
  const hostHeader = String(req?.headers?.host || '').toLowerCase();
  const looksLocal = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');
  if (roleHeader === 'admin' && looksLocal) return true;

  const demoAdminId = '00000000-0000-0000-0000-000000000001';
  const requestUserId = req?.user?.userId ?? req?.user?.id ?? req?.userId ?? null;
  if (requestUserId && requestUserId === demoAdminId && looksLocal) {
    return true;
  }

  return false;
};

app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  const orgId = pickOrgId(req.query.orgId, req.query.organizationId);

  if (shouldUseAdminUsersFallback(req)) {
    const normalizedOrgId = normalizeOrgIdValue(orgId);
    const allMembers = Array.isArray(e2eStore.users) ? e2eStore.users : [];

    if (!normalizedOrgId && req.user?.isPlatformAdmin) {
      res.json({ data: allMembers });
      return;
    }

    const members = allMembers.filter((member) => {
      const memberOrg = normalizeOrgIdValue(member?.organization_id ?? member?.org_id ?? null);
      return normalizedOrgId ? memberOrg === normalizedOrgId : true;
    });
    if (members.length === 0 && allMembers.length > 0 && normalizedOrgId) {
      res.json({ data: [] });
      return;
    }
    res.json({ data: members });
    return;
  }

  if (!ensureSupabase(res)) return;

  const context = requireUserContext(req, res);
  if (!context) return;
  const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');

  if (!isPlatformAdmin && !orgId) {
    res.status(400).json({ error: 'org_id_required', message: 'orgId query parameter is required.' });
    return;
  }

  if (!isPlatformAdmin) {
    const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
    if (!access) return;
  }

  try {
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const members = isPlatformAdmin && !orgId
      ? await fetchAllOrgMembersWithProfiles({ offset, limit })
      : await fetchOrgMembersWithProfiles(orgId);
    res.json({ data: members, meta: { offset, limit } });
  } catch (error) {
    const normalized = logUsersStageError('memberships_fetch', error, {
      requestId: req.requestId ?? null,
      orgId,
      isPlatformAdmin,
    });
    res.status(500).json({
      error: 'Unable to load organization users',
      code: normalized.code ?? 'internal_error',
      message: normalized.message ?? 'Unexpected error while loading organization users',
      details: normalized.details ?? null,
      requestId: req.requestId ?? null,
    });
  }
});

app.post('/api/admin/users', authenticate, requireAdmin, async (req, res) => {

  const orgId = pickOrgId(
    req.body?.orgId,
    req.body?.organizationId,
    req.body?.org_id,
    req.body?.organization_id,
  );
  const firstName =
    typeof req.body?.firstName === 'string'
      ? req.body.firstName.trim()
      : typeof req.body?.first_name === 'string'
        ? req.body.first_name.trim()
        : '';
  const lastName =
    typeof req.body?.lastName === 'string'
      ? req.body.lastName.trim()
      : typeof req.body?.last_name === 'string'
        ? req.body.last_name.trim()
        : '';
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const membershipRole = normalizeOrgRole(req.body?.membershipRole || req.body?.membership_role || 'member');
  const jobTitle =
    typeof req.body?.jobTitle === 'string'
      ? req.body.jobTitle.trim()
      : typeof req.body?.job_title === 'string'
        ? req.body.job_title.trim()
        : '';
  const department = typeof req.body?.department === 'string' ? req.body.department.trim() : '';
  const cohort = typeof req.body?.cohort === 'string' ? req.body.cohort.trim() : '';
  const phoneNumber =
    typeof req.body?.phoneNumber === 'string'
      ? req.body.phoneNumber.trim()
      : typeof req.body?.phone_number === 'string'
        ? req.body.phone_number.trim()
        : '';

  if (!orgId) {
    res.status(400).json({ error: 'org_id_required', message: 'organizationId is required.' });
    return;
  }
  if (!firstName || !lastName || !rawEmail) {
    res.status(400).json({
      error: 'missing_fields',
      message: 'firstName, lastName, and email are required.',
    });
    return;
  }
  if (password && password.length < INVITE_PASSWORD_MIN_CHARS) {
    res.status(400).json({
      error: 'invalid_password',
      message: `Password must be at least ${INVITE_PASSWORD_MIN_CHARS} characters.`,
    });
    return;
  }

  if (shouldUseAdminUsersFallback(req)) {
    const normalizedOrgId = normalizeOrgIdValue(orgId);
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const existing = (Array.isArray(e2eStore.users) ? e2eStore.users : []).find((member) => {
      const memberOrg = normalizeOrgIdValue(member?.organization_id ?? member?.org_id ?? null);
      const memberEmail = String(member?.profile?.email ?? member?.email ?? '').trim().toLowerCase();
      return memberOrg === normalizedOrgId && memberEmail === normalizedEmail;
    });
    if (existing) {
      res.status(200).json({
        data: existing,
        created: false,
        existingAccount: true,
        membershipCreated: false,
        setupLink: existing.setupLink ?? null,
        emailSent: false,
        emailStatus: 'smtp_not_configured',
      });
      return;
    }

    const now = new Date().toISOString();
    const userId = randomUUID();
    const member = {
      id: userId,
      user_id: userId,
      organization_id: orgId,
      org_id: orgId,
      role: membershipRole,
      status: 'active',
      created_at: now,
      updated_at: now,
      email: rawEmail,
      profile: {
        id: userId,
        email: rawEmail,
        first_name: firstName,
        last_name: lastName,
        role: membershipRole,
        organization_id: orgId,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      user: {
        id: userId,
        email: rawEmail,
        first_name: firstName,
        last_name: lastName,
        role: membershipRole,
        status: 'active',
      },
      setupLink: `http://localhost:5174/setup?token=${randomUUID()}`,
    };

    e2eStore.users = Array.isArray(e2eStore.users) ? e2eStore.users : [];
    e2eStore.users.push(member);
    if (NODE_ENV !== 'production') {
      console.info('[e2e.admin.users] created', {
        orgId: normalizedOrgId,
        email: normalizedEmail,
        total: e2eStore.users.length,
      });
    }

    res.status(201).json({
      data: member,
      created: true,
      existingAccount: false,
      membershipCreated: true,
      setupLink: member.setupLink,
      emailSent: false,
      emailStatus: 'smtp_not_configured',
    });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  if (!ensureSupabase(res)) return;

  try {
    const actor = buildActorFromRequest(req);
    try {
      const account = await createOrProvisionOrganizationUser(
        {
          orgId,
          email: rawEmail,
          password,
          firstName,
          lastName,
          membershipRole,
          jobTitle,
          department,
          cohort,
          phoneNumber,
          actor,
          requestId: req.requestId ?? null,
        },
        {
          supabase,
          logger,
          sendEmail,
          getOrganizationMembershipsOrgColumnName,
          invalidateMembershipCache,
          assignContentToUser: assignPublishedOrganizationContentToUser,
          fetchOrgMembersWithProfiles,
        },
      );

      res.status(account.created ? 201 : 200).json({
        data: account.member,
        created: account.created,
        existingAccount: !account.created,
        membershipCreated: account.membershipCreated,
        setupLink: account.setupLink ?? null,
        emailSent: account.emailSent ?? false,
        emailStatus: account.emailResult?.reason ?? null,
      });
      return;
    } catch (error) {
      throw error;
    }
  } catch (error) {
    const stage = error?.stage ?? 'user_create';
    const normalized = logUsersStageError(stage, error, {
      requestId: req.requestId ?? null,
      orgId,
      email: rawEmail,
    });
    const validationCodes = new Set([
      'invalid_password',
      'missing_fields',
      'org_id_required',
      'email_required',
      'invalid_email',
      'org_access_denied',
    ]);
    const status = validationCodes.has(normalized.code)
      ? normalized.code === 'org_access_denied'
        ? 403
        : 400
      : 500;
    res.status(status).json({
      error: 'Unable to create organization user',
      code: normalized.code ?? 'internal_error',
      message: normalized.message ?? 'Unexpected error while creating organization user',
      details: normalized.details ?? null,
      stage,
      requestId: req.requestId ?? null,
    });
  }
});

app.patch('/api/admin/users/:userId', authenticate, requireAdmin, async (req, res, next) => {
  // Delegate to router implementation for organization transfer semantics.
  return next();
});

app.delete('/api/admin/users/:userId', authenticate, requireAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { userId } = req.params;
  const orgId = pickOrgId(
    req.query?.orgId,
    req.query?.organizationId,
    req.body?.orgId,
    req.body?.organizationId,
  );
  const mode = String(req.query?.mode || req.body?.mode || 'archive').toLowerCase();
  const requestId = req.requestId ?? null;

  const context = requireUserContext(req, res);
  if (!context) return;

  const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');
  if (mode === 'archive') {
    if (!orgId) {
      res.status(400).json({ error: 'org_id_required', message: 'organizationId is required to archive a user.' });
      return;
    }
    const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
    if (!access) return;

    try {
      const result = await archiveOrganizationUserAccount({ userId, orgId, requestId });
      res.json({ data: result });
    } catch (error) {
      const normalized = logUsersStageError('user_archive', error, { requestId, orgId, userId });
      const statusCode =
        normalized.code === 'membership_not_found'
          ? 404
          : normalized.code === 'owner_required' || normalized.code === 'invalid_archive_request'
            ? 400
            : 500;
      res.status(statusCode).json({
        error: 'Unable to archive organization user',
        code: normalized.code ?? 'internal_error',
        message: normalized.message ?? 'Unexpected error while archiving organization user',
        details: normalized.details ?? null,
        requestId,
      });
    }
    return;
  }

  if (mode !== 'delete') {
    res.status(400).json({ error: 'invalid_mode', message: 'mode must be archive or delete.' });
    return;
  }

  if (!isPlatformAdmin) {
    res.status(403).json({
      error: 'platform_admin_required',
      message: 'Hard-deleting a user requires platform admin access.',
    });
    return;
  }

  try {
    await permanentlyDeleteUserAccount({ userId, requestId });
    res.status(204).end();
  } catch (error) {
    const normalized = logUsersStageError('user_delete', error, { requestId, userId });
    res.status(500).json({
      error: 'Unable to permanently delete user',
      code: normalized.code ?? 'internal_error',
      message: normalized.message ?? 'Unexpected error while deleting user',
      details: normalized.details ?? null,
      requestId,
    });
  }
});

// MFA routes
app.use('/api/mfa', mfaRoutes);

// ─── ADMIN MIDDLEWARE BARRIER ──────────────────────────────────────────────────
// ALL /api/admin/* route handlers and routers MUST be registered AFTER this line.
// Routes registered before this line bypass authenticate + requireAdmin entirely
// because Express resolves middleware in registration order.
// This pattern has already caused two auth bypass bugs (fixed 2026-03). Do not
// add new /api/admin/* routes above this block under any circumstances.
// ──────────────────────────────────────────────────────────────────────────────

// Enforce authentication + admin role on every /api/admin/* route before specific routers/handlers
// /api/admin/me is handled by requireAdminAccess directly and should not be subject to requireAdmin.
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/me') {
    return next();
  }
  return authenticate(req, res, (err) => {
    if (err) {
      return next(err);
    }
    return requireAdmin(req, res, (err2) => {
      if (err2) {
        return next(err2);
      }
      return resolveOrganizationContext(req, res, next);
    });
  });
});

// Admin analytics endpoints (aggregates, exports, AI summary)
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/analytics/export', adminAnalyticsExport);
app.use('/api/admin/analytics/summary', adminAnalyticsSummary);
if (!isDemoOrTestMode) {
  app.use('/api/admin/users', authenticate, requireAdmin, adminUsersRouter);
}
// NOTE: adminCoursesRouter is a deprecated empty stub (see server/routes/admin-courses.js).
// The real /api/admin/courses handlers live in index.js at the app.get/post/put/delete
// call sites below. The app.use() mount was intercepting all /api/admin/courses* traffic
// and routing it into an empty router, causing every courses request to 404 before the
// real handlers were reached. Removed — auth is covered by app.use('/api/admin', ...) above.

app.get(
  '/api/admin/courses/import/template',
  requireAdminAccess,
  asyncHandler((_req, res) => {
    try {
      const contents = fs.readFileSync(COURSE_IMPORT_TEMPLATE_PATH, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.send(contents);
    } catch (error) {
      console.error('[admin.courses.import.template] failed_to_load', error);
      res.status(500).json({
        error: 'template_unavailable',
        message: 'Unable to load course import template.',
      });
    }
  }),
);

app.get('/api/admin/diagnostics/memberships', requireAdminAccess, asyncHandler(async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const userId = context.userId;
  const allowedColumns = new Set(['org_id', 'organization_id']);
  const runColumnProbe = async (column) => {
    if (!allowedColumns.has(column)) {
      return { ok: false, rows: [], error: `unsupported_column:${column}` };
    }
    const text = `select ${column} as organization_id from organization_memberships where user_id = $1 and status = 'active' limit 5`;
    try {
      const { rows } = await pool.query(text, [userId]);
      return { ok: true, rows };
    } catch (error) {
      return { ok: false, rows: [], error: error?.message || String(error) };
    }
  };

  const [queryOrgId, queryOrganizationId] = await Promise.all([
    runColumnProbe('org_id'),
    runColumnProbe('organization_id'),
  ]);

  let rawMembershipRows = [];
  try {
    const rows = await getUserMemberships(userId, { logPrefix: '[admin-diagnostics]' });
    rawMembershipRows = Array.isArray(rows) ? rows.slice(0, 5) : [];
  } catch (error) {
    console.warn('[admin-diagnostics] membership_fetch_failed', {
      userId,
      message: error?.message || String(error),
    });
  }

  res.json({
    supabaseUrlEnv: process.env.SUPABASE_URL || null,
    dbHostUsed: databaseHost,
    userId,
    queryA_org_id: queryOrgId,
    queryB_organization_id: queryOrganizationId,
    rawMembershipRows,
  });
}));

app.get('/api/admin/email/test', requireAdminAccess, asyncHandler(async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const configSummary = getEmailConfigSummary();
  const recipientEmail = req.user?.email || null;

  if (!recipientEmail) {
    res.status(400).json({
      success: false,
      messageId: null,
      error: 'admin_email_missing',
      configSummary,
    });
    return;
  }

  if (!isEmailEnabled()) {
    res.status(500).json({
      success: false,
      messageId: null,
      error: 'smtp_not_configured',
      configSummary,
    });
    return;
  }

  const result = await sendEmail({
    to: recipientEmail,
    subject: 'SMTP test email',
    text: 'This is a test email confirming SMTP delivery for the admin portal.',
    logContext: {
      recipientType: 'admin_test',
      recipientId: context.userId,
      sentBy: context.userId,
    },
  });

  res.status(result.delivered ? 200 : 500).json({
    success: result.delivered,
    messageId: result.id || null,
    error: result.delivered ? null : result.reason || 'smtp_send_failed',
    configSummary,
  });
}));

// All organization workspace endpoints require authentication
app.use('/api/orgs', authenticate);

// Honor explicit E2E test mode in child processes: when isTestMode is set we prefer the
// in-memory demo fallback even if Supabase credentials are present in the environment.

const supabaseUrl = supabaseEnv.url;
const supabaseServiceRoleKey = supabaseEnv.serviceRoleKey;
const supabaseAnonKey = supabaseEnv.anonKey;
const missingSupabaseEnvVars = [...supabaseEnv.missing];
const DEBUG_MEMBERSHIP_TOKEN = process.env.DEBUG_MEMBERSHIP_TOKEN || null;

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
configureEmailLogging({
  getSupabase: () => supabase,
});
let surveyAssignmentAggregateRpcMissingLogged = false;
const shouldUseInMemoryFallback = isDemoMode || E2E_TEST_MODE || TEST_IDEMPOTENCY_FALLBACK_MODE;
if (isFallbackMode) {
  console.log('[server] Running in in-memory fallback mode - ignoring Supabase credentials', {
    triggers: fallbackTriggerReasons,
    surveyAssignmentPersistence: assignmentPersistenceSimulated ? 'simulated' : 'real-db',
  });
  supabase = null;
  supabaseAuthClient = null;
}
let loggedMissingSupabaseConfig = false;
let assignmentsUserIdUuidColumnAvailable = null;
let assignmentsOrganizationIdColumnAvailable = null;

await runStorageDoctor();

const isAssignmentsUserIdUuidColumnMissing = (error) => {
  if (!isMissingColumnError(error)) return false;
  const missing = normalizeColumnIdentifier(extractMissingColumnName(error));
  return missing === 'user_id_uuid';
};

const sanitizeAssignmentRecordForSchema = (record, { includeUserIdUuid }) => {
  if (!record || typeof record !== 'object') return record;
  if (includeUserIdUuid) return record;
  const { user_id_uuid, ...legacyCompatible } = record;
  return legacyCompatible;
};

const isAssignmentsOrganizationIdColumnMissing = (error) => {
  if (!isMissingColumnError(error)) return false;
  const missing = normalizeColumnIdentifier(extractMissingColumnName(error));
  return missing === 'organization_id';
};

const isUserCourseProgressUuidColumnMissing = (error) => {
  if (!isMissingColumnError(error)) return false;
  const missing = normalizeColumnIdentifier(extractMissingColumnName(error));
  return missing === 'user_id_uuid';
};

const isConflictConstraintMissing = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P10' || message.includes('no unique') && message.includes('on conflict');
};

const detectAssignmentsUserIdUuidColumnAvailability = async () => {
  if (!supabase) return false;
  if (typeof assignmentsUserIdUuidColumnAvailable === 'boolean') {
    return assignmentsUserIdUuidColumnAvailable;
  }

  try {
    const { error } = await supabase
      .from('assignments')
      .select('id', { head: true, count: 'exact' })
      .is('user_id_uuid', null);
    if (error) throw error;
    assignmentsUserIdUuidColumnAvailable = true;
  } catch (error) {
    if (isAssignmentsUserIdUuidColumnMissing(error)) {
      assignmentsUserIdUuidColumnAvailable = false;
      logger.warn('assignments_user_id_uuid_column_missing', {
        message: 'user_id_uuid column does not exist on assignments — assignment writes will use legacy user_id-only payloads',
      });
      return false;
    }
    throw error;
  }

  return assignmentsUserIdUuidColumnAvailable;
};

const detectAssignmentsOrganizationIdColumnAvailability = async () => {
  if (!supabase) return false;
  if (typeof assignmentsOrganizationIdColumnAvailable === 'boolean') {
    return assignmentsOrganizationIdColumnAvailable;
  }

  try {
    const { error } = await supabase
      .from('assignments')
      .select('id', { head: true, count: 'exact' })
      .is('organization_id', null);
    if (error) throw error;
    assignmentsOrganizationIdColumnAvailable = true;
  } catch (error) {
    if (isAssignmentsOrganizationIdColumnMissing(error)) {
      assignmentsOrganizationIdColumnAvailable = false;
      logger.warn('assignments_organization_id_column_missing', {
        message: 'organization_id column does not exist on assignments — assignment writes will use legacy org_id payloads',
      });
      return false;
    }
    throw error;
  }

  return assignmentsOrganizationIdColumnAvailable;
};

const getAssignmentsOrgColumnName = async () =>
  ((await detectAssignmentsOrganizationIdColumnAvailability()) ? 'organization_id' : 'org_id');

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
    }
    // Suppress the noisy success log — absence of errors means schema is healthy.
  } catch (error) {
    // If the column doesn't exist at all, treat as non-fatal schema drift — the
    // progress write path already has a per-request fallback for this case.
    if (isUserCourseProgressUuidColumnMissing(error)) {
      logger.warn('user_course_progress_uuid_column_missing', {
        message: 'user_id_uuid column does not exist on user_course_progress — progress writes will use legacy conflict target',
      });
      return;
    }
    logger.warn('user_course_progress_uuid_audit_failed', {
      message: error?.message ?? String(error),
    });
  }
};

if (supabase) {
  auditUserCourseProgressUuid();
  detectAssignmentsUserIdUuidColumnAvailability().catch((error) => {
    logger.warn('assignments_user_id_uuid_audit_failed', {
      message: error?.message ?? String(error),
    });
  });
}

const mediaService = createMediaService({
  getSupabase: () => supabase,
  courseVideosBucket: COURSE_VIDEOS_BUCKET,
  documentsBucket: DOCUMENTS_BUCKET,
});

const notificationDispatcher = setupNotificationDispatcher({ supabase, emailSender: sendEmail });
const notificationService = createNotificationService({
  getSupabase: () => supabase,
  dispatcher: {
    ...notificationDispatcher,
    broadcast: broadcastToTopic,
  },
  logger,
});
app.locals.notificationService = notificationService;

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
  const timeoutMs = Number(process.env.SUPABASE_HEALTH_TIMEOUT_MS || 2500);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
    const supabaseError = {
      message: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null,
      stack: error?.stack || null,
    };
    const latencyMs = Date.now() - start;
    const isTimeoutAbort =
      error?.name === 'AbortError' ||
      /aborted/i.test(String(supabaseError.message || ''));
    if (isTimeoutAbort) {
      const timeoutMessage = `Supabase health check timed out after ${timeoutMs}ms`;
      recordSupabaseHealth('degraded', latencyMs, timeoutMessage);
      logger.warn('supabase_health_timeout', {
        latencyMs,
        timeoutMs,
        message: supabaseError.message,
      });
      return { status: 'degraded', latencyMs, message: timeoutMessage };
    }

    recordSupabaseHealth('error', latencyMs, supabaseError.message);
    console.error('[supabase error]', supabaseError);
    logger.warn('supabase_health_failed', { ...supabaseError, latencyMs });
    return { status: 'error', latencyMs, message: supabaseError.message };
  } finally {
    clearTimeout(timeout);
  }
};

// Load persisted data if available.
// In isDemoMode/E2E mode the in-memory demo store is the source of truth, even
// if Supabase credentials exist in the environment. Production keeps Supabase as
// the only source of truth.
const _loadCoursesFromDisk = Boolean(isDemoMode);
const persistedData = _loadCoursesFromDisk
  ? loadPersistedData()
  : { courses: [], surveys: [], surveyAssignments: [] };
if (supabaseServerConfigured && !_loadCoursesFromDisk && (persistedData.courses || []).length > 0) {
  logger.warn('persistent_storage_courses_ignored', {
    message: 'demo-data.json contains courses but Supabase is configured — disk courses will NOT be loaded. Supabase is the sole source of truth.',
    diskCourseCount: (persistedData.courses || []).length,
  });
}

const e2eStore = {
  // isDemoMode/E2E always boot the in-memory demo catalog from disk so admin
  // and learner flows have stable content even when Supabase is configured but
  // intentionally bypassed.
  courses: _loadCoursesFromDisk ? new Map(persistedData.courses || []) : new Map(),
  users: [],
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
const DEFAULT_DEMO_LEARNER_USER_ID = '00000000-0000-0000-0000-000000000002';

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
    const candidate =
      value.organization_id ??
      value.organizationId ??
      value.orgId ??
      value.id ??
      null;
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

const DEMO_ORG_SEED = [
  { id: 'pacific-coast-university', name: 'Pacific Coast University' },
  { id: 'mountain-view-high-school', name: 'Mountain View High School' },
];

const buildDemoOrganizations = ({
  adminOrgIds = [],
  requestedOrgId = null,
  resolvedRequestedOrgId = null,
  search = '',
  statuses = [],
  subscriptions = [],
  sort = 'created_at',
  ascending = false,
} = {}) => {
  const nowIso = new Date().toISOString();
  const orgIds = new Set();
  orgIds.add(DEFAULT_SANDBOX_ORG_ID);

  DEMO_ORG_SEED.forEach((org) => {
    if (org?.id) {
      orgIds.add(org.id);
    }
  });

  for (const course of e2eStore.courses.values()) {
    const courseOrgId = pickOrgId(course?.organization_id, course?.organizationId, course?.org_id);
    if (courseOrgId) {
      orgIds.add(courseOrgId);
    }
  }

  for (const assignment of Array.isArray(e2eStore.assignments) ? e2eStore.assignments : []) {
    const assignmentOrgId = pickOrgId(
      assignment?.organization_id,
      assignment?.organizationId,
      assignment?.org_id,
      assignment?.orgId,
    );
    if (assignmentOrgId) {
      orgIds.add(assignmentOrgId);
    }
  }

  for (const adminOrgId of adminOrgIds) {
    if (adminOrgId) {
      orgIds.add(adminOrgId);
    }
  }

  const orgNameLookup = new Map(DEMO_ORG_SEED.map((org) => [org.id, org.name]));

  let organizations = Array.from(orgIds).map((orgId) => ({
    id: orgId,
    organization_id: orgId,
    name:
      orgId === DEFAULT_SANDBOX_ORG_ID
        ? 'Demo Sandbox Organization'
        : orgNameLookup.get(orgId) ?? `Organization ${orgId}`,
    slug: String(orgId).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    status: 'active',
    subscription: 'enterprise',
    contact_email: orgId === DEFAULT_SANDBOX_ORG_ID ? 'sandbox@demo.local' : null,
    contact_person: orgId === DEFAULT_SANDBOX_ORG_ID ? 'Demo Admin' : null,
    created_at: nowIso,
    updated_at: nowIso,
    total_learners: 0,
    active_learners: 0,
    completion_rate: 0,
  }));

  if (resolvedRequestedOrgId) {
    organizations = organizations.filter((org) => org.id === requestedOrgId);
  }

  if (search) {
    const term = String(search).trim().toLowerCase();
    organizations = organizations.filter((org) =>
      [org.id, org.name, org.contact_email, org.contact_person].some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(term),
      ),
    );
  }

  if (statuses.length > 0) {
    const statusSet = new Set(statuses.map((value) => String(value).toLowerCase()));
    organizations = organizations.filter((org) => statusSet.has(String(org.status || '').toLowerCase()));
  }

  if (subscriptions.length > 0) {
    const subscriptionSet = new Set(subscriptions.map((value) => String(value).toLowerCase()));
    organizations = organizations.filter((org) => subscriptionSet.has(String(org.subscription || '').toLowerCase()));
  }

  const readSortValue = (org) => {
    if (sort === 'name') return String(org.name || '').toLowerCase();
    if (sort === 'updated_at') return String(org.updated_at || '');
    return String(org.created_at || '');
  };

  organizations.sort((left, right) => {
    const a = readSortValue(left);
    const b = readSortValue(right);
    if (a === b) return String(left.id).localeCompare(String(right.id));
    if (ascending) return a > b ? 1 : -1;
    return a < b ? 1 : -1;
  });

  return organizations;
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

    const sandboxOrgAliases = new Set([DEFAULT_SANDBOX_ORG_ID, 'demo-org', 'demo-sandbox-org']);
    if (sandboxOrgAliases.has(normalized)) {
      let fallbackOrgId = null;
      if (Array.isArray(req?.user?.memberships) && req.user.memberships.length > 0) {
        const directMatch = req.user.memberships.find((membership) => {
          const membershipOrgId = pickOrgId(membership.orgId, membership.organizationId, membership.organization_id);
          return membershipOrgId && normalizeOrgIdValue(membershipOrgId) === normalized;
        });
        if (directMatch) {
          fallbackOrgId = normalizeOrgIdValue(pickOrgId(directMatch.orgId, directMatch.organizationId, directMatch.organization_id));
        }
        if (!fallbackOrgId) {
          const firstMembership = req.user.memberships[0];
          fallbackOrgId = normalizeOrgIdValue(pickOrgId(firstMembership.orgId, firstMembership.organizationId, firstMembership.organization_id));
        }
      }
      if (!fallbackOrgId && req.orgMemberships instanceof Map && req.orgMemberships.size > 0) {
        fallbackOrgId = normalizeOrgIdValue(Array.from(req.orgMemberships.keys())[0]);
      }
      if (!fallbackOrgId && req.user?.activeOrgId) {
        fallbackOrgId = normalizeOrgIdValue(req.user.activeOrgId);
      }
      if (!fallbackOrgId && req.user?.organizationId) {
        fallbackOrgId = normalizeOrgIdValue(req.user.organizationId);
      }
      if (!fallbackOrgId && Array.isArray(req.user?.organizationIds) && req.user.organizationIds.length > 0) {
        const orgIds = req.user.organizationIds.map(normalizeOrgIdValue).filter(Boolean);
        if (orgIds.length > 0) {
          fallbackOrgId = orgIds[0];
        }
      }
      const membershipUserId = req.user?.userId || req.user?.id;
      if (!fallbackOrgId && membershipUserId && isUuid(String(membershipUserId).trim())) {
        const primaryId = await fetchPrimaryOrgIdForUser(String(membershipUserId).trim());
        if (primaryId) {
          fallbackOrgId = normalizeOrgIdValue(primaryId);
        }
      }

      if (fallbackOrgId) {
        logOrgResolutionEvent('info', req, {
          event: 'sandbox_alias_resolved',
          identifier: normalized,
          resolvedOrgId: fallbackOrgId,
        });
        return fallbackOrgId;
      }
    }

    logOrgResolutionEvent('warn', req, { event: 'slug_unresolved', identifier: normalized });
    return null;
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
    return null;
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
const ORG_HEADER_KEYS = ['x-org-id', 'x-organization-id'];

const fetchPrimaryOrgIdForUser = async (userId) => {
  if (!userId || !supabase) return null;
  const normalizedUserId = String(userId).trim();
  if (!isUuid(normalizedUserId)) {
    console.info('[admin-courses] primary_org_lookup_skipped_non_uuid_user', { userId: normalizedUserId });
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', normalizedUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.organization_id ?? null;
  } catch (err) {
    console.error('[admin-courses] primary_org_lookup_failed', { userId: normalizedUserId, error: err });
    return null;
  }
};

const fetchFirstOrganizationId = async () => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
    if (error) {
      console.warn('[org-resolver] first_org_lookup_failed', { error });
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error('[org-resolver] first_org_lookup_failed', { error: err });
    return null;
  }
};

const resolveOrgIdForCourseRequest = async (req, context, candidates = []) => {
  if (!context) return pickOrgId(...candidates);
  const headerOrgId = getHeaderOrgId(req, { requireMembership: !context.isPlatformAdmin });
  const normalizedCandidates = [...candidates, headerOrgId, context.requestedOrgId];
  let orgId = pickOrgId(...normalizedCandidates);
  console.log('[admin-courses] resolveOrgIdForCourseRequest start', { contextUserId: context.userId, isPlatformAdmin: context.isPlatformAdmin, candidates: normalizedCandidates, initialOrgId: orgId });
  if (orgId) {
    orgId = await coerceOrgIdentifierToUuid(req, orgId);
    console.log('[admin-courses] resolveOrgIdForCourseRequest resolved candidate orgId', { orgId });
  }
  if (!orgId) {
    const scopedOrgIds = Array.from(collectOrgIdsFromContext(context, req));
    if (scopedOrgIds.length > 1) {
      throw new ExplicitOrgSelectionRequiredError(
        'This action is ambiguous across multiple organizations. Provide an organizationId explicitly.',
      );
    }
    if (scopedOrgIds.length === 1) {
      orgId = scopedOrgIds[0];
    }
  }
  if (!orgId && context.isPlatformAdmin) {
    if (!req[PLATFORM_ADMIN_ORG_CACHE_KEY]) {
      console.log('[admin-courses] platform admin no cached orgId, fetching primary', { userId: context.userId });
      req[PLATFORM_ADMIN_ORG_CACHE_KEY] = await fetchPrimaryOrgIdForUser(context.userId);
      if (!req[PLATFORM_ADMIN_ORG_CACHE_KEY]) {
        req[PLATFORM_ADMIN_ORG_CACHE_KEY] = await fetchFirstOrganizationId();
      }
      if (!req[PLATFORM_ADMIN_ORG_CACHE_KEY]) {
        req[PLATFORM_ADMIN_ORG_CACHE_KEY] = DEFAULT_SANDBOX_ORG_ID;
      }
    }

    orgId = req[PLATFORM_ADMIN_ORG_CACHE_KEY];
    if (orgId) {
      orgId = await coerceOrgIdentifierToUuid(req, orgId);
    }
    console.log('[admin-courses] platform admin resolved orgId', { orgId, cached: req[PLATFORM_ADMIN_ORG_CACHE_KEY] });
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

const collectOrgIdsFromContext = (context = {}, req = {}) => {
  const ids = new Set();
  const push = (candidate) => {
    const normalized = normalizeOrgIdValue(candidate);
    if (normalized) {
      ids.add(normalized);
    }
  };
  const membershipSources = [
    ...(Array.isArray(context.memberships) ? context.memberships : []),
    ...(Array.isArray(req.user?.memberships) ? req.user.memberships : []),
  ];
  membershipSources.forEach((membership) => {
    if (!membership) return;
    push(membership.orgId ?? membership.organization_id ?? membership.org_id ?? null);
  });
  const orgIdSources = [
    ...(Array.isArray(context.organizationIds) ? context.organizationIds : []),
    ...(Array.isArray(req.user?.organizationIds) ? req.user.organizationIds : []),
  ];
  orgIdSources.forEach(push);
  push(context.requestedOrgId);
  push(req.activeOrgId);
  push(req.user?.activeOrgId);
  push(req.user?.organizationId);
  return ids;
};

const resolveOrgScopeForRequest = async (
  req,
  context,
  { queryOrgId = null, requireExplicitSelection = false } = {},
) => {
  const membershipIds = collectOrgIdsFromContext(context, req);
  const headerOrgId = getHeaderOrgId(req, { requireMembership: !context?.isPlatformAdmin });
  const normalizedQueryOrgId = normalizeOrgIdValue(queryOrgId);
  const candidateIdentifiers = [];
  if (context?.isPlatformAdmin && queryOrgId) {
    candidateIdentifiers.push(queryOrgId);
  }
  candidateIdentifiers.push(
    headerOrgId,
    req.activeOrgId,
    req.user?.activeOrgId,
    context?.requestedOrgId,
    req.user?.organizationId,
  );
  let resolvedOrgId = null;
  for (const candidate of candidateIdentifiers) {
    if (!candidate) continue;
    const coerced = await coerceOrgIdentifierToUuid(req, candidate);
    if (coerced) {
      resolvedOrgId = coerced;
      break;
    }
  }

  if (
    !resolvedOrgId &&
    context?.isPlatformAdmin &&
    normalizedQueryOrgId &&
    (isDemoOrTestMode || isFallbackMode || !supabase)
  ) {
    resolvedOrgId = normalizedQueryOrgId;
  }

  const membershipList = Array.from(membershipIds);
  const membershipSet = new Set(membershipList);
  if (requireExplicitSelection && !context?.isPlatformAdmin && !resolvedOrgId && membershipList.length > 1) {
    return {
      resolvedOrgId: null,
      scopedOrgIds: membershipList,
      membershipSet,
      primaryOrgId: null,
      headerOrgId,
      requiresExplicitSelection: true,
    };
  }
  const scopedOrgIds = resolvedOrgId ? [resolvedOrgId] : membershipList;
  const primaryOrgId =
    resolvedOrgId ??
    (context?.requestedOrgId && membershipSet.has(context.requestedOrgId) ? context.requestedOrgId : null) ??
    (scopedOrgIds.length === 1 ? scopedOrgIds[0] : null);
  return {
    resolvedOrgId,
    scopedOrgIds,
    membershipSet,
    primaryOrgId,
    headerOrgId,
    requiresExplicitSelection: false,
  };
};

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
    if (isDemoOrTestMode) {
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
      lessons: Array.isArray(module.lessons)
        ? module.lessons.map((lesson) => {
            const baseContent = lesson?.content_json ?? lesson?.content ?? {};
            const normalizedContent = { ...(baseContent || {}) };
            const body =
              baseContent && typeof baseContent === 'object' && typeof baseContent.body === 'object'
                ? baseContent.body
                : null;

            if (!normalizedContent.videoUrl && body?.videoUrl) {
              normalizedContent.videoUrl = body.videoUrl;
            }
            if (!normalizedContent.videoAsset && body?.videoAsset && typeof body.videoAsset === 'object') {
              normalizedContent.videoAsset = { ...body.videoAsset };
            }
            if (!normalizedContent.video && body?.video && typeof body.video === 'object') {
              normalizedContent.video = { ...body.video };
            }
            if (!normalizedContent.videoUrl && normalizedContent.video?.url) {
              normalizedContent.videoUrl = normalizedContent.video.url;
            }
            if (!normalizedContent.video && normalizedContent.videoUrl) {
              normalizedContent.video = { url: normalizedContent.videoUrl };
            }

            if (lesson?.type === 'quiz') {
              const questions = Array.isArray(normalizedContent.questions)
                ? normalizedContent.questions
                : Array.isArray(body?.questions)
                  ? body.questions
                  : [];
              normalizedContent.questions = questions.map((question, index) => {
                const q = { ...(question || {}) };
                const correctIndex =
                  typeof q.correctAnswerIndex === 'number'
                    ? q.correctAnswerIndex
                    : null;
                if (Array.isArray(q.options)) {
                  q.options = q.options.map((option, optIndex) => {
                    if (typeof option === 'string') {
                      return {
                        id: `opt-${index + 1}-${optIndex + 1}`,
                        text: option,
                        correct: correctIndex === optIndex,
                      };
                    }
                    return {
                      ...(option || {}),
                      id: option?.id ?? `opt-${index + 1}-${optIndex + 1}`,
                      correct: option?.correct ?? option?.isCorrect ?? correctIndex === optIndex,
                    };
                  });
                }
                return q;
              });
            }

            const responseLessonId =
              (typeof lesson?.client_temp_id === 'string' && lesson.client_temp_id.trim()) ||
              (typeof lesson?.clientTempId === 'string' && lesson.clientTempId.trim()) ||
              lesson?.id;

            return {
              ...lesson,
              id: responseLessonId,
              content: normalizedContent,
              content_json: normalizedContent,
            };
          })
        : [],
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
  // Normalize whatever modules array was returned by the initial query.
  // If the initial SELECT already includes the full module/lesson graph (via
  // COURSE_WITH_MODULES_LESSONS_SELECT), this is a no-op normalisation only.
  // We NEVER issue a secondary per-course DB query here — that was the N+1 source.
  // Courses with no modules are genuinely empty and should be returned as [].
  if (Array.isArray(courseRecord.modules)) {
    return { ...courseRecord, modules: normalizeModuleGraph(courseRecord.modules, { includeLessons }) };
  }
  // modules field is absent (not fetched at all): return as-is, do not query.
  return { ...courseRecord, modules: [] };
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
const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
  contentLegacy: true,
  completionRuleJson: false,
  organizationId: true,
  courseId: true,
  clientTempId: true,
};

const extractCompletionRule = (record = {}) => {
  if (!record || typeof record !== 'object') return undefined;
  if (record.completion_rule_json !== undefined) return record.completion_rule_json;
  if (record.completionRule !== undefined) return record.completionRule;
  const contentSource = record.content_json ?? record.content ?? null;
  if (contentSource && typeof contentSource === 'object' && contentSource.completionRule !== undefined) {
    return contentSource.completionRule;
  }
  return undefined;
};

const attachCompletionRuleForResponse = (lesson = {}) => {
  const completionRule = extractCompletionRule(lesson);
  if (completionRule !== undefined) {
    lesson.completion_rule_json = completionRule;
    lesson.completionRule = completionRule;
  }
  return lesson;
};

const prepareLessonContentWithCompletionRule = (record = {}, completionRule) => {
  if (completionRule === undefined) return record;
  const target =
    record.content_json && typeof record.content_json === 'object' ? { ...record.content_json } : record.content ?? {};
  if (typeof target === 'object' && target !== null) {
    target.completionRule = completionRule;
    record.content_json = target;
    if (record.content && typeof record.content === 'object') {
      record.content = { ...record.content, completionRule };
    }
  }
  return record;
};

const applyLessonColumnSupport = (record = {}) => {
  if (!lessonColumnSupport.durationSeconds && 'duration_s' in record) {
    if (lessonColumnSupport.durationText && record.duration_s != null) {
      record.duration = record.duration ?? formatLegacyDuration(record.duration_s);
    }
    delete record.duration_s;
  }
  if (!lessonColumnSupport.durationText && 'duration' in record) {
    delete record.duration;
  }
  if (!lessonColumnSupport.contentJson && 'content_json' in record) {
    delete record.content_json;
  }
  if (!lessonColumnSupport.contentLegacy && 'content' in record) {
    delete record.content;
  }
  if (!lessonColumnSupport.completionRuleJson && 'completion_rule_json' in record) {
    delete record.completion_rule_json;
  }
  if (!lessonColumnSupport.organizationId && 'organization_id' in record) {
    delete record.organization_id;
  }
  if (!lessonColumnSupport.courseId && 'course_id' in record) {
    delete record.course_id;
  }
  if (!lessonColumnSupport.clientTempId && 'client_temp_id' in record) {
    delete record.client_temp_id;
  }
  return record;
};

const prepareLessonPersistencePayload = (lesson = {}) => {
  const clone = { ...lesson };
  const completionRule = extractCompletionRule(clone);
  prepareLessonContentWithCompletionRule(clone, completionRule);
  delete clone.completion_rule_json;
  delete clone.completionRule;
  return applyLessonColumnSupport(clone);
};

const moduleColumnSupport = {
  organizationId: true,
  description: true,
  clientTempId: true,
};

const coerceNullableText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeModuleLessonIdentifiers = (modulesInput = []) => {
  const result = { modulesNormalized: 0, lessonsNormalized: 0 };
  if (!Array.isArray(modulesInput)) return result;
  for (const module of modulesInput) {
    if (!module || typeof module !== 'object') continue;
    const rawModuleId = coerceNullableText(module.id);
    const existingModuleClientTempId = coerceNullableText(module.client_temp_id);
    if (!isUuid(rawModuleId)) {
      const generatedModuleId = randomUUID();
      module.client_temp_id = existingModuleClientTempId ?? rawModuleId ?? null;
      module.id = generatedModuleId;
      result.modulesNormalized += 1;
    } else {
      module.id = rawModuleId;
      module.client_temp_id = existingModuleClientTempId;
    }

    const lessons = Array.isArray(module.lessons) ? module.lessons : [];
    for (const lesson of lessons) {
      if (!lesson || typeof lesson !== 'object') continue;
      const rawLessonId = coerceNullableText(lesson.id);
      const existingLessonClientTempId = coerceNullableText(lesson.client_temp_id);
      if (!isUuid(rawLessonId)) {
        const generatedLessonId = randomUUID();
        lesson.client_temp_id = existingLessonClientTempId ?? rawLessonId ?? null;
        lesson.id = generatedLessonId;
        result.lessonsNormalized += 1;
      } else {
        lesson.id = rawLessonId;
        lesson.client_temp_id = existingLessonClientTempId;
      }

      const rawLessonModuleId = coerceNullableText(lesson.module_id);
      if (!rawLessonModuleId || !isUuid(rawLessonModuleId)) {
        lesson.module_id = module.id;
      } else {
        lesson.module_id = rawLessonModuleId;
      }
    }
    module.lessons = lessons;
  }
  return result;
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
    case 'client_temp_id':
      if (lessonColumnSupport.clientTempId) {
        lessonColumnSupport.clientTempId = false;
        logger.warn('lessons_client_temp_id_column_missing', { code: error.code ?? null });
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
  if (missingColumn === 'description' && moduleColumnSupport.description) {
    moduleColumnSupport.description = false;
    logger.warn('modules_description_column_missing', { code: error?.code ?? null });
    return true;
  }
  if (missingColumn === 'client_temp_id' && moduleColumnSupport.clientTempId) {
    moduleColumnSupport.clientTempId = false;
    logger.warn('modules_client_temp_id_column_missing', { code: error?.code ?? null });
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

const logCourseRequestEvent = (event, meta = {}) => {
  logger.info(event, {
    requestId: meta.requestId ?? null,
    userId: meta.userId ?? null,
    orgId: meta.orgId ?? null,
    courseId: meta.courseId ?? null,
    statusCode: meta.status ?? null,
    errorCode: meta.errorCode ?? null,
    message: meta.message ?? null,
  });
};

const buildValidationIssue = (path, expected, received) => ({
  path,
  expected,
  received,
});

const collectInvalidIdentifierIssues = (modulesInput = []) => {
  const issues = [];
  if (!Array.isArray(modulesInput)) return issues;
  modulesInput.forEach((module, moduleIndex) => {
    if (!module || typeof module !== 'object') return;
    const moduleId = coerceNullableText(module.id);
    if (!isUuid(moduleId)) {
      issues.push(buildValidationIssue(`modules[${moduleIndex}].id`, 'uuid', moduleId ?? null));
    }
    const lessons = Array.isArray(module.lessons) ? module.lessons : [];
    lessons.forEach((lesson, lessonIndex) => {
      if (!lesson || typeof lesson !== 'object') return;
      const lessonId = coerceNullableText(lesson.id);
      if (!isUuid(lessonId)) {
        issues.push(
          buildValidationIssue(
            `modules[${moduleIndex}].lessons[${lessonIndex}].id`,
            'uuid',
            lessonId ?? null,
          ),
        );
      }
    });
  });
  return issues;
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

const NOTIFICATIONS_TABLE_MISSING_CODE = 'PGRST205';
const isNotificationsTableMissingError = (error) =>
  Boolean(error && typeof error.code === 'string' && error.code === NOTIFICATIONS_TABLE_MISSING_CODE);

const logNotificationsMissingTable = (label, context = {}) => {
  logger.warn('notifications_table_missing', { label, ...context });
};

const mapNotificationRecord = (row) => {
  if (!row || typeof row !== 'object') {
    return row;
  }
  const resolvedOrgId = normalizeOrgIdValue(row.organization_id);
  return {
    ...row,
    organization_id: resolvedOrgId,
  };
};

const buildDisabledNotificationsResponse = (page = 1, pageSize = 25, requestId = null) => ({
  ok: true,
  data: [],
  pagination: {
    page,
    pageSize,
    total: 0,
    hasMore: false,
  },
  notificationsDisabled: true,
  requestId,
});

async function runNotificationQuery(queryFactory, attempt = 0) {
  if (!ENABLE_NOTIFICATIONS || !supabase) {
    return [];
  }
  const selectColumns = buildNotificationSelectColumns();
  const query = queryFactory(selectColumns);
  try {
    const { data, error } = await query;

    if (error && isMissingColumnError(error) && attempt < OPTIONAL_NOTIFICATION_COLUMNS.length) {
      const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
      if (
        missingColumn &&
        OPTIONAL_NOTIFICATION_COLUMN_SET.has(missingColumn) &&
        !notificationColumnSuppression.has(missingColumn)
      ) {
        notificationColumnSuppression.add(missingColumn);
        logger.warn('notifications_optional_column_missing', { column: missingColumn, code: error.code });
        return runNotificationQuery(queryFactory, attempt + 1);
      }
    }

    if (error) {
      if (isNotificationsTableMissingError(error)) {
        logNotificationsMissingTable('learner.query', { code: error.code });
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('learner.query.catch', {});
      return [];
    }
    logger.warn('notifications_fetch_failed', {
      label: 'learner.query',
      message: error?.message || String(error),
    });
    return [];
  }
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
    if (assignmentRecord.assignedTo) {
      normalized.organizationIds = coerceIdArray(assignmentRecord.assignedTo.organizationIds);
      normalized.userIds = coerceIdArray(assignmentRecord.assignedTo.userIds);
      normalized.cohortIds = coerceIdArray(assignmentRecord.assignedTo.cohortIds);
      normalized.departmentIds = coerceIdArray(assignmentRecord.assignedTo.departmentIds);
    } else {
      normalized.organizationIds = coerceIdArray(assignmentRecord.organization_ids);
      normalized.userIds = coerceIdArray(assignmentRecord.user_ids);
      normalized.cohortIds = coerceIdArray(assignmentRecord.cohort_ids);
      normalized.departmentIds = coerceIdArray(assignmentRecord.department_ids);
    }
  }

  return {
    ...survey,
    assignedTo: normalized,
    assigned_to: normalized,
    assignmentRows: assignmentRecord?.rows ?? [],
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

// Runtime column support flags for the surveys table.
// When a Supabase upsert/update returns a missing-column error for a column that
// was added after the initial schema was deployed, we flip the flag off so
// subsequent writes omit that column until a migration adds it.
const surveyColumnSupport = {
  blocks: true,
  defaultLanguage: true,
  supportedLanguages: true,
  completionSettings: true,
  reflectionPrompts: true,
};

const maybeHandleSurveyColumnError = (error) => {
  const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
  if (!missingColumn) return false;
  if (missingColumn === 'blocks' && surveyColumnSupport.blocks) {
    surveyColumnSupport.blocks = false;
    logger.warn('surveys_blocks_column_missing', { code: error?.code ?? null });
    return true;
  }
  if (missingColumn === 'default_language' && surveyColumnSupport.defaultLanguage) {
    surveyColumnSupport.defaultLanguage = false;
    logger.warn('surveys_default_language_column_missing', { code: error?.code ?? null });
    return true;
  }
  if (missingColumn === 'supported_languages' && surveyColumnSupport.supportedLanguages) {
    surveyColumnSupport.supportedLanguages = false;
    logger.warn('surveys_supported_languages_column_missing', { code: error?.code ?? null });
    return true;
  }
  if (missingColumn === 'completion_settings' && surveyColumnSupport.completionSettings) {
    surveyColumnSupport.completionSettings = false;
    logger.warn('surveys_completion_settings_column_missing', { code: error?.code ?? null });
    return true;
  }
  if (missingColumn === 'reflection_prompts' && surveyColumnSupport.reflectionPrompts) {
    surveyColumnSupport.reflectionPrompts = false;
    logger.warn('surveys_reflection_prompts_column_missing', { code: error?.code ?? null });
    return true;
  }
  return false;
};

const buildSurveyPersistencePayload = (payload = {}) => {
  const incomingId = typeof payload.id === 'string' ? payload.id.trim() : null;
  const persistedId = incomingId && isUuid(incomingId) ? incomingId : undefined;
  if (incomingId && !persistedId) {
    logger.warn('survey_upsert_ignoring_non_uuid_id', { incomingId });
  }

  const baseSettings =
    payload.settings && typeof payload.settings === 'object' && !Array.isArray(payload.settings)
      ? { ...payload.settings }
      : {};
  const existingClientIdentifier =
    typeof baseSettings.clientIdentifier === 'string' ? baseSettings.clientIdentifier.trim() : '';
  if (incomingId && !persistedId && !existingClientIdentifier) {
    baseSettings.clientIdentifier = incomingId;
  }

  const shaped = {
    id: persistedId,
    title: payload.title,
    description: payload.description ?? null,
    type: payload.type ?? null,
    status: payload.status ?? 'draft',
    sections: payload.sections ?? [],
    branding: payload.branding ?? {},
    settings: baseSettings,
    updated_at: new Date().toISOString(),
  };

  // Only include columns that are confirmed present in the schema.
  // If the migration hasn't run yet, the flag will be false and we omit the
  // column so the upsert doesn't fail. Once the migration runs, a server
  // restart resets the flag to true and the column is included again.
  if (surveyColumnSupport.blocks) {
    shaped.blocks = payload.blocks ?? [];
  }
  if (surveyColumnSupport.defaultLanguage) {
    shaped.default_language = payload.defaultLanguage ?? payload.default_language ?? 'en';
  }
  if (surveyColumnSupport.supportedLanguages) {
    shaped.supported_languages = payload.supportedLanguages ?? payload.supported_languages ?? ['en'];
  }
  if (surveyColumnSupport.completionSettings) {
    shaped.completion_settings = payload.completionSettings ?? payload.completion_settings ?? buildDefaultSurveyCompletionSettings();
  }
  if (surveyColumnSupport.reflectionPrompts) {
    shaped.reflection_prompts = payload.reflectionPrompts ?? payload.reflection_prompts ?? [];
  }

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
    if (e2eStore.surveys.has(seed.id)) {
      if (isDemoOrTestMode) {
        const existing = e2eStore.surveys.get(seed.id) || {};
        const existingAssigned =
          existing.assigned_to ||
          existing.assignedTo ||
          createEmptyAssignedTo();
        const currentOrgIds = Array.isArray(existingAssigned.organizationIds)
          ? existingAssigned.organizationIds.map((value) => String(value))
          : [];
        const seededOrgIds = Array.isArray(seed.organizationIds)
          ? seed.organizationIds.map((value) => String(value))
          : [];
        const mergedOrgIds = Array.from(
          new Set([
            ...currentOrgIds,
            ...seededOrgIds,
            DEFAULT_SANDBOX_ORG_ID,
          ]),
        );
        const shouldUpdate = mergedOrgIds.some((orgId) => !currentOrgIds.includes(orgId));
        if (shouldUpdate) {
          const nextAssignedTo = {
            ...createEmptyAssignedTo(),
            ...existingAssigned,
            organizationIds: mergedOrgIds,
          };
          const updatedRecord = {
            ...existing,
            assigned_to: nextAssignedTo,
            updated_at: new Date().toISOString(),
          };
          e2eStore.surveys.set(seed.id, updatedRecord);
          updateDemoSurveyAssignments(seed.id, nextAssignedTo);
          changed = true;
        }
      }
      continue;
    }
    const assignedTo = createEmptyAssignedTo();
    const seededOrgIds = [...(seed.organizationIds || [])];
    if (isDemoOrTestMode) {
      if (!seededOrgIds.includes(DEFAULT_SANDBOX_ORG_ID)) {
        seededOrgIds.push(DEFAULT_SANDBOX_ORG_ID);
      }
    }
    assignedTo.organizationIds = seededOrgIds;
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
  const canonicalId = surveyIdentifierAliasMap.get(id) ?? id;
  const survey = e2eStore.surveys.get(canonicalId) || e2eStore.surveys.get(id);
  if (!survey) return null;
  const assignmentKey = survey.id ?? canonicalId;
  return applyAssignmentToSurvey(deepClone(survey), e2eStore.surveyAssignments.get(assignmentKey));
};

const surveyIdentifierAliasMap = new Map();

const rememberSurveyIdentifierAlias = (identifier, surveyId) => {
  const alias = typeof identifier === 'string' ? identifier.trim() : '';
  const canonical = typeof surveyId === 'string' ? surveyId.trim() : '';
  if (!alias || !canonical || alias === canonical) return;
  surveyIdentifierAliasMap.set(alias, canonical);
};

const resolveSurveyIdentifierToCanonicalId = async (identifier) => {
  const normalized = typeof identifier === 'string' ? identifier.trim() : '';
  if (!normalized) return null;

  const mapped = surveyIdentifierAliasMap.get(normalized);
  if (mapped) return mapped;

  if (!supabase || isUuid(normalized)) {
    return normalized;
  }

  const lookupStrategies = [
    () =>
      supabase
        .from('surveys')
        .select('id')
        .eq('settings->>clientIdentifier', normalized)
        .limit(1)
        .maybeSingle(),
    () =>
      supabase
        .from('surveys')
        .select('id')
        .contains('settings', { clientIdentifier: normalized })
        .limit(1)
        .maybeSingle(),
  ];

  for (const lookup of lookupStrategies) {
    try {
      const { data, error } = await lookup();
      if (error) {
        if (isMissingColumnError(error) || isMissingRelationError(error)) {
          return normalized;
        }
        logger.warn('survey_identifier_lookup_strategy_failed', {
          identifier: normalized,
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        continue;
      }
      if (data?.id) {
        rememberSurveyIdentifierAlias(normalized, data.id);
        return data.id;
      }
    } catch (error) {
      logger.warn('survey_identifier_resolution_failed', {
        identifier: normalized,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
    }
  }

  return normalized;
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

  if ((isDemoMode) && Array.isArray(e2eStore.assignments)) {
    const map = new Map();
    const normalizedIds = surveyIds.filter(Boolean).map((id) => String(id));
    const idSet = new Set(normalizedIds);
    if (!idSet.size) {
      return map;
    }
    const grouped = new Map();
    for (const rawAssignment of e2eStore.assignments) {
      if (!rawAssignment) continue;
      const assignmentType = rawAssignment.assignment_type ?? rawAssignment.assignmentType ?? null;
      if (assignmentType && assignmentType !== SURVEY_ASSIGNMENT_TYPE) continue;
      const surveyId = rawAssignment.survey_id ?? rawAssignment.surveyId ?? null;
      if (!surveyId || !idSet.has(String(surveyId))) continue;
      if (!grouped.has(String(surveyId))) {
        grouped.set(String(surveyId), []);
      }
      grouped.get(String(surveyId)).push(rawAssignment);
    }
    grouped.forEach((rows, surveyId) => {
      const aggregate = createEmptyAssignedTo();
      const orgSet = new Set();
      const userSet = new Set();
      rows.forEach((row) => {
        const orgId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
        if (orgId) orgSet.add(String(orgId));
        const userId = row.user_id ?? row.userId ?? null;
        if (userId) userSet.add(String(userId));
      });
      aggregate.organizationIds = Array.from(orgSet);
      aggregate.userIds = Array.from(userSet);
      map.set(surveyId, { assignedTo: aggregate, rows });
    });
    return map;
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

  try {
    const map = new Map();
    const normalizedIds = surveyIds.filter(Boolean);
    if (!normalizedIds.length) {
      return map;
    }
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(
          'id,survey_id,organization_id,user_id,status,due_at,note,assigned_by,metadata,active,created_at,updated_at',
        )
        .eq('assignment_type', 'survey')
        .in('survey_id', normalizedIds);
      if (error) throw error;
      const grouped = new Map();
      (data || []).forEach((row) => {
        if (!row?.survey_id) return;
        if (!grouped.has(row.survey_id)) {
          grouped.set(row.survey_id, []);
        }
        grouped.get(row.survey_id).push(row);
      });
      grouped.forEach((rows, surveyId) => {
        const aggregate = createEmptyAssignedTo();
        const orgSet = new Set();
        const userSet = new Set();
        rows.forEach((row) => {
          if (row.organization_id) orgSet.add(String(row.organization_id));
          if (row.user_id) userSet.add(String(row.user_id));
        });
        aggregate.organizationIds = Array.from(orgSet);
        aggregate.userIds = Array.from(userSet);
        map.set(surveyId, { assignedTo: aggregate, rows });
      });
      const missingIds = normalizedIds.filter((id) => !map.has(id));
      if (missingIds.length) {
        const { data: legacyRows } = await supabase
          .from('survey_assignments')
          .select('*')
          .in('survey_id', missingIds);
        (legacyRows || []).forEach((row) => {
          if (row?.survey_id) {
            map.set(row.survey_id, { legacy: row });
          }
        });
      }
      return map;
    } catch (error) {
      const invalidUuidFilter =
        error?.code === '22P02' ||
        (typeof error?.message === 'string' && error.message.includes('invalid input syntax for type uuid'));
      if (invalidUuidFilter) {
        logger.warn('survey_assignments_query_invalid_uuid_filter', {
          surveyIds: normalizedIds,
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        return map;
      }
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        logger.warn('survey_assignments_table_unavailable', {
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        return new Map();
      }
      throw error;
    }
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      logger.warn('survey_assignments_table_unavailable', {
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return new Map();
    }
    throw error;
  }
};

const loadSurveyWithAssignments = async (id) => {
  if (!id) return null;
  const canonicalId = await resolveSurveyIdentifierToCanonicalId(id);
  if (!canonicalId) return null;
  if (!supabase) {
    return getDemoSurveyById(canonicalId);
  }
  let data = null;
  let error = null;
  ({ data, error } = await supabase.from('surveys').select('*').eq('id', canonicalId).maybeSingle());
  if (error) {
    const invalidUuidFilter =
      error?.code === '22P02' ||
      (typeof error?.message === 'string' && error.message.includes('invalid input syntax for type uuid'));
    if (!invalidUuidFilter) {
      throw error;
    }
    return null;
  }
  if (!data) return null;
  rememberSurveyIdentifierAlias(id, data.id);
  const assignments = await fetchSurveyAssignmentsMap([data.id]);
  return applyAssignmentToSurvey({ ...data }, assignments.get(data.id));
};

const refreshSurveyAssignmentAggregates = async (surveyId) => {
  if (!surveyId || !supabase) return false;
  try {
    const { error } = await supabase.rpc('refresh_survey_assignment_aggregates', {
      target_survey_id: surveyId,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    if (isMissingFunctionError(error) || isMissingRelationError(error) || isMissingColumnError(error)) {
      if (!surveyAssignmentAggregateRpcMissingLogged) {
        surveyAssignmentAggregateRpcMissingLogged = true;
        logger.warn('survey_assignment_aggregate_refresh_unavailable', {
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
      }
      return false;
    }
    throw error;
  }
};

const ensureSurveyAssignmentsForUserFromOrgScope = async ({ userId, orgIds = [], surveyFilter = [] } = {}) => {
  if (!supabase || !userId || !Array.isArray(orgIds) || orgIds.length === 0) return;
  try {
    let orgQuery = supabase
      .from('assignments')
      .select(SURVEY_ASSIGNMENT_SELECT)
      .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
      .in('organization_id', orgIds)
      .is('user_id', null)
      .eq('active', true);

    if (Array.isArray(surveyFilter) && surveyFilter.length > 0) {
      orgQuery = orgQuery.in('survey_id', surveyFilter);
    }

    const { data: orgAssignments, error: orgError } = await orgQuery;
    if (orgError) throw orgError;
    if (!orgAssignments || orgAssignments.length === 0) return;

    const surveyIds = Array.from(new Set(orgAssignments.map((row) => row?.survey_id).filter(Boolean)));
    if (surveyIds.length === 0) return;

    const { data: existingRows, error: existingError } = await supabase
      .from('assignments')
      .select('survey_id')
      .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
      .eq('user_id', userId)
      .in('survey_id', surveyIds);
    if (existingError) throw existingError;

    const existingSet = new Set((existingRows || []).map((row) => row?.survey_id).filter(Boolean));
    const inserts = [];
    surveyIds.forEach((surveyId) => {
      if (existingSet.has(surveyId)) {
        return;
      }
      const source = orgAssignments.find((row) => row?.survey_id === surveyId);
      if (!source) return;
      inserts.push({
        survey_id: surveyId,
        course_id: null,
        organization_id: source.organization_id ?? null,
        user_id: userId,
        assignment_type: SURVEY_ASSIGNMENT_TYPE,
        status: source.status ?? 'assigned',
        due_at: source.due_at ?? null,
        note: source.note ?? null,
        assigned_by: source.assigned_by ?? null,
        metadata: {
          ...(source.metadata && typeof source.metadata === 'object' ? source.metadata : {}),
          assigned_via: 'org_rollup',
        },
        active: true,
      });
    });

    if (!inserts.length) return;

    const { error: insertError } = await supabase.from('assignments').insert(inserts);
    if (insertError) throw insertError;

    const affectedSurveyIds = Array.from(new Set(inserts.map((row) => row.survey_id).filter(Boolean)));
    await Promise.all(affectedSurveyIds.map((surveyId) => refreshSurveyAssignmentAggregates(surveyId)));
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      logger.warn('survey_assignment_user_materialize_skipped', {
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return;
    }
    throw error;
  }
};

const ensureCourseAssignmentsForUserFromOrgScope = async ({ userId, orgIds = [], courseFilter = [] } = {}) => {
  if (!supabase || !userId || !Array.isArray(orgIds) || orgIds.length === 0) return;
  try {
    let orgQuery = supabase
      .from('assignments')
      .select('id,course_id,organization_id,user_id,status,due_at,note,assigned_by,metadata,active,created_at,updated_at,assignment_type')
      .in('organization_id', orgIds)
      .is('user_id', null)
      .eq('active', true);

    if (Array.isArray(courseFilter) && courseFilter.length > 0) {
      orgQuery = orgQuery.in('course_id', courseFilter);
    }

    const { data: orgAssignments, error: orgError } = await orgQuery;
    if (orgError) throw orgError;
    if (!orgAssignments || orgAssignments.length === 0) return;

    const courseAssignments = orgAssignments.filter((row) => {
      const assignmentType = row?.assignment_type ?? null;
      return assignmentType === null || assignmentType === 'course';
    });
    if (courseAssignments.length === 0) return;

    const courseIds = Array.from(new Set(courseAssignments.map((row) => row?.course_id).filter(Boolean)));
    if (courseIds.length === 0) return;

    const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
    const isUserIdUuid = isUuid(userId);
    let existingQuery = supabase.from('assignments').select('course_id').in('course_id', courseIds);
    if (assignmentsSupportUserIdUuid && isUserIdUuid) {
      existingQuery = existingQuery.or(`user_id.eq.${userId},user_id_uuid.eq.${userId}`);
    } else {
      existingQuery = existingQuery.eq('user_id', userId);
    }
    const { data: existingRows, error: existingError } = await existingQuery;
    if (existingError) {
      const invalidUuidFilter =
        existingError?.code === '22P02' ||
        (typeof existingError?.message === 'string' && existingError.message.includes('invalid input syntax for type uuid'));
      if (invalidUuidFilter) {
        logger.warn('client_assignments_materialize_invalid_user_id_filter', {
          userId,
          message: existingError?.message ?? null,
        });
        return;
      }
      throw existingError;
    }

    const existingSet = new Set((existingRows || []).map((row) => row?.course_id).filter(Boolean));
    const inserts = [];
    courseIds.forEach((courseId) => {
      if (existingSet.has(courseId)) {
        return;
      }
      const source = courseAssignments.find((row) => row?.course_id === courseId);
      if (!source) return;
      inserts.push({
        course_id: courseId,
        survey_id: null,
        organization_id: source.organization_id ?? null,
        user_id: userId,
        assignment_type: 'course',
        status: source.status ?? 'assigned',
        due_at: source.due_at ?? null,
        note: source.note ?? null,
        assigned_by: source.assigned_by ?? null,
        metadata: {
          ...(source.metadata && typeof source.metadata === 'object' ? source.metadata : {}),
          assigned_via: 'org_rollup',
        },
        active: true,
      });
    });

    if (!inserts.length) return;

    const { error: insertError } = await supabase.from('assignments').insert(inserts);
    if (insertError) throw insertError;
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      logger.warn('course_assignment_user_materialize_skipped', {
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return;
    }
    throw error;
  }
};

const loadSurveyAssignmentForUser = async (
  surveyId,
  userId,
  { assignmentId = null, orgIds = [], allowSelfEnroll = true } = {},
) => {
  if (!supabase || !surveyId || !userId) return null;
  try {
    if (assignmentId) {
      const { data, error } = await supabase
        .from('assignments')
        .select(SURVEY_ASSIGNMENT_SELECT)
        .eq('id', assignmentId)
        .eq('survey_id', surveyId)
        .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    }

    const { data: existing, error: existingError } = await supabase
      .from('assignments')
      .select(SURVEY_ASSIGNMENT_SELECT)
      .eq('survey_id', surveyId)
      .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;

    if (Array.isArray(orgIds) && orgIds.length > 0) {
      await ensureSurveyAssignmentsForUserFromOrgScope({ userId, orgIds, surveyFilter: [surveyId] });
      const { data: hydrated, error: hydratedError } = await supabase
        .from('assignments')
        .select(SURVEY_ASSIGNMENT_SELECT)
        .eq('survey_id', surveyId)
        .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
        .eq('user_id', userId)
        .maybeSingle();
      if (hydratedError) throw hydratedError;
      if (hydrated) return hydrated;
    }

    if (!allowSelfEnroll) {
      return null;
    }

    const _assignInsert = await supabase
      .from('assignments')
      .insert({
        survey_id: surveyId,
        course_id: null,
        user_id: userId,
        assignment_type: SURVEY_ASSIGNMENT_TYPE,
        status: 'assigned',
        active: true,
        metadata: { assigned_via: 'learner_self_enroll' },
      })
      .select(SURVEY_ASSIGNMENT_SELECT);
    if (_assignInsert.error) throw _assignInsert.error;
    const created = firstRow(_assignInsert);
    await refreshSurveyAssignmentAggregates(surveyId);
    return created ?? null;
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      logger.warn('survey_assignment_load_skipped', {
        surveyId,
        userId,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return null;
    }
    throw error;
  }
};

const syncSurveyAssignments = async (surveyId, assignedTo = createEmptyAssignedTo()) => {
  if (!surveyId) return;
  if (!supabase) {
    updateDemoSurveyAssignments(surveyId, assignedTo);
    return;
  }

  let refreshed = false;
  try {
    refreshed = await refreshSurveyAssignmentAggregates(surveyId);
  } catch (error) {
    logger.warn('survey_assignment_refresh_failed', {
      surveyId,
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
  }
  if (refreshed) return;

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
    try {
      const { error } = await supabase.from('survey_assignments').delete().eq('survey_id', surveyId);
      if (error) throw error;
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        logger.warn('survey_assignments_delete_skipped', {
          surveyId,
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        return;
      }
      throw error;
    }
    return;
  }

  try {
    const { error } = await supabase.from('survey_assignments').upsert(payload);
    if (error) throw error;
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      logger.warn('survey_assignments_sync_skipped', {
        surveyId,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return;
    }
    throw error;
  }
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

const resolveOrgScopeFromRequest = (req, context, options = {}) => {
  const { requireExplicitSelection = false } = options;
  const rawHeaderOrg =
    req.organizationId ??
    req.activeOrgId ??
    req.headers?.['x-organization-id'] ??
    req.headers?.['x-org-id'] ??
    null;
  const contextActiveOrgId = context?.activeOrganizationId ?? context?.requestedOrgId ?? null;
  const membershipOrgIds = Array.isArray(context?.memberships)
    ? context.memberships
        .map((membership) =>
          normalizeOrgIdValue(
            pickOrgId(
              membership.organization_id,
              membership.organizationId,
              membership.org_id,
              membership.orgId,
            ),
          ),
        )
        .filter(Boolean)
    : [];
  const organizationIds = Array.isArray(context?.organizationIds)
    ? context.organizationIds.map((orgId) => normalizeOrgIdValue(orgId)).filter(Boolean)
    : [];
  const membershipSet = new Set([...membershipOrgIds, ...organizationIds]);
  const canUseOrg = (candidate) => {
    const normalized = normalizeOrgIdValue(candidate);
    if (!normalized) return null;
    if (context?.isPlatformAdmin) {
      return normalized;
    }
    return membershipSet.has(normalized) ? normalized : null;
  };
  const orderedCandidates = [
    rawHeaderOrg,
    contextActiveOrgId,
    context?.requestedOrgId,
    context?.user?.organizationId,
  ];
  for (const candidate of orderedCandidates) {
    const allowed = canUseOrg(candidate);
    if (allowed) {
      return { orgId: allowed, requiresExplicitSelection: false };
    }
  }
  if (requireExplicitSelection && !context?.isPlatformAdmin) {
    const distinctMembershipOrgIds = Array.from(new Set([...membershipOrgIds, ...organizationIds]));
    if (distinctMembershipOrgIds.length > 1) {
      return { orgId: null, requiresExplicitSelection: true };
    }
  }
  if (membershipOrgIds.length > 0) {
    return { orgId: membershipOrgIds[0], requiresExplicitSelection: false };
  }
  if (organizationIds.length > 0) {
    return { orgId: organizationIds[0], requiresExplicitSelection: false };
  }
  return { orgId: null, requiresExplicitSelection: false };
};

const resolveOrgIdFromRequest = (req, context) => {
  return resolveOrgScopeFromRequest(req, context).orgId;
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

// ─── Startup: purge E2E / Integration Test courses from e2eStore ─────────────
// demo-data.json accumulates Integration Test Course entries during E2E runs.
// These must never appear in the admin course list for real users.  Purge them
// here, before any request handler can serve them, and persist the clean state.
const E2E_COURSE_PATTERNS = [
  /\be2e\b/i,
  /\bintegration[_\s-]?test\b/i,
  /\bplaywright\b/i,
  /\bcypress\b/i,
  /^e2e-course-/i,
  /^test[-_\s]/i,
  /[-_\s]test$/i,
  /__test__/i,
  /_e2e_/i,
];
const isE2ECourseEntry = (course) => {
  if (!course) return false;
  if (course.isTestData === true || course.is_test_data === true) return true;
  if (course.meta_json && typeof course.meta_json === 'object' && course.meta_json.isTestData === true) return true;
  const candidates = [course.id, course.title, course.slug, ...(Array.isArray(course.tags) ? course.tags : [])];
  return E2E_COURSE_PATTERNS.some((re) => candidates.some((c) => typeof c === 'string' && re.test(c)));
};
let e2ePurgeCount = 0;
// ─── Startup: purge E2E / Integration Test courses from e2eStore ─────────────
// Only meaningful in demo/E2E mode where e2eStore.courses was populated from disk.
// When Supabase is configured, e2eStore.courses is empty so this is a no-op.
for (const [id, course] of e2eStore.courses.entries()) {
  if (isE2ECourseEntry(course)) {
    e2eStore.courses.delete(id);
    e2ePurgeCount += 1;
  }
}
if (e2ePurgeCount > 0) {
  console.log(`🧹 Purged ${e2ePurgeCount} E2E/Integration Test course(s) from persistent storage`);
  // Persist the cleaned state so they don't reload on the next server restart.
  savePersistedData(e2eStore);
}

if (supabaseServerConfigured && !isFallbackMode) {
  // ✅ PRODUCTION / SUPABASE MODE
  // Supabase is the sole source of truth. Do NOT seed or load any courses from
  // demo-data.json. The e2eStore.courses Map is intentionally empty here.
  // "Loaded X course(s) from persistent storage" will never appear in this mode.
  logger.info('course_source_supabase_only', {
    message: 'Supabase configured — courses served exclusively from DB. File-based store disabled.',
  });
} else if (isFallbackMode) {
  // ─── Demo / E2E mode only ─────────────────────────────────────────────────
  // Log loaded courses
  if (e2eStore.courses.size > 0) {
    console.log(`✅ Loaded ${e2eStore.courses.size} course(s) from persistent storage`);
    for (const [, course] of e2eStore.courses.entries()) {
      console.log(`   - ${course.title} (${course.id})`);
    }
  } else {
    // Seed a demo course if no courses exist in demo mode
    console.log('📚 No courses found in demo mode. Seeding demo course...');
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
                videoType: 'ted',
                completionRule: { requiredPercent: 85 },
              }
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
                ],
                completionRule: { requiredScore: 70 },
              }
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
              }
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
              }
            }
          ]
        }
      ]
    };
    e2eStore.courses.set('foundations', demoCourse);
    savePersistedData(e2eStore);
    console.log('✅ Demo course seeded successfully');
  }
} else {
  // No Supabase, no demo flags — log a warning but do not seed fake data.
  logger.warn('course_source_unavailable', {
    message: 'Neither Supabase credentials nor isDemoMode/isTestMode are configured. Course endpoints will return empty results.',
  });
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
  if (isDemoOrTestMode) {
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
  lessonProgressOrgColumn: 'unknown',
  courseProgress: 'unknown',
  // user_course_progress has no 'percent' column — the canonical column is 'progress'.
  // Initializing as 'missing' prevents a guaranteed-to-fail write attempt on every server restart.
  courseProgressPercentColumn: 'missing',
  courseProgressTimeColumn: 'unknown',
};

const LESSON_PROGRESS_CANONICAL_ORG_COLUMN = 'organization_id';
const LESSON_PROGRESS_LEGACY_ORG_COLUMN = 'org_id';

const getLessonProgressOrgColumn = () => {
  const preference = schemaSupportFlags.lessonProgressOrgColumn;
  if (preference === 'missing') {
    return null;
  }
  if (preference === LESSON_PROGRESS_LEGACY_ORG_COLUMN) {
    return LESSON_PROGRESS_LEGACY_ORG_COLUMN;
  }
  return LESSON_PROGRESS_CANONICAL_ORG_COLUMN;
};

const handleLessonOrgColumnMissing = (missingColumn) => {
  if (!missingColumn) return false;
  const lower = missingColumn.toLowerCase();
  if (lower === LESSON_PROGRESS_CANONICAL_ORG_COLUMN) {
    schemaSupportFlags.lessonProgressOrgColumn =
      schemaSupportFlags.lessonProgressOrgColumn === LESSON_PROGRESS_LEGACY_ORG_COLUMN
        ? 'missing'
        : LESSON_PROGRESS_LEGACY_ORG_COLUMN;
    logger.warn('lesson_progress_org_column_missing', {
      missingColumn: lower,
      fallback: schemaSupportFlags.lessonProgressOrgColumn,
    });
    return true;
  }
  if (lower === LESSON_PROGRESS_LEGACY_ORG_COLUMN) {
    schemaSupportFlags.lessonProgressOrgColumn = LESSON_PROGRESS_CANONICAL_ORG_COLUMN;
    logger.warn('lesson_progress_legacy_org_column_missing', {
      missingColumn: lower,
      fallback: schemaSupportFlags.lessonProgressOrgColumn,
    });
    return true;
  }
  return false;
};

const attachLessonOrgScope = (record, orgId) => {
  if (!record || !orgId) return;
  record.organization_id = orgId;
  // canonical only; legacy org_id removed as per compatibility removal plan
  delete record.org_id;
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
    queryName: restExtraMeta?.queryName ?? null,
  };
  logStructuredError(`[admin-courses] ${label}`, err, meta);
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

// Global structured error logger for admin courses and other modules
const logStructuredError = (label, error, meta = {}) => {
  const normalized = normalizeUnknownError(error);
  const payload = {
    label,
    ...meta,
    ...normalized,
    rawError: safeSerializeError(error),
  };
  try {
    logger.error('structured_error', payload);
  } catch (_) {
    console.error('[structured_error]', payload);
  }
  return normalized;
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
      if (maybeHandleLessonColumnError && maybeHandleLessonColumnError(error)) {
        attempt += 1;
        continue;
      }
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

// ---------------------------------------------------------------------------
// Supabase query timeout + safe first-row helpers
// ---------------------------------------------------------------------------

/** Wraps any Supabase promise in a timeout. Rejects with a structured error
 *  when Supabase takes longer than `ms` milliseconds (default 5 000 ms).
 *  Use this instead of awaiting Supabase calls directly in admin routes. */
const SUPABASE_QUERY_TIMEOUT_MS = Number(process.env.SUPABASE_QUERY_TIMEOUT_MS || 5000);

const withSupabaseTimeout = (promise, label = 'supabase_query') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${SUPABASE_QUERY_TIMEOUT_MS}ms`);
      err.code = 'SUPABASE_TIMEOUT';
      err.label = label;
      reject(err);
    }, SUPABASE_QUERY_TIMEOUT_MS);

    Promise.resolve(promise)
      .then((value) => { clearTimeout(timer); resolve(value); })
      .catch((error) => { clearTimeout(timer); reject(error); });
  });
};

/** Runs a Supabase query builder fn with timeout + schema retry.
 *  Returns the full PostgREST result object { data, error, count }.
 *  Throws on error or timeout. */
const runTimedQuery = (label, buildQuery) =>
  withSupabaseTimeout(runSupabaseQueryWithRetry(label, buildQuery), label);

/** Extract the first row from an INSERT/UPDATE/UPSERT result safely.
 *  Replaces .single() — tolerates multiple rows (duplicates) without throwing PGRST116.
 *  @param {{ data: unknown }} result - PostgREST result object
 *  @returns {object|null} first row or null */
const firstRow = (result) => {
  const rows = Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
  return rows[0] ?? null;
};

/** Log a structured admin-route error with consistent fields. */
const logAdminError = (label, error, meta = {}) => {
  const code = error?.code ?? 'unknown';
  const message = error?.message ?? String(error ?? 'unknown error');
  const isTimeout = code === 'SUPABASE_TIMEOUT';
  const isPgrst = String(code).startsWith('PGRST');
  console.error(`[admin.error] ${label}`, {
    code,
    message,
    isTimeout,
    isPgrst,
    ...meta,
  });
  return { code, message, isTimeout, isPgrst };
};

const ORG_PROGRESS_VIEW = 'org_onboarding_progress_vw';
let orgProgressViewStatus = { checked: false, available: false };
const ensureOrgProgressViewAvailable = async () => {
  if (!supabase) return false;
  if (orgProgressViewStatus.checked) {
    return orgProgressViewStatus.available;
  }
  try {
    const { error } = await supabase.from(ORG_PROGRESS_VIEW).select('org_id', { head: true }).limit(1);
    if (error) throw error;
    orgProgressViewStatus = { checked: true, available: true };
    return true;
  } catch (error) {
    if (
      isSchemaMismatchError(error) ||
      error?.code === '42P01' ||
      String(error?.message || '').toLowerCase().includes(ORG_PROGRESS_VIEW)
    ) {
      console.warn('[admin.organizations.progress] view_unavailable', {
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      orgProgressViewStatus = { checked: true, available: false };
      return false;
    }
    throw error;
  }
};

const buildOrgProgressPayload = async (orgIds, { includeProgress, requestId }) => {
  if (!includeProgress) {
    return { progressAvailable: false };
  }
  if (!supabase || !Array.isArray(orgIds) || orgIds.length === 0) {
    return { progressAvailable: Boolean(orgIds?.length === 0) };
  }
  const viewAvailable = await ensureOrgProgressViewAvailable();
  if (!viewAvailable) {
    return { progressAvailable: false, reason: 'view_unavailable' };
  }
  try {
    const { data, error } = await supabase
      .from(ORG_PROGRESS_VIEW)
      .select('*')
      .in('org_id', orgIds);
    if (error) throw error;
    const payload = { progressAvailable: true };
    (data || []).forEach((row) => {
      if (row?.org_id) {
        payload[row.org_id] = row;
      }
    });
    return payload;
  } catch (error) {
    logOrganizationsStageError('progress_fetch_failed', error, {
      requestId,
      orgCount: orgIds.length,
    });
    return { progressAvailable: false, reason: 'progress_fetch_failed' };
  }
};

const ensureTablesReady = async (label, definitions = []) => {
  if (!supabase) return { ok: true };
  for (const definition of definitions) {
    const table = definition.table;
    if (!table) continue;
    const columns = Array.isArray(definition.columns) ? definition.columns : [];
    const schema = definition.schema ?? 'public';
    const cacheKey = `${schema}.${table}:${columns.slice().sort().join(',')}`;
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
        const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error)) || null;
        logger.error('supabase_table_verification_failed', {
          label,
          table,
          schema,
          columns,
          missingColumn,
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        return { ok: false, table, schema, column: missingColumn, error };
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
    table: status.table ?? null,
    column: status.column ?? null,
    schema: status.schema ?? null,
    label,
  });
};


const ensureSupabase = (res) => {
  if (!supabase) {
    // Allow tests to run with an in-memory fallback when explicitly enabled
    if (isDemoOrTestMode) return true;
    const missingEnv = missingSupabaseEnvVars.length > 0 ? missingSupabaseEnvVars : ['Unknown Supabase configuration'];
    if (!loggedMissingSupabaseConfig) {
      console.error('[Supabase] Missing required environment variables:', missingEnv.join(', '));
      loggedMissingSupabaseConfig = true;
    }
    res.status(503).json({
      error: 'Supabase service credentials not configured on server',
      missingEnv,
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or disable via isDemoMode=true for demo mode).'
    });
    return false;
  }
  return true;
};

const shouldUseAssignmentWriteFallback = () =>
  isFallbackMode && ALLOW_NON_PERSISTENT_ASSIGNMENTS;

const writableMembershipRoles = new Set(['owner', 'admin', 'editor', 'manager']);
const inviteAssignableRoles = new Set(['owner', 'admin', 'manager', 'editor', 'instructor', 'member', 'viewer']);

const normalizeOrgRole = (role, defaultRole = 'member') => {
  const normalized = String(role || defaultRole).trim().toLowerCase();
  if (inviteAssignableRoles.has(normalized)) {
    return normalized;
  }
  return defaultRole;
};

const normalizeProvisioningEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

function buildAuthUserMetadata({
  firstName,
  lastName,
  orgId = null,
  extra = {},
} = {}) {
  const normalizedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
  const normalizedLastName = typeof lastName === 'string' ? lastName.trim() : '';
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

  return {
    first_name: normalizedFirstName || null,
    last_name: normalizedLastName || null,
    full_name: fullName || null,
    organization_id: orgId ?? null,
    onboarding_org_id: orgId ?? null,
    ...extra,
  };
}

const resolveSupabaseListUsersPageSize = () => {
  const configured = Number(process.env.SUPABASE_AUTH_LIST_USERS_PAGE_SIZE || 200);
  if (!Number.isFinite(configured)) return 200;
  return Math.min(Math.max(Math.trunc(configured), 1), 1000);
};

const findAuthUserByEmail = async (email, { requestId = null, logPrefix = 'auth_user_lookup' } = {}) => {
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }

  const normalizedEmail = normalizeProvisioningEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const directLookup = supabase.auth?.admin?.getUserByEmail;
  if (typeof directLookup === 'function') {
    const { data, error } = await directLookup.call(supabase.auth.admin, normalizedEmail);
    if (error) {
      const message = String(error?.message || '').toLowerCase();
      const isNotFound = message.includes('user not found');
      if (!isNotFound) {
        throw error;
      }
    }
    if (data?.user) {
      return data.user;
    }
  }

  const perPage = resolveSupabaseListUsersPageSize();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((user) => normalizeProvisioningEmail(user?.email) === normalizedEmail) ?? null;
    if (match) {
      return match;
    }

    const nextPage = Number(data?.nextPage ?? 0);
    if (Number.isFinite(nextPage) && nextPage > page) {
      page = nextPage;
      continue;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  logger.info(`${logPrefix}_not_found`, {
    requestId,
    email: normalizedEmail,
  });
  return null;
};

const buildProvisionedProfileMetadata = ({
  firstName = '',
  lastName = '',
  jobTitle = '',
  department = '',
  cohort = '',
  phoneNumber = '',
} = {}) => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return {
    full_name: fullName || null,
    name: fullName || null,
    job_title: jobTitle || null,
    department: department || null,
    cohort: cohort || null,
    phone_number: phoneNumber || null,
  };
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

const normalizeAssignmentUserIds = (rawList = []) => {
  const normalizedUserIdSet = new Set();
  const invalidTargetIdSet = new Set();
  rawList.forEach((value) => {
    let normalized = '';
    if (typeof value === 'string') {
      normalized = value.trim().toLowerCase();
    } else if (value === null || typeof value === 'undefined') {
      normalized = '';
    } else {
      normalized = String(value).trim().toLowerCase();
    }
    if (!normalized) {
      const invalidValue =
        typeof value === 'string' ? value.trim() : value === null || typeof value === 'undefined' ? '' : String(value).trim();
      if (invalidValue) {
        invalidTargetIdSet.add(invalidValue);
      }
      return;
    }
    normalizedUserIdSet.add(normalized);
  });
  return {
    normalizedUserIds: Array.from(normalizedUserIdSet),
    invalidTargetIds: Array.from(invalidTargetIdSet),
  };
};

const getRequestContext = (req) => {
  if (!req.user) {
    return { userId: null, userRole: null, memberships: [], organizationIds: [], requestedOrgId: null };
  }

  const normalizedActiveOrg = normalizeOrgIdValue(req.activeOrgId ?? req.user?.activeOrgId ?? null);
  return {
    userId: req.user.userId || req.user.id || null,
    userRole: (req.user.role || req.user.platformRole || '').toLowerCase(),
    memberships: req.user.memberships || [],
    organizationIds: Array.isArray(req.user.organizationIds) ? req.user.organizationIds : [],
    isPlatformAdmin: Boolean(req.user.isPlatformAdmin),
    requestedOrgId: normalizedActiveOrg,
    activeOrganizationId: normalizedActiveOrg,
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
    .select(buildMembershipSelect('role', 'status', 'invited_by'))
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    orgId,
    role: data.role,
    status: data.status,
    invitedBy: data.invited_by,
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
  if (isDemoOrTestMode) {
    normalizedOrgId = normalizeOrgIdValue(orgId);
  } else {
    try {
      normalizedOrgId = await coerceOrgIdentifierToUuid(req, orgId);
    } catch (err) {
      if (err instanceof InvalidOrgIdentifierError) {
        respondInvalidOrg(res, err.identifier);
        return null;
      }
      throw err;
    }
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
    if (isDemoOrTestMode) {
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

    if (requireOrgAdmin && !hasOrgAdminRole(memberRole)) {
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

const serializeSqlLessonRow = (row) => ({
  id: row.id,
  module_id: row.module_id,
  course_id: row.course_id,
  organization_id: row.organization_id ?? null,
  title: row.title ?? '',
  type: row.type ?? 'text',
  description: row.description ?? null,
  order_index: row.order_index ?? 0,
  duration_s: row.duration_s ?? null,
  content_json: row.content_json ?? {},
});

const serializeSqlModuleRow = (row, lessons = []) => ({
  id: row.id,
  course_id: row.course_id,
  organization_id: row.organization_id ?? null,
  title: row.title ?? '',
  description: row.description ?? null,
  order_index: row.order_index ?? 0,
  lessons,
});

const buildCourseGraphFromSqlRows = (courseRow, moduleRows = [], lessonRows = []) => {
  const lessonsByModuleId = new Map();
  lessonRows.forEach((lesson) => {
    const moduleId = lesson.module_id;
    if (!moduleId) return;
    if (!lessonsByModuleId.has(moduleId)) {
      lessonsByModuleId.set(moduleId, []);
    }
    lessonsByModuleId.get(moduleId).push(serializeSqlLessonRow(lesson));
  });
  const modules = moduleRows
    .map((module) =>
      serializeSqlModuleRow(
        module,
        [...(lessonsByModuleId.get(module.id) ?? [])].sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)),
      ),
    )
    .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));
  return {
    id: courseRow.id,
    organization_id: courseRow.organization_id ?? null,
    slug: courseRow.slug ?? null,
    title: courseRow.title ?? '',
    description: courseRow.description ?? null,
    status: courseRow.status ?? 'draft',
    meta_json: courseRow.meta_json ?? {},
    key_takeaways: courseRow.key_takeaways ?? [],
    version: courseRow.version ?? 1,
    published_at: courseRow.published_at ?? null,
    updated_at: courseRow.updated_at ?? null,
    modules,
  };
};

const loadCourseGraphWithTx = async (tx, courseId) => {
  const courseRows = await tx`
    select id, organization_id, slug, title, description, status, meta_json, key_takeaways, version, published_at, updated_at
    from public.courses
    where id = ${courseId}::uuid
    limit 1
  `;
  const courseRow = firstRow(courseRows);
  if (!courseRow) {
    return null;
  }
  const moduleRows = await tx`
    select id, course_id, organization_id, title, description, order_index
    from public.modules
    where course_id = ${courseId}::uuid
    order by order_index asc, id asc
  `;
  const lessonRows = await tx`
    select id, module_id, course_id, organization_id, title, type, description, order_index, duration_s, content_json
    from public.lessons
    where course_id = ${courseId}::uuid
    order by order_index asc, id asc
  `;
  return buildCourseGraphFromSqlRows(courseRow, moduleRows, lessonRows);
};

const upsertCourseGraphWithTx = async (tx, { actorUserId, organizationId, coursePayload }) => {
  const result = await tx`
    select public.upsert_course_graph(
      ${JSON.stringify(coursePayload)}::jsonb,
      ${actorUserId ? actorUserId : null}::uuid,
      ${organizationId}::uuid
    ) as course
  `;
  return firstRow(result)?.course ?? null;
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

const normalizeOrganizationMembershipsStatusFlags = async () => {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const pageSize = 100;
  let offset = 0;
  let processed = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('organization_memberships')
      .select('id,status,is_active')
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const canonical = resolveMembershipStatusUpdate({ status: row.status, is_active: row.is_active });
      if (row.status !== canonical.status || row.is_active !== canonical.is_active) {
        const { error: updateError } = await supabase
          .from('organization_memberships')
          .update({ status: canonical.status, is_active: canonical.is_active })
          .eq('id', row.id);

        if (updateError) {
          throw updateError;
        }
        processed += 1;
      }
    }

    if (rows.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return { processed };
};

// Admin endpoint to normalize organization_memberships status/is_active flags
app.post('/api/admin/organization_memberships/normalize-status-flags', authenticate, requireAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const result = await normalizeOrganizationMembershipsStatusFlags();
    res.json({ ok: true, data: { processed: result.processed } });
  } catch (error) {
    logRouteError('POST /api/admin/organization_memberships/normalize-status-flags', error);
    res.status(500).json({ error: 'Unable to normalize organization membership status flags' });
  }
});

const isActiveAdminMembership = (membership) => {
  if (!membership) return false;
  const role = membership.role ? String(membership.role).toLowerCase() : null;
  if (!hasOrgAdminRole(role)) {
    return false;
  }
  const status = String(membership.status || 'active').toLowerCase();
  return status === 'active' || status === 'accepted';
};

app.get(
  '/api/admin/me',
  requireAdminAccess,
  asyncHandler((req, res) => {
    const user = req.supabaseJwtUser;
    const adminPortalAllowed = req.adminPortalAllowed === true;
    const accessReason =
      req.adminAccessReason ||
      (adminPortalAllowed ? 'allowed' : req.adminPortalDeniedReason || 'not_authorized');
    const allowlistEmail = req.adminAllowlistEntry?.email ?? null;

    res.json({
      ok: true,
      requestId: req.requestId ?? null,
      data: {
        adminPortalAllowed,
         reason: accessReason,
        user: {
          id: user.id,
          email: user.email || null,
          allowlistEmail,
          isAdmin: adminPortalAllowed,
          role: adminPortalAllowed ? 'admin' : 'authenticated',
        },
        access: {
          allowed: adminPortalAllowed,
          adminPortal: adminPortalAllowed,
          admin: adminPortalAllowed,
          isAdmin: adminPortalAllowed,
          capabilities: {
            adminPortal: adminPortalAllowed,
            admin: adminPortalAllowed,
          },
          scopes: adminPortalAllowed ? ['admin'] : [],
          permissions: adminPortalAllowed ? ['admin:*'] : [],
          via: adminPortalAllowed ? accessReason : 'denied',
          reason: accessReason,
          instructions: adminPortalAllowed
            ? null
            : 'Ask an existing admin to add you to admin_users allowlist.',
          timestamp: new Date().toISOString(),
        },
      },
    });
  }),
);

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
let orgInvitesOrganizationIdColumnAvailable = null;
let orgInvitesTokenColumnAvailable = null;

async function detectOrgInvitesOrganizationIdColumnAvailability() {
  if (!supabase) return false;
  if (orgInvitesOrganizationIdColumnAvailable !== null) return orgInvitesOrganizationIdColumnAvailable;
  try {
    const { error } = await supabase
      .from('org_invites')
      .select('id', { head: true, count: 'exact' })
      .is('organization_id', null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) {
        orgInvitesOrganizationIdColumnAvailable = false;
        return false;
      }
      throw error;
    }
    orgInvitesOrganizationIdColumnAvailable = true;
    return true;
  } catch (error) {
    logger.warn('org_invites_org_column_probe_failed', { message: error?.message || String(error) });
    orgInvitesOrganizationIdColumnAvailable = false;
    return false;
  }
}

async function detectOrgInvitesTokenColumnAvailability() {
  if (!supabase) return false;
  if (orgInvitesTokenColumnAvailable !== null) return orgInvitesTokenColumnAvailable;
  try {
    const { error } = await supabase
      .from('org_invites')
      .select('id', { head: true, count: 'exact' })
      .is('token', null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) {
        orgInvitesTokenColumnAvailable = false;
        return false;
      }
      throw error;
    }
    orgInvitesTokenColumnAvailable = true;
    return true;
  } catch (error) {
    logger.warn('org_invites_token_column_probe_failed', { message: error?.message || String(error) });
    orgInvitesTokenColumnAvailable = false;
    return false;
  }
}

async function getOrgInvitesOrganizationColumnName() {
  return (await detectOrgInvitesOrganizationIdColumnAvailability()) ? 'organization_id' : 'org_id';
}

async function getOrgInvitesTokenColumnName() {
  return (await detectOrgInvitesTokenColumnAvailability()) ? 'token' : 'invite_token';
}

const normalizeOrgInviteRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const normalized = { ...row };
  normalized.organization_id = row.organization_id ?? row.org_id ?? null;
  normalized.org_id = row.org_id ?? normalized.organization_id ?? null;
  normalized.token = row.token ?? row.invite_token ?? null;
  normalized.invite_token = row.invite_token ?? normalized.token ?? null;
  normalized.created_by = row.created_by ?? row.inviter_id ?? null;
  normalized.inviter_id = row.inviter_id ?? normalized.created_by ?? null;
  return normalized;
};

const resolveAbsoluteHttpUrl = (value, label) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL must use http or https protocol');
    }
    url.hash = '';
    url.search = '';
    return url.origin;
  } catch (error) {
    console.warn('[config] Ignoring invalid URL value', {
      label,
      value,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const inviteLinkBaseCandidates = [
  { key: 'CLIENT_PORTAL_URL', value: process.env.CLIENT_PORTAL_URL },
  { key: 'APP_BASE_URL', value: process.env.APP_BASE_URL },
  { key: 'PUBLIC_APP_URL', value: process.env.PUBLIC_APP_URL },
  { key: 'VITE_SITE_URL', value: process.env.VITE_SITE_URL },
];

const INVITE_LINK_BASE =
  inviteLinkBaseCandidates
    .map((candidate) => resolveAbsoluteHttpUrl(candidate.value, candidate.key))
    .find((url) => Boolean(url)) || 'https://the-huddle.co';
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
    if (supabase && !isDemoMode) {
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

function logSlugConflict({ courseId = null, orgId = null, attemptedSlug = null, suggestion = null, requestId = null }) {
  console.warn('[admin-courses] slug_conflict', {
    courseId,
    orgId,
    attemptedSlug,
    suggestion,
    requestId,
  });
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

// Diagnostic logging for idempotency insert errors in upsert and publish flows
function logIdempotencyInsertError(insertError, context = {}) {
  if (insertError) {
    console.error('[idempotency] upsert insert error', insertError, context);
    if (isIdempotencyTableMissingError(insertError)) {
      console.info('[idempotency] idempotency_keys table missing, skipping dedupe for upsert');
    } else {
      // Additional diagnostic logging can be added here if needed
    }
  }
}

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
    isPlatformAdmin: Boolean(req.user?.isPlatformAdmin || req.user?.platformRole === 'platform_admin' || req.user?.role === 'admin'),
  };
};

/**
 * Idempotent certificate creation.
 * Creates a certificate row only if one does not already exist for (user_id, course_id).
 * Returns the existing or newly-created certificate, or null on non-fatal error.
 */
async function createCertificateIfNotExists(userId, courseId, organizationId) {
  if (!supabase || !userId || !courseId) return null;
  try {
    // Check for existing certificate first (idempotency)
    const { data: existing, error: checkError } = await supabase
      .from('certificates')
      .select('id, user_id, course_id, issued_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.warn('certificate_check_failed', { userId, courseId, code: checkError.code, message: checkError.message });
      return null;
    }
    if (existing) {
      logger.debug('certificate_already_exists', { userId, courseId, certificateId: existing.id });
      return existing;
    }

    // Create new certificate
    const _certResult = await supabase
      .from('certificates')
      .insert({
        user_id: userId,
        course_id: courseId,
        organization_id: organizationId ?? null,
        metadata: { source: 'auto_completion' },
      })
      .select('*');

    const created = firstRow(_certResult);
    const insertError = _certResult?.error;

    if (insertError) {
      // Unique constraint violation — race condition, cert was just created by another request
      if (insertError.code === '23505') {
        logger.debug('certificate_race_condition_ok', { userId, courseId });
        return null;
      }
      logger.warn('certificate_create_failed', { userId, courseId, code: insertError.code, message: insertError.message });
      return null;
    }

    logger.info('certificate_auto_created', { userId, courseId, certificateId: created.id, organizationId: organizationId ?? null });
    return created;
  } catch (err) {
    logger.warn('certificate_create_exception', { userId, courseId, message: err?.message ?? String(err) });
    return null;
  }
}

async function deliverInviteEmail(invite, { orgName, inviterName, requestId } = {}) {
  const inviteLink = buildInviteLink(invite.token);
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
  let result;
  try {
    result = await sendEmail({
      to: invite.email,
      subject,
      text,
      html,
      logContext: {
        organizationId: invite.org_id ?? null,
        metadata: { source: 'org_invite' },
      },
    });
  } catch (error) {
    logOrganizationsEvent('organization_invite_failed', {
      requestId: requestId ?? null,
      status: 'error',
      metadata: {
        orgId: invite.org_id ?? null,
        inviteId: invite.id ?? null,
        email: invite.email ?? null,
        message: error?.message ?? null,
      },
    });
    throw error;
  }
  const sentAt = new Date().toISOString();
  const updatePayload = {
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

  const logMetadata = {
    orgId: invite.org_id ?? null,
    inviteId: invite.id ?? null,
    email: invite.email ?? null,
    reminderCount: updatePayload.reminder_count ?? null,
  };
  if (result.delivered) {
    logOrganizationsEvent('organization_invite_sent', {
      requestId: requestId ?? null,
      status: 'ok',
      metadata: logMetadata,
    });
  } else {
    logOrganizationsEvent('organization_invite_failed', {
      requestId: requestId ?? null,
      status: 'failed',
      metadata: { ...logMetadata, reason: result.reason ?? null },
    });
  }

  return { ...invite, ...updatePayload };
}

const seedOrgOwner = async ({ orgId, orgName, ownerEmail, ownerName, actor, requestId }) => {
  if (!ownerEmail || !supabase) {
    return { status: 'skipped' };
  }
  const normalizedEmail = ownerEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    return { status: 'skipped' };
  }

  let existingAuthUser = null;
  try {
    existingAuthUser = await findAuthUserByEmail(normalizedEmail, {
      requestId,
      logPrefix: 'organization_owner_lookup',
    });
  } catch (error) {
    logger.warn('organization_owner_lookup_failed', {
      orgId,
      targetEmail: normalizedEmail,
      requestId,
      message: error?.message ?? String(error),
    });
  }

  if (existingAuthUser) {
    try {
      await upsertOrganizationMembership(orgId, existingAuthUser.id, 'owner', actor);
      logOrganizationsEvent('organization_owner_seeded', {
        requestId,
        status: 'membership',
        metadata: { orgId, targetEmail: normalizedEmail, method: 'membership' },
      });
      return { status: 'membership', userId: existingAuthUser.id };
    } catch (error) {
      logger.error('organization_owner_membership_failed', {
        orgId,
        targetEmail: normalizedEmail,
        message: error?.message ?? String(error),
      });
    }
  }

  try {
    const { invite, duplicate } = await createOrgInvite({
      orgId,
      email: normalizedEmail,
      role: 'owner',
      inviter: actor,
      orgName,
      metadata: ownerName ? { name: ownerName } : {},
      requestId,
    });
    logOrganizationsEvent('organization_owner_seeded', {
      requestId,
      status: duplicate ? 'invite_duplicate' : 'invite',
      metadata: { orgId, inviteId: invite.id, targetEmail: normalizedEmail },
    });
    return { status: duplicate ? 'invite_duplicate' : 'invite', inviteId: invite.id };
  } catch (error) {
    logger.error('organization_owner_seed_failed', {
      orgId,
      targetEmail: normalizedEmail,
      message: error?.message ?? String(error),
    });
    logOrganizationsEvent('organization_owner_seeded', {
      requestId,
      status: 'failed',
      metadata: { orgId, targetEmail: normalizedEmail, message: error?.message ?? null },
    });
    return { status: 'failed', error: error?.message ?? 'unknown' };
  }
};

const normalizeInviteNote = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

async function createOrgInvite({
  orgId,
  email,
  role = 'member',
  inviter,
  orgName,
  metadata = {},
  sendEmail: shouldSendEmail = true,
  duplicateStrategy = 'return',
  note = null,
  requestId = null,
}) {
  validateOrgId(orgId);
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('invalid_email');
  }
  const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
  const inviteTokenColumn = await getOrgInvitesTokenColumnName();

  const { data: existing } = await supabase
    .from('org_invites')
    .select('*')
    .eq(inviteOrgColumn, orgId)
    .eq('email', normalizedEmail)
    .in('status', ['pending', 'sent'])
    .maybeSingle();

  if (existing && duplicateStrategy === 'return') {
    const normalizedExisting = normalizeOrgInviteRow(existing);
    if (shouldSendEmail) {
      await deliverInviteEmail(normalizedExisting, { orgName, inviterName: inviter?.name, requestId });
    }
    return { invite: normalizedExisting, duplicate: true };
  }

  const normalizedMetadata = metadata && typeof metadata === 'object' ? metadata : {};
  const normalizedNote = normalizeInviteNote(note);
  const token = randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const basePayload = {
    email: normalizedEmail,
    role,
    status: 'pending',
    created_by: inviter?.userId ?? null,
    inviter_id: inviter?.userId ?? null,
    expires_at: expiresAt,
  };
  // If the complementary org column exists (both `organization_id` and `org_id`),
  // include both in the base payload so triggers/functions that still reference
  // the legacy column don't observe NULL values during the migration window.
  try {
    const complementaryOrgColumn = inviteOrgColumn === 'organization_id' ? 'org_id' : 'organization_id';
    const { error: compErr } = await supabase
      .from('org_invites')
      .select('id', { head: true, count: 'exact' })
      .is(complementaryOrgColumn, null)
      .limit(1);
    if (!compErr) {
      // both columns exist; set both on the base payload
      basePayload[inviteOrgColumn] = orgId;
      basePayload[complementaryOrgColumn] = orgId;
    } else {
      basePayload[inviteOrgColumn] = orgId;
    }
  } catch (probeErr) {
    // Fallback: ensure at least the resolved column is present
    basePayload[inviteOrgColumn] = orgId;
  }

  // Also attempt to include both token column names if both are present to be
  // robust during migrations that rename `invite_token` -> `token`.
  try {
    const complementaryTokenColumn = inviteTokenColumn === 'token' ? 'invite_token' : 'token';
    const { error: tErr } = await supabase
      .from('org_invites')
      .select('id', { head: true, count: 'exact' })
      .is(complementaryTokenColumn, null)
      .limit(1);
    if (!tErr) {
      basePayload[inviteTokenColumn] = token;
      basePayload[complementaryTokenColumn] = token;
    } else {
      basePayload[inviteTokenColumn] = token;
    }
  } catch (probeErr) {
    basePayload[inviteTokenColumn] = token;
  }

  const attemptPayloads = buildOrgInviteInsertAttemptPayloads({
    orgColumn: inviteOrgColumn,
    tokenColumn: inviteTokenColumn,
    orgId,
    token,
    basePayload,
  });

  // Log an informative debug entry before we attempt any DB inserts so failures
  // involving missing organization identifiers or token columns are easier
  // to diagnose in logs (includes requestId when available).
  logInviteInsertAttempt({ orgId, email: normalizedEmail, requestId });

  let data = null;
  let error = null;
  for (const candidate of attemptPayloads) {
    // Use array result + firstRow() — .single() throws PGRST116 if a duplicate exists.
    const result = await supabase
      .from('org_invites')
      .insert(candidate)
      .select('*');
    data = firstRow(result);
    error = result.error;
    if (!error) {
      break;
    }
    if (!isMissingColumnError(error)) {
      break;
    }
    const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
    if (missingColumn !== 'token' && missingColumn !== 'invite_token') {
      break;
    }
  }

  if (error) {
    throw error;
  }

  let inviteRecord = normalizeOrgInviteRow(data);

  if (shouldSendEmail) {
    inviteRecord = await deliverInviteEmail(inviteRecord, {
      orgName,
      inviterName: inviter?.name,
      requestId,
    });
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
      .order('created_at', { ascending: true })
      .limit(Math.max(limit * 3, limit));

    if (error) {
      logger.warn('invite_reminder_query_failed', { message: error?.message || String(error) });
      return { processed: 0 };
    }

    const candidates = (data || [])
      .map((invite) => normalizeOrgInviteRow(invite))
      .filter((invite) => {
        const lastTouch = invite.created_at;
        if (!lastTouch) return true;
        return new Date(lastTouch).getTime() <= threshold.getTime();
      })
      .slice(0, limit);

    if (!candidates.length) {
      logger.info('invite_reminder_idle', { reason, inspected: data?.length || 0 });
      return { processed: 0 };
    }

    const orgIds = [...new Set(candidates.map((invite) => invite.organization_id).filter(Boolean))];
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
          orgName: orgMap.get(invite.organization_id) || 'Your organization',
          inviterName: null,
        });
        await recordActivationEvent(invite.organization_id, 'invite_reminder_sent', { inviteId: invite.id }, {
          userId: invite.created_by,
          email: null,
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
  const inviteTokenColumn = await getOrgInvitesTokenColumnName();
  const { data, error } = await supabase
    .from('org_invites')
    .select('*')
    .eq(inviteTokenColumn, token)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) return null;
  const normalizedData = normalizeOrgInviteRow(data);
  const derived = deriveInviteStatus(normalizedData);
  if (derived === 'expired' && normalizedData.status !== 'expired') {
    try {
      await supabase
        .from('org_invites')
        .update({ status: 'expired' })
        .eq('id', normalizedData.id);
      normalizedData.status = 'expired';
    } catch (updateError) {
      logger.warn('invite_expire_flag_failed', {
        inviteId: normalizedData.id,
        message: updateError?.message || String(updateError),
      });
    }
  }
  return normalizedData;
}

const INVITE_LOGIN_URL = process.env.CLIENT_INVITE_LOGIN_URL || '/login';

function buildPublicInvitePayload(invite, orgSummary, assignmentPreview = null, contactEmail = null) {
  return {
    id: invite.id,
    orgId: invite.organization_id,
    orgName: orgSummary?.name || null,
    orgSlug: orgSummary?.slug || null,
    contactEmail: contactEmail ?? orgSummary?.contact_email ?? null,
    email: invite.email,
    role: invite.role,
    status: deriveInviteStatus(invite),
    expiresAt: invite.expires_at,
    invitedName: null,
    inviterEmail: null,
    reminderCount: invite.reminder_count,
    lastSentAt: null,
    acceptedAt: invite.accepted_at ?? null,
    requiresAccount: true,
    passwordPolicy: {
      minLength: INVITE_PASSWORD_MIN_CHARS,
    },
    loginUrl: INVITE_LOGIN_URL,
    assignmentPreview: assignmentPreview || null,
  };
}

async function fetchOrgMembersWithProfiles(orgId) {
  if (!supabase) {
    return [];
  }

  const membershipSelect = buildMembershipSelect(
    'id',
    'organization_id',
    'org_id',
    'user_id',
    'role',
    'status',
    'invited_by',
    'created_at',
    'updated_at',
  );
  let memberships = null;
  let membershipError = null;

  for (const orgColumn of ['organization_id', 'org_id']) {
    const statusColumn = await getOrganizationMembershipsStatusColumnName();

    let query = supabase
      .from('organization_memberships')
      .select(membershipSelect)
      .eq(orgColumn, orgId);

    if (statusColumn === 'is_active') {
      query = query.eq('is_active', true);
    } else {
      query = query.in('status', ['active', 'pending']);
    }

    const result = await query;
    if (result.error) {
      if (isMissingColumnError(result.error)) {
        membershipError = result.error;
        continue;
      }
      throw result.error;
    }
    memberships = result.data || [];
    membershipError = null;
    break;
  }
  if (membershipError) throw membershipError;

  const rows = Array.isArray(memberships) ? memberships : [];
  const userIds = rows.map((row) => row?.user_id).filter(Boolean);
  const profileMap = new Map();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds);
    if (profileError) throw profileError;
    (profiles || []).forEach((profile) => {
      if (profile?.id) {
        profileMap.set(profile.id, profile);
      }
    });
  }

  const members = rows.map((membership) => {
    const profile = profileMap.get(membership.user_id) || null;
    return {
      ...profile,
      ...membership,
      organization_id: membership.organization_id ?? membership.org_id ?? null,
      org_id: membership.org_id ?? membership.organization_id ?? null,
      user_id_uuid: membership.user_id ?? membership.user_id_uuid ?? null,
      profile,
      user: {
        id: membership.user_id ?? null,
        email: profile?.email ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        organization_id: profile?.organization_id ?? membership.organization_id ?? membership.org_id ?? null,
        role: profile?.role ?? null,
        is_active: profile?.is_active ?? true,
      },
    };
  });

  logger.info('admin_users_memberships_query', {
    source: 'organization_memberships+user_profiles',
    orgId,
    rowCount: members.length,
  });

  return members;
}

async function fetchAllOrgMembersWithProfiles({ offset = 0, limit = 500, orgId = null } = {}) {
  if (!supabase) {
    return [];
  }

  // Single JOIN query — no per-org N+1 loop.
  // Fetches organization_memberships joined with user_profiles in one round-trip.
  const membershipSelect = buildMembershipSelect(
    'id',
    'organization_id',
    'org_id',
    'user_id',
    'role',
    'status',
    'invited_by',
    'created_at',
    'updated_at',
  );

  // Use explicit FK hint to disambiguate: organization_memberships has two FKs to user_profiles
  // (user_id and invited_by). PostgREST throws PGRST201 without the hint.
  let query = supabase
    .from('organization_memberships')
    .select(`${membershipSelect}, user_profiles!organization_memberships_user_id_fkey (*)`)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (orgId) {
    // Try organization_id first; schema probe will detect which column exists.
    query = query.eq('organization_id', orgId);
  }

  let { data, error } = await query;

  if (error) {
    // If organization_id column is missing, fall back to org_id column.
    if (isMissingColumnError(error) && !orgId) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('organization_memberships')
        .select(`id, org_id, user_id, role, status, invited_by, created_at, updated_at, user_profiles!organization_memberships_user_id_fkey (*)`)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (fallbackError) throw fallbackError;
      data = fallbackData;
    } else {
      throw error;
    }
  }

  const rows = Array.isArray(data) ? data : [];

  const members = rows.map((membership) => {
    const profile = membership.user_profiles || null;
    return {
      ...(profile || {}),
      ...membership,
      user_profiles: undefined, // remove the nested join artifact
      organization_id: membership.organization_id ?? membership.org_id ?? null,
      org_id: membership.org_id ?? membership.organization_id ?? null,
      user_id_uuid: membership.user_id ?? null,
      profile,
      user: {
        id: membership.user_id ?? null,
        email: profile?.email ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        organization_id: profile?.organization_id ?? membership.organization_id ?? membership.org_id ?? null,
        role: profile?.role ?? null,
        is_active: profile?.is_active ?? true,
      },
    };
  });

  logger.info('admin_users_all_memberships_query', {
    source: 'organization_memberships+user_profiles_join',
    orgId: orgId ?? 'all',
    rowCount: members.length,
    offset,
    limit,
  });

  return members;
}



const DEFAULT_ASSIGNMENT_BUCKET = () => ({
  assignmentCount: 0,
  learnerAssignments: 0,
  orgAssignments: 0,
  dueSoonCount: 0,
  completedCount: 0,
  latestAssignedAt: null,
  topAssignments: [],
});

const buildEmptyAssignmentSummary = () => ({
  courses: DEFAULT_ASSIGNMENT_BUCKET(),
  surveys: DEFAULT_ASSIGNMENT_BUCKET(),
});

const summarizeAssignmentRows = (rows = []) => {
  const summary = buildEmptyAssignmentSummary();
  const now = Date.now();
  const dueSoonThreshold = now + 7 * 24 * 60 * 60 * 1000;

  const courseTopIds = new Set();
  const surveyTopIds = new Set();

  rows.forEach((row) => {
    if (!row) return;
    const bucket =
      row.assignment_type === 'survey' || row.survey_id
        ? summary.surveys
        : summary.courses;
    bucket.assignmentCount += 1;
    if (row.user_id) {
      bucket.learnerAssignments += 1;
    } else {
      bucket.orgAssignments += 1;
    }
    if (row.status === 'completed') {
      bucket.completedCount += 1;
    }
    if (row.due_at) {
      const dueTime = new Date(row.due_at).getTime();
      if (Number.isFinite(dueTime) && dueTime > now && dueTime <= dueSoonThreshold) {
        bucket.dueSoonCount += 1;
      }
    }
    const updatedAt = row.updated_at || row.created_at;
    if (updatedAt) {
      if (!bucket.latestAssignedAt || new Date(updatedAt) > new Date(bucket.latestAssignedAt)) {
        bucket.latestAssignedAt = updatedAt;
      }
    }

    const targetId = row.course_id || row.survey_id;
    if (targetId) {
      const targetSet = row.assignment_type === 'survey' || row.survey_id ? surveyTopIds : courseTopIds;
      if (targetSet.size < 5) {
        targetSet.add(targetId);
      }
    }
  });

  summary.courses.topAssignments = Array.from(courseTopIds.values());
  summary.surveys.topAssignments = Array.from(surveyTopIds.values());
  return summary;
};

const fetchOrgAssignmentSummary = async (orgId) => {
  if (!supabase || !orgId) return buildEmptyAssignmentSummary();
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select(
        'id, assignment_type, course_id, survey_id, user_id, status, due_at, updated_at, created_at',
      )
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return buildEmptyAssignmentSummary();
      }
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const summary = summarizeAssignmentRows(rows);
    const courseTopRows = [];
    const surveyTopRows = [];
    const courseSeen = new Set();
    const surveySeen = new Set();
    for (const row of rows) {
      if (courseTopRows.length < 5 && row?.course_id && !courseSeen.has(row.course_id)) {
        courseSeen.add(row.course_id);
        courseTopRows.push(row);
      }
      if (surveyTopRows.length < 5 && row?.survey_id && !surveySeen.has(row.survey_id)) {
        surveySeen.add(row.survey_id);
        surveyTopRows.push(row);
      }
      if (courseTopRows.length >= 5 && surveyTopRows.length >= 5) {
        break;
      }
    }

    const [courseTitles, surveyTitles] = await Promise.all([
      fetchAssignmentTitles(
        'course',
        courseTopRows.map((row) => row.course_id).filter(Boolean),
      ),
      fetchAssignmentTitles(
        'survey',
        surveyTopRows.map((row) => row.survey_id).filter(Boolean),
      ),
    ]);

    const mapTopAssignment = (row, type) => {
      const id = type === 'course' ? row?.course_id : row?.survey_id;
      if (!id) return null;
      const titleMap = type === 'course' ? courseTitles : surveyTitles;
      return {
        id,
        title:
          titleMap.get(id) ??
          row?.title ??
          row?.name ??
          (type === 'course' ? 'Course assignment' : 'Survey assignment'),
        status: row?.status ?? null,
        dueAt: row?.due_at ?? null,
        updatedAt: row?.updated_at ?? row?.created_at ?? null,
      };
    };

    summary.courses.topAssignments = courseTopRows
      .map((row) => mapTopAssignment(row, 'course'))
      .filter(Boolean);
    summary.surveys.topAssignments = surveyTopRows
      .map((row) => mapTopAssignment(row, 'survey'))
      .filter(Boolean);
    summary.generatedAt = new Date().toISOString();
    return summary;
  } catch (error) {
    logOrganizationsStageError('assignment_summary_failed', error, { orgId });
    return buildEmptyAssignmentSummary();
  }
};

const fetchOrgMessages = async (orgId, { limit = 25 } = {}) => {
  if (!supabase || !orgId) return [];
  const tables = ['message_logs', 'organization_messages'];
  const normalizedLimit = Math.max(1, Math.min(100, limit));

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .or(`organization_id.eq.${orgId},org_id.eq.${orgId}`)
        .order('created_at', { ascending: false })
        .limit(normalizedLimit);

      if (error) {
        if (isMissingRelationError(error) || isMissingColumnError(error)) {
          continue;
        }
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        return data;
      }

      if (table === tables[tables.length - 1]) {
        return data || [];
      }
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        continue;
      }
      logOrganizationsStageError('messages_fetch_failed', error, { orgId });
      return [];
    }
  }
  return [];
};

const mapOrgProfileUser = (member) => {
  if (!member) return null;
  const profile = member.profile ?? null;
  const userRow = member.user ?? null;
  const fallbackName = [userRow?.first_name, userRow?.last_name]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .trim();

  return {
    id: member.id ?? null,
    membershipId: member.id ?? null,
    orgId: member.org_id ?? null,
    userId: member.user_id ?? null,
    role: member.role ?? userRow?.role ?? null,
    status: member.status ?? userRow?.status ?? null,
    invitedBy: member.invited_by ?? null,
    acceptedAt: member.accepted_at ?? null,
    lastSeenAt: member.last_seen_at ?? null,
    lastLoginAt: userRow?.last_login_at ?? null,
    email: profile?.email ?? userRow?.email ?? null,
    name: profile?.name ?? fallbackName ?? null,
    title: profile?.title ?? userRow?.title ?? null,
    createdAt: member.created_at ?? null,
    updatedAt: member.updated_at ?? null,
  };
};

const mapOrgInviteRecord = (row) => ({
  id: row.id,
  organizationId: row.organization_id ?? row.org_id ?? null,
  email: row.email ?? null,
  role: row.role ?? null,
  status: row.status ?? 'pending',
  token: row.token ?? row.invite_token ?? null,
  invitedBy: row.created_by ?? row.inviter_id ?? null,
  invitedAt: row.created_at ?? null,
  acceptedAt: row.accepted_at ?? null,
  expiresAt: row.expires_at ?? null,
  lastSentAt: null,
  reminderCount: row.reminder_count ?? null,
  note: null,
});

// ---------------------------------------------------------------------------
// Admin user normalization and strict active membership resolver
// ---------------------------------------------------------------------------

const normalizeAdminUser = async (member, organization = null) => {
  const profile = member?.profile ?? {};
  const userId = String(member?.user_id ?? profile?.id ?? member?.id ?? '').trim();
  const email = (profile?.email || member?.email || member?.user?.email || '').toLowerCase();
  const firstName = profile?.first_name || member?.first_name || '';
  const lastName = profile?.last_name || member?.last_name || '';

  const membershipOrgId = member?.organization_id ?? member?.org_id ?? member?.membership?.organization_id ?? null;
  const role = member?.role ?? member?.membership?.role ?? profile?.role ?? null;

  const normalized = {
    id: userId,
    email: email || null,
    first_name: firstName || null,
    last_name: lastName || null,
    role: role || null,
    organization_id: membershipOrgId || null,
    organization: organization ? { id: organization.id, name: organization.name } : null,
  };

  return normalized;
};

const getActiveOrganizationMembership = async (userId) => {
  if (!supabase || !userId) return null;

  const orgColumn = await getOrganizationMembershipsOrgColumnName();
  const { data: memberships, error } = await supabase
    .from('organization_memberships')
    .select('id,organization_id,org_id,user_id,role,status')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;

  if (!Array.isArray(memberships) || memberships.length !== 1) {
    throw new Error(`user ${userId} must have exactly one active membership (found ${Array.isArray(memberships) ? memberships.length : 0})`);
  }

  return memberships[0];
};

const mapOrgMessageRecord = (row) => ({
  id: row.id,
  organizationId: row.organization_id ?? row.org_id ?? null,
  recipientType: row.recipient_type ?? row.recipientType ?? null,
  recipientId: row.recipient_id ?? row.recipientId ?? null,
  subject: row.subject ?? null,
  body: row.body ?? null,
  channel: row.channel ?? 'email',
  sentBy: row.sent_by ?? null,
  sentAt: row.sent_at ?? row.created_at ?? null,
  status: row.status ?? null,
  metadata: row.metadata ?? null,
});

const MESSAGE_CHANNELS = new Set(['email', 'in_app']);

const sanitizeRecipientEmails = (input) => {
  const values = Array.isArray(input) ? input : [input];
  const emails = new Set();
  for (const value of values) {
    if (!value) continue;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) continue;
    emails.add(normalized);
  }
  return Array.from(emails);
};

const resolveFallbackAdminEmails = () => {
  const fromEnv = FEEDBACK_ADMIN_EMAILS_ENV
    ? FEEDBACK_ADMIN_EMAILS_ENV.split(/[\n,;]/).map((value) => value.trim())
    : [];
  return sanitizeRecipientEmails([...fromEnv, PRIMARY_ADMIN_EMAIL]);
};

const resolveOrgMessageRecipients = async (orgId, provided = []) => {
  const explicit = sanitizeRecipientEmails(provided);
  if (explicit.length || !supabase) {
    return explicit;
  }

  const recipients = [];
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('contact_email')
      .eq('id', orgId)
      .maybeSingle();
    if (org?.contact_email) {
      recipients.push(org.contact_email);
    }
  } catch (error) {
    logger.warn('org_message_contact_lookup_failed', { orgId, message: error?.message || String(error) });
  }

  try {
    const { data: contacts } = await supabase
      .from('organization_contacts')
      .select('email, is_primary')
      .eq('org_id', orgId)
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false, nullsLast: false })
      .limit(5);
    (contacts || []).forEach((contact) => {
      if (contact?.email) {
        recipients.push(contact.email);
      }
    });
  } catch (error) {
    logger.warn('org_message_contacts_lookup_failed', { orgId, message: error?.message || String(error) });
  }

  return sanitizeRecipientEmails(recipients);
};

const resolveUserMessageRecipients = async (userId, provided = []) => {
  const explicit = sanitizeRecipientEmails(provided);
  if (explicit.length) return explicit;
  if (!supabase || !userId) return [];

  const candidates = [];
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.email) {
      candidates.push(profile.email);
    }
  } catch (error) {
    logger.warn('user_message_profile_lookup_failed', { userId, message: error?.message || String(error) });
  }

  if (!candidates.length) {
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      if (data?.user?.email) {
        candidates.push(data.user.email);
      }
    } catch (error) {
      logger.warn('user_message_auth_lookup_failed', { userId, message: error?.message || String(error) });
    }
  }

  return sanitizeRecipientEmails(candidates);
};

const resolveOrganizationAdminUserIds = async (orgId) => {
  if (!supabase || !orgId) return [];

  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('user_id, role, status, organization_id, org_id')
      .or(`organization_id.eq.${orgId},org_id.eq.${orgId}`)
      .limit(500);
    if (error) throw error;

    return Array.from(
      new Set(
        (data || [])
          .filter((row) => row?.user_id && String(row.status || 'active').toLowerCase() !== 'inactive')
          .filter((row) => hasOrgAdminRole(row.role))
          .map((row) => row.user_id)
      )
    );
  } catch (error) {
    logger.warn('organization_admin_recipient_lookup_failed', {
      orgId,
      message: error?.message || String(error),
    });
    return [];
  }
};

const resolvePlatformAdminUserIds = async () => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id, email')
      .eq('is_active', true)
      .limit(200);
    if (error) throw error;
    return Array.from(new Set((data || []).map((row) => row?.user_id).filter(Boolean)));
  } catch (error) {
    logger.warn('platform_admin_recipient_lookup_failed', {
      message: error?.message || String(error),
    });
    return [];
  }
};

const resolveAdminRecipientEmails = async (adminUserIds = []) => {
  const recipients = new Set(resolveFallbackAdminEmails());
  const uniqueAdminUserIds = Array.from(new Set((adminUserIds || []).filter(Boolean)));

  if (!supabase || uniqueAdminUserIds.length === 0) {
    return Array.from(recipients);
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', uniqueAdminUserIds)
      .limit(500);
    if (error) throw error;
    (data || []).forEach((row) => {
      if (row?.email) {
        recipients.add(String(row.email).trim().toLowerCase());
      }
    });
  } catch (error) {
    logger.warn('admin_feedback_email_lookup_failed', {
      message: error?.message || String(error),
      adminRecipientCount: uniqueAdminUserIds.length,
    });
  }

  return Array.from(recipients);
};

const normalizeMessageChannel = (channel) => {
  const normalized = String(channel || '').toLowerCase();
  if (MESSAGE_CHANNELS.has(normalized)) {
    return normalized;
  }
  return 'in_app';
};

const insertMessageLog = async ({
  organizationId = null,
  recipientType = 'organization',
  recipientId = null,
  subject = null,
  body,
  channel = 'in_app',
  actor = null,
  metadata = {},
}) => {
  if (!supabase) throw new Error('supabase_not_configured');
  const normalizedChannel = normalizeMessageChannel(channel);
  const payload = {
    organization_id: organizationId,
    org_id: organizationId,
    recipient_type: recipientType,
    recipient_id: recipientId,
    subject,
    body,
    channel: normalizedChannel,
    status: normalizedChannel === 'email' ? 'queued' : 'sent',
    sent_by: actor?.userId ?? null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    sent_at: normalizedChannel === 'email' ? null : new Date().toISOString(),
  };
  const _msgInsert = await supabase.from('message_logs').insert(payload).select('*');
  if (_msgInsert.error) throw _msgInsert.error;
  return firstRow(_msgInsert);
};

const finalizeMessageLog = async (id, updates = {}) => {
  const _msgUpdate = await supabase.from('message_logs').update(updates).eq('id', id).select('*');
  if (_msgUpdate.error) throw _msgUpdate.error;
  return firstRow(_msgUpdate);
};

const sendOrganizationMessage = async ({
  orgId,
  subject,
  body,
  channel = 'email',
  recipients = [],
  actor,
  requestId = null,
}) => {
  if (!orgId) throw new Error('org_id_required');
  if (!body || !body.trim()) throw new Error('message_body_required');
  const normalizedChannel = normalizeMessageChannel(channel);
  const resolvedRecipients = await resolveOrgMessageRecipients(orgId, recipients);

  if (normalizedChannel === 'email' && resolvedRecipients.length === 0) {
    throw new Error('message_recipients_required');
  }

  const orgSummary = await fetchOrganizationSummary(orgId);
  const metadata = {
    recipients: resolvedRecipients,
    orgName: orgSummary?.name ?? null,
  };
  const record = await insertMessageLog({
    organizationId: orgId,
    recipientType: 'organization',
    recipientId: orgId,
    subject: subject || `Message for ${orgSummary?.name || 'organization'}`,
    body,
    channel: normalizedChannel,
    actor,
    metadata,
  });

  let finalRecord = record;
  if (normalizedChannel === 'email' && resolvedRecipients.length) {
    const failures = [];
    let delivered = 0;
    for (const email of resolvedRecipients) {
      try {
        const result = await sendEmail({
          to: email,
          subject: subject || `Message from The Huddle`,
          text: body,
          html: `<p style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">${body.replace(/\n/g, '<br/>')}</p>`,
          logContext: {
            organizationId: orgId,
            recipientType: 'organization',
            recipientId: orgId,
            sentBy: actor?.userId ?? null,
            metadata: { source: 'admin_message' },
          },
        });
        if (result.delivered) {
          delivered += 1;
        } else {
          failures.push({ email, reason: result.reason || 'unknown' });
        }
      } catch (error) {
        failures.push({ email, reason: error?.message || 'send_failed' });
      }
    }
    const status = delivered > 0 ? 'sent' : 'failed';
    finalRecord = await finalizeMessageLog(record.id, {
      status,
      sent_at: new Date().toISOString(),
      metadata: {
        ...(record.metadata || {}),
        recipients: resolvedRecipients,
        failures,
      },
    });
  } else {
    finalRecord = await finalizeMessageLog(record.id, {
      metadata: {
        ...(record.metadata || {}),
        recipients: resolvedRecipients,
      },
    });
  }

  if (notificationService) {
    await notificationService.createNotification({
      title: subject || 'New admin message',
      body,
      organizationId: orgId,
      userId: null,
      type: 'admin_message',
      priority: 'normal',
      channel: 'in_app',
      metadata: {
        source: 'admin_message',
        messageLogId: finalRecord.id,
        sentBy: actor?.userId ?? null,
        deliveryChannel: normalizedChannel,
      },
    }).catch((error) => {
      logger.warn('organization_message_notification_failed', {
        orgId,
        messageId: finalRecord.id,
        message: error?.message || String(error),
      });
    });
  }

  logOrganizationsEvent('organization_message_sent', {
    requestId,
    status: finalRecord.status ?? 'sent',
    metadata: {
      orgId,
      messageId: finalRecord.id,
      channel: normalizedChannel,
    },
  });

  return finalRecord;
};

const sendUserMessage = async ({
  userId,
  organizationId = null,
  subject,
  body,
  channel = 'email',
  recipients = [],
  actor,
  requestId = null,
}) => {
  if (!userId) throw new Error('user_id_required');
  if (!body || !body.trim()) throw new Error('message_body_required');
  const normalizedChannel = normalizeMessageChannel(channel);
  const resolvedRecipients = await resolveUserMessageRecipients(userId, recipients);

  if (normalizedChannel === 'email' && resolvedRecipients.length === 0) {
    throw new Error('message_recipients_required');
  }

  const metadata = { recipients: resolvedRecipients };
  const record = await insertMessageLog({
    organizationId,
    recipientType: 'user',
    recipientId: userId,
    subject: subject || 'Message from The Huddle',
    body,
    channel: normalizedChannel,
    actor,
    metadata,
  });

  let finalRecord = record;
  if (normalizedChannel === 'email' && resolvedRecipients.length) {
    const failures = [];
    let delivered = 0;
    for (const email of resolvedRecipients) {
      try {
        const result = await sendEmail({
          to: email,
          subject: subject || 'Message from The Huddle',
          text: body,
          html: `<p style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">${body.replace(/\n/g, '<br/>')}</p>`,
          logContext: {
            organizationId,
            recipientType: 'user',
            recipientId: userId,
            sentBy: actor?.userId ?? null,
            metadata: { source: 'admin_message' },
          },
        });
        if (result.delivered) {
          delivered += 1;
        } else {
          failures.push({ email, reason: result.reason || 'unknown' });
        }
      } catch (error) {
        failures.push({ email, reason: error?.message || 'send_failed' });
      }
    }
    const status = delivered > 0 ? 'sent' : 'failed';
    finalRecord = await finalizeMessageLog(record.id, {
      status,
      sent_at: new Date().toISOString(),
      metadata: {
        ...(record.metadata || {}),
        recipients: resolvedRecipients,
        failures,
      },
    });
  } else {
    finalRecord = await finalizeMessageLog(record.id, {
      metadata: {
        ...(record.metadata || {}),
        recipients: resolvedRecipients,
      },
    });
  }

  if (notificationService) {
    await notificationService.createNotification({
      title: subject || 'New admin message',
      body,
      organizationId,
      userId,
      type: 'admin_message',
      priority: 'normal',
      channel: 'in_app',
      metadata: {
        source: 'admin_message',
        messageLogId: finalRecord.id,
        sentBy: actor?.userId ?? null,
        deliveryChannel: normalizedChannel,
      },
    }).catch((error) => {
      logger.warn('user_message_notification_failed', {
        userId,
        messageId: finalRecord.id,
        message: error?.message || String(error),
      });
    });
  }

  logger.info('user_message_sent', {
    requestId,
    userId,
    organizationId,
    messageId: finalRecord.id,
    channel: normalizedChannel,
    status: finalRecord.status ?? 'sent',
  });

  return finalRecord;
};

const CRM_SUMMARY_TEMPLATE = Object.freeze({
  organizations: { total: 0, active: 0, onboarding: 0, newThisMonth: 0 },
  users: { total: 0, active: 0, invited: 0, recentActive: 0 },
  assignments: { coursesLast30d: 0, surveysLast30d: 0, overdue: 0 },
  communication: { messagesLast30d: 0, notificationsLast30d: 0, unreadNotifications: 0 },
  invites: { pending: 0, accepted: 0, expired: 0 },
});

const CRM_ACTIVITY_TEMPLATE = Object.freeze({
  organizations: [],
  users: [],
  messages: [],
  notifications: [],
});

const cloneCrmSummary = () => ({
  organizations: { ...CRM_SUMMARY_TEMPLATE.organizations },
  users: { ...CRM_SUMMARY_TEMPLATE.users },
  assignments: { ...CRM_SUMMARY_TEMPLATE.assignments },
  communication: { ...CRM_SUMMARY_TEMPLATE.communication },
  invites: { ...CRM_SUMMARY_TEMPLATE.invites },
});

const cloneCrmActivity = () => ({
  organizations: [...CRM_ACTIVITY_TEMPLATE.organizations],
  users: [...CRM_ACTIVITY_TEMPLATE.users],
  messages: [...CRM_ACTIVITY_TEMPLATE.messages],
  notifications: [...CRM_ACTIVITY_TEMPLATE.notifications],
});

const countRows = async (table, applyFilters) => {
  if (!supabase) return 0;
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (typeof applyFilters === 'function') {
    const modified = applyFilters(query);
    if (modified) {
      query = modified;
    }
  }
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

const fetchRecentRecords = async ({
  table,
  columns = '*',
  orderBy = 'created_at',
  limit = 6,
  label,
}) => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: false, nullsLast: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.warn('crm_activity_fetch_failed', {
      table,
      label,
      message: error?.message || String(error),
    });
    return [];
  }
};

const loadCrmSummary = async () => {
  const summary = cloneCrmSummary();
  if (!supabase) {
    summary.disabled = true;
    return summary;
  }
  const now = new Date();
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  try {
    const [
      orgTotal,
      orgActive,
      orgOnboarding,
      orgNew,
      userTotal,
      userActive,
      userInvited,
      userRecent,
      courseAssignmentsLast30d,
      surveyAssignmentsLast30d,
      overdueAssignments,
      messagesLast30d,
      notificationsLast30d,
      unreadNotifications,
      pendingInvites,
      acceptedInvites,
      expiredInvites,
    ] = await Promise.all([
      countRows('organizations'),
      countRows('organizations', (query) => query.eq('status', 'active')),
      countRows('organizations', (query) =>
        query.or('status.eq.trial,onboarding_status.neq.complete,onboarding_status.is.null'),
      ),
      countRows('organizations', (query) => query.gte('created_at', monthStart)),
  countRows('user_profiles'),
  countRows('user_profiles', (query) => query.eq('status', 'active')),
      countRows('organization_memberships', (query) => query.eq('status', 'pending')),
  countRows('user_profiles', (query) => query.gte('last_login_at', thirtyDaysAgoIso)),
      countRows('assignments', (query) =>
        query
          .eq('assignment_type', 'course')
          .gte('created_at', thirtyDaysAgoIso),
      ),
      countRows('assignments', (query) =>
        query
          .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
          .gte('created_at', thirtyDaysAgoIso),
      ),
      countRows('assignments', (query) =>
        query
          .or('assignment_type.eq.course,assignment_type.eq.survey')
          .lt('due_at', now.toISOString())
          .in('status', ['assigned', 'in-progress'])
          .eq('active', true),
      ),
      countRows('message_logs', (query) => query.gte('created_at', thirtyDaysAgoIso)),
      countRows('notifications', (query) => query.gte('created_at', thirtyDaysAgoIso)),
      countRows('notifications', (query) => query.eq('status', 'unread')),
      countRows('organization_invites', (query) => query.eq('status', 'pending')),
      countRows('organization_invites', (query) => query.eq('status', 'accepted')),
      countRows('organization_invites', (query) => query.eq('status', 'expired')),
    ]);

    summary.organizations = {
      total: orgTotal,
      active: orgActive,
      onboarding: orgOnboarding,
      newThisMonth: orgNew,
    };
    summary.users = {
      total: userTotal,
      active: userActive,
      invited: userInvited,
      recentActive: userRecent,
    };
    summary.assignments = {
      coursesLast30d: courseAssignmentsLast30d,
      surveysLast30d: surveyAssignmentsLast30d,
      overdue: overdueAssignments,
    };
    summary.communication = {
      messagesLast30d,
      notificationsLast30d,
      unreadNotifications,
    };
    summary.invites = {
      pending: pendingInvites,
      accepted: acceptedInvites,
      expired: expiredInvites,
    };
  } catch (error) {
    logger.warn('crm_summary_failed', {
      message: error?.message || String(error),
    });
  }

  return summary;
};

const loadCrmActivity = async () => {
  const activity = cloneCrmActivity();
  if (!supabase) {
    activity.disabled = true;
    return activity;
  }

  const [orgs, users, messages, notifications] = await Promise.all([
    fetchRecentRecords({
      table: 'organizations',
      columns: 'id,name,status,contact_email,created_at',
      orderBy: 'created_at',
      label: 'organizations',
    }),
    fetchRecentRecords({
      table: 'user_profiles',
      columns: 'id,email,first_name,last_name,role,status,last_login_at,created_at',
      orderBy: 'created_at',
      label: 'users',
    }),
    fetchRecentRecords({
      table: 'message_logs',
      columns: 'id,organization_id,recipient_type,recipient_id,subject,channel,status,sent_at,created_at',
      orderBy: 'created_at',
      label: 'messages',
    }),
    fetchRecentRecords({
      table: 'notifications',
      columns: 'id,title,organization_id,user_id,status,channel,created_at,priority',
      orderBy: 'created_at',
      label: 'notifications',
    }),
  ]);

  activity.organizations = orgs.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    contactEmail: row.contact_email ?? null,
  }));
  activity.users = users.map((row) => ({
    id: row.id,
    email: row.email,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
  }));
  activity.messages = messages.map(mapOrgMessageRecord);
  activity.notifications = notifications.map(mapNotificationRecord);
  return activity;
};

const ASSIGNMENT_NOTIFICATION_LIMIT = Math.min(
  Math.max(Number(process.env.ASSIGNMENT_NOTIFICATION_LIMIT) || 50, 1),
  200,
);
const COURSE_TITLE_CACHE = new Map();
const SURVEY_TITLE_CACHE = new Map();

const fetchAssignmentTitles = async (assignmentType, ids = []) => {
  if (!supabase || !ids.length) return new Map();
  const cache = assignmentType === 'course' ? COURSE_TITLE_CACHE : SURVEY_TITLE_CACHE;
  const pending = ids.filter((id) => id && !cache.has(id));
  if (pending.length) {
    const table = assignmentType === 'course' ? 'courses' : 'surveys';
    try {
      const { data, error } = await supabase.from(table).select('id,title,name,slug').in('id', pending);
      if (error) throw error;
      (data || []).forEach((row) => {
        if (!row?.id) return;
        const label = row.title || row.name || row.slug || row.id;
        cache.set(row.id, label);
      });
    } catch (error) {
      logger.warn('assignment_title_lookup_failed', {
        assignmentType,
        message: error?.message || String(error),
      });
    }
  }
  const map = new Map();
  ids.forEach((id) => {
    if (!id) return;
    map.set(id, cache.get(id) || null);
  });
  return map;
};

const buildInviteAssignmentPreview = async (orgId, { perTypeLimit = 3 } = {}) => {
  const emptyPreview = { courses: [], surveys: [] };
  if (!supabase || !orgId) {
    return emptyPreview;
  }

  const limit = Math.max(1, perTypeLimit);
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('assignment_type, course_id, survey_id, status, due_at, updated_at, created_at')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(limit * 6);

    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return emptyPreview;
      }
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const courseIds = [];
    const surveyIds = [];
    const courseMeta = new Map();
    const surveyMeta = new Map();

    rows.forEach((row) => {
      if (row?.course_id && !courseMeta.has(row.course_id)) {
        courseMeta.set(row.course_id, row);
      }
      if (row?.survey_id && !surveyMeta.has(row.survey_id)) {
        surveyMeta.set(row.survey_id, row);
      }
      if (row?.course_id && courseIds.length < limit && !courseIds.includes(row.course_id)) {
        courseIds.push(row.course_id);
      }
      if (row?.survey_id && surveyIds.length < limit && !surveyIds.includes(row.survey_id)) {
        surveyIds.push(row.survey_id);
      }
    });

    const [courseTitles, surveyTitles] = await Promise.all([
      fetchAssignmentTitles('course', courseIds),
      fetchAssignmentTitles('survey', surveyIds),
    ]);

    const mapAssignmentRows = (ids, metaMap, titles, fallbackLabel) =>
      ids.map((id) => {
        const row = metaMap.get(id) || {};
        return {
          id,
          title: titles.get(id) || row.title || row.name || fallbackLabel,
          dueAt: row.due_at ?? null,
          status: row.status ?? null,
        };
      });

    return {
      courses: mapAssignmentRows(courseIds, courseMeta, courseTitles, 'Assigned course'),
      surveys: mapAssignmentRows(surveyIds, surveyMeta, surveyTitles, 'Assigned survey'),
    };
  } catch (error) {
    logger.warn('invite_assignment_preview_failed', {
      orgId,
      message: error?.message || String(error),
    });
    return emptyPreview;
  }
};

const buildAssignmentNotificationTitle = (assignmentType, entityTitle) => {
  const fallback = assignmentType === 'course' ? 'Course' : 'Survey';
  return assignmentType === 'course'
    ? `New course assigned: ${entityTitle || fallback}`
    : `New survey assigned: ${entityTitle || fallback}`;
};

const buildAssignmentNotificationAction = (assignmentType, row) => {
  if (assignmentType === 'course' && row?.course_id) {
    return {
      actionUrl: `/client/courses/${encodeURIComponent(row.course_id)}`,
      actionLabel: 'Open course',
    };
  }

  if (assignmentType === 'survey' && (row?.survey_id || row?.id)) {
    const params = new URLSearchParams();
    if (row?.id) params.set('assignment', row.id);
    if (row?.survey_id) params.set('focus', row.survey_id);
    const suffix = params.toString();
    return {
      actionUrl: suffix ? `/client/surveys?${suffix}` : '/client/surveys',
      actionLabel: 'Open survey',
    };
  }

  return {
    actionUrl: '/lms/dashboard',
    actionLabel: 'Open learning hub',
  };
};

const assignmentNotificationMetadata = (assignmentType, row) => ({
  assignmentId: row?.id ?? null,
  courseId: row?.course_id ?? null,
  surveyId: row?.survey_id ?? null,
  organizationId: row?.organization_id ?? row?.org_id ?? null,
  dueAt: row?.due_at ?? null,
  status: row?.status ?? null,
  assignmentType,
  ...buildAssignmentNotificationAction(assignmentType, row),
});

// In-memory idempotency store for fallback when table is unavailable
const inMemoryIdempotencyKeys = new Map();
const getInMemoryIdempotencyKey = (key) => inMemoryIdempotencyKeys.get(key) || null;
const setInMemoryIdempotencyKey = (key, value) => inMemoryIdempotencyKeys.set(key, value);
const deleteInMemoryIdempotencyKey = (key) => inMemoryIdempotencyKeys.delete(key);

// Helper to detect missing idempotency_keys table so fallback path can be triggered.
const isIdempotencyTableMissingError = (error) => {
  if (!error) return false;
  const message = String(error.message || error.details || error.toString() || '').toLowerCase();
  return message.includes('idempotency_keys') && (message.includes('could not find the table') || message.includes('does not exist'));
};

const notifyAssignmentRecipients = async ({ assignmentType, assignments = [], actor = null }) => {
  if (!ENABLE_NOTIFICATIONS || !notificationService) return;
  const candidateRows = Array.isArray(assignments)
    ? assignments.filter((row) => row && (row.user_id || row.organization_id || row.org_id))
    : [];
  if (!candidateRows.length) return;

  const limited = candidateRows.slice(0, ASSIGNMENT_NOTIFICATION_LIMIT);
  const ids = Array.from(
    new Set(
      limited
        .map((row) => (assignmentType === 'course' ? row.course_id : row.survey_id))
        .filter(Boolean),
    ),
  );
  const titleMap = await fetchAssignmentTitles(assignmentType, ids);

  let dispatched = 0;
  for (const assignment of limited) {
    const entityId = assignmentType === 'course' ? assignment.course_id : assignment.survey_id;
    const notificationTitle = buildAssignmentNotificationTitle(assignmentType, entityId ? titleMap.get(entityId) : null);
    const organizationId = assignment.organization_id ?? assignment.org_id ?? null;
    const userId = assignment.user_id ?? null;
    const recipientId = userId ?? organizationId;
    if (!recipientId) continue;

    const bodyParts = [];
    if (assignment.due_at) {
      try {
        bodyParts.push(`Due ${new Date(assignment.due_at).toLocaleDateString()}`);
      } catch {
        bodyParts.push('Due soon');
      }
    }
    if (actor?.userId) {
      bodyParts.push(`Assigned by ${actor.userId}`);
    }
    const message = bodyParts.join(' • ') || undefined;

    try {
      await notificationService.createNotification({
        title: notificationTitle,
        body: message,
        organizationId,
        userId,
        type: assignmentType === 'course' ? 'course_assignment' : 'survey_assignment',
        metadata: assignmentNotificationMetadata(assignmentType, assignment),
        priority: 'normal',
        channel: 'in_app',
      });
      dispatched += 1;
    } catch (error) {
      logger.warn('assignment_notification_failed', {
        assignmentType,
        assignmentId: assignment?.id ?? null,
        message: error?.message || String(error),
      });
    }
  }

  if (dispatched > 0) {
    logger.info('assignment_notification_dispatched', {
      assignmentType,
      count: dispatched,
      attempted: limited.length,
    });
  }
};

const fetchOrgInvites = async (orgId, { requestId } = {}) => {
  if (!supabase || !orgId) return [];
  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { data, error } = await supabase
      .from('org_invites')
      .select('id, organization_id, org_id, email, role, status, token, invite_token, created_by, inviter_id, accepted_at, expires_at, reminder_count, created_at')
      .eq(inviteOrgColumn, orgId)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return [];
      }
      throw error;
    }
    return (data || []).map((row) => mapOrgInviteRecord(normalizeOrgInviteRow(row)));
  } catch (error) {
    logOrganizationsStageError('profile_invites_fetch_failed', error, { orgId, requestId });
    return [];
  }
};

const fetchUserMessages = async (userId, { limit = 25 } = {}) => {
  if (!supabase || !userId) return [];
  try {
    const queryLimit = Math.max(1, Math.min(limit, 100));
    const { data, error } = await supabase
      .from('message_logs')
      .select('*')
      .eq('recipient_type', 'user')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(queryLimit);
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return [];
      }
      throw error;
    }
    return (data || []).map(mapOrgMessageRecord);
  } catch (error) {
    logger.warn('user_messages_fetch_failed', {
      userId,
      message: error?.message || String(error),
    });
    return [];
  }
};

const buildOrgProfileMetrics = ({ organization, members, courseAssignmentCount, surveyAssignmentCount }) => {
  const memberRows = Array.isArray(members) ? members : [];
  const activeUsers = memberRows.filter(
    (member) => String(member.status || '').toLowerCase() === 'active',
  ).length;

  return {
    totalUsers: memberRows.length,
    activeUsers,
    coursesAssigned: courseAssignmentCount ?? 0,
    surveysAssigned: surveyAssignmentCount ?? 0,
    courseCompletionRate: Number(organization?.completion_rate ?? 0),
    surveyCompletionRate: Number(organization?.survey_completion_rate ?? 0),
  };
};

const mapOrganizationRecordForProfile = (organization, metrics = null) => {
  if (!organization) return null;
  const shapedMetrics = metrics || {};
  return {
    ...organization,
    contact_person: organization.contact_person ?? organization.contact_name ?? null,
    contact_email: organization.contact_email ?? null,
    contact_phone: organization.contact_phone ?? null,
    address: organization.address ?? null,
    city: organization.city ?? null,
    state: organization.state ?? null,
    country: organization.country ?? null,
    postal_code: organization.postal_code ?? null,
    website: organization.website ?? null,
    total_learners: organization.total_learners ?? shapedMetrics.totalUsers ?? 0,
    active_learners: organization.active_learners ?? shapedMetrics.activeUsers ?? 0,
    completion_rate: organization.completion_rate ?? shapedMetrics.courseCompletionRate ?? 0,
    survey_completion_rate: organization.survey_completion_rate ?? shapedMetrics.surveyCompletionRate ?? 0,
  };
};

const buildOrganizationProfilePayload = async (orgId, options = {}) => {
  const requestId = options.requestId ?? null;
  const bundle = await fetchOrgProfileBundle(orgId);
  if (!bundle) return null;

  let members = [];
  try {
    members = await fetchOrgMembersWithProfiles(orgId);
  } catch (error) {
    logOrganizationsStageError('profile_memberships_failed', error, { orgId, requestId });
    members = [];
  }

  const users = members.map((member) => mapOrgProfileUser(member)).filter(Boolean);
  const [assignmentSummary, invites, recentMessages] = await Promise.all([
    fetchOrgAssignmentSummary(orgId),
    fetchOrgInvites(orgId, options),
    fetchOrgMessages(orgId, { limit: 25 }),
  ]);

  const metrics = buildOrgProfileMetrics({
    organization: bundle.organization,
    members,
    courseAssignmentCount: assignmentSummary?.courses?.assignmentCount ?? 0,
    surveyAssignmentCount: assignmentSummary?.surveys?.assignmentCount ?? 0,
  });

  const contacts = Array.isArray(bundle.contacts) ? bundle.contacts.map(mapContactResponse) : [];
  const invitesList = Array.isArray(invites) ? invites : [];
  const messages = (Array.isArray(recentMessages) ? recentMessages : []).map(mapOrgMessageRecord);
  const admins = users.filter((user) => hasOrgAdminRole(user.role));
  const organization = mapOrganizationRecordForProfile(bundle.organization, metrics);

  return {
    organization,
    profile: bundle.profile,
    branding: bundle.branding,
    contacts,
    admins,
    users,
    metrics,
    invites: invitesList,
    messages,
    assignments: assignmentSummary,
    lastContacted:
      messages[0]?.sentAt ??
      invitesList[0]?.invitedAt ??
      organization?.updated_at ??
      organization?.created_at ??
      null,
  };
};

const buildOrgOverviewPayload = ({
  bundle,
  members,
  onboarding,
  assignmentSummary,
  messages,
}) => {
  if (!bundle) return null;
  const organization = bundle.organization;
  const profile = bundle.profile ?? defaultOrgProfileRow(organization.id);
  const branding = bundle.branding ?? defaultOrgBrandingRow(organization.id);
  const contacts = bundle.contacts ?? [];
  const adminMembers = (members || []).filter((member) =>
    ['owner', 'admin'].includes(String(member.role || '').toLowerCase()),
  );

  const mapMember = (member) => ({
    id: member.id,
    userId: member.user_id ?? null,
    role: member.role ?? null,
    status: member.status ?? null,
    invitedBy: member.invited_by ?? null,
    acceptedAt: member.accepted_at ?? null,
    lastSeenAt: member.last_seen_at ?? null,
    profile: member.profile
      ? {
          name: member.profile.name ?? null,
          email: member.profile.email ?? null,
          title: member.profile.title ?? null,
          department: member.profile.department ?? null,
        }
      : null,
  });

  return {
    organization,
    profile,
    branding,
    contacts,
    admins: adminMembers.map(mapMember),
    members: (members || []).map(mapMember),
    onboarding: onboarding ?? null,
    assignments: assignmentSummary,
    messages,
  };
};

let organizationMembershipsOrganizationIdColumnAvailable = null;

async function detectOrganizationMembershipsOrganizationIdColumnAvailability() {
  if (!supabase) return false;
  if (organizationMembershipsOrganizationIdColumnAvailable !== null) {
    return organizationMembershipsOrganizationIdColumnAvailable;
  }
  try {
    const { error } = await supabase
      .from('organization_memberships')
      .select('user_id', { head: true, count: 'exact' })
      .is('organization_id', null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) {
        organizationMembershipsOrganizationIdColumnAvailable = false;
        return false;
      }
      throw error;
    }
    organizationMembershipsOrganizationIdColumnAvailable = true;
    return true;
  } catch (error) {
    logger.warn('organization_memberships_org_column_probe_failed', {
      message: error?.message || String(error),
    });
    organizationMembershipsOrganizationIdColumnAvailable = false;
    return false;
  }
}

async function getOrganizationMembershipsOrgColumnName() {
  return (await detectOrganizationMembershipsOrganizationIdColumnAvailability()) ? 'organization_id' : 'org_id';
}


async function getOrganizationMembershipsStatusColumnName() {
  if (!supabase) return 'status';
  try {
    const { error } = await supabase
      .from('organization_memberships')
      .select('user_id', { head: true, count: 'exact' })
      .is('status', null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) {
        return 'is_active';
      }
      throw error;
    }
    return 'status';
  } catch (err) {
    logger.warn('organization_memberships_status_column_probe_failed', {
      message: err?.message || String(err),
    });
    return 'status';
  }
}

async function upsertOrganizationMembership(orgId, userId, role, actor) {
  if (!supabase) return null;
  const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
  const payload = {
    user_id: userId,
    role,
    status: 'active',
    invited_by: actor?.userId ?? null,
  };
  payload[membershipOrgColumn] = orgId;
  // Always populate org_id so the non-partial (org_id, user_id) index is usable
  // as a fallback conflict target when organization_id has only a partial index.
  if (membershipOrgColumn === 'organization_id') {
    payload.org_id = String(orgId);
  }

  let data, upsertError;
  // Use .select('*') without .single() to avoid PGRST116 when duplicate rows exist.
  // firstRow() safely picks the first returned row.
  let _upsertResult = await supabase
    .from('organization_memberships')
    .upsert(payload, { onConflict: `${membershipOrgColumn},user_id` })
    .select('*');
  data = firstRow(_upsertResult);
  upsertError = _upsertResult.error;

  if (upsertError && isMembershipConflictTargetError(upsertError) && membershipOrgColumn !== 'org_id') {
    logger.warn('upsert_membership_conflict_target_fallback', {
      primaryColumn: membershipOrgColumn, orgId, userId,
      error: upsertError?.message,
    });
    _upsertResult = await supabase
      .from('organization_memberships')
      .upsert({ ...payload, org_id: String(orgId) }, { onConflict: 'org_id,user_id' })
      .select('*');
    data = firstRow(_upsertResult);
    upsertError = _upsertResult.error;
  }

  if (upsertError) {
    throw upsertError;
  }
  invalidateMembershipCache(userId, { orgId });
  await assignPublishedOrganizationContentToUser({
    orgId,
    userId,
    actorUserId: actor?.userId ?? null,
  });
  await recordActivationEvent(orgId, 'membership_upserted', { userId, role }, actor);
  return data;
}

async function listPublishedOrganizationCourseIds(orgId) {
  if (!supabase || !orgId) return [];

  const candidates = [
    { column: 'organization_id' },
    { column: 'org_id' },
  ];

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('courses')
      .select('id')
      .eq(candidate.column, orgId)
      .eq('status', 'published');

    if (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      throw error;
    }

    return Array.from(new Set((data || []).map((row) => row?.id).filter(Boolean)));
  }

  return [];
}

async function listPublishedOrganizationSurveyIds(orgId) {
  if (!supabase || !orgId) return [];

  const { data, error } = await supabase
    .from('surveys')
    .select('id')
    .eq('status', 'published');
  if (error) throw error;

  const surveyIds = (data || []).map((row) => row?.id).filter(Boolean);
  if (!surveyIds.length) return [];

  const assignmentMap = await fetchSurveyAssignmentsMap(surveyIds);
  return surveyIds.filter((surveyId) => {
    const assignmentRecord = assignmentMap.get(surveyId);
    const assignedTo = applyAssignmentToSurvey({ id: surveyId }, assignmentRecord)?.assignedTo;
    const orgIds = Array.isArray(assignedTo?.organizationIds)
      ? assignedTo.organizationIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    return orgIds.includes(String(orgId).trim());
  });
}

async function assignPublishedOrganizationCoursesToUser({ orgId, userId, actorUserId = null }) {
  if (!supabase || !orgId || !userId) return { inserted: 0, updated: 0, skipped: 0 };

  const courseIds = await listPublishedOrganizationCourseIds(orgId);
  if (!courseIds.length) return { inserted: 0, updated: 0, skipped: 0 };

  const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
  const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
  const existingMap = new Map();
  const seenAssignmentIds = new Set();
  const resolvedAssignedBy = actorUserId && isUuid(actorUserId) ? actorUserId : null;

  const fetchExistingByColumn = async (column) => {
    const { data, error } = await supabase
      .from('assignments')
      .select('id,course_id,user_id,user_id_uuid,metadata,assigned_by,active')
      .eq(assignmentsOrgColumn, orgId)
      .eq('active', true)
      .in('course_id', courseIds)
      .eq(column, userId);
    if (error) throw error;
    return data || [];
  };

  const rowsByUserId = await fetchExistingByColumn('user_id');
  rowsByUserId.forEach((row) => {
    if (!row?.course_id) return;
    seenAssignmentIds.add(row.id);
    existingMap.set(String(row.course_id), row);
  });

  if (assignmentsSupportUserIdUuid) {
    const rowsByUuid = await fetchExistingByColumn('user_id_uuid');
    rowsByUuid.forEach((row) => {
      if (!row?.course_id || seenAssignmentIds.has(row.id)) return;
      seenAssignmentIds.add(row.id);
      existingMap.set(String(row.course_id), row);
    });
  }

  const metadata = {
    assigned_via: 'organization_membership_auto_assign',
    assignment_source: 'organization_membership',
  };

  const updates = [];
  const inserts = [];
  const nowIso = new Date().toISOString();

  courseIds.forEach((courseId) => {
    const existing = existingMap.get(String(courseId));
    if (existing) {
      updates.push({
        id: existing.id,
        metadata: {
          ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
          ...metadata,
        },
        assigned_by: existing.assigned_by ?? resolvedAssignedBy ?? null,
        active: true,
        updated_at: nowIso,
      });
      return;
    }

    const record = {
      course_id: courseId,
      user_id: userId,
      user_id_uuid: userId,
      assignment_type: 'course',
      assigned_by: resolvedAssignedBy ?? null,
      status: 'assigned',
      progress: 0,
      metadata,
      active: true,
      due_at: null,
      note: null,
    };
    record[assignmentsOrgColumn] = orgId;
    inserts.push(sanitizeAssignmentRecordForSchema(record, { includeUserIdUuid: assignmentsSupportUserIdUuid }));
  });

  for (const update of updates) {
    const { id, ...changes } = update;
    const { error } = await supabase
      .from('assignments')
      .update(changes)
      .eq('id', id);
    if (error) throw error;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('assignments').insert(inserts);
    if (error) throw error;
  }

  return {
    inserted: inserts.length,
    updated: updates.length,
    skipped: Math.max(courseIds.length - inserts.length - updates.length, 0),
  };
}

async function backfillPublishedCourseAssignmentsWithTx(
  tx,
  {
    orgId,
    courseId,
    actorUserId = null,
    assignmentsOrgColumn = 'organization_id',
    assignmentsSupportUserIdUuid = false,
  },
) {
  if (!orgId || !courseId) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const memberRows = await tx`
    select distinct user_id
    from public.organization_memberships
    where organization_id = ${orgId}::uuid
      and user_id is not null
      and lower(coalesce(status, 'active')) = 'active'
  `;
  const userIds = Array.from(new Set(memberRows.map((row) => row.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const existingRows = await tx.unsafe(
    assignmentsSupportUserIdUuid
      ? `
        select id, user_id, user_id_uuid, metadata, assigned_by
        from public.assignments
        where ${assignmentsOrgColumn === 'org_id' ? 'org_id' : 'organization_id'} = $1::uuid
          and course_id = $2::uuid
          and assignment_type = 'course'
          and active = true
      `
      : `
        select id, user_id, metadata, assigned_by
        from public.assignments
        where ${assignmentsOrgColumn === 'org_id' ? 'org_id' : 'organization_id'} = $1::uuid
          and course_id = $2::uuid
          and assignment_type = 'course'
          and active = true
      `,
    [orgId, courseId],
  );

  const existingByUserId = new Map();
  existingRows.forEach((row) => {
    if (row?.user_id) existingByUserId.set(String(row.user_id), row);
    if (assignmentsSupportUserIdUuid && row?.user_id_uuid) {
      existingByUserId.set(String(row.user_id_uuid), row);
    }
  });

  const metadata = JSON.stringify({
    assigned_via: 'organization_membership_auto_assign',
    assignment_source: 'organization_membership',
  });
  const resolvedAssignedBy = actorUserId && isUuid(actorUserId) ? actorUserId : null;
  let inserted = 0;
  let updated = 0;

  for (const userId of userIds) {
    const existing = existingByUserId.get(String(userId));
    if (existing?.id) {
      await tx.unsafe(
        `
          update public.assignments
          set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb,
              assigned_by = coalesce(assigned_by, $2::uuid),
              active = true,
              updated_at = now()
          where id = $3::uuid
        `,
        [metadata, resolvedAssignedBy, existing.id],
      );
      updated += 1;
      continue;
    }

    if (assignmentsSupportUserIdUuid) {
      await tx.unsafe(
        `
          insert into public.assignments
            (course_id, ${assignmentsOrgColumn === 'org_id' ? 'org_id' : 'organization_id'}, user_id, user_id_uuid, assignment_type, assigned_by, status, progress, metadata, active, due_at, note, created_at, updated_at)
          values
            ($1::uuid, $2::uuid, $3, $4::uuid, 'course', $5::uuid, 'assigned', 0, $6::jsonb, true, null, null, now(), now())
        `,
        [courseId, orgId, String(userId), userId, resolvedAssignedBy, metadata],
      );
    } else {
      await tx.unsafe(
        `
          insert into public.assignments
            (course_id, ${assignmentsOrgColumn === 'org_id' ? 'org_id' : 'organization_id'}, user_id, assignment_type, assigned_by, status, progress, metadata, active, due_at, note, created_at, updated_at)
          values
            ($1::uuid, $2::uuid, $3, 'course', $4::uuid, 'assigned', 0, $5::jsonb, true, null, null, now(), now())
        `,
        [courseId, orgId, String(userId), resolvedAssignedBy, metadata],
      );
    }
    inserted += 1;
  }

  return {
    inserted,
    updated,
    skipped: Math.max(userIds.length - inserted - updated, 0),
  };
}

async function assignPublishedOrganizationSurveysToUser({ orgId, userId, actorUserId = null }) {
  if (!supabase || !orgId || !userId) return { inserted: 0, updated: 0, skipped: 0 };

  const surveyIds = await listPublishedOrganizationSurveyIds(orgId);
  if (!surveyIds.length) return { inserted: 0, updated: 0, skipped: 0 };
  const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
  const resolvedAssignedBy = actorUserId && isUuid(actorUserId) ? actorUserId : null;

  const { data: existingRows, error: existingError } = await supabase
    .from('assignments')
    .select('id,survey_id,metadata,assigned_by,active')
    .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
    .eq(assignmentsOrgColumn, orgId)
    .eq('user_id', userId)
    .eq('active', true)
    .in('survey_id', surveyIds);
  if (existingError) throw existingError;

  const existingMap = new Map((existingRows || []).filter((row) => row?.survey_id).map((row) => [String(row.survey_id), row]));
  const metadata = {
    assigned_via: 'organization_membership_auto_assign',
    assignment_source: 'organization_membership',
  };

  const updates = [];
  const inserts = [];

  surveyIds.forEach((surveyId) => {
    const existing = existingMap.get(String(surveyId));
    if (existing) {
      updates.push({
        id: existing.id,
        metadata: {
          ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
          ...metadata,
        },
        assigned_by: existing.assigned_by ?? resolvedAssignedBy ?? null,
        active: true,
      });
      return;
    }

    inserts.push({
      survey_id: surveyId,
      course_id: null,
      user_id: userId,
      assignment_type: SURVEY_ASSIGNMENT_TYPE,
      status: 'assigned',
      due_at: null,
      note: null,
      assigned_by: resolvedAssignedBy ?? null,
      metadata,
      active: true,
    });
    inserts[inserts.length - 1][assignmentsOrgColumn] = orgId;
  });

  for (const update of updates) {
    const { id, ...changes } = update;
    const { error } = await supabase
      .from('assignments')
      .update(changes)
      .eq('id', id);
    if (error) throw error;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('assignments').insert(inserts);
    if (error) throw error;
    await Promise.all(
      Array.from(new Set(inserts.map((row) => row.survey_id).filter(Boolean))).map((surveyId) =>
        refreshSurveyAssignmentAggregates(surveyId),
      ),
    );
  }

  return {
    inserted: inserts.length,
    updated: updates.length,
    skipped: Math.max(surveyIds.length - inserts.length - updates.length, 0),
  };
}
async function assignPublishedOrganizationContentToUser({ orgId, userId, actorUserId = null }) {
  if (!supabase || !orgId || !userId) {
    return {
      courses: { inserted: 0, updated: 0, skipped: 0 },
      surveys: { inserted: 0, updated: 0, skipped: 0 },
    };
  }

  const [courses, surveys] = await Promise.all([
    assignPublishedOrganizationCoursesToUser({ orgId, userId, actorUserId }),
    assignPublishedOrganizationSurveysToUser({ orgId, userId, actorUserId }),
  ]);

  logger.info('organization_membership_auto_assignment_completed', {
    orgId,
    userId,
    actorUserId: actorUserId ?? null,
    courseInserted: courses.inserted,
    courseUpdated: courses.updated,
    surveyInserted: surveys.inserted,
    surveyUpdated: surveys.updated,
  });

  return { courses, surveys };
}

async function assignPublishedOrganizationCoursesToActiveMembers({ orgId, actorUserId = null }) {
  if (!supabase || !orgId) return { assignedUsers: 0 };

  const members = await fetchOrgMembersWithProfiles(orgId);
  const userIds = Array.from(
    new Set(
      (members || [])
        .filter((member) => String(member?.status || '').toLowerCase() === 'active')
        .map((member) => member?.user_id ?? member?.user?.id ?? null)
        .filter(Boolean),
    ),
  );

  for (const userId of userIds) {
    await assignPublishedOrganizationCoursesToUser({ orgId, userId, actorUserId });
  }

  logger.info('organization_course_backfill_completed', {
    orgId,
    actorUserId: actorUserId ?? null,
    assignedUsers: userIds.length,
  });

  return { assignedUsers: userIds.length };
}

async function upsertProvisionedUserRecord({
  userId,
  email,
  password,
  firstName,
  lastName,
  orgId,
  isAdmin = false,
}) {
  if (!supabase || !userId || !email) return;
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  const payload = {
    id: userId,
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    role: isAdmin ? 'admin' : 'user',
    is_active: true,
    organization_id: orgId ?? null,
  };
  if (passwordHash) {
    payload.password_hash = passwordHash;
  }
  await runOptionalCleanupMutation(
    'provision_user.user_profiles_upsert',
    () => supabase.from('user_profiles').upsert(payload, { onConflict: 'id' }),
    { userId, orgId, email },
  );
}

async function updateProvisionedUserProfile(userId, orgId, updates = {}) {
  if (!supabase || !userId) return null;

  const {
    firstName,
    lastName,
    email,
    jobTitle,
    department,
    cohort,
    phoneNumber,
    membershipRole,
  } = updates;

  const normalizedEmail = normalizeProvisioningEmail(email);
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (existingProfileError && !isMissingRelationError(existingProfileError)) {
    throw existingProfileError;
  }

  const mergedFirstName = firstName !== undefined ? firstName?.trim?.() || null : existingProfile?.first_name ?? null;
  const mergedLastName = lastName !== undefined ? lastName?.trim?.() || null : existingProfile?.last_name ?? null;
  const metadata = {
    ...(existingProfile?.metadata && typeof existingProfile.metadata === 'object' ? existingProfile.metadata : {}),
    ...buildProvisionedProfileMetadata({
      firstName: mergedFirstName || '',
      lastName: mergedLastName || '',
      jobTitle: jobTitle !== undefined ? String(jobTitle || '').trim() : String(existingProfile?.metadata?.job_title || ''),
      department: department !== undefined ? String(department || '').trim() : String(existingProfile?.metadata?.department || ''),
      cohort: cohort !== undefined ? String(cohort || '').trim() : String(existingProfile?.metadata?.cohort || ''),
      phoneNumber: phoneNumber !== undefined ? String(phoneNumber || '').trim() : String(existingProfile?.metadata?.phone_number || ''),
    }),
  };

  const requestedMembershipRole = membershipRole ? normalizeOrgRole(membershipRole) : null;
  const shouldElevateAdmin = requestedMembershipRole ? writableMembershipRoles.has(requestedMembershipRole) : false;
  const payload = {
    id: userId,
    email: normalizedEmail || existingProfile?.email || null,
    first_name: mergedFirstName,
    last_name: mergedLastName,
    organization_id: orgId ?? existingProfile?.organization_id ?? null,
    role: shouldElevateAdmin ? 'admin' : existingProfile?.role || 'learner',
    is_active: existingProfile?.is_active ?? true,
    is_admin: shouldElevateAdmin ? true : existingProfile?.is_admin ?? false,
    metadata,
  };

  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw error;
  }

  if (normalizedEmail || mergedFirstName !== null || mergedLastName !== null) {
    const authUpdatePayload = {
      user_metadata: {
        first_name: mergedFirstName,
        last_name: mergedLastName,
        organization_id: orgId ?? null,
      },
    };
    if (normalizedEmail) {
      authUpdatePayload.email = normalizedEmail;
      authUpdatePayload.email_confirm = true;
    }
    try {
      await supabase.auth.admin.updateUserById(userId, authUpdatePayload);
    } catch (error) {
      logger.warn('user_profile_auth_sync_failed', {
        userId,
        message: error?.message || String(error),
      });
    }
  }

  const userPayload = {};
  if (normalizedEmail) {
    userPayload.email = normalizedEmail;
  }
  if (mergedFirstName !== null) {
    userPayload.first_name = mergedFirstName;
  }
  if (mergedLastName !== null) {
    userPayload.last_name = mergedLastName;
  }
  if (Object.keys(userPayload).length > 0 || orgId) {
    if (orgId) {
      userPayload.organization_id = orgId;
    }
    await runOptionalCleanupMutation(
      'provision_user.user_profiles_sync',
      () =>
        supabase.from('user_profiles').upsert(
          {
            id: userId,
            ...userPayload,
            is_active: true,
          },
          { onConflict: 'id' },
        ),
      { userId, orgId, email: normalizedEmail ?? null },
    );
  }

  return payload;
}

async function runOptionalCleanupMutation(label, operation, meta = {}) {
  try {
    const result = await operation();
    if (result?.error) {
      if (isMissingRelationError(result.error) || isMissingColumnError(result.error)) {
        logger.warn('optional_cleanup_skipped', {
          label,
          reason: result.error.message || String(result.error),
          ...meta,
        });
        return null;
      }
      throw result.error;
    }
    return result?.data ?? null;
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      logger.warn('optional_cleanup_skipped', {
        label,
        reason: error?.message || String(error),
        ...meta,
      });
      return null;
    }
    throw error;
  }
}

async function archiveOrganizationUserAccount({ userId, orgId, requestId = null }) {
  if (!supabase || !userId || !orgId) {
    throw createHttpError(400, 'invalid_archive_request', 'userId and organizationId are required.');
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, role, status')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw createHttpError(404, 'membership_not_found', 'Organization membership was not found.');
  }

  if (membership.role === 'owner' && membership.status === 'active') {
    const { count, error: ownerCountError } = await supabase
      .from('organization_memberships')
      .select('id', { head: true, count: 'exact' })
      .eq('organization_id', orgId)
      .eq('role', 'owner')
      .eq('status', 'active');
    if (ownerCountError) throw ownerCountError;
    if (!count || count <= 1) {
      throw createHttpError(400, 'owner_required', 'At least one active owner is required.');
    }
  }

  const { error: revokeError } = await supabase
    .from('organization_memberships')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (revokeError) throw revokeError;

  const { data: remainingMemberships, error: remainingError } = await supabase
    .from('organization_memberships')
    .select('organization_id, status')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (remainingError) throw remainingError;

  const nextOrgId =
    Array.isArray(remainingMemberships) && remainingMemberships.length > 0
      ? pickOrgId(remainingMemberships[0]?.organization_id, remainingMemberships[0]?.org_id)
      : null;
  const stillActive = Boolean(nextOrgId);

  await runOptionalCleanupMutation(
    'archive_user.user_profiles',
    () =>
      supabase
        .from('user_profiles')
        .update({
          is_active: stillActive,
          organization_id: nextOrgId,
        })
        .eq('id', userId),
    { userId, orgId, requestId },
  );

  await runOptionalCleanupMutation(
    'archive_user.user_profiles',
    () =>
      supabase
        .from('user_profiles')
        .update({
          is_active: stillActive,
          organization_id: nextOrgId,
        })
        .eq('id', userId),
    { userId, orgId, requestId },
  );

  return { archived: true, userId, orgId, stillActive, nextOrgId };
}

async function permanentlyDeleteUserAccount({ userId, requestId = null }) {
  if (!supabase || !userId) {
    throw createHttpError(400, 'invalid_delete_request', 'userId is required.');
  }

  await runOptionalCleanupMutation(
    'delete_user.assignments.user_id',
    () => supabase.from('assignments').delete().eq('user_id', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.assignments.user_id_uuid',
    () => supabase.from('assignments').delete().eq('user_id_uuid', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.survey_assignments',
    () => supabase.from('survey_assignments').delete().eq('user_id', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.message_logs.recipient',
    () => supabase.from('message_logs').delete().eq('recipient_id', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.message_logs.sent_by',
    () => supabase.from('message_logs').update({ sent_by: null }).eq('sent_by', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.org_invites.accepted_user',
    () => supabase.from('org_invites').update({ accepted_user_id: null }).eq('accepted_user_id', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.organization_memberships',
    () => supabase.from('organization_memberships').delete().eq('user_id', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.user_profiles',
    () => supabase.from('user_profiles').delete().eq('id', userId),
    { userId, requestId },
  );
  await runOptionalCleanupMutation(
    'delete_user.user_profiles_duplicate',
    () => supabase.from('user_profiles').delete().eq('id', userId),
    { userId, requestId },
  );

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    throw authDeleteError;
  }

  return { deleted: true, userId };
}

async function fetchOnboardingProgress(orgId) {
  if (!supabase) return null;
  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
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
        .eq(inviteOrgColumn, orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    return {
      summary: progress,
      steps: steps || [],
      invites: (invites || []).map((invite) => normalizeOrgInviteRow(invite)),
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
      .select('id, name, slug, contact_email, contact_person')
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
    supabase.from('organization_profiles').select('*').in('organization_id', orgIds),
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
    acc[row.organization_id] = row;
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
    supabase.from('organization_profiles').select('*').eq('organization_id', orgId).maybeSingle(),
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
  const allowDiag =
    (process.env.DEBUG_DIAG || '').toLowerCase() === 'true' ||
    (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  if (!allowDiag) {
    res.status(403).json({ error: 'Diagnostics disabled' });
    return;
  }

  const diagnostics = {
    supabaseConfigured: Boolean(supabase),
    supabaseUrlPresent: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
    supabaseServiceRoleKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_SERVICE_KEY,
    databaseUrlPresent: databaseConnectionInfo.connectionStringDefined,
    jwtAccessSecretPresent: !!process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecretPresent: !!process.env.JWT_REFRESH_SECRET,
    cookieDomain: !!process.env.COOKIE_DOMAIN,
    corsAllowedConfigured: resolvedCorsOrigins.length > 0,
    devFallbackMode: isDemoMode,
    e2eMode: isTestMode,
    enforceHttpsEnabled: (process.env.ENFORCE_HTTPS || '').toLowerCase() === 'true',
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

app.get('/api/diagnostics/schema', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  if (context.userRole !== 'admin') {
    res.status(403).json({ error: 'admin_required', message: 'Schema diagnostics require admin access' });
    return;
  }

  const requiredTables = new Set([
    'courses',
    'modules',
    'lessons',
    'course_assignments',
    'user_course_progress',
    'user_lesson_progress',
    'quiz_attempts',
  ]);
  if (ENABLE_NOTIFICATIONS) {
    requiredTables.add('notifications');
  }
  const requiredColumns = new Map([
    ['modules', ['description', 'client_temp_id']],
    ['lessons', ['content_json', 'client_temp_id']],
  ]);
  if (ENABLE_NOTIFICATIONS) {
    requiredColumns.set('notifications', ['title', 'type', 'created_at']);
  }
  const requiredFunctions = ['upsert_course_graph'];

  try {
    const tableRows = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const tableSet = new Set(tableRows.map((row) => row.table_name));
    const missingTables = Array.from(requiredTables).filter((table) => !tableSet.has(table));

    const columnRows = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    `;
    const columnMap = new Map();
    for (const row of columnRows) {
      if (!columnMap.has(row.table_name)) {
        columnMap.set(row.table_name, new Set());
      }
      columnMap.get(row.table_name).add(row.column_name);
    }
    const missingColumns = {};
    for (const [table, columns] of requiredColumns.entries()) {
      const available = columnMap.get(table) || new Set();
      const missing = columns.filter((col) => !available.has(col));
      if (missing.length > 0) {
        missingColumns[table] = missing;
      }
    }

    const functionRows = await sql`
      select proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    `;
    const fnSet = new Set(functionRows.map((row) => row.proname));
    const missingFunctions = requiredFunctions.filter((fn) => !fnSet.has(fn));

    const ok = missingTables.length === 0 && Object.keys(missingColumns).length === 0 && missingFunctions.length === 0;
    res.json({
      ok,
      missingTables,
      missingColumns,
      missingFunctions,
      schemaHealth,
    });
  } catch (error) {
    logger.error('schema_diagnostics_failed', {
      message: error?.message || error,
    });
    res
      .status(500)
      .json({ ok: false, error: 'schema_check_failed', message: error?.message || String(error), schemaHealth });
  }
});

app.get('/api/debug/memberships', async (req, res) => {
  if (!DEBUG_MEMBERSHIP_TOKEN) {
    return res.status(404).json({ error: 'disabled' });
  }
  const providedToken = typeof req.headers['x-debug-token'] === 'string' ? req.headers['x-debug-token'] : null;
  if (providedToken !== DEBUG_MEMBERSHIP_TOKEN) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!supabase) {
    return res.status(503).json({ error: 'supabase_unconfigured' });
  }
  const userIdParam = typeof req.query.userId === 'string' ? req.query.userId : '';
  const userId = userIdParam.trim();
  if (!userId) {
    return res.status(400).json({ error: 'user_id_required' });
  }
  try {
    const selectColumns = [
      'id',
      'organization_id',
      'user_id',
      'role',
      'status',
      'created_at',
      'updated_at',
    ];
    const filter = await buildMembershipFilterString(userId);
    let query = supabase
      .from('organization_memberships')
      .select(selectColumns.join(','))
      .eq('status', 'active');
    if (filter) {
      query = query.or(filter);
    } else {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    res.json({
      userId,
      supabaseUrlHost,
      dbHost: databaseHost,
      membershipCount: Array.isArray(data) ? data.length : 0,
      membershipRows: data || [],
    });
  } catch (error) {
    logger.error('debug_memberships_failed', {
      userId,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
    });
    res.status(500).json({ error: 'debug_memberships_failed', message: error?.message ?? String(error) });
  }
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
  if (isDemoMode || !supabase) {
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

app.get('/api/admin/courses', authenticate, async (req, res) => {
  console.debug('[ADMIN COURSES HANDLER HIT]', { url: req.url, method: req.method });
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

  const resolvedRequestedOrgId = requestedOrgId ? await coerceOrgIdentifierToUuid(req, requestedOrgId) : null;
  // Blocker 3: even platform admins must request a valid, resolvable org scope
  if (requestedOrgId && (!resolvedRequestedOrgId || !isUuid(String(resolvedRequestedOrgId).trim()))) {
    res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
    return;
  }

  const isPlatformAdmin = Boolean(context.isPlatformAdmin);
  if (shouldLogAuthDebug) {
    console.log('[admin.courses] access_context', {
      requestId: req.requestId,
      userId: context.userId || null,
      userRole: context.userRole || null,
      isPlatformAdmin,
      requestedOrgId: requestedOrgId || null,
    });
  }
  let adminOrgIds = Array.isArray(context.memberships)
    ? context.memberships
        .filter((membership) => hasOrgAdminRole(membership.role) && membership.orgId)
        .map((membership) => normalizeOrgIdValue(membership.orgId))
        .filter(Boolean)
    : [];
  let allowedOrgIdSet = new Set(adminOrgIds);

  if (!isPlatformAdmin && adminOrgIds.length === 0 && supabase) {
    if (shouldLogAuthDebug) {
      console.log('[admin.courses] membership_lookup_fallback', {
        requestId: req.requestId,
        userId: context.userId || null,
        reason: 'no_cached_admin_memberships',
      });
    }
    try {
      const { data: adminMemberships, error: adminMembershipsError } = await supabase
        .from('organization_memberships')
        .select('organization_id, role, status')
        .eq('user_id', context.userId)
        .eq('status', 'active');

      if (adminMembershipsError) throw adminMembershipsError;

      adminOrgIds = (adminMemberships || [])
        .filter((membership) => hasOrgAdminRole(membership.role))
        .map((membership) => membership.organization_id)
        .filter(Boolean);

      allowedOrgIdSet = new Set(adminOrgIds);
      if (shouldLogAuthDebug) {
        console.log('[admin.courses] membership_lookup_result', {
          requestId: req.requestId,
          userId: context.userId || null,
          resolvedOrgIds: adminOrgIds,
        });
      }
    } catch (membershipLookupError) {
      logAdminCoursesError(req, membershipLookupError, 'Failed to load admin memberships');
      res.status(500).json({ error: 'Unable to verify admin organization memberships' });
      return;
    }
  }

  const restrictToAllowed = !isPlatformAdmin && !resolvedRequestedOrgId;

  if (!isPlatformAdmin && adminOrgIds.length === 0) {
    res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required.' });
    return;
  }

  if (!isPlatformAdmin && !resolvedRequestedOrgId && adminOrgIds.length === 0) {
    res.json({ data: [], pagination: { page: 1, pageSize: 0, total: 0, hasMore: false } });
    return;
  }

  if (resolvedRequestedOrgId) {
    const access = await requireOrgAccess(req, res, resolvedRequestedOrgId, { write: false, requireOrgAdmin: true });
    if (!access) return;
    if (!isPlatformAdmin && !allowedOrgIdSet.has(resolvedRequestedOrgId)) {
      res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
      return;
    }
  }

  if (isDemoOrTestMode) {
    try {
      const reqIncludeStructure = parseBooleanParam(req.query.includeStructure, false);
      const reqIncludeLessons = parseBooleanParam(req.query.includeLessons, reqIncludeStructure);
      if (NODE_ENV !== 'production') {
        console.log('[admin.courses][isDemoMode] query_flags', {
          includeStructure: reqIncludeStructure,
          includeLessons: reqIncludeLessons,
          storeSize: e2eStore.courses.size,
        });
      }
      const shaped = Array.from(e2eStore.courses.values())
        // Belt-and-suspenders: filter E2E/Integration Test courses at serve time
        // so any that were created after the startup purge don't appear in admin lists.
        .filter((c) => isTestMode || !isE2ECourseEntry(c))
        .map((c) => ({
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
      if (resolvedRequestedOrgId) {
        return courseOrgId === resolvedRequestedOrgId;
      }
      if (!isPlatformAdmin) {
          return courseOrgId ? allowedOrgIdSet.has(courseOrgId) : false;
        }
        return true;
      });
      // Honor includeStructure flag: run ensureCourseStructureLoaded on each
      // course (no-op when modules already populated, normalizes otherwise).
      const responseData = reqIncludeStructure
        ? await Promise.all(filtered.map((c) => ensureCourseStructureLoaded(c, { includeLessons: reqIncludeLessons })))
        : filtered;
      // Admin surfaces must show all saved courses, including historical drafts
      // and partially-built rows, otherwise previously created content appears to
      // disappear after login or org switches.
      const catalogData = responseData;
      if (NODE_ENV !== 'production') {
        console.log('[admin.courses][isDemoMode] response_shape', {
          total: catalogData.length,
          excluded: responseData.length - catalogData.length,
          withModules: catalogData.filter((c) => Array.isArray(c.modules) && c.modules.length > 0).length,
          withLessons: catalogData.filter((c) => (c.modules || []).some((m) => Array.isArray(m.lessons) && m.lessons.length > 0)).length,
        });
      }
      const responseBody = {
        data: catalogData,
        pagination: { page: 1, pageSize: catalogData.length, total: catalogData.length, hasMore: false },
      };
      if (NODE_ENV !== 'production') {
        responseBody.debug = {
          filterOrgId: requestedOrgId || null,
          totalCountForOrg: catalogData.length,
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
  if (NODE_ENV !== 'production') {
    console.log('[admin.courses][supabase] query_flags', {
      includeStructure,
      includeLessons,
      url: req.url,
    });
  }
  const search = (req.query.search || '').toString().trim();
  const statusFilter = (req.query.status || '')
    .toString()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const orgFilter = resolvedRequestedOrgId || '';

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
    const hydratedData = includeStructure
      ? await Promise.all(
          normalizedData.map((courseRecord) =>
            ensureCourseStructureLoaded(courseRecord, { includeLessons }),
          ),
        )
      : normalizedData;

    // Admin catalog must include draft/incomplete courses so previously created
    // content remains discoverable and editable after deploys.
    const catalogData = hydratedData;

    if (NODE_ENV !== 'production') {
      console.log('[admin.courses][supabase] response_shape', {
        rawCount: normalizedData.length,
        hydratedCount: hydratedData.length,
        catalogCount: catalogData.length,
        excludedIncomplete: hydratedData.length - catalogData.length,
        includeStructure,
        withModules: catalogData.filter((c) => Array.isArray(c.modules) && c.modules.length > 0).length,
        withLessons: catalogData.filter((c) => (c.modules || []).some((m) => Array.isArray(m.lessons) && m.lessons.length > 0)).length,
      });
    }

    // [SERVER COURSES] — always log summary so corrupted data is immediately visible in server logs.
    console.log('[SERVER COURSES]', {
      source: 'supabase',
      count: catalogData.length,
      courses: catalogData.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        moduleCount: Array.isArray(c.modules) ? c.modules.length : 0,
        lessonCount: Array.isArray(c.modules)
          ? c.modules.reduce((sum, m) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0)
          : 0,
      })),
    });

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
      data: catalogData,
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

app.get('/api/admin/courses/:identifier', authenticate, async (req, res) => {
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
        .filter((membership) => hasOrgAdminRole(membership.role) && membership.orgId)
        .map((membership) => normalizeOrgIdValue(membership.orgId))
        .filter(Boolean)
    : [];
  const allowedOrgIdSet = new Set(adminOrgIds);

  if (!isPlatformAdmin && adminOrgIds.length === 0) {
    res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required.' });
    return;
  }

  if (isDemoOrTestMode) {
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

const logAdminCourseUpdateEvent = (event, meta = {}) => {
  try {
    console.info('[admin.courses.update]', { event, ...meta });
  } catch (_) {
    /* no-op */
  }
};

const respondAdminCourseConflict = (res, { reason, message, requestId = null, details = null }) => {
  res.status(409).json({
    ok: false,
    code: 'conflict',
    message,
    requestId,
    details: {
      reason,
      ...(details || {}),
    },
  });
};

const normalizeKeyTakeawaysInput = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          return trimmed ? trimmed : null;
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof input === 'object' && input !== null) {
    if (Array.isArray(input?.items)) {
      return normalizeKeyTakeawaysInput(input.items);
    }
  }
  return [];
};

async function handleAdminCourseUpsert(req, res, options = {}) {
  const { courseIdFromParams = null } = options;
  if (courseIdFromParams && !isUuid(courseIdFromParams) && !isFallbackMode) {
    sendApiError(res, 400, 'invalid_course_id', 'Course ID must be a UUID.', {
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }
  req.body = req.body || {};
  normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.upsert', requestId: req.requestId });
  let upsertRequest;
  try {
    upsertRequest = parseUpsertRequestBody(req.body);
  } catch (parseError) {
    sendApiError(
      res,
      parseError?.status || 400,
      parseError?.code || 'invalid_upsert_payload',
      parseError?.message || 'Invalid upsert payload.',
      {
        issues: Array.isArray(parseError?.issues) ? parseError.issues : undefined,
        meta: { requestId: req.requestId ?? null },
      },
    );
    return;
  }

  const writeMeta = {
    idempotencyKey: upsertRequest.idempotency_key ?? null,
    clientEventId: upsertRequest.client_event_id ?? null,
    action: upsertRequest.action ?? null,
  };

  let { course: courseLocal, modules: modulesLocal = [] } = upsertRequest;
  modulesLocal = Array.isArray(modulesLocal)
    ? modulesLocal.map((module, moduleIndex) => normalizeModuleForImport(module, { moduleIndex }))
    : [];
  req.body.modules = modulesLocal;
  if (!courseLocal) {
    sendApiError(res, 400, 'course_required', 'Missing course object in request body.', {
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }
  if (courseIdFromParams) {
    const incomingId = courseLocal?.id ?? null;
    if (incomingId && String(incomingId) !== String(courseIdFromParams)) {
      sendApiError(res, 400, 'course_id_mismatch', 'Course ID in payload must match URL parameter.', {
        meta: { requestId: req.requestId ?? null },
      });
      return;
    }
    courseLocal = { ...(courseLocal || {}), id: courseIdFromParams };
    req.body.course = courseLocal;
  }

  const normalizedKeyTakeaways = normalizeKeyTakeawaysInput(
    courseLocal?.key_takeaways ??
      courseLocal?.keyTakeaways ??
      courseLocal?.meta?.key_takeaways ??
      courseLocal?.meta?.keyTakeaways ??
      [],
  );
  courseLocal.key_takeaways = normalizedKeyTakeaways;
  courseLocal.keyTakeaways = normalizedKeyTakeaways;
  if (req.body?.course) {
    req.body.course.key_takeaways = normalizedKeyTakeaways;
    req.body.course.keyTakeaways = normalizedKeyTakeaways;
  }

  // Strip version if it is not a valid positive integer (validator will default to undefined/omitted)
  if (courseLocal.version !== undefined && (typeof courseLocal.version !== 'number' || !Number.isFinite(courseLocal.version) || courseLocal.version <= 0)) {
    delete courseLocal.version;
  }

  const payloadValidation = validateCoursePayload(
    { course: courseLocal, modules: modulesLocal },
    { enforceLessonContent: false },
  );
  if (!payloadValidation.ok && !isDemoMode) {
    const details = (payloadValidation.issues || []).map((issue) => {
      const moduleMatch = /modules\[(\d+)\]/.exec(issue.path || '');
      const lessonMatch = /lessons\[(\d+)\]/.exec(issue.path || '');
      return {
        field: issue.path || null,
        message: issue.message,
        code: issue.code || 'validation_error',
        receivedValueType: issue.receivedValueType ?? null,
        moduleIndex: moduleMatch ? Number(moduleMatch[1]) : null,
        lessonIndex: lessonMatch ? Number(lessonMatch[1]) : null,
      };
    });
    logAdminCourseUpdateEvent('validation_failed', {
      requestId: req.requestId ?? null,
      courseId: courseLocal?.id ?? courseIdFromParams ?? null,
      orgId: courseLocal?.organization_id ?? req.activeOrgId ?? null,
      slug: courseLocal?.slug ?? null,
      detailsCount: details.length,
    });
    res.status(422).json({
      ok: false,
      code: 'validation_failed',
      message: 'Course payload validation failed.',
      requestId: req.requestId ?? null,
      details,
    });
    return;
  }
  if (payloadValidation.ok) {
    ({ course: courseLocal, modules: modulesLocal } = payloadValidation.data);
    req.body.course = courseLocal;
    req.body.modules = modulesLocal;
  }

  // Handle legacy non-UUID course IDs by mapping them to internal UUID and preserving slug/meta.
  // In fallback/E2E mode, non-UUID ids (like 'e2e-course-xxx') are valid store keys — skip remapping.
  if (courseLocal && courseLocal.id && !isUuid(String(courseLocal.id).trim()) && !isFallbackMode) {
    const legacyCourseId = String(courseLocal.id).trim();
    courseLocal.slug = courseLocal.slug ? String(courseLocal.slug).trim() : legacyCourseId;
    courseLocal.meta_json = courseLocal.meta_json || {};
    if (!courseLocal.meta_json.external_id) {
      courseLocal.meta_json.external_id = legacyCourseId;
    }
    courseLocal.id = randomUUID();
    req.legacyCourseId = legacyCourseId;
    if (req.body?.course) {
      req.body.course = { ...req.body.course, ...courseLocal };
    }
  }

  const context = requireUserContext(req, res);
  if (!context) return;
  const baseLogMeta = {
    requestId: req.requestId ?? null,
    userId: context.userId ?? null,
    courseId: courseLocal?.id ?? courseIdFromParams ?? null,
  };
  const resolveCurrentOrgForLog = () =>
    req.body?.course?.organization_id ??
    req.body?.organization_id ??
    courseLocal?.organization_id ??
    courseLocal?.org_id ??
    req.activeOrgId ??
    context.activeOrganizationId ??
    null;
  const resolveCurrentSlugForLog = () => req.body?.course?.slug ?? courseLocal?.slug ?? null;
  if (isFallbackMode) {
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

    const demoIdempotencyKey = writeMeta.idempotencyKey ?? writeMeta.clientEventId ?? null;
      if (demoIdempotencyKey) {
        const existingResourceId = e2eStore.idempotencyKeys[demoIdempotencyKey];
        console.log('[admin-courses][demo] idempotency lookup', { demoIdempotencyKey, existingResourceId });
        if (existingResourceId !== undefined) {
          if (existingResourceId) {
            const existingCourse = e2eStore.courses.get(existingResourceId);
            console.log('[admin-courses][demo] idempotency matched', { demoIdempotencyKey, existingResourceId, existingCourseId: existingCourse?.id ?? null });
            if (existingCourse) {
              return res.status(200).json({ data: existingCourse, idempotent: true });
            }
          }
          logAdminCourseUpdateEvent('conflict_detected', {
            ...baseLogMeta,
            orgId: resolveCurrentOrgForLog(),
            slug: resolveCurrentSlugForLog(),
            reason: existingResourceId === null ? 'demo_idempotency_in_flight' : 'demo_idempotency_missing_target',
          });
          respondAdminCourseConflict(res, {
            reason: 'demo_idempotency_processing',
            message: 'Duplicate idempotency key (processing)',
            requestId: req.requestId ?? null,
          });
          return;
        }
      }

      const derivedSlug = await ensureUniqueCourseSlug(normalizedSlug, {
        excludeCourseId: courseLocal.id ?? null,
        baseSlug: normalizedSlug,
      });
      console.log('[admin-courses][demo] slug_conflict_check', {
        normalizedSlug,
        derivedSlug,
        e2eStoreSize: e2eStore.courses.size,
      });
      if (derivedSlug !== normalizedSlug) {
        await respondWithCourseSlugConflict({
          req,
          res,
          courseId: courseLocal.id ?? null,
          organizationId,
          attemptedSlug: normalizedSlug,
          suggestion: derivedSlug,
          idempotencyKey: demoIdempotencyKey,
        });
        return;
      }

      courseLocal.slug = derivedSlug;
      if (demoIdempotencyKey) {
        console.log('[admin-courses][demo] reserving idempotency key', { demoIdempotencyKey });
        e2eStore.idempotencyKeys[demoIdempotencyKey] = null;
      }

      // Idempotent upsert by id or external_id (stored in meta_json)
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
      normalizeModuleLessonIdentifiers(modulesArr);
      for (const [moduleIndex, module] of modulesArr.entries()) {
        const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}`;
        const moduleObj = {
          id: moduleId,
          course_id: id,
          title: module.title,
          description: module.description ?? null,
          order_index: module.order_index ?? moduleIndex,
          client_temp_id: module.client_temp_id ?? null,
          lessons: [],
        };
        const lessons = module.lessons || [];
        for (const [lessonIndex, lesson] of lessons.entries()) {
          const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}`;
          const completionRule = extractCompletionRule(lesson);
          const lessonObj = {
            id: lessonId,
            module_id: moduleId,
            title: lesson.title,
            description: lesson.description ?? null,
            type: lesson.type,
            order_index: lesson.order_index ?? lessonIndex,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? lesson.content ?? {},
            client_temp_id: lesson.client_temp_id ?? null,
          };
          prepareLessonContentWithCompletionRule(lessonObj, completionRule);
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
  baseLogMeta.courseId = course?.id ?? courseIdFromParams ?? baseLogMeta.courseId ?? null;
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
  // ...existing code...
  console.log('[admin-courses] handleAdminCourseUpsert start', { userId: context.userId, isPlatformAdmin: context.isPlatformAdmin });
  let organizationId;
  try {
    organizationId = await resolveOrgIdForCourseRequest(req, context, orgCandidates);
  } catch (orgErr) {
    if (orgErr instanceof InvalidOrgIdentifierError) {
      respondInvalidOrg(res, orgErr.identifier);
      return;
    }
    if (orgErr instanceof ExplicitOrgSelectionRequiredError) {
      sendApiError(res, orgErr.status || 400, orgErr.code, orgErr.message, {
        meta: { requestId: req.requestId ?? null },
      });
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
  logCourseRequestEvent('admin.courses.upsert.start', {
    ...baseLogMeta,
    orgId: organizationId ?? null,
    courseId: course?.id ?? courseIdFromParams ?? null,
    status: null,
  });
  res.once('finish', () => {
    logCourseRequestEvent('admin.courses.upsert.finish', {
      ...baseLogMeta,
      orgId: organizationId ?? null,
      status: res.statusCode ?? null,
      errorCode: res.locals?.errorCode ?? null,
    });
  });
  // Lightweight request tracing to aid debugging in CI/local runs
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log(
        `[srv] Upsert course request: requestId=${req.requestId} idempotency=${req.body?.idempotency_key ?? req.body?.client_event_id ?? null} hasSupabase=${Boolean(supabase)} isTestMode=${isTestMode}`
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
  normalizeModuleLessonIdentifiers(modules);
  const identifierIssues = collectInvalidIdentifierIssues(modules);
  if (identifierIssues.length > 0) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'invalid_identifier';
    logCourseRequestEvent('admin.courses.upsert.invalid_ids', {
      ...baseLogMeta,
      orgId: organizationId ?? null,
      status: 200,
      errorCode: 'invalid_identifier',
      message: 'Module or lesson identifiers were normalized from non-UUID values.',
    });
    console.warn('[admin.courses] normalizing non-UUID module/lesson IDs', {
      requestId: req.requestId ?? null,
      issues: identifierIssues,
      isDemoMode,
    });
    // Continue to persist with normalized UUID identifiers.
  }

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
  if (desiredStatus === 'published' && !(isDemoMode || isTestMode)) {
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

    if (course.id) {
      const existing = await supabase.from('courses').select('id, version, organization_id').eq('id', course.id).maybeSingle();
      if (existing.error) throw existing.error;
      const currVersion = existing.data?.version ?? null;
      if (currVersion !== null && typeof course.version === 'number' && course.version < currVersion) {
        logAdminCourseUpdateEvent('conflict_detected', {
          ...baseLogMeta,
          orgId: organizationId ?? resolveCurrentOrgForLog(),
          slug: course?.slug ?? resolveCurrentSlugForLog(),
          reason: 'version_conflict',
          currentVersion: currVersion,
          incomingVersion: course.version,
        });
        respondAdminCourseConflict(res, {
          reason: 'stale_version',
          message: `Course has newer version ${currVersion}`,
          requestId: req.requestId ?? null,
          details: { currentVersion: currVersion, incomingVersion: course.version ?? null },
        });
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

    const idempotencyKey = writeMeta.idempotencyKey ?? writeMeta.clientEventId ?? null;
    let idempotencyTableMissing = false;

    if (idempotencyKey) {
      const existingFallback = getInMemoryIdempotencyKey(idempotencyKey);
      if (existingFallback) {
        if (existingFallback.status === 'done' && existingFallback.data) {
          console.info('[idempotency] returning cached in-memory response for completed idempotency', { idempotencyKey });
          return res.status(200).json({ data: existingFallback.data, idempotent: true });
        }
        if (existingFallback.status === 'in_flight') {
          console.info('[idempotency] detected in-flight in-memory idempotency request', { idempotencyKey });
          return respondAdminCourseConflict(res, {
            reason: 'idempotency_in_flight',
            message: 'Another save request is already in flight.',
            requestId: req.requestId ?? null,
          });
        }
      }

      const { data: insertData, error: insertError } = await supabase
        .from('idempotency_keys')
        .insert({
          id: idempotencyKey,
          key_type: 'course_upsert',
          resource_id: null,
          payload: { course, modules },
        });
      console.log('[admin-courses] idempotency insert attempted', { idempotencyKey, insertData, insertError });

      if (insertError) {
        if (isIdempotencyTableMissingError(insertError)) {
          idempotencyTableMissing = true;
          console.info('[idempotency] idempotency_keys table missing, using in-memory fallback for upsert', { error: insertError, idempotencyKey });
          setInMemoryIdempotencyKey(idempotencyKey, {
            status: 'in_flight',
            createdAt: new Date().toISOString(),
            payload: { course, modules },
          });
        } else {
          const isDuplicate = insertError?.code === '23505' || String(insertError?.message || '').toLowerCase().includes('duplicate');
          if (!isDuplicate) {
            res.status(500).json({ error: 'idempotency_insert_failed' });
            return;
          }

          const { data: existingKey, error: existingKeyError } = await supabase
            .from('idempotency_keys')
            .select('*')
            .eq('id', idempotencyKey)
            .maybeSingle();

          if (existingKeyError || !existingKey) {
            respondAdminCourseConflict(res, {
              reason: 'idempotency_in_flight',
              message: 'Another save request is already in flight.',
              requestId: req.requestId ?? null,
            });
            return;
          }

          if (existingKey.resource_id) {
            const { data: existingCourse, error: existingCourseError } = await supabase
              .from('courses')
              .select(COURSE_WITH_MODULES_LESSONS_SELECT)
              .eq('id', existingKey.resource_id)
              .maybeSingle();
            if (!existingCourseError && existingCourse) {
              return res.status(200).json({ data: existingCourse, idempotent: true });
            }
          }

          return respondAdminCourseConflict(res, {
            reason: 'idempotency_in_flight',
            message: 'Another save request is already in flight.',
            requestId: req.requestId ?? null,
          });
        }
      }
    }
    const persistenceNormalization = normalizeModuleLessonPayloads(modules, {
      courseId: course?.id ?? courseIdFromParams ?? null,
      organizationId,
      pickOrgId,
    });
    logModuleNormalizationDiagnostics(persistenceNormalization.diagnostics, {
      requestId: req.requestId,
      source: 'course_upsert.persist',
      courseId: course?.id ?? courseIdFromParams ?? null,
    });
    const modulesForPersistence = persistenceNormalization.modules;
    const idNormalization = normalizeModuleLessonIdentifiers(modulesForPersistence);
    if (idNormalization.modulesNormalized > 0 || idNormalization.lessonsNormalized > 0) {
      console.info('[admin-courses] normalized_temp_ids', {
        requestId: req?.requestId ?? null,
        courseId: course?.id ?? courseIdFromParams ?? null,
        modulesNormalized: idNormalization.modulesNormalized,
        lessonsNormalized: idNormalization.lessonsNormalized,
      });
    }
    const moduleCount = modulesForPersistence.length;
    const lessonCount = modulesForPersistence.reduce((sum, mod) => sum + ((mod.lessons && mod.lessons.length) || 0), 0);

    const normalizedPayloadKeyTakeaways = Array.isArray(course?.key_takeaways)
      ? course.key_takeaways
      : Array.isArray(course?.keyTakeaways)
      ? course.keyTakeaways
      : [];
    const buildCourseGraphPayload = () => {
      const payload = {
        id: course.id ?? undefined,
        slug: course.slug ?? undefined,
        title: course.title || course.name,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        meta_json: meta,
        key_takeaways: normalizedPayloadKeyTakeaways,
        modules: modulesForPersistence.map((module, moduleIndex) => ({
          id: module.id ?? undefined,
          title: module.title,
          description: module.description ?? null,
          order_index: module.order_index ?? moduleIndex,
          course_id: module.course_id ?? course.id ?? undefined,
          organization_id: module.organization_id ?? organizationId ?? undefined,
          lessons: (module.lessons || []).map((lesson, lessonIndex) =>
            prepareLessonPersistencePayload({
              id: lesson.id ?? undefined,
              type: lesson.type,
              title: lesson.title,
              description: lesson.description ?? null,
              order_index: lesson.order_index ?? lessonIndex,
              duration_s: lesson.duration_s ?? null,
              content_json: lesson.content_json ?? lesson.content ?? {},
              completionRule: extractCompletionRule(lesson),
              module_id: lesson.module_id ?? module.id ?? undefined,
              course_id: lesson.course_id ?? course.id ?? undefined,
              organization_id: lesson.organization_id ?? organizationId ?? undefined,
            }),
          ),
        })),
      };
      if (includeCourseVersionField) {
        payload.version = resolvedCourseVersion;
      }
      return payload;
    };

    const rpcBaseInput = {
      p_actor: isUuid(String(context.userId || "").trim()) ? context.userId : null,
      p_org: organizationId,
    };
    const executeRpcUpsert = async () => {
      const rpcPayload = buildCourseGraphPayload();
      const startedAt = Date.now();
      logCourseRequestEvent('admin.courses.upsert.rpc_attempt', {
        ...baseLogMeta,
        orgId: organizationId,
        moduleCount,
        lessonCount,
      });
      if (process.env.NODE_ENV !== 'production') {
        console.info('[course.save_attempt]', {
          requestId: req.requestId ?? null,
          userId: context.userId ?? null,
          orgId: organizationId,
          courseId: course?.id ?? null,
          moduleCount,
          lessonCount,
          rpcBaseInput,
        });
      }
      if (process.env.NODE_ENV !== 'production') {
        console.info('[course.save_attempt]', {
          requestId: req.requestId ?? null,
          userId: context.userId ?? null,
          orgId: organizationId,
          courseId: course?.id ?? null,
          moduleCount,
          lessonCount,
        });
      }
      const rpcRes = await supabase.rpc('upsert_course_graph', { ...rpcBaseInput, p_course: rpcPayload });
      if (rpcRes.error) {
        const durationMs = Date.now() - startedAt;
        console.error('[course.save_error]', {
          requestId: req.requestId ?? null,
          userId: context.userId ?? null,
          orgId: organizationId,
          courseId: course?.id ?? null,
          moduleCount,
          lessonCount,
          durationMs,
          error: rpcRes.error,
        });
        res.locals = res.locals || {};
        res.locals.errorCode = rpcRes.error?.code ?? 'upsert_failed';
        throw rpcRes.error;
      }
      const durationMs = Date.now() - startedAt;
      const savedCourse = rpcRes.data;
      if (process.env.NODE_ENV !== 'production') {
        console.info('[course.save_success]', {
          requestId: req.requestId ?? null,
          userId: context.userId ?? null,
          orgId: organizationId,
          courseId: savedCourse?.id ?? null,
          moduleCount,
          lessonCount,
          durationMs,
        });
      }
      logCourseRequestEvent('admin.courses.upsert.rpc_success', {
        ...baseLogMeta,
        orgId: organizationId,
        courseId: savedCourse?.id ?? null,
        durationMs,
      });
      if (idempotencyKey && savedCourse?.id) {
        try {
          await supabase.from('idempotency_keys').update({ resource_id: savedCourse.id }).eq('id', idempotencyKey);
        } catch (updErr) {
          console.warn('Failed to update idempotency_keys with resource id', updErr);
        }

        const existingFallback = getInMemoryIdempotencyKey(idempotencyKey);
        if (existingFallback && existingFallback.status === 'in_flight') {
          setInMemoryIdempotencyKey(idempotencyKey, {
            ...existingFallback,
            status: 'done',
            resourceId: savedCourse.id,
            data: savedCourse,
          });
        }
      }
      sendApiResponse(res, savedCourse, {
        statusCode: course?.id ? 200 : 201,
        code: course?.id ? 'course_saved' : 'course_created',
        message: course?.id ? 'Course saved.' : 'Course created.',
        meta: {
          requestId: req.requestId ?? null,
          courseId: savedCourse?.id ?? null,
          orgId: organizationId ?? null,
        },
      });
      return true;
    };

    while (true) {
      try {
        const succeeded = await executeRpcUpsert();
        if (succeeded) {
          return;
        }
      } catch (error) {
        const handledVersion = includeCourseVersionField && maybeHandleMissingCourseVersion(error);
        if (handledVersion) {
          continue;
        }
        if (isCourseSlugConstraintError(error)) {
          const incremented = await applyNextSlugAfterConflict();
          if (incremented) {
            continue;
          }
        }
        throw error;
      }
    }
  } catch (error) {

    res.locals = res.locals || {};
    res.locals.errorCode = error?.code ?? 'upsert_failed';
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
    sendApiError(res, 500, error?.code ?? 'upsert_failed', errorMessage, {
      details: errorDetails,
      hint: error?.hint ?? null,
      meta: {
        requestId: req.requestId ?? null,
        timestamp: new Date().toISOString(),
        orgId: organizationId ?? null,
      },
    });
  }
}

app.post('/api/admin/courses', authenticate, requireOrgAdmin, asyncHandler(async (req, res) => {
  await handleAdminCourseUpsert(req, res);
}));

app.put('/api/admin/courses/:id', authenticate, requireOrgAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    sendApiError(res, 404, 'course_not_found', `Course not found for identifier ${id}`, {
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }
  const courseId = resolvedCourseId;
  if (!isUuid(id) && !isFallbackMode) {
    sendApiError(res, 400, 'invalid_course_id', 'Course ID must be a UUID.', {
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }
  await handleAdminCourseUpsert(req, res, { courseIdFromParams: id });
}));

// Batch import endpoint (best-effort transactional behavior in E2E/DEV fallback)
const COURSE_IMPORT_TABLES = [
  { table: 'courses', columns: ['id', 'slug', 'organization_id'] },
  { table: 'modules', columns: ['id', 'course_id'] },
  { table: 'lessons', columns: ['id', 'module_id'] },
];

const logCourseImportEvent = (event, meta = {}) => {
  console.info('[admin.courses.import]', { event, ...meta });
};

const respondImportError = ({
  res,
  status = 500,
  code = 'import_failed',
  message = 'Import failed',
  hint = null,
  requestId = null,
  details = null,
  queryName = 'admin_courses_import',
}) => {
  sendApiError(res, status, code, message, {
    hint,
    details,
    meta: {
      requestId,
      queryName,
    },
  });
};

app.post('/api/admin/courses/import', authenticate, requireOrgAdmin, asyncHandler(async (req, res) => {
  normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.import', requestId: req.requestId });
  const parseBooleanFlag = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
    }
    return false;
  };
  const { entries: rawItems, sourceLabel } = normalizeImportEntries(req.body);
  if (rawItems.length === 0) {
    respondImportError({
      res,
      status: 400,
      code: 'items_required',
      message: 'Provide an "items" or "courses" array with course data.',
      requestId: req.requestId ?? null,
    });
    return;
  }
  const context = requireUserContext(req, res);
  if (!context) return;
  const normalizedRequestOrgId = normalizeOrgIdValue(req.organizationId ?? null);
  const contextActiveOrgId = normalizeOrgIdValue(context.activeOrganizationId ?? context.requestedOrgId ?? null);
  const membershipOrgIds = Array.isArray(context.memberships)
    ? context.memberships
        .map((membership) =>
          normalizeOrgIdValue(
            pickOrgId(
              membership.organization_id,
              membership.organizationId,
              membership.org_id,
              membership.orgId,
            ),
          ),
        )
        .filter(Boolean)
    : [];
  const userScopedOrgIds = Array.isArray(context.organizationIds)
    ? context.organizationIds.map((orgId) => normalizeOrgIdValue(orgId)).filter(Boolean)
    : [];
  const availableOrgIds = Array.from(new Set([
    normalizedRequestOrgId,
    contextActiveOrgId,
    ...membershipOrgIds,
    ...userScopedOrgIds,
  ].filter(Boolean)));
  let resolvedOrganizationId =
    normalizedRequestOrgId ||
    contextActiveOrgId ||
    (availableOrgIds.length === 1 ? availableOrgIds[0] : null);
  if (!resolvedOrganizationId && availableOrgIds.length > 1) {
    respondImportError({
      res,
      status: 400,
      code: 'explicit_org_selection_required',
      message: 'This import is ambiguous across multiple organizations. Pass an organizationId explicitly.',
      requestId: req.requestId ?? null,
      details: { availableOrgIds },
    });
    return;
  }
  if (!resolvedOrganizationId) {
    respondImportError({
      res,
      status: 400,
      code: 'org_required',
      message: 'Active organization required for import.',
      requestId: req.requestId ?? null,
    });
    return;
  }
  logCourseImportEvent('import_received', {
    requestId: req.requestId ?? null,
    userId: context.userId ?? null,
    orgId: resolvedOrganizationId,
    entryCount: rawItems.length,
  });
  const access = await requireOrgAccess(req, res, resolvedOrganizationId, { write: true, requireOrgAdmin: true });
  if (!access) return;
  logCourseImportEvent('import_org_resolved', {
    requestId: req.requestId ?? null,
    userId: context.userId ?? null,
    orgId: resolvedOrganizationId,
  });

  const globalOverwriteFlag = parseBooleanFlag(req.body?.overwrite);
  const publishModeInput =
    typeof req.body?.publishMode === 'string'
      ? req.body.publishMode.trim().toLowerCase()
      : null;
  const publishFlag = parseBooleanFlag(req.body?.publish ?? req.body?.publishCourses);
  const publishRequested = publishFlag || publishModeInput === 'published';
  const canonicalizeStatus = (value, fallback = 'draft') => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'published' || normalized === 'draft' || normalized === 'archived') {
      return normalized;
    }
    return fallback;
  };
  const validationIssues = [];
  const normalizedItems = rawItems.map((rawEntry) => {
    const normalizedModules = Array.isArray(rawEntry?.modules)
      ? rawEntry.modules.map((m, moduleIndex) => {
          const normalizedModule = normalizeModuleForImport(m, { moduleIndex });
          (normalizedModule.lessons || []).forEach((lesson, lessonIndex) => {
            const derivedQuestionsCount = Array.isArray(lesson.content?.questions)
              ? lesson.content.questions.length
              : 0;
            const derivedBranchCount = Array.isArray(lesson.content?.branchingElements)
              ? lesson.content.branchingElements.length
              : 0;
            logCourseImportEvent('lesson_normalization', {
              requestId: req.requestId ?? null,
              moduleIndex,
              lessonIndex,
              lessonType: lesson.type ?? null,
              derivedQuestionsCount,
              derivedBranchCount,
            });
          });
          return normalizedModule;
        })
      : [];
    const payload = {
      course: rawEntry?.course ?? rawEntry ?? {},
      modules: normalizedModules,
    };
    const validation = validateCoursePayload(payload, {
      enforceLessonContent: publishRequested,
    });
    if (!validation.ok) {
      const issues = validation.issues.map((issue) => ({
        courseIndex: rawEntry.index,
        field: `${sourceLabel}[${rawEntry.index}].${issue.path || ''}`.replace(/\.$/, ''),
        message: issue.message,
        code: issue.code || 'invalid',
        receivedValueType: issue?.receivedValueType ?? typeof issue?.receivedValue ?? undefined,
      }));
      validationIssues.push({ index: rawEntry.index, issues });
      return null;
    }
    return {
      index: rawEntry.index,
      course: validation.data.course,
      modules: validation.data.modules,
      overwrite: parseBooleanFlag(rawEntry?.overwrite) || globalOverwriteFlag,
    };
  });
  logCourseImportEvent('import_normalized', {
    requestId: req.requestId ?? null,
    orgId: resolvedOrganizationId,
    entryCount: rawItems.length,
    normalizedCount: normalizedItems.length,
    invalidCount: validationIssues.length,
  });
  if (validationIssues.length > 0) {
    const details = validationIssues.flatMap((issueGroup) => issueGroup.issues);
    logCourseImportEvent('import_validation_failed', {
      requestId: req.requestId ?? null,
      orgId: resolvedOrganizationId,
      entryCount: rawItems.length,
      details,
    });
    respondImportError({
      res,
      status: 422,
      code: 'validation_failed',
      message: 'One or more courses failed validation.',
      requestId: req.requestId ?? null,
      details,
    });
    return;
  }
  const preparedEntries = normalizedItems.filter(Boolean);
  const batchSlugCounts = new Map();
  for (const entry of preparedEntries) {
    const slugSource =
      entry?.course?.slug ||
      entry?.course?.title ||
      entry?.course?.id ||
      `course-${entry?.index ?? 'import'}`;
    const normalizedSlug = slugify(slugSource);
    if (!normalizedSlug) continue;
    batchSlugCounts.set(normalizedSlug, (batchSlugCounts.get(normalizedSlug) || 0) + 1);
  }
  const duplicateBatchSlug = Array.from(batchSlugCounts.entries()).find(([, count]) => count > 1)?.[0] ?? null;
  if (duplicateBatchSlug) {
    respondImportError({
      res,
      status: 409,
      code: 'slug_conflict',
      message: 'Import batch contains duplicate course slugs. Each imported course must have a unique slug.',
      requestId: req.requestId ?? null,
      details: { slug: duplicateBatchSlug },
    });
    return;
  }
  logCourseImportEvent('import_validated', {
    requestId: req.requestId ?? null,
    orgId: resolvedOrganizationId,
    entryCount: preparedEntries.length,
  });

  // In demo/E2E, snapshot and rollback on failure
  if (isDemoOrTestMode) {
    const snapshot = new Map(e2eStore.courses);
    const results = [];
    try {
      for (const payload of preparedEntries) {
        const { course, modules = [], index: courseIndex } = payload || {};
        if (!course?.title) throw new Error('Course title is required');

        const resolvedOrgId = resolvedOrganizationId;
        if (String(course.status || '').toLowerCase() === 'published') {
          const shaped = shapeCourseForValidation({ ...course, modules });
          const validation = validatePublishableCourse(shaped, { intent: 'publish' });
          if (!validation.isValid) {
            const publishDetails = validation.issues.map((issue) => ({
              courseIndex,
              field: issue.path || issue.field || null,
              message: issue.message,
              code: issue.code || 'invalid',
              receivedValueType: issue.receivedValueType ?? null,
            }));
            respondImportError({
              res,
              status: 422,
              code: 'validation_failed',
              message: 'Publish validation failed.',
              requestId: req.requestId ?? null,
              details: publishDetails,
            });
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
        if (existingId && !payload?.overwrite) {
          const error = new Error(
            'A course with this slug already exists in the selected organization. Choose a different slug or set "overwrite": true to replace it.',
          );
          error.code = 'slug_conflict';
          error.status = 409;
          throw error;
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
          modules: [],
        };
        const modulesArr = modules || [];
        for (const [moduleIndex, module] of modulesArr.entries()) {
          const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}-${Math.floor(Math.random()*1000)}`;
          const moduleObj = {
            id: moduleId,
            course_id: id,
            organization_id: resolvedOrgId,
            title: module.title,
            description: module.description ?? null,
            order_index: module.order_index ?? moduleIndex,
            lessons: [],
          };
          const lessons = module.lessons || [];
          for (const [lessonIndex, lesson] of lessons.entries()) {
            const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}-${Math.floor(Math.random()*1000)}`;
            const completionRule = extractCompletionRule(lesson);
            const lessonObj = {
              id: lessonId,
              module_id: moduleId,
              title: lesson.title,
              description: lesson.description ?? null,
              type: lesson.type,
              order_index: lesson.order_index ?? lesson.order ?? lessonIndex,
              duration_s: lesson.duration_s ?? null,
              content_json: lesson.content_json ?? lesson.content ?? {},
            };
            prepareLessonContentWithCompletionRule(lessonObj, completionRule);
            moduleObj.lessons.push(lessonObj);
          }
          courseObj.modules.push(moduleObj);
        }
        e2eStore.courses.set(id, courseObj);
        results.push({ id, slug: courseObj.slug, title: courseObj.title });
      }
      persistE2EStore();
      sendApiResponse(res, results, {
        statusCode: 201,
        code: 'courses_imported',
        message: 'Courses imported successfully.',
        meta: { requestId: req.requestId ?? null, mode: 'demo' },
      });
    } catch (err) {
      // Rollback
      e2eStore.courses = snapshot;
      persistE2EStore();
      logAdminCoursesError(req, err, 'E2E import failed', {
        userId: context?.userId ?? null,
      });
      respondImportError({
        res,
        status: Number.isInteger(err?.status) ? err.status : 400,
        code: err?.code ?? 'import_failed',
        message: err?.message ?? 'Import failed',
        requestId: req.requestId ?? null,
        details: String(err?.message || err),
      });
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
    const results = await sql.begin(async (tx) => {
      const persistedResults = [];
      for (const entry of preparedEntries) {
        const { course, modules, index: courseIndex } = entry;
        const resolvedOrgId = resolvedOrganizationId;
        const userProvidedStatus = typeof course.status === 'string' && course.status.trim().length > 0;
        let normalizedStatus = canonicalizeStatus(course.status, publishRequested ? 'published' : 'draft');
        if (!userProvidedStatus && publishRequested) {
          normalizedStatus = 'published';
        }
        course.status = normalizedStatus;

        if (course.status === 'published') {
          const shaped = shapeCourseForValidation({ ...course, modules });
          const validation = validatePublishableCourse(shaped, { intent: 'publish' });
          if (!validation.isValid) {
            const publishDetails = validation.issues.map((issue) => ({
              courseIndex,
              field: issue.path || issue.field || null,
              message: issue.message,
              code: issue.code || 'invalid',
              receivedValueType: issue.receivedValueType ?? null,
            }));
            const error = new Error('Publish validation failed.');
            error.code = 'validation_failed';
            error.status = 422;
            error.details = publishDetails;
            throw error;
          }
        }

        course.organization_id = resolvedOrgId;
        const slugSource = course.slug || course.title || course.id || `course-${randomUUID().slice(0, 8)}`;
        course.slug = slugify(slugSource);
        const existingCourseRows = await tx`
          select id, slug
          from public.courses
          where organization_id = ${resolvedOrgId}::uuid
            and slug = ${course.slug}
          limit 1
        `;
        const existingCourse = firstRow(existingCourseRows);
        if (existingCourse && !entry.overwrite) {
          const error = new Error(
            'A course with this slug already exists in the selected organization. Choose a different slug or set "overwrite": true to replace it.',
          );
          error.code = 'slug_conflict';
          error.status = 409;
          error.details = { slug: course.slug, courseIndex: entry.index };
          throw error;
        }
        if (existingCourse && entry.overwrite) {
          course.id = course.id ?? existingCourse.id;
        }
        logCourseImportEvent('import_slug_checked', {
          requestId: req.requestId ?? null,
          orgId: resolvedOrgId,
          slug: course.slug,
          courseIndex: entry.index,
          overwrite: entry.overwrite,
        });
        const modulesForRpc = modules.map((module, moduleIndex) => ({
          id: module.id ?? undefined,
          organization_id: resolvedOrgId,
          title: module.title,
          description: module.description ?? null,
          order_index: module.order_index ?? moduleIndex + 1,
          lessons: (module.lessons || []).map((lesson, lessonIndex) =>
            prepareLessonPersistencePayload({
              id: lesson.id ?? undefined,
              organization_id: resolvedOrgId,
              type: lesson.type,
              title: lesson.title,
              description: lesson.description ?? null,
              order_index: lesson.order_index ?? lessonIndex + 1,
              duration_s: lesson.duration_s ?? null,
              content_json: lesson.content_json ?? lesson.content ?? {},
              completionRule: extractCompletionRule(lesson),
            }),
          ),
        }));
        const rpcPayload = {
          id: course.id ?? undefined,
          slug: course.slug,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          meta_json: course.meta ?? {},
          modules: modulesForRpc,
        };
        logCourseImportEvent('import_persist_start', {
          requestId: req.requestId ?? null,
          orgId: resolvedOrgId,
          slug: course.slug,
          courseId: course.id ?? null,
          moduleCount: modulesForRpc.length,
          courseIndex: entry.index,
        });
        const savedCourse = await upsertCourseGraphWithTx(tx, {
          actorUserId: isUuid(String(context.userId || '').trim()) ? context.userId : null,
          organizationId: resolvedOrgId,
          coursePayload: rpcPayload,
        });
        if (!savedCourse) {
          const error = new Error('Course import persistence returned no record.');
          error.code = 'import_persist_failed';
          error.status = 500;
          throw error;
        }
        persistedResults.push({
          id: savedCourse?.id ?? course.id ?? null,
          slug: savedCourse?.slug ?? course.slug,
          title: savedCourse?.title ?? course.title,
          status: savedCourse?.status ?? course.status ?? 'draft',
          organization_id: savedCourse?.organization_id ?? resolvedOrgId,
          published_at: savedCourse?.published_at ?? null,
        });
        logCourseImportEvent('import_persist_success', {
          requestId: req.requestId ?? null,
          orgId: resolvedOrgId,
          slug: course.slug,
          courseId: savedCourse?.id ?? course.id ?? null,
          status: savedCourse?.status ?? course.status ?? null,
          organizationId: savedCourse?.organization_id ?? resolvedOrgId,
          courseIndex: entry.index,
        });
      }
      return persistedResults;
    });
    const hasPublishedImports = results.some((row) => String(row?.status || '').toLowerCase() === 'published');
    if (hasPublishedImports) {
      await assignPublishedOrganizationCoursesToActiveMembers({
        orgId: resolvedOrganizationId,
        actorUserId: context.userId ?? null,
      });
      logCourseImportEvent('import_assignment_backfill_complete', {
        requestId: req.requestId ?? null,
        orgId: resolvedOrganizationId,
      });
    }
    logCourseImportEvent('import_complete', {
      requestId: req.requestId ?? null,
      orgId: resolvedOrganizationId,
      imported: results.length,
    });
    sendApiResponse(res, results, {
      statusCode: 201,
      code: 'courses_imported',
      message: 'Courses imported successfully.',
      meta: {
        publishMode: publishRequested ? 'published' : 'draft',
        imported: results.length,
        requestId: req.requestId ?? null,
      },
    });
  } catch (error) {
    logCourseImportEvent('import_failed', {
      requestId: req.requestId ?? null,
      userId: context?.userId ?? null,
      orgId: resolvedOrganizationId,
      code: error?.code ?? null,
      message: error?.message ?? null,
      hint: error?.hint ?? null,
    });
    respondImportError({
      res,
      status: Number.isInteger(error?.status) ? error.status : 500,
      code: error?.code ?? 'import_failed',
      message: error?.status === 409 || error?.status === 422 ? (error?.message ?? 'Import failed') : 'Import failed',
      hint: error?.hint ?? null,
      requestId: req.requestId ?? null,
      details: error?.details ?? error?.message ?? null,
    });
  }
}));

// Assignments listing for client: return active assignments for a user
app.get('/api/client/me', authenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const sessionUser = req.user || {};
  const memberships = Array.isArray(sessionUser.memberships) ? sessionUser.memberships : [];
  const organizations = memberships.map((membership) => ({
    orgId: membership?.orgId || membership?.org_id || null,
    role: membership?.role ?? null,
    status: membership?.status ?? null,
  }));
  const email = sessionUser.email || sessionUser.user?.email || null;
  const displayName =
    sessionUser.displayName ||
    sessionUser.fullName ||
    sessionUser.user_metadata?.full_name ||
    sessionUser.user?.user_metadata?.full_name ||
    null;
  const normalizedRoles = Array.isArray(sessionUser.roles)
    ? sessionUser.roles.map((role) => String(role || '').toLowerCase())
    : [];
  const portalAccess = {
    admin: Boolean(sessionUser.isPlatformAdmin || normalizedRoles.includes('admin')),
    learner: true,
    client: true,
  };
  const orgIdCandidate =
    context.requestedOrgId ||
    sessionUser.activeOrgId ||
    sessionUser.organizationId ||
    (organizations.find((org) => Boolean(org.orgId))?.orgId ?? null);
  res.json({
    data: {
      userId: context.userId,
      email,
      displayName,
      role: context.userRole ?? sessionUser.role ?? null,
      orgId: orgIdCandidate ?? null,
      organizations,
      portalAccess,
    },
  });
});

const deriveAssignmentProgressValue = (row) => {
  if (typeof row?.progress === 'number' && Number.isFinite(row.progress)) {
    return Math.max(0, Math.min(100, Number(row.progress)));
  }
  const metadataProgress = row?.metadata && typeof row.metadata === 'object' ? row.metadata.progress : undefined;
  if (typeof metadataProgress === 'number' && Number.isFinite(metadataProgress)) {
    return Math.max(0, Math.min(100, Number(metadataProgress)));
  }
  const status = String(row?.status || '').toLowerCase();
  if (status === 'completed') return 100;
  if (status === 'in-progress' || status === 'in_progress') return 50;
  return 0;
};

const normalizeAssignmentRow = (row) => {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const normalized = { ...row };
  normalized.organization_id = row.organization_id ?? row.org_id ?? row.organizationId ?? null;
  normalized.course_id = row.course_id ?? row.courseId ?? null;
  normalized.user_id = row.user_id ?? row.user_id_uuid ?? row.userId ?? null;
  normalized.survey_id = row.survey_id ?? row.surveyId ?? null;
  normalized.assignment_type = row.assignment_type ?? row.assignmentType ?? null;
  normalized.progress = deriveAssignmentProgressValue(row);
  return normalized;
};

// Assignments listing for client: return active assignments for a user
app.get('/api/client/assignments', authenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const requestId = req.requestId;
  const normalizedUserId = String(context.userId || '').trim().toLowerCase();

  if (!normalizedUserId) {
    res.status(401).json({ data: [], count: 0, orgId: null, error: 'not_authenticated' });
    return;
  }

  let queryUserId = normalizedUserId;
  if (!isUuid(queryUserId) && !isDemoMode) {
    try {
      const resolvedUserId = await resolveUserIdentifierToUuid(req, queryUserId);
      if (resolvedUserId && isUuid(resolvedUserId)) {
        queryUserId = resolvedUserId;
      }
    } catch (err) {
      console.warn('[client/assignments] user identifier resolution failed', { requestId, userId: queryUserId, error: err?.message || String(err) });
    }
  }

  if (!isUuid(queryUserId) && !isDemoMode) {
    console.warn('[client/assignments] non_uuid_user_id', { requestId, userId: queryUserId });
    // Legacy ID path: continue and return any matching assignments.
  }

  const parseBoolean = (value, defaultValue = true) => {
    if (value === undefined || value === null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  };

  const includeCompletedAssignments = parseBoolean(
    req.query.include_completed ?? req.query.includeCompleted ?? undefined,
    true,
  );

  const requestedOrgId = pickOrgId(
    req.query.organization_id,
    req.query.organizationId,
    req.query.org_id,
    req.query.orgId,
  );

  const resolvedOrgId =
    normalizeOrgIdValue(requestedOrgId) || context.requestedOrgId || normalizeOrgIdValue(req.activeOrgId) || null;

  const respond = (status, rows, extra = {}) =>
    res.status(status).json({
      data: rows,
      count: Array.isArray(rows) ? rows.length : 0,
      orgId: Array.isArray(rows) && rows.length > 0 ? resolvedOrgId : null,
      ...extra,
    });

  try {
    if (isDemoOrTestMode) {
      const allowedOrgIds = new Set(
        [
          resolvedOrgId,
          ...(Array.isArray(context.organizationIds) ? context.organizationIds : []),
          req.activeOrgId ?? null,
        ]
          .map((value) => normalizeOrgIdValue(value))
          .filter(Boolean),
      );

      console.info('[client.assignments][demo]', {
        requestId,
        userId: queryUserId,
        resolvedOrgId,
        activeOrgId: req.activeOrgId ?? null,
        contextOrgIds: Array.isArray(context.organizationIds) ? context.organizationIds : [],
        allowedOrgIds: Array.from(allowedOrgIds),
        assignmentCount: Array.isArray(e2eStore.assignments) ? e2eStore.assignments.length : 0,
      });

      const directRows = [];
      const orgScopedByCourseId = new Map();
      for (const rawAssignment of e2eStore.assignments || []) {
        const assignment =
          ensureOrgFieldCompatibility(rawAssignment, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || rawAssignment;
        if (!assignment || assignment.active === false) continue;
        const assignmentType = assignment.assignment_type ?? assignment.assignmentType ?? null;
        if (assignmentType && assignmentType !== 'course') continue;

        const assignmentUserId = String(assignment.user_id || '').toLowerCase();
        if (assignmentUserId === normalizedUserId) {
          directRows.push(assignment);
          continue;
        }

        if (assignment.user_id !== null && assignment.user_id !== undefined) continue;

        const assignmentOrgId = normalizeOrgIdValue(
          assignment.organization_id ?? assignment.organizationId ?? assignment.org_id ?? assignment.orgId ?? null,
        );
        if (!assignmentOrgId || !allowedOrgIds.has(assignmentOrgId)) continue;

        const courseId = assignment.course_id ?? assignment.courseId ?? null;
        if (!courseId || orgScopedByCourseId.has(courseId)) continue;

        orgScopedByCourseId.set(courseId, {
          ...assignment,
          user_id: normalizedUserId,
          assignment_type: 'course',
          metadata: {
            ...(assignment.metadata && typeof assignment.metadata === 'object' ? assignment.metadata : {}),
            assigned_via: 'org_rollup',
          },
        });
      }

      const directCourseIds = new Set(
        directRows
          .map((assignment) => assignment?.course_id ?? assignment?.courseId ?? null)
          .filter(Boolean),
      );

      const rows = [
        ...directRows,
        ...Array.from(orgScopedByCourseId.entries())
          .filter(([courseId]) => !directCourseIds.has(courseId))
          .map(([, assignment]) => assignment),
      ];
      respond(200, rows.map((row) => normalizeAssignmentRow(row)).filter(Boolean));
      return;
    }

    if (!supabase) {
      respond(200, []);
      return;
    }

    await ensureCourseAssignmentsForUserFromOrgScope({
      userId: queryUserId,
      orgIds: Array.isArray(context.organizationIds) ? context.organizationIds : [],
    });

    const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
    const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
    const assignmentTables = ['assignments', 'course_assignments'];
    let rows = [];
    let sourceTable = null;

    for (const table of assignmentTables) {
      let query = supabase.from(table).select('*');

      if (table === 'assignments') {
        const isUserIdUuid = isUuid(queryUserId);
        if (assignmentsSupportUserIdUuid && isUserIdUuid) {
          query = query.or(`user_id.eq.${queryUserId},user_id_uuid.eq.${queryUserId}`);
        } else {
          query = query.eq('user_id', queryUserId);
        }
      } else {
        query = query.eq('user_id', queryUserId);
      }

      if (!includeCompletedAssignments) {
        query = query.eq('active', true).in('status', ['assigned', 'in-progress']);
      }

      if (resolvedOrgId) {
        if (table === 'assignments') {
          query = query.eq(assignmentsOrgColumn, resolvedOrgId);
        } else {
          query = query.eq('organization_id', resolvedOrgId);
        }
      }

      query = query.order('updated_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query;
      if (error) {
        const invalidUuidFilter =
          error?.code === '22P02' ||
          (typeof error?.message === 'string' && error.message.includes('invalid input syntax for type uuid'));
        if (invalidUuidFilter) {
          logger.warn('client_assignments_invalid_user_id_filter', {
            table,
            userId: queryUserId,
            message: error?.message ?? null,
            requestId,
          });
          continue;
        }
        const missing = isMissingRelationError(error) || isMissingColumnError(error);
        if (missing) {
          if (resolvedOrgId && table === 'course_assignments') {
            const fallbackQuery = supabase
              .from(table)
              .select('*')
              .eq('user_id', queryUserId)
              .eq('org_id', resolvedOrgId)
              .order('updated_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false, nullsFirst: false });
            const { data: fallbackData, error: fallbackError } = await fallbackQuery;
            if (!fallbackError) {
              rows = fallbackData || [];
              sourceTable = table;
              if (rows.length > 0 || table === assignmentTables[assignmentTables.length - 1]) {
                break;
              }
              continue;
            }
          }
          logger.warn('client_assignments_table_missing', {
            table,
            code: error?.code ?? null,
            message: error?.message ?? null,
            requestId,
          });
          continue;
        }
        throw error;
      }

      rows = data || [];
      sourceTable = table;

      if (rows.length > 0 || table === assignmentTables[assignmentTables.length - 1]) {
        break;
      }
    }

    if (!sourceTable) {
      logger.warn('client_assignments_no_table', { requestId, tablesTried: assignmentTables });
      respond(200, []);
      return;
    }

    const normalizedRows = rows.map((row) => normalizeAssignmentRow(row)).filter(Boolean);
    respond(200, normalizedRows, { table: sourceTable });
  } catch (error) {
    logger.error('client_assignments_fetch_failed', {
      requestId,
      userId: queryUserId,
      code: error?.code,
      message: error?.message,
    });
    respond(500, [], { error: 'fetch_failed' });
  }
});

app.get('/api/client/surveys', authenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
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
  const requestedOrgId = rawOrgQuery.trim() || null;
  const membershipOrgIds = Array.isArray(context.organizationIds)
    ? context.organizationIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const membershipOrgIdSet = new Set(membershipOrgIds);
  const activeOrgId = req.activeOrgId ? String(req.activeOrgId).trim() : null;
  const orgFilter = requestedOrgId || activeOrgId || null;

  if (!context.isPlatformAdmin && membershipOrgIds.length === 0) {
    res.status(403).json({
      error: 'org_membership_required',
      message: 'Organization membership required.',
    });
    return;
  }

  if (requestedOrgId && !context.isPlatformAdmin && !membershipOrgIdSet.has(requestedOrgId)) {
    res.status(403).json({
      error: 'org_forbidden',
      message: 'You do not have access to this organization.',
    });
    return;
  }

  try {
    if (!supabase || isDemoMode) {
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
      } else if (!context.isPlatformAdmin) {
        records = records.filter((survey) => {
          const orgIds =
            survey.assignedTo?.organizationIds ||
            survey.assigned_to?.organizationIds ||
            [];
          if (!Array.isArray(orgIds) || orgIds.length === 0) return false;
          return orgIds.map(String).some((id) => membershipOrgIdSet.has(id));
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
    } else if (!context.isPlatformAdmin) {
      shaped = shaped.filter((survey) => {
        const orgIds = survey.assignedTo?.organizationIds ?? survey.assigned_to?.organizationIds ?? [];
        if (!Array.isArray(orgIds) || orgIds.length === 0) return false;
        return orgIds.map(String).some((id) => membershipOrgIdSet.has(id));
      });
    }

    res.json({ data: shaped });
  } catch (error) {
    console.error('Failed to fetch client surveys:', error);
    res.status(500).json({ error: 'Unable to fetch client surveys' });
  }
});

app.get('/api/client/surveys/assigned', authenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
  if (orgScope.requiresExplicitSelection) {
    res.status(403).json({
      error: 'org_selection_required',
      code: 'org_selection_required',
      message: 'Select an organization before loading assigned surveys.',
    });
    return;
  }

  const parseBoolean = (value, defaultValue = true) => {
    if (value === undefined || value === null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  };

  const includeCompleted = parseBoolean(req.query.include_completed ?? req.query.includeCompleted, true);

  if (!supabase) {
    if (isDemoOrTestMode) {
      const rows = (e2eStore.assignments || []).filter((assignment) => {
        if (assignment.assignment_type !== SURVEY_ASSIGNMENT_TYPE) return false;
        if (assignment.user_id && assignment.user_id !== context.userId) return false;
        if (!includeCompleted && assignment.status === 'completed') return false;
        return true;
      });
      res.json({ data: rows.map((assignment) => ({ assignment, survey: e2eStore.surveys.get(assignment.survey_id) ?? null })) });
      return;
    }
    res.status(503).json({
      error: 'database_unavailable',
      message: 'Assigned surveys are unavailable because the database is not configured.',
    });
    return;
  }

  try {
    await ensureSurveyAssignmentsForUserFromOrgScope({
      userId: context.userId,
      orgIds:
        orgScope.orgId
          ? [orgScope.orgId]
          : Array.isArray(context.organizationIds)
          ? context.organizationIds
          : [],
    });

    let assignmentQuery = supabase
      .from('assignments')
      .select(SURVEY_ASSIGNMENT_SELECT)
      .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
      .eq('user_id', context.userId);

    if (!includeCompleted) {
      assignmentQuery = assignmentQuery.eq('active', true).in('status', ['assigned', 'in-progress']);
    }

    const { data: assignmentRows, error: assignmentError } = await assignmentQuery;
    if (assignmentError) throw assignmentError;
    const assignments = assignmentRows || [];
    logger.info('client_assigned_surveys_fetched', {
      requestId: req.requestId ?? null,
      userId: context.userId,
      orgIdCount: Array.isArray(context.organizationIds) ? context.organizationIds.length : 0,
      includeCompleted,
      fetchedCount: assignments.length,
    });

    const surveyIds = Array.from(new Set(assignments.map((row) => row?.survey_id).filter(Boolean)));
    let surveys = [];
    let surveyMap = new Map();
    if (surveyIds.length) {
      const { data: surveyRows, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .in('id', surveyIds);
      if (surveyError) throw surveyError;
      const assignmentMap = await fetchSurveyAssignmentsMap(surveyIds);
      surveys = (surveyRows || []).map((row) => applyAssignmentToSurvey({ ...row }, assignmentMap.get(row.id)));
      surveyMap = new Map(surveys.map((survey) => [survey.id, survey]));
    }

    const shaped = assignments.map((assignment) => ({
      assignment,
      survey: assignment.survey_id ? surveyMap.get(assignment.survey_id) ?? null : null,
    }));

    logger.info('client_assigned_surveys_render_ready', {
      requestId: req.requestId ?? null,
      userId: context.userId,
      renderedCount: shaped.length,
    });

    res.json({ data: shaped });
  } catch (error) {
    logger.error('client_assigned_surveys_failed', {
      requestId: req.requestId ?? null,
      userId: context.userId,
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
    res.status(500).json({ error: 'Unable to load assigned surveys' });
  }
});

app.post('/api/client/surveys/:id/submit', authenticate, async (req, res) => {
  if (!ensureSupabase(res)) return;
  let submitStage = 'init';
  const context = requireUserContext(req, res);
  if (!context) return;
  const { id } = req.params;
  let surveyIdForLogs = id;

  const responses = req.body?.responses;
  if (!responses || typeof responses !== 'object') {
    res.status(400).json({ error: 'responses_required', message: 'Provide structured responses payload.' });
    return;
  }

  try {
    submitStage = 'load_survey';
    const surveyRecord = await loadSurveyWithAssignments(id);
    if (!surveyRecord) {
      res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
      return;
    }

    const surveyId = surveyRecord.id ?? id;
  surveyIdForLogs = surveyId;
  submitStage = 'load_assignment';
  const assignment = await loadSurveyAssignmentForUser(surveyId, context.userId, {
      assignmentId: req.body?.assignmentId ?? req.body?.assignment_id ?? null,
      orgIds: Array.isArray(context.organizationIds) ? context.organizationIds : [],
    });

    let resolvedAssignment = assignment;
    if (!supabase && isDemoOrTestMode) {
      e2eStore.assignments = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];

      const contextOrgIds = Array.isArray(context.organizationIds)
        ? context.organizationIds.map((value) => String(value))
        : [];

      const findMatchingAssignment = () =>
        e2eStore.assignments.find((row) => {
          if (!row) return false;
          const assignmentType = row.assignment_type ?? row.assignmentType ?? null;
          if (assignmentType && assignmentType !== SURVEY_ASSIGNMENT_TYPE) return false;
          const assignmentSurveyId = row.survey_id ?? row.surveyId ?? null;
          if (String(assignmentSurveyId) !== String(surveyId)) return false;
          if (row.active === false) return false;
          const rowUserId = row.user_id ?? row.userId ?? null;
          if (rowUserId && String(rowUserId).toLowerCase() === String(context.userId).toLowerCase()) {
            return true;
          }
          if (rowUserId !== null) return false;
          const rowOrgId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
          if (!rowOrgId) return true;
          return contextOrgIds.includes(String(rowOrgId));
        }) || null;

      resolvedAssignment = findMatchingAssignment();

      if (resolvedAssignment && (resolvedAssignment.user_id ?? resolvedAssignment.userId ?? null) === null) {
        const now = new Date().toISOString();
        const userScopedAssignment = {
          ...resolvedAssignment,
          id: `survey-asn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          user_id: context.userId,
          status: resolvedAssignment.status ?? 'assigned',
          active: true,
          metadata: {
            ...(resolvedAssignment.metadata && typeof resolvedAssignment.metadata === 'object'
              ? resolvedAssignment.metadata
              : {}),
            assigned_via: 'org_rollup',
          },
          created_at: now,
          updated_at: now,
        };
        e2eStore.assignments.push(userScopedAssignment);
        resolvedAssignment = userScopedAssignment;
      }
    }

    const metadataInput = typeof req.body?.metadata === 'object' && req.body.metadata !== null ? req.body.metadata : {};
    const assignmentMetadata =
      resolvedAssignment?.metadata && typeof resolvedAssignment.metadata === 'object' ? resolvedAssignment.metadata : {};

    let enrichedMetadata = { ...metadataInput };
    const isHdiSubmission =
      isHdiAssessment(surveyRecord) ||
      String(metadataInput.assessmentType ?? '').toLowerCase() === 'hdi' ||
      String(assignmentMetadata.assessmentType ?? '').toLowerCase() === 'hdi';

    if (isHdiSubmission) {
      const administrationType = normalizeHdiAdministrationType(
        req.body?.administrationType ??
          metadataInput.administrationType ??
          assignmentMetadata.administrationType,
      );
      const linkedAssessmentId = normalizeHdiLinkedAssessmentId(
        req.body?.linkedAssessmentId ??
          metadataInput.linkedAssessmentId ??
          assignmentMetadata.linkedAssessmentId ??
          null,
      );

      const scoring = scoreHdiSubmission({
        survey: surveyRecord,
        responses,
      });

      if (!scoring?.validation?.isValid) {
        res.status(400).json({
          error: 'invalid_hdi_submission',
          message: 'All 36 HDI items require valid Likert values (1-5).',
          details: scoring.validation,
        });
        return;
      }

      const participantIdentity = buildParticipantIdentity({
        userId: context.userId,
        userEmail: context.userEmail ?? null,
        metadata: metadataInput,
        assignmentMetadata,
      });
      const participantKeys = participantIdentity.participantKeys;

      const contractValidation = validateHdiSubmissionContract({
        administrationType,
        linkedAssessmentId,
        participantKeys,
      });
      if (!contractValidation.ok) {
        res.status(400).json({
          error: contractValidation.code,
          message: contractValidation.message,
        });
        return;
      }

      const participant = {
        userId: context.userId,
        participantKey: participantIdentity.participantKey,
        participantKeys,
        organizationId: resolvedAssignment?.organization_id ?? context.activeOrganizationId ?? null,
      };

      const profile = buildHdiProfile({ scoring });
      const report = buildHdiReport({
        participant,
        scoring,
        profile,
      });

      let prePostComparison = null;
      if (administrationType === 'post' || administrationType === 'pulse') {
        let historicalRows = [];
        let historyError = null;
        if (supabase) {
          const historyResponse = await supabase
            .from('survey_responses')
            .select('*')
            .eq('survey_id', surveyId)
            .eq('user_id', context.userId)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .limit(50);
          historicalRows = historyResponse.data || [];
          historyError = historyResponse.error || null;
        }
        if (!historyError && Array.isArray(historicalRows) && historicalRows.length > 0) {
          const currentRecord = {
            id: null,
            userId: context.userId,
            participantKeys,
            linkedAssessmentId,
            administrationType,
            scoring,
            report,
          };
          const preRecord = findLatestHdiPreRecord(historicalRows, currentRecord);
          if (linkedAssessmentId && !preRecord) {
            res.status(400).json({
              error: 'invalid_hdi_linked_assessment',
              message: 'linkedAssessmentId does not resolve to a valid pre assessment for this participant.',
            });
            return;
          }
          if (administrationType === 'post' && !preRecord) {
            res.status(409).json({
              error: 'missing_hdi_pre_assessment',
              message: 'Post assessment requires a matching pre assessment record.',
            });
            return;
          }
          if (preRecord?.report) {
            prePostComparison = compareHdiReports({
              preReport: preRecord.report,
              postReport: report,
            });
          } else if (preRecord) {
            prePostComparison = buildHdiComparison({
              pre: preRecord,
              post: {
                id: null,
                userId: context.userId,
                participantKeys,
                linkedAssessmentId,
                administrationType,
                scoring,
                report,
              },
            });
          }
        } else if (administrationType === 'post') {
          res.status(409).json({
            error: 'missing_hdi_pre_assessment',
            message: 'Post assessment requires a matching pre assessment record.',
          });
          return;
        }
      }

      enrichedMetadata = {
        ...metadataInput,
        assessmentType: 'hdi',
        administrationType,
        linkedAssessmentId,
        participantKey: participantIdentity.participantKey,
        participantKeys,
        hdiContractVersion: HDI_METADATA_CONTRACT_VERSION,
        participant: {
          ...(assignmentMetadata.participant && typeof assignmentMetadata.participant === 'object'
            ? assignmentMetadata.participant
            : {}),
          ...(metadataInput.participant && typeof metadataInput.participant === 'object'
            ? metadataInput.participant
            : {}),
        },
        hdi: {
          scoring,
          profile,
          report,
          administrationType,
          linkedAssessmentId,
          participantKeys,
          contractVersion: HDI_METADATA_CONTRACT_VERSION,
          computedAt: new Date().toISOString(),
          prePostComparison,
        },
      };
    }

    const nowIso = new Date().toISOString();
    const responsePayload = {
      survey_id: surveyId,
      user_id: context.userId,
      organization_id: resolvedAssignment?.organization_id ?? context.activeOrganizationId ?? null,
      response: responses,
      response_text: null,
      question_id: null,
      rating: null,
      metadata: enrichedMetadata,
      status: 'completed',
      assignment_id: resolvedAssignment?.id ?? null,
      completed_at: nowIso,
    };
    delete responsePayload.org_id;

    if (!supabase && isDemoOrTestMode) {
      const inserted = {
        id: `survey-response-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...responsePayload,
        created_at: nowIso,
        updated_at: nowIso,
      };

      e2eStore.surveyResponses = Array.isArray(e2eStore.surveyResponses) ? e2eStore.surveyResponses : [];
      e2eStore.surveyResponses.push(inserted);

      if (resolvedAssignment?.id) {
        const assignmentRow = (e2eStore.assignments || []).find((row) => row?.id === resolvedAssignment.id);
        if (assignmentRow) {
          assignmentRow.status = 'completed';
          assignmentRow.active = true;
          assignmentRow.metadata = {
            ...(assignmentRow.metadata && typeof assignmentRow.metadata === 'object' ? assignmentRow.metadata : {}),
            last_completed_at: nowIso,
            completion_audit: {
              completed_by: context.userId,
              completed_at: nowIso,
            },
          };
          assignmentRow.updated_at = nowIso;
        }
        logSurveyAssignmentEvent('survey_assignment_completed', {
          requestId: req.requestId ?? null,
          surveyId: surveyId,
          organizationCount: resolvedAssignment.organization_id ? 1 : 0,
          userCount: 1,
          insertedRowCount: 0,
          skippedRowCount: 0,
          invalidTargetIds: [],
          metadata: { assignmentId: resolvedAssignment.id },
        });
      }

      const assignedTo = createEmptyAssignedTo();
      const orgSet = new Set();
      const userSet = new Set();
      for (const assignmentRow of e2eStore.assignments || []) {
        if (!assignmentRow) continue;
        const assignmentType = assignmentRow.assignment_type ?? assignmentRow.assignmentType ?? null;
        if (assignmentType && assignmentType !== SURVEY_ASSIGNMENT_TYPE) continue;
        const assignmentSurveyId = assignmentRow.survey_id ?? assignmentRow.surveyId ?? null;
        if (String(assignmentSurveyId) !== String(surveyId)) continue;
        const orgId = assignmentRow.organization_id ?? assignmentRow.organizationId ?? assignmentRow.org_id ?? assignmentRow.orgId;
        if (orgId) orgSet.add(String(orgId));
        const userId = assignmentRow.user_id ?? assignmentRow.userId ?? null;
        if (userId) userSet.add(String(userId));
      }
      assignedTo.organizationIds = Array.from(orgSet);
      assignedTo.userIds = Array.from(userSet);
      updateDemoSurveyAssignments(surveyId, assignedTo);
      persistE2EStore();

      res.status(201).json({ data: inserted });
      return;
    }

    submitStage = 'insert_response_primary';
    let _surveyResp = null;
    let surveyResponseInsertPayload = { ...responsePayload };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      _surveyResp = await supabase
        .from('survey_responses')
        .insert(surveyResponseInsertPayload)
        .select('*');

      if (!_surveyResp?.error) {
        break;
      }

      const extractedMissingColumn = normalizeColumnIdentifier(extractMissingColumnName(_surveyResp.error));
      const parsedMissingColumn = (() => {
        const message = String(_surveyResp?.error?.message || '');
        const match = message.match(/'([a-zA-Z0-9_]+)'/);
        return match?.[1] ? normalizeColumnIdentifier(match[1]) : null;
      })();
      const missingColumn = extractedMissingColumn || parsedMissingColumn;

      if (!isMissingColumnError(_surveyResp.error) || !missingColumn) {
        break;
      }

      if (!Object.prototype.hasOwnProperty.call(surveyResponseInsertPayload, missingColumn)) {
        break;
      }

      submitStage = `insert_response_retry_drop_${missingColumn}`;
      delete surveyResponseInsertPayload[missingColumn];
    }

    if (_surveyResp.error) throw _surveyResp.error;
  submitStage = 'insert_response_success';
    const inserted = firstRow(_surveyResp);

    if (isHdiSubmission && inserted?.id && enrichedMetadata?.hdi) {
      const hdiPayload = enrichedMetadata.hdi;
      const report = hdiPayload.report ?? null;
      const scoring = hdiPayload.scoring ?? null;
      const profile = hdiPayload.profile ?? report?.profile ?? null;
      try {
        submitStage = 'persist_hdi_results';
        await supabase.from('hdi_assessment_results').upsert(
          {
            survey_response_id: inserted.id,
            survey_id: surveyId,
            user_id: context.userId,
            organization_id: resolvedAssignment?.organization_id ?? context.activeOrganizationId ?? null,
            stage_scores: report?.stageScores ?? scoring?.stageScores ?? {},
            normalized_scores: report?.normalizedScores ?? scoring?.normalizedScores ?? {},
            do_score: scoring?.developmentalOrientation?.score ?? scoring?.doScore ?? null,
            stage_placement: report?.stagePlacement ?? null,
            profile: profile ?? null,
            feedback: {
              summary: report?.summary ?? null,
              strengths: report?.strengths ?? [],
              growthAreas: report?.growthAreas ?? [],
              nextSteps: report?.nextSteps ?? [],
            },
            comparison: hdiPayload.prePostComparison ?? null,
          },
          { onConflict: 'survey_response_id' },
        );
      } catch (persistError) {
        logger.warn('hdi_result_persist_skipped', {
          surveyId: surveyId,
          responseId: inserted.id,
          message: persistError?.message ?? String(persistError),
          code: persistError?.code ?? null,
        });
      }
    }

    if (resolvedAssignment?.id) {
      submitStage = 'update_assignment';
      const mergedMetadata = {
        ...(resolvedAssignment.metadata && typeof resolvedAssignment.metadata === 'object' ? resolvedAssignment.metadata : {}),
        last_completed_at: nowIso,
        completion_audit: {
          completed_by: context.userId,
          completed_at: nowIso,
        },
      };
      const assignmentUpdateResult = await supabase
        .from('assignments')
        .update({ status: 'completed', active: true, metadata: mergedMetadata })
        .eq('id', resolvedAssignment.id)
        .select('id,status,active,metadata')
        .maybeSingle();
      if (assignmentUpdateResult.error) {
        throw assignmentUpdateResult.error;
      }
      const updatedAssignment = assignmentUpdateResult.data;
      const completionAuditAt = updatedAssignment?.metadata?.completion_audit?.completed_at ?? null;
      if (
        !updatedAssignment ||
        updatedAssignment.status !== 'completed' ||
        updatedAssignment.active !== true ||
        !completionAuditAt
      ) {
        const assignmentUpdateVerificationError = new Error('survey_assignment_completion_verification_failed');
        assignmentUpdateVerificationError.code = 'survey_assignment_completion_verification_failed';
        assignmentUpdateVerificationError.statusCode = 503;
        assignmentUpdateVerificationError.meta = {
          assignmentId: resolvedAssignment.id,
          surveyId,
        };
        throw assignmentUpdateVerificationError;
      }
      logSurveyAssignmentEvent('survey_assignment_completed', {
        requestId: req.requestId ?? null,
        surveyId: surveyId,
        organizationCount: resolvedAssignment.organization_id ? 1 : 0,
        userCount: 1,
        insertedRowCount: 0,
        skippedRowCount: 0,
        invalidTargetIds: [],
        metadata: { assignmentId: resolvedAssignment.id },
      });
      try {
        submitStage = 'refresh_aggregates';
        await refreshSurveyAssignmentAggregates(surveyId);
      } catch (aggregateError) {
        logger.warn('survey_assignment_aggregate_refresh_skipped_after_submit', {
          surveyId,
          assignmentId: resolvedAssignment.id,
          code: aggregateError?.code ?? null,
          message: aggregateError?.message ?? String(aggregateError),
        });
      }
    }

    submitStage = 'complete_success';
    res.status(201).json({ data: inserted });
  } catch (error) {
    console.error('[client.surveys.submit] failed', { stage: submitStage, error });
    logSurveyAssignmentEvent('survey_assignment_failed', {
      requestId: req.requestId ?? null,
      surveyId: surveyIdForLogs,
      organizationCount: 0,
      userCount: 1,
      insertedRowCount: 0,
      skippedRowCount: 0,
      invalidTargetIds: [],
      metadata: { stage: submitStage, error: error?.message ?? String(error) },
    });
    res.status(500).json({ error: 'Unable to submit survey response' });
  }
});

app.post('/api/admin/courses/:id/publish', authenticate, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const context = requireUserContext(req, res);
  if (!context) return;
  normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.publish', requestId: req.requestId });

  let publishRequest;
  try {
    publishRequest = parsePublishRequestBody(req.body || {});
  } catch (parseError) {
    sendApiError(
      res,
      parseError?.status || 400,
      parseError?.code || 'invalid_publish_payload',
      parseError?.message || 'Invalid publish payload.',
      {
        issues: Array.isArray(parseError?.issues) ? parseError.issues : undefined,
        meta: { requestId: req.requestId ?? null, courseId },
      },
    );
    return;
  }
  const idempotencyKey = publishRequest.idempotencyKey ?? publishRequest.clientEventId ?? null;
  const incomingVersion = publishRequest.version;

  const publishLogMeta = {
    requestId: req.requestId ?? null,
    userId: context.userId ?? null,
    courseId: courseId,
    orgId: null,
  };
  const publishStartedAt = Date.now();
  console.info('[course.publish_attempt]', {
    requestId: publishLogMeta.requestId,
    userId: publishLogMeta.userId,
    courseId: publishLogMeta.courseId,
    incomingVersion,
    idempotencyKey: idempotencyKey ?? null,
  });
  logCourseRequestEvent('admin.courses.publish.start', publishLogMeta);
  res.once('finish', () => {
    logCourseRequestEvent('admin.courses.publish.finish', {
      ...publishLogMeta,
      orgId: publishLogMeta.orgId ?? null,
      status: res.statusCode ?? null,
      errorCode: res.locals?.errorCode ?? null,
    });
  });

  try {
    if (isDemoOrTestMode) {
      const existing = e2eStore.courses.get(courseId);
      if (!existing) {
        res.locals = res.locals || {};
        res.locals.errorCode = 'not_found';
        sendApiError(res, 404, 'not_found', 'Course not found', {
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }
      publishLogMeta.orgId = existing.organization_id || existing.org_id || existing.organizationId || null;

      // Skip strict publish validation in demo/test mode.
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

      console.info('[course.publish_success]', {
        requestId: publishLogMeta.requestId,
        userId: publishLogMeta.userId,
        orgId: publishLogMeta.orgId,
        courseId: courseId,
        mode: 'demo',
        durationMs: Date.now() - publishStartedAt,
      });
      sendApiResponse(res, existing, {
        statusCode: 200,
        code: 'course_published',
        message: 'Course published successfully.',
        meta: {
          requestId: req.requestId ?? null,
          courseId: existing.id ?? courseId,
          orgId: publishLogMeta.orgId ?? null,
          mode: 'demo',
        },
      });
      return;
    }

    const existingCourseRows = await sql`
      select id, organization_id, version
      from public.courses
      where id = ${courseId}::uuid
      limit 1
    `;
    let existingCourseRow = firstRow(existingCourseRows);
    let publishViaSupabaseFallback = false;
    if (!existingCourseRow) {
      const { data: supabaseCourseRow, error: supabaseCourseRowError } = await supabase
        .from('courses')
        .select('id, organization_id, version')
        .eq('id', courseId)
        .maybeSingle();
      if (supabaseCourseRowError) {
        throw supabaseCourseRowError;
      }
      if (supabaseCourseRow) {
        existingCourseRow = supabaseCourseRow;
        publishViaSupabaseFallback = true;
        console.warn('[course.publish] SQL lookup missed course; using Supabase fallback path', {
          requestId: req.requestId ?? null,
          courseId,
        });
      }
    }
    if (!existingCourseRow) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'not_found';
      sendApiError(res, 404, 'not_found', 'Course not found', {
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }

    const courseOrgId = existingCourseRow.organization_id || null;
    publishLogMeta.orgId = courseOrgId;
    if (courseOrgId) {
      const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
      if (!access) return;
    } else if (!context.isPlatformAdmin) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'org_required';
      sendApiError(res, 403, 'org_required', 'Organization membership required to publish', {
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }

    const currentVersion = typeof existingCourseRow.version === 'number' ? existingCourseRow.version : null;
    console.info('[course.publish_version_check]', {
      requestId: publishLogMeta.requestId,
      userId: publishLogMeta.userId,
      orgId: publishLogMeta.orgId,
      courseId,
      incomingVersion,
      persistedVersion: currentVersion,
      source: publishViaSupabaseFallback ? 'supabase_fallback' : 'sql',
    });
    if (incomingVersion !== null && currentVersion !== null && incomingVersion !== currentVersion) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'version_conflict';
      sendApiError(res, 409, 'version_conflict', `Course has newer version ${currentVersion}`, {
        reason: 'stale_version',
        message: `Course has newer version ${currentVersion}`,
        currentVersion,
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }

    let idempotencyTableMissing = false;
    const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
    const assignmentsOrgColumn = await getAssignmentsOrgColumnName();

    if (idempotencyKey) {
      const existingFallback = getInMemoryIdempotencyKey(idempotencyKey);
      if (existingFallback) {
        if (existingFallback.status === 'done' && existingFallback.data) {
          console.info('[idempotency] returning cached in-memory response for completed idempotency', { idempotencyKey });
          return sendApiResponse(res, existingFallback.data, {
            statusCode: 200,
            code: 'course_publish_idempotent',
            message: 'Course already published for this idempotency key.',
            meta: {
              idempotent: true,
              key: idempotencyKey,
              requestId: req.requestId ?? null,
            },
          });
        }
        if (existingFallback.status === 'in_flight') {
          console.info('[idempotency] detected in-flight in-memory idempotency request', { idempotencyKey });
          return sendApiError(res, 409, 'idempotency_conflict', 'Another publish request is already in flight.', {
            reason: 'idempotency_in_flight',
            meta: { requestId: req.requestId ?? null, courseId },
          });
        }
      }

      const { data: insertData, error: insertError } = await supabase
        .from('idempotency_keys')
        .insert({
          id: idempotencyKey,
          key_type: 'course_publish',
          resource_id: null,
          payload: { course_id: courseId, version: currentVersion },
        });

      if (insertError) {
        if (isIdempotencyTableMissingError(insertError)) {
          idempotencyTableMissing = true;
          console.info('[idempotency] idempotency_keys table missing, using in-memory fallback for publish', { error: insertError, idempotencyKey });
          setInMemoryIdempotencyKey(idempotencyKey, {
            status: 'in_flight',
            createdAt: new Date().toISOString(),
            payload: { course_id: courseId, version: currentVersion },
          });
        } else {
          const isDuplicate = insertError?.code === '23505' || String(insertError?.message || '').toLowerCase().includes('duplicate');
          if (!isDuplicate) {
            sendApiError(res, 500, 'idempotency_insert_failed', 'Unable to register publish idempotency key.', {
              meta: { requestId: req.requestId ?? null, courseId },
            });
            return;
          }

          const { data: existingKey, error: existingKeyError } = await supabase
            .from('idempotency_keys')
            .select('*')
            .eq('id', idempotencyKey)
            .maybeSingle();

          if (existingKeyError || !existingKey) {
            sendApiError(res, 409, 'idempotency_conflict', 'Another publish request is already in flight.', {
              reason: 'idempotency_in_flight',
              meta: { requestId: req.requestId ?? null, courseId },
            });
            return;
          }

          if (existingKey.resource_id) {
            const { data: publishedCourse, error: publishedCourseError } = await supabase
              .from('courses')
              .select(COURSE_WITH_MODULES_LESSONS_SELECT)
              .eq('id', existingKey.resource_id)
              .maybeSingle();
            if (!publishedCourseError && publishedCourse) {
              return sendApiResponse(res, publishedCourse, {
                statusCode: 200,
                code: 'course_publish_idempotent',
                message: 'Course already published for this idempotency key.',
                meta: {
                  idempotent: true,
                  key: idempotencyKey,
                  requestId: req.requestId ?? null,
                },
              });
            }
          }

          return sendApiError(res, 409, 'idempotency_conflict', 'Another publish request is already in flight.', {
            reason: 'idempotency_in_flight',
            meta: { requestId: req.requestId ?? null, courseId },
          });
        }
      }
    }
    const publishCourseViaSupabaseFallback = async () => {
      const { data: lockedCourse, error: lockedCourseError } = await supabase
        .from('courses')
        .select(COURSE_WITH_MODULES_LESSONS_SELECT)
        .eq('id', courseId)
        .maybeSingle();
      if (lockedCourseError) {
        throw lockedCourseError;
      }
      if (!lockedCourse) {
        const error = new Error('Course not found');
        error.code = 'not_found';
        error.status = 404;
        throw error;
      }

      const lockedVersion = typeof lockedCourse.version === 'number' ? lockedCourse.version : null;
      if (incomingVersion !== null && lockedVersion !== null && incomingVersion !== lockedVersion) {
        const error = new Error(`Course has newer version ${lockedVersion}`);
        error.code = 'version_conflict';
        error.status = 409;
        error.currentVersion = lockedVersion;
        throw error;
      }

      const validation = validatePublishableCourse(shapeCourseForValidation(lockedCourse), { intent: 'publish' });
      console.info('[course.publish_validation_result]', {
        requestId: publishLogMeta.requestId,
        userId: publishLogMeta.userId,
        orgId: publishLogMeta.orgId,
        courseId,
        valid: validation.isValid,
        issuesCount: Array.isArray(validation.issues) ? validation.issues.length : 0,
        source: 'supabase_fallback',
      });
      if (!validation.isValid) {
        const error = new Error('Course is not publishable.');
        error.code = 'validation_failed';
        error.status = 422;
        error.issues = validation.issues;
        throw error;
      }

      const publishedAt = new Date().toISOString();
      const nextVersion = (lockedVersion ?? 0) + 1;
      const nextMeta = { ...(lockedCourse.meta_json || {}), published_at: publishedAt };

      let updateQuery = supabase
        .from('courses')
        .update({
          status: 'published',
          published_at: publishedAt,
          version: nextVersion,
          meta_json: nextMeta,
          updated_by: context.userId && isUuid(String(context.userId)) ? context.userId : null,
        })
        .eq('id', courseId)
        .select('id')
        .maybeSingle();

      if (lockedVersion !== null) {
        updateQuery = supabase
          .from('courses')
          .update({
            status: 'published',
            published_at: publishedAt,
            version: nextVersion,
            meta_json: nextMeta,
            updated_by: context.userId && isUuid(String(context.userId)) ? context.userId : null,
          })
          .eq('id', courseId)
          .eq('version', lockedVersion)
          .select('id')
          .maybeSingle();
      }

      const { data: updatedRow, error: updateError } = await updateQuery;
      if (updateError) {
        throw updateError;
      }
      if (!updatedRow?.id) {
        const error = new Error('Course publish failed because the course changed before publish completed.');
        error.code = 'version_conflict';
        error.status = 409;
        error.currentVersion = lockedVersion;
        throw error;
      }

      if (courseOrgId) {
        const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
        let membershipQuery = supabase
          .from('organization_memberships')
          .select('user_id')
          .eq(membershipOrgColumn, courseOrgId)
          .not('user_id', 'is', null);

        const membershipsStatusColumn = await getOrganizationMembershipsStatusColumnName();
        if (membershipsStatusColumn === 'is_active') {
          membershipQuery = membershipQuery.eq('is_active', true);
        } else {
          membershipQuery = membershipQuery.eq('status', 'active');
        }

        const { data: memberRows, error: memberRowsError } = await membershipQuery;
        if (memberRowsError) {
          throw memberRowsError;
        }

        const memberIds = Array.from(
          new Set((memberRows || []).map((row) => row?.user_id).filter(Boolean).map((value) => String(value))),
        );
        for (const memberId of memberIds) {
          await assignPublishedOrganizationCoursesToUser({
            orgId: courseOrgId,
            userId: memberId,
            actorUserId: context.userId ?? null,
          });
        }
      }

      const { data: refreshedCourse, error: refreshedCourseError } = await supabase
        .from('courses')
        .select(COURSE_WITH_MODULES_LESSONS_SELECT)
        .eq('id', courseId)
        .maybeSingle();
      if (refreshedCourseError) {
        throw refreshedCourseError;
      }

      return refreshedCourse || lockedCourse;
    };

    const updatedData = publishViaSupabaseFallback ? await publishCourseViaSupabaseFallback() : await sql.begin(async (tx) => {
      const lockedCourse = await loadCourseGraphWithTx(tx, courseId);
      if (!lockedCourse) {
        const error = new Error('Course not found');
        error.code = 'not_found';
        error.status = 404;
        throw error;
      }

      const lockedVersion = typeof lockedCourse.version === 'number' ? lockedCourse.version : null;
      if (incomingVersion !== null && lockedVersion !== null && incomingVersion !== lockedVersion) {
        const error = new Error(`Course has newer version ${lockedVersion}`);
        error.code = 'version_conflict';
        error.status = 409;
        error.currentVersion = lockedVersion;
        throw error;
      }

      const validation = validatePublishableCourse(shapeCourseForValidation(lockedCourse), { intent: 'publish' });
      console.info('[course.publish_validation_result]', {
        requestId: publishLogMeta.requestId,
        userId: publishLogMeta.userId,
        orgId: publishLogMeta.orgId,
        courseId,
        valid: validation.isValid,
        issuesCount: Array.isArray(validation.issues) ? validation.issues.length : 0,
        source: 'sql_tx',
      });
      if (!validation.isValid) {
        const error = new Error('Course is not publishable.');
        error.code = 'validation_failed';
        error.status = 422;
        error.issues = validation.issues;
        throw error;
      }

      const publishedAt = new Date().toISOString();
      const nextVersion = (lockedVersion ?? 0) + 1;
      const nextMeta = { ...(lockedCourse.meta_json || {}), published_at: publishedAt };

      const updatedRows =
        lockedVersion !== null
          ? await tx`
              update public.courses
              set status = 'published',
                  published_at = ${publishedAt}::timestamptz,
                  version = ${nextVersion},
                  meta_json = ${JSON.stringify(nextMeta)}::jsonb,
                  updated_at = now(),
                  updated_by = ${context.userId && isUuid(String(context.userId)) ? context.userId : null}::uuid
              where id = ${courseId}::uuid
                and version = ${lockedVersion}
              returning id
            `
          : await tx`
              update public.courses
              set status = 'published',
                  published_at = ${publishedAt}::timestamptz,
                  version = ${nextVersion},
                  meta_json = ${JSON.stringify(nextMeta)}::jsonb,
                  updated_at = now(),
                  updated_by = ${context.userId && isUuid(String(context.userId)) ? context.userId : null}::uuid
              where id = ${courseId}::uuid
              returning id
            `;
      if (!firstRow(updatedRows)?.id) {
        const error = new Error('Course publish failed because the course changed before publish completed.');
        error.code = 'version_conflict';
        error.status = 409;
        error.currentVersion = lockedVersion;
        throw error;
      }

      await backfillPublishedCourseAssignmentsWithTx(tx, {
        orgId: courseOrgId,
        courseId,
        actorUserId: context.userId ?? null,
        assignmentsOrgColumn,
        assignmentsSupportUserIdUuid,
      });

      return loadCourseGraphWithTx(tx, courseId);
    });

    if (idempotencyKey) {
      try {
        await supabase.from('idempotency_keys').update({ resource_id: updatedData?.id }).eq('id', idempotencyKey);
      } catch (updateErr) {
        console.warn('Failed to update publish idempotency key with resource id', updateErr);
      }
      if (idempotencyTableMissing) {
        setInMemoryIdempotencyKey(idempotencyKey, {
          status: 'done',
          createdAt: new Date().toISOString(),
          payload: { course_id: courseId, version: currentVersion },
          resourceId: updatedData?.id ?? courseId,
          data: updatedData,
        });
      }
    }

    try {
      const orgId = updatedData?.organization_id || updatedData?.org_id || null;
      const payload = { type: 'course_updated', data: updatedData, timestamp: Date.now() };
      if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
      broadcastToTopic('course:updates', payload);
    } catch (bErr) {
      console.warn('Failed to broadcast course publish event', bErr);
    }

    console.info('[course.publish_success]', {
      requestId: publishLogMeta.requestId,
      userId: publishLogMeta.userId,
      orgId: publishLogMeta.orgId,
      courseId: courseId,
      mode: 'supabase',
      durationMs: Date.now() - publishStartedAt,
    });
    sendApiResponse(res, updatedData, {
      statusCode: 200,
      code: 'course_published',
      message: 'Course published successfully.',
      meta: {
        requestId: req.requestId ?? null,
        courseId: updatedData?.id ?? courseId,
        orgId: publishLogMeta.orgId ?? null,
      },
    });
  } catch (error) {
    console.error('[course.publish_error]', {
      requestId: publishLogMeta.requestId,
      userId: publishLogMeta.userId,
      orgId: publishLogMeta.orgId,
      courseId: courseId,
      durationMs: Date.now() - publishStartedAt,
      error: {
        message: error?.message ?? null,
        code: error?.code ?? null,
        details: error?.details ?? null,
      },
    });
    logAdminCoursesError(req, error, `Failed to publish course ${id}`);
    res.locals = res.locals || {};
    res.locals.errorCode = error?.code ?? 'publish_failed';
    if (error?.status === 409) {
      const conflictCode = error?.code ?? 'version_conflict';
      sendApiError(res, 409, error?.code ?? 'version_conflict', error?.message ?? 'Publish conflict.', {
        reason:
          error?.reason ??
          (conflictCode === 'idempotency_conflict' ? 'idempotency_in_flight' : 'stale_version'),
        currentVersion: error?.currentVersion ?? null,
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }
    if (error?.status === 422) {
      sendApiError(res, 422, error?.code ?? 'validation_failed', 'Course is not publishable.', {
        issues: Array.isArray(error?.issues) ? error.issues : [],
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }
    if (error?.status === 404) {
      sendApiError(res, 404, error?.code ?? 'not_found', error?.message ?? 'Course not found', {
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }
    sendApiError(res, 500, 'publish_failed', 'Unable to publish course', {
      meta: { requestId: req.requestId ?? null, courseId },
    });
  }
});

app.delete('/api/admin/courses/:id', authenticate, requireOrgAdmin, async (req, res) => {
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const context = requireUserContext(req, res);
  if (!context) return;

  // Dev/E2E fallback
  if (isDemoOrTestMode) {
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

app.get('/api/client/courses', asyncHandler(async (req, res) => {
  const requestId = req.requestId ?? null;
  const assignedOnly = String(req.query.assigned || 'false').toLowerCase() === 'true';
  const queryOrgParam =
    typeof req.query.orgId === 'string'
      ? req.query.orgId
      : typeof req.query.organizationId === 'string'
        ? req.query.organizationId
        : null;
  let context = null;
  if (isDemoOrTestMode) {
    context = {
      userId: null,
      userRole: 'admin',
      memberships: [],
      organizationIds: [],
      requestedOrgId: null,
      activeOrganizationId: null,
      isPlatformAdmin: true,
    };
  } else {
    context = requireUserContext(req, res);
    if (!context) return;
  }

  // In dev/demo mode the injected user/org IDs may be non-UUID placeholders.
  // Return empty catalog rather than a DB 22P02 error.
  if (!isDemoMode && !isUuid(context.userId || '') && !context.isPlatformAdmin) {
    return res.json({ ok: true, courses: [], total: 0, requestId });
  }

  const orgScope = await resolveOrgScopeForRequest(req, context, {
    queryOrgId: queryOrgParam,
    requireExplicitSelection: true,
  });
  const { resolvedOrgId, scopedOrgIds, membershipSet, primaryOrgId, requiresExplicitSelection } = orgScope;
  if (requiresExplicitSelection) {
    res.status(403).json({
      ok: false,
      code: 'org_selection_required',
      message: 'Select an organization before loading learner courses.',
      requestId,
    });
    return;
  }
  let effectiveScopedOrgIds = Array.isArray(scopedOrgIds) ? [...scopedOrgIds] : [];
  let effectiveAssignedOnly = assignedOnly;
  let membershipFallbackApplied = false;
  const requestOrgId = req.organizationId || null;
  let effectiveOrgId = requestOrgId || resolvedOrgId || primaryOrgId || null;

  if (effectiveOrgId && !context.isPlatformAdmin && !membershipSet.has(effectiveOrgId)) {
    res.status(403).json({
      ok: false,
      code: 'org_forbidden',
      message: 'You do not have access to this organization.',
      requestId,
    });
    return;
  }

  if (!context.isPlatformAdmin && effectiveScopedOrgIds.length === 0) {
    const userIdForFallback = typeof context.userId === 'string' ? context.userId.trim() : '';
    if (userIdForFallback && supabase) {
      try {
        const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
        const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
        const userFilter = assignmentsSupportUserIdUuid
          ? `user_id.eq.${userIdForFallback},user_id_uuid.eq.${userIdForFallback}`
          : `user_id.eq.${userIdForFallback}`;
        const { data: assignmentOrgRows, error: assignmentOrgError } = await supabase
          .from('assignments')
          .select(`${assignmentsOrgColumn},organization_id,org_id`)
          .eq('assignment_type', 'course')
          .eq('active', true)
          .or(userFilter)
          .limit(200);
        if (assignmentOrgError) {
          throw assignmentOrgError;
        }
        const derivedOrgIds = Array.from(
          new Set(
            (assignmentOrgRows || [])
              .map((row) =>
                normalizeOrgIdValue(
                  pickOrgId(
                    row?.organization_id,
                    row?.org_id,
                    assignmentsOrgColumn === 'organization_id' ? row?.organization_id : row?.org_id,
                  ),
                ),
              )
              .filter(Boolean),
          ),
        );
        if (derivedOrgIds.length > 0) {
          effectiveScopedOrgIds = derivedOrgIds;
          effectiveOrgId = effectiveOrgId || derivedOrgIds[0] || null;
          effectiveAssignedOnly = true;
          membershipFallbackApplied = true;
        }
      } catch (fallbackError) {
        logger.warn('[client/courses] org_scope_fallback_failed', {
          requestId,
          userId: userIdForFallback,
          message: fallbackError?.message ?? String(fallbackError),
        });
      }
    }

    if (effectiveScopedOrgIds.length === 0) {
      res.status(200).json({
        ok: true,
        data: [],
        requestId,
        meta: {
          code: 'org_membership_required',
          membershipFallbackApplied: false,
        },
      });
      return;
    }
  }

  const assignmentOrgId = effectiveOrgId ?? primaryOrgId;
  logger.debug('[client/courses] request_context', {
    requestId,
    assignedOnly,
    effectiveAssignedOnly,
    requestedOrgId: queryOrgParam,
    resolvedOrgId,
    primaryOrgId,
    requestOrgId,
    effectiveOrgId,
    scopedOrgIds: effectiveScopedOrgIds,
    membershipFallbackApplied,
    membershipCount: membershipSet.size,
  });
  if (effectiveAssignedOnly && !assignmentOrgId && !context.isPlatformAdmin) {
    res.status(400).json({
      ok: false,
      code: 'org_required',
      message: 'Specify an orgId or set an active organization to view assignments.',
      requestId,
    });
    return;
  }

  const sessionUserId =
    (req.user && (req.user.userId || req.user.id || req.user.sub)) || null;
  const normalizedSessionUserId = sessionUserId ? String(sessionUserId).trim().toLowerCase() : null;

  const resolveAssignmentCourseIds = async () => {
    if (!effectiveAssignedOnly || !assignmentOrgId) {
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
          const assignmentOrg = pickOrgId(
            assignment.organization_id,
            assignment.org_id,
            assignment.organizationId,
            assignment.orgId,
          );
          const isOrgMatch = String(assignmentOrg || '').trim() === assignmentOrgId;
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
      if (isDemoOrTestMode) {
        pushIds(e2eStore.assignments || []);
        return Array.from(ids);
      }
      return null;
    }

    const tablesToTry = ['assignments', 'course_assignments'];

  const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
  const assignmentsOrgColumn = await getAssignmentsOrgColumnName();

    for (const table of tablesToTry) {
      let tableResults = null;
      const orgColumnCandidates =
        table === 'assignments'
          ? [
              {
                column: assignmentsOrgColumn,
                select:
                  assignmentsOrgColumn === 'organization_id'
                    ? 'course_id,organization_id,user_id,active'
                    : 'course_id,org_id,user_id,active',
              },
              {
                column: assignmentsOrgColumn === 'organization_id' ? 'org_id' : 'organization_id',
                select:
                  assignmentsOrgColumn === 'organization_id'
                    ? 'course_id,org_id,user_id,active'
                    : 'course_id,organization_id,user_id,active',
              },
            ]
          : [
              { column: 'organization_id', select: 'course_id,organization_id,user_id,active' },
              { column: 'org_id', select: 'course_id,org_id,user_id,active' },
            ];

      for (const candidate of orgColumnCandidates) {
        let query = supabase.from(table).select(candidate.select).eq(candidate.column, assignmentOrgId);
        if (normalizedSessionUserId) {
          if (table === 'assignments' && assignmentsSupportUserIdUuid) {
            query = query.or(`user_id.eq.${normalizedSessionUserId},user_id_uuid.eq.${normalizedSessionUserId},user_id.is.null`);
          } else {
            query = query.or(`user_id.eq.${normalizedSessionUserId},user_id.is.null`);
          }
        } else {
          query = query.is('user_id', null);
        }

        const { data, error } = await query;
        if (error) {
          const missingRelation = typeof error.message === 'string' && /relation/.test(error.message);
          const missingColumn =
            error.code === '42703' || (typeof error.message === 'string' && /column .* does not exist/i.test(error.message));
          if (missingRelation) {
            tableResults = null;
            break;
          }
          if (missingColumn) {
            continue;
          }
          throw error;
        }
        tableResults = data || [];
        break;
      }

      if (tableResults) {
        pushIds(tableResults);
        if (ids.size > 0 || table === tablesToTry[tablesToTry.length - 1]) {
          break;
        }
      }
    }

    return Array.from(ids);
  };

  const respondWithDemoCourses = async () => {
    // In dev/demo mode, show ALL courses (not just published)
    let courses = Array.from(e2eStore.courses.values()).map((course) => {
      const normalizedCourse = ensureOrgFieldCompatibility(course, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || course;
      const { org_id, ...rest } = normalizedCourse;
      return rest;
    });
    console.info('[client.courses][demo]', {
      requestId,
      assignedOnly,
      effectiveOrgId,
      primaryOrgId,
      scopedOrgIds,
      isPlatformAdmin: context.isPlatformAdmin,
      courseCountBeforeFilter: courses.length,
      sampleCourseIds: courses.slice(0, 10).map((course) => course?.id ?? null),
    });

    if (!context.isPlatformAdmin && scopedOrgIds.length > 0 && !isTestMode) {
      const scopedOrgIdSet = new Set(scopedOrgIds);
      courses = courses.filter((course) => {
        const courseOrgId = pickOrgId(course.organization_id, course.org_id, course.organizationId);
        const normalizedCourseOrg = normalizeOrgIdValue(courseOrgId);
        if (!normalizedCourseOrg) return false;
        return scopedOrgIdSet.has(normalizedCourseOrg);
      });
    }

    if (assignedOnly && assignmentOrgId) {
      const demoAssignments = (e2eStore.assignments || [])
        .map((assignment) => ensureOrgFieldCompatibility(assignment, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || assignment)
        .filter(
          (asn) =>
            asn &&
            asn.active !== false &&
            String(asn.organization_id || '').trim() === assignmentOrgId &&
            (!normalizedSessionUserId ||
              asn.user_id === null ||
              String(asn.user_id).trim().toLowerCase() === normalizedSessionUserId)
        );
      const assignedIds = new Set(demoAssignments.map((asn) => String(asn.course_id)));
      courses = courses.filter((course) => assignedIds.has(String(course.id)) || assignedIds.has(String(course.slug)));
    }

    console.info('[client.courses][demo][post-filter]', {
      requestId,
      assignedOnly,
      effectiveOrgId,
      scopedOrgIds,
      courseCountAfterFilter: courses.length,
      sampleCourseIds: courses.slice(0, 10).map((course) => course?.id ?? null),
    });

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
        lessons: (m.lessons || []).map((l) => {
          const lessonRecord = {
            id: l.id,
            module_id: m.id,
            title: l.title,
            description: l.description ?? null,
            type: l.type,
            order_index: l.order_index ?? l.order ?? 0,
            duration_s: l.duration_s ?? null,
            content_json: l.content_json ?? l.content ?? {},
          };
          attachCompletionRuleForResponse(lessonRecord);
          return lessonRecord;
        }),
        })),
      };
    });
    return data;
  };

  if (isDemoOrTestMode) {
    const demoData = await respondWithDemoCourses();
    res.status(200).json({ ok: true, data: demoData, requestId });
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    let assignmentCourseIds = null;
    if (effectiveAssignedOnly && assignmentOrgId) {
      assignmentCourseIds = await resolveAssignmentCourseIds();
      if (effectiveAssignedOnly && Array.isArray(assignmentCourseIds) && assignmentCourseIds.length === 0) {
        res.status(200).json({ ok: true, data: [], requestId });
        return;
      }
    }

    // NOTE: Production Supabase previously referenced organization_memberships.org_id inside user_organizations_vw,
    // causing Postgres 42703 (undefined column "org_id") during the published courses fetch.
    // TODO: Keep user_organizations_vw aligned with organization_memberships.organization_id so this query remains stable.
    const queryName = 'client_courses_published';
    let courseQuery = supabase
      .from('courses')
      .select(COURSE_WITH_MODULES_LESSONS_SELECT)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: MODULE_LESSONS_FOREIGN_TABLE });

    if (effectiveAssignedOnly && assignmentOrgId && Array.isArray(assignmentCourseIds)) {
      courseQuery = courseQuery.in('id', assignmentCourseIds);
    }
    if (!context.isPlatformAdmin || effectiveScopedOrgIds.length > 0) {
      if (effectiveScopedOrgIds.length === 1) {
        courseQuery = courseQuery.eq('organization_id', effectiveScopedOrgIds[0]);
      } else if (effectiveScopedOrgIds.length > 1) {
        courseQuery = courseQuery.in('organization_id', effectiveScopedOrgIds);
      }
    }

    const { data, error } = await courseQuery;

    if (error) {
      error.queryName = queryName;
      throw error;
    }
    const list = Array.isArray(data) ? data : [];
    const responseMeta = {
      orgId: assignmentOrgId ?? (scopedOrgIds.length === 1 ? scopedOrgIds[0] : null),
      scopedOrgCount: effectiveScopedOrgIds.length,
      assignedOnly: effectiveAssignedOnly,
      assignmentFilterActive: effectiveAssignedOnly && Array.isArray(assignmentCourseIds),
      assignmentCourseCount: Array.isArray(assignmentCourseIds) ? assignmentCourseIds.length : null,
      membershipFallbackApplied,
      count: list.length,
    };
    if (list.length === 0) {
      logger.warn('[client/courses] empty_catalog', {
        requestId,
        ...responseMeta,
      });
    } else if (process.env.NODE_ENV !== 'production') {
      logger.info('[client/courses] catalog_loaded', {
        requestId,
        ...responseMeta,
      });
    }
    res.status(200).json({ ok: true, data: list, requestId, meta: responseMeta });
  } catch (error) {
    logStructuredError('[client/courses] published_fetch_failed', error, {
      route: '/api/client/courses',
      queryName: error?.queryName ?? 'client_courses_published',
      assignedOnly: effectiveAssignedOnly,
      orgId: assignmentOrgId ?? null,
      requestId,
    });
    res.status(500).json({
      ok: false,
      code: error?.code ?? 'catalog_fetch_failed',
      message: error?.message ?? 'Unable to fetch courses.',
      hint: error?.hint ?? null,
      requestId,
      queryName: error?.queryName ?? 'client_courses_published',
    });
  }
}));


app.get('/api/client/courses/:courseIdentifier', asyncHandler(async (req, res) => {
  const { courseIdentifier } = req.params;
  const includeDrafts = String(req.query.includeDrafts || '').toLowerCase() === 'true';
  const requestId = req.requestId ?? null;
  let context = null;
  if (isDemoOrTestMode) {
    context = {
      userId: null,
      userRole: 'admin',
      memberships: [],
      organizationIds: [],
      requestedOrgId: null,
      activeOrganizationId: null,
      isPlatformAdmin: true,
    };
  } else {
    context = requireUserContext(req, res);
    if (!context) return;
  }
  const orgScope = await resolveOrgScopeForRequest(req, context, { requireExplicitSelection: true });
  const { membershipSet, scopedOrgIds, requiresExplicitSelection } = orgScope;
  if (requiresExplicitSelection) {
    res.status(403).json({
      ok: false,
      code: 'org_selection_required',
      message: 'Select an organization before opening this course.',
      requestId,
    });
    return;
  }
  const allowAllOrgAccess = context.isPlatformAdmin || scopedOrgIds.length === 0;
  const isOrgAllowed = (orgId) => {
    if (allowAllOrgAccess) return true;
    const normalized = normalizeOrgIdValue(orgId);
    if (!normalized) return false;
    return membershipSet.has(normalized);
  };
  const applyOrgScopeFilter = (query) => {
    if (allowAllOrgAccess) return query;
    if (scopedOrgIds.length === 1) {
      return query.eq('organization_id', scopedOrgIds[0]);
    }
    if (scopedOrgIds.length > 1) {
      return query.in('organization_id', scopedOrgIds);
    }
    const fallbackOrg = normalizeOrgIdValue(context.activeOrganizationId ?? context.requestedOrgId ?? null);
    if (fallbackOrg) {
      return query.eq('organization_id', fallbackOrg);
    }
    return query;
  };

  if (isDemoOrTestMode) {
    try {
      const course = e2eFindCourse(courseIdentifier);
      if (!course) {
        res.json({ data: null });
        return;
      }
      // In dev/demo mode, show all courses regardless of status
      // (ignore the includeDrafts query param)

      const normalizedCourse = ensureOrgFieldCompatibility(course, { fallbackOrgId: DEFAULT_SANDBOX_ORG_ID }) || course;
      const courseOrgId =
        normalizedCourse.organization_id ?? normalizedCourse.org_id ?? normalizedCourse.organizationId ?? null;
      if (!isOrgAllowed(courseOrgId)) {
        res.json({ data: null });
        return;
      }
      const normalizeLessonContent = (lesson) => {
        const baseContent = lesson?.content_json ?? lesson?.content ?? {};
        const nextContent = { ...(baseContent || {}) };

        const body = typeof baseContent?.body === 'object' && baseContent.body ? baseContent.body : null;
        if (!nextContent.videoUrl && body?.videoUrl) {
          nextContent.videoUrl = body.videoUrl;
        }
        if (!nextContent.video && nextContent.videoUrl) {
          nextContent.video = { url: nextContent.videoUrl };
        }

        if (lesson?.type === 'quiz') {
          const questions = Array.isArray(nextContent.questions)
            ? nextContent.questions
            : Array.isArray(body?.questions)
            ? body.questions
            : [];
          nextContent.questions = questions.map((question, index) => {
            const q = { ...(question || {}) };
            const correctIndex =
              typeof q.correctAnswerIndex === 'number'
                ? q.correctAnswerIndex
                : typeof body?.correctAnswerIndex === 'number'
                ? body.correctAnswerIndex
                : null;
            if (Array.isArray(q.options)) {
              q.options = q.options.map((option, optIndex) => {
                if (typeof option === 'string') {
                  return {
                    id: `opt-${index + 1}-${optIndex + 1}`,
                    text: option,
                    correct: correctIndex === optIndex,
                  };
                }
                const optionId = option?.id ?? `opt-${index + 1}-${optIndex + 1}`;
                return {
                  ...option,
                  id: optionId,
                  correct: option?.correct ?? option?.isCorrect ?? correctIndex === optIndex,
                };
              });
            }
            return q;
          });
        }

        return nextContent;
      };

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
          lessons: (m.lessons || []).map((l) => {
            const normalizedContent = normalizeLessonContent(l);
            const responseLessonId =
              (typeof l?.client_temp_id === 'string' && l.client_temp_id.trim()) ||
              (typeof l?.clientTempId === 'string' && l.clientTempId.trim()) ||
              l.id;
            const lessonRecord = {
              id: responseLessonId,
              module_id: m.id,
              title: l.title,
              description: l.description ?? null,
              type: l.type,
              order_index: l.order_index ?? l.order ?? 0,
              duration_s: l.duration_s ?? null,
              content: normalizedContent,
              content_json: normalizedContent,
            };
            attachCompletionRuleForResponse(lessonRecord);
            return lessonRecord;
          }),
        })),
      };
      res.json({ ok: true, data, requestId });
      return;
    } catch (error) {
      console.error(`E2E fetch course ${identifier} failed:`, error);
      res.status(500).json({
        ok: false,
        code: 'course_fetch_failed',
        message: 'Unable to load course.',
        hint: null,
        requestId,
        queryName: 'client_course_detail',
      });
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
    query = applyOrgScopeFilter(query);
    return query;
  };
  const queryName = 'client_course_detail';
  let identifierType = 'slug';
  try {
  identifierType = isUuid(courseIdentifier) ? 'uuid' : 'slug';
    const identifierValue = courseIdentifier;
    let { data, error } = identifierType === 'uuid' ? await buildQuery('id', identifierValue) : { data: null, error: null };
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) {
      ({ data, error } = await buildQuery('slug', identifierValue));
      if (error && error.code !== 'PGRST116') throw error;
    }
    if (data) {
      const courseOrgId = data.organization_id ?? data.org_id ?? data.organizationId ?? null;
      if (!isOrgAllowed(courseOrgId)) {
        res.status(200).json({ ok: true, data: null, requestId });
        return;
      }
      const hydrated = await ensureCourseStructureLoaded(data, { includeLessons: true });
      res.json({ ok: true, data: hydrated, requestId });
      return;
    }
    res.json({ ok: true, data: null, requestId });
  } catch (error) {
    logStructuredError('[client/courses] detail_fetch_failed', error, {
      route: '/api/client/courses/:courseIdentifier',
      queryName,
      identifier: courseIdentifier,
      identifierType,
      requestId,
    });
    res.status(500).json({
      ok: false,
      code: error?.code ?? 'course_fetch_failed',
      message: error?.message ?? 'Unable to load course.',
      hint: error?.hint ?? null,
      requestId,
      queryName,
    });
  }
}));

// Admin Modules (E2E fallback)
app.post('/api/admin/modules', authenticate, requireOrgAdmin, async (req, res) => {
  if (isDemoOrTestMode) {
    const parsed = validateOr400(moduleCreateSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const metadata = parsed.metadata ?? {};
    if (!courseId || !title) {
      sendApiError(res, 400, 'validation_failed', 'courseId and title are required');
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
        sendApiError(res, 409, 'version_conflict', `Course has newer version ${current}`);
        return;
      }
    }
    const id = `e2e-mod-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mod = { id, course_id: course.id, title, description, order_index: orderIndex, lessons: [], metadata: metadata ?? {} };
    course.modules = course.modules || [];
    course.modules.push(mod);
    persistE2EStore();
    console.log(`✅ Created module "${title}" in course "${course.title}"`);
    sendApiResponse(res, { id, course_id: course.id, title, description, order_index: orderIndex }, {
      statusCode: 201,
      code: 'module_created',
      message: 'Module created.',
      meta: { requestId: req.requestId ?? null, courseId: course.id, moduleId: id },
    });
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
      sendApiError(res, 400, 'validation_failed', 'courseId and title are required', {
        meta: { requestId: req.requestId ?? null },
      });
      return;
    }
    // Optional optimistic check against parent course version to avoid stale edits
    if (typeof expectedCourseVersion === 'number') {
      const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
      if (fetchErr) throw fetchErr;
      const current = courseRow?.version ?? null;
      if (current !== null && expectedCourseVersion < current) {
        sendApiError(res, 409, 'version_conflict', `Course has newer version ${current}`, {
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }
    }
    const _modInsert = await supabase
      .from('modules')
      .insert({ course_id: courseId, title, description, order_index: orderIndex })
      .select('*');
    if (_modInsert.error) throw _modInsert.error;
    const data = firstRow(_modInsert);
    if (!data) throw new Error('module_insert_no_rows');
    sendApiResponse(res, { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 }, {
      statusCode: 201,
      code: 'module_created',
      message: 'Module created.',
      meta: { requestId: req.requestId ?? null, courseId: data.course_id, moduleId: data.id },
    });
  } catch (error) {
    console.error('Failed to create module:', error);
    sendApiError(res, 500, 'module_create_failed', 'Unable to create module', {
      meta: { requestId: req.requestId ?? null },
    });
  }
});

app.patch('/api/admin/modules/:id', authenticate, requireOrgAdmin, async (req, res) => {
  if (isDemoOrTestMode) {
    const { id } = req.params;
    const parsed = validateOr400(modulePatchValidator, req, res);
    if (!parsed) return;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const found = e2eFindModule(id);
    if (!found) {
      sendApiError(res, 404, 'module_not_found', 'Module not found', {
        meta: { requestId: req.requestId ?? null, moduleId: id },
      });
      return;
    }
    // Optional optimistic check: ensure client is targeting expected course version
    if (typeof expectedCourseVersion === 'number') {
      const current = found.module.version ?? 1;
      if (expectedCourseVersion < current) {
        sendApiError(res, 409, 'version_conflict', `Module has newer version ${current}`, {
          meta: { requestId: req.requestId ?? null, moduleId: id },
        });
        return;
      }
    }
    if (typeof title === 'string') found.module.title = title;
    if (description !== undefined) found.module.description = description;
    if (typeof orderIndex === 'number') found.module.order_index = orderIndex;
    persistE2EStore();
    console.log(`✅ Updated module ${id}`);
    sendApiResponse(res, { id: found.module.id, course_id: found.course.id, title: found.module.title, description: found.module.description, order_index: found.module.order_index ?? 0 }, {
      code: 'module_updated',
      message: 'Module updated.',
      meta: { requestId: req.requestId ?? null, courseId: found.course.id, moduleId: found.module.id },
    });
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
      sendApiError(res, 400, 'no_fields_to_update', 'No fields to update', {
        meta: { requestId: req.requestId ?? null, moduleId: id },
      });
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
          sendApiError(res, 409, 'version_conflict', `Course has newer version ${current}`, {
            meta: { requestId: req.requestId ?? null, courseId, moduleId: id },
          });
          return;
        }
      }
    }
    const _modPatch = await supabase
      .from('modules')
      .update(patch)
      .eq('id', id)
      .select('*');
    if (_modPatch.error) throw _modPatch.error;
    const data = firstRow(_modPatch);
    if (!data) {
      sendApiError(res, 404, 'module_not_found', 'Module not found or no rows updated', {
        meta: { requestId: req.requestId ?? null, moduleId: id },
      });
      return;
    }
    sendApiResponse(res, { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 }, {
      code: 'module_updated',
      message: 'Module updated.',
      meta: { requestId: req.requestId ?? null, courseId: data.course_id, moduleId: data.id },
    });
  } catch (error) {
    console.error('Failed to update module:', error);
    sendApiError(res, 500, 'module_update_failed', 'Unable to update module', {
      meta: { requestId: req.requestId ?? null, moduleId: req.params?.id ?? null },
    });
  }
});

app.delete('/api/admin/modules/:id', authenticate, requireOrgAdmin, async (req, res) => {
  if (isDemoOrTestMode) {
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
  const context = requireUserContext(req, res);
  if (!context) return;
  try {
    const { id } = req.params;
    // Resolve the module's parent course to enforce org scope
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id, course_id')
      .eq('id', id)
      .maybeSingle();
    if (moduleErr) throw moduleErr;
    if (!moduleRow) {
      res.status(204).end();
      return;
    }
    if (moduleRow.course_id) {
      const { data: courseRow, error: courseErr } = await supabase
        .from('courses')
        .select('id, organization_id')
        .eq('id', moduleRow.course_id)
        .maybeSingle();
      if (courseErr) throw courseErr;
      const moduleOrgId = courseRow?.organization_id ?? null;
      if (moduleOrgId) {
        const access = await requireOrgAccess(req, res, moduleOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return;
      } else if (!context.isPlatformAdmin) {
        res.status(403).json({ error: 'organization_required', message: 'Module course is not scoped to an organization.' });
        return;
      }
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'organization_required', message: 'Module is not scoped to an organization.' });
      return;
    }
    // Delete lessons first (in case FK cascade not set)
    await supabase.from('lessons').delete().eq('module_id', id);
    await supabase.from('modules').delete().eq('id', id);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete module:', error);
    res.status(500).json({ error: 'Unable to delete module' });
  }
});

app.post('/api/admin/modules/reorder', authenticate, requireOrgAdmin, async (req, res) => {
  if (isDemoOrTestMode) {
    const parsed = validateOr400(moduleReorderSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const modules = parsed.modules;
    const course = e2eFindCourse(courseId);
    if (!course) {
      sendApiError(res, 404, 'course_not_found', 'Course not found', {
        meta: { requestId: req.requestId ?? null, courseId },
      });
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
    sendApiResponse(res, response, {
      code: 'modules_reordered',
      message: 'Modules reordered.',
      meta: { requestId: req.requestId ?? null, courseId },
    });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(moduleReorderSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const modules = parsed.modules;
    if (!courseId || !Array.isArray(modules)) {
      sendApiError(res, 400, 'validation_failed', 'courseId and modules are required', {
        meta: { requestId: req.requestId ?? null },
      });
      return;
    }
    const updates = (modules || []).map((m) => {
      return supabase.from('modules').update({ order_index: pickOrder(m) }).eq('id', m.id);
    });
    await Promise.all(updates);
    const order = modules.map((m) => ({ id: m.id, order_index: pickOrder(m) }));
    sendApiResponse(res, order, {
      code: 'modules_reordered',
      message: 'Modules reordered.',
      meta: { requestId: req.requestId ?? null, courseId },
    });
  } catch (error) {
    console.error('Failed to reorder modules:', error);
    sendApiError(res, 500, 'module_reorder_failed', 'Unable to reorder modules', {
      meta: { requestId: req.requestId ?? null },
    });
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
app.post('/api/admin/lessons', authenticate, requireOrgAdmin, async (req, res) => {
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
  const moduleId = pickId(parsed, 'module_id', 'moduleId');
  const lessonId = parsed.id ?? randomUUID();
  lessonLogMeta.lessonId = lessonId;
  lessonLogMeta.moduleId = moduleId ?? null;
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

  if (isDemoOrTestMode) {
    try {
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
      if (!resolvedOrgId && !context.isPlatformAdmin) {
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
      };
      prepareLessonContentWithCompletionRule(lesson, completionRule);
      found.module.lessons = found.module.lessons || [];
      found.module.lessons.push(lesson);
      persistE2EStore();
      sendApiResponse(res, lesson, {
        statusCode: 201,
        code: 'lesson_created',
        message: 'Lesson created.',
        meta: { requestId: req.requestId ?? null, moduleId, lessonId: id },
      });
      return;
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
      return;
    }
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
    const payload = prepareLessonPersistencePayload({
      id: lessonId,
      module_id: moduleId,
      organization_id: resolvedOrgId ?? null,
      title,
      type,
      description,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: normalizedContent,
      completionRule,
    });
    // Use array result + firstRow() — .single() throws PGRST116 on duplicate lesson rows.
    const _lessonInsert = await supabase
      .from('lessons')
      .insert(payload)
      .select('*');
    const data = firstRow(_lessonInsert);
    const error = _lessonInsert.error;
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
    sendApiResponse(res, data, {
      statusCode: 201,
      code: 'lesson_created',
      message: 'Lesson created.',
      meta: { requestId: req.requestId ?? null, moduleId, lessonId: data.id },
    });
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

app.patch('/api/admin/lessons/:id', authenticate, requireOrgAdmin, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const lessonLogMeta = buildLessonLogMeta(req, context);

  const parseResult = lessonPatchValidator.safeParse(req.body || {});
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

  if (isDemoOrTestMode) {
    try {
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
      if (!resolvedOrgId && !context.isPlatformAdmin) {
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
      if (typeof title === 'string') found.lesson.title = title;
      if (typeof type === 'string') found.lesson.type = type;
      if (description !== undefined) found.lesson.description = description;
      if (typeof orderIndex === 'number') found.lesson.order_index = orderIndex;
      if (typeof durationSeconds === 'number' || durationSeconds === null) found.lesson.duration_s = durationSeconds;
      if (contentPayload !== undefined) {
        found.lesson.content_json = contentPayload ?? {};
      }
      if (completionRule !== undefined) {
        prepareLessonContentWithCompletionRule(found.lesson, completionRule);
      }
      persistE2EStore();
      sendApiResponse(res, found.lesson, {
        code: 'lesson_updated',
        message: 'Lesson updated.',
        meta: { requestId: req.requestId ?? null, moduleId: found.module?.id ?? null, lessonId: found.lesson.id },
      });
      return;
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
      return;
    }
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
    prepareLessonContentWithCompletionRule(patch, completionRule);
    applyLessonColumnSupport(patch);
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
    sendApiResponse(res, { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 }, {
      code: 'lesson_updated',
      message: 'Lesson updated.',
      meta: { requestId: req.requestId ?? null, moduleId: data.module_id, lessonId: data.id },
    });
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

app.delete('/api/admin/lessons/:id', authenticate, requireOrgAdmin, async (req, res) => {
  if (isDemoOrTestMode) {
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
  const context = requireUserContext(req, res);
  if (!context) return;
  try {
    const { id } = req.params;
    // Resolve the lesson's parent course to enforce org scope
    const { data: lessonRow, error: lessonErr } = await supabase
      .from('lessons')
      .select('id, module_id')
      .eq('id', id)
      .maybeSingle();
    if (lessonErr) throw lessonErr;
    if (!lessonRow) {
      res.status(204).end();
      return;
    }
    if (lessonRow.module_id) {
      const { data: moduleRow, error: moduleErr } = await supabase
        .from('modules')
        .select('id, course_id')
        .eq('id', lessonRow.module_id)
        .maybeSingle();
      if (moduleErr) throw moduleErr;
      if (moduleRow?.course_id) {
        const { data: courseRow, error: courseErr } = await supabase
          .from('courses')
          .select('id, organization_id')
          .eq('id', moduleRow.course_id)
          .maybeSingle();
        if (courseErr) throw courseErr;
        const lessonOrgId = courseRow?.organization_id ?? null;
        if (lessonOrgId) {
          const access = await requireOrgAccess(req, res, lessonOrgId, { write: true, requireOrgAdmin: true });
          if (!access) return;
        } else if (!context.isPlatformAdmin) {
          res.status(403).json({ error: 'organization_required', message: 'Lesson course is not scoped to an organization.' });
          return;
        }
      } else if (!context.isPlatformAdmin) {
        res.status(403).json({ error: 'organization_required', message: 'Lesson module is not scoped to a course.' });
        return;
      }
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'organization_required', message: 'Lesson is not scoped to a module.' });
      return;
    }
    await supabase.from('lessons').delete().eq('id', id);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete lesson:', error);
    res.status(500).json({ error: 'Unable to delete lesson' });
  }
});

app.post('/api/admin/lessons/reorder', authenticate, requireOrgAdmin, async (req, res) => {
  if (isDemoOrTestMode) {
    const parsed = validateOr400(lessonReorderSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessons = parsed.lessons;
    const found = e2eFindModule(moduleId);
    if (!found) {
      sendApiError(res, 404, 'module_not_found', 'Module not found', {
        meta: { requestId: req.requestId ?? null, moduleId },
      });
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
    sendApiResponse(res, response, {
      code: 'lessons_reordered',
      message: 'Lessons reordered.',
      meta: { requestId: req.requestId ?? null, moduleId },
    });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(lessonReorderSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessons = parsed.lessons;
    if (!moduleId || !Array.isArray(lessons)) {
      sendApiError(res, 400, 'validation_failed', 'moduleId and lessons are required', {
        meta: { requestId: req.requestId ?? null },
      });
      return;
    }
    const updates = (lessons || []).map((l) => {
      return supabase.from('lessons').update({ order_index: pickOrder(l) }).eq('id', l.id);
    });
    await Promise.all(updates);
    const order = lessons.map((l) => ({ id: l.id, order_index: pickOrder(l) }));
    sendApiResponse(res, order, {
      code: 'lessons_reordered',
      message: 'Lessons reordered.',
      meta: { requestId: req.requestId ?? null, moduleId },
    });
  } catch (error) {
    console.error('Failed to reorder lessons:', error);
    sendApiError(res, 500, 'lesson_reorder_failed', 'Unable to reorder lessons', {
      meta: { requestId: req.requestId ?? null },
    });
  }
});

// Learner progress endpoint (used by progressService.ts)
app.post('/api/learner/progress', authenticate, asyncHandler(async (req, res) => {
  let snapshot = normalizeSnapshotPayload(req.body || {});

  if (!snapshot) {
    res.status(400).json({
      ok: false,
      code: 'invalid_progress_payload',
      message: 'Invalid progress snapshot payload',
      hint: null,
      requestId: req.requestId ?? null,
      queryName: 'learner_progress_snapshot',
      details: null,
    });
    return;
  }

  const authUserId = req.user?.userId || req.user?.id || null;
  const effectiveUserId = !isDemoMode ? authUserId : authUserId || snapshot.userId || null;

  if (!effectiveUserId) {
    res.status(401).json({
      ok: false,
      code: 'unauthenticated_progress',
      message: 'Missing authenticated user id for progress update',
      hint: null,
      requestId: req.requestId ?? null,
      queryName: 'learner_progress_snapshot',
      details: null,
    });
    return;
  }

  snapshot = {
    ...snapshot,
    userId: effectiveUserId,
  };

  const { userId, courseId } = snapshot;
  let lessonList = Array.isArray(snapshot.lessons) ? snapshot.lessons : [];
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

  const context = requireUserContext(req, res);
  if (!context) return;
  const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
  if (orgScope.requiresExplicitSelection) {
    respondWithError(403, 'org_selection_required', 'Select an organization before saving progress.', null);
    return;
  }
  const resolvedOrgId = orgScope.orgId;
  baseLogMeta.orgId = resolvedOrgId;

  const logSnapshotSuccess = (mode) => {
    logger.debug('learner_progress_snapshot_success', {
      ...baseLogMeta,
      mode,
      completedAt: courseProgress?.completed_at || courseProgress?.completedAt || null,
      overallPercent: courseProgress?.percent ?? null,
    });
  };

  logger.debug('learner_progress_snapshot_received', baseLogMeta);

  const respondWithError = (status, code, message, error, queryName = 'learner_progress_snapshot') => {
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
    res.status(status).json({
      ok: false,
      code,
      message,
      hint: error?.hint ?? null,
      requestId,
      queryName,
      details: error?.details ?? null,
    });
  };

  if (isTestMode) {
    // Only log in E2E test mode, not on every isDemoMode request — too chatty.
    console.log('Progress sync request:', {
      userId,
      courseId,
      lessonCount: lessonList.length,
      overallPercent: courseProgress.percent,
    });
  }

  // Demo/E2E path: persist to in-memory store
  if (isDemoOrTestMode) {
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
          organization_id: resolvedOrgId ?? null,
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
        organization_id: resolvedOrgId ?? null,
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
        ok: true,
        requestId,
        data: {
          userId,
          courseId,
          updatedLessons: lessonList.length,
        },
        meta: {
          mode: 'demo',
        },
      });
    } catch (error) {
      respondWithError(500, 'progress_demo_failed', 'Unable to sync progress in demo mode', error);
    }
    return;
  }

  if (!ensureSupabase(res)) return;

  if (lessonList.length === 0 && courseId) {
    const seedLessonListFromCourse = async () => {
      const extractLessonIds = (modules = []) => {
        const ids = [];
        for (const moduleRecord of Array.isArray(modules) ? modules : []) {
          const lessons = Array.isArray(moduleRecord?.lessons) ? moduleRecord.lessons : [];
          for (const lesson of lessons) {
            const lessonId = lesson?.id ? String(lesson.id) : null;
            if (lessonId) ids.push(lessonId);
          }
        }
        return Array.from(new Set(ids));
      };

      try {
        const moduleQuery = await supabase
          .from('modules')
          .select('id,lessons:lessons(id,order_index)')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true })
          .order('order_index', { ascending: true, foreignTable: 'lessons' });
        if (!moduleQuery.error) {
          const lessonIds = extractLessonIds(moduleQuery.data || []);
          if (lessonIds.length > 0) {
            return lessonIds;
          }
        }
      } catch (_error) {
        // best-effort fallback below
      }

      try {
        const courseQuery = await supabase
          .from('courses')
          .select('id,modules:modules(id,lessons:lessons(id,order_index))')
          .eq('id', courseId)
          .maybeSingle();
        if (!courseQuery.error && courseQuery.data) {
          return extractLessonIds(courseQuery.data.modules || []);
        }
      } catch (_error) {
        // no-op; caller will retain empty lesson list
      }

      return [];
    };

    const seededLessonIds = await seedLessonListFromCourse();
    if (seededLessonIds.length > 0) {
      lessonList = seededLessonIds.map((lessonId) => ({
        lessonId,
        progressPercent: 0,
        completed: false,
        positionSeconds: 0,
        lastAccessedAt: null,
      }));
      baseLogMeta.lessonCount = lessonList.length;
      logger.info('learner_progress_seeded_empty_snapshot', {
        requestId,
        userId,
        courseId,
        seededLessonCount: lessonList.length,
      });
    }
  }

  try {
    const normalizeLessonRecord = (row) => ({
      user_id: row.user_id,
      course_id: row.course_id ?? courseId,
      lesson_id: row.lesson_id,
      percent: clampPercent(Number(row.progress ?? row.percent ?? 0)),
      status: row.completed ? 'completed' : 'in_progress',
      time_spent_s: Math.max(0, Math.round(row.time_spent_seconds ?? row.time_spent_s ?? 0)),
      last_accessed_at: row.updated_at ?? row.created_at ?? nowIso,
      organization_id: row.organization_id ?? row.org_id ?? resolvedOrgId ?? null,
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
      organization_id: resolvedOrgId ?? null,
    });

    const buildLessonPayload = (lesson, { legacy = false } = {}) => {
      const base = {
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.lessonId,
      };
      if (resolvedOrgId) {
        attachLessonOrgScope(base, resolvedOrgId);
      }
      if (legacy) {
        base.percent = clampPercent(lesson.progressPercent);
        base.status = Boolean(lesson.completed ?? lesson.progressPercent >= 100) ? 'completed' : 'in_progress';
        base.time_spent_s = Math.max(0, Math.round(lesson.positionSeconds ?? 0));
        base.updated_at = nowIso;
      } else {
        base.progress = clampPercent(lesson.progressPercent);
        base.completed = Boolean(lesson.completed ?? lesson.progressPercent >= 100);
        base.time_spent_seconds = Math.max(0, Math.round(lesson.positionSeconds ?? 0));
      }
      return base;
    };

    const upsertLessonProgressModern = async () => {
      const payload = lessonList.map((lesson) => buildLessonPayload(lesson, { legacy: false }));
      const { data, error } = await supabase
        .from('user_lesson_progress')
        .upsert(payload, { onConflict: 'user_id,lesson_id' })
        .select('*');
      if (error) {
        if (isMissingColumnError(error)) {
          const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
          if (handleLessonOrgColumnMissing(missingColumn)) {
            return upsertLessonProgressModern();
          }
        }
        throw error;
      }
      return (data || []).map((row) => normalizeLessonRecord(row));
    };

    const upsertLessonProgressLegacy = async () => {
      const payload = lessonList.map((lesson) => buildLessonPayload(lesson, { legacy: true }));
      const { data, error } = await supabase
        .from('user_lesson_progress')
        .upsert(payload, { onConflict: 'user_id,lesson_id' })
        .select('*');
      if (error) {
        if (isMissingColumnError(error)) {
          const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
          if (handleLessonOrgColumnMissing(missingColumn)) {
            return upsertLessonProgressLegacy();
          }
        }
        throw error;
      }
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
        organization_id: resolvedOrgId ?? null,
      };
      try {
        // Use array + firstRow() — .single() throws PGRST116 when duplicate progress rows exist.
        const _r = await supabase
          .from('user_course_progress')
          .upsert(payload, { onConflict: 'user_id_uuid,course_id' })
          .select('*');
        if (_r.error) throw _r.error;
        return firstRow(_r);
      } catch (error) {
        if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
          logger.warn('user_course_progress_uuid_modern_fallback', {
            code: error?.code ?? null,
            message: error?.message ?? null,
          });
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_id_uuid;
          const _fr = await supabase
            .from('user_course_progress')
            .upsert(fallbackPayload, { onConflict: 'user_id,course_id' })
            .select('*');
          if (_fr.error) throw _fr.error;
          return firstRow(_fr);
        }
        throw error;
      }
    };

    const upsertCourseProgressLegacy = async () => {
      const includePercent = schemaSupportFlags.courseProgressPercentColumn !== 'missing';
      const includeTime = schemaSupportFlags.courseProgressTimeColumn !== 'missing';
      const payload = {
        user_id_uuid: userId,
        user_id: userId,
        course_id: courseId,
        status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
        organization_id: resolvedOrgId ?? null,
      };
      if (includePercent) {
        payload.percent = clampPercent(courseProgress.percent);
      }
      if (includeTime) {
        payload.time_spent_s = Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0));
      }
      try {
        // Use array + firstRow() — .single() throws PGRST116 on duplicate rows.
        const _r = await supabase
          .from('user_course_progress')
          .upsert(payload, { onConflict: 'user_id_uuid,course_id' })
          .select('*');
        if (_r.error) throw _r.error;
        return firstRow(_r);
      } catch (error) {
        if (isMissingColumnError(error)) {
          const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
          if (missingColumn) {
            if (missingColumn.toLowerCase() === 'percent' && includePercent) {
              schemaSupportFlags.courseProgressPercentColumn = 'missing';
              logger.warn('course_progress_percent_column_missing', {
                code: error?.code ?? null,
                message: error?.message ?? null,
              });
              return upsertCourseProgressLegacy();
            }
            if ((missingColumn.toLowerCase() === 'time_spent_s' || missingColumn.toLowerCase() === 'time_spent_seconds') && includeTime) {
              schemaSupportFlags.courseProgressTimeColumn = 'missing';
              logger.warn('course_progress_time_column_missing', {
                code: error?.code ?? null,
                message: error?.message ?? null,
              });
              return upsertCourseProgressLegacy();
            }
          }
        }
        if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
          logger.warn('user_course_progress_uuid_legacy_fallback', {
            code: error?.code ?? null,
            message: error?.message ?? null,
          });
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_id_uuid;
          const _fr = await supabase
            .from('user_course_progress')
            .upsert(fallbackPayload, { onConflict: 'user_id,course_id' })
            .select('*');
          if (_fr.error) throw _fr.error;
          return firstRow(_fr);
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
          organization_id: courseRow.organization_id ?? resolvedOrgId ?? null,
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

    // Auto-create certificate when course reaches 100% completion (idempotent).
    const isCourseCompleted =
      (courseProgress?.percent ?? 0) >= 100 ||
      Boolean(courseProgress?.completed) ||
      courseProgress?.status === 'completed';
    const wasAlreadyCompleted =
      courseRow?.completed === true ||
      (courseRow?.progress ?? courseRow?.percent ?? 0) >= 100;

    if (isCourseCompleted && !wasAlreadyCompleted && supabase) {
      // Fire-and-forget: do not block the 202 response
      const certOrgId = resolvedOrgId ?? courseRow?.organization_id ?? null;
      createCertificateIfNotExists(userId, courseId, certOrgId).catch((err) => {
        logger.warn('certificate_auto_create_unhandled', { userId, courseId, message: err?.message });
      });
    }

    logSnapshotSuccess('supabase');

    res.status(202).json({
      ok: true,
      requestId,
      data: {
        userId,
        courseId,
        updatedLessons: lessonRows.length,
      },
      meta: {
        mode: 'supabase',
      },
    });
  } catch (error) {
    if (isMissingColumnError(error)) {
      const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error)) || 'unknown_column';
      logger.warn('learner_progress_schema_missing', {
        ...baseLogMeta,
        missingColumn,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      const completedLessons = lessonList.filter((lesson) =>
        Boolean(lesson.completed ?? lesson.progressPercent >= 100),
      ).length;
      const computedPercent =
        lessonList.length > 0
          ? clampPercent((completedLessons / lessonList.length) * 100)
          : clampPercent(courseProgress.percent);
      res.status(202).json({
        ok: true,
        requestId,
        data: {
          userId,
          courseId,
          computedPercent,
          completedLessons,
          totalLessons: lessonList.length,
        },
        meta: {
          degraded: true,
          reason: 'schema_missing_column',
          missingColumn,
        },
      });
      return;
    }
    const message = error?.message || 'Unable to sync progress';
    respondWithError(500, 'progress_sync_failed', message, error);
  }
}));

// GET learner progress endpoint (fetching progress)
app.get('/api/learner/progress', authenticate, async (req, res) => {
  const requestId = req.requestId ?? null;
  const lessonIds = parseLessonIdsParam(req.query.lessonIds || req.query.lesson_ids);
  const requestedUserId = coerceString(req.query.userId, req.query.user_id, req.query.learnerId, req.query.learner_id);
  const sessionUserId = coerceString(req.user?.userId, req.user?.id);
  const isAdminUser = (req.user?.role || '').toLowerCase() === 'admin';
  const effectiveUserId = requestedUserId || sessionUserId;
  const context = requireUserContext(req, res);
  if (!context) return;
  const resolvedOrgId = resolveOrgIdFromRequest(req, context);

  if (!effectiveUserId) {
    res.status(400).json({
      ok: false,
      code: 'user_id_required',
      message: 'userId is required',
      hint: null,
      requestId,
      queryName: 'learner_progress_fetch',
      details: null,
    });
    return;
  }
  if (lessonIds.length === 0) {
    res.status(400).json({
      ok: false,
      code: 'lesson_ids_required',
      message: 'lessonIds is required',
      hint: null,
      requestId,
      queryName: 'learner_progress_fetch',
      details: null,
    });
    return;
  }

  const normalizedSessionUserId = sessionUserId ? sessionUserId.toLowerCase() : null;
  const normalizedUserId = effectiveUserId.toLowerCase();

  if (!isAdminUser && normalizedSessionUserId && normalizedUserId !== normalizedSessionUserId) {
    res.status(403).json({
      ok: false,
      code: 'forbidden',
      message: 'You can only view your own progress.',
      hint: null,
      requestId,
      queryName: 'learner_progress_fetch',
      details: null,
    });
    return;
  }

  if (isDemoOrTestMode) {
    const lessons = lessonIds.map((lessonId) => {
      const record = e2eStore.lessonProgress.get(`${normalizedUserId}:${lessonId}`) || null;
      return buildLessonRow(lessonId, record);
    });

    res.json({
      ok: true,
      requestId,
      data: {
        lessons,
      },
      meta: {
        mode: 'demo',
      },
    });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    let progressQuery = supabase.from('user_lesson_progress').select('*').eq('user_id', normalizedUserId).in('lesson_id', lessonIds);
    const orgColumn = getLessonProgressOrgColumn();
    if (resolvedOrgId && orgColumn) {
      progressQuery = progressQuery.eq(orgColumn, resolvedOrgId);
    }

    const { data, error } = await progressQuery;

    if (error) throw error;

    const byLessonId = new Map();
    (data || []).forEach((row) => {
      const lessonId = row.lesson_id || row.lessonId;
      if (!lessonId) return;
      byLessonId.set(String(lessonId), buildLessonRow(String(lessonId), row));
    });

    const lessons = lessonIds.map((lessonId) => byLessonId.get(lessonId) || buildLessonRow(lessonId, null));

    res.json({
      ok: true,
      requestId,
      data: {
        lessons,
      },
    });
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      const missingColumn = isMissingColumnError(error)
        ? normalizeColumnIdentifier(extractMissingColumnName(error))
        : null;
      logger.warn('learner_progress_storage_missing', {
        code: error.code ?? null,
        message: error.message ?? null,
        missingColumn,
        requestId: req.requestId ?? null,
      });
      res.json({
        ok: true,
        requestId,
        data: {
          lessons: lessonIds.map((lessonId) => buildLessonRow(lessonId, null)),
        },
        meta: {
          degraded: true,
          reason: isMissingColumnError(error) ? 'schema_missing_column' : 'empty_progress',
          missingColumn,
        },
      });
      return;
    }
    console.error('Failed to fetch learner progress:', error);
    writeErrorDiagnostics(req, error, { meta: { surface: 'learner_progress_commit' } });
    res.status(500).json({
      ok: false,
      code: 'progress_fetch_failed',
      message: 'Unable to fetch progress',
      requestId,
      hint: error?.hint ?? null,
      details: error?.message ?? null,
    });
  }
});

// ─── GET /api/client/progress/summary ──────────────────────────────────────
// Returns real per-learner stats: modulesCompleted/total, overall % progress,
// total time invested (seconds), and certificates earned.
// Falls back to local store data when Supabase is unavailable.
app.get('/api/client/progress/summary', authenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const userId = context.userId;

  // In dev/demo mode the injected user ID may be a non-UUID placeholder.
  // Return an empty but valid summary rather than a DB 22P02 error.
  if (!isUuid(userId) && (isDemoMode)) {
    return res.json({
      data: {
        modulesCompleted: 0,
        modulesTotal: 0,
        overallPercent: 0,
        timeInvestedSeconds: 0,
        certificatesEarned: 0,
        streakDays: 0,
      },
    });
  }

  if (isDemoOrTestMode) {
    let totalPercent = 0;
    let courseCount = 0;
    let completedCourses = 0;
    let totalTimeSeconds = 0;
    for (const [key, record] of e2eStore.courseProgress.entries()) {
      if (!key.startsWith(`${userId}:`)) continue;
      courseCount += 1;
      totalPercent += typeof record.percent === 'number' ? record.percent : 0;
      totalTimeSeconds += typeof record.time_spent_s === 'number' ? record.time_spent_s : 0;
      if ((record.percent ?? 0) >= 100 || record.status === 'completed') completedCourses += 1;
    }
    const overallPercent = courseCount > 0 ? Math.round(totalPercent / courseCount) : 0;
    return res.json({
      data: {
        modulesCompleted: completedCourses,
        modulesTotal: courseCount,
        overallPercent,
        timeInvestedSeconds: totalTimeSeconds,
        certificatesEarned: completedCourses,
        streakDays: 0,
      },
    });
  }

  if (!supabase) {
    return res.status(503).json({ error: 'database_unavailable' });
  }

  try {
    const { data: rows, error } = await supabase
      .from('user_course_progress')
      .select('course_id, progress, status, time_spent_s, updated_at')
      .eq('user_id', userId);

    if (error) throw error;

    const progressRows = rows || [];
    const courseCount = progressRows.length;
    const completedCourses = progressRows.filter(
          (r) => (r.progress ?? 0) >= 100 || r.status === 'completed'
        ).length;
    const totalPercent = progressRows.reduce((sum, r) => sum + (r.progress ?? 0), 0);
    const overallPercent = courseCount > 0 ? Math.round(totalPercent / courseCount) : 0;
    const totalTimeSeconds = progressRows.reduce((sum, r) => sum + (r.time_spent_s ?? 0), 0);    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentDays = new Set(
      progressRows
        .filter((r) => r.updated_at && r.updated_at >= thirtyDaysAgo)
        .map((r) => r.updated_at.slice(0, 10))
    );
    const streakDays = recentDays.size;

    return res.json({
      data: {
        modulesCompleted: completedCourses,
        modulesTotal: courseCount,
        overallPercent,
        timeInvestedSeconds: totalTimeSeconds,
        certificatesEarned: completedCourses,
        streakDays,
      },
    });
  } catch (err) {
    logger.warn('client_progress_summary_failed', { userId, message: err?.message ?? String(err) });
    return res.status(500).json({ error: 'Unable to fetch progress summary' });
  }
});

// ─── GET /api/client/activity ───────────────────────────────────────────────
// Returns recent activity events for the authenticated learner from audit_logs.
app.get('/api/client/activity', authenticate, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const userId = context.userId;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  if (isDemoOrTestMode) {
    const demoActivities = Array.from(e2eStore.auditLogs || [])
      .filter((entry) => entry.user_id === userId || entry.actor_id === userId)
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id ?? `act-${Math.random()}`,
        action: entry.action,
        details: entry.details ?? {},
        userId: entry.user_id ?? null,
        createdAt: entry.created_at ?? new Date().toISOString(),
      }));
    return res.json({ data: demoActivities });
  }

  if (!supabase) {
    return res.status(503).json({ error: 'database_unavailable' });
  }

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, details, user_id, organization_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const activities = (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      details: row.details ?? {},
      userId: row.user_id ?? null,
      organizationId: row.organization_id ?? null,
      createdAt: row.created_at,
    }));

    return res.json({ data: activities });
  } catch (err) {
    logger.warn('client_activity_fetch_failed', { userId, message: err?.message ?? String(err) });
    return res.status(500).json({ error: 'Unable to fetch activity feed' });
  }
});

// ─── GET /api/admin/activity ────────────────────────────────────────────────
// Returns real recent platform events from audit_logs, falling back to
// synthesised events from analytics data in demo/E2E mode.
app.get('/api/admin/activity', authenticate, requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  if (isDemoOrTestMode) {
    const demoActivities = Array.from(e2eStore.auditLogs || [])
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id ?? `act-${Math.random()}`,
        action: entry.action,
        details: entry.details ?? {},
        userId: entry.user_id ?? null,
        organizationId: entry.organization_id ?? null,
        createdAt: entry.created_at ?? new Date().toISOString(),
      }));
    return res.json({ data: demoActivities });
  }

  if (!supabase) {
    return res.status(503).json({ error: 'database_unavailable' });
  }

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, details, user_id, organization_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const activities = (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      details: row.details ?? {},
      userId: row.user_id ?? null,
      organizationId: row.organization_id ?? null,
      createdAt: row.created_at,
    }));

    return res.json({ data: activities });
  } catch (err) {
    logger.warn('admin_activity_fetch_failed', { message: err?.message ?? String(err) });
    return res.status(500).json({ error: 'Unable to fetch activity feed' });
  }
});

app.post('/api/client/progress/course', authenticate, async (req, res) => {
  if (isDemoOrTestMode) {
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

  const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
  if (orgScope.requiresExplicitSelection) {
    res.status(403).json({
      ok: false,
      data: null,
      code: 'org_selection_required',
      message: 'Select an organization before saving course progress.',
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }
  const resolvedOrgId = orgScope.orgId;

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
      organization_id: resolvedOrgId ?? null,
    };
    // Use array + firstRow() — .single() throws PGRST116 on duplicate progress rows.
    const upsertCourseProgress = async (payload, conflictTarget) =>
      supabase.from('user_course_progress').upsert(payload, { onConflict: conflictTarget }).select('*');

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
    const data = firstRow(upsertResult);
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

app.post('/api/client/progress/lesson', authenticate, async (req, res) => {
  if (isDemoOrTestMode) {
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
  const context = requireUserContext(req, res);
  if (!context) return;

  const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
  const clientEventId = req.body?.client_event_id ?? null;

  // Enforce that progress can only be recorded for the authenticated user
  if (user_id && user_id !== context.userId) {
    res.status(403).json({ error: 'forbidden', message: 'Cannot record progress for a different user.' });
    return;
  }
  const resolvedUserId = context.userId;

  if (!resolvedUserId || !lesson_id) {
    res.status(400).json({ error: 'user_id and lesson_id are required' });
    return;
  }

  const rlKey = `lesson:${String(resolvedUserId).toLowerCase()}`;
  if (!checkProgressLimit(rlKey)) {
    res.status(429).json({ error: 'Too many progress updates, please slow down' });
    return;
  }

  const opStart = Date.now();
  try {
    const toApiLessonRecord = (row, fallbackTimeSpent, fallbackResume) => ({
      user_id: row?.user_id ?? resolvedUserId,
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
        await supabase.from('progress_events').insert({ id: clientEventId, user_id: resolvedUserId, course_id: null, lesson_id, payload: req.body });
      } catch (evErr) {
        try {
          const existing = await supabase
            .from('user_lesson_progress')
            .select('*')
            .eq('user_id', resolvedUserId)
            .eq('lesson_id', lesson_id)
            .maybeSingle();
          if (existing && !existing.error && existing.data) {
            res.json({ data: toApiLessonRecord(existing.data, time_spent_s, resume_at_s), idempotent: true });
            return;
          }
        } catch (fetchErr) {
          logger.warn('lesson_progress_idempotency_fetch_failed', {
            lesson_id,
            user_id: resolvedUserId,
            error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          });
        }
      }
    }
    const _lessonProg = await supabase
      .from('user_lesson_progress')
      .upsert({
        user_id: resolvedUserId,
        lesson_id,
        progress: normalizedPercent,
        completed: normalizedCompleted,
        time_spent_seconds: Math.max(0, Math.round(typeof time_spent_s === 'number' ? time_spent_s : 0)),
      }, { onConflict: 'user_id,lesson_id' })
      .select('*');
    const data = firstRow(_lessonProg);
    const error = _lessonProg.error;

    if (error) throw error;
    try {
      const apiRecord = toApiLessonRecord(data, time_spent_s, resume_at_s);
      const userId = apiRecord?.user_id || resolvedUserId;
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
      userId: resolvedUserId,
      lessonId: lesson_id,
      percent: normalizedPercent,
    });

    res.json({ data: toApiLessonRecord(data, time_spent_s, resume_at_s) });
  } catch (error) {
    recordLessonProgress('supabase', Date.now() - opStart, {
      status: 'error',
      userId: resolvedUserId,
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
app.post('/api/client/progress/batch', authenticate, async (req, res) => {
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
  if (isDemoOrTestMode) {
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
          } catch (broadcastErr) {
            logger.warn('ws_broadcast_lesson_progress_failed', { lessonId, error: broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr) });
          }
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
          } catch (broadcastErr) {
            logger.warn('ws_broadcast_course_progress_failed', { courseId, error: broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr) });
          }
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

  const batchContext = requireUserContext(req, res);
  if (!batchContext) return;

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
      user_id: batchContext.userId, // always use authenticated user's ID, never trust payload user_id
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
  const allowHeaderWithoutMembership = req.membershipStatus && req.membershipStatus !== 'ready';
  const headerOrgId = getHeaderOrgId(req, { requireMembership: !allowHeaderWithoutMembership }) || null;
  const cookieOrgId = getActiveOrgFromRequest(req);

  const normalizedEvents = events.map((evt) => {
    const payloadOrgId =
      typeof (evt.org_id ?? evt.orgId) === 'string' ? (evt.org_id ?? evt.orgId).trim() : null;
    const normalizedOrgId = headerOrgId || cookieOrgId || normalizeOrgIdValue(payloadOrgId) || null;
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

  const missingOrgEvents = normalizedEvents.filter((evt) => !isUuid(evt.org_id || ''));
  if (missingOrgEvents.length) {
    const warningKey = req.user?.userId || req.user?.id || `anon:${req.ip ?? 'unknown'}`;
    analyticsOrgWarning(warningKey, {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id || null,
      headerOrgId,
      cookieOrgId,
      membershipStatus: req.membershipStatus || 'unknown',
      missingCount: missingOrgEvents.length,
    });
  }
  const eventsWithOrg = normalizedEvents.filter((evt) => isUuid(evt.org_id || ''));

  if (isDemoOrTestMode) {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of eventsWithOrg) {
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
    res.json({
      accepted,
      duplicates,
      failed,
      meta: {
        skippedMissingOrg: missingOrgEvents.length,
      },
    });
    return;
  }

  // Supabase placeholder: just accept (Phase 3 persistence)
  if (!ensureSupabase(res)) return;
  try {
    const accepted = eventsWithOrg.map(
      (e) => e.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    res.json({
      accepted,
      duplicates: [],
      failed: [],
      meta: {
        skippedMissingOrg: missingOrgEvents.length,
      },
    });
  } catch (error) {
    console.error('Failed to process analytics batch:', error);
    res.status(200).json({
      accepted: [],
      duplicates: [],
      failed: eventsWithOrg.map((evt) => ({
        id: evt.client_event_id || 'unknown',
        reason: 'exception',
      })),
      meta: {
        skippedMissingOrg: missingOrgEvents.length,
      },
    });
  }
});

app.post('/api/client/certificates/:courseId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const certContext = requireUserContext(req, res);
  if (!certContext) return;

  const { courseId } = req.params;
  const { id, user_id, pdf_url, metadata = {} } = req.body || {};

  // Disallow spoofing certificates for other users
  if (user_id && user_id !== certContext.userId) {
    res.status(403).json({ error: 'forbidden', message: 'Cannot create certificate for a different user.' });
    return;
  }
  const resolvedCertUserId = certContext.userId;

  try {
    const _certCreate = await supabase
      .from('certificates')
      .insert({
        id: id ?? undefined,
        user_id: resolvedCertUserId,
        course_id: courseId,
        pdf_url: pdf_url ?? null,
        metadata
      })
      .select('*');

    if (_certCreate.error) throw _certCreate.error;
    res.status(201).json({ data: firstRow(_certCreate) });
  } catch (error) {
    console.error('Failed to create certificate:', error);
    res.status(500).json({ error: 'Unable to create certificate' });
  }
});

app.get('/api/client/certificates', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const getCertContext = requireUserContext(req, res);
  if (!getCertContext) return;

  const { course_id } = req.query;
  // Always scope to the authenticated user — never trust a user_id query param
  const user_id = getCertContext.userId;

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
const REQUIRED_ADMIN_ORG_TABLES = [
  { table: 'organizations', schema: 'public', columns: ['id', 'name', 'status', 'subscription', 'created_at'] },
];

const OPTIONAL_ADMIN_ORG_TABLES = [
  { table: 'organization_memberships', schema: 'public', columns: ['organization_id', 'user_id', 'role', 'status'] },
  { table: 'organization_profiles', schema: 'public', columns: ['organization_id'] },
  { table: 'organization_branding', schema: 'public', columns: ['org_id'] },
];
const loggedOptionalSchemaWarnings = new Set();
const buildMembershipSelect = (...fields) => fields.join(', ');
const withMembershipInvitedEmail = (payload) => payload;

const ensureAdminOrgSchemaOrRespond = async (res, label, meta = {}) => {
  const requestId = meta.requestId ?? null;
  logOrganizationsEvent('schema_guard_check', {
    requestId,
    status: 'start',
    metadata: { label },
  });
  try {
    const requiredStatus = await ensureTablesReady(label, REQUIRED_ADMIN_ORG_TABLES);
    if (!requiredStatus.ok) {
      const failureMetadata = {
        label,
        table: requiredStatus.table ?? null,
        column: requiredStatus.column ?? null,
        schema: requiredStatus.schema ?? null,
        requestId,
      };
      logger.warn('organizations_schema_guard_missing', failureMetadata);
      logOrganizationsEvent('schema_guard_check', {
        requestId,
        status: 'failed',
        metadata: failureMetadata,
      });
      respondSchemaUnavailable(res, label, requiredStatus);
      return false;
    }
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    const payload = {
      label,
      stage: 'schema_guard_required',
      requestId,
      ...normalized,
    };
    emitConsolePayload('[organizations.schema_guard_failed]', payload);
    logger.error('organizations_schema_guard_failed', payload);
    logOrganizationsEvent('schema_guard_check', {
      requestId,
      status: 'error',
      metadata: {
        label,
        code: normalized.code ?? null,
      },
    });
    res.status(500).json({
      error: 'schema_guard_failed',
      code: normalized.code ?? 'schema_guard_failed',
      message: normalized.message ?? 'Unable to verify organization schema.',
      details: normalized.details ?? null,
      requestId,
    });
    return false;
  }

  let optionalWarning = null;
  try {
    const optionalStatus = await ensureTablesReady(label, OPTIONAL_ADMIN_ORG_TABLES);
    if (!optionalStatus.ok) {
      optionalWarning = {
        label,
        table: optionalStatus.table ?? null,
        column: optionalStatus.column ?? null,
        schema: optionalStatus.schema ?? null,
        requestId,
      };
      const warningKey = `${optionalWarning.schema ?? 'public'}.${optionalWarning.table ?? 'unknown'}:${
        optionalWarning.column ?? '*'
      }`;
      if (!loggedOptionalSchemaWarnings.has(warningKey)) {
        loggedOptionalSchemaWarnings.add(warningKey);
        logger.info('organizations_optional_schema_missing', optionalWarning);
      }
    }
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    logger.info('organizations_optional_schema_check_failed', {
      label,
      requestId,
      code: normalized.code ?? null,
      message: normalized.message ?? null,
    });
  }

  logOrganizationsEvent('schema_guard_check', {
    requestId,
    status: optionalWarning ? 'warn' : 'ok',
    metadata: optionalWarning ? optionalWarning : { label },
  });
  return true;
};

const safeSerializeError = (error) => {
  if (!error) return null;
  if (typeof error === 'object') {
    try {
      return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (_err) {
      return {
        message: typeof error.message === 'string' ? error.message : null,
        code: typeof error.code === 'string' ? error.code : null,
      };
    }
  }
  return { message: String(error) };
};

const logOrganizationsStageError = (stage, error, meta = {}) => {
  const normalized = normalizeUnknownError(error);
  const payload = {
    stage,
    ...meta,
    ...normalized,
    rawError: safeSerializeError(error),
  };
  emitConsolePayload('[organizations.stage_error]', payload);
  logger.error('organizations_stage_error', payload);
  return normalized;
};

const logOrganizationsEvent = (event, { requestId = null, status = 'info', metadata = {} } = {}) => {
  const shapedMetadata =
    metadata && typeof metadata === 'object'
      ? metadata
      : metadata === null || typeof metadata === 'undefined'
        ? {}
        : { value: metadata };
  const payload = {
    event,
    requestId,
    status,
    metadata: shapedMetadata,
  };
  logger.info('organizations_event', payload);
};

const logSurveyAssignmentEvent = (event, payload = {}) => {
  logger.info(event, {
    requestId: payload.requestId ?? null,
    surveyId: payload.surveyId ?? null,
    organizationCount: payload.organizationCount ?? 0,
    userCount: payload.userCount ?? 0,
    insertedRowCount: payload.insertedRowCount ?? 0,
    skippedRowCount: payload.skippedRowCount ?? 0,
    invalidTargetIds: payload.invalidTargetIds ?? [],
    metadata: payload.metadata ?? null,
  });
};

const logUsersStageError = (stage, error, meta = {}) => {
  const normalized = normalizeUnknownError(error);
  const payload = {
    stage,
    ...meta,
    ...normalized,
    rawError: safeSerializeError(error),
  };
  emitConsolePayload('[admin.users.stage_error]', payload);
  logger.error('admin_users_stage_error', payload);
  return normalized;
};

app.get('/api/admin/organizations', requireAdminAccess, asyncHandler(async (req, res) => {
  res.set('X-Organizations-Handler', 'express-v4');
  const requestId = req.requestId ?? null;
  const context = requireUserContext(req, res);
  if (!context) return;

  const adminMemberships = Array.isArray(context.memberships)
    ? context.memberships.filter((membership) => hasOrgAdminRole(membership.role) && membership.orgId)
    : [];
  const adminOrgIds = adminMemberships.map((membership) => membership.orgId).filter(Boolean);
  const requestedOrgId = pickOrgId(
    req.query?.orgId,
    req.query?.organizationId,
    req.body?.orgId,
    req.body?.organizationId,
    req.params?.orgId,
  );

  const resolvedRequestedOrgId = requestedOrgId ? await coerceOrgIdentifierToUuid(req, requestedOrgId) : null;
  // Blocker 3: even platform admins must request a valid, resolvable org scope
  if (requestedOrgId && (!resolvedRequestedOrgId || !isUuid(String(resolvedRequestedOrgId).trim()))) {
    res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted.' });
    return;
  }

  const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');
  if (!isPlatformAdmin && adminOrgIds.length === 0) {
    res.status(403).json({ error: 'org_admin_required', message: 'Admin membership required.' });
    return;
  }

  if (!isPlatformAdmin && resolvedRequestedOrgId && !adminOrgIds.includes(resolvedRequestedOrgId)) {
    res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted.' });
    return;
  }
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

  logOrganizationsEvent('request_received', {
    requestId,
    status: 'ok',
    metadata: {
      includeProgress,
      page,
      pageSize,
      search: search || null,
      requestedOrgId: requestedOrgId ?? null,
      isPlatformAdmin,
      source: 'express',
    },
  });

  if (isDemoOrTestMode) {
    const demoOrganizations = buildDemoOrganizations({
      adminOrgIds,
      requestedOrgId,
      search,
      statuses,
      subscriptions,
      sort,
      ascending,
    });
    const totalCount = demoOrganizations.length;
    const safeOrganizations = demoOrganizations.slice(from, to + 1);
    const orgIdsForProgress = safeOrganizations
      .map((org) => org?.id || org?.organization_id || null)
      .filter((orgId) => Boolean(orgId));
    const progressPayload = await buildOrgProgressPayload(orgIdsForProgress, {
      includeProgress: Boolean(includeProgress),
      requestId,
    });
    res.json({
      data: safeOrganizations,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        hasMore: to + 1 < totalCount,
      },
      progress: progressPayload,
      demo: true,
    });
    return;
  }

  if (!ensureSupabase(res)) return;
  const schemaOk = await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.list', {
    requestId,
  });
  if (!schemaOk) return;

  const buildOrgQuery = () => {
    let query = supabase
      .from('organizations')
      .select('*', { count: 'exact' })
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

    if (resolvedRequestedOrgId) {
      const requestedOrgIdString = String(resolvedRequestedOrgId).trim();
      if (isUuid(requestedOrgIdString)) {
        query = query.eq('id', requestedOrgIdString);
      } else {
        query = query.or(`name.eq.${requestedOrgIdString},slug.eq.${requestedOrgIdString}`);
      }
    } else if (!isPlatformAdmin) {
      query = query.in('id', adminOrgIds);
    }
    return query;
  };

  let organizations = [];
  let totalCount = 0;
  try {
    logOrganizationsEvent('base_query_start', { requestId, status: 'start' });
    const result = await runSupabaseQueryWithRetry('admin.organizations.list', () => buildOrgQuery());
    organizations = Array.isArray(result?.data) ? result.data : [];
    totalCount = typeof result?.count === 'number' ? result.count : result?.count ?? 0;
    logOrganizationsEvent('base_query_done', {
      requestId,
      status: 'ok',
      metadata: {
        totalCount,
        returnedCount: organizations.length,
      },
    });
  } catch (error) {
    const normalized = logOrganizationsStageError('base_query', error, {
      requestId,
      includeProgress,
      page,
      pageSize,
    });
    res.status(500).json({
      error: 'Unable to fetch organizations',
      code: normalized.code ?? 'internal_error',
      message: normalized.message ?? 'Unexpected error while loading organizations',
      details: normalized.details ?? null,
      requestId,
    });
    return;
  }

  logOrganizationsEvent('row_transform_start', {
    requestId,
    status: 'start',
    metadata: { sourceCount: organizations.length },
  });
  const safeOrganizations = [];
  organizations.forEach((org, index) => {
    try {
      if (!org || typeof org !== 'object') {
        throw new Error('organization_row_invalid');
      }
      const sanitized = {
        ...org,
        id: org.id ?? null,
        name: org.name ?? null,
        status: org.status ?? null,
        subscription: org.subscription ?? null,
        created_at: org.created_at ?? null,
        updated_at: org.updated_at ?? null,
        organization_id: org.organization_id ?? org.id ?? null,
      };
      safeOrganizations.push(sanitized);
    } catch (rowError) {
      logOrganizationsStageError('row_transform_failed', rowError, {
        requestId,
        index,
        orgId: org?.id ?? null,
      });
    }
  });
  logOrganizationsEvent('row_transform_done', {
    requestId,
    status: 'ok',
    metadata: { returnedCount: safeOrganizations.length },
  });

  const orgIdsForProgress = safeOrganizations
    .map((org) => org?.id || org?.organization_id || null)
    .filter((orgId) => Boolean(orgId));
  const progressPayload = await buildOrgProgressPayload(orgIdsForProgress, {
    includeProgress: Boolean(includeProgress),
    requestId,
  });

  logOrganizationsEvent('response_ready', {
    requestId,
    status: 'ok',
    metadata: {
      count: safeOrganizations.length,
      page,
      pageSize,
      includeProgress,
      orgFilter: requestedOrgId ?? null,
    },
  });

  const responsePayload = {
    data: safeOrganizations,
    pagination: {
      page,
      pageSize,
      total: totalCount || 0,
      hasMore: to + 1 < (totalCount || 0),
    },
    progress: progressPayload,
  };
  res.json(responsePayload);
}));

app.post('/api/admin/organizations', requireAdminAccess, asyncHandler(async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.create', { requestId: req.requestId ?? null }))
  ) {
    return;
  }
  res.set('X-Organizations-Handler', 'express-v4');
  const payload = req.body || {};
  const actor = buildActorFromRequest(req);

  const missingFields = ['name', 'contact_email', 'subscription'].filter((field) => !payload[field]);
  if (missingFields.length) {
    res.status(400).json({
      error: 'validation_failed',
      code: 'org.validation.missing_fields',
      message: 'name, contact_email, and subscription are required',
      details: { missingFields },
    });
    return;
  }

  logOrganizationsEvent('org_create_request_v3', {
    requestId: req.requestId ?? null,
    status: 'start',
    metadata: {
      name: payload.name ?? null,
      subscription: payload.subscription ?? null,
      source: 'express',
    },
  });
  logOrganizationsEvent('org_create_request_v2', {
    requestId: req.requestId ?? null,
    status: 'start',
    metadata: {
      name: payload.name ?? null,
      subscription: payload.subscription ?? null,
    },
  });

  const ownerInput = payload.owner || {};
  const resolveOwnerString = (...values) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  };
  const ownerEmail = resolveOwnerString(
    payload.ownerEmail,
    payload.owner_email,
    ownerInput.email,
    ownerInput.emailAddress,
    payload.contactEmail,
    payload.contact_email,
  ).toLowerCase();
  const ownerName =
    resolveOwnerString(ownerInput.name, payload.ownerName, payload.owner_name, payload.contactPerson) || null;
  const desiredSlug = payload.slug ?? payload.name;
  const resolvedSlug = await ensureUniqueOrgSlug(desiredSlug);

  try {
    const result = await runSupabaseQueryWithRetry('admin.organizations.create', () =>
      supabase.from('organizations').insert({
        id: payload.id ?? undefined,
        name: payload.name,
        slug: resolvedSlug,
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
      }).select('*'),
    );

    // firstRow() — tolerates duplicate org rows without PGRST116
    const orgData = firstRow(result);
    logOrganizationsEvent('org_create_success', {
      requestId: req.requestId ?? null,
      status: 'ok',
      metadata: { orgId: orgData?.id ?? null },
    });
    logOrganizationsEvent('create_success', {
      requestId: req.requestId ?? null,
      status: 'ok',
      metadata: { orgId: orgData?.id ?? null },
    });
    if (orgData?.id && ownerEmail) {
      try {
        await seedOrgOwner({
          orgId: orgData.id,
          orgName: orgData.name,
          ownerEmail,
          ownerName,
          actor,
          requestId: req.requestId ?? null,
        });
      } catch (seedError) {
        logger.warn('organization_owner_seed_error', {
          orgId: orgData.id,
          targetEmail: ownerEmail,
          message: seedError?.message ?? String(seedError),
        });
      }
    }
    res.status(201).json({ data: orgData });
  } catch (error) {
    const normalized = logOrganizationsStageError('create_failed', error, {
      requestId: req.requestId ?? null,
    });
    logOrganizationsEvent('create_failed', {
      requestId: req.requestId ?? null,
      status: 'failed',
      metadata: { code: normalized.code ?? null },
    });
    const statusCode = normalized.code === '23505' ? 409 : 500;
    res.status(statusCode).json({
      error: 'Unable to create organization',
      code: normalized.code ?? 'internal_error',
      message: normalized.message ?? 'Unexpected error while creating organization',
      details: normalized.details ?? null,
      requestId: req.requestId ?? null,
    });
  }
}));

app.get('/api/admin/organizations/:id', requireAdminAccess, async (req, res) => {
  const requestId = req.requestId ?? null;
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.detail', { requestId }))) {
    return;
  }
  const { id } = req.params;

  const access = await requireOrgAccess(req, res, id, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const payload = await buildOrganizationProfilePayload(id, { requestId });
    if (!payload) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    logOrganizationsEvent('organization_profile_loaded', {
      requestId,
      status: 'ok',
      metadata: { orgId: id },
    });
    res.json({ data: payload });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:id', error);
    logOrganizationsEvent('organization_profile_failed', {
      requestId,
      status: 'failed',
      metadata: { orgId: id, message: error?.message ?? null },
    });
    res.status(500).json({
      error: 'Unable to fetch organization',
      requestId,
    });
  }
});

app.put('/api/admin/organizations/:id', requireAdminAccess, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.update', { requestId: req.requestId ?? null }))
  ) {
    return;
  }
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

    const result = await runTimedQuery('admin.organizations.update', () =>
      supabase.from('organizations').update(updatePayload).eq('id', id).select('*'),
    );
    const orgRow = firstRow(result);
    if (!orgRow) {
      res.status(404).json({ error: 'organization_not_found', message: 'Organization not found or no rows updated' });
      return;
    }
    res.json({ data: orgRow });
  } catch (error) {
    logRouteError('PUT /api/admin/organizations/:id', error);
    res.status(500).json({ error: 'Unable to update organization' });
  }
});

app.delete('/api/admin/organizations/:id', requireAdminAccess, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.delete', { requestId: req.requestId ?? null }))
  ) {
    return;
  }
  const { id } = req.params;

  const access = await requireOrgAccess(req, res, id, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    await runOptionalCleanupMutation(
      'delete_org.assignments',
      () => supabase.from('assignments').delete().eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.assignments.org_id',
      () => supabase.from('assignments').delete().eq('org_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.survey_assignments',
      () => supabase.from('survey_assignments').delete().eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.survey_assignments.org_id',
      () => supabase.from('survey_assignments').delete().eq('org_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.org_invites',
      async () => {
        const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
        return supabase.from('org_invites').delete().eq(inviteOrgColumn, id);
      },
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.organization_memberships',
      () => supabase.from('organization_memberships').delete().eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.message_logs.organization_id',
      () => supabase.from('message_logs').delete().eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.message_logs.org_id',
      () => supabase.from('message_logs').delete().eq('org_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.organization_profiles',
      () => supabase.from('organization_profiles').delete().eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.organization_branding',
      () => supabase.from('organization_branding').delete().eq('org_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.organization_contacts',
      () => supabase.from('organization_contacts').delete().eq('org_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.user_profiles_org_null',
      () =>
        supabase
          .from('user_profiles')
          .update({ organization_id: null })
          .eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );
    await runOptionalCleanupMutation(
      'delete_org.user_profiles',
      () =>
        supabase
          .from('user_profiles')
          .update({ organization_id: null })
          .eq('organization_id', id),
      { orgId: id, requestId: req.requestId ?? null },
    );

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
app.get('/api/admin/organizations/:orgId/members', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.list', {
      requestId: req.requestId ?? null,
    }))
  ) {
    return;
  }
  const { orgId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
    const statusColumn = await getOrganizationMembershipsStatusColumnName();
    let query = supabase
      .from('organization_memberships')
      .select(
        buildMembershipSelect(
          'id',
          'user_id',
          'role',
          'status',
          'is_active',
          'invited_by',
          'created_at',
          'updated_at',
        ),
      )
      .eq(membershipOrgColumn, orgId);

    if (statusColumn === 'is_active') {
      query = query.eq('is_active', true);
    } else {
      query = query.in('status', ['active', 'pending']);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:orgId/members', error);
    res.status(500).json({ error: 'Unable to load organization members' });
  }
});

app.post('/api/admin/organizations/:orgId/members', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.create', {
      requestId: req.requestId ?? null,
    }))
  ) {
    return;
  }
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
    const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
    const normalizedRole = String(role || 'member').toLowerCase();
    const normalizedStatus = (() => {
      const candidate = String(status || '').toLowerCase();
      if (['pending', 'active', 'revoked'].includes(candidate)) {
        return candidate;
      }
      return 'pending';
    })();
    const payload = withMembershipInvitedEmail({
      user_id: userId,
      role: normalizedRole,
      invited_by: context.userId ?? null,
      status: normalizedStatus,
    }, inviteEmail ?? null);
    payload[membershipOrgColumn] = orgId;
    if (membershipOrgColumn === 'organization_id') {
      payload.org_id = String(orgId);
    }

    const membershipSelect = buildMembershipSelect(
      'id', 'organization_id', 'org_id', 'user_id', 'role', 'status',
      'invited_by', 'created_at', 'updated_at',
    );

    let memberData, memberError;
    // Use array result + firstRow() — .single() throws PGRST116 when duplicate memberships exist.
    let _memberResult = await supabase
      .from('organization_memberships')
      .upsert(payload, { onConflict: `${membershipOrgColumn},user_id` })
      .select(membershipSelect);
    memberData = firstRow(_memberResult);
    memberError = _memberResult.error;

    if (memberError && isMembershipConflictTargetError(memberError) && membershipOrgColumn !== 'org_id') {
      logger.warn('add_member_conflict_target_fallback', {
        primaryColumn: membershipOrgColumn, orgId, userId,
        error: memberError?.message,
      });
      _memberResult = await supabase
        .from('organization_memberships')
        .upsert({ ...payload, org_id: String(orgId) }, { onConflict: 'org_id,user_id' })
        .select(membershipSelect);
      memberData = firstRow(_memberResult);
      memberError = _memberResult.error;
    }

    if (memberError) throw memberError;

    // Invalidate stale cached membership so the new role takes effect immediately.
    try {
      invalidateMembershipCache(userId, { orgId });
    } catch (_) {}

    res.status(201).json({ ok: true, data: memberData });
  } catch (error) {
    logRouteError('POST /api/admin/organizations/:orgId/members', error);
    res.status(500).json({ error: 'Unable to add organization member' });
  }
});

app.patch('/api/admin/organizations/:orgId/members/:membershipId', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.update', {
      requestId: req.requestId ?? null,
    }))
  ) {
    return;
  }
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
    const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
    const { data: existing, error: existingError } = await supabase
      .from('organization_memberships')
      .select('id, organization_id, org_id, role, status, user_id')
      .eq('id', membershipId)
      .eq(membershipOrgColumn, orgId)
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
    }

    const roleIsChangingFromOwner =
      existing.role === 'owner' && updatePayload.role && updatePayload.role !== 'owner';
    const statusRevokingOwner = existing.role === 'owner' && updatePayload.status === 'revoked';

    if (roleIsChangingFromOwner || statusRevokingOwner) {
      const { count, error: countError } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq(membershipOrgColumn, orgId)
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
      .eq(membershipOrgColumn, orgId)
      .select(
        buildMembershipSelect(
          'id',
          'organization_id',
          'org_id',
          'user_id',
          'role',
          'status',
          'invited_by',
          'created_at',
          'updated_at',
        ),
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Membership not found after update' });
      return;
    }

    // Invalidate cache for the affected user AND the entire org so no instance
    // serves a stale role beyond the TTL window.
    try {
      const affectedUserId = data.user_id ?? existing.user_id ?? null;
      invalidateMembershipCache(affectedUserId, { orgId });
    } catch (_) {}

    res.json({ ok: true, data });
  } catch (error) {
    logRouteError('PATCH /api/admin/organizations/:orgId/members/:membershipId', error);
    res.status(500).json({ error: 'Unable to update organization member' });
  }
});

app.delete('/api/admin/organizations/:orgId/members/:membershipId', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.members.delete', {
      requestId: req.requestId ?? null,
    }))
  ) {
    return;
  }
  const { orgId, membershipId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const existing = await supabase
      .from('organization_memberships')
      .select('id, organization_id, org_id, user_id, role')
      .eq('id', membershipId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const membership = existing.data;

    if (!membership) {
      res.status(204).end();
      return;
    }

    const membershipOrgId = membership.organization_id ?? membership.org_id ?? null;
    if (membershipOrgId !== orgId) {
      res.status(400).json({ error: 'Membership does not belong to organization' });
      return;
    }

    const access = await requireOrgAccess(req, res, orgId, { write: true });
    if (!access) return;

    const { error } = await supabase
      .from('organization_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;

    // Invalidate cache so the removed member can no longer access org resources.
    try {
      const affectedUserId = membership.user_id ?? null;
      invalidateMembershipCache(affectedUserId, { orgId });
    } catch (_) {}

    res.status(204).end();
  } catch (error) {
    logRouteError('DELETE /api/admin/organizations/:orgId/members/:membershipId', error);
    res.status(500).json({ error: 'Unable to remove organization member' });
  }
});

app.get('/api/admin/organizations/:orgId/users', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (
    !(await ensureAdminOrgSchemaOrRespond(res, 'admin.organizations.users.list', {
      requestId: req.requestId ?? null,
    }))
  ) {
    return;
  }
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

app.post('/api/admin/organizations/:orgId/invites', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const { email, role = 'member', metadata = {}, sendEmail = true, note: noteInput } = req.body || {};

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
      .select('id,name,slug,contact_email')
      .eq('id', orgId)
      .maybeSingle();

    const actor = buildActorFromRequest(req);
    const inviteNote = normalizeInviteNote(noteInput);
    const { invite, duplicate } = await createOrgInvite({
      orgId,
      email: normalizedEmail,
      role,
      inviter: actor,
      orgName: orgRow?.name ?? null,
      metadata,
      sendEmail,
      duplicateStrategy: 'return',
      note: inviteNote,
      requestId: req.requestId ?? null,
    });

    logOrganizationsEvent('organization_invite_created', {
      requestId: req.requestId ?? null,
      status: duplicate ? 'duplicate' : 'created',
      metadata: {
        orgId,
        inviteId: invite?.id ?? null,
        email: invite?.email ?? normalizedEmail,
      },
    });

    res.status(201).json({
      data: buildPublicInvitePayload(invite, orgRow || null, null, orgRow?.contact_email ?? null),
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

app.get('/api/admin/organizations/:orgId/invites', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const invites = await fetchOrgInvites(orgId, { requestId: req.requestId ?? null });
    res.json({ data: invites });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:orgId/invites', error);
    res.status(500).json({ error: 'Unable to load organization invites' });
  }
});

app.post('/api/admin/organizations/:orgId/invites/bulk', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  const entries = Array.isArray(req.body?.invites) ? req.body.invites : [];
  if (!entries.length) {
    res.status(400).json({ error: 'invites_required', message: 'Provide at least one invite.' });
    return;
  }

  const actor = buildActorFromRequest(req);
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
      const entryNote = normalizeInviteNote(entry?.note);
      const { invite, duplicate } = await createOrgInvite({
        orgId,
        email,
        role: normalizeOrgRole(entry?.role || 'member'),
        inviter: actor,
        orgName,
        metadata: entry?.metadata || {},
        sendEmail: entry?.sendEmail !== false,
        note: entryNote,
        requestId: req.requestId ?? null,
      });
      results.push({ email: invite.email, id: invite.id, duplicate });
    } catch (error) {
      results.push({ email, error: error.message });
    }
  }

  await markActivationStep(orgId, 'invite_team', { status: 'in_progress', actor });
  logOrganizationsEvent('organization_invite_bulk', {
    requestId: req.requestId ?? null,
    metadata: { orgId, count: results.length },
  });
  res.status(201).json({ results });
});

app.post('/api/admin/organizations/:orgId/invites/:inviteId/resend', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  const actor = buildActorFromRequest(req);
  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { data: invite, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq('id', inviteId)
      .eq(inviteOrgColumn, orgId)
      .maybeSingle();

    if (error) throw error;
    const normalizedInvite = normalizeOrgInviteRow(invite);
    if (!normalizedInvite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    if (normalizedInvite.status === 'accepted' || normalizedInvite.status === 'revoked') {
      res.status(400).json({ error: 'Invite can no longer be resent' });
      return;
    }

    const orgSummary = await fetchOrganizationSummary(orgId);
    const updated = await deliverInviteEmail(normalizedInvite, { orgName: orgSummary?.name || '', inviterName: actor.name });
    await recordActivationEvent(orgId, 'invite_resent', { inviteId }, actor);
    logOrganizationsEvent('organization_invite_resent', {
      requestId: req.requestId ?? null,
      metadata: { orgId, inviteId },
    });
    res.json({ data: updated });
  } catch (error) {
    logRouteError('POST /api/admin/organizations/:orgId/invites/:inviteId/resend', error);
    res.status(500).json({ error: 'Unable to resend invite' });
  }
});

app.post('/api/admin/organizations/:orgId/invites/:inviteId/remind', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  const actor = buildActorFromRequest(req);
  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { data: invite, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq('id', inviteId)
      .eq(inviteOrgColumn, orgId)
      .maybeSingle();

    if (error) throw error;
    const normalizedInvite = normalizeOrgInviteRow(invite);
    if (!normalizedInvite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    const derivedStatus = deriveInviteStatus(normalizedInvite);
    if (derivedStatus === 'accepted' || derivedStatus === 'revoked') {
      res.status(400).json({ error: 'Invite can no longer be reminded' });
      return;
    }

    const reminderCount = normalizedInvite.reminder_count || 0;
    if (reminderCount >= INVITE_REMINDER_MAX_SENDS) {
      res.status(429).json({ error: 'reminder_limit_reached' });
      return;
    }

    const lastTouch = normalizedInvite.created_at;
    const minGapMs = INVITE_REMINDER_LOOKBACK_HOURS * 60 * 60 * 1000;
    if (lastTouch && minGapMs > 0) {
      const elapsed = Date.now() - new Date(lastTouch).getTime();
      if (elapsed < minGapMs) {
        res.status(429).json({ error: 'reminder_too_soon', retryAfterMs: Math.max(minGapMs - elapsed, 0) });
        return;
      }
    }

    const orgSummary = await fetchOrganizationSummary(orgId);
    const updated = await deliverInviteEmail(normalizedInvite, { orgName: orgSummary?.name || '', inviterName: actor.name });
    await recordActivationEvent(orgId, 'invite_reminder_sent', { inviteId }, actor);
    logOrganizationsEvent('organization_invite_reminder_sent', {
      requestId: req.requestId ?? null,
      metadata: {
        orgId,
        inviteId,
        reminderCount: (updated?.reminder_count ?? reminderCount) || reminderCount + 1,
      },
    });
    res.json({ data: updated, reminder: true });
  } catch (error) {
    logRouteError('POST /api/admin/organizations/:orgId/invites/:inviteId/remind', error);
    res.status(500).json({ error: 'Unable to send reminder' });
  }
});

app.delete('/api/admin/organizations/:orgId/invites/:inviteId', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { error } = await supabase
      .from('org_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq(inviteOrgColumn, orgId);
    if (error) throw error;
    await recordActivationEvent(orgId, 'invite_revoked', { inviteId }, buildActorFromRequest(req));
    logOrganizationsEvent('organization_invite_revoked', {
      requestId: req.requestId ?? null,
      metadata: { orgId, inviteId },
    });
    res.status(204).end();
  } catch (error) {
    logRouteError('DELETE /api/admin/organizations/:orgId/invites/:inviteId', error);
    res.status(500).json({ error: 'Unable to revoke invite' });
  }
});

app.get('/api/admin/organizations/:orgId/messages', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
  if (!access) return;

  try {
    const limit = Number(req.query?.limit ?? 25) || 25;
    const data = await fetchOrgMessages(orgId, { limit });
    res.json({ data });
  } catch (error) {
    logRouteError('GET /api/admin/organizations/:orgId/messages', error);
    res.status(500).json({ error: 'Unable to load organization messages' });
  }
});

app.post('/api/admin/organizations/:orgId/messages', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
  if (!access) return;

  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const channel = req.body?.channel ?? req.body?.delivery ?? 'email';
  const recipients =
    Array.isArray(req.body?.recipients) && req.body.recipients.length
      ? req.body.recipients
      : typeof req.body?.recipients === 'string'
        ? req.body.recipients.split(/[\n,;]/).map((value) => value.trim())
        : [];

  if (!body) {
    res.status(400).json({ error: 'message_body_required', message: 'Message body is required.' });
    return;
  }

  try {
    const actor = buildActorFromRequest(req);
    const record = await sendOrganizationMessage({
      orgId,
      subject,
      body,
      channel,
      recipients,
      actor,
      requestId: req.requestId ?? null,
    });
    res.status(201).json({ data: mapOrgMessageRecord(record) });
  } catch (error) {
    if (error?.message === 'message_recipients_required') {
      res.status(400).json({ error: 'message_recipients_required', message: 'No recipient emails available for this organization.' });
      return;
    }
    if (error?.message === 'message_body_required') {
      res.status(400).json({ error: 'message_body_required', message: 'Message body is required.' });
      return;
    }
    logRouteError('POST /api/admin/organizations/:orgId/messages', error);
    logOrganizationsEvent('organization_message_failed', {
      requestId: req.requestId ?? null,
      status: 'failed',
      metadata: {
        orgId,
        channel: req.body?.channel ?? req.body?.delivery ?? 'email',
        message: error?.message ?? null,
      },
    });
    res.status(500).json({ error: 'Unable to send organization message' });
  }
});

app.get('/api/admin/users/:userId/messages', requireAdminAccess, asyncHandler(async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { userId } = req.params;
  const limit = Number(req.query?.limit ?? 25) || 25;
  const data = await fetchUserMessages(userId, { limit });
  res.json({ data });
}));

app.post('/api/admin/users/:userId/messages', requireAdminAccess, asyncHandler(async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { userId } = req.params;
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const channel = req.body?.channel || 'email';
  const organizationId = req.body?.organizationId || null;
  const recipients =
    Array.isArray(req.body?.recipients) && req.body.recipients.length
      ? req.body.recipients
      : typeof req.body?.recipients === 'string'
        ? req.body.recipients.split(/[\n,;]/).map((value) => value.trim())
        : [];

  if (!body) {
    res.status(400).json({ error: 'message_body_required', message: 'Message body is required.' });
    return;
  }

  try {
    const actor = buildActorFromRequest(req);
    const record = await sendUserMessage({
      userId,
      organizationId,
      subject,
      body,
      channel,
      recipients,
      actor,
      requestId: req.requestId ?? null,
    });
    res.status(201).json({ data: mapOrgMessageRecord(record) });
  } catch (error) {
    if (error?.message === 'message_recipients_required') {
      res.status(400).json({ error: 'message_recipients_required', message: 'No email found for this user.' });
      return;
    }
    if (error?.message === 'message_body_required') {
      res.status(400).json({ error: 'message_body_required', message: 'Message body is required.' });
      return;
    }
    logRouteError('POST /api/admin/users/:userId/messages', error);
    res.status(500).json({ error: 'Unable to send user message' });
  }
}));

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
    const orgSummary = await fetchOrganizationSummary(invite.organization_id);
    const assignmentPreview = await buildInviteAssignmentPreview(invite.organization_id, { perTypeLimit: 3 });
    res.json({
      data: buildPublicInvitePayload(
        invite,
        orgSummary,
        assignmentPreview,
        orgSummary?.contact_email ?? null,
      ),
    });
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

  let inviteRecord = null;
  try {
    inviteRecord = await loadInviteByToken(token);
    if (!inviteRecord) {
      res.status(404).json({ error: 'invite_not_found' });
      return;
    }

    const derivedStatus = deriveInviteStatus(inviteRecord);
    if (!INVITE_ACCEPTABLE_STATUSES.has(derivedStatus)) {
      res.status(409).json({ error: 'invite_unavailable', status: derivedStatus });
      return;
    }

    const orgSummary = await fetchOrganizationSummary(inviteRecord.organization_id);
    const fullName = (req.body?.fullName || inviteRecord.invited_name || '').trim();
    const password = req.body?.password ? String(req.body.password) : '';

    let authUser = null;
    try {
      authUser = await findAuthUserByEmail(inviteRecord.email, {
        requestId: req.requestId ?? null,
        logPrefix: 'invite_accept_lookup',
      });
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
        email: inviteRecord.email,
        password,
        email_confirm: true,
        user_metadata: buildAuthUserMetadata({
          firstName: fullName ? fullName.split(/\s+/).slice(0, -1).join(' ') || fullName.split(/\s+/)[0] || '' : '',
          lastName: fullName ? fullName.split(/\s+/).slice(1).join(' ') : '',
          orgId: inviteRecord.organization_id,
          extra: {
            full_name: fullName || inviteRecord.invited_name || null,
          },
        }),
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
      name: fullName || authUser.user_metadata?.full_name || inviteRecord.email,
    };

    await upsertOrganizationMembership(inviteRecord.organization_id, authUser.id, normalizeOrgRole(inviteRecord.role), actor);

    // Invalidate so the accepted membership is immediately visible.
    try { invalidateMembershipCache(authUser.id, { orgId: inviteRecord.organization_id }); } catch (_) {}

    const nowIso = new Date().toISOString();
    await supabase
      .from('org_invites')
      .update({ status: 'accepted', accepted_at: nowIso })
      .eq('id', inviteRecord.id);

    await recordActivationEvent(inviteRecord.organization_id, 'invite_accepted_public', { inviteId: inviteRecord.id }, actor);
    await createAuditLogEntry('org_invite_accepted', { inviteId: inviteRecord.id }, { userId: authUser.id, orgId: inviteRecord.organization_id });

    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { count: remainingInvites } = await supabase
      .from('org_invites')
      .select('id', { count: 'exact', head: true })
      .eq(inviteOrgColumn, inviteRecord.organization_id)
      .in('status', ['pending', 'sent']);

    if (!remainingInvites) {
      await markActivationStep(inviteRecord.organization_id, 'invite_team', { status: 'completed', actor });
    } else {
      await markActivationStep(inviteRecord.organization_id, 'invite_team', { status: 'in_progress', actor });
    }

    res.json({
      data: {
        status: 'accepted',
        orgId: inviteRecord.organization_id,
        orgName: orgSummary?.name || null,
        email: inviteRecord.email,
        loginUrl: INVITE_LOGIN_URL,
      },
    });
    logOrganizationsEvent('organization_invite_accepted', {
      requestId: req.requestId ?? null,
      status: 'ok',
      metadata: {
        inviteId: inviteRecord.id,
        orgId: inviteRecord.organization_id,
        userId: authUser.id,
      },
    });
    logOrganizationsEvent('organization_login_completed', {
      requestId: req.requestId ?? null,
      status: 'ok',
      metadata: {
        orgId: inviteRecord.organization_id,
        userId: authUser.id,
      },
    });
  } catch (error) {
    logger.error('invite_accept_failed', { message: error?.message || String(error) });
    logOrganizationsEvent('organization_invite_failed', {
      requestId: req.requestId ?? null,
      status: 'failed',
      metadata: {
        orgId: inviteRecord?.organization_id ?? null,
        inviteId: inviteRecord?.id ?? null,
        message: error?.message ?? null,
      },
    });
    res.status(500).json({ error: 'Unable to accept invite' });
  }
});

// ---------------------------------------------------------------------------
// Client onboarding orchestration
// ---------------------------------------------------------------------------

app.post('/api/admin/onboarding/orgs', authenticate, requireAdmin, async (req, res) => {
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

    const _orgOnboard = await supabase
      .from('organizations')
      .insert(orgInsert)
      .select('*');

    if (_orgOnboard.error) throw _orgOnboard.error;
    const org = firstRow(_orgOnboard);
    if (!org) throw new Error('org_insert_no_rows');

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
        requestId: req.requestId ?? null,
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
          requestId: req.requestId ?? null,
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
          note: normalizeInviteNote(invite.note),
          requestId: req.requestId ?? null,
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

app.get('/api/admin/onboarding/:orgId/invites', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access) return;

  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { data, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq(inviteOrgColumn, orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: (data || []).map((invite) => normalizeOrgInviteRow(invite)) });
  } catch (error) {
    console.error('Failed to list org invites', error);
    res.status(500).json({ error: 'Unable to fetch invites' });
  }
});

app.post('/api/admin/onboarding/:orgId/invites', authenticate, requireOrgAdmin, async (req, res) => {
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

  const note = normalizeInviteNote(body.note);
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
      note,
      requestId: req.requestId ?? null,
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

app.post('/api/admin/onboarding/:orgId/invites/bulk', authenticate, requireOrgAdmin, async (req, res) => {
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
      const entryNote = normalizeInviteNote(entry?.note);
      const { invite, duplicate } = await createOrgInvite({
        orgId,
        email,
        role: normalizeOrgRole(entry?.role || 'member'),
        inviter: actor,
        orgName,
        metadata: entry?.metadata || {},
        sendEmail: entry?.sendEmail !== false,
        note: entryNote,
        requestId: req.requestId ?? null,
      });
      results.push({ email: invite.email, id: invite.id, duplicate });
    } catch (error) {
      results.push({ email, error: error.message });
    }
  }

  await markActivationStep(orgId, 'invite_team', { status: 'in_progress', actor });
  res.status(201).json({ results });
});

app.post('/api/admin/onboarding/:orgId/invites/:inviteId/resend', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;
  const actor = buildActorFromRequest(req);

  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { data: invite, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq('id', inviteId)
      .eq(inviteOrgColumn, orgId)
      .maybeSingle();

    if (error) throw error;
    const normalizedInvite = normalizeOrgInviteRow(invite);
    if (!normalizedInvite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    if (normalizedInvite.status === 'accepted' || normalizedInvite.status === 'revoked') {
      res.status(400).json({ error: 'Invite can no longer be resent' });
      return;
    }

    const orgSummary = await fetchOrganizationSummary(orgId);
    const updated = await deliverInviteEmail(normalizedInvite, { orgName: orgSummary?.name || '', inviterName: actor.name });
    await recordActivationEvent(orgId, 'invite_resent', { inviteId }, actor);
    res.json({ data: updated });
  } catch (error) {
    console.error('Failed to resend invite', error);
    res.status(500).json({ error: 'Unable to resend invite' });
  }
});

app.delete('/api/admin/onboarding/:orgId/invites/:inviteId', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, inviteId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
    const { error } = await supabase
      .from('org_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq(inviteOrgColumn, orgId);
    if (error) throw error;
    await recordActivationEvent(orgId, 'invite_revoked', { inviteId }, buildActorFromRequest(req));
    res.status(204).end();
  } catch (error) {
    console.error('Failed to revoke invite', error);
    res.status(500).json({ error: 'Unable to revoke invite' });
  }
});

app.get('/api/admin/onboarding/:orgId/progress', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access) return;

  const progress = await fetchOnboardingProgress(orgId);
  res.json({ data: progress });
});

app.patch('/api/admin/onboarding/:orgId/steps/:stepId', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, stepId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  const status = req.body?.status;
  if (!['pending', 'in_progress', 'completed', 'blocked'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  try {
    await markActivationStep(orgId, stepId, { status, actor: buildActorFromRequest(req) });
    const progress = await fetchOnboardingProgress(orgId);
    logOrganizationsEvent('organization_onboarding_status_updated', {
      requestId: req.requestId ?? null,
      status: 'ok',
      metadata: {
        orgId,
        stepId,
        status,
      },
    });
    res.json({ data: progress });
  } catch (error) {
    logRouteError('PATCH /api/admin/onboarding/:orgId/steps/:stepId', error);
    logOrganizationsEvent('organization_onboarding_status_updated', {
      requestId: req.requestId ?? null,
      status: 'failed',
      metadata: {
        orgId,
        stepId,
        status,
        message: error?.message ?? null,
      },
    });
    res.status(500).json({ error: 'Unable to update onboarding step' });
  }
});

app.post('/api/orgs/:orgId/memberships/accept', authenticate, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const now = new Date().toISOString();

    const { error: deactivateOthersError } = await supabase
      .from('organization_memberships')
      .update({ status: 'inactive', is_active: false, last_seen_at: now })
      .eq('user_id', context.userId)
      .neq('organization_id', orgId)
      .eq('is_active', true);
    if (deactivateOthersError) throw deactivateOthersError;

    const { data, error } = await supabase
      .from('organization_memberships')
      .update({ status: 'active', is_active: true, accepted_at: now, last_seen_at: now })
      .eq('organization_id', orgId)
      .eq('user_id', context.userId)
      .select(buildMembershipSelect('id', 'organization_id', 'user_id', 'role', 'status', 'accepted_at', 'last_seen_at'))
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (req.user?.email) {
      try {
        const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
        await supabase
          .from('org_invites')
          .update({ status: 'accepted' })
          .eq(inviteOrgColumn, orgId)
          .eq('email', req.user.email.toLowerCase())
          .in('status', ['pending', 'sent']);
      } catch (inviteError) {
        console.warn('[onboarding] Failed to sync invite acceptance', inviteError);
      }
      const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
      const { count } = await supabase
        .from('org_invites')
        .select('id', { count: 'exact', head: true })
        .eq(inviteOrgColumn, orgId)
        .in('status', ['pending', 'sent']);
      const actor = buildActorFromRequest(req);
      await recordActivationEvent(orgId, 'invite_accepted', { membershipId: data.id }, actor);
      if (!count || count === 0) {
        await markActivationStep(orgId, 'invite_team', { status: 'completed', actor });
      }
    }

    // Invalidate so the newly-active membership is visible immediately.
    try { invalidateMembershipCache(context.userId, { orgId }); } catch (_) {}

    res.json({ data });
  } catch (error) {
    console.error(`Failed to accept membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to accept membership' });
  }
});

app.post('/api/orgs/:orgId/memberships/leave', authenticate, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const { data: membership, error } = await supabase
      .from('organization_memberships')
      .select('id, role, status')
      .eq('organization_id', orgId)
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
        .eq('organization_id', orgId)
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
      .update({ status: 'revoked', is_active: false, last_seen_at: now })
      .eq('organization_id', orgId)
      .eq('user_id', context.userId);

    if (updateError) throw updateError;

    // Invalidate so the revoked membership is no longer served from cache.
    try { invalidateMembershipCache(context.userId, { orgId }); } catch (_) {}

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to leave organization ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to leave organization' });
  }
});

// Organization profile + branding admin APIs
app.get('/api/admin/org-profiles', requireAdminAccess, asyncHandler(async (req, res) => {
  if (!ensureSupabase(res)) return;

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
}));

app.get(
  '/api/admin/org-profiles/:orgId',
  requireAdminAccess,
  asyncHandler((req, res) => handleOrgProfileBundleRequest(req, res)),
);
app.get(
  '/api/admin/org-profiles/:orgId/context',
  requireAdminAccess,
  asyncHandler((req, res) => handleOrgProfileBundleRequest(req, res, { mode: 'context' })),
);
app.put(
  '/api/admin/org-profiles/:orgId',
  requireAdminAccess,
  asyncHandler((req, res) => handleOrgProfileUpsert(req, res)),
);

app.delete('/api/admin/org-profiles/:orgId', authenticate, requireOrgAdmin, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    await Promise.all([
      supabase.from('organization_profiles').delete().eq('organization_id', orgId),
      supabase.from('organization_branding').delete().eq('org_id', orgId),
      supabase.from('organization_contacts').delete().eq('org_id', orgId),
    ]);
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete organization profile for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete organization profile' });
  }
});

app.post('/api/admin/org-profiles/:orgId/contacts', authenticate, requireOrgAdmin, async (req, res) => {
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

    const _contactInsert = await supabase
      .from('organization_contacts')
      .insert(payload)
      .select('*');

    if (_contactInsert.error) throw _contactInsert.error;
    res.status(201).json({ data: mapContactResponse(firstRow(_contactInsert)) });
  } catch (error) {
    console.error(`Failed to create contact for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create contact' });
  }
});

app.put('/api/admin/org-profiles/:orgId/contacts/:contactId', authenticate, requireOrgAdmin, async (req, res) => {
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

app.delete('/api/admin/org-profiles/:orgId/contacts/:contactId', authenticate, requireOrgAdmin, async (req, res) => {
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
  app.get(
    path,
    authenticate,
    requireOrgAdmin,
    asyncHandler((req, res) => handleOrgProfileBundleRequest(req, res, { mode: 'profile' })),
  );
  app.put(
    path,
    authenticate,
    requireOrgAdmin,
    asyncHandler((req, res) => handleOrgProfileUpsert(req, res, (body) => ({ profile: body }))),
  );
});

app.get(
  '/api/admin/orgs/:orgId/profile/context',
  authenticate,
  requireOrgAdmin,
  asyncHandler((req, res) => handleOrgProfileBundleRequest(req, res, { mode: 'context' })),
);

// User profile self-service endpoints
app.get('/api/users/me', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const [{ data: profileRow, error: profileError }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', context.userId).maybeSingle(),
    ]);
    // NOTE: public.users does not exist — all user data lives in user_profiles.
    const userRow = null;

    if (profileError) throw profileError;

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
      .eq('id', context.userId)
      .maybeSingle();

    if (profileError) throw profileError;

    // NOTE: public.users does not exist — user data lives in user_profiles.
    const userRow = null;

    const allowOrgChange = context.userRole === 'admin';
    const profilePayload = normalizeUserProfileUpdatePayload(context.userId, body, { allowOrgChange });

    if (!profilePayload) {
      res.status(400).json({ error: 'No profile fields provided' });
      return;
    }

    if (existingProfile?.id) {
      profilePayload.id = existingProfile.id;
    }

    const _profUpsert = await supabase
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('*');

    if (_profUpsert.error) throw _profUpsert.error;
    const upsertedProfile = firstRow(_profUpsert);
    if (!upsertedProfile) throw new Error('profile_upsert_no_rows');

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

    const _planInsert = await supabase
      .from('org_workspace_strategic_plans')
      .insert(insertPayload)
      .select('*');

    if (_planInsert.error) throw _planInsert.error;
    res.status(201).json({ data: toStrategicPlan(firstRow(_planInsert)) });
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

    const _noteInsert = await supabase
      .from('org_workspace_session_notes')
      .insert(insertPayload)
      .select('*');

    if (_noteInsert.error) throw _noteInsert.error;
    res.status(201).json({ data: toSessionNote(firstRow(_noteInsert)) });
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

    const _actionInsert = await supabase
      .from('org_workspace_action_items')
      .insert(insertPayload)
      .select('*');

    if (_actionInsert.error) throw _actionInsert.error;
    res.status(201).json({ data: toActionItem(firstRow(_actionInsert)) });
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

    const _itemUpdate = await supabase
      .from('org_workspace_action_items')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*');

    if (_itemUpdate.error) throw _itemUpdate.error;
    const itemRow = firstRow(_itemUpdate);
    if (!itemRow) {
      res.status(404).json({ error: 'action_item_not_found', message: 'Action item not found or no rows updated' });
      return;
    }
    res.json({ data: toActionItem(itemRow) });
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
  parseVideoUpload,
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

      if (isVideoTooLargeError(error)) {
        sendVideoTooLargeResponse(res, 'storage');
        return;
      }

      const providerStatus = Number(error?.statusCode ?? error?.status ?? 0);
      if (providerStatus >= 400 && providerStatus < 500) {
        res.status(providerStatus).json({
          error: 'video_upload_rejected',
          code: 'video_upload_rejected',
          message:
            typeof error?.message === 'string' && error.message.trim()
              ? error.message
              : 'Video upload was rejected by upstream storage.',
        });
        return;
      }

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

const createSignedDocumentUrl = async (
  storagePath,
  ttlSeconds = DOCUMENT_URL_TTL_SECONDS,
  bucket = DOCUMENTS_BUCKET,
) => {
  if (!supabase || !storagePath || !bucket) return null;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
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
      const bucket = record?.bucket || DOCUMENTS_BUCKET;
      const signed = await createSignedDocumentUrl(storagePath, DOCUMENT_URL_TTL_SECONDS, bucket);
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

const REQUIRED_DOCUMENTS_TABLES = [
  { table: 'documents', columns: ['id', 'name', 'category', 'created_at'] },
];
const ensureDocumentsSchemaOrRespond = async (res, label) => {
  const requiredStatus = await ensureTablesReady(label, REQUIRED_DOCUMENTS_TABLES);
  if (!requiredStatus.ok) {
    respondSchemaUnavailable(res, label, requiredStatus);
    return false;
  }
  return true;
};

const buildDocumentsInsertPayload = ({ payload, contextUserId, organizationId, fallbackBucket, url, storagePath, urlExpiresAt }) => {
  const incomingId = typeof payload?.id === 'string' ? payload.id.trim() : null;
  const persistedId = incomingId && isUuid(incomingId) ? incomingId : undefined;
  if (incomingId && !persistedId) {
    logger.warn('[admin.documents.create] ignoring_non_uuid_id', { incomingId });
  }

  return {
    id: persistedId,
    name: payload.name,
    filename: payload.filename ?? null,
    category: payload.category,
    subcategory: payload.subcategory ?? null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    file_type: payload.fileType ?? null,
    file_size: typeof payload.fileSize === 'number' ? payload.fileSize : null,
    bucket: payload.bucket ?? fallbackBucket,
    storage_path: storagePath,
    url_expires_at: urlExpiresAt,
    visibility: payload.visibility ?? 'global',
    organization_id: organizationId ?? null,
    user_id: payload.userId ?? null,
    created_by: payload.createdBy ?? contextUserId ?? null,
    metadata: payload.metadata ?? {},
    // Prefer newer schema field, but retain legacy alias fallback handling below.
    file_url: url,
  };
};

const applyDocumentsInsertCompatibilityFallback = (insertPayload, error) => {
  if (!isMissingColumnError(error)) return null;

  const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
  if (!missingColumn) return null;

  const next = { ...insertPayload };
  switch (missingColumn) {
    case 'file_url': {
      if (Object.prototype.hasOwnProperty.call(next, 'file_url')) {
        next.url = next.file_url;
        delete next.file_url;
        return next;
      }
      break;
    }
    case 'url': {
      if (Object.prototype.hasOwnProperty.call(next, 'url')) {
        next.file_url = next.url;
        delete next.url;
        return next;
      }
      break;
    }
    case 'organization_id': {
      next.org_id = next.organization_id ?? null;
      delete next.organization_id;
      return next;
    }
    case 'org_id': {
      next.organization_id = next.org_id ?? null;
      delete next.org_id;
      return next;
    }
    default:
      break;
  }

  return null;
};

// ── Client-facing documents endpoint ────────────────────────────────────────
// Returns only global or org-scoped documents visible to the authenticated learner.
// Does NOT expose documents belonging to other orgs or private admin-only docs.
app.get('/api/client/documents', authenticate, asyncHandler(async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const requestedOrgId = pickOrgId(req.query?.orgId, req.query?.org_id, req.query?.organization_id)
    || context.organizationId
    || null;

  try {
    if (isDemoOrTestMode) {
      res.json({ data: [] });
      return;
    }

    if (!ensureSupabase(res)) return;
    if (!(await ensureDocumentsSchemaOrRespond(res, 'client.documents.list'))) return;

    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (resolvedRequestedOrgId) {
      const userId = context.userId;
      // Show global docs + docs scoped to this org + docs shared directly with this user.
      query = query.or(
        `visibility.eq.global,and(visibility.eq.org,organization_id.eq.${requestedOrgId}),and(visibility.eq.user,user_id.eq.${userId})`
      );
    } else {
      query = query.or(`visibility.eq.global,and(visibility.eq.user,user_id.eq.${context.userId})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    await refreshDocumentSignedUrls(data ?? []);
    res.json({ data: data ?? [] });
  } catch (error) {
    console.error('[client.documents.list] Failed to fetch documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
}));

app.get('/api/admin/documents', authenticate, requireOrgAdmin, async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;

  const { user_id, tag, category, search, visibility } = req.query;
  const requestedOrgId = pickOrgId(req.query?.orgId, req.query?.org_id, req.query?.organization_id);
  const resolvedRequestedOrgId = requestedOrgId ? await coerceOrgIdentifierToUuid(req, requestedOrgId) : null;
  // Blocker 3: even platform admins must request a valid, resolvable org scope
  if (requestedOrgId && (!resolvedRequestedOrgId || !isUuid(String(resolvedRequestedOrgId).trim()))) {
    res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
    return;
  }

  const isPlatformAdmin = Boolean(context.isPlatformAdmin);
  const adminOrgIds = Array.isArray(context.memberships)
    ? context.memberships
        .filter((membership) => hasOrgAdminRole(membership.role) && membership.orgId)
        .map((membership) => normalizeOrgIdValue(membership.orgId))
        .filter(Boolean)
    : [];
  const allowedOrgIdSet = new Set(adminOrgIds);

  if (resolvedRequestedOrgId) {
    const access = await requireOrgAccess(req, res, resolvedRequestedOrgId, { write: false, requireOrgAdmin: true });
    if (!access) return;
    if (!isPlatformAdmin && !allowedOrgIdSet.has(resolvedRequestedOrgId)) {
      res.status(403).json({ error: 'org_access_denied', message: 'Organization scope not permitted' });
      return;
    }
  }

  // Demo/test mode: return empty document list (no Supabase available)
  if (isDemoOrTestMode) {
    res.json({ data: [], demo: true });
    return;
  }

  if (!ensureSupabase(res)) return;
  if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.list'))) return;
  // Non-platform-admins with no org memberships can still see global documents — don't return early.

  const buildDocumentsQuery = () => {
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });

    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (resolvedRequestedOrgId) {
      query = query.eq('organization_id', resolvedRequestedOrgId);
    } else if (!isPlatformAdmin) {
      // Return global documents plus any org-scoped docs the user has access to.
      if (adminOrgIds.length > 0) {
        query = query.or(`visibility.eq.global,organization_id.in.(${adminOrgIds.join(',')})`);
      } else {
        query = query.eq('visibility', 'global');
      }
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
  const requestId = req.requestId ?? null;

  if (!payload.name || !payload.category) {
    const missingFields = [];
    if (!payload.name) missingFields.push('name');
    if (!payload.category) missingFields.push('category');
    logger.warn('[admin.documents.create] validation_failed', {
      requestId,
      orgId: payload.organization_id ?? payload.organizationId ?? null,
      userId: context.userId,
      reason: 'missing_required_fields',
      missingFields,
    });
    res.status(400).json({
      error: 'validation_failed',
      message: `Missing required fields: ${missingFields.join(', ')}.`,
      fields: Object.fromEntries(missingFields.map((f) => [f, `${f} is required`])),
    });
    return;
  }

  let organizationId = pickOrgId(payload.organization_id, payload.organizationId, payload.orgId);

  try {
    if (!organizationId && !context.isPlatformAdmin) {
      const headerOrgId = getHeaderOrgId(req, { requireMembership: true }) || null;
      const membershipOrgIds = Array.isArray(context.memberships)
        ? context.memberships
            .map((m) => normalizeOrgIdValue(pickOrgId(m.organization_id, m.organizationId, m.org_id, m.orgId)))
            .filter(Boolean)
        : [];
      const orgCandidates = Array.from(new Set([
        headerOrgId,
        normalizeOrgIdValue(context.activeOrganizationId ?? context.requestedOrgId),
        ...membershipOrgIds,
        ...(Array.isArray(context.organizationIds) ? context.organizationIds.map((orgId) => normalizeOrgIdValue(orgId)) : []),
      ].filter(Boolean)));
      const fallbackOrgId =
        headerOrgId ||
        normalizeOrgIdValue(context.activeOrganizationId ?? context.requestedOrgId) ||
        (orgCandidates.length === 1 ? orgCandidates[0] : null);
      if (!fallbackOrgId && orgCandidates.length > 1) {
        res.status(400).json({
          ok: false,
          error: 'explicit_org_selection_required',
          code: 'explicit_org_selection_required',
          message: 'This document upload is ambiguous across multiple organizations. Pass an organizationId explicitly.',
        });
        return;
      }
      if (fallbackOrgId) {
        organizationId = fallbackOrgId;
        logger.info('[admin.documents.create] org_id_auto_resolved', {
          requestId,
          userId: context.userId,
          resolvedOrgId: organizationId,
        });
      } else {
        logger.warn('[admin.documents.create] org_scope_required', {
          requestId,
          userId: context.userId,
          reason: 'no_organization_id_and_not_platform_admin',
        });
        res.status(403).json({ error: 'organization_scope_required', message: 'Document must be assigned to an organization. Pass an organizationId in the request.' });
        return;
      }
    }

    if (organizationId) {
      const access = await requireOrgAccess(req, res, organizationId, { write: true });
      if (!access) return;
    }

    let storagePath = payload.storagePath ?? null;
    let url = payload.url ?? null;
    let urlExpiresAt = payload.urlExpiresAt ?? null;
    const documentBucket = payload.bucket ?? DOCUMENTS_BUCKET;

    if (storagePath && (!url || !urlExpiresAt)) {
      const signed = await createSignedDocumentUrl(storagePath, DOCUMENT_URL_TTL_SECONDS, documentBucket);
      if (signed) {
        url = signed.url;
        urlExpiresAt = signed.expiresAt;
      }
    }

    let insertPayload = buildDocumentsInsertPayload({
      payload,
      contextUserId: context.userId,
      organizationId,
      fallbackBucket: DOCUMENTS_BUCKET,
      url,
      storagePath,
      urlExpiresAt,
    });

    let _docInsert = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('*');

    if (_docInsert.error) {
      const fallbackPayload = applyDocumentsInsertCompatibilityFallback(insertPayload, _docInsert.error);
      if (fallbackPayload) {
        insertPayload = fallbackPayload;
        _docInsert = await supabase
          .from('documents')
          .insert(insertPayload)
          .select('*');
      }
    }

    if (_docInsert.error) throw _docInsert.error;
    const docRow = firstRow(_docInsert);

    logger.info('[admin.documents.create] success', {
      requestId,
      orgId: organizationId,
      userId: context.userId,
      documentId: docRow?.id,
      name: docRow?.name,
      visibility: docRow?.visibility,
    });

    res.status(201).json({ data: docRow });
  } catch (error) {
    logger.error('[admin.documents.create] failed', {
      requestId,
      orgId: organizationId ?? null,
      userId: context.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to create document' });
  }
});

app.put('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const context = requireUserContext(req, res);
  if (!context) return;
  const patch = normalizeLegacyOrgInput(req.body || {}, { surface: 'admin.documents.update', requestId: req.requestId });

  try {
    const { data: existingDoc, error: existingError } = await supabase
      .from('documents')
      .select('id, organization_id, bucket, storage_path, url, url_expires_at')
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
      bucket: 'bucket',
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
      const { data: docOnly, error: docErr } = await supabase.from('documents').select('*').eq('id', id).maybeSingle();
      if (docErr) throw docErr;
      res.json({ data: docOnly });
      return;
    }

    const effectiveStoragePath = updatePayload.storage_path ?? existingDoc.storage_path ?? null;
    const effectiveBucket = updatePayload.bucket ?? existingDoc.bucket ?? DOCUMENTS_BUCKET;
    const hasExplicitUrl = Object.prototype.hasOwnProperty.call(updatePayload, 'url');
    const hasExplicitUrlExpiry = Object.prototype.hasOwnProperty.call(updatePayload, 'url_expires_at');
    if (effectiveStoragePath && (!hasExplicitUrl || !hasExplicitUrlExpiry)) {
      const signed = await createSignedDocumentUrl(effectiveStoragePath, DOCUMENT_URL_TTL_SECONDS, effectiveBucket);
      if (signed) {
        if (!hasExplicitUrl) updatePayload.url = signed.url;
        if (!hasExplicitUrlExpiry) updatePayload.url_expires_at = signed.expiresAt;
      }
    }

    const _docUpdate = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', id)
      .select('*');

    if (_docUpdate.error) throw _docUpdate.error;
    res.json({ data: firstRow(_docUpdate) });
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Unable to update document' });
  }
});

app.post('/api/admin/documents/:id/download', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const context = requireUserContext(req, res);
  if (!context) return;

  const docOrgId = await getDocumentOrgId(id);
  if (docOrgId === undefined) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  // docOrgId === null means it is a global document — all authenticated users may download it.
  // docOrgId is a string UUID when the document is org-scoped.
  if (docOrgId) {
    const access = await requireOrgAccess(req, res, docOrgId, { write: false });
    if (!access) return;
  }
  // Global documents (docOrgId === null) are accessible to any authenticated user — no further guard needed.

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

app.post('/api/client/documents/:id/download', authenticate, asyncHandler(async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const requestedOrgIds = Array.isArray(context.organizationIds)
    ? context.organizationIds.filter((value) => typeof value === 'string' && value.trim())
    : [];

  try {
    const { data: documentRow, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!documentRow) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const visibility = String(documentRow.visibility || 'global').toLowerCase();
    const docOrgId = normalizeOrgIdValue(documentRow.organization_id ?? documentRow.org_id ?? null);
    const docUserId = documentRow.user_id ?? null;

    if (visibility === 'user') {
      if (!docUserId || docUserId !== context.userId) {
        res.status(403).json({ error: 'forbidden', message: 'Document is not assigned to this user' });
        return;
      }
    } else if (visibility === 'org') {
      if (!docOrgId) {
        res.status(403).json({ error: 'forbidden', message: 'Document organization scope is invalid' });
        return;
      }
      if (!requestedOrgIds.includes(docOrgId)) {
        const access = await requireOrgAccess(req, res, docOrgId, { write: false });
        if (!access) return;
      }
    }

    const { data, error } = await supabase.rpc('increment_document_download', { doc_id: id });
    if (error) throw error;
    await refreshDocumentSignedUrls(data ? [data] : []);
    res.json({ data });
  } catch (error) {
    console.error('Failed to record client document download:', error);
    res.status(500).json({ error: 'Unable to record download' });
  }
}));

app.post('/api/learner/feedback', authenticate, asyncHandler(async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  if (!ensureSupabase(res)) return;

  const payload = req.body || {};
  const feedbackType = String(payload.feedbackType || payload.type || 'general').trim().toLowerCase();
  const subject = String(payload.subject || '').trim();
  const message = String(payload.message || '').trim();
  const moduleName = String(payload.module || '').trim() || null;
  const improvement = String(payload.improvement || '').trim() || null;
  const recommend = String(payload.recommend || '').trim() || null;
  const anonymous = payload.anonymous === true;
  const ratingRaw = Number(payload.rating);
  const rating = Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
  const pagePath = String(payload.pagePath || req.headers.referer || '/lms/feedback').trim();
  const organizationId = normalizeOrgIdValue(
    payload.organizationId ?? payload.organization_id ?? context.organizationId ?? context.activeOrganizationId ?? null
  );

  if (!subject || !message) {
    res.status(400).json({
      ok: false,
      code: 'validation_failed',
      message: 'Subject and feedback message are required.',
      requestId: req.requestId ?? null,
    });
    return;
  }

  const displayName =
    (typeof context.name === 'string' && context.name.trim()) ||
    (typeof context.email === 'string' && context.email.trim()) ||
    'Learner';
  const feedbackBody = [
    `Type: ${feedbackType}`,
    rating ? `Rating: ${rating}/5` : null,
    moduleName ? `Module: ${moduleName}` : null,
    recommend ? `Recommendation: ${recommend}` : null,
    anonymous ? 'Submitted anonymously to admins' : `Submitted by: ${displayName}`,
    '',
    message,
    improvement ? `\nImprovement suggestions:\n${improvement}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const metadata = {
    source: 'learner_feedback',
    feedbackType,
    rating,
    module: moduleName,
    improvement,
    recommend,
    anonymous,
    pagePath,
    userId: anonymous ? null : context.userId,
    userEmail: anonymous ? null : context.email ?? null,
    organizationId: organizationId ?? null,
    requestId: req.requestId ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };

  const record = await insertMessageLog({
    organizationId: organizationId ?? null,
    recipientType: organizationId ? 'organization' : 'platform',
    recipientId: organizationId ?? null,
    subject: `Learner feedback: ${subject}`,
    body: feedbackBody,
    channel: 'in_app',
    actor: anonymous ? null : { userId: context.userId },
    metadata,
  });

  const adminRecipientIds = organizationId
    ? await resolveOrganizationAdminUserIds(organizationId)
    : await resolvePlatformAdminUserIds();
  if (notificationService) {
    const notificationPayload = {
      title: anonymous ? 'New anonymous learner feedback' : 'New learner feedback submitted',
      body: subject,
      type: 'feedback_submission',
      priority: 'normal',
      channel: 'in_app',
      metadata: {
        ...metadata,
        messageLogId: record.id,
        actionUrl: '/admin/dashboard',
        actionLabel: 'Review feedback',
        subject,
      },
    };

    if (adminRecipientIds.length > 0) {
      await Promise.all(
        adminRecipientIds.map((adminUserId) =>
          notificationService.createNotification({
            ...notificationPayload,
            organizationId,
            userId: adminUserId,
          }).catch((error) => {
            logger.warn('learner_feedback_admin_notification_failed', {
              adminUserId,
              organizationId,
              message: error?.message || String(error),
            });
          })
        )
      );
    } else {
      await notificationService.createNotification({
        ...notificationPayload,
        organizationId,
        userId: null,
      }).catch((error) => {
        logger.warn('learner_feedback_org_notification_failed', {
          organizationId,
          message: error?.message || String(error),
        });
      });
    }
  }

  const adminRecipientEmails = await resolveAdminRecipientEmails(adminRecipientIds);
  if (adminRecipientEmails.length > 0) {
    await Promise.all(
      adminRecipientEmails.map((email) =>
        sendEmail({
          to: email,
          subject: `Learner feedback: ${subject}`,
          text: feedbackBody,
          html: `<p style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;white-space:pre-wrap;">${feedbackBody}</p>`,
          logContext: {
            organizationId: organizationId ?? null,
            recipientType: 'admin_feedback',
            recipientId: null,
            sentBy: anonymous ? null : context.userId,
            metadata: {
              source: 'learner_feedback',
              messageLogId: record.id,
              adminNotification: true,
            },
          },
        }).catch((error) => {
          logger.warn('learner_feedback_admin_email_failed', {
            email,
            organizationId,
            message: error?.message || String(error),
          });
        })
      )
    );
  }

  res.status(201).json({
    ok: true,
    requestId: req.requestId ?? null,
    data: {
      id: record.id,
      subject,
      feedbackType,
      createdAt: record.created_at ?? new Date().toISOString(),
    },
  });
}));

app.delete('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
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

  // Log once per request
  let logged = false;
  const logOnce = (...args) => {
    if (!logged) {
      logged = true;
      console.warn('[media/sign] ', ...args);
    }
  };

  try {
    const context = requireUserContext(req, res);
    if (!context) return;
    const { asset, signedUrl, expiresAt, fallback } = await mediaService.signAssetById({ assetId, logOnce });
    // If asset is missing or signing failed, return fallback/defaults
    res.json({
      data: {
        assetId,
        signedUrl: signedUrl || '',
        urlExpiresAt: expiresAt || null,
        bucket: asset?.bucket || '',
        storagePath: asset?.storage_path || '',
        mimeType: asset?.mime_type || '',
        bytes: asset?.bytes || 0,
        metadata: asset?.metadata || {},
        fallback: Boolean(fallback),
      },
    });
  } catch (error) {
    logOnce('[media] Failed to sign asset', error);
    // Always return a valid response with fallback
    res.json({
      data: {
        assetId,
        signedUrl: '',
        urlExpiresAt: null,
        bucket: '',
        storagePath: '',
        mimeType: '',
        bytes: 0,
        metadata: {},
        fallback: true,
      },
    });
  }
});

// Surveys
const REQUIRED_ADMIN_SURVEY_TABLES = [
  { table: 'surveys', columns: ['id', 'title', 'status', 'updated_at'] },
  {
    table: 'assignments',
    // Keep this intentionally minimal because org/user columns vary by deployment
    // (organization_id vs org_id, user_id_uuid optional, note/due columns optional).
    columns: ['id', 'survey_id', 'assignment_type', 'active'],
  },
];

const OPTIONAL_ADMIN_SURVEY_TABLES = [{ table: 'survey_assignments', columns: ['survey_id', 'organization_id'] }];
const SURVEY_ASSIGNMENT_TYPE = 'survey';
const SURVEY_ASSIGNMENT_SELECT =
  'id,survey_id,organization_id,user_id,status,due_at,note,assigned_by,metadata,active,created_at,updated_at';

const findLatestHdiPreRecord = (records = [], currentRecord = null) => {
  if (!Array.isArray(records) || records.length === 0 || !currentRecord) return null;
  const currentKeys = new Set(currentRecord.participantKeys || []);
  const currentUser = currentRecord.userId ? String(currentRecord.userId) : null;

  const preCandidates = records
    .map((row) => toHdiRecord(row))
    .filter(Boolean)
    .filter((record) => record.administrationType === 'pre')
    .filter((record) => {
      if (currentRecord.linkedAssessmentId && record.id === currentRecord.linkedAssessmentId) return true;
      if (currentUser && record.userId && String(record.userId) === currentUser) return true;
      if (currentKeys.size === 0 || !Array.isArray(record.participantKeys)) return false;
      return record.participantKeys.some((key) => currentKeys.has(key));
    })
    .sort((a, b) => {
      const aDate = Date.parse(a.completedAt ?? '') || 0;
      const bDate = Date.parse(b.completedAt ?? '') || 0;
      return bDate - aDate;
    });

  return preCandidates[0] ?? null;
};

const ensureAdminSurveySchemaOrRespond = async (res, label) => {
  const requiredStatus = await ensureTablesReady(label, REQUIRED_ADMIN_SURVEY_TABLES);
  if (!requiredStatus.ok) {
    respondSchemaUnavailable(res, label, requiredStatus);
    return false;
  }
  try {
    const optionalStatus = await ensureTablesReady(label, OPTIONAL_ADMIN_SURVEY_TABLES);
    if (!optionalStatus.ok) {
      logger.info('surveys_optional_schema_missing', {
        label,
        table: optionalStatus.table ?? null,
        column: optionalStatus.column ?? null,
      });
    }
  } catch (error) {
    logger.info('surveys_optional_schema_check_failed', {
      label,
      message: error?.message ?? null,
    });
  }
  return true;
};

app.get('/api/admin/surveys/templates/hdi', requireAdminAccess, asyncHandler(async (_req, res) => {
  res.json({ data: buildHdiSurveyTemplate() });
}));

app.get('/api/admin/surveys', requireAdminAccess, asyncHandler(async (_req, res) => {
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
}));

app.get('/api/admin/surveys/:id', requireAdminAccess, asyncHandler(async (req, res) => {
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
}));

app.post('/api/admin/surveys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.upsert'))) return;
  const payload = req.body || {};
  const incomingSurveyIdentifier = typeof payload.id === 'string' ? payload.id.trim() : null;

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

    const performUpsert = async () => {
      const insertPayload = buildSurveyPersistencePayload(payload);
      try {
        const result = await runTimedQuery('admin.surveys.upsert', () =>
          supabase.from('surveys').upsert(insertPayload).select('*'),
        );
        return firstRow(result);
      } catch (err) {
        if (isMissingColumnError(err) && maybeHandleSurveyColumnError(err)) {
          // Retry once with the offending column stripped
          const retryPayload = buildSurveyPersistencePayload(payload);
          const retryResult = await runTimedQuery('admin.surveys.upsert.retry', () =>
            supabase.from('surveys').upsert(retryPayload).select('*'),
          );
          return firstRow(retryResult);
        }
        throw err;
      }
    };

    const data = await performUpsert();
    rememberSurveyIdentifierAlias(incomingSurveyIdentifier, data?.id ?? null);
    await syncSurveyAssignments(data.id, assignedTo);
    const survey = await loadSurveyWithAssignments(data.id);
    res.status(201).json({ data: survey });
  } catch (error) {
    logger.error('survey_save_failed', {
      message: error?.message ?? String(error),
      code: error?.code ?? null,
      hint: error?.hint ?? null,
      details: error?.details ?? null,
      surveyTitle: (req.body || {}).title ?? null,
    });
    res.status(500).json({ error: 'Unable to save survey' });
  }
});

app.put('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.update'))) return;
  const { id } = req.params;
  const canonicalSurveyId = await resolveSurveyIdentifierToCanonicalId(id);
  const surveyIdForWrite = canonicalSurveyId ?? id;
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

    const performUpdate = async () => {
      const updatePayload = buildSurveyPersistencePayload({ ...patch, id });
      delete updatePayload.id;
      try {
        const result = await runTimedQuery('admin.surveys.update', () =>
          supabase.from('surveys').update(updatePayload).eq('id', surveyIdForWrite).select('*'),
        );
        return firstRow(result);
      } catch (err) {
        if (isMissingColumnError(err) && maybeHandleSurveyColumnError(err)) {
          const retryPayload = buildSurveyPersistencePayload({ ...patch, id });
          delete retryPayload.id;
          const retryResult = await runTimedQuery('admin.surveys.update.retry', () =>
            supabase.from('surveys').update(retryPayload).eq('id', surveyIdForWrite).select('*'),
          );
          return firstRow(retryResult);
        }
        throw err;
      }
    };

    await performUpdate();
    if (assignmentUpdateRequested) {
      await syncSurveyAssignments(surveyIdForWrite, assignedTo);
    }
    const survey = await loadSurveyWithAssignments(surveyIdForWrite);
    rememberSurveyIdentifierAlias(id, survey?.id ?? surveyIdForWrite);
    res.json({ data: survey });
  } catch (error) {
    logger.error('survey_update_failed', {
      surveyId: id,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
      hint: error?.hint ?? null,
    });
    res.status(500).json({ error: 'Unable to update survey' });
  }
});

app.delete('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.delete'))) return;
  const { id } = req.params;
  const canonicalSurveyId = await resolveSurveyIdentifierToCanonicalId(id);
  const surveyIdForDelete = canonicalSurveyId ?? id;

  try {
    if (!supabase) {
      const deleted = removeDemoSurvey(id);
      res.status(deleted ? 204 : 404).end();
      return;
    }

    await runSupabaseQueryWithRetry('admin.surveys.delete.assignments', () =>
      supabase.from('survey_assignments').delete().eq('survey_id', surveyIdForDelete),
    );
    await runSupabaseQueryWithRetry('admin.surveys.delete', () =>
      supabase.from('surveys').delete().eq('id', surveyIdForDelete),
    );
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete survey:', error);
    res.status(500).json({ error: 'Unable to delete survey' });
  }
});

app.post('/api/admin/surveys/:id/assign', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const assignmentFallbackEnabled = shouldUseAssignmentWriteFallback();
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.assign'))) return;
  const { id } = req.params;
  let surveyRecord;
  try {
    surveyRecord = await loadSurveyWithAssignments(id);
  } catch (error) {
    const invalidSurveyId =
      error?.code === '22P02' ||
      (typeof error?.message === 'string' && error.message.includes('invalid input syntax for type uuid'));
    if (invalidSurveyId) {
      res.status(400).json({
        error: 'invalid_survey_id',
        message: `Survey identifier ${id} is not valid for this environment. Refresh surveys and retry.`,
      });
      return;
    }
    throw error;
  }
  if (!surveyRecord) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'survey_not_found';
    res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
    return;
  }
  const surveyId = surveyRecord.id ?? id;
  rememberSurveyIdentifierAlias(id, surveyId);
  const body = normalizeLegacyOrgInput(req.body ?? {}, {
    surface: 'admin.surveys.assign',
    requestId: req.requestId ?? null,
  });
  const hasBodyKey = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const rawOrgInput = body.organization_ids ?? body.organizationIds ?? body.organizations ?? body.orgIds;
  const organizationIds = coerceIdArray(rawOrgInput);

  const rawUserIds = Array.isArray(body.user_ids)
    ? body.user_ids
    : Array.isArray(body.userIds)
      ? body.userIds
      : [];
  const { normalizedUserIds, invalidTargetIds } = normalizeAssignmentUserIds(rawUserIds);

  if (!organizationIds.length) {
    const singleOrg = body.organization_id ?? body.organizationId ?? null;
    if (singleOrg) organizationIds.push(String(singleOrg).trim());
  }

  if (!organizationIds.length && normalizedUserIds.length > 0 && supabase && !assignmentFallbackEnabled) {
    try {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('user_id, organization_id, status, is_active, accepted_at')
        .in('user_id', normalizedUserIds)
        .eq('status', 'active');

      if (membershipError) {
        throw membershipError;
      }

      const derivedScope = deriveSurveyAssignmentOrgScope({
        normalizedUserIds,
        membershipRows,
      });

      if (!derivedScope?.ok) {
        res.status(400).json({
          error: derivedScope?.code || 'organization_scope_required',
          message:
            derivedScope?.message ||
            'Unable to resolve organization scope from user memberships. Provide organizationIds explicitly.',
          meta: derivedScope?.meta || null,
        });
        return;
      }

      organizationIds.push(...(derivedScope.organizationIds || []));
    } catch (deriveOrgError) {
      logger.warn('survey_assignment_org_derivation_failed', {
        requestId: req.requestId ?? null,
        surveyId,
        message: deriveOrgError?.message ?? String(deriveOrgError),
      });
      res.status(503).json({
        error: 'organization_scope_resolution_failed',
        message: 'Unable to resolve organization scope for user-targeted assignment. Please retry or pass organizationIds.',
      });
      return;
    }
  }

  if (!organizationIds.length) {
    res.status(400).json({ error: 'organization_id_required', message: 'Provide at least one organization id.' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const dueProvided = hasBodyKey('due_at') || hasBodyKey('dueAt');
  const noteProvided = hasBodyKey('note');

  const dueAtValue = dueProvided ? (body.due_at ?? body.dueAt ?? null) : undefined;
  const noteValue =
    noteProvided && typeof body.note === 'string'
      ? body.note
      : noteProvided && body.note === null
        ? null
        : undefined;
  const assignedByRaw = body.assigned_by ?? body.assignedBy;
  const assignedBy = typeof assignedByRaw === 'string' && assignedByRaw.trim().length > 0
    ? assignedByRaw.trim()
    : context.userId;
  const allowedStatuses = new Set(['assigned', 'in-progress', 'completed']);
  const statusProvided = typeof body.status === 'string';
  const requestedStatus = statusProvided ? String(body.status).toLowerCase() : '';
  const statusValue = allowedStatuses.has(requestedStatus) ? requestedStatus : 'assigned';
  const metadataInput = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};
  let metadata = {};
  try {
    metadata = JSON.parse(JSON.stringify(metadataInput));
  } catch (_err) {
    metadata = {};
  }
  metadata = {
    ...metadata,
    assigned_via: metadata.assigned_via ?? 'admin_survey_api',
    request_user: context.userId,
    request_ip: req.ip,
    surface: 'admin.surveys.assign',
    assignment_audit: {
      created_by: context.userId,
      created_at: new Date().toISOString(),
      source: 'admin.surveys.assign',
    },
  };

  const aggregateResponse = [];
  let insertedTotal = 0;
  let updatedTotal = 0;
  let skippedTotal = 0;
  const insertedAssignments = [];
  const requestScopedUserAssignmentKeys = new Set();
  const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
  const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();

  logSurveyAssignmentEvent('survey_assignment_attempted', {
    requestId: req.requestId ?? null,
    surveyId,
    organizationCount: organizationIds.length,
    userCount: normalizedUserIds.length,
    invalidTargetIds,
    metadata: {
      fallbackEnabled: assignmentFallbackEnabled,
    },
  });

  const assignForOrg = async (organizationId) => {
    if (!organizationId) return;
    let canonicalOrganizationId = organizationId;
    if (!isDemoOrTestMode) {
      try {
        const resolvedOrgId = await coerceOrgIdentifierToUuid(req, organizationId);
        if (resolvedOrgId) {
          canonicalOrganizationId = resolvedOrgId;
        }
      } catch (error) {
        if (error instanceof InvalidOrgIdentifierError) {
          const invalidOrgError = new Error('invalid_organization_id');
          invalidOrgError.statusCode = 400;
          invalidOrgError.code = 'invalid_organization_id';
          invalidOrgError.meta = { organizationId };
          throw invalidOrgError;
        }
        throw error;
      }
    }

    const access = await requireOrgAccess(req, res, canonicalOrganizationId, { write: true, requireOrgAdmin: true });
    if (!access) {
      const deniedError = new Error('org_access_denied');
      deniedError.statusCode = res.headersSent ? null : 403;
      deniedError.code = 'org_access_denied';
      deniedError.meta = { organizationId: canonicalOrganizationId };
      throw deniedError;
    }

    if (assignmentFallbackEnabled) {
      const now = new Date().toISOString();
      const rows = normalizedUserIds.length ? normalizedUserIds : [null];
      const updated = [];
      const inserted = [];

      e2eStore.assignments = e2eStore.assignments || [];

      rows.forEach((userId) => {
        const existing = e2eStore.assignments.find((record) => {
          if (!record) return false;
          const assignmentType = record.assignment_type ?? record.assignmentType ?? null;
          if (assignmentType && assignmentType !== SURVEY_ASSIGNMENT_TYPE) return false;
          if (String(record.survey_id ?? record.surveyId ?? '') !== String(surveyId)) return false;
          if (String(record.organization_id ?? record.organizationId ?? record.org_id ?? record.orgId ?? '') !== String(canonicalOrganizationId)) {
            return false;
          }
          if (record.active === false) return false;
          const existingUserId = record.user_id ?? record.userId ?? null;
          if (existingUserId === null && userId === null) return true;
          if (existingUserId === null || userId === null) return false;
          return String(existingUserId).toLowerCase() === String(userId).toLowerCase();
        });

        if (existing) {
          if (dueProvided) existing.due_at = dueAtValue ?? null;
          if (noteProvided) existing.note = noteValue ?? null;
          if (statusProvided) existing.status = statusValue;
          if (assignedBy) existing.assigned_by = assignedBy;
          existing.metadata = {
            ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
            ...metadata,
          };
          existing.active = true;
          existing.updated_at = now;
          updated.push(existing);
          return;
        }

        const created = {
          id: `survey-asn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          survey_id: surveyId,
          organization_id: canonicalOrganizationId,
          user_id: userId,
          due_at: dueAtValue ?? null,
          note: noteValue ?? null,
          status: statusValue,
          assigned_by: assignedBy ?? null,
          metadata,
          assignment_type: SURVEY_ASSIGNMENT_TYPE,
          active: true,
          created_at: now,
          updated_at: now,
        };
        e2eStore.assignments.push(created);
        inserted.push(created);
      });

      aggregateResponse.push(...updated, ...inserted);
      insertedTotal += inserted.length;
      updatedTotal += updated.length;
      skippedTotal += Math.max(rows.length - inserted.length - updated.length, 0);
      insertedAssignments.push(...inserted);
      return;
    }

    if (!supabase) {
      const unavailableError = new Error('database_unavailable');
      unavailableError.code = 'database_unavailable';
      unavailableError.statusCode = 503;
      unavailableError.meta = { organizationId: canonicalOrganizationId, fallbackEnabled: assignmentFallbackEnabled };
      throw unavailableError;
    }

    let targetUserIds = normalizedUserIds;
    if (targetUserIds.length === 0) {
      try {
        const members = await fetchOrgMembersWithProfiles(canonicalOrganizationId);
        const activeUserIds = Array.from(
          new Set(
            (members || [])
              .filter((member) => String(member?.status || '').toLowerCase() === 'active')
              .map((member) => member?.user_id ?? member?.user?.id ?? null)
              .filter(Boolean)
              .map((value) => String(value)),
          ),
        );
        targetUserIds = activeUserIds.length > 0 ? activeUserIds : [null];
      } catch (memberResolveError) {
        logger.warn('survey_assignment_member_resolution_failed', {
          surveyId,
          organizationId: canonicalOrganizationId,
          requestId: req.requestId ?? null,
          message: memberResolveError?.message ?? String(memberResolveError),
        });
        targetUserIds = [null];
      }
    }
    const buildSurveyAssignmentKey = (value) => (value === null ? '__org__' : String(value).toLowerCase());
    const hasOrgWideTarget = targetUserIds.length === 1 && targetUserIds[0] === null;
    const effectiveTargetUserIds = hasOrgWideTarget
      ? targetUserIds
      : targetUserIds.filter((value) => {
        const key = buildSurveyAssignmentKey(value);
        if (requestScopedUserAssignmentKeys.has(key)) {
          return false;
        }
        requestScopedUserAssignmentKeys.add(key);
        return true;
      });
    const requestScopedDuplicateSkipCount = Math.max(targetUserIds.length - effectiveTargetUserIds.length, 0);

    if (effectiveTargetUserIds.length === 0) {
      skippedTotal += requestScopedDuplicateSkipCount;
      return;
    }

    const orgColumnName = assignmentsOrgColumn === 'org_id' ? 'org_id' : 'organization_id';
    const assignmentUserKeyExpr = assignmentsSupportUserIdUuid
      ? 'coalesce(user_id::text, user_id_uuid::text)'
      : 'user_id::text';

    const verifyPersistedSurveyAssignments = async () => {
  const expectedKeys = new Set(effectiveTargetUserIds.map((value) => buildSurveyAssignmentKey(value)));
      if (expectedKeys.size === 0) return [];

      const runVerificationRead = async () => {
        if (!hasOrgWideTarget) {
          return await sql.unsafe(
            `
              select id, survey_id, ${orgColumnName} as organization_id, user_id, status, due_at, note, assigned_by, metadata, active, created_at, updated_at,
                     ${assignmentUserKeyExpr} as user_key
              from public.assignments
              where survey_id::text = $1::text
                and ${orgColumnName}::text = $2::text
                and assignment_type = $3
                and active = true
                and ${assignmentUserKeyExpr} = any($4::text[])
            `,
              [surveyId, canonicalOrganizationId, SURVEY_ASSIGNMENT_TYPE, effectiveTargetUserIds],
          );
        }

        return await sql.unsafe(
          `
            select id, survey_id, ${orgColumnName} as organization_id, user_id, status, due_at, note, assigned_by, metadata, active, created_at, updated_at,
                   ${assignmentUserKeyExpr} as user_key
            from public.assignments
            where survey_id::text = $1::text
              and ${orgColumnName}::text = $2::text
              and assignment_type = $3
              and active = true
              and user_id is null
          `,
          [surveyId, canonicalOrganizationId, SURVEY_ASSIGNMENT_TYPE],
        );
      };

      let persistedRows = await runVerificationRead();

      const persistedKeys = new Set(
        persistedRows.map((row) => buildSurveyAssignmentKey(row?.user_key ?? row?.user_id ?? null)),
      );
      let missingKeys = Array.from(expectedKeys).filter((key) => !persistedKeys.has(key));
      if (missingKeys.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 75));
        persistedRows = await runVerificationRead();
        const retryKeys = new Set(
          persistedRows.map((row) => buildSurveyAssignmentKey(row?.user_key ?? row?.user_id ?? null)),
        );
        missingKeys = Array.from(expectedKeys).filter((key) => !retryKeys.has(key));
      }
      if (missingKeys.length > 0) {
        const verificationError = new Error('survey_assignment_persistence_verification_failed');
        verificationError.code = 'survey_assignment_persistence_verification_failed';
        verificationError.meta = {
          surveyId,
          organizationId: canonicalOrganizationId,
          missingKeys,
          expectedCount: expectedKeys.size,
          persistedCount: persistedRows.length,
        };
        throw verificationError;
      }

      return persistedRows;
    };
    const mergeMetadata = (existingMeta) => {
      if (!existingMeta || typeof existingMeta !== 'object') {
        return metadata;
      }
      return { ...existingMeta, ...metadata };
    };

    const buildRecord = (userId) => ({
      survey_id: surveyId,
      course_id: null,
      user_id: userId,
      assignment_type: SURVEY_ASSIGNMENT_TYPE,
      status: statusValue,
      due_at: dueAtValue ?? null,
      note: noteValue ?? null,
      assigned_by: assignedBy ?? null,
      metadata,
      active: true,
    });

    const withCanonicalOrg = (record) => ({
      ...record,
      organization_id: canonicalOrganizationId,
      organizationId: canonicalOrganizationId,
      [assignmentsOrgColumn]: canonicalOrganizationId,
    });

    const buildKey = (value) => (value === null ? '__org__' : String(value).toLowerCase());
    const updates = [];
    const inserts = [];

    const sqlResult = await sql.begin(async (tx) => {
      const existingRows = !hasOrgWideTarget
        ? await tx.unsafe(
          `
            select id, user_id, user_id_uuid, metadata, assigned_by
            from public.assignments
            where survey_id::text = $1::text
              and assignment_type = $2
              and active = true
              and (${assignmentUserKeyExpr} = any($3::text[]))
            for update
          `,
          [surveyId, SURVEY_ASSIGNMENT_TYPE, effectiveTargetUserIds],
        )
        : await tx.unsafe(
          `
            select id, user_id, metadata, assigned_by
            from public.assignments
            where survey_id::text = $1::text
              and ${orgColumnName}::text = $2::text
              and assignment_type = $3
              and active = true
              and user_id is null
            for update
          `,
          [surveyId, canonicalOrganizationId, SURVEY_ASSIGNMENT_TYPE],
        );

      const existingMap = new Map();
      (existingRows || []).forEach((row) => {
        if (!row) return;
        const userKey = row.user_id ?? row.user_id_uuid ?? null;
        existingMap.set(buildKey(userKey), row);
      });

      effectiveTargetUserIds.forEach((userId) => {
        const key = buildKey(userId);
        const existing = existingMap.get(key);
        if (existing) {
          const patch = {
            id: existing.id,
            metadata: mergeMetadata(existing.metadata),
            active: true,
            organization_id: canonicalOrganizationId,
          };
          if (dueProvided) patch.due_at = dueAtValue ?? null;
          if (noteProvided) patch.note = noteValue ?? null;
          if (statusProvided) patch.status = statusValue;
          if (assignedBy) patch.assigned_by = assignedBy;
          updates.push(patch);
        } else {
          inserts.push(withCanonicalOrg(buildRecord(userId)));
        }
      });

      for (const patch of updates) {
        const setSegments = [
          'metadata = coalesce(metadata, \'{}\'::jsonb) || $1::jsonb',
          'active = true',
          'updated_at = now()',
        ];
        const params = [JSON.stringify(patch.metadata ?? {})];
        if (Object.prototype.hasOwnProperty.call(patch, 'due_at')) {
          params.push(patch.due_at ?? null);
          setSegments.push(`due_at = $${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
          params.push(patch.note ?? null);
          setSegments.push(`note = $${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
          params.push(patch.status);
          setSegments.push(`status = $${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'assigned_by')) {
          params.push(patch.assigned_by ?? null);
          setSegments.push(`assigned_by = $${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'organization_id')) {
          params.push(patch.organization_id ?? null);
          setSegments.push(`${orgColumnName} = $${params.length}`);
        }
        params.push(patch.id);
        await tx.unsafe(
          `
            update public.assignments
            set ${setSegments.join(', ')}
            where id::text = $${params.length}::text
          `,
          params,
        );
      }

      const insertedRows = [];
      for (const insertRow of inserts) {
        const inserted = assignmentsSupportUserIdUuid
          ? await tx.unsafe(
            `
              insert into public.assignments
                (survey_id, course_id, user_id, user_id_uuid, assignment_type, status, due_at, note, assigned_by, metadata, active, ${orgColumnName}, created_at, updated_at)
              values
                ($1, null, $2, $3::uuid, $4, $5, $6, $7, $8, $9::jsonb, true, $10, now(), now())
              on conflict (survey_id, user_id)
              where assignment_type = 'survey' and user_id is not null
              do update
                set ${orgColumnName} = excluded.${orgColumnName},
                    status = excluded.status,
                    due_at = excluded.due_at,
                    note = excluded.note,
                    assigned_by = excluded.assigned_by,
                    metadata = coalesce(public.assignments.metadata, '{}'::jsonb) || excluded.metadata,
                    active = true,
                    updated_at = now()
              returning id, (xmax = 0) as inserted
            `,
            [
              insertRow.survey_id,
              insertRow.user_id,
              insertRow.user_id,
              insertRow.assignment_type,
              insertRow.status,
              insertRow.due_at ?? null,
              insertRow.note ?? null,
              insertRow.assigned_by ?? null,
              JSON.stringify(insertRow.metadata ?? {}),
              canonicalOrganizationId,
            ],
          )
          : await tx.unsafe(
            `
              insert into public.assignments
                (survey_id, course_id, user_id, assignment_type, status, due_at, note, assigned_by, metadata, active, ${orgColumnName}, created_at, updated_at)
              values
                ($1, null, $2, $3, $4, $5, $6, $7, $8::jsonb, true, $9, now(), now())
              on conflict (survey_id, user_id)
              where assignment_type = 'survey' and user_id is not null
              do update
                set ${orgColumnName} = excluded.${orgColumnName},
                    status = excluded.status,
                    due_at = excluded.due_at,
                    note = excluded.note,
                    assigned_by = excluded.assigned_by,
                    metadata = coalesce(public.assignments.metadata, '{}'::jsonb) || excluded.metadata,
                    active = true,
                    updated_at = now()
              returning id, (xmax = 0) as inserted
            `,
            [
              insertRow.survey_id,
              insertRow.user_id,
              insertRow.assignment_type,
              insertRow.status,
              insertRow.due_at ?? null,
              insertRow.note ?? null,
              insertRow.assigned_by ?? null,
              JSON.stringify(insertRow.metadata ?? {}),
              canonicalOrganizationId,
            ],
          );
        if (Array.isArray(inserted) && inserted[0]?.id && inserted[0]?.inserted === true) {
          insertedRows.push({ id: inserted[0].id });
        } else if (Array.isArray(inserted) && inserted[0]?.id) {
          updates.push({ id: inserted[0].id, metadata: insertRow.metadata, assigned_by: insertRow.assigned_by ?? null });
        }
      }

      return {
        insertedRows,
        updatedRows: updates,
      };
    });

    const insertedRows = sqlResult.insertedRows || [];
    const updatedRows = sqlResult.updatedRows || [];

  const persistedRows = await verifyPersistedSurveyAssignments();
  aggregateResponse.push(...persistedRows);
    insertedTotal += insertedRows.length;
    updatedTotal += updatedRows.length;
    skippedTotal += Math.max(effectiveTargetUserIds.length - insertedRows.length - updatedRows.length, 0);
    skippedTotal += requestScopedDuplicateSkipCount;
    insertedAssignments.push(...insertedRows);
  };

  try {
    for (const orgId of organizationIds) {
      await assignForOrg(orgId);
    }

    if (assignmentFallbackEnabled) {
      const assignedTo = createEmptyAssignedTo();
      const orgSet = new Set();
      const userSet = new Set();
      for (const assignment of e2eStore.assignments || []) {
        if (!assignment) continue;
        const assignmentType = assignment.assignment_type ?? assignment.assignmentType ?? null;
        if (assignmentType && assignmentType !== SURVEY_ASSIGNMENT_TYPE) continue;
        const assignmentSurveyId = assignment.survey_id ?? assignment.surveyId ?? null;
        if (String(assignmentSurveyId) !== String(surveyId)) continue;
        const orgId = assignment.organization_id ?? assignment.organizationId ?? assignment.org_id ?? assignment.orgId;
        if (orgId) orgSet.add(String(orgId));
        const userId = assignment.user_id ?? assignment.userId ?? null;
        if (userId) userSet.add(String(userId));
      }
      assignedTo.organizationIds = Array.from(orgSet);
      assignedTo.userIds = Array.from(userSet);
      updateDemoSurveyAssignments(surveyId, assignedTo);
    }

    if (insertedTotal > 0) {
      logSurveyAssignmentEvent('survey_assignment_created', {
        requestId: req.requestId ?? null,
  surveyId,
        organizationCount: organizationIds.length,
        userCount: normalizedUserIds.length,
        insertedRowCount: insertedTotal,
        skippedRowCount: skippedTotal,
        invalidTargetIds,
      });
    } else if (updatedTotal > 0) {
      logSurveyAssignmentEvent('survey_assignment_updated', {
        requestId: req.requestId ?? null,
  surveyId,
        organizationCount: organizationIds.length,
        userCount: normalizedUserIds.length,
        insertedRowCount: insertedTotal,
        skippedRowCount: skippedTotal,
        invalidTargetIds,
      });
    } else if (skippedTotal > 0) {
      logSurveyAssignmentEvent('survey_assignment_skipped_duplicate', {
        requestId: req.requestId ?? null,
  surveyId,
        organizationCount: organizationIds.length,
        userCount: normalizedUserIds.length,
        skippedRowCount: skippedTotal,
        invalidTargetIds,
      });
    }

    if (insertedAssignments.length > 0) {
      try {
        await notifyAssignmentRecipients({
          assignmentType: SURVEY_ASSIGNMENT_TYPE,
          assignments: insertedAssignments,
          actor: { userId: assignedBy ?? context.userId ?? null },
        });
      } catch (error) {
        logger.warn('survey_assignment_notification_skipped', {
          message: error?.message || String(error),
        });
      }
    }

    try {
      await refreshSurveyAssignmentAggregates(surveyId);
    } catch (aggregateError) {
      logger.warn('survey_assignment_aggregate_refresh_failed', {
        surveyId,
        requestId: req.requestId ?? null,
        message: aggregateError?.message ?? String(aggregateError),
      });
    }

    res.status(insertedTotal > 0 ? 201 : 200).json({
      data: aggregateResponse,
      meta: {
        inserted: insertedTotal,
        updated: updatedTotal,
        skipped: skippedTotal,
        invalidTargetIds,
      },
    });
    logSurveyAssignmentEvent('survey_assignment_persisted', {
      requestId: req.requestId ?? null,
      surveyId,
      organizationCount: organizationIds.length,
      userCount: normalizedUserIds.length,
      insertedRowCount: insertedTotal,
      skippedRowCount: skippedTotal,
      invalidTargetIds,
      metadata: {
        updatedRowCount: updatedTotal,
        persistedRowCount: aggregateResponse.length,
      },
    });
  } catch (error) {
    logSurveyAssignmentEvent('survey_assignment_failed', {
      requestId: req.requestId ?? null,
  surveyId,
      organizationCount: organizationIds.length,
      userCount: normalizedUserIds.length,
      insertedRowCount: insertedTotal,
      skippedRowCount: skippedTotal,
      invalidTargetIds,
      metadata: {
        error: error?.message ?? String(error),
        code: error?.code ?? null,
        statusCode: error?.statusCode ?? null,
        orgId: error?.meta?.organizationId ?? null,
      },
    });
    if (res.headersSent) {
      return;
    }
    if (error?.statusCode === 400 || error?.code === 'invalid_organization_id') {
      res.status(400).json({
        error: 'invalid_organization_id',
        message: 'One or more organization identifiers are invalid.',
      });
      return;
    }
    if (error?.statusCode === 403 || error?.code === 'org_access_denied') {
      res.status(403).json({
        error: 'org_access_denied',
        message: 'You do not have admin access to one or more requested organizations.',
      });
      return;
    }
    if (error?.code === 'survey_assignment_persistence_verification_failed') {
      res.status(503).json({
        error: 'assignment_persistence_verification_failed',
        message: 'Survey assignment write could not be verified. Please retry.',
      });
      return;
    }
    if (error?.statusCode === 503 || error?.code === 'database_unavailable' || isInfrastructureUnavailableError(error)) {
      res.status(503).json({
        error: 'database_unavailable',
        message: 'Survey assignment write failed because the database is unavailable.',
      });
      return;
    }
    if (error?.code === '23505') {
      res.status(200).json({
        data: aggregateResponse,
        meta: {
          inserted: insertedTotal,
          updated: updatedTotal,
          skipped: Math.max(skippedTotal, 1),
          invalidTargetIds,
          duplicateConflictRecovered: true,
        },
      });
      return;
    }
    res.status(500).json({ error: 'Unable to assign survey' });
  }
});

app.get('/api/admin/surveys/:id/assignments', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.assignments'))) return;
  const { id } = req.params;
  const surveyRecord = await loadSurveyWithAssignments(id);
  if (!surveyRecord) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'survey_not_found';
    res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
    return;
  }
  const surveyId = surveyRecord.id ?? id;
  const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);
  const userIdFilter =
    typeof req.query.userId === 'string'
      ? req.query.userId.trim().toLowerCase()
      : typeof req.query.user_id === 'string'
        ? req.query.user_id.trim().toLowerCase()
        : null;
  const includeInactive = String(req.query.active ?? 'true').toLowerCase() === 'false';
  const limit = clampNumber(parseInt(req.query.limit, 10) || 200, 1, 1000);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const context = requireUserContext(req, res);
  if (!context) return;

  if (organizationId) {
    const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: false });
    if (!access) {
      return res.status(403).json({ error: 'forbidden', code: 'org_access_denied' });
    }
  } else if (!context.isPlatformAdmin) {
    res.status(403).json({
      error: 'org_required',
      message: 'Organization filter is required unless you are a platform administrator.',
    });
    return;
  }

  try {
    if (!supabase && isDemoOrTestMode) {
      const rows = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];
      const filtered = rows
        .filter((row) => {
          if (!row) return false;
          const assignmentType = row.assignment_type ?? row.assignmentType ?? null;
          if (assignmentType && assignmentType !== SURVEY_ASSIGNMENT_TYPE) return false;
          const assignmentSurveyId = row.survey_id ?? row.surveyId ?? null;
          if (String(assignmentSurveyId) !== String(surveyId)) return false;
          const rowOrgId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
          if (organizationId && String(rowOrgId ?? '') !== String(organizationId)) return false;
          const rowUserId = row.user_id ?? row.userId ?? null;
          if (userIdFilter && String(rowUserId ?? '').toLowerCase() !== userIdFilter) return false;
          if (!includeInactive && row.active === false) return false;
          return true;
        })
        .sort((a, b) => {
          const left = Date.parse(a?.updated_at ?? a?.created_at ?? '') || 0;
          const right = Date.parse(b?.updated_at ?? b?.created_at ?? '') || 0;
          return right - left;
        });

      const paged = filtered.slice(offset, offset + limit);
      res.json({ data: paged, count: filtered.length });
      return;
    }

    let query = supabase
      .from('assignments')
      .select(SURVEY_ASSIGNMENT_SELECT, { count: 'exact' })
      .eq('survey_id', surveyId)
      .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    if (userIdFilter) {
      query = query.eq('user_id', userIdFilter);
    }
    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: data || [], count: count ?? data?.length ?? 0 });
  } catch (error) {
    console.error('[admin.surveys.assignments] failed', error);
    res.status(500).json({ error: 'Unable to load survey assignments' });
  }
});

app.delete('/api/admin/surveys/:surveyId/assignments/:assignmentId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.assignments.delete'))) return;
  const { surveyId, assignmentId } = req.params;
  const canonicalSurveyId = await resolveSurveyIdentifierToCanonicalId(surveyId);
  const surveyIdForLookup = canonicalSurveyId ?? surveyId;
  if (!assignmentId) {
    res.status(400).json({ error: 'assignment_id_required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('assignments')
      .select(SURVEY_ASSIGNMENT_SELECT)
      .eq('id', assignmentId)
      .eq('survey_id', surveyIdForLookup)
      .eq('assignment_type', SURVEY_ASSIGNMENT_TYPE)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      res.status(404).json({ error: 'assignment_not_found' });
      return;
    }

    if (existing.organization_id) {
      const access = await requireOrgAccess(req, res, existing.organization_id, {
        write: true,
        requireOrgAdmin: true,
      });
      if (!access) {
        return res.status(403).json({ error: 'forbidden', code: 'org_access_denied' });
      }
    } else if (!context.isPlatformAdmin) {
      res.status(403).json({ error: 'org_required', message: 'Only platform admins can remove global assignments.' });
      return;
    }

    const hardDelete = String(req.query.hard ?? 'false').toLowerCase() === 'true';
    if (hardDelete) {
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('assignments').update({ active: false }).eq('id', assignmentId);
      if (error) throw error;
    }

    logSurveyAssignmentEvent('survey_assignment_updated', {
      requestId: req.requestId ?? null,
      surveyId: surveyIdForLookup,
      organizationCount: existing.organization_id ? 1 : 0,
      userCount: existing.user_id ? 1 : 0,
      insertedRowCount: 0,
      skippedRowCount: 0,
      metadata: { action: hardDelete ? 'deleted' : 'deactivated', assignmentId },
    });

    await refreshSurveyAssignmentAggregates(surveyIdForLookup);
    res.status(204).end();
  } catch (error) {
    console.error('[admin.surveys.assignments.delete] failed', error);
    res.status(500).json({ error: 'Unable to remove survey assignment' });
  }
});

app.get('/api/admin/surveys/:id/hdi/participant-report', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.hdi.participant-report'))) return;

  const context = requireUserContext(req, res);
  if (!context) return;

  const { id } = req.params;
  const surveyRecord = await loadSurveyWithAssignments(id);
  if (!surveyRecord) {
    res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
    return;
  }

  const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);
  if (organizationId) {
    const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: false });
    if (!access) {
      return res.status(403).json({ error: 'forbidden', code: 'org_access_denied' });
    }
  } else if (!context.isPlatformAdmin) {
    res.status(403).json({ error: 'org_required', message: 'Organization filter is required unless you are a platform administrator.' });
    return;
  }

  try {
    const limit = clampNumber(parseInt(req.query.limit, 10) || 500, 1, 2000);
    let query = supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyRecord.id)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const participantFilter =
      typeof req.query.participant === 'string' && req.query.participant.trim().length
        ? req.query.participant.trim().toLowerCase()
        : null;

    let rows = buildHdiParticipantRows(data || []);
    if (participantFilter) {
      rows = rows.filter((row) => String(row.participantIdentifier || '').toLowerCase() === participantFilter);
    }

    res.json(
      createHdiResponseEnvelope(HDI_RESPONSE_SHAPES.PARTICIPANT_REPORT, rows, {
        count: rows.length,
        surveyId: surveyRecord.id,
        organizationId: organizationId ?? null,
      }),
    );
  } catch (error) {
    logger.error('admin_hdi_participant_report_failed', {
      surveyId: surveyRecord.id,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
    });
    res.status(500).json({ error: 'Unable to load HDI participant report' });
  }
});

app.get('/api/admin/surveys/:id/hdi/cohort-analytics', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.hdi.cohort-analytics'))) return;

  const context = requireUserContext(req, res);
  if (!context) return;

  const { id } = req.params;
  const surveyRecord = await loadSurveyWithAssignments(id);
  if (!surveyRecord) {
    res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
    return;
  }

  const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);
  if (organizationId) {
    const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: false });
    if (!access) {
      return res.status(403).json({ error: 'forbidden', code: 'org_access_denied' });
    }
  } else if (!context.isPlatformAdmin) {
    res.status(403).json({ error: 'org_required', message: 'Organization filter is required unless you are a platform administrator.' });
    return;
  }

  try {
    const limit = clampNumber(parseInt(req.query.limit, 10) || 2000, 1, 5000);
    let query = supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyRecord.id)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const analytics = buildHdiCohortAnalytics(data || []);
    res.json(
      createHdiResponseEnvelope(HDI_RESPONSE_SHAPES.COHORT_ANALYTICS, analytics, {
        surveyId: surveyRecord.id,
        organizationId: organizationId ?? null,
      }),
    );
  } catch (error) {
    logger.error('admin_hdi_cohort_analytics_failed', {
      surveyId: surveyRecord.id,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
    });
    res.status(500).json({ error: 'Unable to load HDI cohort analytics' });
  }
});

app.get('/api/admin/surveys/:id/hdi/pre-post-comparison', async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.hdi.pre-post-comparison'))) return;

  const context = requireUserContext(req, res);
  if (!context) return;

  const { id } = req.params;
  const surveyRecord = await loadSurveyWithAssignments(id);
  if (!surveyRecord) {
    res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
    return;
  }

  const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);
  if (organizationId) {
    const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: false });
    if (!access) {
      return res.status(403).json({ error: 'forbidden', code: 'org_access_denied' });
    }
  } else if (!context.isPlatformAdmin) {
    res.status(403).json({ error: 'org_required', message: 'Organization filter is required unless you are a platform administrator.' });
    return;
  }

  const participantFilter =
    typeof req.query.participant === 'string' && req.query.participant.trim().length
      ? req.query.participant.trim().toLowerCase()
      : null;
  if (!participantFilter) {
    res.status(400).json({ error: 'participant_required', message: 'participant query parameter is required.' });
    return;
  }

  try {
    let query = supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyRecord.id)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const records = (data || [])
      .map((row) => toHdiRecord(row))
      .filter(Boolean)
      .filter((record) => {
        if (record.userId && String(record.userId).toLowerCase() === participantFilter) return true;
        return Array.isArray(record.participantKeys) && record.participantKeys.includes(participantFilter);
      });

    const latestPost = records
      .filter((record) => record.administrationType === 'post' || record.administrationType === 'pulse')
      .sort((a, b) => (Date.parse(b.completedAt ?? '') || 0) - (Date.parse(a.completedAt ?? '') || 0))[0];
    const preRecord = records
      .filter((record) => record.administrationType === 'pre')
      .sort((a, b) => (Date.parse(b.completedAt ?? '') || 0) - (Date.parse(a.completedAt ?? '') || 0))[0];

    const comparison = latestPost && preRecord ? buildHdiComparison({ pre: preRecord, post: latestPost }) : null;
    res.json(
      createHdiResponseEnvelope(HDI_RESPONSE_SHAPES.PRE_POST_COMPARISON, comparison, {
        surveyId: surveyRecord.id,
        organizationId: organizationId ?? null,
        participant: participantFilter,
      }),
    );
  } catch (error) {
    logger.error('admin_hdi_pre_post_comparison_failed', {
      surveyId: surveyRecord.id,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
    });
    res.status(500).json({ error: 'Unable to load HDI pre/post comparison' });
  }
});

app.get('/api/client/surveys/:id/results', authenticate, async (req, res) => {
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  const { id } = req.params;
  const surveyRecord = await loadSurveyWithAssignments(id);
  if (!surveyRecord) {
    res.status(404).json({ error: 'survey_not_found', message: `Survey not found for identifier ${id}` });
    return;
  }

  try {
    const surveyId = surveyRecord.id ?? id;
    const assignment = await loadSurveyAssignmentForUser(surveyId, context.userId, {
      assignmentId: req.query.assignmentId ?? req.query.assignment_id ?? null,
      orgIds: Array.isArray(context.organizationIds) ? context.organizationIds : [],
      allowSelfEnroll: false,
    });

    if ((req.query.assignmentId || req.query.assignment_id) && !assignment) {
      res.status(404).json({
        error: 'assignment_not_found',
        message: 'Assignment not found for this survey and learner.',
      });
      return;
    }

    let responseQuery = supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyRecord.id)
      .eq('user_id', context.userId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(100);

    if (assignment?.id) {
      responseQuery = responseQuery.eq('assignment_id', assignment.id);
    }

    const { data, error } = await responseQuery;
    if (error) throw error;

    const records = (data || []).map((row) => toHdiRecord(row)).filter(Boolean);
    const latest = records[0] ?? null;
    const preRecord = latest ? findLatestHdiPreRecord(data || [], latest) : null;
    const comparison = latest && preRecord && latest.id !== preRecord.id
      ? buildHdiComparison({ pre: preRecord, post: latest })
      : null;

    res.json(
      createHdiResponseEnvelope(
        HDI_RESPONSE_SHAPES.LEARNER_RESULTS,
        {
          surveyId: surveyRecord.id,
          assignmentId: assignment?.id ?? null,
          latest,
          comparison,
        },
        {
          userId: context.userId,
        },
      ),
    );
  } catch (error) {
    logger.error('client_hdi_results_failed', {
      surveyId: surveyRecord.id,
      userId: context.userId,
      message: error?.message ?? String(error),
      code: error?.code ?? null,
    });
    res.status(500).json({ error: 'Unable to load survey results' });
  }
});

app.get('/api/learner/notifications', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  if (!ENABLE_NOTIFICATIONS) {
    res.json({
      ok: true,
      data: [],
      notificationsDisabled: true,
      requestId: req.requestId ?? null,
    });
    return;
  }

  const limit = clampNumber(parseInt(req.query.limit, 10) || 20, 1, 100);
  const sinceIso = typeof req.query.since === 'string' ? req.query.since : null;
  const readFilter = typeof req.query.read === 'string' ? req.query.read.trim().toLowerCase() : null;

  if (isDemoOrTestMode) {
    res.json({ ok: true, data: [], requestId: req.requestId ?? null });
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
        .in('organization_id', orgIds)
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(limit),
    );
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

    res.json({
      ok: true,
      requestId: req.requestId ?? null,
      data: merged.slice(0, limit).map(mapNotificationRecord),
    });
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('learner.fetch', { code: error.code });
      res.json({
        ok: true,
        data: [],
        degraded: true,
        notificationsDisabled: true,
        requestId: req.requestId ?? null,
      });
      return;
    }
    if (isMissingColumnError(error)) {
      logger.warn('learner_notifications_schema_mismatch', {
        code: error.code,
        message: error.message,
      });
      res.json({
        ok: true,
        data: [],
        degraded: true,
        reason: 'schema_missing_column',
        requestId: req.requestId ?? null,
      });
      return;
    }
    console.error('Failed to load learner notifications:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_fetch_failed',
      message: 'Unable to load notifications',
      requestId: req.requestId ?? null,
    });
  }
});

app.post('/api/learner/notifications/:id/read', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  if (!ENABLE_NOTIFICATIONS) {
    res.json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
    return;
  }
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;

  try {
    const existing = await supabase
      .from('notifications')
      .select('id, organization_id, org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) {
      if (isNotificationsTableMissingError(existing.error)) {
        logNotificationsMissingTable('learner.markRead.lookup', { code: existing.error.code });
        res.json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
        return;
      }
      throw existing.error;
    }

    const note = existing.data;
    if (!note) {
      res.status(404).json({
        ok: false,
        code: 'not_found',
        message: 'Notification not found',
        requestId: req.requestId ?? null,
      });
      return;
    }

    const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);
    if (note.user_id) {
      if (note.user_id !== context.userId) {
        res.status(403).json({
          ok: false,
          code: 'forbidden',
          message: 'Cannot modify another user\'s notification',
          requestId: req.requestId ?? null,
        });
        return;
      }
    } else if (noteOrgId) {
      const access = await requireOrgAccess(req, res, noteOrgId, { write: false });
      if (!access) return;
    } else {
      res.status(403).json({
        ok: false,
        code: 'forbidden',
        message: 'Cannot modify global notification',
        requestId: req.requestId ?? null,
      });
      return;
    }

    const data = notificationService
      ? await notificationService.markNotificationRead(id, true)
      : null;

    res.json({
      ok: true,
      requestId: req.requestId ?? null,
      data: mapNotificationRecord(data),
    });
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('learner.markRead.catch', { message: error?.message });
      res.json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
      return;
    }
    console.error('Failed to update learner notification status:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_update_failed',
      message: 'Unable to update notification',
      requestId: req.requestId ?? null,
    });
  }
});

app.delete('/api/learner/notifications/:id', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  if (!ENABLE_NOTIFICATIONS) {
    res.status(200).json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
    return;
  }
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;

  try {
    const existing = await supabase
      .from('notifications')
      .select('id, organization_id, org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) {
      if (isNotificationsTableMissingError(existing.error)) {
        logNotificationsMissingTable('learner.delete.lookup', { code: existing.error.code });
        res.status(204).end();
        return;
      }
      throw existing.error;
    }

    const note = existing.data;
    if (!note) {
      res.status(204).end();
      return;
    }

    const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);
    if (note.user_id) {
      if (note.user_id !== context.userId) {
        res.status(403).json({
          ok: false,
          code: 'forbidden',
          message: 'Cannot delete another user\'s notification',
          requestId: req.requestId ?? null,
        });
        return;
      }
    } else if (noteOrgId) {
      const access = await requireOrgAccess(req, res, noteOrgId, { write: false });
      if (!access) return;
    } else {
      res.status(403).json({
        ok: false,
        code: 'forbidden',
        message: 'Cannot delete global notification',
        requestId: req.requestId ?? null,
      });
      return;
    }

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      if (isNotificationsTableMissingError(error)) {
        logNotificationsMissingTable('learner.delete.remove', { code: error.code });
        res.status(204).end();
        return;
      }
      throw error;
    }

    if (note.user_id) {
      broadcastToTopic(`notifications:user:${String(note.user_id).trim().toLowerCase()}`, {
        type: 'notification_deleted',
        data: { id },
      });
    } else if (noteOrgId) {
      broadcastToTopic(`notifications:org:${noteOrgId}`, {
        type: 'notification_deleted',
        data: { id },
      });
    }

    res.status(204).end();
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('learner.delete.catch', { message: error?.message });
      res.status(204).end();
      return;
    }
    console.error('Failed to delete learner notification:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_delete_failed',
      message: 'Unable to delete notification',
      requestId: req.requestId ?? null,
    });
  }
});

// Notifications
app.get('/api/admin/crm/summary', requireAdminAccess, asyncHandler(async (req, res) => {
  const summary = await loadCrmSummary();
  res.json({
    data: summary,
    requestId: req.requestId ?? null,
  });
}));

app.get('/api/admin/crm/activity', requireAdminAccess, asyncHandler(async (req, res) => {
  const activity = await loadCrmActivity();
  res.json({
    data: activity,
    requestId: req.requestId ?? null,
  });
}));

app.get('/api/admin/notifications', async (req, res) => {
  if (!ENABLE_NOTIFICATIONS) {
    res.json(buildDisabledNotificationsResponse(1, 25, req.requestId ?? null));
    return;
  }
  if (isDemoOrTestMode) {
    const { page, pageSize } = parsePaginationParams(req, { defaultSize: 25, maxSize: 200 });
    res.json(buildDisabledNotificationsResponse(page, pageSize, req.requestId ?? null));
    return;
  }
  if (!ensureSupabase(res)) return;
  const context = requireUserContext(req, res);
  if (!context) return;

  const isAdmin = context.userRole === 'admin';
  const requestedOrgId = normalizeOrgIdValue(req.query.org_id ?? req.query.orgId ?? null);
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
      if (!access) {
        return res.status(403).json({ ok: false, error: 'forbidden', code: 'org_access_denied' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden', code: 'org_id_required', message: 'org_id is required for non-admin users' });
    }

    let query = supabase
      .from('notifications')
      .select(
        'id,title,body,organization_id,org_id,user_id,created_at,read,dispatch_status,channels,metadata,scheduled_for,delivered_at',
        {
          count: 'exact',
        },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (requestedOrgId) {
      query = query.or(`organization_id.eq.${requestedOrgId},org_id.eq.${requestedOrgId}`);
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
    if (error) {
      if (isNotificationsTableMissingError(error)) {
        logNotificationsMissingTable('admin.list', { code: error.code });
      res.json(buildDisabledNotificationsResponse(page, pageSize, req.requestId ?? null));
        return;
      }
      throw error;
    }

    res.json({
      ok: true,
      requestId: req.requestId ?? null,
      data: (data || []).map(mapNotificationRecord),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: to + 1 < (count || 0),
      },
    });
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('admin.list.catch', { message: error?.message });
      res.json(buildDisabledNotificationsResponse(page, pageSize, req.requestId ?? null));
      return;
    }
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_fetch_failed',
      message: 'Unable to fetch notifications',
      requestId: req.requestId ?? null,
    });
  }
});

app.post('/api/admin/notifications', async (req, res) => {
  if (!ENABLE_NOTIFICATIONS) {
    res.status(202).json({
      ok: true,
      data: null,
      notificationsDisabled: true,
      requestId: req.requestId ?? null,
    });
    return;
  }
  if (isDemoOrTestMode) {
    res.status(202).json({
      ok: true,
      data: null,
      notificationsDisabled: true,
      requestId: req.requestId ?? null,
    });
    return;
  }
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';
  const targetOrgId = normalizeOrgIdValue(payload.orgId ?? payload.organizationId ?? null);

  if (!payload.title) {
    res.status(400).json({
      ok: false,
      code: 'title_required',
      message: 'title is required',
      requestId: req.requestId ?? null,
      queryName: 'admin_notifications_create',
    });
    return;
  }

  if (targetOrgId) {
    const access = await requireOrgAccess(req, res, targetOrgId, { write: true });
    if (!access) {
      return res.status(403).json({ ok: false, error: 'forbidden', code: 'org_access_denied' });
    }
  } else if (payload.userId) {
    if (!isAdmin && payload.userId !== context.userId) {
      res.status(403).json({
        ok: false,
        code: 'forbidden',
        message: 'Cannot create notifications for another user',
        requestId: req.requestId ?? null,
      });
      return;
    }
  } else if (!isAdmin) {
    res.status(403).json({
      ok: false,
      code: 'forbidden',
      message: 'Only admins can create global notifications',
      requestId: req.requestId ?? null,
    });
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
      organization_id: targetOrgId ?? null,
      user_id: payload.userId ?? null,
      read: payload.read ?? false,
      channels,
      scheduled_for: scheduledFor,
      dispatch_status: dispatchStatus,
      metadata: payload.metadata ?? {},
    };

    const _notifInsert = await supabase
      .from('notifications')
      .insert(insertPayload)
      .select('*');
    const data = firstRow(_notifInsert);
    const error = _notifInsert.error;

    if (error) {
      if (isNotificationsTableMissingError(error)) {
        logNotificationsMissingTable('admin.create', { code: error.code });
        res.status(202).json({
          ok: true,
          data: null,
          notificationsDisabled: true,
          requestId: req.requestId ?? null,
        });
        return;
      }
      throw error;
    }

    if (!scheduledFor && notificationDispatcher?.enqueueDispatch) {
      notificationDispatcher.enqueueDispatch({
        notificationId: data?.id,
        channels,
        sendEmail: sendEmailFlag,
      });
    }

    res.status(201).json({
      ok: true,
      requestId: req.requestId ?? null,
      data: mapNotificationRecord(data),
    });
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('admin.create.catch', { message: error?.message });
      res.status(202).json({
        ok: true,
        data: null,
        notificationsDisabled: true,
        requestId: req.requestId ?? null,
      });
      return;
    }
    console.error('Failed to create notification:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_create_failed',
      message: 'Unable to create notification',
      requestId: req.requestId ?? null,
    });
  }
});

app.post('/api/admin/notifications/broadcast', requireAdminAccess, asyncHandler(async (req, res) => {
  if (!ENABLE_NOTIFICATIONS || !notificationService) {
    res.status(202).json({
      ok: true,
      data: null,
      notificationsDisabled: true,
      requestId: req.requestId ?? null,
    });
    return;
  }
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!title || !message) {
    res.status(400).json({ error: 'notification_title_and_message_required', message: 'Title and message are required.' });
    return;
  }

  const maxTargets = Math.min(Number(payload.maxTargets) || 200, 500);
  const targetScope = (payload.audience || payload.scope || 'custom').toString().toLowerCase();
  const initialOrgIds = coerceIdArray(payload.organizationIds ?? payload.organization_ids ?? []);
  const initialUserIds = coerceIdArray(payload.userIds ?? payload.user_ids ?? []);
  const includeAllOrgs = parseFlag(payload.allOrganizations ?? payload.includeAllOrganizations);
  const includeAllUsers = parseFlag(payload.allUsers ?? payload.includeAllUsers);

  const resolvedOrgIds = new Set(initialOrgIds);
  const resolvedUserIds = new Set(initialUserIds);

  const hydrateOrganizations = includeAllOrgs || targetScope === 'all_active_orgs';
  if (hydrateOrganizations) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('status', 'active')
        .order('updated_at', { ascending: false, nullsLast: false })
        .limit(maxTargets);
      if (error) throw error;
      (data || []).forEach((row) => row?.id && resolvedOrgIds.add(row.id));
    } catch (error) {
      logger.warn('notification_broadcast_org_fetch_failed', { message: error?.message || String(error) });
    }
  }

  const hydrateUsers = includeAllUsers || targetScope === 'all_active_users';
  if (hydrateUsers) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .order('updated_at', { ascending: false, nullsLast: false })
        .limit(maxTargets);
      if (error) throw error;
      (data || []).forEach((row) => row?.id && resolvedUserIds.add(row.id));
    } catch (error) {
      logger.warn('notification_broadcast_user_fetch_failed', { message: error?.message || String(error) });
    }
  }

  const targets = [];
  Array.from(resolvedOrgIds).slice(0, maxTargets).forEach((orgId) => {
    if (orgId) targets.push({ organizationId: orgId, recipientType: 'organization' });
  });
  Array.from(resolvedUserIds).slice(0, maxTargets).forEach((userId) => {
    if (userId) targets.push({ userId, recipientType: 'user' });
  });

  if (!targets.length) {
    res.status(400).json({ error: 'notification_targets_required', message: 'Provide at least one organization or user target.' });
    return;
  }

  const channel = (payload.channel || 'in_app').toString().toLowerCase();
  const priority = (payload.priority || 'normal').toString().toLowerCase();
  const metadata = typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {};
  const results = [];
  let failures = 0;

  for (const target of targets) {
    try {
      const record = await notificationService.createNotification({
        title,
        body: message,
        organizationId: target.organizationId ?? null,
        userId: target.userId ?? null,
        channel,
        priority,
        metadata: {
          ...metadata,
          audience: targetScope,
        },
      });
      results.push(mapNotificationRecord(record));
    } catch (error) {
      failures += 1;
      logger.warn('notification_broadcast_target_failed', {
        target,
        message: error?.message || String(error),
      });
    }
  }

  logger.info('notification_broadcast_sent', {
    requestId: req.requestId ?? null,
    totalTargets: targets.length,
    delivered: results.length,
    failures,
  });

  res.status(results.length > 0 ? 201 : 202).json({
    ok: results.length > 0,
    data: results,
    meta: {
      requested: targets.length,
      delivered: results.length,
      failed: failures,
    },
    requestId: req.requestId ?? null,
  });
}));

app.post('/api/admin/notifications/:id/read', async (req, res) => {
  if (!ENABLE_NOTIFICATIONS) {
    res.json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
    return;
  }
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const { read = true } = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('organization_id, org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) {
      if (isNotificationsTableMissingError(existing.error)) {
        logNotificationsMissingTable('admin.markRead.lookup', { code: existing.error.code });
        res.json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
        return;
      }
      throw existing.error;
    }
    const note = existing.data;
    if (!note) {
      res.status(404).json({
        ok: false,
        code: 'not_found',
        message: 'Notification not found',
        requestId: req.requestId ?? null,
      });
      return;
    }

    const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({
            ok: false,
            code: 'forbidden',
            message: 'Cannot modify another user\'s notification',
            requestId: req.requestId ?? null,
          });
          return;
        }
      } else if (noteOrgId) {
        const access = await requireOrgAccess(req, res, noteOrgId);
        if (!access) return;
      } else {
        res.status(403).json({
          ok: false,
          code: 'forbidden',
          message: 'Cannot modify global notification',
          requestId: req.requestId ?? null,
        });
        return;
      }
    }

    const _notifUpdate = await supabase
      .from('notifications')
      .update({ read })
      .eq('id', id)
      .select('*');
    const data = firstRow(_notifUpdate);
    const error = _notifUpdate.error;

    if (error) {
      if (isNotificationsTableMissingError(error)) {
        logNotificationsMissingTable('admin.markRead.update', { code: error.code });
        res.json({ data: null, notificationsDisabled: true });
        return;
      }
      throw error;
    }
    res.json({
      ok: true,
      requestId: req.requestId ?? null,
      data: mapNotificationRecord(data),
    });
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('admin.markRead.catch', { message: error?.message });
      res.json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
      return;
    }
    console.error('Failed to update notification status:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_update_failed',
      message: 'Unable to update notification',
      requestId: req.requestId ?? null,
    });
  }
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  if (!ENABLE_NOTIFICATIONS) {
    res.status(200).json({ ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null });
    return;
  }
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
  if (!resolvedCourseId) {
    res.locals = res.locals || {};
    res.locals.errorCode = 'course_not_found';
    res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
    return;
  }
  const courseId = resolvedCourseId;
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('organization_id, org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) {
      if (isNotificationsTableMissingError(existing.error)) {
        logNotificationsMissingTable('admin.delete.lookup', { code: existing.error.code });
        res.status(204).end();
        return;
      }
      throw existing.error;
    }
    const note = existing.data;
    if (!note) {
      res.status(200).json({ ok: true, requestId: req.requestId ?? null });
      return;
    }

    const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({
            ok: false,
            code: 'forbidden',
            message: 'Cannot delete another user\'s notification',
            requestId: req.requestId ?? null,
          });
          return;
        }
      } else if (noteOrgId) {
        const access = await requireOrgAccess(req, res, noteOrgId, { write: true });
        if (!access) return;
      } else {
        res.status(403).json({
          ok: false,
          code: 'forbidden',
          message: 'Cannot delete global notification',
          requestId: req.requestId ?? null,
        });
        return;
      }
    }

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      if (isNotificationsTableMissingError(error)) {
        logNotificationsMissingTable('admin.delete.exec', { code: error.code });
        res.status(200).json({ ok: true, requestId: req.requestId ?? null });
        return;
      }
      throw error;
    }
    res.status(200).json({ ok: true, requestId: req.requestId ?? null });
  } catch (error) {
    if (isNotificationsTableMissingError(error)) {
      logNotificationsMissingTable('admin.delete.catch', { message: error?.message });
      res.status(200).json({ ok: true, requestId: req.requestId ?? null });
      return;
    }
    console.error('Failed to delete notification:', error);
    res.status(500).json({
      ok: false,
      code: 'notifications_delete_failed',
      message: 'Unable to delete notification',
      requestId: req.requestId ?? null,
    });
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

  if (isDemoOrTestMode) {
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
    return sendApiResponse(res, filtered.slice(0, limit), {
      code: 'analytics_events_loaded',
      message: 'Analytics events loaded.',
      meta: {
        pagination: { limit, hasMore: filtered.length > limit },
        demo: true,
      },
    });
  }

  if (!ensureSupabase(res)) return;

  if (!context.isPlatformAdmin && !resolvedOrgIds.size) {
    return sendApiResponse(res, [], {
      code: 'analytics_events_loaded',
      message: 'Analytics events loaded.',
      meta: {
        pagination: { limit, hasMore: false },
        reason: 'org_scope_required',
      },
    });
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
    return sendApiResponse(res, rows, {
      code: 'analytics_events_loaded',
      message: 'Analytics events loaded.',
      meta: {
        pagination: { limit, hasMore: rows.length === limit },
      },
    });
  } catch (error) {
    console.error('[analytics.events] fetch_failed', {
      requestId: req.requestId,
      message: error?.message || error,
    });
    sendApiError(res, 500, 'analytics_events_fetch_failed', 'Unable to fetch analytics events', {
      requestId: req.requestId ?? null,
    });
  }
});

const resolveAnalyticsOrgId = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeOrgIdValue(candidate);
    if (normalized && isUuid(normalized)) {
      return normalized;
    }
  }
  return null;
};

const analyticsOrgWarning = (() => {
  const interval = 10 * 60_000;
  const lastWarnings = new Map();
  return (subject, meta = {}) => {
    const key = subject || 'anonymous';
    const now = Date.now();
    const last = lastWarnings.get(key) || 0;
    if (now - last < interval) {
      return;
    }
    lastWarnings.set(key, now);
    logger.warn('analytics_event_missing_org', { subject: key, ...meta });
  };
})();

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

  const context = getRequestContext(req);
  const allowHeaderWithoutMembership = !req.user || (req.membershipStatus && req.membershipStatus !== 'ready');
  const isPlatformAdmin = context.isPlatformAdmin;
  const headerOrgId = getHeaderOrgId(req, { requireMembership: !allowHeaderWithoutMembership && !isPlatformAdmin }) || null;
  const cookieOrgId = getActiveOrgFromRequest(req);
  const payloadOrgId = normalizeOrgIdValue(org_id ?? req.body?.orgId ?? null);

  const membershipOrgId =
    (Array.isArray(context.organizationIds) ? context.organizationIds.filter(Boolean) : [])
      .map((id) => normalizeOrgIdValue(id)).find(Boolean) ||
    normalizeOrgIdValue(context.activeOrgId);

  let resolvedOrgId = headerOrgId || membershipOrgId || cookieOrgId || payloadOrgId || null;

  if (!resolvedOrgId && isPlatformAdmin) {
    resolvedOrgId = membershipOrgId || cookieOrgId || payloadOrgId || null;
    console.info('[admin-auth] resolved_org_for_platform_admin', {
      requestId: req.requestId ?? null,
      userId: context.userId,
      headerOrgId,
      membershipOrgId,
      cookieOrgId,
      payloadOrgId,
      resolvedOrgId,
    });
  }

  const sanitizedPayload = scrubAnalyticsPayload(payload ?? {});

  const normalizedEvent = event_type.trim();
  const rawClientEventId = typeof id === 'string' ? id.trim() : null;
  const normalizedClientEventId = rawClientEventId || null;
  const useCustomPrimaryKey = normalizedClientEventId ? isUuid(normalizedClientEventId) : false;

  function respondQueued(meta = {}, statusCode = 202) {
    return sendApiResponse(
      res,
      {
        status: 'queued',
        stored: false,
        missingOrgContext: false,
        ...meta,
      },
      {
        statusCode,
        code: 'analytics_event_queued',
        message: 'Analytics event queued.',
      },
    );
  }
  function respondStored(meta = {}) {
    return sendApiResponse(
      res,
      {
        status: 'stored',
        stored: true,
        missingOrgContext: false,
        ...meta,
      },
      {
        statusCode: 200,
        code: 'analytics_event_stored',
        message: 'Analytics event stored.',
      },
    );
  }

  if (!resolvedOrgId) {
    const warningKey = req.user?.userId || req.user?.id || `anon:${req.ip ?? 'unknown'}`;
    analyticsOrgWarning(warningKey, {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id || null,
      headerOrgId,
      payloadOrgId,
      cookieOrgId,
      membershipStatus: req.membershipStatus || 'unknown',
    });
    respondQueued({ missingOrgContext: true, skipped: 'missing_org' });
    return;
  }

  if (isDemoOrTestMode) {
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
    // Sanitize user_id: only store valid UUIDs, never emails
    const sanitizedUserId = user_id && isUuid(user_id) ? user_id : null;
    const insertPayload = {
      user_id: sanitizedUserId,
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

    let _analInsert = await supabase
      .from('analytics_events')
      .insert(insertPayload)
      .select('*');
    let data = firstRow(_analInsert);
    let error = _analInsert.error;

    if (error) {
      const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
      if (missingColumn === 'client_event_id') {
        logger.warn('analytics_events_client_event_id_missing', {
          message: error.message,
          code: error.code,
        });
        delete insertPayload.client_event_id;
        _analInsert = await supabase
          .from('analytics_events')
          .insert(insertPayload)
          .select('*');
        data = firstRow(_analInsert);
        error = _analInsert.error;
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
    console.info('[audit-log] missing authenticated user; acknowledging best-effort', {
      requestId: req.requestId ?? null,
      bodyUserId: userId || user_id || null,
      bodyOrgId: orgId || org_id || null,
    });
  }
  const sessionUserId = sessionUser?.userId || sessionUser?.id || userId || user_id || null;

  const normalizedAction = typeof action === 'string' ? action.trim() : '';
  if (!normalizedAction) {
    sendApiError(res, 400, 'validation_failed', 'Action is required.', {
      meta: { requestId: req.requestId ?? null },
    });
    return;
  }

  const normalizedOrgId = normalizeOrgIdValue(orgId ?? org_id ?? null);
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: normalizedAction,
    details,
    user_id: sessionUserId ?? userId ?? user_id ?? null,
    organization_id: normalizedOrgId ?? null,
    org_id: normalizedOrgId ?? null,
    timestamp: timestamp || new Date().toISOString(),
  };

  const respondOk = (data = {}, meta = {}) =>
    sendApiResponse(res, data, {
      code: 'audit_log_recorded',
      message: 'Audit log request processed.',
      meta: {
        requestId: req.requestId ?? null,
        ...meta,
      },
    });

  if (isDemoOrTestMode) {
    e2eStore.auditLogs.unshift(entry);
    if (e2eStore.auditLogs.length > 500) {
      e2eStore.auditLogs.length = 500;
    }
    persistE2EStore();
    respondOk({ stored: true, entry }, { demo: true });
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

app.post('/api/analytics/journeys', authenticate, resolveOrganizationContext, async (req, res) => {
  const sessionUserId = req.userId ?? null;
  const sessionOrgId = req.organizationId ?? null;
  if (!sessionUserId) {
    res.status(401).json({ error: 'authentication_required' });
    return;
  }
  if (!sessionOrgId) {
    res.status(200).json({
      ok: true,
      disabled: true,
      requestId: req.requestId ?? null,
      meta: { reason: 'organization_context_required' },
    });
    return;
  }
  const allowOverride = String(req.user?.platformRole || '').toLowerCase() === 'platform_admin';
  const rawUserId = typeof req.body?.user_id === 'string' ? req.body.user_id.trim() : null;
  const rawOrgId = typeof req.body?.organization_id === 'string' ? req.body.organization_id.trim() : null;
  const userId = allowOverride && rawUserId ? rawUserId : sessionUserId;
  const organizationId = allowOverride && rawOrgId ? rawOrgId : sessionOrgId;

  // Guard: userId must be a valid UUID before attempting any DB write.
  // Client-side bugs can send email addresses instead of UUIDs (e.g. user.email used as learnerId).
  if (!isUuid(userId)) {
    res.status(400).json({ error: 'invalid_user_id', message: 'user_id must be a valid UUID.' });
    return;
  }

  // Guard: organizationId must also be a valid UUID.
  if (!isUuid(organizationId)) {
    res.status(400).json({ error: 'invalid_organization_id', message: 'organization_id must be a valid UUID.' });
    return;
  }

  const { course_id, journey } = req.body || {};

  if (!course_id) {
    res.status(400).json({ error: 'course_id_required' });
    return;
  }

  const payload = {
    user_id: userId,
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
    organization_id: organizationId,
  };

  if (isDemoOrTestMode) {
    const key = `${userId}:${course_id}`;
    e2eStore.learnerJourneys.set(key, { id: key, ...payload });
    persistE2EStore();
    res.status(201).json({ data: e2eStore.learnerJourneys.get(key), demo: true });
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const _journeyUpsert = await supabase
      .from('learner_journeys')
      .upsert(payload, { onConflict: 'user_id,course_id' })
      .select('*');

    if (_journeyUpsert.error) throw _journeyUpsert.error;
    res.status(201).json({ ok: true, data: firstRow(_journeyUpsert), requestId: req.requestId ?? null });
  } catch (error) {
    const tableMissing =
      error?.code === 'PGRST205' ||
      (typeof error?.message === 'string' && /learner_journeys/i.test(error.message));
    if (tableMissing) {
      console.warn('[analytics.journeys] learner_journeys_unavailable', {
        route: '/api/analytics/journeys',
        requestId: req.requestId ?? null,
      });
      res.status(200).json({
        ok: true,
        disabled: true,
        requestId: req.requestId ?? null,
        meta: { reason: 'journeys_unavailable' },
      });
      return;
    }
    logStructuredError('[analytics.journeys] upsert_failed', error, {
      route: '/api/analytics/journeys',
      userId,
      organizationId,
      course_id,
    });
    res.status(500).json({
      ok: false,
      code: error?.code ?? 'journey_upsert_failed',
      message: error?.message ?? 'Unable to save learner journey.',
      hint: error?.hint ?? null,
      requestId: req.requestId ?? null,
      queryName: 'analytics_journeys_upsert',
    });
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

app.get('/api/analytics/journeys', authenticate, resolveOrganizationContext, async (req, res) => {
  const sessionUserId = req.userId ?? null;
  const sessionOrgId = req.organizationId ?? null;
  if (!sessionUserId) {
    res.status(401).json({ error: 'authentication_required' });
    return;
  }
  if (!sessionOrgId) {
    res.status(200).json({
      ok: true,
      data: [],
      disabled: true,
      requestId: req.requestId ?? null,
      meta: { reason: 'organization_context_required' },
    });
    return;
  }
  const allowOverride = String(req.user?.platformRole || '').toLowerCase() === 'platform_admin';
  const queryUserId = typeof req.query?.user_id === 'string' ? req.query.user_id.trim() : null;
  const queryOrgId =
    typeof req.query?.org_id === 'string'
      ? req.query.org_id.trim()
      : typeof req.query?.orgId === 'string'
        ? req.query.orgId.trim()
        : null;
  const effectiveUserId = allowOverride && queryUserId ? queryUserId : sessionUserId;
  const effectiveOrgId = allowOverride && queryOrgId ? queryOrgId : sessionOrgId;
  const course_id = typeof req.query?.course_id === 'string' ? req.query.course_id.trim() : null;
  const sinceIso = parseIsoTimestamp(req.query?.since || req.query?.since_at);
  const limit = clampJourneyLimit(req.query?.limit);
  console.log('[analytics.journeys] request', {
    requestId: req.requestId,
    user_id: effectiveUserId,
    course_id: course_id || null,
    org_id: effectiveOrgId,
    since: sinceIso,
    limit,
  });

  if (isDemoOrTestMode) {
    let data = Array.from(e2eStore.learnerJourneys.values());
    if (effectiveUserId) {
      data = data.filter((journey) => journey.user_id === effectiveUserId);
    }
    if (course_id) {
      data = data.filter((journey) => journey.course_id === course_id);
    }
    if (effectiveOrgId) {
      data = data.filter((journey) => journey.org_id === effectiveOrgId);
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

    if (effectiveUserId) {
      query = query.eq('user_id', effectiveUserId);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    if (effectiveOrgId) {
      query = query.eq('org_id', effectiveOrgId);
    }

    if (sinceIso) {
      query = query.gte('created_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    const events = Array.isArray(data) ? data : [];
    const payload = summarizeEventsAsJourneys(events);

    res.json({
      ok: true,
      data: payload,
      requestId: req.requestId ?? null,
      meta: {
        scannedEvents: events.length,
        limit,
        since: sinceIso,
        filters: {
          user_id: effectiveUserId,
          course_id: course_id || null,
          org_id: effectiveOrgId,
        },
      },
    });
  } catch (error) {
    const tableMissing =
      error?.code === 'PGRST205' ||
      (typeof error?.message === 'string' && /learner_journeys/i.test(error.message));
    if (tableMissing) {
      console.warn('[analytics.journeys] learner_journeys_unavailable', {
        route: '/api/analytics/journeys',
        requestId: req.requestId ?? null,
      });
      res.status(200).json({
        ok: true,
        data: [],
        requestId: req.requestId ?? null,
        meta: { disabled: true, reason: 'journeys_unavailable' },
      });
      return;
    }
    logStructuredError('[analytics.journeys] fetch_failed', error, {
      route: '/api/analytics/journeys',
      userId: effectiveUserId,
      orgId: effectiveOrgId,
    });
    res.status(500).json({
      ok: false,
      code: error?.code ?? 'journey_fetch_failed',
      message: error?.message ?? 'Unable to load learner journeys.',
      hint: error?.hint ?? null,
      requestId: req.requestId ?? null,
      queryName: 'analytics_journeys_fetch',
    });
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

// ─── Domain Separation ────────────────────────────────────────────────────────
// In production, api.the-huddle.co is a pure API server.  The SPA is deployed
// to Netlify at https://the-huddle.co.  We must never serve index.html or any
// frontend asset from the API domain in production.
//
// Detection: Railway sets NODE_ENV=production.  We also check the opt-in env
// var SERVE_SPA=true so that a self-hosted single-process deployment (one box
// running both API and SPA) keeps working without code changes.
//
// Local dev (NODE_ENV !== 'production') continues to serve the Vite dist output
// exactly as before so `npm run preview` / E2E runs are unaffected.
// ─────────────────────────────────────────────────────────────────────────────
const SERVE_SPA = !isProduction || String(process.env.SERVE_SPA || '').toLowerCase() === 'true';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://the-huddle.co';

if (SERVE_SPA) {
  // Non-production (local dev / E2E / single-process self-hosted):
  // Serve static assets and fall back to index.html for client-side routing.
  // For E2E runs and local dev we want to avoid stale cached assets.
  app.use('/assets', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  app.use(express.static(distPath));

  // Root: serve SPA shell
  app.get('/', (_req, res) => {
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    return res.status(200).send('OK');
  });

  // SPA fallback — serve index.html for unknown client-side routes
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/_next')) return next();
    const indexFile = path.join(distPath, 'index.html');
    res.sendFile(indexFile, (err) => {
      if (err) return next(err);
    });
  });
} else {
  // Production API-only mode (api.the-huddle.co on Railway):
  // The SPA lives on Netlify.  Hitting the API root in a browser is almost
  // always a misconfiguration — return a helpful JSON response and, for
  // browsers that sent an Accept: text/html header, also emit a 302 so the
  // browser lands on the real app automatically.

  app.get('/', (req, res) => {
    const wantHtml = (req.headers.accept || '').includes('text/html');
    if (wantHtml) {
      // Browser navigation: redirect to the Netlify frontend.
      return res.redirect(302, FRONTEND_URL);
    }
    // curl / Postman / health-check ping: return JSON.
    return res.status(200).json({
      ok: true,
      service: 'api',
      message: `Use ${FRONTEND_URL} for the web app`,
    });
  });

  // Any other non-API GET that slips through (e.g. /favicon.ico, /robots.txt)
  // also gets the JSON response so we never accidentally serve HTML from dist.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/_next')) return next();
    return res.status(200).json({
      ok: true,
      service: 'api',
      message: `Use ${FRONTEND_URL} for the web app`,
    });
  });
}

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

app.use((err, req, res, next) => {
  const payload = {
    requestId: req.requestId || null,
    path: req.originalUrl,
    method: req.method,
    message: err?.message || String(err),
    code: err?.code || null,
  };
  emitConsolePayload('[express] unhandled_error', payload);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err?.status || err?.statusCode || 500).json({
    ok: false,
    code: err?.code || 'internal_error',
    message: err?.message || 'Internal server error',
    requestId: req.requestId || null,
  });
});

// Use the structured API error handler for all errors
app.use(apiErrorHandler);

const server = http.createServer(app);

startupChecksPromise
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Serving production build from ${distPath} at http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('[startup] refusing_to_listen_due_to_failed_startup_checks', {
      message: error?.message || String(error),
    });
    process.exit(1);
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
