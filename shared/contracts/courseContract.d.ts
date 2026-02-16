import { z } from 'zod';

export const textIdSchema: z.ZodString;
export const orgIdSchema: z.ZodString;
export const lessonDTOSchema: z.ZodObject<Record<string, z.ZodTypeAny>, 'strict'>;
export const moduleDTOSchema: z.ZodObject<Record<string, z.ZodTypeAny>, 'strict'>;
export const courseDTOSchema: z.ZodObject<Record<string, z.ZodTypeAny>, 'strict'>;
export const lessonInputSchema: z.ZodTypeAny;
export const moduleInputSchema: z.ZodTypeAny;
export const courseInputSchema: z.ZodTypeAny;
export const courseUpsertPayloadSchema: z.ZodObject<Record<string, z.ZodTypeAny>, 'strict'>;

export type LessonDTO = z.infer<typeof lessonDTOSchema>;
export type ModuleDTO = z.infer<typeof moduleDTOSchema>;
export type CourseDTO = z.infer<typeof courseDTOSchema>;
export type CourseUpsertPayload = z.infer<typeof courseUpsertPayloadSchema>;
