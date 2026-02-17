import { createClient } from "@supabase/supabase-js";
import { z } from "npm:zod@3.23.8";
import {
  moduleSchema,
  modulePatchSchema,
  lessonSchema,
  lessonPatchSchema,
  moduleReorderSchema,
  lessonReorderSchema,
} from "../../../shared/api/schemas.ts";
import type {
  Module as ModuleDto,
  Lesson as LessonDto,
  ModuleInput,
  ModulePatchInput,
  LessonInput,
  LessonPatchInput,
  ModuleReorderInput,
  LessonReorderInput,
  Course as CourseDto,
} from "../../../shared/api/types.ts";

type Role = "admin" | "member" | "owner";

type MembershipContext = {
  orgId: string;
  role: Role;
};
type ModuleRecord = {
  id: string;
  course_id: string;
  organization_id?: string | null;
};
type CourseRecord = {
  id: string;
  organization_id: string | null;
};
type LessonRecord = {
  id: string;
  module_id: string;
  course_id?: string | null;
  organization_id?: string | null;
};

interface RequestContext {
  userId: string | null;
  role: Role | null;
  orgId: string | null;
  authorization: string | null;
  memberships: MembershipContext[];
}

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-user-id, x-user-role, x-org-id, content-type",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "content-type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  global: { headers: { "X-Client-Info": "api-edge-router" } },
});

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders });

const errorJson = (status: number, code: string, message: string) => json({ code, message }, status);

const decodeJwt = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="));
    return JSON.parse(decoded);
  } catch (_err) {
    return null;
  }
};

const normalizeRole = (value: unknown): Role | null => {
  if (typeof value !== "string") return null;
  const lowered = value.toLowerCase();
  if (lowered === "admin" || lowered === "member" || lowered === "owner") {
    return lowered as Role;
  }
  return null;
};

const roleSatisfies = (actual: Role | null, requiredRoles: Role[]): boolean => {
  if (!actual) return false;
  return requiredRoles.some((required) => {
    if (actual === required) return true;
    if (actual === "owner" && required === "admin") return true;
    return false;
  });
};

const fetchMemberships = async (userId: string): Promise<MembershipContext[]> => {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("org_id, role")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load organization memberships", error);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      if (typeof row.org_id !== "string") return null;
      const role = normalizeRole(row.role);
      if (!role) return null;
      return { orgId: row.org_id, role };
    })
    .filter((entry): entry is MembershipContext => Boolean(entry));
};

const getContext = async (req: Request): Promise<RequestContext> => {
  const headers = req.headers;
  const authorization = headers.get("authorization");
  let userId: string | null = null;
  let roleFromToken: Role | null = null;
  let claims: Record<string, unknown> | null = null;

  if (authorization?.startsWith("Bearer ")) {
    claims = decodeJwt(authorization.slice(7));
    if (typeof claims?.sub === "string") {
      userId = claims.sub;
    }
    const claimRole =
      claims?.role ??
      claims?.user_role ??
      (claims?.app_metadata as Record<string, unknown> | undefined)?.role ??
      (claims?.appRoles as string[] | undefined)?.[0];
    roleFromToken = normalizeRole(claimRole);
  }

  const memberships = userId ? await fetchMemberships(userId) : [];
  const requestedOrgId = headers.get("x-org-id");
  let resolvedOrgId: string | null = null;
  let membershipRole: Role | null = null;

  if (requestedOrgId) {
    const match = memberships.find((membership) => membership.orgId === requestedOrgId);
    if (match) {
      resolvedOrgId = match.orgId;
      membershipRole = match.role;
    }
  }

  if (!resolvedOrgId && memberships.length === 1) {
    resolvedOrgId = memberships[0].orgId;
    membershipRole = memberships[0].role;
  }

  if (!membershipRole && resolvedOrgId) {
    const match = memberships.find((membership) => membership.orgId === resolvedOrgId);
    if (match) {
      membershipRole = match.role;
    }
  }

  return {
    userId: userId ?? null,
    role: membershipRole ?? roleFromToken ?? null,
    orgId: resolvedOrgId,
    authorization: authorization ?? null,
    memberships,
  };
};

const ensureOrgAccess = (
  ctx: RequestContext,
  requestedOrgId?: string | null,
): { orgId: string; membership: MembershipContext } | Response => {
  const target = requestedOrgId ?? ctx.orgId;
  if (!target) {
    return errorJson(403, "ORG_ACCESS_REQUIRED", "You must select an organization you belong to.");
  }
  const membership = ctx.memberships.find((entry) => entry.orgId === target);
  if (!membership) {
    return errorJson(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }
  return { orgId: membership.orgId, membership };
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || crypto.randomUUID();

const normalizeOrganization = (row: Record<string, any>) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  contact_email: row.contact_email,
  subscription: row.subscription,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const moduleSelectColumns =
  "id, course_id, organization_id, title, description, order_index, metadata, created_at, updated_at";
const lessonSelectColumns =
  "id, module_id, course_id, organization_id, title, description, order_index, type, duration_s, content_json, completion_rule_json, created_at, updated_at";

const mapLesson = (row: Record<string, any>): LessonDto => {
  const moduleId =
    (row.module_id ?? row.moduleId ?? row.parent_module_id ?? row.module?.id ?? row.parentModuleId) ??
    null;
  const content = (row.content_json ?? row.content ?? {}) as Record<string, unknown>;
  if (!content.type) {
    content.type = row.type ?? "text";
  }

  return {
    id: row.id,
    moduleId: moduleId ?? "",
    title: row.title,
    description: row.description ?? null,
    type: (row.type ?? "text") as LessonDto["type"],
    orderIndex: row.order_index ?? 0,
    durationSeconds: typeof row.duration_s === "number" ? row.duration_s : null,
    content: content as LessonDto["content"],
    completionRule: row.completion_rule_json ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
};

const mapModule = (row: Record<string, any>): ModuleDto => {
  const lessonsRaw = Array.isArray(row.lessons) ? row.lessons : undefined;
  const lessons = lessonsRaw
    ? lessonsRaw
        .map((lesson: Record<string, any>) => mapLesson({ ...lesson, module_id: lesson.module_id ?? row.id }))
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : undefined;

  return {
    id: row.id,
    courseId: row.course_id ?? row.courseId ?? null,
    organizationId: row.organization_id ?? row.org_id ?? null,
    title: row.title,
    description: row.description ?? null,
    orderIndex: row.order_index ?? 0,
    metadata: row.metadata ?? null,
    lessons,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
};

const mapCourse = (row: Record<string, any>): CourseDto => {
  const modulesRaw = Array.isArray(row.modules) ? row.modules : [];
  const modules = modulesRaw
    .map((module: Record<string, any>) => mapModule({ ...module, course_id: module.course_id ?? row.id }))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const statusValue = typeof row.status === "string" ? row.status.toLowerCase() : "draft";
  const status: CourseDto["status"] =
    statusValue === "published" || statusValue === "archived" ? (statusValue as CourseDto["status"]) : "draft";

  return {
    id: row.id,
    name: row.name ?? row.title ?? "",
    slug: row.slug ?? row.id ?? "",
    organizationId: row.organization_id ?? row.org_id ?? null,
    status,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    modules,
  };
};

const normalizeJsonPayload = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

const fetchCourseRecord = async (courseId: string): Promise<CourseRecord | Response> => {
  const { data, error } = await supabase
    .from("courses")
    .select("id, organization_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) return handleDbError(error);
  if (!data) {
    return errorJson(404, "COURSE_NOT_FOUND", "Course not found.");
  }

  if (!data.organization_id) {
    return errorJson(422, "COURSE_ORG_MISSING", "Course is missing an organization assignment.");
  }

  return data as CourseRecord;
};

const fetchModuleContext = async (
  moduleId: string,
): Promise<{ module: ModuleRecord; course: CourseRecord; orgId: string } | Response> => {
  const { data: module, error } = await supabase
    .from("modules")
    .select("id, course_id, organization_id")
    .eq("id", moduleId)
    .maybeSingle();

  if (error) return handleDbError(error);
  if (!module) {
    return errorJson(404, "module_not_found", "Module not found.");
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, organization_id")
    .eq("id", module.course_id)
    .maybeSingle();

  if (courseError) return handleDbError(courseError);
  if (!course) {
    return errorJson(422, "MODULE_PARENT_MISSING", "Module is missing its parent course.");
  }

  const orgId = course.organization_id ?? module.organization_id ?? null;
  if (!orgId) {
    return errorJson(422, "ORG_SCOPE_MISSING", "Course is missing an organization assignment.");
  }

  return { module, course, orgId };
};

const fetchLessonRecord = async (lessonId: string): Promise<LessonRecord | Response> => {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, module_id, course_id, organization_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) return handleDbError(error);
  if (!data) {
    return errorJson(404, "NOT_FOUND", "Lesson not found");
  }
  return data as LessonRecord;
};

const requireUser = (ctx: RequestContext) => {
  if (!ctx.userId) {
    return errorJson(401, "UNAUTHENTICATED", "Missing user context. Supply a valid Authorization header.");
  }
  return null;
};

const requireRole = (ctx: RequestContext, roles: Role[], options?: { orgId?: string | null }) => {
  const targetOrgId = options?.orgId ?? ctx.orgId;
  if (targetOrgId) {
    const membership = ctx.memberships.find((entry) => entry.orgId === targetOrgId);
    if (membership && roleSatisfies(membership.role, roles)) {
      return null;
    }
    return errorJson(403, "forbidden", "You do not have permission to perform this action.");
  }
  if (roleSatisfies(ctx.role, roles)) {
    return null;
  }
  return errorJson(403, "forbidden", "You do not have permission to perform this action.");
};

const handleDbError = (error: any) => {
  console.error("Supabase error", error);
  if (error?.code === "23505") {
    return errorJson(409, "CONFLICT", error.message ?? "Record already exists.");
  }
  if (error?.code === "PGRST116" || error?.code === "PGRST100") {
    return errorJson(404, error.code, error.message ?? "Record not found.");
  }
  const message =
    typeof error?.message === "string" && error.message.length > 0
      ? error.message
      : "Database operation failed.";
  return errorJson(error?.status ?? 500, error?.code ?? "DB_ERROR", message);
};

const coerceUserId = (ctx: RequestContext, fallback?: string | null) => ctx.userId ?? fallback ?? null;

const readJson = async <T>(req: Request): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch (_err) {
    return null;
  }
};

const validationError = (error: z.ZodError) =>
  errorJson(400, "validation_error", error.errors.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join("; "));

const noContent = () => new Response(null, { status: 204, headers: corsHeaders });

const normalizePercent = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const parseLessonProgressInput = (rawLessons: unknown[]) => {
  if (!Array.isArray(rawLessons)) return [];
  const seen = new Set<string>();
  const lessons: {
    lessonId: string;
    progressPercent: number;
    completed: boolean;
    positionSeconds: number;
    lastAccessedAt?: string;
  }[] = [];

  rawLessons.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const lessonId = (item as any).lessonId ?? (item as any).lesson_id;
    if (!lessonId || typeof lessonId !== "string") return;
    if (seen.has(lessonId)) return;
    seen.add(lessonId);

    const progressPercent = normalizePercent(
      typeof (item as any).progressPercent === "number"
        ? (item as any).progressPercent
        : (item as any).progress_percentage
    );
    const positionSeconds = Math.max(
      0,
      Math.round(
        typeof (item as any).positionSeconds === "number"
          ? (item as any).positionSeconds
          : (item as any).time_spent ?? 0
      )
    );
    const completed =
      typeof (item as any).completed === "boolean"
        ? (item as any).completed
        : progressPercent >= 100;

    const lastAccessedAt = (item as any).lastAccessedAt ?? (item as any).last_accessed_at;

    lessons.push({
      lessonId,
      progressPercent,
      completed,
      positionSeconds,
      lastAccessedAt: typeof lastAccessedAt === "string" ? lastAccessedAt : undefined,
    });
  });

  return lessons;
};

const nextModuleOrderIndex = async (courseId: string): Promise<number> => {
  const { data } = await supabase
    .from('modules')
    .select('order_index')
    .eq('course_id', courseId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.order_index ?? -1) + 1;
};

const nextLessonOrderIndex = async (moduleId: string): Promise<number> => {
  const { data } = await supabase
    .from('lessons')
    .select('order_index')
    .eq('module_id', moduleId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.order_index ?? -1) + 1;
};

const recordAnalyticsEvent = async (
  type: string,
  ctx: RequestContext,
  userId: string,
  courseId: string | null,
  payload: Record<string, unknown> = {}
) => {
  const eventPayload = {
    user_id: userId,
    course_id: courseId,
    lesson_id: payload.lessonId ?? null,
    module_id: payload.moduleId ?? null,
    event_type: type,
    session_id: (payload.sessionId as string | undefined) ?? crypto.randomUUID(),
    user_agent: (payload.userAgent as string | undefined) ?? "progress-api",
    payload,
  };

  const insertPayload = (payloadId?: string) => ({
    ...(payloadId ? { id: payloadId } : {}),
    ...eventPayload,
  });

  const result = await supabase
    .from("analytics_events")
    .upsert([insertPayload(payload?.id as string | undefined)], { onConflict: "id" })
    .select("id")
    .maybeSingle();

  if (result.error) {
    // Do not interrupt primary flow for analytics logging.
    console.warn("Failed to record analytics event", result.error);
  }
};

const listCourses = async (ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"]);
  if (authError) return authError;

  const access = ensureOrgAccess(ctx);
  if (access instanceof Response) return access;

  const { data, error } = await supabase
    .from("courses")
    .select("id, name, title, slug, organization_id, created_by, created_at, updated_at, status")
    .eq("organization_id", access.orgId)
    .order("created_at", { ascending: false });
  if (error) return handleDbError(error);

  const normalized = (data ?? []).map(mapCourse);
  return json({ data: normalized });
};

const createCourse = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const raw = await readJson<Record<string, any>>(req);
  if (!raw) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const payload = typeof raw.course === "object" && raw.course !== null ? raw.course : raw;
  const nameInput = (payload.name ?? payload.title ?? "").toString().trim();
  const slugInput = (payload.slug ?? "").toString().trim();

  if (!nameInput) {
    return errorJson(400, "VALIDATION_ERROR", "Course name is required.");
  }

  const slug = slugInput || slugify(nameInput);
  const requestedOrgId = (payload.org_id ?? ctx.orgId ?? null) as string | null;
  const access = ensureOrgAccess(ctx, requestedOrgId);
  if (access instanceof Response) return access;

  const insertPayload = {
    id: payload.id ?? undefined,
    name: nameInput,
    title: payload.title ? payload.title.toString() : nameInput,
    slug,
    organization_id: access.orgId,
    description: payload.description ?? null,
    status: payload.status ?? "draft",
    created_by: ctx.userId,
    meta_json: payload.meta ?? payload.meta_json ?? {},
  };

  const { data, error } = await supabase
    .from("courses")
    .upsert([insertPayload], { onConflict: "id", ignoreDuplicates: false })
    .select("id, name, title, slug, organization_id, created_by, created_at, updated_at, status")
    .single();

  if (error) return handleDbError(error);

  const detail = await fetchCourseDetail(data.slug ?? data.id ?? "");
  if (detail.error) return handleDbError(detail.error);

  const payload = detail.data ? mapCourse(detail.data) : mapCourse(data);
  return json({ data: payload }, 201);
};

const deleteCourse = async (ctx: RequestContext, courseId: string) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return handleDbError(error);
  return json({ data: { deleted: courseId } });
};

const listPublishedCourses = async () => {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, title, slug, organization_id, created_at, updated_at, status")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return handleDbError(error);
  const normalized = (data ?? []).map(mapCourse);
  return json({ data: normalized });
};

const COURSE_DETAIL_SELECT = `
  id,
  name,
  title,
  slug,
  organization_id,
  created_by,
  created_at,
  updated_at,
  status,
  description,
  modules:modules!modules_course_id_fkey (
    id,
    organization_id,
    title,
    description,
    duration,
    order_index,
    lessons:lessons!lessons_module_id_fkey (
      id,
      module_id,
      title,
      description,
      type,
      duration,
      duration_s,
      order_index,
      content_json,
      completion_rule_json
    )
  )
`;

const fetchCourseDetail = async (identifier: string) => {
  const bySlug = await supabase
    .from("courses")
    .select(COURSE_DETAIL_SELECT)
    .eq("slug", identifier)
    .maybeSingle();

  if (bySlug.data || bySlug.error) {
    return bySlug;
  }

  return supabase
    .from("courses")
    .select(COURSE_DETAIL_SELECT)
    .eq("id", identifier)
    .maybeSingle();
};

const listOrganizations = async (ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, type, contact_email, subscription, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return handleDbError(error);
  return json({ data: (data ?? []).map(normalizeOrganization) });
};

const createOrganization = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const name = (body.name ?? "").toString().trim();
  const contactEmail = (body.contact_email ?? "smoke@example.com").toString().trim();
  const subscription = (body.subscription ?? "Standard").toString().trim() || "Standard";

  if (!name) {
    return errorJson(400, "VALIDATION_ERROR", "Organization name is required.");
  }
  if (!contactEmail) {
    return errorJson(400, "VALIDATION_ERROR", "Organization contact email is required.");
  }

  const insertPayload = {
    id: body.id ?? undefined,
    name,
    type: body.type ?? "Testing",
    contact_email: contactEmail,
    subscription,
    status: body.status ?? "active",
  };

  const { data, error } = await supabase
    .from("organizations")
    .insert([insertPayload])
    .select("id, name, type, contact_email, subscription, status, created_at, updated_at")
    .single();

  if (error) return handleDbError(error);
  return json({ data: normalizeOrganization(data) }, 201);
};

const upsertMembership = async (req: Request, ctx: RequestContext, orgId: string) => {
  const access = ensureOrgAccess(ctx, orgId);
  if (access instanceof Response) return access;

  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"], { orgId: access.orgId });
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const userId = (body.userId ?? body.user_id ?? ctx.userId)?.toString();
  if (!userId) {
    return errorJson(400, "VALIDATION_ERROR", "userId is required.");
  }

  const role = (body.role ?? "admin").toString();

  const { data, error } = await supabase
    .from("organization_memberships")
    .upsert(
      [
        {
          org_id: access.orgId,
          user_id: userId,
          role,
        },
      ],
      { onConflict: "org_id,user_id" }
    )
    .select("id, org_id, user_id, role, created_at, updated_at")
    .single();

  if (error) return handleDbError(error);
  return json({ data });
};

const getWorkspaceOverview = async (ctx: RequestContext, orgId: string) => {
  const access = ensureOrgAccess(ctx, orgId);
  if (access instanceof Response) return access;

  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"], { orgId: access.orgId });
  if (authError) return authError;

  const { data, error } = await supabase
    .from("org_workspace_strategic_plans")
    .select("id, org_id, content, created_by, created_at, updated_at")
    .eq("org_id", access.orgId)
    .order("created_at", { ascending: false });

  if (error) return handleDbError(error);
  return json({ data: { strategicPlans: data ?? [] } });
};

const createWorkspacePlan = async (req: Request, ctx: RequestContext, orgId: string) => {
  const access = ensureOrgAccess(ctx, orgId);
  if (access instanceof Response) return access;

  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"], { orgId: access.orgId });
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const content = (body.content ?? "").toString().trim();
  if (!content) {
    return errorJson(400, "VALIDATION_ERROR", "content is required");
  }

  const { data, error } = await supabase
    .from("org_workspace_strategic_plans")
    .insert([
      {
        org_id: access.orgId,
        content,
        created_by: body.createdBy ?? ctx.userId,
      },
    ])
    .select("id, org_id, content, created_by, created_at, updated_at")
    .single();

  if (error) return handleDbError(error);
  return json({ data }, 201);
};

const deleteWorkspacePlan = async (ctx: RequestContext, orgId: string, planId: string) => {
  const access = ensureOrgAccess(ctx, orgId);
  if (access instanceof Response) return access;

  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"], { orgId: access.orgId });
  if (authError) return authError;

  const { error } = await supabase
    .from("org_workspace_strategic_plans")
    .delete()
    .eq("org_id", access.orgId)
    .eq("id", planId);

  if (error) return handleDbError(error);
  return json({ data: { deleted: planId } });
};

const createNotification = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const title = (body.title ?? "").toString().trim();
  if (!title) {
    return errorJson(400, "VALIDATION_ERROR", "title is required");
  }

  const requestedOrgId = (body.orgId ?? body.org_id ?? ctx.orgId ?? null) as string | null;
  const access = ensureOrgAccess(ctx, requestedOrgId);
  if (access instanceof Response) return access;

  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        title,
        body: body.body ?? null,
        org_id: access.orgId,
        user_id: ctx.userId,
      },
    ])
    .select("id, title, body, org_id, user_id, created_at, read")
    .single();

  if (error) return handleDbError(error);
  return json({ data }, 201);
};

const markNotificationRead = async (ctx: RequestContext, notificationId: string) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"]);
  if (authError) return authError;

  const { data: notification, error: fetchError } = await supabase
    .from("notifications")
    .select("id, org_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (fetchError) return handleDbError(fetchError);
  if (!notification) return errorJson(404, "NOT_FOUND", "Notification not found.");

  const notificationOrgId = notification.org_id ?? null;
  const isPlatformAdmin = ctx.role === "admin" && ctx.memberships.length === 0;
  if (notificationOrgId) {
    const access = ensureOrgAccess(ctx, notificationOrgId);
    if (access instanceof Response) {
      console.warn("[notifications] org mismatch on mark read", {
        notificationId,
        userId: ctx.userId,
        orgId: notificationOrgId,
      });
      if (!isPlatformAdmin) {
        return access;
      }
    }
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) return handleDbError(error);
  return json({ data: { id: notificationId, read: true } });
};

const deleteNotification = async (ctx: RequestContext, notificationId: string) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const { data: notification, error: fetchError } = await supabase
    .from("notifications")
    .select("id, org_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (fetchError) return handleDbError(fetchError);
  if (!notification) return errorJson(404, "NOT_FOUND", "Notification not found.");

  const notificationOrgId = notification.org_id ?? null;
  const isPlatformAdmin = ctx.role === "admin" && ctx.memberships.length === 0;
  if (notificationOrgId) {
    const access = ensureOrgAccess(ctx, notificationOrgId);
    if (access instanceof Response) {
      console.warn("[notifications] org mismatch on delete", {
        notificationId,
        userId: ctx.userId,
        orgId: notificationOrgId,
      });
      if (!isPlatformAdmin) {
        return access;
      }
    }
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) return handleDbError(error);
  return json({ data: { deleted: notificationId } });
};

const getLearnerProgress = async (url: URL, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"]);
  if (authError) return authError;

  const courseId = url.searchParams.get("courseId");
  const lessonIdsParam = url.searchParams.get("lessonIds");
  const lessonIds = lessonIdsParam
    ? lessonIdsParam.split(",").map((value) => value.trim()).filter((value) => value.length > 0)
    : [];

  if (!courseId) {
    return errorJson(400, "VALIDATION_ERROR", "courseId is required");
  }

  const userId = ctx.userId;
  if (!userId) {
    return errorJson(401, "UNAUTHENTICATED", "Missing user context. Supply a valid Authorization header.");
  }

  const courseResponse = await supabase
    .from("user_course_enrollments")
    .select("course_id, progress_percentage, completed_at, last_accessed_at, enrolled_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (courseResponse.error) {
    return handleDbError(courseResponse.error);
  }

  let lessonRows: any[] = [];
  if (lessonIds.length > 0) {
    const lessonResponse = await supabase
      .from("user_lesson_progress")
      .select("lesson_id, progress_percentage, completed, time_spent, last_accessed_at, completed_at")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds);

    if (lessonResponse.error) {
      return handleDbError(lessonResponse.error);
    }
    lessonRows = lessonResponse.data ?? [];
  }

  return json({
    data: {
      synced_at: new Date().toISOString(),
      course: courseResponse.data ?? null,
      lessons: lessonRows,
    },
  });
};

const syncLearnerProgress = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"]);
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const courseId = (body.courseId ?? body.course_id)?.toString();
  if (!courseId) {
    return errorJson(400, "VALIDATION_ERROR", "courseId is required.");
  }

  const userId = coerceUserId(ctx, body.userId ?? body.user_id);
  if (!userId) {
    return errorJson(400, "VALIDATION_ERROR", "userId is required.");
  }

  const lessonInputs = parseLessonProgressInput(Array.isArray(body.lessons) ? body.lessons : []);
  const lessonIds = lessonInputs.map((lesson) => lesson.lessonId);

  const now = new Date();
  const nowIso = now.toISOString();

  const existingLessonMap = new Map<string, any>();
  if (lessonIds.length > 0) {
    const lessonResponse = await supabase
      .from("user_lesson_progress")
      .select("lesson_id, progress_percentage, completed, time_spent, last_accessed_at")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds);

    if (lessonResponse.error) {
      return handleDbError(lessonResponse.error);
    }

    (lessonResponse.data ?? []).forEach((row) => {
      if (row?.lesson_id) {
        existingLessonMap.set(row.lesson_id, row);
      }
    });
  }

  const lessonUpserts = lessonInputs.map((entry) => {
    const existing = existingLessonMap.get(entry.lessonId);
    const mergedPercent = Math.max(existing?.progress_percentage ?? 0, entry.progressPercent);
    const mergedTime = Math.max(existing?.time_spent ?? 0, entry.positionSeconds);
    const mergedCompleted = existing?.completed === true || entry.completed || mergedPercent >= 100;

    const existingAccessedAt = existing?.last_accessed_at ? Date.parse(existing.last_accessed_at) : 0;
    const providedAccessedAt = entry.lastAccessedAt ? Date.parse(entry.lastAccessedAt) : 0;
    const mergedAccessedAt = new Date(
      Math.max(existingAccessedAt || 0, providedAccessedAt || 0, now.getTime())
    ).toISOString();

    return {
      user_id: userId,
      lesson_id: entry.lessonId,
      progress_percentage: mergedPercent,
      completed: mergedCompleted,
      time_spent: mergedTime,
      last_accessed_at: mergedAccessedAt,
      completed_at: mergedCompleted
        ? (existing?.completed_at as string | null) ?? (entry.completed ? nowIso : existing?.completed_at ?? null)
        : null,
    };
  });

  if (lessonUpserts.length > 0) {
    const upsertResult = await supabase
      .from("user_lesson_progress")
      .upsert(lessonUpserts, { onConflict: "user_id,lesson_id" });

    if (upsertResult.error) {
      return handleDbError(upsertResult.error);
    }
  }

  const courseSnapshot = typeof body.course === "object" && body.course !== null ? body.course : {};
  const coursePercent = normalizePercent(courseSnapshot.percent ?? courseSnapshot.progressPercent);
  const totalTimeSeconds =
    typeof courseSnapshot.totalTimeSeconds === "number" ? Math.max(0, Math.round(courseSnapshot.totalTimeSeconds)) : null;
  const lastLessonId =
    typeof courseSnapshot.lastLessonId === "string" ? courseSnapshot.lastLessonId : lessonInputs.at(-1)?.lessonId ?? null;
  const courseCompletedAt =
    courseSnapshot.completedAt && typeof courseSnapshot.completedAt === "string"
      ? courseSnapshot.completedAt
      : coursePercent >= 100
      ? nowIso
      : null;

  const existingCourseResponse = await supabase
    .from("user_course_enrollments")
    .select("progress_percentage, completed_at, last_accessed_at, enrolled_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingCourseResponse.error && existingCourseResponse.error.code !== "PGRST116") {
    return handleDbError(existingCourseResponse.error);
  }

  const existingCourse = existingCourseResponse.data ?? null;

  const mergedCoursePercent = Math.max(existingCourse?.progress_percentage ?? 0, coursePercent);
  const mergedCourseLastAccess = new Date(
    Math.max(
      existingCourse?.last_accessed_at ? Date.parse(existingCourse.last_accessed_at) || 0 : 0,
      now.getTime()
    )
  ).toISOString();
  const mergedCompletedAt =
    mergedCoursePercent >= 100
      ? existingCourse?.completed_at ?? courseCompletedAt ?? nowIso
      : existingCourse?.completed_at ?? null;

  const courseUpsertPayload = {
    user_id: userId,
    course_id: courseId,
    progress_percentage: mergedCoursePercent,
    last_accessed_at: mergedCourseLastAccess,
    completed_at: mergedCompletedAt,
    enrolled_at: existingCourse?.enrolled_at ?? nowIso,
  };

  const courseUpsertResult = await supabase
    .from("user_course_enrollments")
    .upsert([courseUpsertPayload], { onConflict: "user_id,course_id" });

  if (courseUpsertResult.error) {
    return handleDbError(courseUpsertResult.error);
  }

  // Fire analytics events for key transitions
  try {
    if (!existingCourse) {
      if (mergedCoursePercent > 0) {
        await recordAnalyticsEvent("course_started", ctx, userId, courseId, {
          percent: mergedCoursePercent,
          totalTimeSeconds,
          lastLessonId,
        });
      }
    } else {
      const previousPercent = existingCourse.progress_percentage ?? 0;
      if (previousPercent < 100 && mergedCoursePercent >= 100) {
        await recordAnalyticsEvent("course_completed", ctx, userId, courseId, {
          percent: mergedCoursePercent,
          totalTimeSeconds,
          lastLessonId,
          completedAt: mergedCompletedAt,
        });
      } else if (previousPercent === 0 && mergedCoursePercent > 0) {
        await recordAnalyticsEvent("course_resumed", ctx, userId, courseId, {
          percent: mergedCoursePercent,
          totalTimeSeconds,
          lastLessonId,
        });
      }
    }
  } catch (error) {
    console.warn("Failed to record course analytics event", error);
  }

  return json({
    data: {
      synced_at: nowIso,
      course: courseUpsertPayload,
      lessons: lessonUpserts,
    },
  });
};

const listAnalyticsEvents = async (ctx: RequestContext, url: URL) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const courseId = url.searchParams.get("courseId");
  const baseQuery = supabase
    .from("analytics_events")
    .select("id, user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const query = courseId ? baseQuery.eq("course_id", courseId) : baseQuery;

  const { data, error } = await query;
  if (error) return handleDbError(error);
  return json({ data: data ?? [] });
};

const createAnalyticsEvent = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"]);
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const eventType = (body.event_type ?? body.type)?.toString();
  if (!eventType) {
    return errorJson(400, "VALIDATION_ERROR", "event_type is required.");
  }

  const userId = coerceUserId(ctx, body.user_id);
  if (!userId) {
    return errorJson(400, "VALIDATION_ERROR", "user context is required for analytics logging.");
  }

  const payload = {
    id: typeof body.id === "string" ? body.id : undefined,
    user_id: userId,
    course_id: typeof body.course_id === "string" ? body.course_id : body.courseId ?? null,
    lesson_id: typeof body.lesson_id === "string" ? body.lesson_id : body.lessonId ?? null,
    module_id: typeof body.module_id === "string" ? body.module_id : body.moduleId ?? null,
    event_type: eventType,
    session_id: typeof body.session_id === "string" ? body.session_id : body.sessionId ?? crypto.randomUUID(),
    user_agent: typeof body.user_agent === "string" ? body.user_agent : body.userAgent ?? "client",
    payload: typeof body.payload === "object" && body.payload !== null ? body.payload : body.data ?? {},
  };

  const result = await supabase
    .from("analytics_events")
    .upsert([payload], { onConflict: "id" })
    .select("id")
    .maybeSingle();

  if (result.error) {
    return handleDbError(result.error);
  }

  return json({ data: { id: result.data?.id ?? payload.id } }, payload.id ? 200 : 201);
};

const listLearnerJourneys = async (ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("learner_journeys")
    .select(
      "id, user_id, course_id, started_at, last_active_at, completed_at, total_time_spent, sessions_count, progress_percentage, engagement_score, milestones, drop_off_points, path_taken"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return handleDbError(error);
  return json({ data: data ?? [] });
};

const upsertLearnerJourney = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin", "member"]);
  if (authError) return authError;

  const body = await readJson<Record<string, any>>(req);
  if (!body) {
    return errorJson(400, "BAD_REQUEST", "Unable to parse request body");
  }

  const userId = coerceUserId(ctx, body.user_id);
  const courseId = (body.course_id ?? body.courseId)?.toString();
  if (!userId || !courseId) {
    return errorJson(400, "VALIDATION_ERROR", "user_id and course_id are required.");
  }

  const journey = typeof body.journey === "object" && body.journey !== null ? body.journey : {};

  const payload = {
    user_id: userId,
    course_id: courseId,
    started_at: journey.startedAt ?? journey.started_at ?? new Date().toISOString(),
    last_active_at: journey.lastActiveAt ?? journey.last_active_at ?? new Date().toISOString(),
    completed_at: journey.completedAt ?? journey.completed_at ?? null,
    total_time_spent: typeof journey.totalTimeSpent === "number" ? journey.totalTimeSpent : journey.total_time_spent ?? 0,
    sessions_count: typeof journey.sessionsCount === "number" ? journey.sessionsCount : journey.sessions_count ?? 0,
    progress_percentage: normalizePercent(journey.progressPercentage ?? journey.progress_percentage),
    engagement_score: Number.isFinite(journey.engagementScore) ? Number(journey.engagementScore) : 0,
    milestones: Array.isArray(journey.milestones) ? journey.milestones : [],
    drop_off_points: Array.isArray(journey.dropOffPoints) ? journey.dropOffPoints : [],
    path_taken: Array.isArray(journey.pathTaken) ? journey.pathTaken : [],
  };

  const result = await supabase
    .from("learner_journeys")
    .upsert([payload], { onConflict: "user_id,course_id" })
    .select("user_id, course_id")
    .maybeSingle();

  if (result.error) return handleDbError(result.error);
  return json({ data: { user_id: userId, course_id: courseId } }, 201);
};

const createModule = async (req: Request, ctx: RequestContext) => {
  try {
    const authError = requireUser(ctx);
    if (authError) return authError;

    const body = await readJson<ModuleInput>(req);
    if (!body) return errorJson(400, "BAD_REQUEST", "Unable to parse request body");

    const parsed = moduleSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const courseRecord = await fetchCourseRecord(parsed.data.courseId);
    if (courseRecord instanceof Response) return courseRecord;

    const roleError = requireRole(ctx, ["admin"], { orgId: courseRecord.organization_id });
    if (roleError) return roleError;

    const orderIndex = parsed.data.orderIndex ?? (await nextModuleOrderIndex(parsed.data.courseId));

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: courseRecord.id,
        organization_id: courseRecord.organization_id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        order_index: orderIndex,
        metadata: parsed.data.metadata ?? null,
      })
      .select(moduleSelectColumns)
      .single();

    if (error) return handleDbError(error);
    return json({ data: mapModule(data) }, 201);
  } catch (err) {
    console.error("createModule_error", err);
    return errorJson(500, "INTERNAL_ERROR", "Failed to create module.");
  }
};

const patchModule = async (req: Request, ctx: RequestContext, moduleId: string) => {
  try {
    const authError = requireUser(ctx);
    if (authError) return authError;

    const body = await readJson<ModulePatchInput>(req);
    if (!body) return errorJson(400, "BAD_REQUEST", "Unable to parse request body");

    const parsed = modulePatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existingContext = await fetchModuleContext(moduleId);
    if (existingContext instanceof Response) return existingContext;

    const currentRoleError = requireRole(ctx, ["admin"], { orgId: existingContext.orgId });
    if (currentRoleError) return currentRoleError;

    const targetCourseId = parsed.data.courseId ?? existingContext.course.id;

    let targetCourseRecord: CourseRecord = existingContext.course;
    if (targetCourseId !== existingContext.course.id) {
      const courseLookup = await fetchCourseRecord(targetCourseId);
      if (courseLookup instanceof Response) return courseLookup;
      targetCourseRecord = courseLookup;

      const newRoleError = requireRole(ctx, ["admin"], { orgId: targetCourseRecord.organization_id });
      if (newRoleError) return newRoleError;
    }

    const update: Record<string, unknown> = {};
    let hasChanges = false;

    if (parsed.data.title !== undefined) {
      update.title = parsed.data.title;
      hasChanges = true;
    }
    if (parsed.data.description !== undefined) {
      update.description = parsed.data.description ?? null;
      hasChanges = true;
    }
    if (parsed.data.orderIndex !== undefined) {
      update.order_index = parsed.data.orderIndex;
      hasChanges = true;
    }
    if (parsed.data.metadata !== undefined) {
      update.metadata = parsed.data.metadata ?? null;
      hasChanges = true;
    }

    const courseChanged = targetCourseId !== existingContext.course.id;
    if (courseChanged) {
      update.course_id = targetCourseRecord.id;
      hasChanges = true;
    }

    if (!hasChanges) {
      return errorJson(400, "NO_CHANGES", "No fields were provided for update.");
    }

    update.organization_id = targetCourseRecord.organization_id;
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("modules")
      .update(update)
      .eq("id", moduleId)
      .select(moduleSelectColumns)
      .maybeSingle();

    if (error) return handleDbError(error);
    if (!data) return errorJson(404, "NOT_FOUND", "Module not found");
    return json({ data: mapModule(data) });
  } catch (err) {
    console.error("patchModule_error", err);
    return errorJson(500, "INTERNAL_ERROR", "Failed to update module.");
  }
};

const deleteModule = async (ctx: RequestContext, moduleId: string) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) return handleDbError(error);
  return noContent();
};

const createLesson = async (req: Request, ctx: RequestContext) => {
  try {
    const authError = requireUser(ctx);
    if (authError) return authError;

    const body = await readJson<LessonInput>(req);
    if (!body) return errorJson(400, "validation_error", "Unable to parse request body");

    const parsed = lessonSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const lessonIdCandidate = (body as Record<string, unknown>)?.id;
    const lessonId =
      typeof lessonIdCandidate === "string" && lessonIdCandidate.trim().length > 0
        ? lessonIdCandidate.trim()
        : crypto.randomUUID();

    const context = await fetchModuleContext(parsed.data.moduleId);
    if (context instanceof Response) return context;

    const roleError = requireRole(ctx, ["admin"], { orgId: context.orgId });
    if (roleError) return roleError;

    const orderIndex = parsed.data.orderIndex ?? (await nextLessonOrderIndex(context.module.id));
    const contentPayload = normalizeJsonPayload(parsed.data.content);
    const completionRulePayload = normalizeJsonPayload(parsed.data.completionRule);

    const { data, error } = await supabase
      .from("lessons")
      .insert({
        id: lessonId,
        module_id: context.module.id,
        course_id: context.course.id,
        organization_id: context.orgId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        order_index: orderIndex,
        type: parsed.data.type,
        duration_s: parsed.data.durationSeconds ?? null,
        content_json: contentPayload,
        completion_rule_json: completionRulePayload,
      })
      .select(lessonSelectColumns)
      .single();

    if (error) return handleDbError(error);
    return json({ data: mapLesson(data) }, 201);
  } catch (err) {
    console.error("createLesson_error", err);
    return errorJson(500, "INTERNAL_ERROR", "Failed to create lesson.");
  }
};

const patchLesson = async (req: Request, ctx: RequestContext, lessonId: string) => {
  try {
    const authError = requireUser(ctx);
    if (authError) return authError;

    const body = await readJson<LessonPatchInput>(req);
    if (!body) return errorJson(400, "BAD_REQUEST", "Unable to parse request body");

    const parsed = lessonPatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await fetchLessonRecord(lessonId);
    if (existing instanceof Response) return existing;

    const targetModuleId = parsed.data.moduleId ?? existing.module_id;
    const context = await fetchModuleContext(targetModuleId);
    if (context instanceof Response) return context;

    const roleError = requireRole(ctx, ["admin"], { orgId: context.orgId });
    if (roleError) return roleError;

    const update: Record<string, unknown> = {};
    let hasMutations = false;

    if (parsed.data.title !== undefined) {
      update.title = parsed.data.title;
      hasMutations = true;
    }
    if (parsed.data.description !== undefined) {
      update.description = parsed.data.description ?? null;
      hasMutations = true;
    }
    if (parsed.data.type !== undefined) {
      update.type = parsed.data.type;
      hasMutations = true;
    }
    if (parsed.data.durationSeconds !== undefined) {
      update.duration_s = parsed.data.durationSeconds ?? null;
      hasMutations = true;
    }
    if (parsed.data.content !== undefined) {
      update.content_json = normalizeJsonPayload(parsed.data.content);
      hasMutations = true;
    }
    if (parsed.data.completionRule !== undefined) {
      update.completion_rule_json = normalizeJsonPayload(parsed.data.completionRule);
      hasMutations = true;
    }

    const moduleChanged = existing.module_id !== context.module.id;
    if (moduleChanged) {
      hasMutations = true;
    }

    if (moduleChanged || (existing.course_id ?? null) !== context.course.id) {
      update.course_id = context.course.id;
      hasMutations = true;
    }
    let resolvedOrderIndex = parsed.data.orderIndex;
    if (resolvedOrderIndex === undefined && moduleChanged) {
      resolvedOrderIndex = await nextLessonOrderIndex(context.module.id);
    }
    if (resolvedOrderIndex !== undefined) {
      update.order_index = resolvedOrderIndex;
      hasMutations = true;
    }

    if ((existing.organization_id ?? null) !== context.orgId) {
      hasMutations = true;
    }

    if (!hasMutations) {
      return errorJson(400, "NO_CHANGES", "No fields were provided for update.");
    }

    update.module_id = context.module.id;
    update.organization_id = context.orgId;
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("lessons")
      .update(update)
      .eq("id", lessonId)
      .select(lessonSelectColumns)
      .maybeSingle();

    if (error) return handleDbError(error);
    if (!data) return errorJson(404, "NOT_FOUND", "Lesson not found");
    return json({ data: mapLesson(data) });
  } catch (err) {
    console.error("patchLesson_error", err);
    return errorJson(500, "INTERNAL_ERROR", "Failed to update lesson.");
  }
};

const deleteLesson = async (ctx: RequestContext, lessonId: string) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return handleDbError(error);
  return noContent();
};

const reorderModules = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const body = await readJson<ModuleReorderInput>(req);
  if (!body) return errorJson(400, "BAD_REQUEST", "Unable to parse request body");

  const parsed = moduleReorderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const timestamp = new Date().toISOString();
  const updates = parsed.data.modules.map((entry) => ({
    id: entry.id,
    course_id: parsed.data.courseId,
    order_index: entry.orderIndex,
    updated_at: timestamp,
  }));

  const { error } = await supabase
    .from("modules")
    .upsert(updates, { onConflict: "id", ignoreDuplicates: false });

  if (error) return handleDbError(error);

  const { data, error: fetchError } = await supabase
    .from("modules")
    .select(moduleSelectColumns)
    .eq("course_id", parsed.data.courseId)
    .order("order_index", { ascending: true });

  if (fetchError) return handleDbError(fetchError);

  return json({ data: (data ?? []).map(mapModule) });
};

const reorderLessons = async (req: Request, ctx: RequestContext) => {
  const authError = requireUser(ctx) ?? requireRole(ctx, ["admin"]);
  if (authError) return authError;

  const body = await readJson<LessonReorderInput>(req);
  if (!body) return errorJson(400, "BAD_REQUEST", "Unable to parse request body");

  const parsed = lessonReorderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const timestamp = new Date().toISOString();
  const updates = parsed.data.lessons.map((entry) => ({
    id: entry.id,
    module_id: parsed.data.moduleId,
    order_index: entry.orderIndex,
    updated_at: timestamp,
  }));

  const { error } = await supabase
    .from("lessons")
    .upsert(updates, { onConflict: "id", ignoreDuplicates: false });

  if (error) return handleDbError(error);

  const { data, error: fetchError } = await supabase
    .from("lessons")
    .select(lessonSelectColumns)
    .eq("module_id", parsed.data.moduleId)
    .order("order_index", { ascending: true });

  if (fetchError) return handleDbError(fetchError);

  return json({ data: (data ?? []).map(mapLesson) });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();
  const ctx = await getContext(req);

  try {
    if (pathname === "/api/health" && method === "GET") {
      return json({ ok: true });
    }

    if (pathname === "/api/admin/courses") {
      if (method === "GET") return await listCourses(ctx);
      if (method === "POST") return await createCourse(req, ctx);
    }

    const deleteCourseMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)$/);
    if (deleteCourseMatch && method === "DELETE") {
      return await deleteCourse(ctx, deleteCourseMatch[1]);
    }

    if (pathname === "/api/admin/modules") {
      if (method === "POST") return await createModule(req, ctx);
    }

    if (pathname === "/api/admin/modules/reorder" && method === "POST") {
      return await reorderModules(req, ctx);
    }

    const moduleMatch = pathname.match(/^\/api\/admin\/modules\/([^/]+)$/);
    if (moduleMatch) {
      const moduleId = decodeURIComponent(moduleMatch[1]);
      if (method === "PATCH") return await patchModule(req, ctx, moduleId);
      if (method === "DELETE") return await deleteModule(ctx, moduleId);
    }

    if (pathname === "/api/admin/lessons") {
      if (method === "POST") return await createLesson(req, ctx);
    }

    if (pathname === "/api/admin/lessons/reorder" && method === "POST") {
      return await reorderLessons(req, ctx);
    }

    const lessonMatch = pathname.match(/^\/api\/admin\/lessons\/([^/]+)$/);
    if (lessonMatch) {
      const lessonId = decodeURIComponent(lessonMatch[1]);
      if (method === "PATCH") return await patchLesson(req, ctx, lessonId);
      if (method === "DELETE") return await deleteLesson(ctx, lessonId);
    }

    if (pathname === "/api/client/courses" && method === "GET") {
      return await listPublishedCourses();
    }

    const clientCourseDetailMatch = pathname.match(/^\/api\/client\/courses\/([^/]+)$/);
    if (clientCourseDetailMatch && method === "GET") {
      const identifier = decodeURIComponent(clientCourseDetailMatch[1]);
      const { data, error } = await fetchCourseDetail(identifier);
      if (error) return handleDbError(error);
      if (!data) return errorJson(404, "NOT_FOUND", "Course not found");
      return json({ data: mapCourse(data) });
    }

    if (pathname === "/api/admin/organizations") {
      if (method === "GET") return await listOrganizations(ctx);
      if (method === "POST") return await createOrganization(req, ctx);
    }

    const orgMembersMatch = pathname.match(/^\/api\/admin\/organizations\/([^/]+)\/members$/);
    if (orgMembersMatch && method === "POST") {
      return await upsertMembership(req, ctx, orgMembersMatch[1]);
    }

    const workspaceMatch = pathname.match(/^\/api\/orgs\/([^/]+)\/workspace$/);
    if (workspaceMatch && method === "GET") {
      return await getWorkspaceOverview(ctx, workspaceMatch[1]);
    }

    const planCreateMatch = pathname.match(/^\/api\/orgs\/([^/]+)\/workspace\/strategic-plans$/);
    if (planCreateMatch && method === "POST") {
      return await createWorkspacePlan(req, ctx, planCreateMatch[1]);
    }

    const planDeleteMatch = pathname.match(/^\/api\/orgs\/([^/]+)\/workspace\/strategic-plans\/([^/]+)$/);
    if (planDeleteMatch && method === "DELETE") {
      return await deleteWorkspacePlan(ctx, planDeleteMatch[1], planDeleteMatch[2]);
    }

    if (pathname === "/api/admin/notifications" && method === "POST") {
      return await createNotification(req, ctx);
    }

    const markNotificationMatch = pathname.match(/^\/api\/admin\/notifications\/([^/]+)\/read$/);
    if (markNotificationMatch && method === "POST") {
      return await markNotificationRead(ctx, markNotificationMatch[1]);
    }

    const deleteNotificationMatch = pathname.match(/^\/api\/admin\/notifications\/([^/]+)$/);
    if (deleteNotificationMatch && method === "DELETE") {
      return await deleteNotification(ctx, deleteNotificationMatch[1]);
    }

    if (pathname === "/api/learner/progress" && method === "GET") {
      return await getLearnerProgress(url, ctx);
    }

    if (pathname === "/api/learner/progress" && method === "POST") {
      return await syncLearnerProgress(req, ctx);
    }

    if (pathname === "/api/analytics/events") {
      if (method === "GET") return await listAnalyticsEvents(ctx, url);
      if (method === "POST") return await createAnalyticsEvent(req, ctx);
    }

    if (pathname === "/api/analytics/journeys") {
      if (method === "GET") return await listLearnerJourneys(ctx);
      if (method === "POST") return await upsertLearnerJourney(req, ctx);
    }

    return errorJson(404, "NOT_FOUND", "Route not found");
  } catch (err) {
    console.error("Unhandled error", err);
    return errorJson(500, "INTERNAL_ERROR", "Unexpected error encountered");
  }
});
