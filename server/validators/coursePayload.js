import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedLessonTypes = [
  'text',
  'quiz',
  'interactive',
  'reflection',
  'video',
  'resource',
  'document',
  'scenario',
  'download',
];

const stringField = (min = 1, max = 1000) =>
  z
    .string({ invalid_type_error: 'Expected string' })
    .min(min, { message: `Must be at least ${min} character${min === 1 ? '' : 's'}` })
    .max(max, { message: `Must be ${max} characters or fewer` });

const baseLessonSchema = z.object({
  id: z.string().min(1).optional(),
  title: stringField(1, 280),
  description: z
    .string()
    .max(4000, 'Lesson description too long')
    .nullable()
    .optional(),
  order_index: z.number().int().positive().optional(),
  orderIndex: z.number().int().positive().optional(),
  type: z.enum(allowedLessonTypes),
  duration_s: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
  content_json: z.record(z.any()).optional(),
  content: z.record(z.any()).optional(),
  completion_rule_json: z.record(z.any()).nullable().optional(),
  completionRule: z.record(z.any()).nullable().optional(),
});

const moduleSchema = z.object({
  id: z.string().min(1).optional(),
  title: stringField(1, 280),
  description: z
    .string()
    .max(4000, 'Module description too long')
    .nullable()
    .optional(),
  order_index: z.number().int().positive().optional(),
  orderIndex: z.number().int().positive().optional(),
  lessons: z.array(baseLessonSchema).default([]),
});

const courseSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z
    .string()
    .min(3)
    .max(191)
    .regex(slugRegex, 'Slug may only contain lowercase letters, numbers, and dashes')
    .optional(),
  title: stringField(3, 280),
  name: z.string().min(1).optional(),
  description: z
    .string()
    .max(5000, 'Course description too long')
    .nullable()
    .optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  version: z.number().int().positive().optional(),
  org_id: z.string().optional().nullable(),
  organization_id: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  external_id: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const coursePayloadSchema = z.object({
  course: courseSchema,
  modules: z.array(moduleSchema).default([]),
});

const describeValueType = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
};

const lessonTypeRequiresQuestions = new Set(['quiz']);
const lessonTypeRequiresScenario = new Set(['interactive', 'scenario']);

const coerceOrder = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const getLessonContentBody = (lesson) => {
  if (lesson?.content_json && typeof lesson.content_json === 'object') {
    if (lesson.content_json.body && typeof lesson.content_json.body === 'object') {
      return lesson.content_json.body;
    }
    return lesson.content_json;
  }
  if (lesson?.content && typeof lesson.content === 'object') {
    if (lesson.content.body && typeof lesson.content.body === 'object') {
      return lesson.content.body;
    }
    return lesson.content;
  }
  return {};
};

const hasQuizQuestions = (lesson) => {
  const body = getLessonContentBody(lesson);
  const questionsSource = Array.isArray(body?.questions)
    ? body.questions
    : Array.isArray(body?.quiz?.questions)
    ? body.quiz.questions
    : null;
  if (!questionsSource || questionsSource.length === 0) {
    return { ok: false, reason: 'Lesson is missing quiz questions' };
  }
  const hasPrompt = (question) => {
    return Boolean(
      (typeof question?.prompt === 'string' && question.prompt.trim()) ||
        (typeof question?.text === 'string' && question.text.trim()) ||
        (typeof question?.question === 'string' && question.question.trim()),
    );
  };
  const hasChoices = (question) => {
    const opts = Array.isArray(question?.options)
      ? question.options
      : Array.isArray(question?.choices)
      ? question.choices
      : Array.isArray(question?.answers)
      ? question.answers
      : null;
    if (!opts || opts.length < 2) return false;
    const hasCorrectFlag = opts.some((option) => {
      if (typeof option === 'string') return false;
      if (!option || typeof option !== 'object') return false;
      return option.correct === true || option.isCorrect === true;
    });
    const hasCorrectIndex = typeof question?.correctAnswerIndex === 'number';
    return hasCorrectFlag || hasCorrectIndex;
  };
  const invalid = questionsSource.find((question) => !hasPrompt(question) || !hasChoices(question));
  if (invalid) {
    return { ok: false, reason: 'Each quiz question requires prompt, options, and a correct answer' };
  }
  return { ok: true };
};

const hasScenarioElements = (lesson) => {
  const body = getLessonContentBody(lesson);
  const elements = Array.isArray(body?.elements) ? body.elements : null;
  if (!elements || elements.length === 0) {
    return { ok: false, reason: 'Interactive lessons require branching elements' };
  }
  const invalidElement = elements.find((element) => {
    if (!element || typeof element !== 'object') {
      return true;
    }
    if (!element.id || typeof element.id !== 'string') {
      return true;
    }
    const dataNodes = Array.isArray(element.data) ? element.data : null;
    if (!dataNodes || dataNodes.length === 0) {
      return true;
    }
    return dataNodes.some((node) => {
      if (!node || typeof node !== 'object') return true;
      if (typeof node.text !== 'string' || node.text.trim().length === 0) {
        return true;
      }
      const choices = Array.isArray(node.choices) ? node.choices : null;
      if (!choices || choices.length === 0) {
        return true;
      }
      return choices.some((choice) => typeof choice?.text !== 'string' || choice.text.trim().length === 0);
    });
  });
  if (invalidElement) {
    return { ok: false, reason: 'Interactive branching steps must include text and learner choices' };
  }
  return { ok: true };
};

export function validateCoursePayload(payload) {
  const parsed = coursePayloadSchema.safeParse(payload || {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code || 'invalid',
      receivedValueType: describeValueType(issue.input),
    }));
    return { ok: false, issues };
  }

  const normalizedModules = parsed.data.modules.map((module, moduleIndex) => {
    const resolvedOrder = coerceOrder(module.order_index ?? module.orderIndex, moduleIndex + 1);
    return {
      ...module,
      order_index: resolvedOrder,
      lessons: (module.lessons || []).map((lesson, lessonIndex) => {
        const resolvedLessonOrder = coerceOrder(lesson.order_index ?? lesson.orderIndex, lessonIndex + 1);
        return {
          ...lesson,
          order_index: resolvedLessonOrder,
        };
      }),
    };
  });

  const canonicalCourse = {
    ...parsed.data.course,
    title: parsed.data.course.title?.trim(),
    description:
      typeof parsed.data.course.description === 'string'
        ? parsed.data.course.description.trim()
        : parsed.data.course.description,
  };

  const issues = [];

  const moduleOrders = new Set();
  normalizedModules.forEach((module, moduleIndex) => {
    const originalModule = parsed.data.modules[moduleIndex] || module;
    if (typeof module.order_index !== 'number' || module.order_index < 1) {
      issues.push({
        path: `modules[${moduleIndex}].order_index`,
        message: 'Module order must be a positive integer',
        code: 'module.order.invalid',
        receivedValueType: describeValueType(
          originalModule?.order_index ?? originalModule?.orderIndex ?? module.order_index,
        ),
      });
    } else if (moduleOrders.has(module.order_index)) {
      issues.push({
        path: `modules[${moduleIndex}].order_index`,
        message: 'Module order values must be unique',
        code: 'module.order.duplicate',
        receivedValueType: describeValueType(
          originalModule?.order_index ?? originalModule?.orderIndex ?? module.order_index,
        ),
      });
    } else {
      moduleOrders.add(module.order_index);
    }

    const lessonOrders = new Set();
    module.lessons.forEach((lesson, lessonIndex) => {
      const originalLesson = originalModule?.lessons?.[lessonIndex] ?? lesson;
      if (typeof lesson.order_index !== 'number' || lesson.order_index < 1) {
        issues.push({
          path: `modules[${moduleIndex}].lessons[${lessonIndex}].order_index`,
          message: 'Lesson order must be a positive integer',
          code: 'lesson.order.invalid',
          receivedValueType: describeValueType(
            originalLesson?.order_index ?? originalLesson?.orderIndex ?? lesson.order_index,
          ),
        });
      } else if (lessonOrders.has(lesson.order_index)) {
        issues.push({
          path: `modules[${moduleIndex}].lessons[${lessonIndex}].order_index`,
          message: 'Lesson order values must be unique within a module',
          code: 'lesson.order.duplicate',
          receivedValueType: describeValueType(
            originalLesson?.order_index ?? originalLesson?.orderIndex ?? lesson.order_index,
          ),
        });
      } else {
        lessonOrders.add(lesson.order_index);
      }

      if (!allowedLessonTypes.includes(lesson.type)) {
        issues.push({
          path: `modules[${moduleIndex}].lessons[${lessonIndex}].type`,
          message: `Lesson type must be one of: ${allowedLessonTypes.join(', ')}`,
          code: 'lesson.type.invalid',
          receivedValueType: describeValueType(originalLesson?.type ?? lesson.type),
        });
      }

      if (lessonTypeRequiresQuestions.has(lesson.type)) {
        const quizCheck = hasQuizQuestions(lesson);
        if (!quizCheck.ok) {
          issues.push({
            path: `modules[${moduleIndex}].lessons[${lessonIndex}].content`,
            message: quizCheck.reason,
            code: 'lesson.quiz.invalid',
            receivedValueType: describeValueType(originalLesson?.content_json ?? originalLesson?.content ?? lesson),
          });
        }
      }

      if (lessonTypeRequiresScenario.has(lesson.type)) {
        const scenarioCheck = hasScenarioElements(lesson);
        if (!scenarioCheck.ok) {
          issues.push({
            path: `modules[${moduleIndex}].lessons[${lessonIndex}].content`,
            message: scenarioCheck.reason,
            code: 'lesson.interactive.invalid',
            receivedValueType: describeValueType(originalLesson?.content_json ?? originalLesson?.content ?? lesson),
          });
        }
      }
    });
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      course: canonicalCourse,
      modules: normalizedModules,
    },
  };
}
