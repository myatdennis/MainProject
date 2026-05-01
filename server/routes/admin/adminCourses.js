import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql, { getDatabaseConnectionInfo } from '../../db.js';
import { requireSupabaseAdminClient } from '../../lib/supabaseClient.js';
import { authenticate } from '../../middleware/authenticate.js';
import requireAdminAccess from '../../middleware/requireAdminAccess.js';
import { requireAdmin } from '../../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COURSE_IMPORT_TEMPLATE_PATH = path.join(__dirname, '../../docs/course-import-template.json');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

// Handler implementations (copied verbatim from index.js during extraction)
async function importTemplateHandler(_req, res) {
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
}

async function upsertCourseRpcHealthHandler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || null;
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  let rpcExists = null;
  let rpcError = null;

  if (!getDatabaseConnectionInfo().connectionStringDefined) {
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
}

async function bulkDeleteHandler(req, res) {
  const logger = req.app?.locals?.logger || console;
  let supabase;
  try {
    supabase = requireSupabaseAdminClient();
  } catch (err) {
    logger.error('bulk_delete_courses_failed', { reason: 'Supabase not configured' });
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { courseIds } = req.body || {};
  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    logger.warn('bulk_delete_courses_invalid_payload', { courseIds });
    return res.status(400).json({ error: 'courseIds array is required' });
  }
  logger.info('bulk_delete_courses_requested', {
    userId: req.user?.userId ?? null,
    courseIds,
    requestId: req.requestId ?? null,
  });
  try {
    // Delete from courses table
    const { error } = await supabase.from('courses').delete().in('id', courseIds);
    if (error) {
      logger.error('bulk_delete_courses_failed', { error: error.message, courseIds });
      return res.status(500).json({ error: error.message });
    }
    logger.info('bulk_delete_courses_success', {
      userId: req.user?.userId ?? null,
      courseIds,
      requestId: req.requestId ?? null,
    });
    return res.status(200).json({ success: true, deleted: courseIds });
  } catch (err) {
    logger.error('bulk_delete_courses_exception', { error: err?.message || String(err), courseIds });
    return res.status(500).json({ error: err?.message || 'Bulk delete failed' });
  }
}

export function registerAdminCoursesRoutes(app) {
  const router = express.Router();

  // Admin courses guard middleware (migrated from server/index.js)
  router.use((req, res, next) => {
    try {
      if (req.method && req.method.toUpperCase() === 'POST') {
        console.log('[ADMIN COURSES REQUEST]', {
          path: req.path,
          method: req.method,
          requestId: req.requestId ?? null,
          bodyPreview: (() => {
            try { return JSON.parse(JSON.stringify(req.body)).length ? '[body]' : '[body]'; } catch { return '[unserializable]'; }
          })(),
          user: req.user?.userId || req.user?.id || null,
          orgId: req.headers['x-org-id'] || req.body?.organizationId || req.body?.orgId || null,
        });
        const startStack = new Error().stack;
        const timeoutId = setTimeout(() => {
          try {
            if (!res.headersSent) {
              console.error('[TIMEOUT WARNING] admin courses handler slow', { path: req.path, requestId: req.requestId ?? null, startStack });
              res.status(503).json({ error: 'handler_timeout', message: 'Admin course handler timed out' });
            } else {
              console.error('[TIMEOUT WARNING] admin courses handler slow but headers already sent', { path: req.path, requestId: req.requestId ?? null, startStack });
            }
          } catch (e) {
            console.error('[TIMEOUT WARNING] failed to send timeout response', e?.message || e);
          }
        }, 2000);
        res.once('finish', () => clearTimeout(timeoutId));
      }
      // Wrap res.json for this mount so we can trace where org_id_required
      // responses originate from.
      try {
        const _origJson = res.json && res.json.bind(res);
        if (_origJson) {
          res.json = function (body) {
            try {
              const code = body && (body.code || (body.error && body.error.code));
              if (String(code) === 'org_id_required' || (body && body.error && typeof body.error.message === 'string' && body.error.message.includes('orgId query parameter')) ) {
                try {
                  console.error('[ORG_ID_REQUIRED TRACER] detected', {
                    path: req.originalUrl || req.url || null,
                    method: req.method || null,
                    requestId: req.requestId || null,
                    userId: req.user?.id || req.user?.userId || null,
                    stack: new Error().stack,
                  });
                } catch (e) {
                  // noop
                }
              }
            } catch (e) {
              // noop
            }
            return _origJson(body);
          };
        }
      } catch (e) {
        // noop
      }
    } catch (e) {
      (app && app.locals && app.locals.logger ? app.locals.logger.warn : console.warn)('[admin_courses_middleware] failed', { error: e?.message || e });
    }
    return next();
  });

  // Register handlers
  const adminAuth = [authenticate, requireAdminAccess];
  router.get('/import/template', ...adminAuth, asyncHandler(importTemplateHandler));
  router.get('/health/upsert-course-rpc', ...adminAuth, asyncHandler(upsertCourseRpcHealthHandler));
  router.post('/bulk-delete', ...adminAuth, asyncHandler(bulkDeleteHandler));

  app.use('/api/admin/courses', router);
}

export default null;
