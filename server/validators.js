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
