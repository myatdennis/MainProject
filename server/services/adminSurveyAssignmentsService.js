export const createAdminSurveyAssignmentsService = ({
  supabase,
  sql,
  logger,
  e2eStore,
  shouldUseAssignmentWriteFallback,
  isDemoOrTestMode,
  surveyAssignmentType,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  fetchOrgMembersWithProfiles,
  coerceOrgIdentifierToUuid,
  InvalidOrgIdentifierError,
  isUuid,
  refreshSurveyAssignmentAggregates,
  notifyAssignmentRecipients,
  logSurveyAssignmentEvent,
  createEmptyAssignedTo,
  updateDemoSurveyAssignments,
  isInfrastructureUnavailableError,
}) => {
  const buildSurveyAssignmentKey = (value) => (value === null ? '__org__' : String(value).toLowerCase());

  const assignSurvey = async ({
    req,
    res,
    surveyId,
    organizationIds,
    normalizedUserIds,
    invalidTargetIds,
    dueProvided,
    dueAtValue,
    noteProvided,
    noteValue,
    statusProvided,
    statusValue,
    metadata,
    assignedBy,
    context,
    requireOrgAccess,
  }) => {
    const assignmentFallbackEnabled = shouldUseAssignmentWriteFallback();
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
          if (resolvedOrgId) canonicalOrganizationId = resolvedOrgId;
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
        deniedError.statusCode = 403;
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
            if (assignmentType && assignmentType !== surveyAssignmentType) return false;
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
            assignment_type: surveyAssignmentType,
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
              [surveyId, canonicalOrganizationId, surveyAssignmentType, effectiveTargetUserIds],
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
            [surveyId, canonicalOrganizationId, surveyAssignmentType],
          );
        };

        let persistedRows = await runVerificationRead();
        const persistedKeys = new Set(persistedRows.map((row) => buildSurveyAssignmentKey(row?.user_key ?? row?.user_id ?? null)));
        let missingKeys = Array.from(expectedKeys).filter((key) => !persistedKeys.has(key));
        if (missingKeys.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 75));
          persistedRows = await runVerificationRead();
          const retryKeys = new Set(persistedRows.map((row) => buildSurveyAssignmentKey(row?.user_key ?? row?.user_id ?? null)));
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

      const mergeMetadata = (existingMeta) => (!existingMeta || typeof existingMeta !== 'object' ? metadata : { ...existingMeta, ...metadata });
      const buildRecord = (userId) => ({
        survey_id: surveyId,
        course_id: null,
        user_id: userId,
        assignment_type: surveyAssignmentType,
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

      logger.info('[survey] assign_db_write_start', {
        requestId: req.requestId ?? null,
        surveyId,
        organizationId: canonicalOrganizationId,
        targetUserCount: effectiveTargetUserIds.length,
      });

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
              [surveyId, surveyAssignmentType, effectiveTargetUserIds],
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
              [surveyId, canonicalOrganizationId, surveyAssignmentType],
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
          const setSegments = ['metadata = coalesce(metadata, \'{}\'::jsonb) || $1::jsonb', 'active = true', 'updated_at = now()'];
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

        return { insertedRows, updatedRows: updates };
      });

      const insertedRows = sqlResult.insertedRows || [];
      const updatedRows = sqlResult.updatedRows || [];
      const persistedRows = await verifyPersistedSurveyAssignments();

      logger.info('[survey] assign_db_write_success', {
        requestId: req.requestId ?? null,
        surveyId,
        organizationId: canonicalOrganizationId,
        insertedCount: insertedRows.length,
        updatedCount: updatedRows.length,
        persistedCount: persistedRows.length,
      });

      aggregateResponse.push(...persistedRows);
      insertedTotal += insertedRows.length;
      updatedTotal += updatedRows.length;
      skippedTotal += Math.max(effectiveTargetUserIds.length - insertedRows.length - updatedRows.length, 0);
      skippedTotal += requestScopedDuplicateSkipCount;

      const insertedIdSet = new Set(insertedRows.map((row) => (row?.id ? String(row.id) : null)).filter(Boolean));
      insertedAssignments.push(...persistedRows.filter((row) => row?.id && insertedIdSet.has(String(row.id))));
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
          if (assignmentType && assignmentType !== surveyAssignmentType) continue;
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
            assignmentType: surveyAssignmentType,
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

      return {
        status: insertedTotal > 0 ? 201 : 200,
        data: aggregateResponse,
        meta: {
          inserted: insertedTotal,
          updated: updatedTotal,
          skipped: skippedTotal,
          invalidTargetIds,
        },
      };
    } catch (error) {
      logger.error('[survey] assign_db_write_failure', {
        requestId: req.requestId ?? null,
        surveyId,
        code: error?.code ?? null,
        statusCode: error?.statusCode ?? null,
        message: error?.message ?? String(error),
        organizationId: error?.meta?.organizationId ?? null,
      });
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

      if (error?.code === '23505') {
        return {
          status: 200,
          data: aggregateResponse,
          meta: {
            inserted: insertedTotal,
            updated: updatedTotal,
            skipped: Math.max(skippedTotal, 1),
            invalidTargetIds,
            duplicateConflictRecovered: true,
          },
        };
      }

      if (error?.statusCode === 400 || error?.code === 'invalid_organization_id') {
        error.statusCode = 400;
        error.code = 'invalid_organization_id';
        error.userMessage = 'One or more organization identifiers are invalid.';
        throw error;
      }
      if (error?.statusCode === 403 || error?.code === 'org_access_denied') {
        error.statusCode = 403;
        error.code = 'org_access_denied';
        error.userMessage = 'You do not have admin access to one or more requested organizations.';
        throw error;
      }
      if (error?.code === 'survey_assignment_persistence_verification_failed') {
        error.statusCode = 503;
        error.code = 'assignment_persistence_verification_failed';
        error.userMessage = 'Survey assignment write could not be verified. Please retry.';
        throw error;
      }
      if (error?.statusCode === 503 || error?.code === 'database_unavailable' || isInfrastructureUnavailableError(error)) {
        error.statusCode = 503;
        error.code = 'database_unavailable';
        error.userMessage = 'Survey assignment write failed because the database is unavailable.';
        throw error;
      }

      error.statusCode = error?.statusCode ?? 500;
      error.code = error?.code ?? 'survey_assignment_failed';
      error.userMessage = error?.userMessage ?? 'Unable to assign survey';
      throw error;
    }
  };

  return {
    assignSurvey,
    async listAssignments({
      surveyId,
      organizationId,
      userIdFilter,
      includeInactive,
      offset,
      limit,
      getAssignmentsOrgColumnName,
      surveyAssignmentSelect,
    }) {
      const assignmentsOrgColumn = await getAssignmentsOrgColumnName();

      if (!supabase && isDemoOrTestMode) {
        const rows = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];
        const filtered = rows
          .filter((row) => {
            if (!row) return false;
            const assignmentType = row.assignment_type ?? row.assignmentType ?? null;
            if (assignmentType && assignmentType !== surveyAssignmentType) return false;
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

        return {
          data: filtered.slice(offset, offset + limit),
          count: filtered.length,
        };
      }

      let query = supabase
        .from('assignments')
        .select(surveyAssignmentSelect, { count: 'planned' })
        .eq('survey_id', surveyId)
        .eq('assignment_type', surveyAssignmentType)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (organizationId) query = query.eq(assignmentsOrgColumn, organizationId);
      if (userIdFilter) query = query.eq('user_id', userIdFilter);
      if (!includeInactive) query = query.eq('active', true);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        data: data || [],
        count: count ?? data?.length ?? 0,
      };
    },
    async deleteAssignment({
      assignmentId,
      hardDelete,
      existing,
    }) {
      if (!supabase && isDemoOrTestMode) {
        const rows = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];
        const index = rows.findIndex((row) => String(row?.id ?? '') === String(assignmentId));
        if (index >= 0) {
          if (hardDelete) {
            rows.splice(index, 1);
          } else {
            rows[index] = {
              ...rows[index],
              active: false,
            };
          }
        }
        return { existing };
      }

      if (hardDelete) {
        const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assignments').update({ active: false }).eq('id', assignmentId);
        if (error) throw error;
      }

      return { existing };
    },
    async fetchAssignment({ assignmentId, surveyIdForLookup, supabaseSelect }) {
      if (!supabase && isDemoOrTestMode) {
        const rows = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];
        return (
          rows.find(
            (row) =>
              String(row?.id ?? '') === String(assignmentId) &&
              String(row?.survey_id ?? row?.surveyId ?? '') === String(surveyIdForLookup) &&
              String(row?.assignment_type ?? row?.assignmentType ?? '') === String(surveyAssignmentType),
          ) ?? null
        );
      }

      const { data, error } = await supabase
        .from('assignments')
        .select(supabaseSelect)
        .eq('id', assignmentId)
        .eq('survey_id', surveyIdForLookup)
        .eq('assignment_type', surveyAssignmentType)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async refreshAggregates(surveyId) {
      await refreshSurveyAssignmentAggregates(surveyId);
    },
  };
};

export default createAdminSurveyAssignmentsService;
