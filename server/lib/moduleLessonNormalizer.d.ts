<<<<<<< HEAD
export interface NormalizeDiagnostics {
=======
export type ModuleNormalizationDiagnostics = {
>>>>>>> a6944c9 (ddqdq)
  modulesMissingCourseId: number;
  modulesMissingOrgId: number;
  lessonsMissingModuleId: number;
  lessonsMissingCourseId: number;
  lessonsMissingOrgId: number;
<<<<<<< HEAD
}

export interface NormalizeOptions {
  courseId?: string | null;
  organizationId?: string | null;
  pickOrgId?: (...args: any[]) => string | null;
}

export function normalizeModuleLessonPayloads(
  modulesInput: any[],
  options?: NormalizeOptions,
): { modules: any[]; diagnostics: NormalizeDiagnostics };

export function shouldLogModuleNormalization(diagnostics: NormalizeDiagnostics): boolean;

export function coerceTextId(...candidates: any[]): string | null;
=======
};

export type ModuleNormalizerOptions = {
  courseId?: string | null;
  organizationId?: string | null;
  pickOrgId?: (...candidates: unknown[]) => string | null;
};

export declare function coerceTextId(...candidates: Array<string | null | undefined>): string | null;

export declare function normalizeModuleLessonPayloads(
  modulesInput: unknown,
  options?: ModuleNormalizerOptions,
): {
  modules: any[];
  diagnostics: ModuleNormalizationDiagnostics;
};

export declare function shouldLogModuleNormalization(
  diagnostics?: ModuleNormalizationDiagnostics | null,
): boolean;
>>>>>>> a6944c9 (ddqdq)
