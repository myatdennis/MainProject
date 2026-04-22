import { z } from 'zod';

const textIdSchema = z.string().trim().min(1).max(191);
const orgIdSchema = z.string().uuid('organizationId must be a uuid');
const courseStatusSchema = z.enum(['draft', 'published', 'archived']);
const lessonTypeSchema = z.enum(['video', 'text', 'quiz', 'interactive', 'document', 'scenario', 'download']);

const lessonDTOSchema = z
  .object({
    id: textIdSchema,
    moduleId: textIdSchema,
    organizationId: orgIdSchema.nullable().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    type: lessonTypeSchema,
    orderIndex: z.number().int().nonnegative().nullable().optional(),
    duration: z.string().nullable().optional(),
    content: z.unknown().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

const moduleDTOSchema = z
  .object({
    id: textIdSchema,
    courseId: textIdSchema,
    organizationId: orgIdSchema.nullable().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    orderIndex: z.number().int().nonnegative().nullable().optional(),
    lessons: z.array(lessonDTOSchema).optional(),
  })
  .strict();

const courseDTOSchema = z
  .object({
    id: textIdSchema,
    slug: textIdSchema,
    organizationId: orgIdSchema.nullable(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    status: courseStatusSchema,
    modules: z.array(moduleDTOSchema).optional(),
    tags: z.array(z.string()).optional(),
    prerequisites: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

const lessonInputSchema = lessonDTOSchema
  .extend({
    id: textIdSchema.optional(),
    moduleId: textIdSchema.optional(),
  })
  .partial({
    organizationId: true,
    orderIndex: true,
    duration: true,
    content: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();

const moduleInputSchema = moduleDTOSchema
  .extend({
    id: textIdSchema.optional(),
    courseId: textIdSchema.optional(),
    lessons: z.array(lessonInputSchema).optional(),
  })
  .partial({
    organizationId: true,
    description: true,
    orderIndex: true,
    lessons: true,
  })
  .strict();

const courseInputSchema = courseDTOSchema
  .extend({
    id: textIdSchema.optional(),
    organizationId: orgIdSchema.nullable().optional(),
    modules: z.array(moduleInputSchema).optional(),
  })
  .partial({
    description: true,
    tags: true,
    prerequisites: true,
    modules: true,
  })
  .strict();

const courseUpsertPayloadSchema = z
  .object({
    course: courseInputSchema,
    modules: z.array(moduleInputSchema).optional(),
  })
  .strict();


export {
  textIdSchema,
  orgIdSchema,
  lessonDTOSchema,
  moduleDTOSchema,
  courseDTOSchema,
  lessonInputSchema,
  moduleInputSchema,
  courseInputSchema,
  courseUpsertPayloadSchema,
};
