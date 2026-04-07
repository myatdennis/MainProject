import { z } from 'zod';

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(191)
  .regex(/^[a-zA-Z0-9:_\-.]+$/);

const actionSchema = z.enum(['course.save', 'course.auto-save', 'course.publish', 'course.assign']);

const writeActionSchema = z.enum(['course.save', 'course.auto-save']);
const publishActionSchema = z.enum(['course.publish']);

const writeMetaSchema = z.object({
  idempotency_key: idempotencyKeySchema.optional(),
  client_event_id: z.string().trim().min(8).max(191).optional(),
  action: actionSchema.optional(),
});

const upsertRequestSchema = writeMetaSchema
  .extend({
    course: z.object({}).passthrough(),
    modules: z.array(z.object({}).passthrough()).default([]),
    draftMode: z.boolean().optional(),
    clientRevision: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action && !writeActionSchema.safeParse(value.action).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'Course upsert only supports action=course.save or action=course.auto-save',
      });
    }
  });

const publishRequestSchema = writeMetaSchema
  .extend({
    version: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action && !publishActionSchema.safeParse(value.action).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'Publish requests only support action=course.publish',
      });
    }
  });

const normalizeMeta = (body = {}) => {
  const parsed = writeMetaSchema.safeParse(body || {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const err = new Error(firstIssue?.message || 'Invalid course write metadata.');
    err.code = 'invalid_write_metadata';
    err.status = 400;
    err.issues = parsed.error.issues;
    throw err;
  }
  return parsed.data;
};

export const parseCourseWriteMeta = (body = {}) => {
  const meta = normalizeMeta(body);
  return {
    idempotencyKey: meta.idempotency_key ?? null,
    clientEventId: meta.client_event_id ?? null,
    action: meta.action ?? null,
  };
};

export const parseUpsertRequestBody = (body = {}) => {
  const parsed = upsertRequestSchema.safeParse(body || {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const err = new Error(firstIssue?.message || 'Invalid upsert payload.');
    err.code = 'invalid_upsert_payload';
    err.status = 400;
    err.issues = parsed.error.issues;
    throw err;
  }
  return parsed.data;
};

export const parsePublishRequestBody = (body = {}) => {
  const parsed = publishRequestSchema.safeParse(body || {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const err = new Error(firstIssue?.message || 'Invalid publish payload.');
    err.code = 'invalid_publish_payload';
    err.status = 400;
    err.issues = parsed.error.issues;
    throw err;
  }
  const data = parsed.data;
  return {
    version: typeof data.version === 'number' ? data.version : null,
    idempotencyKey: data.idempotency_key ?? null,
    clientEventId: data.client_event_id ?? null,
    action: data.action ?? 'course.publish',
  };
};
