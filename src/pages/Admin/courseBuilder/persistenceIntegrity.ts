import {
  generateId,
  createLessonId,
  sanitizeModuleGraph,
} from '../../../store/courseStore';
import type { Course, Lesson, LessonContent, LessonVideoAsset } from '../../../types/courseTypes';
import { COURSE_VIDEOS_BUCKET } from '../../../config/mediaBuckets';

const generateStableLessonId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return createLessonId();
};

const EXTERNAL_VIDEO_PROVIDERS = new Set(['youtube', 'vimeo', 'wistia']);

export const logVideoSourceDebug = (
  label: string,
  params: { courseId?: string | null; moduleId?: string | null; lessonId?: string | null; phase?: string },
  content?: LessonContent | null,
  extra: Record<string, unknown> = {},
) => {
  if (typeof console === 'undefined' || !import.meta.env?.DEV) {
    return;
  }
  const safePayload = {
    ...params,
    bucket: content?.videoAsset?.bucket ?? null,
    storagePath: content?.videoAsset?.storagePath ?? null,
    signedUrl: content?.videoAsset?.signedUrl ?? null,
    publicUrl: content?.videoAsset?.publicUrl ?? null,
    videoUrl: content?.videoUrl ?? null,
    videoSourceType: content?.videoSourceType ?? null,
    ...extra,
  };
  console.info(`[${label}]`, safePayload);
};

export const isClientGeneratedId = (value?: string | null): boolean => {
  if (!value) return true;
  return value.startsWith('course-');
};

export const enforceStableModuleGraph = (input: Course): Course => {
  const forceNewIds = isClientGeneratedId(input?.id);
  return {
    ...input,
    modules: sanitizeModuleGraph(input.modules || [], { forceNewIds }),
  };
};

export const ensureLessonIntegrity = (input: Course): { course: Course; issues: string[] } => {
  let mutated = false;
  const issues: string[] = [];

  const ensureTextContent = (lesson: Lesson): Lesson => {
    if (lesson.type !== 'text') return lesson;
    const nextLesson = { ...lesson };
    const content = (nextLesson.content ? { ...nextLesson.content } : {}) as LessonContent & Record<string, any>;
    const body = typeof (content as any).body === 'object' && (content as any).body !== null ? { ...(content as any).body } : {} as Record<string, any>;

    if (typeof content.textContent !== 'string' || !content.textContent.trim()) {
      const fallback =
        (typeof (content as any).content === 'string' && (content as any).content.trim()) ||
        (typeof body.textContent === 'string' && body.textContent.trim()) ||
        (typeof body.content === 'string' && body.content.trim()) ||
        (typeof nextLesson.description === 'string' && nextLesson.description.trim()) ||
        'Draft lesson content pending.';
      content.textContent = fallback;
      body.textContent = fallback;
      body.content = body.content || fallback;
      issues.push(`text_content_filled:${nextLesson.id}`);
      nextLesson.content = { ...content } as LessonContent;
      (nextLesson.content as any).body = body;
      return nextLesson;
    }

    return lesson;
  };

  const ensureVideoMetadata = (lesson: Lesson): Lesson => {
    if (lesson.type !== 'video') return lesson;
    const nextLesson = { ...lesson };
    const content = (nextLesson.content ? { ...nextLesson.content } : {}) as LessonContent & Record<string, any>;
    const currentVideoUrl = typeof content.videoUrl === 'string' ? content.videoUrl.trim() : '';
    const provider = typeof content.videoProvider === 'string' ? content.videoProvider.toLowerCase() : '';
    const explicitExternal =
      content.videoSourceType === 'external' ||
      EXTERNAL_VIDEO_PROVIDERS.has(provider);

    if (explicitExternal) {
      let changed = false;
      if (content.videoSourceType !== 'external') {
        content.videoSourceType = 'external';
        changed = true;
      }
      if (typeof content.videoUrl === 'string' && content.videoUrl !== currentVideoUrl) {
        content.videoUrl = currentVideoUrl;
        changed = true;
      }
      if (content.videoAsset) {
        content.videoAsset = undefined;
        changed = true;
      }

      if (changed) {
        nextLesson.content = content as LessonContent;
        issues.push(`video_external_preserved:${nextLesson.id}`);
        return nextLesson;
      }

      return lesson;
    }

    const asset: Partial<LessonVideoAsset> & Record<string, any> = content.videoAsset ? { ...content.videoAsset } : {};
    let changed = false;

    const assetSignedUrl =
      asset.signedUrl ||
      (asset as any)?.signed_url ||
      (asset as any)?.publicUrl ||
      (asset as any)?.public_url ||
      null;

    const fallbackSource =
      assetSignedUrl ||
      asset.storagePath ||
      asset.assetId ||
      content.videoUrl ||
      (typeof content.video === 'object' && content.video
        ? content.video.url || (content.video as any).source || content.video.embedUrl
        : null) ||
      `external://${nextLesson.id}`;

    if (!asset.assetId && fallbackSource) {
      asset.assetId = fallbackSource;
      changed = true;
    }
    if (!asset.storagePath && fallbackSource) {
      asset.storagePath = fallbackSource;
      changed = true;
    }
    if (!content.videoUrl && assetSignedUrl) {
      content.videoUrl = assetSignedUrl;
      changed = true;
    } else if (!content.videoUrl && fallbackSource && !fallbackSource.startsWith('external://')) {
      content.videoUrl = fallbackSource;
      changed = true;
    }
    if (!asset.bucket) {
      asset.bucket = fallbackSource.startsWith('external://') ? 'external' : COURSE_VIDEOS_BUCKET;
      changed = true;
    }
    if (!(typeof asset.bytes === 'number' && Number.isFinite(asset.bytes) && asset.bytes > 0)) {
      const inferred =
        typeof content.fileSize === 'number'
          ? content.fileSize
          : typeof content.fileSize === 'string'
          ? Number.parseInt(content.fileSize, 10)
          : null;
      asset.bytes = inferred && inferred > 0 ? inferred : 1;
      changed = true;
    }
    if (!asset.mimeType) {
      asset.mimeType = (content as any).mimeType || 'video/mp4';
      changed = true;
    }
    if (!asset.source) {
      const vst = content.videoSourceType;
      asset.source = (vst === 'internal' ? 'supabase' : vst === 'youtube' || vst === 'vimeo' || vst === 'external' ? 'api' : fallbackSource.startsWith('external://') ? 'api' : 'supabase') as LessonVideoAsset['source'];
      changed = true;
    }
    if (!asset.uploadedAt) {
      asset.uploadedAt = new Date().toISOString();
      changed = true;
    }

    if (changed) {
      content.videoAsset = asset as LessonVideoAsset;
      nextLesson.content = content as LessonContent;
      issues.push(`video_metadata_filled:${nextLesson.id}`);
      return nextLesson;
    }
    return lesson;
  };

  const ensureQuizIntegrity = (lesson: Lesson): { lesson: Lesson; valid: boolean } => {
    if (lesson.type !== 'quiz') return { lesson, valid: true };
    const nextLesson = { ...lesson };
    const content = (nextLesson.content ? { ...nextLesson.content } : {}) as LessonContent & Record<string, any>;
    let questions: Record<string, any>[] = Array.isArray(content.questions) ? content.questions.map((q) => ({ ...q })) : [];
    let valid = true;

    if (!questions.length) {
      questions = [
        {
          id: generateId('q'),
          prompt: 'Sample question',
          options: [
            { id: generateId('opt'), text: 'Option A', correct: true, isCorrect: true },
            { id: generateId('opt'), text: 'Option B', correct: false, isCorrect: false },
          ],
          correctAnswerIndex: 0,
        },
      ];
      issues.push(`quiz_questions_seeded:${nextLesson.id}`);
    }

    const normalized = questions.map((question, index) => {
      const normalizedQuestion = { ...question };
      if (typeof normalizedQuestion.prompt !== 'string' || !normalizedQuestion.prompt.trim()) {
        normalizedQuestion.prompt = `Question ${index + 1}`;
        issues.push(`quiz_prompt_filled:${nextLesson.id}:${index}`);
      }
      if (!Array.isArray(normalizedQuestion.options) || normalizedQuestion.options.length < 2) {
        normalizedQuestion.options = [
          { id: generateId('opt'), text: 'Option A', correct: true },
          { id: generateId('opt'), text: 'Option B', correct: false },
        ];
        issues.push(`quiz_options_filled:${nextLesson.id}:${index}`);
      } else {
        normalizedQuestion.options = (normalizedQuestion.options as (string | Record<string, any>)[]).map((option, optionIdx) => {
          const normalizedOption: Record<string, any> = typeof option === 'string' ? { id: generateId('opt'), text: option } : { ...option };
          if (!normalizedOption.id) normalizedOption.id = generateId('opt');
          if (typeof normalizedOption.text !== 'string' || !normalizedOption.text.trim()) {
            normalizedOption.text = `Option ${optionIdx + 1}`;
            issues.push(`quiz_option_text_filled:${nextLesson.id}:${index}:${optionIdx}`);
          }
          return normalizedOption;
        });
      }

      const opts = (normalizedQuestion.options ?? []) as Record<string, any>[];
      const explicitIndex =
        typeof normalizedQuestion.correctAnswerIndex === 'number' &&
        normalizedQuestion.correctAnswerIndex >= 0 &&
        normalizedQuestion.correctAnswerIndex < opts.length;
      const hasMarkedOption = opts.some((option) => option?.correct || option?.isCorrect);

      if (!explicitIndex && !hasMarkedOption) {
        normalizedQuestion.correctAnswerIndex = 0;
        normalizedQuestion.options = opts.map((option, optionIdx) => ({
          ...option,
          correct: optionIdx === 0,
          isCorrect: optionIdx === 0,
        }));
        issues.push(`quiz_correct_answer_filled:${nextLesson.id}:${index}`);
      } else if (!explicitIndex && hasMarkedOption) {
        const flaggedIndex = opts.findIndex((option) => option?.correct || option?.isCorrect);
        normalizedQuestion.correctAnswerIndex = flaggedIndex >= 0 ? flaggedIndex : 0;
      }

      if (
        normalizedQuestion.correctAnswerIndex == null ||
        normalizedQuestion.correctAnswerIndex < 0 ||
        normalizedQuestion.correctAnswerIndex >= opts.length
      ) {
        valid = false;
      }

      const finalCorrectIndex =
        normalizedQuestion.correctAnswerIndex != null && normalizedQuestion.correctAnswerIndex >= 0
          ? normalizedQuestion.correctAnswerIndex
          : 0;
      normalizedQuestion.options = opts.map((option, optionIdx) => ({
        ...option,
        correct: optionIdx === finalCorrectIndex,
        isCorrect: optionIdx === finalCorrectIndex,
      }));
      normalizedQuestion.correctAnswer = opts[finalCorrectIndex]?.id ?? null;
      return normalizedQuestion;
    });

    content.questions = normalized as any;
    nextLesson.content = content as LessonContent;
    return { lesson: nextLesson, valid };
  };

  const normalizedModules = (input.modules || []).map((module) => {
    if (!module.lessons || module.lessons.length === 0) {
      return module;
    }
    let moduleMutated = false;
    const normalizedLessons = module.lessons.map((lesson, index) => {
      const nextLesson: Lesson = { ...lesson };
      if (!nextLesson.id) {
        nextLesson.id = generateStableLessonId();
        issues.push(`lesson_missing_id:${module.id}:${index}`);
        moduleMutated = true;
      }
      const resolvedModuleId = module.id;
      if (!nextLesson.module_id || nextLesson.module_id !== resolvedModuleId) {
        nextLesson.module_id = resolvedModuleId;
        nextLesson.moduleId = resolvedModuleId;
        issues.push(`lesson_missing_module:${nextLesson.id}`);
        moduleMutated = true;
      }
      if (!nextLesson.moduleId) {
        nextLesson.moduleId = nextLesson.module_id;
        moduleMutated = true;
      }
      if (!nextLesson.type) {
        nextLesson.type = 'text';
        issues.push(`lesson_missing_type:${nextLesson.id}`);
        moduleMutated = true;
      }
      const desiredOrder = Number.isFinite(nextLesson.order_index)
        ? Number(nextLesson.order_index)
        : Number.isFinite(nextLesson.order)
        ? Number(nextLesson.order)
        : index + 1;
      if (nextLesson.order_index !== desiredOrder) {
        nextLesson.order_index = desiredOrder;
        moduleMutated = true;
      }
      if (nextLesson.order !== desiredOrder) {
        nextLesson.order = desiredOrder;
        moduleMutated = true;
      }

      let currentLesson = nextLesson;

      const videoReady = ensureVideoMetadata(currentLesson);
      if (videoReady !== currentLesson) {
        moduleMutated = true;
        currentLesson = videoReady;
      }

      const textReady = ensureTextContent(currentLesson);
      if (textReady !== currentLesson) {
        moduleMutated = true;
        currentLesson = textReady;
      }

      const { lesson: quizReady, valid: quizValid } = ensureQuizIntegrity(currentLesson);
      if (!quizValid) {
        issues.push(`quiz_missing_required_fields:${module.id}:${quizReady.id}`);
      }
      if (quizReady !== currentLesson) {
        moduleMutated = true;
        currentLesson = quizReady;
      }

      return currentLesson;
    });

    const hasPlayableVideo = normalizedLessons.some(
      (lesson) =>
        lesson.type === 'video' &&
        Boolean(
          lesson.content?.videoUrl ||
            lesson.content?.videoAsset?.storagePath ||
            lesson.content?.videoAsset?.assetId,
        ),
    );
    const hasQuizWithQuestions = normalizedLessons.some(
      (lesson) => lesson.type === 'quiz' && Array.isArray(lesson.content?.questions) && lesson.content.questions.length > 0,
    );
    const hasTextContent = normalizedLessons.some(
      (lesson) =>
        lesson.type === 'text' &&
        typeof lesson.content?.textContent === 'string' &&
        lesson.content.textContent.trim().length > 0,
    );

    if (!hasPlayableVideo && !hasQuizWithQuestions && !hasTextContent) {
      const fallbackLesson: Lesson = {
        id: generateStableLessonId(),
        module_id: module.id,
        moduleId: module.id,
        title: 'Draft Lesson',
        type: 'text',
        order: normalizedLessons.length + 1,
        order_index: normalizedLessons.length + 1,
        content: {
          textContent: 'Draft lesson content pending.',
        } as LessonContent,
      };
      normalizedLessons.push(fallbackLesson);
      issues.push(`module_publishable_filled:${module.id}`);
      mutated = true;
    }

    if (moduleMutated) {
      mutated = true;
      return {
        ...module,
        lessons: normalizedLessons,
      };
    }

    return module;
  });

  return mutated
    ? {
        course: {
          ...input,
          modules: normalizedModules,
        },
        issues,
      }
    : { course: input, issues };
};
