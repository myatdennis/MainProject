import { z } from 'zod';
export const lessonContentSchema = z.object({
    type: z.enum(['video', 'quiz', 'reflection', 'text', 'resource']),
    body: z.record(z.any()).optional(),
    resources: z.array(z.object({
        label: z.string().min(1),
        url: z.string().url(),
    })).optional(),
});
export const completionRuleSchema = z.object({
    type: z.enum(['time_spent', 'quiz_score', 'manual']),
    value: z.number().nonnegative().optional(),
}).nullable().optional();
const lessonSchemaObject = z.object({
    moduleId: z.string().uuid(),
    title: z.string().min(1, 'Title is required'),
    type: z.enum(['video', 'quiz', 'reflection', 'text', 'resource']),
    description: z.string().optional().nullable(),
    orderIndex: z.number().int().nonnegative().optional(),
    durationSeconds: z.number().int().nonnegative().nullable().optional(),
    content: lessonContentSchema,
    completionRule: completionRuleSchema,
});
const enforceLessonContentType = (schema) => schema.superRefine((value, ctx) => {
    const declaredType = value?.type;
    const contentType = value?.content?.type;
    if (declaredType && contentType && contentType !== declaredType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'content.type must match type',
            path: ['content', 'type'],
        });
    }
});
export const lessonSchema = enforceLessonContentType(lessonSchemaObject);
export const lessonPatchSchema = enforceLessonContentType(lessonSchemaObject.partial().extend({
    moduleId: z.string().uuid().optional(),
}));
export const moduleSchema = z.object({
    courseId: z.string().uuid(),
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().nullable(),
    orderIndex: z.number().int().nonnegative().optional(),
    metadata: z.record(z.any()).optional().nullable(),
});
export const modulePatchSchema = moduleSchema.partial().extend({
    courseId: z.string().uuid().optional(),
});
export const reorderItemSchema = z.object({
    id: z.string().uuid(),
    orderIndex: z.number().int().nonnegative(),
});
export const moduleReorderSchema = z.object({
    courseId: z.string().uuid(),
    modules: z.array(reorderItemSchema).min(1),
});
export const lessonReorderSchema = z.object({
    moduleId: z.string().uuid(),
    lessons: z.array(reorderItemSchema).min(1),
});
