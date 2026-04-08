const MIN_TITLE_LENGTH = 5;
const MIN_DESCRIPTION_DRAFT = 20;
const MIN_DESCRIPTION_PUBLISH = 50;

const PLACEHOLDER_VIDEO_PREFIXES = ['uploaded:', 'blob:'];

const REQUIRED_VIDEO_ASSET_FIELDS = ['storagePath', 'bucket', 'bytes', 'mimeType'];
const OPTIONAL_VIDEO_ASSET_FIELDS = ['checksum', 'uploadedAt', 'source'];

const ensureLessons = (lessons) => (Array.isArray(lessons) ? lessons : []);
const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const normalizeVideoAsset = (lesson) => {
  const content = lesson?.content || {};
  const rawAsset = content.videoAsset || content.video_asset || content.video?.asset || null;
  if (!rawAsset || typeof rawAsset !== 'object') {
    return null;
  }

  return {
    assetId:
      rawAsset.assetId ??
      rawAsset.asset_id ??
      rawAsset.assetKey ??
      rawAsset.asset_key ??
      rawAsset.id ??
      rawAsset.storageId ??
      rawAsset.storage_id ??
      undefined,
    storagePath:
      pickString(
        rawAsset.storagePath,
        rawAsset.storage_path,
        rawAsset.storageKey,
        rawAsset.storage_key,
        rawAsset.path,
        rawAsset.asset_path,
        rawAsset.assetId,
        rawAsset.asset_id,
      ) ?? undefined,
    bucket: pickString(rawAsset.bucket, rawAsset.bucket_id, rawAsset.bucketId) ?? undefined,
    bytes: toNumber(rawAsset.bytes ?? rawAsset.size ?? rawAsset.fileSize),
    mimeType: pickString(rawAsset.mimeType, rawAsset.mime_type, rawAsset.contentType, rawAsset.content_type) ?? undefined,
    checksum: rawAsset.checksum ?? rawAsset.etag ?? rawAsset.hash ?? undefined,
    uploadedAt: rawAsset.uploadedAt ?? rawAsset.uploaded_at ?? rawAsset.created_at ?? rawAsset.updated_at ?? undefined,
    source: rawAsset.source ?? rawAsset.videoSource ?? rawAsset.provider ?? rawAsset.origin ?? undefined,
  };
};

const lessonUsesExternalVideo = (lesson) => {
  const sourceType = lesson?.content?.videoSourceType;
  if (sourceType === 'external') return true;
  const provider = lesson?.content?.videoProvider || lesson?.content?.video?.provider;
  if (!provider) return false;
  return provider === 'youtube' || provider === 'vimeo' || provider === 'wistia';
};

const validateVideoAsset = (lesson) => {
  if (lessonUsesExternalVideo(lesson)) {
    return {
      valid: Boolean(lesson?.content?.videoUrl),
      missing: [],
      warnings: [],
    };
  }

  const asset = normalizeVideoAsset(lesson);
  if (!asset) {
    return {
      valid: false,
      missing: [...REQUIRED_VIDEO_ASSET_FIELDS],
      warnings: OPTIONAL_VIDEO_ASSET_FIELDS,
    };
  }

  const missing = REQUIRED_VIDEO_ASSET_FIELDS.filter((field) => {
    const value = asset[field];
    if (field === 'bytes') {
      return typeof value !== 'number' || value <= 0;
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    return value == null;
  });

  const warnings = OPTIONAL_VIDEO_ASSET_FIELDS.filter((field) => {
    const value = asset[field];
    if (field === 'checksum') {
      return typeof value !== 'string' || value.trim().length < 12;
    }
    if (field === 'uploadedAt') {
      return typeof value !== 'string' || Number.isNaN(Date.parse(value));
    }
    return value == null;
  });

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
};

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

const isPlaceholderVideoUrl = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_VIDEO_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const hasVideoSource = (lesson, { allowPlaceholders = true } = {}) => {
  const videoUrl =
    lesson?.content?.videoUrl ||
    lesson?.content?.video_url ||
    lesson?.content?.video?.url ||
    lesson?.content?.video?.embedUrl ||
    lesson?.content?.video?.source ||
    lesson?.content?.video?.src ||
    lesson?.content?.video?.file ||
    lesson?.content?.video?.asset?.signedUrl ||
    lesson?.content?.video?.asset?.publicUrl ||
    lesson?.content?.video?.asset?.url ||
    lesson?.content?.videoAsset?.signedUrl ||
    lesson?.content?.videoAsset?.publicUrl ||
    lesson?.content?.video_asset?.signedUrl ||
    lesson?.content?.video_asset?.publicUrl ||
    lesson?.content?.videoFile;

  if (typeof videoUrl === 'string') {
    if (!allowPlaceholders && isPlaceholderVideoUrl(videoUrl)) {
      return false;
    }
    return trim(videoUrl).length > 0;
  }

  return Boolean(videoUrl);
};

const hasQuizQuestions = (lesson) => {
  const questions = lesson?.content?.questions;
  return Array.isArray(questions) && questions.length > 0;
};

const getQuizQuestionPrompt = (question = {}) =>
  trim(
    typeof question.prompt === 'string'
      ? question.prompt
      : typeof question.question === 'string'
      ? question.question
      : typeof question.text === 'string'
      ? question.text
      : '',
  );

const hasQuizOptionText = (option) => {
  if (typeof option === 'string') {
    return trim(option).length > 0;
  }
  if (option && typeof option === 'object') {
    const textValue =
      typeof option.text === 'string'
        ? option.text
        : typeof option.label === 'string'
        ? option.label
        : typeof option.value === 'string'
        ? option.value
        : '';
    return trim(textValue).length > 0;
  }
  return false;
};

const getMarkedQuizCorrectCount = (options = []) =>
  options.reduce((count, option) => {
    if (!option || typeof option !== 'object') return count;
    if (option.correct === true || option.isCorrect === true) {
      return count + 1;
    }
    return count;
  }, 0);

const hasValidQuizCorrectAnswer = (question = {}, options = []) => {
  const correctAnswerIndex =
    typeof question.correctAnswerIndex === 'number' &&
    Number.isInteger(question.correctAnswerIndex) &&
    question.correctAnswerIndex >= 0 &&
    question.correctAnswerIndex < options.length;
  if (correctAnswerIndex) return true;
  return getMarkedQuizCorrectCount(options) === 1;
};

const validateQuizQuestions = (lesson) => {
  const questions = lesson?.content?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      valid: false,
      message: 'Add at least one quiz question before publishing',
      pathSuffix: 'questions',
    };
  }

  for (let index = 0; index < questions.length; index += 1) {
    const questionRaw = questions[index];
    const question = questionRaw && typeof questionRaw === 'object' ? questionRaw : {};
    const prompt = getQuizQuestionPrompt(question);
    if (prompt.length === 0) {
      return {
        valid: false,
        message: `Quiz question ${index + 1} needs a prompt`,
        pathSuffix: `questions[${index}].prompt`,
      };
    }

    const options = Array.isArray(question.options) ? question.options : [];
    if (options.length < 2) {
      return {
        valid: false,
        message: `Quiz question ${index + 1} needs at least 2 answer options`,
        pathSuffix: `questions[${index}].options`,
      };
    }

    if (!options.every(hasQuizOptionText)) {
      return {
        valid: false,
        message: `Quiz question ${index + 1} has an empty answer option`,
        pathSuffix: `questions[${index}].options`,
      };
    }

    if (!hasValidQuizCorrectAnswer(question, options)) {
      return {
        valid: false,
        message: `Quiz question ${index + 1} must define exactly one correct answer`,
        pathSuffix: `questions[${index}].correctAnswerIndex`,
      };
    }
  }

  return { valid: true, message: null, pathSuffix: 'questions' };
};

const hasTextContent = (lesson) => {
  const text = lesson?.content?.textContent || lesson?.content?.content || lesson?.content?.notes;
  return trim(text).length > 0;
};

const hasDocumentSource = (lesson) => {
  const content = lesson?.content || {};
  const candidates = [
    content.documentUrl,
    content.fileUrl,
    content.downloadUrl,
    content.url,
    content.documentAsset?.signedUrl,
    content.documentAsset?.publicUrl,
    content.documentAsset?.url,
  ];
  return candidates.some((value) => (typeof value === 'string' ? trim(value).length > 0 : false));
};

const hasReflectionContent = (lesson) => {
  const content = lesson?.content || {};
  const candidates = [
    content.reflectionPrompt,
    content.question,
    content.prompt,
  ];
  return candidates.some((value) => (typeof value === 'string' ? trim(value).length > 0 : false));
};

const hasInteractiveSource = (lesson) => {
  const { interactiveUrl, elements, scenarioText, options } = lesson?.content || {};
  if (trim(interactiveUrl).length > 0) return true;
  if (Array.isArray(elements) && elements.length > 0) return true;
  if (trim(scenarioText).length > 0) return true;
  if (Array.isArray(options) && options.length > 0) return true;
  return false;
};

const lessonHasPublishableMedia = (lesson, intent) => {
  if (lesson?.type === 'video') {
    return hasVideoSource(lesson, { allowPlaceholders: intent !== 'publish' });
  }
  if (lesson?.type === 'quiz') {
    return intent === 'publish' ? validateQuizQuestions(lesson).valid : hasQuizQuestions(lesson);
  }
  if (lesson?.type === 'text') {
    return hasTextContent(lesson);
  }
  if (lesson?.type === 'reflection') {
    return hasReflectionContent(lesson);
  }
  return false;
};

const pushIssue = (issues, issue) => {
  issues.push({
    severity: issue.severity || 'error',
    ...issue,
  });
};

export const validateCourse = (course, options = {}) => {
  const issues = [];
  const intent = options.intent || (course?.status === 'published' ? 'publish' : 'draft');
  const requireMediaForPublishedModules =
    typeof options.requireMediaForPublishedModules === 'boolean'
      ? options.requireMediaForPublishedModules
      : true;

  if (trim(course?.title).length < MIN_TITLE_LENGTH) {
    pushIssue(issues, {
      code: 'course.title.missing',
      message: `Course title must be at least ${MIN_TITLE_LENGTH} characters`,
      path: 'course.title',
    });
  }

  const descriptionMinLength = intent === 'publish' ? MIN_DESCRIPTION_PUBLISH : MIN_DESCRIPTION_DRAFT;
  if (trim(course?.description).length < descriptionMinLength) {
    pushIssue(issues, {
      code: 'course.description.short',
      message: `Course description must be at least ${descriptionMinLength} characters`,
      path: 'course.description',
    });
  }

  const modules = Array.isArray(course?.modules)
    ? course.modules.map((module) => ({
        id: module?.id,
        title: module?.title,
        lessons: ensureLessons(module?.lessons),
      }))
    : [];

  if (modules.length === 0) {
    pushIssue(issues, {
      code: 'course.modules.missing',
      message: 'Add at least one module before saving',
      path: 'course.modules',
    });
    return { isValid: false, issues };
  }

  modules.forEach((module, moduleIndex) => {
    if (trim(module.title).length === 0) {
      pushIssue(issues, {
        code: 'module.title.missing',
        message: `Module ${moduleIndex + 1} is missing a title`,
        path: `modules[${moduleIndex}].title`,
        moduleId: module.id,
      });
    }

    const lessons = ensureLessons(module.lessons);
    if (lessons.length === 0) {
      pushIssue(issues, {
        code: 'module.lessons.missing',
        message: `Module ${moduleIndex + 1} must contain at least one lesson`,
        path: `modules[${moduleIndex}].lessons`,
        moduleId: module.id,
      });
      return;
    }

    let moduleHasMedia = false;

    lessons.forEach((lesson, lessonIndex) => {
      if (trim(lesson?.title).length === 0) {
        pushIssue(issues, {
          code: 'lesson.title.missing',
          message: `Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs a title`,
          path: `modules[${moduleIndex}].lessons[${lessonIndex}].title`,
          moduleId: module.id,
          lessonId: lesson?.id,
        });
      }

      switch (lesson?.type) {
        case 'video':
          if (!hasVideoSource(lesson, { allowPlaceholders: intent !== 'publish' })) {
            pushIssue(issues, {
              code: 'lesson.video.source_missing',
              message: `Add a playable video URL or upload for Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1}`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.videoUrl`,
              moduleId: module.id,
              lessonId: lesson?.id,
            });
          } else if (intent === 'publish') {
            const metadataCheck = validateVideoAsset(lesson);
            if (!metadataCheck.valid) {
              pushIssue(issues, {
                code: 'lesson.video.metadata_missing',
                message: `Lesson ${lessonIndex + 1} in Module ${moduleIndex + 1} is missing video metadata: ${metadataCheck.missing.join(', ')}`,
                path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.videoAsset`,
                moduleId: module.id,
                lessonId: lesson?.id,
              });
            }
            if (metadataCheck.warnings.length > 0) {
              pushIssue(issues, {
                code: 'lesson.video.metadata_incomplete',
                message: `Video metadata incomplete (recommended fields: ${metadataCheck.warnings.join(', ')}) for Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1}`,
                path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.videoAsset`,
                moduleId: module.id,
                lessonId: lesson?.id,
                severity: 'warning',
              });
            }
          }
          break;
        case 'quiz':
          if (!hasQuizQuestions(lesson)) {
            pushIssue(issues, {
              code: 'lesson.quiz.questions_missing',
              message: `Quiz in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs at least one question`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.questions`,
              moduleId: module.id,
              lessonId: lesson?.id,
            });
          } else {
            const quizValidation = validateQuizQuestions(lesson);
            if (!quizValidation.valid) {
              pushIssue(issues, {
                code: 'lesson.quiz.invalid_question',
                message:
                  quizValidation.message ||
                  `Quiz in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} has invalid questions`,
                path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.${quizValidation.pathSuffix}`,
                moduleId: module.id,
                lessonId: lesson?.id,
              });
            }
          }
          break;
        case 'text':
          if (!hasTextContent(lesson)) {
            pushIssue(issues, {
              code: 'lesson.text.content_missing',
              message: `Text lesson in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} requires content`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.textContent`,
              moduleId: module.id,
              lessonId: lesson?.id,
            });
          }
          break;
        case 'document':
        case 'resource':
        case 'download':
          if (!hasDocumentSource(lesson)) {
            pushIssue(issues, {
              code: 'lesson.document.source_missing',
              message: `Document lesson in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs a file or URL`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.fileUrl`,
              moduleId: module.id,
              lessonId: lesson?.id,
            });
          }
          break;
        case 'reflection':
          if (!hasReflectionContent(lesson)) {
            pushIssue(issues, {
              code: 'lesson.reflection.content_missing',
              message: `Reflection lesson in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs learner-facing content or a prompt`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content`,
              moduleId: module.id,
              lessonId: lesson?.id,
            });
          }
          break;
        case 'interactive':
        case 'scenario':
          if (!hasInteractiveSource(lesson)) {
            pushIssue(issues, {
              code: 'lesson.interactive.content_missing',
              message: `Interactive lesson in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs a URL or configured activity`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content`,
              moduleId: module.id,
              lessonId: lesson?.id,
            });
          }
          break;
        default:
          break;
      }

      if (!moduleHasMedia && lessonHasPublishableMedia(lesson, intent)) {
        moduleHasMedia = true;
      }
    });

    if (intent === 'publish' && requireMediaForPublishedModules && !moduleHasMedia) {
      pushIssue(issues, {
        code: 'module.publishable.media_missing',
        message: `Module ${moduleIndex + 1} must include a video with a playable source, a quiz with questions, or a text lesson with learner-facing content before publishing`,
        path: `modules[${moduleIndex}].lessons`,
        moduleId: module.id,
      });
    }
  });

  const blockingIssues = issues.filter((issue) => issue.severity === 'error');
  return {
    isValid: blockingIssues.length === 0,
    issues,
  };
};

export default validateCourse;
