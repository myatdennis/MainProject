export const createAdminNotificationsService = ({
  logger,
  supabase,
  notificationService,
  ENABLE_NOTIFICATIONS,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  normalizeOrgIdValue,
  parsePaginationParams,
  sanitizeIlike,
  mapNotificationRecord,
  buildDisabledNotificationsResponse,
  isNotificationsTableMissingError,
  logNotificationsMissingTable,
  parseFlag,
  coerceIdArray,
} = {}) => {
  const disabledResponse = (page, pageSize, requestId) => ({
    raw: true,
    status: 200,
    payload: buildDisabledNotificationsResponse(page, pageSize, requestId),
  });

  const disabledMutationResponse = (requestId) => ({
    raw: true,
    status: 202,
    payload: {
      ok: true,
      data: null,
      notificationsDisabled: true,
      requestId,
    },
  });

  const normalizedContextError = (status, code, message, details = undefined) => ({
    status,
    error: { code, message, details },
  });

  return {
    listNotifications: async ({ req, res }) => {
      if (!ENABLE_NOTIFICATIONS) {
        return disabledResponse(1, 25, req.requestId ?? null);
      }

      const { page, pageSize, from, to } = parsePaginationParams(req, { defaultSize: 25, maxSize: 200 });
      if (isDemoOrTestMode && !supabase) {
        return disabledResponse(page, pageSize, req.requestId ?? null);
      }
      if (!ensureSupabase(res)) return null;

      const context = requireUserContext(req, res);
      if (!context) return null;

      const isAdmin = context.userRole === 'admin';
      const requestedOrgId = normalizeOrgIdValue(req.query.org_id ?? req.query.orgId ?? null);
      const requestedUserId = (req.query.user_id || req.query.userId || '').toString().trim();
      const search = (req.query.search || '').toString().trim();
      const dispatchStatuses = (req.query.dispatchStatus || req.query.dispatch_status || '')
        .toString()
        .split(',')
        .map((status) => status.trim())
        .filter(Boolean);

      const buildBaseQuery = () => {
        let query = supabase
          .from('notifications')
          .select(
            'id,title,body,organization_id,org_id,user_id,created_at,read,dispatch_status,channels,metadata,scheduled_for,delivered_at',
            { count: 'exact' },
          )
          .order('created_at', { ascending: false });

        if (dispatchStatuses.length) {
          query = query.in('dispatch_status', dispatchStatuses);
        }

        if (search) {
          const term = sanitizeIlike(search);
          query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
        }

        return query;
      };

      try {
        if (requestedOrgId) {
          const access = await requireOrgAccess(req, res, requestedOrgId, { write: false });
          if (!access) {
            return normalizedContextError(403, 'org_access_denied', 'You do not have access to this organization.');
          }
        } else if (!isAdmin) {
          return normalizedContextError(403, 'org_id_required', 'org_id is required for non-admin users');
        }

        let data = [];
        let count = 0;

        if (requestedOrgId && requestedUserId) {
          const [userResult, orgResult, globalResult] = await Promise.all([
            buildBaseQuery().eq('user_id', requestedUserId).limit(pageSize),
            buildBaseQuery().or(`organization_id.eq.${requestedOrgId},org_id.eq.${requestedOrgId}`).is('user_id', null).limit(pageSize),
            buildBaseQuery().is('organization_id', null).is('org_id', null).is('user_id', null).limit(Math.max(10, Math.ceil(pageSize / 2))),
          ]);

          const candidateErrors = [userResult?.error, orgResult?.error, globalResult?.error].filter(Boolean);
          const firstError = candidateErrors[0] ?? null;
          if (firstError) {
            if (isNotificationsTableMissingError(firstError)) {
              logNotificationsMissingTable('admin.list', { code: firstError.code });
              return disabledResponse(page, pageSize, req.requestId ?? null);
            }
            throw firstError;
          }

          const merged = new Map();
          for (const row of [...(userResult?.data || []), ...(orgResult?.data || []), ...(globalResult?.data || [])]) {
            if (row?.id && !merged.has(row.id)) merged.set(row.id, row);
          }
          data = Array.from(merged.values())
            .sort((a, b) => (Date.parse(b?.created_at || '') || 0) - (Date.parse(a?.created_at || '') || 0))
            .slice(from, to + 1);
          count = merged.size;
        } else {
          let query = buildBaseQuery().range(from, to);

          if (requestedOrgId) {
            query = query.or(`organization_id.eq.${requestedOrgId},org_id.eq.${requestedOrgId}`);
          }

          if (requestedUserId) {
            if (!isAdmin && requestedUserId !== context.userId) {
              return normalizedContextError(403, 'forbidden', 'Cannot view notifications for another user');
            }
            query = query.eq('user_id', requestedUserId);
          } else if (!isAdmin && !requestedOrgId) {
            if (!context.userId) {
              return normalizedContextError(400, 'user_id_required', 'user_id is required for non-admin queries');
            }
            query = query.eq('user_id', context.userId);
          }

          const result = await query;
          if (result.error) {
            if (isNotificationsTableMissingError(result.error)) {
              logNotificationsMissingTable('admin.list', { code: result.error.code });
              return disabledResponse(page, pageSize, req.requestId ?? null);
            }
            throw result.error;
          }
          data = result.data || [];
          count = result.count || 0;
        }

        return {
          status: 200,
          data: (data || []).map(mapNotificationRecord),
          meta: {
            requestId: req.requestId ?? null,
            pagination: {
              page,
              pageSize,
              total: count || 0,
              hasMore: to + 1 < (count || 0),
            },
          },
        };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('admin.list.catch', { message: error?.message });
          return disabledResponse(page, pageSize, req.requestId ?? null);
        }
        throw error;
      }
    },

    createNotification: async ({ req, res }) => {
      if (!ENABLE_NOTIFICATIONS) {
        return disabledMutationResponse(req.requestId ?? null);
      }
      if (isDemoOrTestMode && !supabase) {
        return disabledMutationResponse(req.requestId ?? null);
      }
      if (!ensureSupabase(res)) return null;

      const payload = req.body || {};
      const context = requireUserContext(req, res);
      if (!context) return null;
      const isAdmin = context.userRole === 'admin';
      const targetOrgId = normalizeOrgIdValue(payload.orgId ?? payload.organizationId ?? null);

      if (!payload.title) {
        return normalizedContextError(400, 'title_required', 'title is required', {
          requestId: req.requestId ?? null,
          queryName: 'admin_notifications_create',
        });
      }

      if (targetOrgId) {
        const access = await requireOrgAccess(req, res, targetOrgId, { write: true });
        if (!access) {
          return normalizedContextError(403, 'org_access_denied', 'You do not have access to this organization.');
        }
      } else if (payload.userId) {
        if (!isAdmin && payload.userId !== context.userId) {
          return normalizedContextError(403, 'forbidden', 'Cannot create notifications for another user');
        }
      } else if (!isAdmin) {
        return normalizedContextError(403, 'forbidden', 'Only admins can create global notifications');
      }

      const channels = Array.isArray(payload.channels) && payload.channels.length ? payload.channels : ['in_app'];
      const scheduledFor = payload.scheduledFor || payload.scheduled_for || null;
      const sendEmailFlag = payload.sendEmail ?? payload.send_email ?? channels.includes('email');

      try {
        const data = await notificationService.createNotification({
          id: payload.id ?? undefined,
          title: payload.title,
          body: payload.body ?? null,
          organizationId: targetOrgId ?? null,
          userId: payload.userId ?? null,
          read: payload.read ?? false,
          channels,
          scheduledFor,
          metadata: payload.metadata ?? {},
          sendEmail: sendEmailFlag,
          createdBy: context.userId ?? null,
        });

        return {
          status: 201,
          data: mapNotificationRecord(data),
          meta: { requestId: req.requestId ?? null },
        };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('admin.create.catch', { message: error?.message });
          return disabledMutationResponse(req.requestId ?? null);
        }
        throw error;
      }
    },

    broadcastNotifications: async ({ req, res }) => {
      if (!ENABLE_NOTIFICATIONS || !notificationService) {
        return disabledMutationResponse(req.requestId ?? null);
      }
      if (!ensureSupabase(res)) return null;

      const payload = req.body || {};
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      const message = typeof payload.message === 'string' ? payload.message.trim() : '';
      if (!title || !message) {
        return normalizedContextError(400, 'notification_title_and_message_required', 'Title and message are required.');
      }

      const maxTargets = Math.min(Number(payload.maxTargets) || 200, 500);
      const targetScope = (payload.audience || payload.scope || 'custom').toString().toLowerCase();
      const initialOrgIds = coerceIdArray(payload.organizationIds ?? payload.organization_ids ?? []);
      const initialUserIds = coerceIdArray(payload.userIds ?? payload.user_ids ?? []);
      const includeAllOrgs = parseFlag(payload.allOrganizations ?? payload.includeAllOrganizations);
      const includeAllUsers = parseFlag(payload.allUsers ?? payload.includeAllUsers);

      const resolvedOrgIds = new Set(initialOrgIds);
      const resolvedUserIds = new Set(initialUserIds);

      if (includeAllOrgs || targetScope === 'all_active_orgs') {
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

      if (includeAllUsers || targetScope === 'all_active_users') {
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
      Array.from(resolvedOrgIds)
        .slice(0, maxTargets)
        .forEach((organizationId) => organizationId && targets.push({ organizationId, recipientType: 'organization' }));
      Array.from(resolvedUserIds)
        .slice(0, maxTargets)
        .forEach((userId) => userId && targets.push({ userId, recipientType: 'user' }));

      if (!targets.length) {
        return normalizedContextError(400, 'notification_targets_required', 'Provide at least one organization or user target.');
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
            metadata: { ...metadata, audience: targetScope },
          });
          results.push(mapNotificationRecord(record));
        } catch (error) {
          failures += 1;
          logger.warn('notification_broadcast_target_failed', { target, message: error?.message || String(error) });
        }
      }

      logger.info('notification_broadcast_sent', {
        requestId: req.requestId ?? null,
        totalTargets: targets.length,
        delivered: results.length,
        failures,
      });

      return {
        status: results.length > 0 ? 201 : 202,
        data: results,
        meta: {
          requestId: req.requestId ?? null,
          requested: targets.length,
          delivered: results.length,
          failed: failures,
        },
      };
    },

    markRead: async ({ req, res }) => {
      if (!ENABLE_NOTIFICATIONS) {
        return {
          raw: true,
          status: 200,
          payload: { ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null },
        };
      }
      if (!ensureSupabase(res)) return null;

      const { id } = req.params;
      const { read = true } = req.body || {};
      const context = requireUserContext(req, res);
      if (!context) return null;
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
            return {
              raw: true,
              status: 200,
              payload: { ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null },
            };
          }
          throw existing.error;
        }

        const note = existing.data;
        if (!note) {
          return normalizedContextError(404, 'not_found', 'Notification not found');
        }

        const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);
        if (!isAdmin) {
          if (note.user_id) {
            if (note.user_id !== context.userId) {
              return normalizedContextError(403, 'forbidden', "Cannot modify another user's notification");
            }
          } else if (noteOrgId) {
            const access = await requireOrgAccess(req, res, noteOrgId);
            if (!access) return null;
          } else {
            return normalizedContextError(403, 'forbidden', 'Cannot modify global notification');
          }
        }

        const data = await notificationService.markNotificationRead(id, read);
        return {
          status: 200,
          data: mapNotificationRecord(data),
          meta: { requestId: req.requestId ?? null },
        };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('admin.markRead.catch', { message: error?.message });
          return {
            raw: true,
            status: 200,
            payload: { ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null },
          };
        }
        throw error;
      }
    },

    deleteNotification: async ({ req, res }) => {
      if (!ENABLE_NOTIFICATIONS) {
        return {
          raw: true,
          status: 200,
          payload: { ok: true, data: null, notificationsDisabled: true, requestId: req.requestId ?? null },
        };
      }
      if (!ensureSupabase(res)) return null;

      const { id } = req.params;
      const context = requireUserContext(req, res);
      if (!context) return null;
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
            return { raw: true, status: 200, payload: { ok: true, requestId: req.requestId ?? null } };
          }
          throw existing.error;
        }

        const note = existing.data;
        if (!note) {
          return { raw: true, status: 200, payload: { ok: true, requestId: req.requestId ?? null } };
        }

        const noteOrgId = normalizeOrgIdValue(note.organization_id ?? note.org_id ?? null);
        if (!isAdmin) {
          if (note.user_id) {
            if (note.user_id !== context.userId) {
              return normalizedContextError(403, 'forbidden', "Cannot delete another user's notification");
            }
          } else if (noteOrgId) {
            const access = await requireOrgAccess(req, res, noteOrgId, { write: true });
            if (!access) return null;
          } else {
            return normalizedContextError(403, 'forbidden', 'Cannot delete global notification');
          }
        }

        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) {
          if (isNotificationsTableMissingError(error)) {
            logNotificationsMissingTable('admin.delete.exec', { code: error.code });
            return { raw: true, status: 200, payload: { ok: true, requestId: req.requestId ?? null } };
          }
          throw error;
        }

        return { raw: true, status: 200, payload: { ok: true, requestId: req.requestId ?? null } };
      } catch (error) {
        if (isNotificationsTableMissingError(error)) {
          logNotificationsMissingTable('admin.delete.catch', { message: error?.message });
          return { raw: true, status: 200, payload: { ok: true, requestId: req.requestId ?? null } };
        }
        throw error;
      }
    },
  };
};

export default createAdminNotificationsService;
