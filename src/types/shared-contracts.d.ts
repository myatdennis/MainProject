import type { z } from 'zod';

declare module '@shared/contracts/courseContract.js' {
  export const textIdSchema: z.ZodString;
  export const orgIdSchema: z.ZodEffects<z.ZodString, string, string>;
  export const lessonDTOSchema: z.ZodTypeAny;
  export const moduleDTOSchema: z.ZodTypeAny;
  export const courseDTOSchema: z.ZodTypeAny;
  export const lessonInputSchema: z.ZodTypeAny;
  export const moduleInputSchema: z.ZodTypeAny;
  export const courseInputSchema: z.ZodTypeAny;
  export const courseUpsertPayloadSchema: z.ZodTypeAny;
}
