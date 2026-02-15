export const coerceTextId = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

export function normalizeModuleLessonPayloads(modulesInput, options = {}) {
  const {
    courseId = null,
    organizationId = null,
    pickOrgId = () => null,
  } = options;

  const normalizedModules = [];
  const diagnostics = {
    modulesMissingCourseId: 0,
    modulesMissingOrgId: 0,
    lessonsMissingModuleId: 0,
    lessonsMissingCourseId: 0,
    lessonsMissingOrgId: 0,
  };

  const modulesArray = Array.isArray(modulesInput) ? modulesInput : [];

  for (const module of modulesArray) {
    if (!module || typeof module !== 'object') continue;
    const moduleClone = { ...module };

    const resolvedCourseId = coerceTextId(
      moduleClone.course_id,
      moduleClone.courseId,
      courseId,
    );
    if (resolvedCourseId) {
      moduleClone.course_id = resolvedCourseId;
      moduleClone.courseId = resolvedCourseId;
    } else {
      diagnostics.modulesMissingCourseId += 1;
    }

    const resolvedModuleOrgId = pickOrgId(
      moduleClone.organization_id,
      moduleClone.org_id,
      moduleClone.organizationId,
      organizationId,
    );
    if (resolvedModuleOrgId) {
      moduleClone.organization_id = resolvedModuleOrgId;
      moduleClone.org_id = resolvedModuleOrgId;
      moduleClone.organizationId = resolvedModuleOrgId;
    } else {
      diagnostics.modulesMissingOrgId += 1;
    }

    const moduleLessons = Array.isArray(moduleClone.lessons)
      ? moduleClone.lessons
      : Array.isArray(module.lessons)
      ? module.lessons
      : [];
    const normalizedLessons = [];

    for (const lesson of moduleLessons) {
      if (!lesson || typeof lesson !== 'object') continue;
      const lessonClone = { ...lesson };

      const resolvedModuleId = coerceTextId(
        lessonClone.module_id,
        lessonClone.moduleId,
        moduleClone.id,
      );
      if (resolvedModuleId) {
        lessonClone.module_id = resolvedModuleId;
        lessonClone.moduleId = resolvedModuleId;
      } else {
        diagnostics.lessonsMissingModuleId += 1;
      }

      const resolvedLessonCourseId = coerceTextId(
        lessonClone.course_id,
        lessonClone.courseId,
        resolvedCourseId,
        courseId,
      );
      if (resolvedLessonCourseId) {
        lessonClone.course_id = resolvedLessonCourseId;
        lessonClone.courseId = resolvedLessonCourseId;
      } else {
        diagnostics.lessonsMissingCourseId += 1;
      }

      const resolvedLessonOrgId = pickOrgId(
        lessonClone.organization_id,
        lessonClone.org_id,
        lessonClone.organizationId,
        moduleClone.organization_id,
        organizationId,
      );
      if (resolvedLessonOrgId) {
        lessonClone.organization_id = resolvedLessonOrgId;
        lessonClone.org_id = resolvedLessonOrgId;
        lessonClone.organizationId = resolvedLessonOrgId;
      } else {
        diagnostics.lessonsMissingOrgId += 1;
      }

      normalizedLessons.push(lessonClone);
    }

    moduleClone.lessons = normalizedLessons;
    normalizedModules.push(moduleClone);
  }

  return { modules: normalizedModules, diagnostics };
}

export function shouldLogModuleNormalization(diagnostics) {
  if (!diagnostics) return false;
  return (
    diagnostics.modulesMissingCourseId > 0 ||
    diagnostics.modulesMissingOrgId > 0 ||
    diagnostics.lessonsMissingModuleId > 0 ||
    diagnostics.lessonsMissingCourseId > 0 ||
    diagnostics.lessonsMissingOrgId > 0
  );
}
