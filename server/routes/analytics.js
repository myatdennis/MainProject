import express from 'express';
import { analyticsBatchSchema, analyticsEventIngestSchema } from '../validators.js';

const router = express.Router();

// Local standardized response helpers (keep shapes consistent with index.js)
const sendApiResponse = (res, data, options = {}) => {
  const { statusCode = 200, code = null, message = null, meta = null } = options;
  return res.status(statusCode).json({ ok: true, data: data ?? null, code, message, meta: meta && typeof meta === 'object' ? meta : null });
};

const sendApiError = (res, statusCode, code, message, extra = {}) => {
  const { meta = null, ...rest } = extra ?? {};
  const resolvedMeta = meta && typeof meta === 'object' ? meta : extra?.requestId ? { requestId: extra.requestId } : null;
  return res.status(statusCode).json({ ok: false, data: null, code: code ?? null, message: message ?? null, meta: resolvedMeta, ...rest });
};

// Batch ingestion (demo/E2E preferred)
router.post('/events/batch', async (req, res) => {
  const {
    supabase,
    ensureSupabase,
    e2eStore,
    persistE2EStore,
    isDemoOrTestMode,
    scrubAnalyticsPayload,
    normalizeOrgIdValue,
    logger,
  } = req.app.locals;

  const parsed = analyticsBatchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendApiError(res, 400, 'analytics_batch_invalid', 'Validation failed', {
      details: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      receivedKeys: Object.keys(req.body || {}),
    });
  }

  const { events } = parsed.data;
  if (!Array.isArray(events) || events.length === 0) {
    return sendApiResponse(res, null, { statusCode: 200, code: 'analytics_batch_empty', message: 'No analytics events to ingest.' });
  }

  const rows = events.map((evt) => {
    const id = evt.clientEventId || evt.client_event_id || `analytics-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const org = normalizeOrgIdValue(evt.orgId ?? evt.org_id ?? null);
    return {
      id,
      user_id: evt.userId ?? evt.user_id ?? null,
      org_id: org ?? null,
      course_id: evt.courseId ?? evt.course_id ?? null,
      lesson_id: evt.lessonId ?? evt.lesson_id ?? null,
      module_id: evt.moduleId ?? evt.module_id ?? null,
      event_type: (evt.eventType || evt.event_type || '').toString().trim(),
      session_id: evt.sessionId ?? evt.session_id ?? null,
      user_agent: evt.userAgent ?? evt.user_agent ?? null,
      payload: scrubAnalyticsPayload ? scrubAnalyticsPayload(evt.payload ?? {}) : (evt.payload || {}),
      client_event_id: evt.clientEventId || evt.client_event_id || null,
      created_at: evt.timestamp ? new Date(evt.timestamp).toISOString() : new Date().toISOString(),
    };
  });

  if (isDemoOrTestMode) {
    // prepend in demo store
    for (const r of rows.slice().reverse()) {
      e2eStore.analyticsEvents.unshift({ ...r });
    }
    if (e2eStore.analyticsEvents.length > 500) e2eStore.analyticsEvents.length = 500;
    try { persistE2EStore(); } catch (_) {}
    return sendApiResponse(res, { ingested: rows.length }, { statusCode: 201, code: 'analytics_batch_ingested', message: 'Analytics batch ingested.' });
  }

  if (!ensureSupabase(res)) return;

  try {
    // Attempt upsert into analytics_events; if schema is missing some columns, fall back to insert without them.
    let upsertResult = await supabase.from('analytics_events').upsert(rows, { onConflict: 'client_event_id' });
    if (upsertResult.error) {
      // legacy fallback: attempt insert with limited columns
      const fallbackRows = rows.map((r) => ({ id: r.id, user_id: r.user_id, org_id: r.org_id, course_id: r.course_id, lesson_id: r.lesson_id, module_id: r.module_id, event_type: r.event_type, session_id: r.session_id, user_agent: r.user_agent, payload: r.payload, created_at: r.created_at }));
      const insertResult = await supabase.from('analytics_events').insert(fallbackRows, { returning: 'minimal' });
      if (insertResult.error) throw insertResult.error;
    }
    return sendApiResponse(res, { ingested: rows.length }, { statusCode: 201, code: 'analytics_batch_ingested', message: 'Analytics batch ingested.' });
  } catch (error) {
    logger?.error?.('analytics_batch_ingest_failed', { error: error?.message || error });
    return sendApiError(res, 500, 'analytics_batch_failed', 'Unable to ingest analytics batch.', { message: error?.message ?? String(error) });
  }
});

// List events (demo/E2E or DB-backed)
router.get('/events', async (req, res) => {
  const { supabase, ensureSupabase, e2eStore, isDemoOrTestMode, normalizeOrgIdValue, sendApiResponse: _send, logger } = req.app.locals;
  // pagination and filters
  const limit = Math.min(Number(req.query.limit) || 50, 1000);
  let orgIdQuery = normalizeOrgIdValue(req.query?.org_id ?? req.query?.orgId ?? null);
  // Defensive: sometimes external callers send the literal string "undefined" — treat it as missing
  if (typeof orgIdQuery === 'string' && orgIdQuery.toLowerCase() === 'undefined') orgIdQuery = null;

  // Helpful diagnostics when debugging production/CI smoke runs
  try { logger?.info?.('[analytics.events] fetch_attempt', { requestId: req.requestId ?? null, query: req.query ?? null, orgIdQuery }); } catch (e) {}

  if (isDemoOrTestMode) {
    let events = Array.isArray(e2eStore.analyticsEvents) ? e2eStore.analyticsEvents : [];
    if (orgIdQuery) events = events.filter((e) => e.org_id === orgIdQuery);
    return sendApiResponse(res, events.slice(0, limit), { code: 'analytics_events_loaded', message: 'Analytics events loaded.' });
  }

  if (!ensureSupabase(res)) return;

  try {
  let query = supabase.from('analytics_events').select('*').order('created_at', { ascending: false }).limit(limit);
  if (orgIdQuery) query = query.eq('org_id', orgIdQuery);
  const { data, error } = await query;
    if (error) throw error;
    return sendApiResponse(res, Array.isArray(data) ? data : [], { code: 'analytics_events_loaded', message: 'Analytics events loaded.' });
  } catch (error) {
    console.error('[analytics.events] fetch_failed', { requestId: req.requestId, message: error?.message || error });
    return sendApiError(res, 500, 'analytics_events_fetch_failed', 'Unable to fetch analytics events', { requestId: req.requestId ?? null });
  }
});

// Single event ingest
router.post('/events', async (req, res) => {
  const {
    supabase,
    ensureSupabase,
    e2eStore,
    persistE2EStore,
    isDemoOrTestMode,
    scrubAnalyticsPayload,
    getRequestContext,
    getHeaderOrgId,
    getActiveOrgFromRequest,
    normalizeOrgIdValue,
    logger,
    isUuid,
    isAnalyticsClientEventDuplicate,
    firstRow,
    normalizeColumnIdentifier,
    extractMissingColumnName,
    processGamificationEvent,
    upsertOrgEngagementMetrics,
    sql,
  } = req.app.locals;

  const parseResult = analyticsEventIngestSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    res.status(400).json({ ok: false, error: 'ANALYTICS_PAYLOAD_INVALID', message: 'Validation failed', details: parseResult.error.issues.map((i) => ({ path: i.path, message: i.message })), receivedKeys: Object.keys(req.body || {}) });
    return;
  }

  const { id, user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload, org_id } = parseResult.data;
  const context = getRequestContext(req);
  const allowHeaderWithoutMembership = !req.user || (req.membershipStatus && req.membershipStatus !== 'ready');
  const isPlatformAdmin = context.isPlatformAdmin;
  const headerOrgId = getHeaderOrgId(req, { requireMembership: !allowHeaderWithoutMembership && !isPlatformAdmin }) || null;
  const cookieOrgId = getActiveOrgFromRequest(req);
  const payloadOrgId = normalizeOrgIdValue(org_id ?? req.body?.orgId ?? null);

  const membershipOrgId = (Array.isArray(context.organizationIds) ? context.organizationIds.filter(Boolean) : []).map((id) => normalizeOrgIdValue(id)).find(Boolean) || normalizeOrgIdValue(context.activeOrgId);
  let resolvedOrgId = headerOrgId || membershipOrgId || cookieOrgId || payloadOrgId || null;
  if (!resolvedOrgId && isPlatformAdmin) resolvedOrgId = membershipOrgId || cookieOrgId || payloadOrgId || null;

  const sanitizedPayload = scrubAnalyticsPayload ? scrubAnalyticsPayload(payload ?? {}) : (payload || {});
  const normalizedEvent = event_type.trim();
  const rawClientEventId = typeof id === 'string' ? id.trim() : null;
  const normalizedClientEventId = rawClientEventId || null;
  const useCustomPrimaryKey = normalizedClientEventId ? isUuid(normalizedClientEventId) : false;

  function respondQueued(meta = {}, statusCode = 202) {
    return sendApiResponse(res, { status: 'queued', stored: false, missingOrgContext: false, ...meta }, { statusCode, code: 'analytics_event_queued', message: 'Analytics event queued.' });
  }
  function respondStored(meta = {}) {
    return sendApiResponse(res, { status: 'stored', stored: true, missingOrgContext: false, ...meta }, { statusCode: 200, code: 'analytics_event_stored', message: 'Analytics event stored.' });
  }

  if (!resolvedOrgId) {
    const warningKey = req.user?.userId || req.user?.id || `anon:${req.ip ?? 'unknown'}`;
    if (req.app.locals.analyticsOrgWarning) req.app.locals.analyticsOrgWarning(warningKey, { requestId: req.requestId, userId: req.user?.userId || req.user?.id || null, headerOrgId, payloadOrgId, cookieOrgId, membershipStatus: req.membershipStatus || 'unknown' });
    respondQueued({ missingOrgContext: true, skipped: 'missing_org' });
    return;
  }

  if (isDemoOrTestMode) {
    const eventId = useCustomPrimaryKey ? normalizedClientEventId : id || `demo-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { id: eventId, user_id: user_id ?? null, org_id: resolvedOrgId, course_id: course_id ?? null, lesson_id: lesson_id ?? null, module_id: module_id ?? null, event_type: normalizedEvent, session_id: session_id ?? null, user_agent: user_agent ?? null, payload: sanitizedPayload, client_event_id: normalizedClientEventId, created_at: new Date().toISOString() };
    e2eStore.analyticsEvents.unshift(record);
    if (e2eStore.analyticsEvents.length > 500) e2eStore.analyticsEvents.length = 500;
    try { persistE2EStore(); } catch (_) {}
    respondStored({ data: record, demo: true });
    return;
  }

  if (!supabase) {
    console.warn('[analytics.events] Supabase unavailable, acknowledging event without persistence.');
    respondQueued({ reason: 'supabase_disabled' });
    return;
  }

  try {
    const sanitizedUserId = user_id && isUuid(user_id) ? user_id : null;
    const insertPayload = { user_id: sanitizedUserId, org_id: resolvedOrgId, course_id: course_id ?? null, lesson_id: lesson_id ?? null, module_id: module_id ?? null, event_type: normalizedEvent, session_id: session_id ?? null, user_agent: user_agent ?? null, payload: sanitizedPayload, client_event_id: normalizedClientEventId };
    if (useCustomPrimaryKey) insertPayload.id = normalizedClientEventId;

    let _analInsert = await supabase.from('analytics_events').insert(insertPayload).select('*');
    let data = firstRow ? firstRow(_analInsert) : (_analInsert && _analInsert.data ? _analInsert.data[0] : null);
    let error = _analInsert.error;

    if (error) {
      const missingColumn = normalizeColumnIdentifier ? normalizeColumnIdentifier(extractMissingColumnName(error)) : null;
      if (missingColumn === 'client_event_id') {
        logger?.warn?.('analytics_events_client_event_id_missing', { message: error.message, code: error.code });
        delete insertPayload.client_event_id;
        _analInsert = await supabase.from('analytics_events').insert(insertPayload).select('*');
        data = firstRow ? firstRow(_analInsert) : (_analInsert && _analInsert.data ? _analInsert.data[0] : null);
        error = _analInsert.error;
      }
    }

    if (error) {
      if (isAnalyticsClientEventDuplicate && isAnalyticsClientEventDuplicate(error)) {
        logger?.info?.('analytics_event_duplicate_client_id', { clientEventId: normalizedClientEventId, eventType: normalizedEvent });
        respondStored({ duplicate: true, clientEventId: normalizedClientEventId });
        return;
      }
      throw error;
    }

    // Best-effort gamification updates (non-blocking)
    try {
      const gamificationUserId = context?.userId || req.user?.userId || req.user?.id || null;
      const gamificationOrgId = resolvedOrgId || null;
      const gamificationEventId = normalizedClientEventId || (data && data.id) || null;
      const occurredAt = (data && data.created_at) || new Date().toISOString();
      if (gamificationUserId && gamificationOrgId && processGamificationEvent) {
        await sql.begin(async (tx) => {
          await processGamificationEvent(tx, { userId: String(gamificationUserId), orgId: String(gamificationOrgId), courseId: course_id ?? null, lessonId: lesson_id ?? null, eventType: normalizedEvent, source: 'analytics', eventId: gamificationEventId ? String(gamificationEventId) : null, payload: sanitizedPayload, occurredAt });
          if (upsertOrgEngagementMetrics) await upsertOrgEngagementMetrics(tx, String(gamificationOrgId));
        });
      }
    } catch (gErr) {
      logger?.warn?.('gamification_update_failed', { requestId: req.requestId ?? null, eventType: normalizedEvent, message: gErr instanceof Error ? gErr.message : String(gErr) });
    }

    respondStored({ data });
  } catch (error) {
    console.error('Failed to record analytics event:', { error, clientEventId: normalizedClientEventId, eventType: normalizedEvent });
    respondQueued({ reason: error?.code || 'persistence_failed', errorCode: error?.code || null, message: error?.message || null });
  }
});

// Journeys upsert
import { authenticate, resolveOrganizationContext } from '../middleware/auth.js';
router.post('/journeys', authenticate, resolveOrganizationContext, async (req, res) => {
  const { supabase, ensureSupabase, e2eStore, isDemoOrTestMode, isUuid } = req.app.locals;
  const sessionUserId = req.userId ?? null;
  const sessionOrgId = req.organizationId ?? null;
  if (!sessionUserId) return res.status(401).json({ error: 'authentication_required' });
  if (!sessionOrgId) return res.status(200).json({ ok: true, disabled: true, requestId: req.requestId ?? null, meta: { reason: 'organization_context_required' } });

  const allowOverride = String(req.user?.platformRole || '').toLowerCase() === 'platform_admin';
  const rawUserId = typeof req.body?.user_id === 'string' ? req.body.user_id.trim() : null;
  const rawOrgId = typeof req.body?.organization_id === 'string' ? req.body.organization_id.trim() : null;
  const userId = allowOverride && rawUserId ? rawUserId : sessionUserId;
  const organizationId = allowOverride && rawOrgId ? rawOrgId : sessionOrgId;

  if (!isUuid(userId)) return res.status(400).json({ error: 'invalid_user_id', message: 'user_id must be a valid UUID.' });
  if (!isUuid(organizationId)) return res.status(400).json({ error: 'invalid_organization_id', message: 'organization_id must be a valid UUID.' });

  const { course_id, journey } = req.body || {};
  if (!course_id) return res.status(400).json({ error: 'course_id_required' });

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
    try { persistE2EStore(); } catch (_) {}
    return res.status(201).json({ data: e2eStore.learnerJourneys.get(key), demo: true });
  }

  if (!ensureSupabase(res)) return;

  try {
    const _journeyUpsert = await supabase.from('learner_journeys').upsert(payload, { onConflict: 'user_id,course_id' }).select('*');
    if (_journeyUpsert.error) throw _journeyUpsert.error;
    return res.status(201).json({ ok: true, data: (_journeyUpsert.data && _journeyUpsert.data[0]) || null, requestId: req.requestId ?? null });
  } catch (error) {
    const tableMissing = error?.code === 'PGRST205' || (typeof error?.message === 'string' && /learner_journeys/i.test(error.message));
    if (tableMissing) {
      console.warn('[analytics.journeys] learner_journeys_unavailable', { route: '/api/analytics/journeys', requestId: req.requestId ?? null });
      return res.status(200).json({ ok: true, disabled: true, requestId: req.requestId ?? null, meta: { reason: 'journeys_unavailable' } });
    }
    req.app.locals.logStructuredError?.('[analytics.journeys] upsert_failed', error, { route: '/api/analytics/journeys', userId, organizationId, course_id });
    return res.status(500).json({ ok: false, code: error?.code ?? 'journey_upsert_failed', message: error?.message ?? 'Unable to save learner journey.', hint: error?.hint ?? null, requestId: req.requestId ?? null, queryName: 'analytics_journeys_upsert' });
  }
});

// Journeys fetch
router.get('/journeys', authenticate, resolveOrganizationContext, async (req, res) => {
  const { supabase, ensureSupabase, isDemoOrTestMode, e2eStore, isUuid } = req.app.locals;
  const sessionUserId = req.userId ?? null;
  const sessionOrgId = req.organizationId ?? null;
  if (!sessionUserId) return res.status(401).json({ error: 'authentication_required' });
  if (!sessionOrgId) return res.status(200).json({ ok: true, data: [], disabled: true, requestId: req.requestId ?? null, meta: { reason: 'organization_context_required' } });

  const allowOverride = String(req.user?.platformRole || '').toLowerCase() === 'platform_admin';
  const queryUserId = typeof req.query?.user_id === 'string' ? req.query.user_id.trim() : null;
  const queryOrgId = typeof req.query?.org_id === 'string' ? req.query.org_id.trim() : typeof req.query?.orgId === 'string' ? req.query.orgId.trim() : null;
  const effectiveUserId = allowOverride && queryUserId ? queryUserId : sessionUserId;
  const effectiveOrgId = allowOverride && queryOrgId ? queryOrgId : sessionOrgId;
  const course_id = typeof req.query?.course_id === 'string' ? req.query.course_id.trim() : null;
  const sinceIso = (() => { try { return req.query?.since ? new Date(req.query.since).toISOString() : req.query?.since_at ? new Date(req.query.since_at).toISOString() : null; } catch { return null; } })();
  const limit = (() => { const parsed = Number(req.query?.limit); if (!Number.isFinite(parsed) || parsed <= 0) return 1000; return Math.min(Math.max(Math.floor(parsed), 1), 5000); })();

  if (isDemoOrTestMode) {
    let data = Array.from(e2eStore.learnerJourneys.values());
    if (effectiveUserId) data = data.filter((j) => j.user_id === effectiveUserId);
    if (course_id) data = data.filter((j) => j.course_id === course_id);
    if (effectiveOrgId) data = data.filter((j) => j.org_id === effectiveOrgId);
    return res.json({ data, demo: true });
  }

  if (!ensureSupabase(res)) return;

  try {
    let query = supabase.from('analytics_events').select('user_id,course_id,org_id,event_type,session_id,created_at,payload').order('created_at', { ascending: false }).limit(limit);
    if (effectiveUserId) query = query.eq('user_id', effectiveUserId);
    if (course_id) query = query.eq('course_id', course_id);
    if (effectiveOrgId) query = query.eq('org_id', effectiveOrgId);
    if (sinceIso) query = query.gte('created_at', sinceIso);
    const { data, error } = await query;
    if (error) throw error;
    const events = Array.isArray(data) ? data : [];
    const payload = req.app.locals.summarizeEventsAsJourneys ? req.app.locals.summarizeEventsAsJourneys(events) : events;
    return res.json({ ok: true, data: payload, requestId: req.requestId ?? null, meta: { scannedEvents: events.length, limit, since: sinceIso, filters: { user_id: effectiveUserId, course_id: course_id || null, org_id: effectiveOrgId } } });
  } catch (error) {
    const tableMissing = error?.code === 'PGRST205' || (typeof error?.message === 'string' && /learner_journeys/i.test(error.message));
    if (tableMissing) {
      console.warn('[analytics.journeys] learner_journeys_unavailable', { route: '/api/analytics/journeys', requestId: req.requestId ?? null });
      return res.status(200).json({ ok: true, data: [], requestId: req.requestId ?? null, meta: { disabled: true, reason: 'journeys_unavailable' } });
    }
    req.app.locals.logStructuredError?.('[analytics.journeys] fetch_failed', error, { route: '/api/analytics/journeys', userId: effectiveUserId, orgId: effectiveOrgId });
    return res.status(500).json({ ok: false, code: error?.code ?? 'journey_fetch_failed', message: error?.message ?? 'Unable to load learner journeys.', hint: error?.hint ?? null, requestId: req.requestId ?? null, queryName: 'analytics_journeys_fetch' });
  }
});

export default router;
