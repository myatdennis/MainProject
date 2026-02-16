import type { Course, Lesson, Module, Chapter } from '../types/courseTypes';
import type { LessonVideoAsset } from '../types/courseTypes';
import { canonicalizeLessonContent, deriveTextContent } from '../utils/lessonContent';

export type CourseValidationIntent = 'draft' | 'publish';

export interface CourseValidationOptions {
  intent?: CourseValidationIntent;
  requireMediaForPublishedModules?: boolean;
}

export interface CourseValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
  moduleId?: string;
  lessonId?: string;
}

export interface CourseValidationResult {
  isValid: boolean;
  issues: CourseValidationIssue[];
}

type ModuleLike = Pick<Module, 'id' | 'title' | 'lessons'>;

type ModuleSource = ModuleLike & { lessons: Lesson[] };

const MIN_TITLE_LENGTH = 5;
const MIN_DESCRIPTION_DRAFT = 20;
const MIN_DESCRIPTION_PUBLISH = 50;

const PLACEHOLDER_VIDEO_PREFIXES = ['uploaded:', 'blob:'];
const REQUIRED_VIDEO_ASSET_FIELDS: Array<keyof LessonVideoAsset> = ['storagePath', 'bucket', 'bytes', 'mimeType'];
const OPTIONAL_VIDEO_ASSET_FIELDS: Array<keyof LessonVideoAsset> = ['checksum', 'uploadedAt', 'source'];

const ensureLessons = (lessons?: Lesson[]): Lesson[] => (Array.isArray(lessons) ? lessons : []);

const trim = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '');

const extractModules = (course: Course): ModuleSource[] => {
  if (Array.isArray(course.modules) && course.modules.length > 0) {
    return course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      lessons: ensureLessons(module.lessons),
    }));
  }

  if (Array.isArray(course.chapters) && course.chapters.length > 0) {
    return (course.chapters as Chapter[]).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      lessons: ensureLessons(chapter.lessons),
    }));
  }

  return [];
};

const isPlaceholderVideoUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_VIDEO_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const hasVideoSource = (lesson: Lesson, options: { allowPlaceholders?: boolean } = {}): boolean => {
  const allowPlaceholders = options.allowPlaceholders ?? true;
  const videoUrl =
    lesson.content?.videoUrl ||
    lesson.content?.video?.url ||
    lesson.content?.video?.embedUrl ||
    (lesson.content?.video as any)?.source ||
    (lesson.content as any)?.videoFile;

  if (typeof videoUrl === 'string') {
    if (!allowPlaceholders && isPlaceholderVideoUrl(videoUrl)) {
      return false;
    }
    return trim(videoUrl).length > 0;
  }

  return Boolean(videoUrl);
};

const lessonUsesExternalVideo = (lesson: Lesson): boolean => {
  const sourceType = lesson.content?.videoSourceType;
  if (sourceType === 'external') return true;
  const provider = lesson.content?.videoProvider;
  if (!provider) return false;
  return provider === 'youtube' || provider === 'vimeo' || provider === 'wistia';
};

const validateVideoAsset = (
  lesson: Lesson,
): { valid: boolean; missing: Array<keyof LessonVideoAsset>; warnings: Array<keyof LessonVideoAsset> } => {
  if (lessonUsesExternalVideo(lesson)) {
    return {
      valid: Boolean(lesson.content?.videoUrl),
      missing: [],
      warnings: [],
    };
  }

  const asset = lesson.content?.videoAsset;
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

const hasTextContent = (lesson: Lesson): boolean => {
  const text = deriveTextContent(lesson);
  return trim(text).length > 0;
};

const hasDocumentSource = (lesson: Lesson): boolean => {
  const content = lesson.content || {};
  const candidates = [
    content.documentUrl,
    content.fileUrl,
    (content as Record<string, unknown>).downloadUrl,
    (content as Record<string, unknown>).url,
  ];

  return candidates.some((value) => (typeof value === 'string' ? trim(value).length > 0 : false));
};

const hasInteractiveSource = (lesson: Lesson): boolean => {
  const { interactiveUrl, elements, scenarioText, options } = lesson.content || {};
  if (trim(interactiveUrl).length > 0) return true;
  if (Array.isArray(elements) && elements.length > 0) return true;
  if (trim(scenarioText).length > 0) return true;
  if (Array.isArray(options) && options.length > 0) return true;
  return false;
};

const hasQuizQuestions = (lesson: Lesson): boolean => {
  const questions = lesson.content?.questions;
  return Array.isArray(questions) && questions.length > 0;
};

const lessonHasPublishableMedia = (lesson: Lesson, intent: CourseValidationIntent): boolean => {
  if (lesson.type === 'video') {
    return hasVideoSource(lesson, { allowPlaceholders: intent !== 'publish' });
  }

  if (lesson.type === 'quiz') {
    return hasQuizQuestions(lesson);
  }

  if (lesson.type === 'text') {
    return hasTextContent(lesson);
  }

  return false;
};

const pushIssue = (
  issues: CourseValidationIssue[],
  issue: Omit<CourseValidationIssue, 'severity'> & { severity?: CourseValidationIssue['severity'] },
) => {
  issues.push({
    severity: issue.severity ?? 'error',
    ...issue,
  });
};

export const validateCourse = (
  course: Course,
  options: CourseValidationOptions = {},
): CourseValidationResult => {
  const issues: CourseValidationIssue[] = [];
  const intent: CourseValidationIntent = options.intent ?? (course.status === 'published' ? 'publish' : 'draft');
  const requireMediaForPublishedModules = options.requireMediaForPublishedModules ?? true;

  if (trim(course.title).length < MIN_TITLE_LENGTH) {
    pushIssue(issues, {
      code: 'course.title.missing',
      message: `Course title must be at least ${MIN_TITLE_LENGTH} characters`,
      path: 'course.title',
    });
  }

  const descriptionMinLength = intent === 'publish' ? MIN_DESCRIPTION_PUBLISH : MIN_DESCRIPTION_DRAFT;
  if (trim(course.description).length < descriptionMinLength) {
    pushIssue(issues, {
      code: 'course.description.short',
      message: `Course description must be at least ${descriptionMinLength} characters`,
      path: 'course.description',
    });
  }

  const modules = extractModules(course);

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

    const lessons = ensureLessons(module.lessons).map((lesson) => ({
      ...lesson,
      content: canonicalizeLessonContent(lesson.content),
    }));
    if (lessons.length === 0) {
      pushIssue(issues, {
        code: 'module.lessons.missing',
        message: `Module ${moduleIndex + 1} must contain at least one lesson`,
        path: `modules[${moduleIndex}].lessons`,
        moduleId: module.id,
      });
      return;
    }

    let moduleHasPublishableMedia = false;

    lessons.forEach((lesson, lessonIndex) => {
      if (trim(lesson.title).length === 0) {
        pushIssue(issues, {
          code: 'lesson.title.missing',
          message: `Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs a title`,
          path: `modules[${moduleIndex}].lessons[${lessonIndex}].title`,
          moduleId: module.id,
          lessonId: lesson.id,
        });
      }

      switch (lesson.type) {
        case 'video':
          if (!hasVideoSource(lesson, { allowPlaceholders: intent !== 'publish' })) {
            pushIssue(issues, {
              code: 'lesson.video.source_missing',
              message: `Add a playable video URL or upload for Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1}`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.videoUrl`,
              moduleId: module.id,
              lessonId: lesson.id,
            });
          } else if (intent === 'publish') {
            const metadataCheck = validateVideoAsset(lesson);
            if (!metadataCheck.valid) {
              pushIssue(issues, {
                code: 'lesson.video.metadata_missing',
                message: `Lesson ${lessonIndex + 1} in Module ${moduleIndex + 1} is missing video metadata: ${metadataCheck.missing.join(', ')}`,
                path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.videoAsset`,
                moduleId: module.id,
                lessonId: lesson.id,
              });
            }
            if (metadataCheck.warnings.length > 0) {
              pushIssue(issues, {
                code: 'lesson.video.metadata_incomplete',
                message: `Video metadata incomplete (recommended fields: ${metadataCheck.warnings.join(', ')}) for Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1}`,
                path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.videoAsset`,
                moduleId: module.id,
                lessonId: lesson.id,
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
              lessonId: lesson.id,
            });
          }
          break;
        case 'text':
          if (!hasTextContent(lesson)) {
            pushIssue(issues, {
              code: 'lesson.text.content_missing',
              message: `Text lesson in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} requires content`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.textContent`,
              moduleId: module.id,
              lessonId: lesson.id,
            });
          }
          break;
        case 'document':
          if (!hasDocumentSource(lesson)) {
            pushIssue(issues, {
              code: 'lesson.document.source_missing',
              message: `Document lesson in Module ${moduleIndex + 1}, Lesson ${lessonIndex + 1} needs a file or URL`,
              path: `modules[${moduleIndex}].lessons[${lessonIndex}].content.fileUrl`,
              moduleId: module.id,
              lessonId: lesson.id,
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
              lessonId: lesson.id,
            });
          }
          break;
      }

      if (!moduleHasPublishableMedia && lessonHasPublishableMedia(lesson, intent)) {
        moduleHasPublishableMedia = true;
      }
    });

    if (intent === 'publish' && requireMediaForPublishedModules && !moduleHasPublishableMedia) {
      pushIssue(issues, {
        code: 'module.publishable.media_missing',
        message: `Module ${moduleIndex + 1} must include at least one video with a media source, a quiz with questions, or a text lesson with learner-facing content before publishing`,
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
