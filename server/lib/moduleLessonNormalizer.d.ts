export function normalizeModuleLessonPayloads(
  modulesInput: any,
  options?: {
    courseId?: string | null;
    organizationId?: string | null;
    pickOrgId?: (...args: any[]) => any;
  }
): { modules: any[]; diagnostics: any };

export function coerceTextId(...candidates: any[]): string | null;