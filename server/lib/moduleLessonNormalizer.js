export const coerceTextId = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const coerceOrderNumber = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

export function normalizeLessonOrder(modulesInput) {
  const modulesArray = Array.isArray(modulesInput) ? modulesInput : [];

  for (const module of modulesArray) {
    if (!module || typeof module !== 'object') continue;
    const lessons = Array.isArray(module.lessons) ? module.lessons : [];
    const decorated = lessons
      .map((lesson, index) => {
        const explicitOrder =
          lesson && typeof lesson === 'object'
            ? coerceOrderNumber(lesson.order_index, lesson.orderIndex)
            : null;
        return {
          lesson,
          sourceIndex: index,
          sortOrder: explicitOrder ?? index,
        };
      })
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.sourceIndex - right.sourceIndex;
      });

    module.lessons = decorated.map(({ lesson }, index) => {
      if (!lesson || typeof lesson !== 'object') return lesson;
      const normalizedOrder = index + 1;
      return {
        ...lesson,
        order: normalizedOrder,
        order_index: normalizedOrder,
        orderIndex: normalizedOrder,
      };
    });
  }

  return modulesArray;
}

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
    lessonsOrderNormalized: 0,
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

  const beforeOrderSignatures = normalizedModules.map((module) =>
    (Array.isArray(module.lessons) ? module.lessons : []).map((lesson) =>
      coerceOrderNumber(lesson?.order_index, lesson?.orderIndex),
    ),
  );

  normalizeLessonOrder(normalizedModules);

  diagnostics.lessonsOrderNormalized = normalizedModules.reduce((count, module, moduleIndex) => {
    const before = beforeOrderSignatures[moduleIndex] || [];
    const afterLessons = Array.isArray(module.lessons) ? module.lessons : [];
    return (
      count +
      afterLessons.reduce((lessonCount, lesson, lessonIndex) => {
        const beforeValue = before[lessonIndex] ?? null;
        const afterValue = coerceOrderNumber(lesson?.order_index, lesson?.orderIndex);
        return lessonCount + (beforeValue === afterValue ? 0 : 1);
      }, 0)
    );
  }, 0);

  return { modules: normalizedModules, diagnostics };
}

export function shouldLogModuleNormalization(diagnostics) {
  if (!diagnostics) return false;
  return (
    diagnostics.modulesMissingCourseId > 0 ||
    diagnostics.modulesMissingOrgId > 0 ||
    diagnostics.lessonsMissingModuleId > 0 ||
    diagnostics.lessonsMissingCourseId > 0 ||
    diagnostics.lessonsMissingOrgId > 0 ||
    diagnostics.lessonsOrderNormalized > 0
  );
}
