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

const lessonTypeAliases = new Map(
  [
    ['quiz', 'quiz'],
    ['assessment', 'quiz'],
    ['knowledge_check', 'quiz'],
    ['knowledge-check', 'quiz'],
    ['knowledge check', 'quiz'],
    ['knowledgecheck', 'quiz'],
    ['check_knowledge', 'quiz'],
    ['check-knowledge', 'quiz'],
    ['check knowledge', 'quiz'],
    ['checkknowledge', 'quiz'],
    ['scenario', 'interactive'],
    ['branching', 'interactive'],
    ['choose_your_path', 'interactive'],
    ['choose-your-path', 'interactive'],
    ['choose your path', 'interactive'],
  ].map(([alias, canonical]) => [alias.toLowerCase(), canonical]),
);

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
  version: z
    .union([z.number(), z.null(), z.undefined()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
      return Math.trunc(v);
    })
    .pipe(z.number().int().positive().optional()),
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

const canonicalizeLessonType = (type) => {
  if (typeof type !== 'string') return type;
  const normalized = type.trim().toLowerCase();
  const slugified = normalized.replace(/[\s-]+/g, '_');
  if (lessonTypeAliases.has(normalized)) {
    return lessonTypeAliases.get(normalized);
  }
  if (lessonTypeAliases.has(slugified)) {
    return lessonTypeAliases.get(slugified);
  }
  return type;
};

const extractQuestionsFromPath = (source, path) => {
  let cursor = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') {
      return null;
    }
    cursor = cursor[key];
  }
  return Array.isArray(cursor) && cursor.length > 0 ? cursor : null;
};

const normalizeBlockQuestion = (block) => {
  if (!block || typeof block !== 'object') return null;
  const source = block.props || block.data || block;
  const prompt =
    (typeof source?.prompt === 'string' && source.prompt.trim()) ||
    (typeof source?.question === 'string' && source.question.trim()) ||
    (typeof source?.text === 'string' && source.text.trim()) ||
    (typeof block?.heading === 'string' && block.heading.trim()) ||
    (typeof block?.title === 'string' && block.title.trim()) ||
    null;
  const rawChoices =
    (Array.isArray(source?.choices) && source.choices) ||
    (Array.isArray(source?.options) && source.options) ||
    (Array.isArray(source?.answers) && source.answers) ||
    (Array.isArray(source?.responses) && source.responses) ||
    null;
  if (!prompt || !rawChoices || rawChoices.length === 0) return null;
  const options = rawChoices
    .map((choice) => {
      if (typeof choice === 'string') {
        return { text: choice, correct: false };
      }
      if (!choice || typeof choice !== 'object') return null;
      const textCandidate =
        (typeof choice.text === 'string' && choice.text.trim()) ||
        (typeof choice.label === 'string' && choice.label.trim()) ||
        (typeof choice.title === 'string' && choice.title.trim()) ||
        null;
      if (!textCandidate) return null;
      return {
        text: textCandidate,
        correct: choice.correct === true || choice.isCorrect === true || choice.answer === true,
      };
    })
    .filter(Boolean);
  if (options.length < 2) return null;
  if (!options.some((option) => option.correct)) {
    const correctIndex =
      typeof source?.correctAnswerIndex === 'number' ? source.correctAnswerIndex : undefined;
    if (typeof correctIndex === 'number' && options[correctIndex]) {
      options[correctIndex].correct = true;
    }
  }
  if (!options.some((option) => option.correct) && typeof source?.correctChoiceId === 'string') {
    options.forEach((option) => {
      if (String(option?.id ?? option?.value ?? option.text).toLowerCase() === source.correctChoiceId.toLowerCase()) {
        option.correct = true;
      }
    });
  }
  if (!options.some((option) => option.correct)) return null;
  return { prompt, options };
};

const deriveQuestionsFromBlocks = (lesson) => {
  const candidateBlocks =
    (Array.isArray(lesson?.content?.blocks) && lesson.content.blocks) ||
    (Array.isArray(lesson?.content_json?.blocks) && lesson.content_json.blocks) ||
    (Array.isArray(lesson?.blocks) && lesson.blocks) ||
    (Array.isArray(lesson?.content?.body?.blocks) && lesson.content.body.blocks) ||
    (Array.isArray(lesson?.content_json?.body?.blocks) && lesson.content_json.body.blocks) ||
    null;
  if (!candidateBlocks || candidateBlocks.length === 0) return null;
  const questions = candidateBlocks.map((block) => normalizeBlockQuestion(block)).filter(Boolean);
  return questions.length > 0 ? questions : null;
};

const extractElementsFromPath = (source, path) => {
  let cursor = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') {
      return null;
    }
    cursor = cursor[key];
  }
  return Array.isArray(cursor) && cursor.length > 0 ? cursor : null;
};

const deriveElementsFromLesson = (lesson) => {
  const direct =
    (Array.isArray(lesson?.elements) && lesson.elements) ||
    extractElementsFromPath(lesson, ['content', 'elements']) ||
    extractElementsFromPath(lesson, ['content_json', 'elements']) ||
    extractElementsFromPath(lesson, ['content', 'body', 'elements']) ||
    extractElementsFromPath(lesson, ['content_json', 'body', 'elements']);
  if (direct && direct.length > 0) return direct;
  const blocks =
    (Array.isArray(lesson?.content?.blocks) && lesson.content.blocks) ||
    (Array.isArray(lesson?.content_json?.blocks) && lesson.content_json.blocks) ||
    null;
  if (!blocks || blocks.length === 0) return null;
  const elements = blocks
    .map((block, index) => {
      if (!block || typeof block !== 'object') return null;
      const id =
        (typeof block.id === 'string' && block.id.trim()) ||
        (block.props && typeof block.props.id === 'string' && block.props.id.trim()) ||
        `block-${index + 1}`;
      const dataNodes =
        (Array.isArray(block.data) && block.data) ||
        (Array.isArray(block.steps) && block.steps) ||
        (Array.isArray(block.nodes) && block.nodes) ||
        null;
      if (!id || !dataNodes || dataNodes.length === 0) return null;
      const normalizedNodes = dataNodes
        .map((node) => {
          if (!node || typeof node !== 'object') return null;
          const text =
            (typeof node.text === 'string' && node.text.trim()) ||
            (typeof node.title === 'string' && node.title.trim()) ||
            null;
          if (!text) return null;
          const choices = Array.isArray(node.choices)
            ? node.choices
            : Array.isArray(node.options)
            ? node.options
            : Array.isArray(node.responses)
            ? node.responses
            : null;
          if (!choices || choices.length === 0) return null;
          const normalizedChoices = choices
            .map((choice) => {
              if (!choice || typeof choice !== 'object') return null;
              const label =
                (typeof choice.text === 'string' && choice.text.trim()) ||
                (typeof choice.label === 'string' && choice.label.trim()) ||
                null;
              if (!label) return null;
              return {
                id: choice.id || choice.value || `${id}-choice-${Math.random().toString(36).slice(2, 8)}`,
                text: label,
                to: choice.to || choice.next || null,
              };
            })
            .filter(Boolean);
          if (normalizedChoices.length === 0) return null;
          return {
            id: node.id || `${id}-node-${Math.random().toString(36).slice(2, 8)}`,
            text,
            choices: normalizedChoices,
          };
        })
        .filter(Boolean);
      if (normalizedNodes.length === 0) return null;
      return {
        id,
        data: normalizedNodes,
      };
    })
    .filter(Boolean);
  return elements.length > 0 ? elements : null;
};

const normalizeLessonInput = (lesson) => {
  if (!lesson || typeof lesson !== 'object') return lesson ?? {};
  const normalized = { ...lesson };
  if (normalized.type) {
    normalized.type = canonicalizeLessonType(normalized.type);
  }
  if (normalized.type === 'quiz') {
    const existingBody = getLessonContentBody(normalized);
    let questions =
      (Array.isArray(existingBody?.questions) && existingBody.questions) ||
      extractQuestionsFromPath(normalized, ['content', 'questions']) ||
      extractQuestionsFromPath(normalized, ['content', 'quiz', 'questions']) ||
      extractQuestionsFromPath(normalized, ['content_json', 'quiz', 'questions']) ||
      deriveQuestionsFromBlocks(normalized);
    if (!questions && Array.isArray(normalized?.questions)) {
      questions = normalized.questions;
    }
    if (questions && questions.length > 0) {
      const nextBody = {
        ...(existingBody && typeof existingBody === 'object' ? existingBody : {}),
        questions,
      };
      normalized.content_json = {
        ...(normalized.content_json || {}),
        body: nextBody,
      };
      if (normalized.content && typeof normalized.content === 'object') {
        normalized.content = {
          ...normalized.content,
          body: {
            ...(normalized.content?.body && typeof normalized.content.body === 'object' ? normalized.content.body : {}),
            questions,
          },
        };
      }
      // Example normalization: a block payload with { type: 'quiz-question', props: { prompt, choices } }
      // is converted into lesson.content_json.body.questions for validation.
    }
  }
  if (normalized.type === 'interactive') {
    let elements =
      (Array.isArray(normalized?.elements) && normalized.elements) ||
      deriveElementsFromLesson(normalized);
    if (elements && elements.length > 0) {
      const nextBody = {
        ...(normalized.content_json?.body && typeof normalized.content_json.body === 'object'
          ? normalized.content_json.body
          : normalized.content_json && typeof normalized.content_json === 'object'
          ? normalized.content_json
          : {}),
        elements,
      };
      normalized.content_json = {
        ...(normalized.content_json || {}),
        body: nextBody,
      };
      if (normalized.content && typeof normalized.content === 'object') {
        normalized.content = {
          ...normalized.content,
          body: {
            ...(normalized.content?.body && typeof normalized.content.body === 'object' ? normalized.content.body : {}),
            elements,
          },
        };
      }
      // Example: interactive lesson with { elements:[...] } moves into content_json.body.elements
    }
  }
  return normalized;
};

const normalizeCoursePayloadInput = (payload) => {
  const modules = Array.isArray(payload?.modules) ? payload.modules : [];
  return {
    ...payload,
    modules: modules.map((module) => ({
      ...module,
      lessons: Array.isArray(module?.lessons)
        ? module.lessons.map((lesson) => normalizeLessonInput(lesson))
        : [],
    })),
  };
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
  const normalizedInput = normalizeCoursePayloadInput(payload || {});
  const parsed = coursePayloadSchema.safeParse(normalizedInput);
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
