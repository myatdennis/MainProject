export const createLearnerNotificationsService = ({
  logger,
  supabase,
  notificationService,
  broadcastToTopic,
  ENABLE_NOTIFICATIONS,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  normalizeOrgIdValue,
  clampNumber,
  runNotificationQuery,
  mapNotificationRecord,
  isNotificationsTableMissingError,
  logNotificationsMissingTable,
  isMissingColumnError,
} = {}) => {
  const disabledResponse = (requestId, extra = {}) => ({
    raw: true,
    status: 200,
    payload: { ok: true, data: [], notificationsDisabled: true, requestId, ...extra },
  });

  const disabledMutation = (requestId) => ({
    raw: true,
    status: 200,
    payload: { ok: true, data: null, notificationsDisabled: true, requestId },
  });

  return {
    listNotifications: async ({ req, res }) => {
      const context = requireUserContext(req, res);
      if (!context) return null;
      if (!ENABLE_NOTIFICATIONS) {
        return disabledResponse(req.requestId ?? null);
      }

      const limit = clampNumber(parseInt(req.query.limit, 10) || 20, 1, 100);
      const sinceIso = typeof req.query.since === 'string' ? req.query.since : null;
      const unreadOnlyParam = req.query.unread_only ?? req.query.unreadOnly;
      const unreadOnly =
        typeof unreadOnlyParam === 'string'
          ? unreadOnlyParam.trim().toLowerCase() === 'true'
          : unreadOnlyParam === true;
      const readFilter =
        unreadOnly ? 'false' : typeof req.query.read === 'string' ? req.query.read.trim().toLowerCase() : null;

      if (isDemoOrTestMode && !supabase) {
        return {
          raw: true,
          status: 200,
          payload: { ok: true, data: [], requestId: req.requestId ?? null },
        };
      }

      if (!ensureSupabase(res)) return null;

      try {
        const queryFactories = [];
        queryFactories.push((selectColumns) =>
          supabase.from('notifications').select(selectColumns).eq('user_id', context.userId).order('created_at', { ascending: false }).limit(limit),
        );

        const orgIds = Array.isArray(context.organizationIds)
          ? context.organizationIds.filter((value) => typeof value === 'string' && value.trim())
          : [];

        if (orgIds.length) {
          queryFactories.push((selectColumns) =>
            supabase.from('notifications').select(selectColumns).in('organization_id', orgIds).is('user_id', null).order('created_at', { ascending: false }).limit(limit),
          );
          queryFactories.push((selectColumns) =>
            supabase.from('notifications').select(selectColumns).in('org_id', orgIds).is('user_id', null).order('created_at', { ascending: false }).limit(limit),
          );
        }

        queryFactories.push((selectColumns) =>
          supabase.from('notifications').select(selectColumns).is('org_id', null).is('user_id', null).order('created_at', { ascending: false }).limit(Math.max(5, limit)),
        );

        const resultSets = await Promise.all(queryFactories.map((factory) => runNotificationQuery(factory)));
        let merged = resultSets.flat();
        const deduped = new Map();
        for (const note of merged) {
          if (note && !deduped.has(note.id)) deduped.set(note.id, note);
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

        merged.sort((a, b) => (Date.parse(b?.created_at || '') || 0) - (Date.parse(a?.created_at || '') || 0));

        return {
          status: 200,
          data: merged.slice(0, limit).map(mapNotificationRecord),
          meta: { requestId: req.requestId ?? null },
        };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('learner.fetch', { code: error.code });
          return disabledResponse(req.requestId ?? null, { degraded: true });
        }
        if (isMissingColumnError(error)) {
          logger.warn('learner_notifications_schema_mismatch', { code: error.code, message: error.message });
          return {
            raw: true,
            status: 200,
            payload: {
              ok: true,
              data: [],
              degraded: true,
              reason: 'schema_missing_column',
              requestId: req.requestId ?? null,
            },
          };
        }
        throw error;
      }
    },

    markRead: async ({ req, res }) => {
      const context = requireUserContext(req, res);
      if (!context) return null;
      if (!ENABLE_NOTIFICATIONS) {
        return disabledMutation(req.requestId ?? null);
      }
      if (!ensureSupabase(res)) return null;

      const { id } = req.params;
      try {
        const existing = await supabase.from('notifications').select('id, organization_id, org_id, user_id').eq('id', id).maybeSingle();
        if (existing.error) {
          if (isNotificationsTableMissingError(existing.error)) {
            logNotificationsMissingTable('learner.markRead.lookup', { code: existing.error.code });
            return disabledMutation(req.requestId ?? null);
          }
          throw existing.error;
        }

        const note = existing.data;
        if (!note) {
          return { status: 404, error: { code: 'not_found', message: 'Notification not found' } };
        }

        const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);
        if (note.user_id) {
          if (note.user_id !== context.userId) {
            return { status: 403, error: { code: 'forbidden', message: "Cannot modify another user's notification" } };
          }
        } else if (noteOrgId) {
          const access = await requireOrgAccess(req, res, noteOrgId, { write: false });
          if (!access) return null;
        } else {
          return { status: 403, error: { code: 'forbidden', message: 'Cannot modify global notification' } };
        }

        const data = notificationService ? await notificationService.markNotificationRead(id, true) : null;
        return { status: 200, data: mapNotificationRecord(data), meta: { requestId: req.requestId ?? null } };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('learner.markRead.catch', { message: error?.message });
          return disabledMutation(req.requestId ?? null);
        }
        throw error;
      }
    },

    deleteNotification: async ({ req, res }) => {
      const context = requireUserContext(req, res);
      if (!context) return null;
      if (!ENABLE_NOTIFICATIONS) {
        return disabledMutation(req.requestId ?? null);
      }
      if (!ensureSupabase(res)) return null;

      const { id } = req.params;
      try {
        const existing = await supabase.from('notifications').select('id, organization_id, org_id, user_id').eq('id', id).maybeSingle();
        if (existing.error) {
          if (isNotificationsTableMissingError(existing.error)) {
            logNotificationsMissingTable('learner.delete.lookup', { code: existing.error.code });
            return { raw: true, status: 204, payload: null };
          }
          throw existing.error;
        }

        const note = existing.data;
        if (!note) {
          return { raw: true, status: 204, payload: null };
        }

        const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);
        if (note.user_id) {
          if (note.user_id !== context.userId) {
            return { status: 403, error: { code: 'forbidden', message: "Cannot delete another user's notification" } };
          }
        } else if (noteOrgId) {
          const access = await requireOrgAccess(req, res, noteOrgId, { write: false });
          if (!access) return null;
        } else {
          return { status: 403, error: { code: 'forbidden', message: 'Cannot delete global notification' } };
        }

        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) {
          if (isNotificationsTableMissingError(error)) {
            logNotificationsMissingTable('learner.delete.remove', { code: error.code });
            return { raw: true, status: 204, payload: null };
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

        return { raw: true, status: 204, payload: null };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('learner.delete.catch', { message: error?.message });
          return { raw: true, status: 204, payload: null };
        }
        throw error;
      }
    },
  };
};

export default createLearnerNotificationsService;
