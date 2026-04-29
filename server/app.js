import express from 'express';
import cookieParser from 'cookie-parser';
import { attachRequestId, apiErrorHandler } from './middleware/apiErrorHandler.js';
import { apiLimiter, securityHeaders, authenticate } from './middleware/auth.js';
import requireAdminAccess from './middleware/requireAdminAccess.js';
import adminOrganizationsRouter from './routes/adminOrganizations.js';
import supabaseJwtMiddleware from './middleware/supabaseJwt.js';
import authRoutes from './routes/auth.js';
import adminUsersRouter from './routes/admin-users.js';
import { requireAdmin } from './middleware/auth.js';
import { isDemoMode, E2E_TEST_MODE } from './config/runtimeFlags.js';
import { e2eBypass } from './middleware/e2eBypass.js';
import { createAdminSurveysRouter } from './routes/adminSurveys.js';
import { createAdminNotificationsRouter } from './routes/adminNotifications.js';
import adminAnalyticsRouter from './routes/admin-analytics.js';
import adminCoursesRouter from './routes/admin-courses.js';
import mediaRouter from './routes/media.js';
import installCors from './middleware/cors.js';
import healthRouter from './routes/health.js';
import debugRlsRouter from './routes/debug-rls.js';
import mfaRoutes from './routes/mfa.js';
import analyticsRouter from './routes/analytics.js';
import { setDoubleSubmitCSRF } from './middleware/csrf.js';

export default function createApp(deps = {}, existingApp = null) {
  const app = existingApp || express();
  const logger = (deps && deps.logger) || console;

  // Central guarded E2E bypass middleware (registered once)
  // This middleware is implemented in `server/middleware/e2eBypass.js` and
  // only synthesizes an admin user when E2E_TEST_MODE=true and not in production.
  app.use(e2eBypass);

  // Global request tracing and watchdog
  app.use((req, res, next) => {
    const start = Date.now();
    req._trace = req._trace || {};
    req._trace.startAt = start;
    const meta = { method: req.method, path: req.originalUrl || req.url, requestId: req.requestId || null };
    console.info('[REQ START]', meta);

    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);

    const logResSend = (body) => {
      try {
        const bodyPreview = typeof body === 'object' ? '[object]' : String(body).slice(0, 200);
        console.info('[RES SEND]', { ...meta, durationMs: Date.now() - start, status: res.statusCode, bodyPreview });
      } catch (e) {
        // ignore
      }
    };

    res.json = function patchedJson(body) {
      logResSend(body);
      return origJson(body);
    };

    res.send = function patchedSend(body) {
      logResSend(body);
      return origSend(body);
    };

    const watchdogMs = Number(process.env.REQUEST_WATCHDOG_MS || 5000);
    const watchdog = setTimeout(() => {
      try {
        const stack = new Error().stack;
        console.error('[REQUEST WATCHDOG] Slow request detected', { ...meta, elapsedMs: Date.now() - start, stack });
      } catch (e) {
        console.error('[REQUEST WATCHDOG] Slow request detected (stack unavailable)', { ...meta, elapsedMs: Date.now() - start });
      }
    }, watchdogMs);

    res.once('finish', () => {
      clearTimeout(watchdog);
      console.info('[REQ FINISH]', { ...meta, durationMs: Date.now() - start, status: res.statusCode });
    });

    try {
      return next();
    } catch (err) {
      clearTimeout(watchdog);
      next(err);
    }
  });

  // ...existing code...

  const JSON_BODY_LIMIT = process.env.API_JSON_BODY_LIMIT || '25mb';

  const normalizeProbePath = (value) => {
    try { return decodeURIComponent(value || ''); } catch { return value || ''; }
  };
  const isBlockedProbePath = (value) => {
    const pathname = normalizeProbePath(value).toLowerCase();
    return (/(^|\/)\.(env(?:\.[\w-]+)?|aws(?:\/|$)|boto$|git(?:\/|$)|svn(?:\/|$)|hg(?:\/|$)|npmrc$|yarnrc$)/.test(pathname) || /\.php(?:$|[/?#])/.test(pathname));
  };

  app.use((req, res, next) => {
    if (req.method === 'GET' && isBlockedProbePath(req.path || req.url)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    return next();
  });

  // Install CORS and other common middleware
  // Register modular routers and common middleware
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  installCors(app);
  app.set('etag', false);
  app.use(attachRequestId);
  app.use(cookieParser());
  app.use('/api/media', mediaRouter);
  app.use('/api', apiLimiter);
  app.use('/api', supabaseJwtMiddleware);
  app.use(setDoubleSubmitCSRF);

  app.get(['/api/health', '/health'], (deps && deps.respondWithHealthPayload) || ((_req, res) => res.json({ ok: true })));
  app.use('/api/auth', authRoutes);
  app.use('/api/debug', debugRlsRouter);
  app.use('/', healthRouter);

  // Mount routers that accept deps where available
  const isDemoOrTestMode = isDemoMode || E2E_TEST_MODE;
  app.use('/api/admin/organizations', authenticate, requireAdminAccess, adminOrganizationsRouter);
  if (!isDemoOrTestMode) app.use('/api/admin/users', authenticate, requireAdmin, adminUsersRouter);

  app.use('/api/admin/surveys', authenticate, requireAdmin, createAdminSurveysRouter(deps));
  app.use('/api/admin/notifications', authenticate, requireAdmin, createAdminNotificationsRouter(deps));
  app.use('/api/admin/analytics', authenticate, requireAdmin, adminAnalyticsRouter);
  app.use('/api/admin/courses', authenticate, requireAdmin, adminCoursesRouter);
  app.use('/api/media', authenticate, mediaRouter);

  // Admin subrouters and other endpoints
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/mfa', mfaRoutes);

  // Error handler after all routes
  app.use(apiErrorHandler);

  return app;
}
 
