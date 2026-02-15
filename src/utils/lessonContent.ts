import { nanoid } from 'nanoid';
import type { Lesson, LessonContent, QuizQuestion, QuizOption } from '../types/courseTypes';
import migrateLessonContent from './contentMigrator';

const ensureId = (prefix: string) => `${prefix}-${nanoid(8)}`;

export const canonicalizeQuizQuestions = (questions: any[] = []): QuizQuestion[] => {
  return questions.map((question, questionIndex) => {
    const questionId = question?.id || ensureId(`q${questionIndex}`);
    const rawOptions = Array.isArray(question?.options)
      ? question.options
      : Array.isArray(question?.choices)
      ? question.choices
      : Array.isArray(question?.answers)
      ? question.answers
      : [''];

    const normalizedOptions: QuizOption[] = rawOptions
      .map((option: any, optionIndex: number) => {
        if (typeof option === 'string') {
          return {
            id: `${questionId}-opt-${optionIndex}`,
            text: option,
            correct:
              typeof question?.correctAnswerIndex === 'number'
                ? question.correctAnswerIndex === optionIndex
                : false,
            isCorrect:
              typeof question?.correctAnswerIndex === 'number'
                ? question.correctAnswerIndex === optionIndex
                : false,
          };
        }

        if (!option || typeof option !== 'object') {
          return {
            id: `${questionId}-opt-${optionIndex}`,
            text: '',
            correct: false,
            isCorrect: false,
          };
        }

        const resolvedId = option.id || `${questionId}-opt-${optionIndex}`;
        const isCorrect =
          option.correct ??
          option.isCorrect ??
          (typeof question?.correctAnswerIndex === 'number'
            ? question.correctAnswerIndex === optionIndex
            : false);

        return {
          ...option,
          id: resolvedId,
          text: option.text || option.label || option.value || `Option ${optionIndex + 1}`,
          correct: Boolean(isCorrect),
          isCorrect: Boolean(isCorrect),
        };
      })
      .filter((option): option is QuizOption => Boolean(option?.id));

    const resolvedIndex =
      typeof question?.correctAnswerIndex === 'number'
        ? question.correctAnswerIndex
        : normalizedOptions.findIndex((option) => Boolean(option.correct || option.isCorrect));

    return {
      ...question,
      id: questionId,
      text: question?.text || question?.question || question?.prompt || '',
      prompt: question?.prompt || question?.text || question?.question || '',
      options: normalizedOptions,
      correctAnswerIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
    };
  });
};

export const canonicalizeLessonContent = (content?: LessonContent): LessonContent => {
  if (!content) return {};

  const migrated = migrateLessonContent(content);
  const next: LessonContent = { ...migrated };

  if (Array.isArray(next.questions)) {
    next.questions = canonicalizeQuizQuestions(next.questions) as any;
  }

  if (!next.textContent && typeof next.content === 'string') {
    next.textContent = next.content;
  }

  if (!next.content && typeof next.textContent === 'string') {
    next.content = next.textContent;
  }

  if (next.video && typeof next.video === 'object' && next.video.url && !next.videoUrl) {
    next.videoUrl = next.video.url;
  }

  if (!next.videoSourceType && next.videoProvider) {
    next.videoSourceType =
      next.videoProvider === 'youtube' || next.videoProvider === 'vimeo' ? 'external' : 'internal';
  }

  if (next.videoAsset && typeof next.videoAsset.bytes === 'string') {
    const parsedBytes = Number(next.videoAsset.bytes);
    if (!Number.isNaN(parsedBytes)) {
      next.videoAsset.bytes = parsedBytes;
    }
  }

  return next;
};

export const deriveTextContent = (lesson: Lesson): string => {
  const content = lesson.content || {};
  if (typeof content.textContent === 'string') return content.textContent;
  if (typeof content.content === 'string') return content.content;
  if (typeof (content as any).body?.textContent === 'string') return (content as any).body.textContent;
  if (typeof content.notes === 'string') return content.notes;
  return '';
};

export const hasVideoAssetMetadata = (lesson: Lesson): boolean => {
  const asset = lesson.content?.videoAsset;
  if (!asset) return false;
  const required = ['storagePath', 'bucket', 'bytes', 'mimeType'] as const;
  return required.every((field) => {
    const value = asset[field];
    if (field === 'bytes') {
      return typeof value === 'number' && value > 0;
    }
    return typeof value === 'string' && value.trim().length > 0;
  });
};

export const normalizeLessonForPersistence = <T extends Lesson>(lesson: T): T => {
  const normalizedContent = canonicalizeLessonContent(lesson.content);
  return {
    ...lesson,
    content: normalizedContent,
  };
};
