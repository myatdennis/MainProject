export type ModuleNormalizationDiagnostics = {
  modulesMissingCourseId: number;
  modulesMissingOrgId: number;
  lessonsMissingModuleId: number;
  lessonsMissingCourseId: number;
  lessonsMissingOrgId: number;
  lessonsOrderNormalized: number;
};

export type NormalizeDiagnostics = ModuleNormalizationDiagnostics;

export type ModuleNormalizerOptions = {
  courseId?: string | null;
  organizationId?: string | null;
  pickOrgId?: (...candidates: unknown[]) => string | null;
};

export type NormalizeOptions = ModuleNormalizerOptions;

export declare function coerceTextId(...candidates: Array<string | null | undefined>): string | null;

export declare function normalizeModuleLessonPayloads(
  modulesInput: unknown,
  options?: ModuleNormalizerOptions,
): {
  modules: any[];
  diagnostics: ModuleNormalizationDiagnostics;
};

export declare function normalizeLessonOrder(modulesInput: unknown): any[];

export declare function shouldLogModuleNormalization(
  diagnostics?: ModuleNormalizationDiagnostics | null,
): boolean;
