import { z } from 'zod';
import {
  courseDTOSchema,
  moduleDTOSchema,
  lessonDTOSchema,
  courseInputSchema,
  moduleInputSchema,
  lessonInputSchema,
  courseUpsertPayloadSchema,
} from '@shared/contracts/courseContract.js';

export type LessonDTO = z.infer<typeof lessonDTOSchema>;
export type ModuleDTO = z.infer<typeof moduleDTOSchema>;
export type CourseDTO = z.infer<typeof courseDTOSchema>;

export type LessonInputDTO = z.infer<typeof lessonInputSchema>;
export type ModuleInputDTO = z.infer<typeof moduleInputSchema>;
export type CourseInputDTO = z.infer<typeof courseInputSchema>;

export const courseCollectionSchema = z.array(courseDTOSchema);
export const moduleCollectionSchema = z.array(moduleDTOSchema);

export const parseCourseDto = (payload: unknown): CourseDTO => courseDTOSchema.parse(payload);
export const parseCourseCollection = (payload: unknown): CourseDTO[] => courseCollectionSchema.parse(payload);
export const parseCourseUpsertPayload = (payload: unknown) => courseUpsertPayloadSchema.parse(payload);

export {
  courseDTOSchema,
  moduleDTOSchema,
  lessonDTOSchema,
  courseInputSchema,
  moduleInputSchema,
  lessonInputSchema,
  courseUpsertPayloadSchema,
};
