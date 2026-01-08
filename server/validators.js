import { z } from 'zod';

// Zod schemas for server-side validation (plain JS for Node ESM)
export const lessonContentSchema = z.object({
  type: z.enum(['video', 'quiz', 'reflection', 'text', 'resource']).optional(),
  body: z.record(z.any()).optional(),
  resources: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().url(),
      }),
    )
    .optional(),
});

export const completionRuleSchema = z
  .object({
    type: z.enum(['time_spent', 'quiz_score', 'manual']),
    value: z.number().nonnegative().optional(),
  })
  .nullable()
  .optional();

const uuid = () => z.string().min(1);

export const moduleCreateSchema = z.object({
  // accept both camelCase and snake_case at the server edge
  course_id: uuid().optional(),
  courseId: uuid().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  order_index: z.number().int().nonnegative().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const modulePatchSchema = moduleCreateSchema.partial();

export const lessonCreateSchema = z.object({
  module_id: uuid().optional(),
  moduleId: uuid().optional(),
  title: z.string().min(1),
  type: z.enum(['video', 'quiz', 'reflection', 'text', 'resource']),
  description: z.string().nullable().optional(),
  order_index: z.number().int().nonnegative().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  duration_s: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
  content: lessonContentSchema.default({}),
  completion_rule_json: completionRuleSchema,
  completionRule: completionRuleSchema,
});

export const lessonPatchSchema = lessonCreateSchema.partial();

export const reorderItemSchema = z.object({
  id: uuid(),
  order_index: z.number().int().nonnegative().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
});

export const moduleReorderSchema = z.object({
  course_id: uuid().optional(),
  courseId: uuid().optional(),
  modules: z.array(reorderItemSchema).min(1),
});

export const lessonReorderSchema = z.object({
  module_id: uuid().optional(),
  moduleId: uuid().optional(),
  lessons: z.array(reorderItemSchema).min(1),
});

export const analyticsEventCoreSchema = z.object({
  clientEventId: z.string().min(1).optional(),
  eventName: z.string().min(1),
  eventVersion: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  orgId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  lessonId: z.string().min(1).optional(),
  properties: z.record(z.any()).default({}),
  context: z.record(z.any()).default({}),
  occurredAt: z.union([z.date(), z.string(), z.number()]).optional(),
});

export const analyticsEventSchema = analyticsEventCoreSchema.superRefine((value, ctx) => {
  if (!value.clientEventId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'clientEventId is required',
      path: ['clientEventId'],
    });
  }
});

export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(50),
});

export const analyticsEventIngestSchema = z.object({
  id: z.string().min(1).optional(),
  user_id: z.string().min(1).nullable().optional(),
  org_id: z.string().min(1).nullable().optional(),
  course_id: z.string().min(1).nullable().optional(),
  lesson_id: z.string().min(1).nullable().optional(),
  module_id: z.string().min(1).nullable().optional(),
  event_type: z.string().min(1),
  session_id: z.string().min(1).nullable().optional(),
  user_agent: z.string().min(1).nullable().optional(),
  payload: z.record(z.any()).optional().default({}),
});

export const adminMessageSchema = z
  .object({
    recipientUserId: z.string().min(1).optional(),
    recipientOrgId: z.string().min(1).optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    metadata: z.record(z.any()).optional().default({}),
  })
  .superRefine((value, ctx) => {
    if (!value.recipientUserId && !value.recipientOrgId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipientUserId'],
        message: 'recipientUserId or recipientOrgId is required',
      });
    }
  });

export const notificationBatchSchema = z
  .object({
    type: z.string().min(1),
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    payload: z.record(z.any()).optional().default({}),
    userIds: z.array(z.string().min(1)).optional().default([]),
    orgIds: z.array(z.string().min(1)).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if ((value.userIds?.length ?? 0) === 0 && (value.orgIds?.length ?? 0) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userIds'],
        message: 'Provide at least one userId or orgId',
      });
    }
  });

const progressEventCoreSchema = z.object({
  clientEventId: z.string().min(1),
  userId: z.string().min(1),
  courseId: z.string().min(1).optional(),
  lessonId: z.string().min(1).optional(),
  orgId: z.string().min(1).nullable().optional(),
  percent: z.number().min(0).max(100).nullable().optional(),
  timeSpentSeconds: z.number().int().nonnegative().nullable().optional(),
  resumeAtSeconds: z.number().int().nonnegative().nullable().optional(),
  status: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  occurredAt: z.union([z.date(), z.string(), z.number()]),
});

export const progressEventSchema = progressEventCoreSchema.superRefine((value, ctx) => {
  if (!value.courseId && !value.lessonId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'courseId or lessonId is required',
      path: ['courseId'],
    });
  }
});

export const progressBatchSchema = z.object({
  events: z.array(progressEventCoreSchema).min(1).max(100),
});

export function pickId(obj, keyA, keyB) {
  return obj?.[keyA] ?? obj?.[keyB] ?? null;
}

export function pickOrder(obj) {
  const a = obj?.order_index;
  const b = obj?.orderIndex;
  return typeof a === 'number' ? a : typeof b === 'number' ? b : 0;
}

export const validateOr400 = (schema, req, res) => {
  try {
    return schema.parse(req.body || {});
  } catch (err) {
    const details = err?.issues?.map((i) => ({ path: i.path, message: i.message })) ?? [];
    res.status(400).json({ error: 'Validation failed', details });
    return null;
  }
};

// Course upsert schema (single upsert of course + modules + lessons)
export const courseUpsertSchema = z.object({
  course: z
    .object({
      id: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      title: z.string().min(1),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      version: z.number().int().positive().optional(),
      org_id: z.string().min(1).nullable().optional(),
      organizationId: z.string().min(1).nullable().optional(),
      external_id: z.string().min(1).optional(),
      meta: z.record(z.any()).optional(),
    })
    .refine((val) => !!(val.title || val.name), { message: 'Course title is required' }),
  modules: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        order_index: z.number().int().nonnegative().optional(),
        orderIndex: z.number().int().nonnegative().optional(),
        lessons: z
          .array(
            z.object({
              id: z.string().min(1).optional(),
              title: z.string().min(1),
              description: z.string().nullable().optional(),
              type: z.enum(['video', 'quiz', 'reflection', 'text', 'resource']),
              order_index: z.number().int().nonnegative().optional(),
              orderIndex: z.number().int().nonnegative().optional(),
              duration_s: z.number().int().nonnegative().nullable().optional(),
              durationSeconds: z.number().int().nonnegative().nullable().optional(),
              content_json: lessonContentSchema.optional(),
              content: lessonContentSchema.optional(),
              completion_rule_json: completionRuleSchema,
              completionRule: completionRuleSchema,
            }),
          )
          .optional()
          .default([]),
      }),
    )
    .optional()
    .default([]),
});

// Course upsert (coarse) validator
// (duplicate removed)
