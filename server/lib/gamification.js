const clampInt = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

const toIsoDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const addDaysIso = (isoDate, days) => {
  const d = isoDate ? new Date(`${isoDate}T00:00:00.000Z`) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysBetweenIso = (fromIso, toIso) => {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = new Date(`${toIso}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
};

const LEVEL_THRESHOLDS = [
  0, 80, 180, 320, 500, 720, 980, 1280, 1620, 2000, 2420, 2880, 3380,
];

export const computeGrowthLevel = (xp) => {
  const clampedXp = Math.max(0, clampInt(xp, 0, 10_000_000));
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (clampedXp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return clampInt(level, 1, 99);
};

export const computeLevelProgress = (xp) => {
  const clampedXp = Math.max(0, clampInt(xp, 0, 10_000_000));
  const level = computeGrowthLevel(clampedXp);
  const idx = Math.max(0, level - 1);
  const currentFloor = LEVEL_THRESHOLDS[idx] ?? 0;
  const nextFloor = LEVEL_THRESHOLDS[idx + 1] ?? (currentFloor + 200);
  const span = Math.max(1, nextFloor - currentFloor);
  const progress = (clampedXp - currentFloor) / span;
  return {
    level,
    progressToNext: Math.max(0, Math.min(1, progress)),
    nextLevelXp: nextFloor,
    currentLevelXp: currentFloor,
  };
};

export const xpDeltaForEvent = (eventType, payload = {}) => {
  switch (eventType) {
    case 'lesson_completed':
      return 10;
    case 'course_completed':
      return 45;
    case 'scenario_decision':
      return 4;
    case 'scenario_completed':
      return 24;
    case 'reflection_saved': {
      const status = typeof payload?.status === 'string' ? payload.status : null;
      // Only award XP for submitted reflections. Draft autosaves happen often and
      // should not inflate XP or invite accidental "XP farming".
      return status === 'submitted' ? 18 : 0;
    }
    default:
      return 0;
  }
};

export const applyStreakUpdate = ({
  todayIso,
  lastIso,
  streakCount,
  graceRemaining,
  graceReset = 2,
}) => {
  const streak = clampInt(streakCount ?? 0, 0, 3650);
  const grace = clampInt(graceRemaining ?? graceReset, 0, 7);
  if (!todayIso) {
    return { lastIso: lastIso ?? null, streakCount: streak, graceRemaining: grace };
  }
  if (!lastIso) {
    return { lastIso: todayIso, streakCount: 1, graceRemaining: graceReset };
  }
  if (todayIso === lastIso) {
    return { lastIso, streakCount: streak, graceRemaining: grace };
  }
  const gap = daysBetweenIso(lastIso, todayIso);
  if (gap === null || gap <= 0) {
    return { lastIso: todayIso, streakCount: streak, graceRemaining: grace };
  }
  if (gap === 1) {
    return { lastIso: todayIso, streakCount: streak + 1, graceRemaining: graceReset };
  }
  // gap >= 2: allow grace days to bridge the gap (missed = gap - 1)
  const missed = gap - 1;
  if (missed <= grace) {
    return {
      lastIso: todayIso,
      streakCount: streak + 1,
      graceRemaining: clampInt(grace - missed, 0, graceReset),
    };
  }
  return { lastIso: todayIso, streakCount: 1, graceRemaining: graceReset };
};

const safeScore = (value) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(-5, Math.min(5, n));
};

export const deriveGrowthInsights = (profileRow) => {
  const samples = clampInt(profileRow?.scenario_score_samples ?? 0, 0, 10_000);
  const empathy = Number(profileRow?.avg_empathy ?? 0);
  const inclusion = Number(profileRow?.avg_inclusion ?? 0);
  const effectiveness = Number(profileRow?.avg_effectiveness ?? 0);

  const strengths = [];
  const opportunities = [];

  if (samples >= 3) {
    if (empathy >= 1.2) strengths.push('You consistently lead with empathy in real moments.');
    if (inclusion >= 1.2) strengths.push('You tend to make space for inclusion and shared voice.');
    if (effectiveness >= 1.2) strengths.push('You balance care with forward momentum.');
    if (empathy <= -1.2) opportunities.push('In tense moments, try slowing down to name impact before solutions.');
    if (inclusion <= -1.2) opportunities.push('Consider inviting quieter voices in a low-pressure way.');
    if (effectiveness <= -1.2) opportunities.push('Try closing loops with a clear next step after listening.');
  } else {
    strengths.push('You’re building the habit of showing up for growth.');
  }

  return {
    message: 'You’re making meaningful progress—keep practicing in real moments.',
    strengths: strengths.slice(0, 3),
    opportunities: opportunities.slice(0, 3),
  };
};

const ensureAchievement = async (tx, { userId, orgId, type, metadata = {} }) => {
  if (!type) return;
  await tx`
    insert into public.user_achievements (user_id, org_id, achievement_type, metadata)
    values (${userId}::uuid, ${orgId}::uuid, ${type}, ${metadata})
    on conflict (user_id, achievement_type) do nothing
  `;
};

export const processGamificationEvent = async (
  tx,
  {
    userId,
    orgId,
    courseId = null,
    lessonId = null,
    eventType,
    source = 'server',
    eventId = null,
    payload = {},
    occurredAt = null,
  },
) => {
  if (!userId || !eventType) return { ok: false, reason: 'missing_user_or_type' };

  const todayIso = toIsoDate(occurredAt || new Date());
  const xpDelta = xpDeltaForEvent(eventType, payload);

  // Ensure profile exists.
  await tx`
    insert into public.user_gamification_profile (user_id, org_id, last_active_date)
    values (${userId}::uuid, ${orgId}::uuid, ${todayIso})
    on conflict (user_id) do nothing
  `;

  // De-dupe: only apply scoring once per event id (when provided).
  if (eventId) {
    const inserted = await tx`
      insert into public.user_activity_log (user_id, org_id, course_id, lesson_id, activity_type, source, event_id, payload, created_at)
      values (${userId}::uuid, ${orgId}::uuid, ${courseId}, ${lessonId}, ${eventType}, ${source}, ${eventId}, ${payload}, ${occurredAt || new Date().toISOString()})
      on conflict do nothing
      returning id
    `;
    if (!inserted?.length) {
      return { ok: true, duplicate: true };
    }
  } else {
    await tx`
      insert into public.user_activity_log (user_id, org_id, course_id, lesson_id, activity_type, source, payload, created_at)
      values (${userId}::uuid, ${orgId}::uuid, ${courseId}, ${lessonId}, ${eventType}, ${source}, ${payload}, ${occurredAt || new Date().toISOString()})
    `;
  }

  const rows = await tx`
    select
      user_id,
      org_id,
      level,
      growth_xp,
      lesson_completion_count,
      course_completion_count,
      scenario_completion_count,
      reflection_submission_count,
      learning_streak_count,
      reflection_streak_count,
      learning_grace_days_remaining,
      reflection_grace_days_remaining,
      last_learning_date,
      last_reflection_date,
      last_active_date,
      scenario_score_samples,
      avg_empathy,
      avg_inclusion,
      avg_effectiveness
    from public.user_gamification_profile
    where user_id = ${userId}::uuid
    limit 1
  `;
  const current = rows?.[0] ?? null;
  if (!current) return { ok: false, reason: 'profile_missing' };

  const nextXp = clampInt((current.growth_xp ?? 0) + xpDelta, 0, 10_000_000);
  const levelState = computeLevelProgress(nextXp);

  const updates = {
    org_id: orgId ?? current.org_id ?? null,
    growth_xp: nextXp,
    level: levelState.level,
    last_active_date: todayIso,
    lesson_completion_count: current.lesson_completion_count ?? 0,
    course_completion_count: current.course_completion_count ?? 0,
    scenario_completion_count: current.scenario_completion_count ?? 0,
    reflection_submission_count: current.reflection_submission_count ?? 0,
    learning_streak_count: current.learning_streak_count ?? 0,
    reflection_streak_count: current.reflection_streak_count ?? 0,
    learning_grace_days_remaining: current.learning_grace_days_remaining ?? 2,
    reflection_grace_days_remaining: current.reflection_grace_days_remaining ?? 2,
    last_learning_date: current.last_learning_date ? toIsoDate(current.last_learning_date) : null,
    last_reflection_date: current.last_reflection_date ? toIsoDate(current.last_reflection_date) : null,
    scenario_score_samples: current.scenario_score_samples ?? 0,
    avg_empathy: Number(current.avg_empathy ?? 0),
    avg_inclusion: Number(current.avg_inclusion ?? 0),
    avg_effectiveness: Number(current.avg_effectiveness ?? 0),
  };

  if (eventType === 'lesson_completed') {
    updates.lesson_completion_count += 1;
  }
  if (eventType === 'course_completed') {
    updates.course_completion_count += 1;
  }
  if (eventType === 'scenario_completed') {
    updates.scenario_completion_count += 1;
  }
  if (eventType === 'reflection_saved') {
    const status = typeof payload?.status === 'string' ? payload.status : null;
    if (status === 'submitted') {
      updates.reflection_submission_count += 1;
    }
  }

  const learningQualifies = eventType === 'lesson_completed' || eventType === 'course_completed' || eventType === 'scenario_completed';
  if (learningQualifies) {
    const streak = applyStreakUpdate({
      todayIso,
      lastIso: updates.last_learning_date,
      streakCount: updates.learning_streak_count,
      graceRemaining: updates.learning_grace_days_remaining,
      graceReset: 2,
    });
    updates.last_learning_date = streak.lastIso;
    updates.learning_streak_count = streak.streakCount;
    updates.learning_grace_days_remaining = streak.graceRemaining;
  }

  const reflectionQualifies = eventType === 'reflection_saved' && String(payload?.status || '') === 'submitted';
  if (reflectionQualifies) {
    const streak = applyStreakUpdate({
      todayIso,
      lastIso: updates.last_reflection_date,
      streakCount: updates.reflection_streak_count,
      graceRemaining: updates.reflection_grace_days_remaining,
      graceReset: 2,
    });
    updates.last_reflection_date = streak.lastIso;
    updates.reflection_streak_count = streak.streakCount;
    updates.reflection_grace_days_remaining = streak.graceRemaining;
  }

  if (eventType === 'scenario_completed') {
    const scores = payload?.scores && typeof payload.scores === 'object' ? payload.scores : null;
    const empathy = safeScore(scores?.empathy);
    const inclusion = safeScore(scores?.inclusion);
    const effectiveness = safeScore(scores?.effectiveness);
    if (empathy !== null || inclusion !== null || effectiveness !== null) {
      const n = clampInt(updates.scenario_score_samples, 0, 10_000);
      const nextN = n + 1;
      updates.scenario_score_samples = nextN;
      if (empathy !== null) updates.avg_empathy = (updates.avg_empathy * n + empathy) / nextN;
      if (inclusion !== null) updates.avg_inclusion = (updates.avg_inclusion * n + inclusion) / nextN;
      if (effectiveness !== null) updates.avg_effectiveness = (updates.avg_effectiveness * n + effectiveness) / nextN;
    }
  }

  await tx`
    update public.user_gamification_profile
    set
      org_id = ${updates.org_id}::uuid,
      level = ${updates.level},
      growth_xp = ${updates.growth_xp},
      lesson_completion_count = ${updates.lesson_completion_count},
      course_completion_count = ${updates.course_completion_count},
      scenario_completion_count = ${updates.scenario_completion_count},
      reflection_submission_count = ${updates.reflection_submission_count},
      learning_streak_count = ${updates.learning_streak_count},
      reflection_streak_count = ${updates.reflection_streak_count},
      learning_grace_days_remaining = ${updates.learning_grace_days_remaining},
      reflection_grace_days_remaining = ${updates.reflection_grace_days_remaining},
      last_learning_date = ${updates.last_learning_date},
      last_reflection_date = ${updates.last_reflection_date},
      last_active_date = ${updates.last_active_date},
      scenario_score_samples = ${updates.scenario_score_samples},
      avg_empathy = ${updates.avg_empathy},
      avg_inclusion = ${updates.avg_inclusion},
      avg_effectiveness = ${updates.avg_effectiveness}
    where user_id = ${userId}::uuid
  `;

  // Achievements (professional, non-cartoonish)
  if (updates.lesson_completion_count === 1) {
    await ensureAchievement(tx, { userId, orgId, type: 'learning:first_lesson' });
  }
  if (updates.course_completion_count === 1) {
    await ensureAchievement(tx, { userId, orgId, type: 'learning:first_course' });
  }
  if (updates.scenario_completion_count === 1) {
    await ensureAchievement(tx, { userId, orgId, type: 'leadership:first_scenario' });
  }
  if (updates.reflection_submission_count === 1) {
    await ensureAchievement(tx, { userId, orgId, type: 'reflection:first_entry' });
  }
  if (updates.learning_streak_count >= 7) {
    await ensureAchievement(tx, { userId, orgId, type: 'learning:consistent_7' });
  }
  if (updates.reflection_streak_count >= 7) {
    await ensureAchievement(tx, { userId, orgId, type: 'reflection:consistent_7' });
  }
  if (updates.scenario_score_samples >= 3 && updates.avg_empathy >= 1 && updates.avg_inclusion >= 1) {
    await ensureAchievement(tx, { userId, orgId, type: 'leadership:perspective_builder' });
  }
  if (updates.scenario_score_samples >= 5 && updates.avg_inclusion >= 1.7) {
    await ensureAchievement(tx, { userId, orgId, type: 'leadership:inclusive_thinker' });
  }

  return { ok: true, updated: true, levelState };
};

export const upsertOrgEngagementMetrics = async (tx, orgId) => {
  if (!orgId) return;
  const rows = await tx`
    select
      coalesce(avg(learning_streak_count), 0)::numeric as avg_learning_streak,
      coalesce(avg(reflection_streak_count), 0)::numeric as avg_reflection_streak,
      coalesce(avg(case when course_completion_count > 0 then 1 else 0 end), 0)::numeric as completion_rate,
      coalesce(avg(
        (least(learning_streak_count, 14) / 14.0)
        + (least(reflection_submission_count, 8) / 8.0)
        + (least(scenario_completion_count, 8) / 8.0)
      ), 0)::numeric as engagement_score
    from public.user_gamification_profile
    where org_id = ${orgId}::uuid
  `;
  const agg = rows?.[0] ?? null;
  if (!agg) return;
  await tx`
    insert into public.org_engagement_metrics (org_id, avg_learning_streak, avg_reflection_streak, completion_rate, engagement_score)
    values (
      ${orgId}::uuid,
      ${agg.avg_learning_streak},
      ${agg.avg_reflection_streak},
      ${agg.completion_rate},
      ${agg.engagement_score}
    )
    on conflict (org_id) do update set
      avg_learning_streak = excluded.avg_learning_streak,
      avg_reflection_streak = excluded.avg_reflection_streak,
      completion_rate = excluded.completion_rate,
      engagement_score = excluded.engagement_score,
      updated_at = timezone('utc', now())
  `;
};
