const ensureLessonContentContainers = (lesson) => {
  if (!lesson || typeof lesson !== 'object') return;
  if (!lesson.content || typeof lesson.content !== 'object') {
    lesson.content = {};
  }
  if (!lesson.content_json || typeof lesson.content_json !== 'object') {
    lesson.content_json = {};
  }
  if (!lesson.content_json.body || typeof lesson.content_json.body !== 'object') {
    lesson.content_json.body = {};
  }
};

const normalizeQuizOption = (option, index = 0) => {
  if (typeof option === 'string') {
    return { text: option, correct: false };
  }
  if (!option || typeof option !== 'object') {
    return null;
  }
  const textCandidate =
    (typeof option.text === 'string' && option.text.trim()) ||
    (typeof option.label === 'string' && option.label.trim()) ||
    (typeof option.title === 'string' && option.title.trim()) ||
    null;
  if (!textCandidate) {
    return null;
  }
  return {
    text: textCandidate,
    correct: option.correct === true || option.isCorrect === true || option.answer === true || option.value === true,
    id: option.id || option.value || option.key || option.code || `choice-${index}`,
  };
};

const finalizeQuizOptions = (options = [], source = {}) => {
  if (!options.length) return null;
  if (!options.some((option) => option && option.correct)) {
    const correctIndex =
      typeof source.correctAnswerIndex === 'number'
        ? source.correctAnswerIndex
        : typeof source.correctChoiceIndex === 'number'
        ? source.correctChoiceIndex
        : undefined;
    if (typeof correctIndex === 'number' && options[correctIndex]) {
      options[correctIndex].correct = true;
    }
    if (typeof source.correctAnswerId === 'string') {
      options.forEach((option) => {
        if (String(option?.id ?? '').toLowerCase() === source.correctAnswerId.toLowerCase()) {
          option.correct = true;
        }
      });
    }
    if (typeof source.answer === 'string') {
      options.forEach((option) => {
        if (String(option?.id ?? option?.value ?? option.text).toLowerCase() === source.answer.toLowerCase()) {
          option.correct = true;
        }
      });
    }
    if (typeof source.correctAnswer === 'string' || typeof source.correct_option_id === 'string') {
      const target = (source.correctAnswer || source.correct_option_id || '').toString().toLowerCase();
      if (target) {
        options.forEach((option) => {
          if (String(option?.id ?? option?.value ?? option.text).toLowerCase() === target) {
            option.correct = true;
          }
        });
      }
    }
  }
  return options.some((option) => option.correct) ? options : null;
};

const collectLessonFallbackBlocks = (lesson) => {
  const sources = [
    Array.isArray(lesson?.blocks) ? lesson.blocks : null,
    Array.isArray(lesson?.content?.blocks) ? lesson.content.blocks : null,
    Array.isArray(lesson?.content?.body?.blocks) ? lesson.content.body.blocks : null,
    Array.isArray(lesson?.content_json?.blocks) ? lesson.content_json.blocks : null,
    Array.isArray(lesson?.content_json?.body?.blocks) ? lesson.content_json.body.blocks : null,
    Array.isArray(lesson?.content?.interactive?.blocks) ? lesson.content.interactive.blocks : null,
    Array.isArray(lesson?.content_json?.interactive?.blocks) ? lesson.content_json.interactive.blocks : null,
  ].filter(Boolean);
  return sources.flat().filter(Boolean);
};

const collectLessonItems = (lesson) => {
  const directSources = [
    Array.isArray(lesson?.items) ? lesson.items : null,
    Array.isArray(lesson?.content?.items) ? lesson.content.items : null,
    Array.isArray(lesson?.content?.body?.items) ? lesson.content.body.items : null,
    Array.isArray(lesson?.content_json?.items) ? lesson.content_json.items : null,
    Array.isArray(lesson?.content_json?.body?.items) ? lesson.content_json.body.items : null,
  ].filter(Boolean);
  const blockItems = collectLessonFallbackBlocks(lesson)
    .map((block) => {
      const propsItems = Array.isArray(block?.props?.items) ? block.props.items : null;
      if (propsItems) return propsItems;
      const dataItems = Array.isArray(block?.data?.items) ? block.data.items : null;
      return dataItems || null;
    })
    .filter(Boolean);
  return [...directSources, ...blockItems].flat().filter(Boolean);
};

const normalizeQuizQuestion = (candidate, index = 0) => {
  if (!candidate) return null;
  if (typeof candidate === 'string') {
    return null;
  }
  if (Array.isArray(candidate?.items)) {
    const nested = candidate.items
      .map((item, nestedIndex) => normalizeQuizQuestion(item, nestedIndex))
      .filter(Boolean);
    return nested.length > 0 ? nested : null;
  }
  if (candidate?.question && Array.isArray(candidate.question?.items)) {
    const nested = candidate.question.items
      .map((item, nestedIndex) => normalizeQuizQuestion(item, nestedIndex))
      .filter(Boolean);
    return nested.length > 0 ? nested : null;
  }
  const source = candidate.props || candidate.data || candidate.content || candidate;
  let itemsLooksLikeQuestionArray = false;
  if (Array.isArray(source?.items)) {
    itemsLooksLikeQuestionArray = source.items.some(
      (item) =>
        (typeof item?.prompt === 'string' && item.prompt.trim()) ||
        (typeof item?.question === 'string' && item.question.trim()) ||
        (Array.isArray(item?.choices) && item.choices.length > 0) ||
        (Array.isArray(item?.options) && item.options.length > 0),
    );
    if (itemsLooksLikeQuestionArray) {
      const nested = source.items
        .map((item, nestedIndex) => normalizeQuizQuestion(item, nestedIndex))
        .filter(Boolean);
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  const prompt =
    (typeof source?.prompt === 'string' && source.prompt.trim()) ||
    (typeof source?.question === 'string' && source.question.trim()) ||
    (typeof source?.text === 'string' && source.text.trim()) ||
    (typeof candidate?.heading === 'string' && candidate.heading.trim()) ||
    (typeof candidate?.title === 'string' && candidate.title.trim()) ||
    null;
  if (!prompt) return null;
  const rawOptions =
    (Array.isArray(source?.options) && source.options) ||
    (Array.isArray(source?.choices) && source.choices) ||
    (Array.isArray(source?.answers) && source.answers) ||
    (Array.isArray(source?.responses) && source.responses) ||
    (Array.isArray(source?.items) && source.items.every((item) => typeof item === 'string' || typeof item === 'object') && !itemsLooksLikeQuestionArray
      ? source.items
      : null) ||
    (!itemsLooksLikeQuestionArray && Array.isArray(source?.items) ? source.items : null) ||
    null;
  if (!rawOptions || rawOptions.length === 0) {
    return null;
  }
  const normalizedOptions = rawOptions.map((option, optionIndex) => normalizeQuizOption(option, optionIndex)).filter(Boolean);
  const finalizedOptions = finalizeQuizOptions(normalizedOptions, source);
  if (!finalizedOptions) {
    return null;
  }
  return {
    prompt,
    options: finalizedOptions,
    correctAnswerIndex:
      typeof source?.correctAnswerIndex === 'number'
        ? source.correctAnswerIndex
        : typeof source?.correctChoiceIndex === 'number'
        ? source.correctChoiceIndex
        : finalizedOptions.findIndex((option) => option.correct),
    correctAnswer:
      source?.correctAnswerId ||
      source?.correct_option_id ||
      source?.correctAnswer ||
      finalizedOptions.find((option) => option.correct)?.id ||
      null,
  };
};

const collectQuizQuestionsFromBlocks = (lesson) => {
  const blocks = collectLessonFallbackBlocks(lesson);
  if (!blocks.length) return [];
  const questions = [];
  blocks.forEach((block, blockIndex) => {
    const normalized = normalizeQuizQuestion(block, blockIndex);
    if (Array.isArray(normalized)) {
      normalized.forEach((question) => question && questions.push(question));
    } else if (normalized) {
      questions.push(normalized);
    } else {
      const source = block?.props || block?.data || block;
      if (Array.isArray(source?.items)) {
        source.items.forEach((item, nestedIndex) => {
          const nested = normalizeQuizQuestion(item, nestedIndex);
          if (Array.isArray(nested)) {
            nested.forEach((question) => question && questions.push(question));
          } else if (nested) {
            questions.push(nested);
          }
        });
      }
    }
  });
  return questions;
};

export const deriveQuizQuestions = (lesson) => {
  const questions = [];
  const mergeQuestions = (source) => {
    if (!Array.isArray(source)) return;
    source.forEach((item, index) => {
      const normalized = normalizeQuizQuestion(item, index);
      if (Array.isArray(normalized)) {
        normalized.forEach((question) => question && questions.push(question));
      } else if (normalized) {
        questions.push(normalized);
      }
    });
  };
  mergeQuestions(lesson?.questions);
  mergeQuestions(lesson?.quizQuestions);
  mergeQuestions(lesson?.content?.questions);
  mergeQuestions(lesson?.content?.quiz?.questions);
  mergeQuestions(lesson?.content?.items);
  mergeQuestions(lesson?.content?.body?.questions);
  mergeQuestions(lesson?.content?.body?.quizQuestions);
  mergeQuestions(lesson?.content?.body?.quiz_questions);
  mergeQuestions(lesson?.content?.body?.quiz?.questions);
  mergeQuestions(lesson?.content?.body?.blocks);
  mergeQuestions(lesson?.content_json?.questions);
  mergeQuestions(lesson?.content_json?.quiz?.questions);
  mergeQuestions(lesson?.content_json?.items);
  mergeQuestions(lesson?.content_json?.body?.questions);
  mergeQuestions(lesson?.content_json?.body?.quizQuestions);
  mergeQuestions(lesson?.content_json?.body?.quiz_questions);
  mergeQuestions(lesson?.content_json?.body?.quiz?.questions);
  mergeQuestions(lesson?.content_json?.body?.blocks);
  mergeQuestions(collectLessonItems(lesson));
  const blockDerived = collectQuizQuestionsFromBlocks(lesson);
  blockDerived.forEach((question) => questions.push(question));
  return questions.filter(Boolean);
};

const normalizeBranchChoice = (choice, index = 0) => {
  if (typeof choice === 'string') {
    return { id: `choice-${index}`, text: choice, to: null };
  }
  if (!choice || typeof choice !== 'object') {
    return null;
  }
  const text =
    (typeof choice.text === 'string' && choice.text.trim()) ||
    (typeof choice.label === 'string' && choice.label.trim()) ||
    (typeof choice.title === 'string' && choice.title.trim()) ||
    null;
  if (!text) return null;
  return {
    id: choice.id || choice.value || choice.key || `choice-${index}`,
    text,
    to:
      choice.to ||
      choice.next ||
      choice.target ||
      choice.nextNodeId ||
      choice.nextScenarioId ||
      choice.destinationId ||
      choice.scenarioId ||
      null,
    feedback: choice.feedback || null,
    isCorrect: choice.isCorrect === true || choice.correct === true || false,
    points: typeof choice.points === 'number' ? choice.points : undefined,
  };
};

const normalizeBranchNode = (node, index = 0) => {
  if (!node || typeof node !== 'object') return null;
  const source = node.props || node.data || node;
  const text =
    (typeof source?.text === 'string' && source.text.trim()) ||
    (typeof source?.prompt === 'string' && source.prompt.trim()) ||
    (typeof source?.question === 'string' && source.question.trim()) ||
    (typeof source?.title === 'string' && source.title.trim()) ||
    (typeof source?.heading === 'string' && source.heading.trim()) ||
    (typeof node?.title === 'string' && node.title.trim()) ||
    null;
  if (!text) return null;
  const rawChoices =
    (Array.isArray(source?.choices) && source.choices) ||
    (Array.isArray(source?.options) && source.options) ||
    (Array.isArray(source?.responses) && source.responses) ||
    (Array.isArray(source?.answers) && source.answers) ||
    null;
  if (!rawChoices || rawChoices.length === 0) return null;
  const choices = rawChoices.map((choice, choiceIndex) => normalizeBranchChoice(choice, choiceIndex)).filter(Boolean);
  if (choices.length === 0) return null;
  return {
    id: source.id || node.id || `node-${index}`,
    text,
    choices,
  };
};

const normalizeBranchElement = (element, index = 0) => {
  if (!element || typeof element !== 'object') return null;
  const source = element.props || element;
  const rawNodes =
    (Array.isArray(source?.data) && source.data) ||
    (Array.isArray(source?.nodes) && source.nodes) ||
    (Array.isArray(source?.steps) && source.steps) ||
    (Array.isArray(source?.branches) && source.branches) ||
    null;
  if (!rawNodes || rawNodes.length === 0) return null;
  const data = rawNodes.map((node, nodeIndex) => normalizeBranchNode(node, nodeIndex)).filter(Boolean);
  if (data.length === 0) return null;
  return {
    id: source.id || `element-${index}`,
    type: typeof source.type === 'string' && source.type.trim() ? source.type : 'scenario',
    title:
      (typeof source.title === 'string' && source.title.trim()) ||
      (typeof source.name === 'string' && source.name.trim()) ||
      `Interactive Element ${index + 1}`,
    order: typeof source.order === 'number' ? source.order : index + 1,
    data,
  };
};

export const deriveBranchingElements = (lesson) => {
  const elementCandidates = [
    Array.isArray(lesson?.elements) ? lesson.elements : null,
    Array.isArray(lesson?.content?.elements) ? lesson.content.elements : null,
    Array.isArray(lesson?.content?.body?.elements) ? lesson.content.body.elements : null,
    Array.isArray(lesson?.content_json?.elements) ? lesson.content_json.elements : null,
    Array.isArray(lesson?.content_json?.body?.elements) ? lesson.content_json.body.elements : null,
    Array.isArray(lesson?.content?.interactive?.elements) ? lesson.content.interactive.elements : null,
    Array.isArray(lesson?.content_json?.interactive?.elements) ? lesson.content_json.interactive.elements : null,
  ].filter(Boolean);
  const normalizedElements = elementCandidates
    .flat()
    .map((element, index) => normalizeBranchElement(element, index))
    .filter(Boolean);
  if (normalizedElements.length > 0) {
    return normalizedElements;
  }

  const nodeCandidates = [
    Array.isArray(lesson?.branchingElements) ? lesson.branchingElements : null,
    Array.isArray(lesson?.branches) ? lesson.branches : null,
    Array.isArray(lesson?.nodes) ? lesson.nodes : null,
    Array.isArray(lesson?.content?.branchingElements) ? lesson.content.branchingElements : null,
    Array.isArray(lesson?.content?.branches) ? lesson.content.branches : null,
    Array.isArray(lesson?.content?.nodes) ? lesson.content.nodes : null,
    Array.isArray(lesson?.content?.interactive?.branchingElements)
      ? lesson.content.interactive.branchingElements
      : null,
    Array.isArray(lesson?.content_json?.branchingElements) ? lesson.content_json.branchingElements : null,
    Array.isArray(lesson?.content_json?.interactive?.branchingElements)
      ? lesson.content_json.interactive.branchingElements
      : null,
    Array.isArray(lesson?.content_json?.nodes) ? lesson.content_json.nodes : null,
    Array.isArray(lesson?.content_json?.body?.nodes) ? lesson.content_json.body.nodes : null,
    Array.isArray(lesson?.content_json?.body?.branches) ? lesson.content_json.body.branches : null,
  ].filter(Boolean);
  const blockNodes = collectLessonFallbackBlocks(lesson)
    .map((block) => {
      const source = block?.props || block?.data || block;
      return (
        (Array.isArray(source?.nodes) && source.nodes) ||
        (Array.isArray(source?.data) && source.data) ||
        (Array.isArray(source?.steps) && source.steps) ||
        null
      );
    })
    .filter(Boolean);
  const flattenedNodes = [...nodeCandidates, ...blockNodes].flat().filter(Boolean);
  const normalizedNodes = flattenedNodes.map((node, index) => normalizeBranchNode(node, index)).filter(Boolean);
  if (normalizedNodes.length === 0) {
    return [];
  }
  return [
    {
      id: lesson?.id || 'interactive-element-1',
      type: 'scenario',
      title:
        (typeof lesson?.title === 'string' && lesson.title.trim()) ||
        'Interactive Scenario',
      order: 1,
      data: normalizedNodes,
    },
  ];
};

const assignQuizQuestions = (lesson, questions) => {
  if (!lesson || !Array.isArray(questions) || questions.length === 0) return;
  ensureLessonContentContainers(lesson);
  lesson.content.questions = questions;
  lesson.content.body =
    typeof lesson.content.body === 'object'
      ? { ...lesson.content.body, questions }
      : { questions };
  const existingBody =
    lesson.content_json && typeof lesson.content_json.body === 'object' ? lesson.content_json.body : {};
  lesson.content_json = {
    ...(lesson.content_json && typeof lesson.content_json === 'object' ? lesson.content_json : {}),
    body: {
      ...(existingBody && typeof existingBody === 'object' ? existingBody : {}),
      questions,
    },
  };
};

const assignInteractiveElements = (lesson, elements) => {
  if (!lesson || !Array.isArray(elements) || elements.length === 0) return;
  ensureLessonContentContainers(lesson);
  lesson.content.elements = elements;
  lesson.content.branchingElements = elements;
  lesson.content.body =
    typeof lesson.content.body === 'object'
      ? { ...lesson.content.body, elements, branchingElements: elements }
      : { elements, branchingElements: elements };
  const existingBody =
    lesson.content_json && typeof lesson.content_json.body === 'object' ? lesson.content_json.body : {};
  lesson.content_json = {
    ...(lesson.content_json && typeof lesson.content_json === 'object' ? lesson.content_json : {}),
    body: {
      ...(existingBody && typeof existingBody === 'object' ? existingBody : {}),
      elements,
      branchingElements: elements,
    },
  };
};

export const normalizeLessonForImport = (lesson = {}, { moduleIndex = 0, lessonIndex = 0 } = {}) => {
  if (!lesson || typeof lesson !== 'object') return lesson;
  const next = { ...lesson };
  ensureLessonContentContainers(next);
  if (typeof next.type === 'string') {
    const normalizedType = next.type.trim().toLowerCase();
    if (normalizedType === 'assessment' || normalizedType === 'knowledge_check' || normalizedType === 'knowledge-check') {
      next.type = 'quiz';
    } else if (normalizedType === 'branching' || normalizedType === 'choose_your_path' || normalizedType === 'choose-your-path') {
      next.type = 'interactive';
    }
  }
  if (next.type === 'quiz') {
    const quizQuestions = deriveQuizQuestions(next);
    if (quizQuestions.length > 0) {
      assignQuizQuestions(next, quizQuestions);
    }
  }
  if (next.type === 'interactive') {
    const branchingSource = deriveBranchingElements(next);
    if (Array.isArray(branchingSource) && branchingSource.length > 0) {
      assignInteractiveElements(next, branchingSource);
    }
  }
  return next;
};

export const normalizeModuleForImport = (module = {}, { moduleIndex = 0 } = {}) => {
  const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
  return {
    ...module,
    lessons: lessons.map((lesson, lessonIndex) => normalizeLessonForImport(lesson, { moduleIndex, lessonIndex })),
  };
};

const unwrapDataEnvelope = (input, depth = 0) => {
  if (!input || typeof input !== 'object' || depth >= 5) {
    return input;
  }
  if ('data' in input) {
    return unwrapDataEnvelope(input.data, depth + 1);
  }
  return input;
};

export const normalizeImportEntries = (body) => {
  const wrapCourseEntry = (entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return { course: {}, modules: [], index };
    }
    if (entry.course || entry.modules) {
      return {
        course: entry.course ?? entry,
        modules: Array.isArray(entry.modules) ? entry.modules : [],
        index,
      };
    }
    const { modules, ...courseFields } = entry;
    return {
      course: courseFields,
      modules: Array.isArray(modules) ? modules : [],
      index,
    };
  };

  const payload = unwrapDataEnvelope(body);

  if (Array.isArray(payload)) {
    return { entries: payload.map((item, index) => wrapCourseEntry(item, index)), sourceLabel: 'items' };
  }
  if (Array.isArray(payload?.items)) {
    return { entries: payload.items.map((item, idx) => wrapCourseEntry(item, idx)), sourceLabel: 'items' };
  }
  if (Array.isArray(payload?.courses)) {
    return { entries: payload.courses.map((item, idx) => wrapCourseEntry(item, idx)), sourceLabel: 'courses' };
  }
  if (payload?.course || payload?.title) {
    return { entries: [wrapCourseEntry(payload, 0)], sourceLabel: 'items' };
  }
  return { entries: [], sourceLabel: 'items' };
};

export default {
  normalizeLessonForImport,
  normalizeModuleForImport,
  normalizeImportEntries,
  deriveQuizQuestions,
  deriveBranchingElements,
};
