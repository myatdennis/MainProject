export interface NormalizeDiagnostics {
  modulesMissingCourseId: number;
  modulesMissingOrgId: number;
  lessonsMissingModuleId: number;
  lessonsMissingCourseId: number;
  lessonsMissingOrgId: number;
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
