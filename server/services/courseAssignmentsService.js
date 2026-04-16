export const createCourseAssignmentsService = ({
  supabase,
  logger,
  e2eStore,
  isDemoOrTestMode,
  isDemoMode,
  defaultSandboxOrgId,
  shouldUseAssignmentWriteFallback,
  normalizeOrgIdValue,
  normalizeAssignmentRow,
  ensureOrgFieldCompatibility,
  ensureCourseAssignmentsForUserFromOrgScope,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  getOrganizationMembershipsOrgColumnName,
  getOrganizationMembershipsStatusColumnName,
  isUuid,
  resolveUserIdentifierToUuid,
  isMissingRelationError,
  isMissingColumnError,
  resolveCourseIdentifierToUuid,
  coerceOrgIdentifierToUuid,
  sanitizeAssignmentRecordForSchema,
  notifyAssignmentRecipients,
  broadcastToTopic,
  logCourseRequestEvent,
  logAdminCoursesError,
  normalizeLegacyOrgInput,
  pickOrgId,
  assertUuid,
  summarizeHeaders,
  summarizeRequestBody,
  isInfrastructureUnavailableError,
}) => {
  const parseBoolean = (value, defaultValue = true) => {
    if (value === undefined || value === null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  };

  const safeSerializeError = (error) => ({
    code: error?.code ?? null,
    statusCode: error?.statusCode ?? null,
    message: error?.message ?? String(error),
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    meta: error?.meta ?? null,
  });

  const assignAdminCourse = async ({ req, res, requireUserContext, requireOrgAccess }) => {
    const assignmentFallbackEnabled = shouldUseAssignmentWriteFallback();
    const { id } = req.params;
    const assignLogMeta = {
      requestId: req.requestId ?? null,
      userId: null,
      courseId: null,
      orgId: null,
    };
    const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
    if (!resolvedCourseId) {
      return {
        status: 404,
        error: { code: 'course_not_found', message: `Course not found for identifier ${id}` },
        meta: { requestId: req.requestId ?? null },
      };
    }

    const courseId = resolvedCourseId;
    assignLogMeta.courseId = courseId;
    const body = normalizeLegacyOrgInput(req.body ?? {}, {
      surface: 'admin.courses.assign',
      requestId: req.requestId,
    });

    const debugAssign = (...args) => {
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.info(...args);
        } catch {
          // no-op
        }
      }
    };

    try {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('skip_header_org_injection');
      }
      const headerOrg = req.headers['x-org-id'] || req.headers['x-organization-id'];
      const maybeHeaderValue = Array.isArray(headerOrg) ? headerOrg[0] : headerOrg;
      if (maybeHeaderValue && (!body || !body.organization_id) && !body?.organization) {
        const headerValStr = String(maybeHeaderValue).trim();
        if (headerValStr) {
          body.organization_id = headerValStr;
          body.organizationId = headerValStr;
          body.orgId = headerValStr;
          debugAssign('[assign] injected org id from header into body', {
            headerValStr,
            requestId: req.requestId ?? null,
          });
        }
      }
    } catch {
      // no-op
    }

    let finalOrganizationId = null;
    try {
      const directOrg = body && (body.organization_id || body.organizationId || body.orgId || body.org_id);
      if (directOrg) {
        finalOrganizationId = String(directOrg).trim();
      }
    } catch {
      // no-op
    }

    try {
      finalOrganizationId = pickOrgId(
        body.organization_id,
        body.organizationId,
        body.orgId,
        body.org_id,
        body.organization && body.organization.id,
        body.organization && body.organization.organization_id,
        body.organization && body.organization.organizationId,
        process.env.NODE_ENV !== 'production' ? req.headers['x-org-id'] : null,
        process.env.NODE_ENV !== 'production' ? req.headers['x-organization-id'] : null,
        req.query && (req.query.organization_id || req.query.organizationId || req.query.orgId),
      );
    } catch (error) {
      console.warn('[assign] org id probe failed', {
        err: error?.message || String(error),
        requestId: req.requestId ?? null,
      });
    }

    if (!finalOrganizationId && isDemoOrTestMode) {
      finalOrganizationId = defaultSandboxOrgId;
    }

    try {
      const resolvedOrg = await coerceOrgIdentifierToUuid(req, finalOrganizationId);
      if (resolvedOrg) finalOrganizationId = resolvedOrg;
    } catch (error) {
      debugAssign('[assign] failed to resolve org identifier', {
        error: error?.message || String(error),
        requestId: req.requestId ?? null,
      });
    }

    if (!finalOrganizationId) {
      try {
        const headerOrgStrict = req.headers['x-org-id'] || req.headers['x-organization-id'];
        if (process.env.NODE_ENV !== 'production' && headerOrgStrict) {
          finalOrganizationId = Array.isArray(headerOrgStrict)
            ? String(headerOrgStrict[0]).trim()
            : String(headerOrgStrict).trim();
        }
      } catch {
        // no-op
      }
    }

    if (!finalOrganizationId) {
      const userRoleHeader = String(req.headers['x-user-role'] || '').toLowerCase();
      const hostHeader = String(req.headers.host || '');
      const remoteIp = String(req.ip || req.connection?.remoteAddress || '');
      const looksLocal =
        hostHeader.includes('localhost') ||
        hostHeader.includes('127.0.0.1') ||
        remoteIp === '127.0.0.1' ||
        remoteIp === '::1' ||
        remoteIp.startsWith('::ffff:127.');

      if (process.env.NODE_ENV !== 'production' && (isDemoOrTestMode || userRoleHeader === 'admin' || looksLocal)) {
        finalOrganizationId = defaultSandboxOrgId;
      } else {
        logger.warn('course_assignment_organization_missing', {
          requestId: req.requestId ?? null,
          headersSummary: summarizeHeaders(req.headers),
          bodySummary: summarizeRequestBody(req.body ?? null),
        });
        return {
          status: 400,
          error: { code: 'organization_required', message: 'organization_id is required' },
        };
      }
    }

    if ((!finalOrganizationId || !isUuid(finalOrganizationId)) && !isDemoOrTestMode) {
      try {
        const coerced = await coerceOrgIdentifierToUuid(req, finalOrganizationId);
        if (coerced && isUuid(coerced)) finalOrganizationId = coerced;
      } catch {
        // no-op
      }
    }

    if ((!finalOrganizationId || !isUuid(finalOrganizationId)) && !isDemoOrTestMode) {
      return {
        status: 400,
        error: { code: 'invalid_organization_id', message: 'organization_id must be a valid UUID.' },
      };
    }

    if (!isDemoOrTestMode) {
      try {
        assertUuid(finalOrganizationId);
      } catch (error) {
        return {
          status: 400,
          error: {
            code: 'invalid_organization_id',
            message: error?.message || 'organization_id must be a valid UUID.',
          },
        };
      }
    }

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
      if (value === null || value === undefined) continue;
      const candidate = String(value).trim();
      if (!candidate) continue;

      if (isUuid(candidate)) {
        resolvedUserIdSet.add(candidate);
        continue;
      }

      try {
        const resolvedUserId = await resolveUserIdentifierToUuid(req, candidate);
        if (resolvedUserId && isUuid(resolvedUserId)) {
          resolvedUserIdSet.add(resolvedUserId);
        } else {
          unresolvedUserIdSet.add(candidate);
        }
      } catch (error) {
        console.warn('[assign] resolveUserIdentifierToUuid failed', {
          candidate,
          error: error?.message || String(error),
          requestId: req.requestId ?? null,
        });
        unresolvedUserIdSet.add(candidate);
      }
    }

    const normalizedUserIds = Array.from(resolvedUserIdSet);
    const invalidTargetIds = Array.from(new Set([...(unresolvedUserIdSet || [])]));

    if (unresolvedUserIdSet.size > 0) {
      return {
        status: 400,
        error: {
          code: 'invalid_user_ids',
          message: 'Some provided user_ids could not be resolved to UUIDs.',
          details: { invalidUserIds: Array.from(unresolvedUserIdSet) },
        },
      };
    }

    const assignmentMode =
      body.mode === 'organization' ? 'organization' : normalizedUserIds.length > 0 ? 'learners' : 'organization';

    const context = requireUserContext(req, res);
    if (!context) {
      return { status: 401, error: { code: 'not_authenticated', message: 'Authentication required.' } };
    }

    const access = await requireOrgAccess(req, res, finalOrganizationId, { write: true, requireOrgAdmin: true });
    if (!access) {
      return {
        status: 403,
        error: { code: 'org_access_denied', message: 'You do not have admin access to assign for this organization.' },
      };
    }

    const organizationIds = finalOrganizationId ? [finalOrganizationId] : [];
    assignLogMeta.userId = context.userId ?? null;
    assignLogMeta.orgId = finalOrganizationId;
    const assignmentLogBase = {
      courseId,
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
    logCourseRequestEvent('admin.courses.assign.start', assignLogMeta);

    const dueProvided = hasBodyKey('due_at') || hasBodyKey('dueAt');
    const rawDueAt = body.due_at ?? body.dueAt ?? null;
    const dueAtValue = dueProvided ? (rawDueAt ? String(rawDueAt) : null) : null;

    const noteProvided = hasBodyKey('note');
    const rawNote = body.note ?? null;
    const noteValue =
      noteProvided ? (typeof rawNote === 'string' ? rawNote : rawNote === null ? null : String(rawNote)) : null;

    const assignedByRaw = body.assigned_by ?? body.assignedBy;
    let assignedBy =
      typeof assignedByRaw === 'string' && assignedByRaw.trim().length > 0 ? assignedByRaw.trim() : context.userId;

    if (assignedBy && !isUuid(assignedBy)) {
      try {
        const resolvedAssignedBy = await resolveUserIdentifierToUuid(req, assignedBy);
        assignedBy = resolvedAssignedBy && isUuid(resolvedAssignedBy) ? resolvedAssignedBy : null;
      } catch {
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
    const idempotencyKey =
      typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
        ? idempotencyKeyRaw.trim()
        : null;
    const clientRequestIdRaw = body.client_request_id ?? body.clientRequestId;
    const clientRequestId =
      typeof clientRequestIdRaw === 'string' && clientRequestIdRaw.trim().length > 0
        ? clientRequestIdRaw.trim()
        : null;

    const metadataInput = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};
    let metadata = {};
    try {
      metadata = JSON.parse(JSON.stringify(metadataInput));
    } catch {
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

    let assignmentIdempotencyKey = null;
    const buildAssignmentKey = (value) => (value === null ? '__org__' : String(value).toLowerCase());
    const resolveRowKey = (row) => {
      if (!row) return '__org__';
      const candidate = row.user_id ?? row.user_id_uuid ?? null;
      return buildAssignmentKey(candidate);
    };

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
              const memberOrg = normalizeOrgIdValue(
                member?.organization_id ?? member?.org_id ?? member?.organizationId ?? member?.orgId ?? null,
              );
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
          let membershipQuery = supabase
            .from('organization_memberships')
            .select('user_id,status,is_active')
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

        logger.info('course_assignment_persisted', {
          ...assignmentLogBase,
          insertedRowCount: inserted.length,
          updatedRowCount: updated.length,
          skippedRowCount: Math.max(targetUserIds.length - inserted.length - updated.length, 0),
          persistedRowCount: responseRows.length,
        });

        return {
          status: 200,
          data: responseRows,
          meta: {
            fallback: true,
            organizationId: finalOrganizationId,
            inserted: inserted.length,
            updated: updated.length,
            targets: targetUserIds.length,
          },
        };
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
          return {
            status: 200,
            data: existingByKey,
            meta: {
              organizationId: finalOrganizationId,
              idempotent: true,
              key: assignmentIdempotencyKey,
            },
          };
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
          return {
            status: 200,
            data: existingByClient,
            meta: {
              organizationId: finalOrganizationId,
              idempotent: true,
              key: clientRequestId,
            },
          };
        }
      }

      const existingMap = new Map();
      if (targetUserIds.length > 0) {
        const userScopedTargetIds = targetUserIds.filter((value) => value !== null);
        const includesOrgLevelTarget = targetUserIds.some((value) => value === null);
        const seenAssignmentIds = new Set();

        const fetchExistingByColumn = async (column) => {
          if (userScopedTargetIds.length === 0) return [];
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
          .insert(
            inserts.map((record) =>
              sanitizeAssignmentRecordForSchema(record, { includeUserIdUuid: assignmentsSupportUserIdUuid }),
            ),
          )
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
              return {
                status: 200,
                data: existingByKey,
                meta: {
                  organizationId: finalOrganizationId,
                  idempotent: true,
                  key: assignmentIdempotencyKey,
                  recoveredFromConflict: true,
                },
              };
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

      logger.info('course_assignment_persisted', {
        ...assignmentLogBase,
        insertedRowCount: insertedRows.length,
        updatedRowCount: updatedRows.length,
        skippedRowCount: Math.max(targetUserIds.length - insertedRows.length - updatedRows.length, 0),
        persistedRowCount: responseRows.length,
      });

      return {
        status: 200,
        data: responseRows,
        meta: {
          organizationId: finalOrganizationId,
          inserted: insertedRows.length,
          updated: updatedRows.length,
          targets: targetUserIds.length,
        },
      };
    } catch (error) {
      logger.error('course_assignment_failed', {
        ...assignmentLogBase,
        error: safeSerializeError(error),
      });
      logAdminCoursesError(req, error, `Failed to assign course ${id}`);

      if (error?.statusCode === 400 || error?.code === 'invalid_organization_id' || error?.code === 'invalid_user_ids') {
        return {
          status: 400,
          error: {
            code: error?.code || 'invalid_assignment_payload',
            message: error?.message || 'Assignment payload contains invalid identifiers.',
          },
        };
      }
      if (error?.statusCode === 403 || error?.code === 'org_access_denied') {
        return {
          status: 403,
          error: {
            code: 'org_access_denied',
            message: 'You do not have admin access to assign for this organization.',
          },
        };
      }
      if (
        error?.statusCode === 503 ||
        error?.code === 'assignment_persistence_verification_failed' ||
        error?.code === 'database_unavailable' ||
        isInfrastructureUnavailableError(error)
      ) {
        return {
          status: 503,
          error: {
            code:
              error?.code === 'assignment_persistence_verification_failed'
                ? 'assignment_persistence_verification_failed'
                : 'database_unavailable',
            message:
              error?.code === 'assignment_persistence_verification_failed'
                ? 'Assignment write could not be verified. No success was returned.'
                : 'Assignment write failed because the database is unavailable.',
          },
        };
      }
      throw error;
    } finally {
      logCourseRequestEvent('admin.courses.assign.finish', {
        ...assignLogMeta,
        errorCode: res?.locals?.errorCode ?? null,
      });
    }
  };

  const loadClientAssignments = async ({ req, context }) => {
    try {
      const requestId = req.requestId;
      const normalizedUserId = String(context.userId || '').trim().toLowerCase();

      try {
        logger.info('client_assignments_request_received', {
          requestId: requestId ?? null,
          authUserId: req.authContext?.userId ?? null,
          contextUserId: context.userId ?? null,
          normalizedUserId,
          query: req.query ?? null,
        });
      } catch (e) {
        // non-fatal
      }

      if (!normalizedUserId) {
        return {
          status: 401,
          data: [],
          meta: { count: 0, orgId: null, error: 'not_authenticated' },
        };
      }

    let queryUserId = normalizedUserId;
    if (!isUuid(queryUserId) && !isDemoMode) {
      try {
        const resolvedUserId = await resolveUserIdentifierToUuid(req, queryUserId);
        if (resolvedUserId && isUuid(resolvedUserId)) {
          queryUserId = resolvedUserId;
        }
      } catch (err) {
        console.warn('[client/assignments] user identifier resolution failed', {
          requestId,
          userId: queryUserId,
          error: err?.message || String(err),
        });
      }
    }

    if (!isUuid(queryUserId) && !isDemoMode) {
      console.warn('[client/assignments] non_uuid_user_id', { requestId, userId: queryUserId });
    }

    const includeCompletedAssignments = parseBoolean(
      req.query.include_completed ?? req.query.includeCompleted ?? undefined,
      true,
    );

    const requestedOrgId = req.query.organization_id ?? req.query.organizationId ?? req.query.org_id ?? req.query.orgId ?? null;
    const resolvedOrgId =
      normalizeOrgIdValue(requestedOrgId) || context.requestedOrgId || normalizeOrgIdValue(req.activeOrgId) || null;

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

      const directRows = [];
      const orgScopedByCourseId = new Map();
      for (const rawAssignment of e2eStore.assignments || []) {
        const assignment =
          ensureOrgFieldCompatibility(rawAssignment, { fallbackOrgId: defaultSandboxOrgId }) || rawAssignment;
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
        directRows.map((assignment) => assignment?.course_id ?? assignment?.courseId ?? null).filter(Boolean),
      );

      const rows = [
        ...directRows,
        ...Array.from(orgScopedByCourseId.entries())
          .filter(([courseId]) => !directCourseIds.has(courseId))
          .map(([, assignment]) => assignment),
      ];
      return {
        status: 200,
        data: rows.map((row) => normalizeAssignmentRow(row)).filter(Boolean),
        meta: { count: rows.length, orgId: resolvedOrgId },
      };
    }

    if (!supabase) {
      return { status: 200, data: [], meta: { count: 0, orgId: resolvedOrgId } };
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
      try {
        logger.info('client_assignments_query_start', {
          requestId,
          table,
          userId: queryUserId,
          resolvedOrgId,
        });
      } catch (e) {}
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

      query = query
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query;
      try {
        logger.info('client_assignments_query_result', {
          requestId,
          table,
          error: error ? (error?.message ?? error) : null,
          rows: Array.isArray(data) ? data.length : 0,
        });
      } catch (e) {}
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
              try {
                logger.info('client_assignments_fallback_query_result', {
                  requestId,
                  table,
                  fallbackError: fallbackError ? (fallbackError?.message ?? fallbackError) : null,
                  rows: Array.isArray(fallbackData) ? fallbackData.length : 0,
                });
              } catch (e) {}
              if (!fallbackError) {
              rows = fallbackData || [];
              sourceTable = table;
              if (rows.length > 0 || table === assignmentTables[assignmentTables.length - 1]) break;
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
      if (rows.length > 0 || table === assignmentTables[assignmentTables.length - 1]) break;
    }

    if (!sourceTable) {
      logger.warn('client_assignments_no_table', { requestId, tablesTried: assignmentTables });
      logger.info('client_assignments_response', { requestId, status: 200, count: 0, orgId: resolvedOrgId });
      return { status: 200, data: [], meta: { count: 0, orgId: resolvedOrgId } };
    }

    const normalizedRows = rows.map((row) => normalizeAssignmentRow(row)).filter(Boolean);
    logger.info('client_assignments_response', { requestId, status: 200, count: normalizedRows.length, orgId: normalizedRows.length > 0 ? resolvedOrgId : null, table: sourceTable });
    return {
      status: 200,
      data: normalizedRows,
      meta: { count: normalizedRows.length, orgId: normalizedRows.length > 0 ? resolvedOrgId : null, table: sourceTable },
    };
    } catch (error) {
      // Defensive: do not surface unexpected internal errors as 500 to the
      // client. Log the incident with full context and return an empty result
      // (the frontend will surface an error state and will not fallback).
      logger.error('client_assignments_fetch_unexpected_error', {
        requestId: req.requestId ?? null,
        userId: req.authContext?.userId ?? null,
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
      });
  return { status: 503, data: [], meta: { count: 0, orgId: null, error: 'fetch_failed' } };
    }
  };

  const listAdminAssignments = async ({ req, isFallbackMode, requireOrgAccess, requireUserContext }) => {
    const { id } = req.params;
    const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
    if (!resolvedCourseId) {
      return { status: 404, error: { code: 'course_not_found', message: `Course not found for identifier ${id}` } };
    }
    const courseId = resolvedCourseId;
    let organizationId = req.query.orgId ?? req.query.organizationId ?? null;

    try {
      const resolvedOrgId = await coerceOrgIdentifierToUuid(req, organizationId);
      if (resolvedOrgId) organizationId = resolvedOrgId;
    } catch (err) {
      console.warn('[admin.courses.assignments] failed to resolve organization id', {
        organizationId,
        error: err?.message || String(err),
        requestId: req.requestId ?? null,
      });
    }

    if ((!organizationId || !isUuid(organizationId)) && !isFallbackMode) {
      return { status: 400, error: { code: 'invalid_organization_id', message: 'orgId must be a valid organization UUID.' } };
    }

    if (!organizationId && !isFallbackMode) {
      return { status: 400, error: { code: 'org_id_required', message: 'orgId query parameter is required.' } };
    }

    if (!organizationId && isFallbackMode) {
      organizationId = defaultSandboxOrgId;
    }

    const context = requireUserContext(req, null);
    if (!context) {
      return { status: 401, error: { code: 'not_authenticated', message: 'Authentication required.' } };
    }

    if (!isFallbackMode) {
      const access = await requireOrgAccess(req, null, organizationId, { write: false, requireOrgAdmin: true });
      if (!access) {
        return { status: 403, error: { code: 'org_access_denied', message: 'You do not have access to this organization.' } };
      }
    }

    const activeOnly = String(req.query.active ?? 'true').toLowerCase() !== 'false';
    if (isDemoOrTestMode) {
      const rows = (Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [])
        .filter((assignment) => {
          if (!assignment) return false;
          if (String(assignment.course_id) !== String(courseId)) return false;
          const assignmentOrgId = assignment.organization_id ?? assignment.organizationId ?? assignment.org_id ?? assignment.orgId ?? null;
          if (String(assignmentOrgId) !== String(organizationId)) return false;
          if (activeOnly && assignment.active === false) return false;
          return true;
        })
        .sort((left, right) => {
          const a = String(left?.created_at || '');
          const b = String(right?.created_at || '');
          return a < b ? 1 : a > b ? -1 : 0;
        });
      return { status: 200, data: rows, meta: { count: rows.length, demo: true } };
    }

    if (!supabase) {
      return { status: 503, error: { code: 'database_unavailable', message: 'Assignments unavailable.' } };
    }

    const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
    let query = supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId)
      .eq(assignmentsOrgColumn, organizationId)
      .order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return { status: 200, data: data || [], meta: { count: (data || []).length } };
  };

  const deleteAdminAssignment = async ({ req, requireOrgAccess, requireUserContext }) => {
    if (!supabase) {
      return { status: 503, error: { code: 'database_unavailable', message: 'Assignments unavailable.' } };
    }
    const { assignmentId } = req.params;
    const context = requireUserContext(req, null);
    if (!context) {
      return { status: 401, error: { code: 'not_authenticated', message: 'Authentication required.' } };
    }
    const { data: existing, error: lookupError } = await supabase.from('assignments').select('*').eq('id', assignmentId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      return { status: 404, error: { code: 'assignment_not_found', message: 'Assignment not found.' } };
    }
    const orgId = existing.organization_id || existing.org_id || null;
    if (!orgId) {
      return { status: 400, error: { code: 'assignment_missing_org', message: 'Assignment is missing organization scope.' } };
    }
    const access = await requireOrgAccess(req, null, orgId, { write: true, requireOrgAdmin: true });
    if (!access) {
      return { status: 403, error: { code: 'org_access_denied', message: 'You do not have access to this organization.' } };
    }
    const { data, error } = await supabase
      .from('assignments')
      .update({ active: false, removed_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return { status: 200, data, meta: { deleted: true } };
  };

  return {
    assignAdminCourse,
    loadClientAssignments,
    listAdminAssignments,
    deleteAdminAssignment,
  };
};

export default createCourseAssignmentsService;
