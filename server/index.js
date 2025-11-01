import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8787;

app.use(express.json({ limit: '10mb' }));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase service credentials not configured on server' });
    return false;
  }
  return true;
};

const writableMembershipRoles = new Set(['owner', 'admin', 'editor', 'manager']);

const getRequestContext = (req) => {
  const userIdHeader = req.get('x-user-id');
  const userRoleHeader = req.get('x-user-role');
  const userId = userIdHeader && userIdHeader.trim().length > 0 ? userIdHeader.trim() : null;
  const userRole = userRoleHeader && userRoleHeader.trim().length > 0 ? userRoleHeader.trim().toLowerCase() : null;
  return { userId, userRole };
};

const requireUserContext = (req, res) => {
  const { userId, userRole } = getRequestContext(req);
  if (userRole === 'admin') {
    return { userId, userRole };
  }
  if (!userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }
  return { userId, userRole };
};

const fetchMembership = async (orgId, userId) => {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const requireOrgAccess = async (req, res, orgId, { write = false } = {}) => {
  const context = getRequestContext(req);
  if (context.userRole === 'admin') {
    return { userId: context.userId, role: 'admin' };
  }

  if (!context.userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }

  try {
    const membership = await fetchMembership(orgId, context.userId);
    if (!membership) {
      res.status(403).json({ error: 'Organization membership required' });
      return null;
    }

    const memberRole = (membership.role || 'member').toLowerCase();
    if (write && !writableMembershipRoles.has(memberRole)) {
      res.status(403).json({ error: 'Insufficient organization permissions' });
      return null;
    }

    return { userId: context.userId, role: memberRole };
  } catch (error) {
    console.error(`Failed to verify membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to verify organization access' });
    return null;
  }
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', supabaseConfigured: Boolean(supabase) });
});

app.get('/api/admin/courses', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    res.status(500).json({ error: 'Unable to fetch courses' });
  }
});

app.post('/api/admin/courses', async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { course, modules = [] } = req.body || {};
  if (!course?.title) {
    res.status(400).json({ error: 'Course title is required' });
    return;
  }

  try {
    const meta = course.meta ?? {};

    const { data: courseRow, error: upsertError } = await supabase
      .from('courses')
      .upsert({
        id: course.id,
        organization_id: course.organizationId ?? null,
        slug: course.slug ?? null,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: meta,
        published_at: meta.published_at ?? null,
        due_date: meta.due_date ?? null
      })
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    const incomingModuleIds = modules.map((module) => module.id);
    if (incomingModuleIds.length > 0) {
      const { data: existingModules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseRow.id);

      const modulesToDelete = (existingModules || [])
        .map((row) => row.id)
        .filter((id) => !incomingModuleIds.includes(id));

      if (modulesToDelete.length > 0) {
        await supabase.from('modules').delete().in('id', modulesToDelete);
      }

      for (const [moduleIndex, module] of modules.entries()) {
        const { data: moduleRow, error: moduleError } = await supabase
          .from('modules')
          .upsert({
            id: module.id,
            course_id: courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null
          })
          .select('*')
          .single();

        if (moduleError) throw moduleError;

        const lessons = module.lessons || [];
        const incomingLessonIds = lessons.map((lesson) => lesson.id);

        if (incomingLessonIds.length > 0) {
          const { data: existingLessons } = await supabase
            .from('lessons')
            .select('id')
            .eq('module_id', moduleRow.id);

          const lessonsToDelete = (existingLessons || [])
            .map((row) => row.id)
            .filter((id) => !incomingLessonIds.includes(id));

          if (lessonsToDelete.length > 0) {
            await supabase.from('lessons').delete().in('id', lessonsToDelete);
          }

          for (const [lessonIndex, lesson] of lessons.entries()) {
            const { error: lessonError } = await supabase
              .from('lessons')
              .upsert({
                id: lesson.id,
                module_id: moduleRow.id,
                order_index: lesson.order_index ?? lessonIndex,
                type: lesson.type,
                title: lesson.title,
                description: lesson.description ?? null,
                duration_s: lesson.duration_s ?? null,
                content_json: lesson.content_json ?? {},
                completion_rule_json: lesson.completion_rule_json ?? null
              });

            if (lessonError) throw lessonError;
          }
        } else {
          await supabase.from('lessons').delete().eq('module_id', moduleRow.id);
        }
      }
    } else {
      await supabase.from('modules').delete().eq('course_id', courseRow.id);
    }

    const refreshed = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq('id', courseRow.id)
      .single();

    if (refreshed.error) throw refreshed.error;

    res.status(201).json({ data: refreshed.data });
  } catch (error) {
    console.error('Failed to upsert course:', error);
    res.status(500).json({ error: 'Unable to save course' });
  }
});

app.post('/api/admin/courses/:id/publish', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('courses')
      .update({ status: 'published', version: (req.body?.version ?? 1), published_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error(`Failed to publish course ${id}:`, error);
    res.status(500).json({ error: 'Unable to publish course' });
  }
});

app.post('/api/admin/courses/:id/assign', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const { organization_id, user_ids = [], due_at } = req.body || {};

  if (!organization_id) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  try {
    const assignmentsPayload = (user_ids.length > 0 ? user_ids : [null]).map((userId) => ({
      organization_id,
      course_id: id,
      user_id: userId,
      due_at: due_at ?? null,
      active: true
    }));

    const { data, error } = await supabase
      .from('assignments')
      .insert(assignmentsPayload)
      .select('*');

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to assign course:', error);
    res.status(500).json({ error: 'Unable to assign course' });
  }
});

app.delete('/api/admin/courses/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete course:', error);
    res.status(500).json({ error: 'Unable to delete course' });
  }
});

app.get('/api/client/courses', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch published courses:', error);
    res.status(500).json({ error: 'Unable to fetch courses' });
  }
});

app.get('/api/client/courses/:identifier', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { identifier } = req.params;
  const { includeDrafts } = req.query;

  const buildQuery = (column, value) => {
    let query = supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq(column, value)
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' })
      .maybeSingle();

    if (!includeDrafts) {
      query = query.eq('status', 'published');
    }

    return query;
  };

  try {
    let { data, error } = await buildQuery('id', identifier);

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      ({ data, error } = await buildQuery('slug', identifier));
      if (error && error.code !== 'PGRST116') throw error;
    }

    res.json({ data: data ?? null });
  } catch (error) {
    console.error(`Failed to fetch course ${identifier}:`, error);
    res.status(500).json({ error: 'Unable to load course' });
  }
});

app.post('/api/client/progress/course', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id, percent, status, time_spent_s } = req.body || {};

  if (!user_id || !course_id) {
    res.status(400).json({ error: 'user_id and course_id are required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('user_course_progress')
      .upsert({
        user_id,
        course_id,
        percent: percent ?? 0,
        status: status ?? 'in_progress',
        time_spent_s: time_spent_s ?? 0
      }, { onConflict: 'user_id,course_id' })
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to upsert course progress:', error);
    res.status(500).json({ error: 'Unable to save course progress' });
  }
});

app.post('/api/client/progress/lesson', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};

  if (!user_id || !lesson_id) {
    res.status(400).json({ error: 'user_id and lesson_id are required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('user_lesson_progress')
      .upsert({
        user_id,
        lesson_id,
        percent: percent ?? 0,
        status: status ?? 'in_progress',
        time_spent_s: time_spent_s ?? 0,
        resume_at_s: resume_at_s ?? null
      }, { onConflict: 'user_id,lesson_id' })
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to upsert lesson progress:', error);
    res.status(500).json({ error: 'Unable to save lesson progress' });
  }
});

app.post('/api/client/certificates/:courseId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { courseId } = req.params;
  const { id, user_id, pdf_url, metadata = {} } = req.body || {};

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('certificates')
      .insert({
        id: id ?? undefined,
        user_id,
        course_id: courseId,
        pdf_url: pdf_url ?? null,
        metadata
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create certificate:', error);
    res.status(500).json({ error: 'Unable to create certificate' });
  }
});

app.get('/api/client/certificates', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id } = req.query;

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
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch certificates:', error);
    res.status(500).json({ error: 'Unable to fetch certificates' });
  }
});

// Organization management
app.get('/api/admin/organizations', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    res.status(500).json({ error: 'Unable to fetch organizations' });
  }
});

app.post('/api/admin/organizations', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.name || !payload.contact_email || !payload.subscription) {
    res.status(400).json({ error: 'name, contact_email, and subscription are required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        id: payload.id ?? undefined,
        name: payload.name,
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
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create organization:', error);
    res.status(500).json({ error: 'Unable to create organization' });
  }
});

app.put('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const { data, error } = await supabase
      .from('organizations')
      .update({
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
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update organization:', error);
    res.status(500).json({ error: 'Unable to update organization' });
  }
});

app.delete('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete organization:', error);
    res.status(500).json({ error: 'Unable to delete organization' });
  }
});

// Organization memberships
app.get('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access && context.userRole !== 'admin') return;

  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('id, user_id, role, invited_by, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    console.error(`Failed to list organization members for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to load organization members' });
  }
});

app.post('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const { userId, role = 'member' } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access && context.userRole !== 'admin') return;

  try {
    const normalizedRole = String(role || 'member').toLowerCase();
    const payload = {
      org_id: orgId,
      user_id: userId,
      role: normalizedRole,
      invited_by: context.userId ?? null
    };

    const { data, error } = await supabase
      .from('organization_memberships')
      .upsert(payload, { onConflict: 'org_id,user_id' })
      .select('id, org_id, user_id, role, invited_by, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error(`Failed to add organization member for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to add organization member' });
  }
});

app.delete('/api/admin/organizations/:orgId/members/:membershipId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, membershipId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const existing = await supabase
      .from('organization_memberships')
      .select('id, org_id, user_id, role')
      .eq('id', membershipId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const membership = existing.data;

    if (!membership) {
      res.status(204).end();
      return;
    }

    if (membership.org_id !== orgId) {
      res.status(400).json({ error: 'Membership does not belong to organization' });
      return;
    }

    const access = await requireOrgAccess(req, res, orgId, { write: true });
    if (!access && context.userRole !== 'admin' && context.userId !== membership.user_id) {
      return;
    }

    const { error } = await supabase
      .from('organization_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to remove organization member ${membershipId}:`, error);
    res.status(500).json({ error: 'Unable to remove organization member' });
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

    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toStrategicPlan(data) });
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

    const { data, error } = await supabase
      .from('org_workspace_session_notes')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toSessionNote(data) });
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

    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toActionItem(data) });
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

    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data: toActionItem(data) });
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

// Document library
app.get('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { org_id, user_id, tag, category, search, visibility } = req.query;

  try {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (org_id) {
      query = query.eq('org_id', org_id);
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

    const { data, error } = await query;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

app.post('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.name || !payload.category) {
    res.status(400).json({ error: 'name and category are required' });
    return;
  }

  try {
    const insertPayload = {
      id: payload.id ?? undefined,
      name: payload.name,
      filename: payload.filename ?? null,
      url: payload.url ?? null,
      category: payload.category,
      subcategory: payload.subcategory ?? null,
      tags: payload.tags ?? [],
      file_type: payload.fileType ?? null,
      visibility: payload.visibility ?? 'global',
      org_id: payload.orgId ?? null,
      user_id: payload.userId ?? null,
      created_by: payload.createdBy ?? null,
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create document:', error);
    res.status(500).json({ error: 'Unable to create document' });
  }
});

app.put('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const updatePayload = {};
    const map = {
      name: 'name',
      filename: 'filename',
      url: 'url',
      category: 'category',
      subcategory: 'subcategory',
      tags: 'tags',
      fileType: 'file_type',
      visibility: 'visibility',
      orgId: 'org_id',
      userId: 'user_id',
      metadata: 'metadata'
    };

    Object.entries(map).forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        updatePayload[column] = patch[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
      if (error) throw error;
      res.json({ data });
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Unable to update document' });
  }
});

app.post('/api/admin/documents/:id/download', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase.rpc('increment_document_download', { doc_id: id });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to record document download:', error);
    res.status(500).json({ error: 'Unable to record download' });
  }
});

app.delete('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Unable to delete document' });
  }
});

// Surveys
app.get('/api/admin/surveys', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch surveys:', error);
    res.status(500).json({ error: 'Unable to fetch surveys' });
  }
});

app.get('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error(`Failed to fetch survey ${id}:`, error);
    res.status(500).json({ error: 'Unable to fetch survey' });
  }
});

app.post('/api/admin/surveys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    const insertPayload = {
      id: payload.id ?? undefined,
      title: payload.title,
      description: payload.description ?? null,
      type: payload.type ?? null,
      status: payload.status ?? 'draft',
      sections: payload.sections ?? [],
      branding: payload.branding ?? {},
      settings: payload.settings ?? {},
      assigned_to: payload.assignedTo ?? [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('surveys')
      .upsert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to save survey:', error);
    res.status(500).json({ error: 'Unable to save survey' });
  }
});

app.put('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const updatePayload = {
      title: patch.title,
      description: patch.description,
      type: patch.type,
      status: patch.status,
      sections: patch.sections,
      branding: patch.branding,
      settings: patch.settings,
      assigned_to: patch.assignedTo,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('surveys')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update survey:', error);
    res.status(500).json({ error: 'Unable to update survey' });
  }
});

app.delete('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete survey:', error);
    res.status(500).json({ error: 'Unable to delete survey' });
  }
});

// Notifications
app.get('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { org_id, user_id } = req.query;
  const context = requireUserContext(req, res);
  if (!context) return;

  const isAdmin = context.userRole === 'admin';

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (org_id) {
      const access = await requireOrgAccess(req, res, org_id);
      if (!access && !isAdmin) return;
      query = query.eq('org_id', org_id);
    }

    if (user_id) {
      if (!isAdmin && context.userId && user_id !== context.userId) {
        res.status(403).json({ error: 'Cannot view notifications for another user' });
        return;
      }
      query = query.eq('user_id', user_id);
    } else if (!isAdmin) {
      if (!context.userId) {
        res.status(400).json({ error: 'user_id is required for non-admin queries' });
        return;
      }
      query = query.eq('user_id', context.userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const filtered = isAdmin
      ? data
      : (data || []).filter((note) => {
          if (note.user_id) return note.user_id === context.userId;
          if (note.org_id) return true;
          return false;
        });

    res.json({ data: filtered });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Unable to fetch notifications' });
  }
});

app.post('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  if (payload.orgId) {
    const access = await requireOrgAccess(req, res, payload.orgId, { write: true });
    if (!access && !isAdmin) return;
  } else if (payload.userId) {
    if (!isAdmin && payload.userId !== context.userId) {
      res.status(403).json({ error: 'Cannot create notifications for another user' });
      return;
    }
  } else if (!isAdmin) {
    res.status(403).json({ error: 'Only admins can create global notifications' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        id: payload.id ?? undefined,
        title: payload.title,
        body: payload.body ?? null,
        org_id: payload.orgId ?? null,
        user_id: payload.userId ?? null,
        read: payload.read ?? false
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Unable to create notification' });
  }
});

app.post('/api/admin/notifications/:id/read', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const { read = true } = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const note = existing.data;
    if (!note) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({ error: 'Cannot modify another user\'s notification' });
          return;
        }
      } else if (note.org_id) {
        const access = await requireOrgAccess(req, res, note.org_id);
        if (!access) return;
      } else {
        res.status(403).json({ error: 'Cannot modify global notification' });
        return;
      }
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ read })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update notification status:', error);
    res.status(500).json({ error: 'Unable to update notification' });
  }
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const note = existing.data;
    if (!note) {
      res.status(204).end();
      return;
    }

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({ error: 'Cannot delete another user\'s notification' });
          return;
        }
      } else if (note.org_id) {
        const access = await requireOrgAccess(req, res, note.org_id, { write: true });
        if (!access) return;
      } else {
        res.status(403).json({ error: 'Cannot delete global notification' });
        return;
      }
    }

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Unable to delete notification' });
  }
});

app.post('/api/analytics/events', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id, user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload } = req.body || {};

  if (!event_type) {
    res.status(400).json({ error: 'event_type is required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        id: id ?? undefined,
        user_id: user_id ?? null,
        course_id: course_id ?? null,
        lesson_id: lesson_id ?? null,
        module_id: module_id ?? null,
        event_type,
        session_id: session_id ?? null,
        user_agent: user_agent ?? null,
        payload: payload ?? {}
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to record analytics event:', error);
    res.status(500).json({ error: 'Unable to record analytics event' });
  }
});

app.get('/api/analytics/events', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id, limit = 200 } = req.query;

  try {
    let query = supabase
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch analytics events:', error);
    res.status(500).json({ error: 'Unable to fetch analytics events' });
  }
});

app.post('/api/analytics/journeys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id, journey } = req.body || {};

  if (!user_id || !course_id) {
    res.status(400).json({ error: 'user_id and course_id are required' });
    return;
  }

  try {
    const payload = {
      user_id,
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
      path_taken: journey?.pathTaken ?? []
    };

    const { data, error } = await supabase
      .from('learner_journeys')
      .upsert(payload, { onConflict: 'user_id,course_id' })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to upsert learner journey:', error);
    res.status(500).json({ error: 'Unable to save learner journey' });
  }
});

app.get('/api/analytics/journeys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id } = req.query;

  try {
    let query = supabase
      .from('learner_journeys')
      .select('*');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch learner journeys:', error);
    res.status(500).json({ error: 'Unable to fetch learner journeys' });
  }
});

const distPath = path.resolve(__dirname, '../dist');

// Serve static files from the dist directory
app.use(express.static(distPath));

// For SPA client-side routing — serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serving production build from ${distPath} at http://localhost:${port}`);
});
