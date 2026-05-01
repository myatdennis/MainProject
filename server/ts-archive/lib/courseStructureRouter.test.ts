import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCourseStructureRouter } from '../routes/courseStructure.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const e2eStore = {
    courses: new Map([
      ['course-1', { id: 'course-1', title: 'Course', version: 1, organization_id: 'org-1', modules: [] }],
    ]),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'course-structure-req-1';
    next();
  });

  app.use('/api', createCourseStructureRouter({
    authenticate: (_req, _res, next) => next(),
    requireOrgAdmin: (_req, _res, next) => next(),
    logger,
    supabase: null,
    ensureSupabase: () => true,
    isDemoOrTestMode: true,
    e2eStore,
    e2eFindCourse: (id) => e2eStore.courses.get(id) ?? null,
    e2eFindModule: (moduleId) => {
      for (const course of e2eStore.courses.values()) {
        const mod = (course.modules || []).find((m) => String(m.id) === String(moduleId));
        if (mod) return { course, module: mod };
      }
      return null;
    },
    e2eFindLesson: (lessonId) => {
      for (const course of e2eStore.courses.values()) {
        for (const mod of course.modules || []) {
          const lesson = (mod.lessons || []).find((l) => String(l.id) === String(lessonId));
          if (lesson) return { course, module: mod, lesson };
        }
      }
      return null;
    },
    persistE2EStore: vi.fn(),
    requireUserContext: vi.fn(() => ({ userId: 'admin-1', isPlatformAdmin: true })),
    requireOrgAccess: vi.fn(async () => true),
    sendApiResponse: (res, data, options = {}) => res.status(options.statusCode ?? 200).json({ ok: true, data, code: options.code ?? null, message: options.message ?? null, meta: options.meta ?? null }),
    sendApiError: (res, statusCode, code, message, extra = {}) => res.status(statusCode).json({ ok: false, code, error: code, message, ...extra }),
    validateOr400: (schema, req, res) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, code: 'validation_failed' });
        return null;
      }
      return parsed.data;
    },
    moduleCreateSchema: { safeParse: (body) => ({ success: true, data: body }) },
    modulePatchValidator: { safeParse: (body) => ({ success: true, data: body }) },
    moduleReorderSchema: { safeParse: (body) => ({ success: true, data: body }) },
    lessonCreateSchema: { safeParse: (body) => ({ success: true, data: body }) },
    lessonPatchValidator: { safeParse: (body) => ({ success: true, data: body }) },
    lessonReorderSchema: { safeParse: (body) => ({ success: true, data: body }) },
    pickId: (obj, ...keys) => keys.map((key) => obj?.[key]).find((value) => value != null) ?? null,
    pickOrder: (obj) => obj?.order_index ?? obj?.orderIndex ?? 0,
    pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
    firstRow: (rows) => Array.isArray(rows) ? rows[0] ?? null : rows ?? null,
    prepareLessonPersistencePayload: (payload) => payload,
    prepareLessonContentWithCompletionRule: (record, rule) => {
      if (rule !== undefined) record.content_json = { ...(record.content_json || {}), completionRule: rule };
      return record;
    },
    extractCompletionRule: (record) => record?.completionRule,
    applyLessonColumnSupport: vi.fn(),
    randomUUID: () => 'lesson-uuid-1',
  }));

  return { app, e2eStore };
};

describe('course structure router', () => {
  let server = null;
  let baseUrl = '';
  let context = null;

  beforeEach(async () => {
    context = createApp();
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('creates a module through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/modules`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ course_id: 'course-1', title: 'Module 1', order_index: 1 }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.data.title).toBe('Module 1');
    expect(context.e2eStore.courses.get('course-1').modules).toHaveLength(1);
  });

  it('creates a lesson through the extracted route', async () => {
    const course = context.e2eStore.courses.get('course-1');
    course.modules.push({ id: 'module-1', course_id: 'course-1', organization_id: 'org-1', lessons: [] });
    const response = await fetch(`${baseUrl}/api/admin/lessons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ module_id: 'module-1', title: 'Lesson 1', type: 'video', order_index: 1 }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.data.title).toBe('Lesson 1');
    expect(course.modules[0].lessons).toHaveLength(1);
  });
});
