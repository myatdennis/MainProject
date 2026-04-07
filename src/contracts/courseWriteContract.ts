import { z } from 'zod';
import type { Course, Module } from '../types/courseTypes';

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(191)
  .regex(/^[a-zA-Z0-9:_\-.]+$/, 'Idempotency key contains unsupported characters');

export const idempotentActionSchema = z.enum([
  'course.save',
  'course.auto-save',
  'course.publish',
  'course.assign',
]);

export type IdempotentActionContract = z.infer<typeof idempotentActionSchema>;

const clientEventIdSchema = z.string().trim().min(8).max(191);

const writeMetaShape = {
  idempotency_key: idempotencyKeySchema.optional(),
  client_event_id: clientEventIdSchema.optional(),
  action: idempotentActionSchema.optional(),
};

const writeMetaSchema = z.object(writeMetaShape);

export const publishRequestBodySchema = writeMetaSchema
  .extend({
  version: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action && value.action !== 'course.publish') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'Publish requests only support action=course.publish',
      });
    }
  });

export type PublishRequestBody = z.infer<typeof publishRequestBodySchema>;

export const upsertRequestBodySchema = writeMetaSchema
  .extend({
  course: z.custom<Course>(),
  modules: z.custom<Module[]>().default([]),
  draftMode: z.boolean().optional(),
  clientRevision: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action && value.action !== 'course.save' && value.action !== 'course.auto-save') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'Course upsert only supports action=course.save or action=course.auto-save',
      });
    }
  });

export type UpsertRequestBody = z.infer<typeof upsertRequestBodySchema>;

export type CourseWriteMeta = {
  idempotencyKey?: string;
  clientEventId?: string;
  action?: IdempotentActionContract;
};

export const toCourseWriteMeta = (input: {
  idempotencyKey?: string | null;
  clientEventId?: string | null;
  action?: string | null;
}): CourseWriteMeta => {
  const normalizedAction = idempotentActionSchema.safeParse(input.action);
  return {
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.clientEventId ? { clientEventId: input.clientEventId } : {}),
    ...(normalizedAction.success ? { action: normalizedAction.data } : {}),
  };
};
