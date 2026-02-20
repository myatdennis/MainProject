export declare function coerceTextId(...candidates: unknown[]): string | null;

interface NormalizationDiagnostics {
  modulesMissingCourseId: number;
  modulesMissingOrgId: number;
  lessonsMissingModuleId: number;
  lessonsMissingCourseId: number;
  lessonsMissingOrgId: number;
}

interface NormalizeOptions {
  courseId?: string | null;
  organizationId?: string | null;
  pickOrgId?: (...candidates: unknown[]) => string | null;
}

export declare function normalizeModuleLessonPayloads(
  modulesInput: unknown,
  options?: NormalizeOptions,
): { modules: any[]; diagnostics: NormalizationDiagnostics };

export declare function shouldLogModuleNormalization(
  diagnostics: NormalizationDiagnostics | null | undefined,
): boolean;
