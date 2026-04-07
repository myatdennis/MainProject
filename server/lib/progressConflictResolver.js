const normalizeErrorText = (value) => String(value || '').toLowerCase();

export const isConflictConstraintMissing = (error) => {
  const message = normalizeErrorText(error?.message);
  const details = normalizeErrorText(error?.details);
  const hint = normalizeErrorText(error?.hint);
  return (
    error?.code === '42P10' ||
    message.includes('no unique') ||
    message.includes('on conflict') ||
    details.includes('no unique') ||
    details.includes('on conflict') ||
    hint.includes('conflict target') ||
    hint.includes('on conflict')
  );
};

const dedupeTargets = (targets = []) => {
  const seen = new Set();
  const ordered = [];
  for (const target of targets) {
    const normalized = String(target || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
};

/**
 * @param {{
 *   includeCourseId?: boolean,
 *   orgColumn?: string | null,
 *   includeOrgScope?: boolean,
 * }} [options]
 */
export const buildLessonProgressConflictTargets = ({
  includeCourseId = false,
  orgColumn = undefined,
  includeOrgScope = false,
} = {}) => {
  const targets = ['user_id,lesson_id'];
  if (includeCourseId) {
    targets.push('user_id,course_id,lesson_id');
  }
  if (includeOrgScope && orgColumn) {
    targets.push(`user_id,${orgColumn},lesson_id`);
    if (includeCourseId) {
      targets.push(`user_id,${orgColumn},course_id,lesson_id`);
    }
  }
  return dedupeTargets(targets);
};

export const buildCourseProgressConflictTargets = ({
  includeUserIdUuid = false,
  includeOrgScope = false,
  orgColumn = 'organization_id',
} = {}) => {
  const userColumns = includeUserIdUuid ? ['user_id_uuid', 'user_id'] : ['user_id'];
  const targets = [];
  for (const userColumn of userColumns) {
    targets.push(`${userColumn},course_id`);
    if (includeOrgScope && orgColumn) {
      targets.push(`${userColumn},${orgColumn},course_id`);
    }
  }
  return dedupeTargets(targets);
};

export const upsertWithConflictFallback = async ({
  supabase,
  table,
  payload,
  conflictTargets,
  select = '*',
  logger,
  context = {},
}) => {
  const targets = dedupeTargets(conflictTargets);
  if (!supabase) {
    throw new Error('supabase_unavailable');
  }
  if (!table) {
    throw new Error('table_required');
  }
  if (targets.length === 0) {
    throw new Error('conflict_target_required');
  }

  let lastError = null;

  for (let attempt = 0; attempt < targets.length; attempt += 1) {
    const conflictTarget = targets[attempt];
    const result = await supabase
      .from(table)
      .upsert(payload, { onConflict: conflictTarget })
      .select(select);

    if (!result.error) {
      return {
        data: result.data || [],
        conflictTarget,
      };
    }

    lastError = result.error;
    const shouldRetry = isConflictConstraintMissing(result.error) && attempt < targets.length - 1;

    if (shouldRetry) {
      logger?.warn?.('progress_upsert_conflict_target_retry', {
        table,
        conflictTarget,
        nextConflictTarget: targets[attempt + 1],
        code: result.error?.code ?? null,
        message: result.error?.message ?? null,
        requestId: context.requestId ?? null,
        userId: context.userId ?? null,
        orgId: context.orgId ?? null,
        failingFunction: context.failingFunction ?? null,
      });
      continue;
    }

    break;
  }

  throw lastError || new Error('progress_upsert_failed');
};
