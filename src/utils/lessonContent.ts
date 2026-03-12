import { nanoid } from 'nanoid';
import type { Lesson, LessonContent, QuizQuestion, QuizOption, LessonVideoAsset } from '../types/courseTypes';
import migrateLessonContent from './contentMigrator';

const ensureId = (prefix: string) => `${prefix}-${nanoid(8)}`;

const SUPABASE_URL: string | undefined = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
      return import.meta.env.VITE_SUPABASE_URL as string;
    }
  } catch {
    // ignore
  }
  if (typeof process !== 'undefined' && typeof process.env === 'object') {
    return process.env.SUPABASE_URL;
  }
  return undefined;
})();

const derivePublicSupabaseUrl = (bucket: string | undefined, path: string | undefined) => {
  if (!SUPABASE_URL || !bucket || !path) return undefined;
  const cleanedPath = path.replace(/^\/+/, '');
  return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${cleanedPath}`;
};

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
            correct: false,
            isCorrect: false,
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

        return {
          ...option,
          id: resolvedId,
          text: option.text || option.label || option.value || `Option ${optionIndex + 1}`,
          correct: Boolean(option.correct || option.isCorrect),
          isCorrect: Boolean(option.correct || option.isCorrect),
        };
      })
      .filter((option): option is QuizOption => Boolean(option?.id));

    const markedIndex =
      typeof question?.correctAnswerIndex === 'number'
        ? question.correctAnswerIndex
        : normalizedOptions.findIndex((option) => Boolean(option.correct || option.isCorrect));

    const resolvedIndex =
      markedIndex >= 0 && markedIndex < normalizedOptions.length ? markedIndex : normalizedOptions.length > 0 ? 0 : -1;

    const optionsWithFlags = normalizedOptions.map((option, optionIndex) => {
      const isCorrect = optionIndex === resolvedIndex;
      return {
        ...option,
        correct: isCorrect,
        isCorrect,
      };
    });

    const correctAnswerId =
      resolvedIndex >= 0 && optionsWithFlags[resolvedIndex] ? optionsWithFlags[resolvedIndex].id : null;

    const canonicalType =
      typeof question?.type === 'string' && question.type.length > 0 ? question.type : 'multiple_choice';
    return {
      ...question,
      id: questionId,
      type: canonicalType,
      text: question?.text || question?.question || question?.prompt || '',
      prompt: question?.prompt || question?.text || question?.question || '',
      options: optionsWithFlags,
      correctAnswerIndex: resolvedIndex >= 0 ? resolvedIndex : undefined,
      correctAnswer: correctAnswerId ?? undefined,
      correctOptionIds: correctAnswerId ? [correctAnswerId] : [],
    };
  });
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const pickString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const normalizeVideoAsset = (raw?: any): LessonVideoAsset | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const asset: LessonVideoAsset = {
    assetId:
      raw.assetId ??
      raw.asset_id ??
      raw.assetKey ??
      raw.asset_key ??
      raw.id ??
      raw.storageId ??
      raw.storage_id ??
      undefined,
    storagePath:
      pickString(
        raw.storagePath,
        raw.storage_path,
        raw.storageKey,
        raw.storage_key,
        raw.path,
        raw.asset_path,
        raw.assetId,
        raw.asset_id,
        raw.url,
        raw.publicUrl,
        raw.public_url,
      ) ?? 'external://unknown',
    bucket: pickString(raw.bucket, raw.bucket_id, raw.bucketId) ?? 'external',
    bytes: toNumber(raw.bytes ?? raw.size ?? raw.fileSize) ?? 0,
    mimeType: pickString(raw.mimeType, raw.mime_type, raw.contentType, raw.content_type) ?? 'video/mp4',
    checksum: raw.checksum ?? raw.etag ?? raw.hash ?? null,
    uploadedAt: raw.uploadedAt ?? raw.uploaded_at ?? raw.created_at ?? raw.updated_at,
    uploadedBy: raw.uploadedBy ?? raw.uploaded_by ?? raw.author ?? raw.owner ?? null,
    source: raw.source ?? raw.videoSource ?? raw.provider ?? raw.origin ?? undefined,
    status: raw.status ?? raw.uploadStatus ?? undefined,
    resumableToken: raw.resumableToken ?? raw.resumable_token ?? null,
    signedUrl: raw.signedUrl ?? raw.signed_url ?? raw.url ?? raw.publicUrl ?? raw.public_url ?? null,
    urlExpiresAt: raw.urlExpiresAt ?? raw.url_expires_at ?? raw.expires_at ?? null,
  };

  if (!asset.assetId) {
    asset.assetId = asset.storagePath;
  }

  if (!asset.signedUrl && typeof raw.signed_urls === 'object') {
    asset.signedUrl = raw.signed_urls?.read ?? raw.signed_urls?.default ?? null;
  }

  const bucketIsExternal = asset.bucket === 'external' || asset.bucket?.startsWith('external-');
  if (
    bucketIsExternal &&
    (!asset.signedUrl || asset.signedUrl.startsWith('external://')) &&
    asset.bucket &&
    asset.storagePath
  ) {
    const publicUrl = derivePublicSupabaseUrl(asset.bucket, asset.storagePath);
    if (publicUrl) {
      asset.publicUrl = publicUrl;
      asset.signedUrl = asset.signedUrl && !asset.signedUrl.startsWith('external://') ? asset.signedUrl : publicUrl;
    }
  } else if (!bucketIsExternal) {
    asset.publicUrl = asset.publicUrl ?? null;
  }

  return asset;
};

export const canonicalizeLessonContent = (content?: LessonContent): LessonContent => {
  if (!content) return {};

  const migrated = migrateLessonContent(content);
  const next: LessonContent = { ...migrated };

  const fallbackQuestions =
    Array.isArray((next as any)?.quiz?.questions)
      ? (next as any).quiz.questions
      : Array.isArray((next as any)?.quiz_questions)
      ? (next as any).quiz_questions
      : Array.isArray((next as any)?.quizQuestions)
      ? (next as any).quizQuestions
      : undefined;

  if (!next.questions && fallbackQuestions) {
    next.questions = fallbackQuestions;
  }

  if (Array.isArray(next.questions)) {
    next.questions = canonicalizeQuizQuestions(next.questions) as any;
  }

  if ((next as any).video_url && !next.videoUrl) {
    next.videoUrl = (next as any).video_url;
  }

  const rawAsset = next.videoAsset ?? (next as any).video_asset ?? (next.video as any)?.asset;
  const normalizedAsset = normalizeVideoAsset(rawAsset);
  if (normalizedAsset) {
    next.videoAsset = normalizedAsset;
  }

  const resolvedVideoUrl = pickString(
    next.videoUrl,
    (next as any).video_url,
    next.video?.url,
    next.video?.embedUrl,
    next.video?.source,
    next.videoAsset?.signedUrl ?? undefined,
    (next.videoAsset as any)?.url ?? (next.videoAsset as any)?.publicUrl ?? undefined,
    next.videoAsset?.bucket === 'external' && next.videoAsset?.storagePath?.startsWith('http')
      ? next.videoAsset.storagePath
      : undefined,
  );

  if (resolvedVideoUrl) {
    next.videoUrl = resolvedVideoUrl;
    if (!next.video) {
      next.video = {};
    }
    next.video.url = next.video.url || resolvedVideoUrl;
  }

  const assetBucket = next.videoAsset?.bucket ?? null;
  const assetSource =
    typeof next.videoAsset?.source === 'string'
      ? next.videoAsset.source
      : assetBucket && assetBucket !== 'external'
      ? 'internal'
      : assetBucket === 'external'
      ? 'external'
      : undefined;

  if (!next.videoSourceType) {
    next.videoSourceType = next.video?.sourceType || assetSource || (next.videoAsset ? 'internal' : 'external');
  } else if (next.videoAsset && assetBucket && assetBucket !== 'external' && next.videoSourceType === 'external') {
    next.videoSourceType = 'internal';
  }

  if (!next.videoProvider && typeof next.video?.provider === 'string') {
    next.videoProvider = next.video.provider;
  }

  if (!next.textContent && typeof next.content === 'string') {
    next.textContent = next.content;
  }

  if (!next.content && typeof next.textContent === 'string') {
    next.content = next.textContent;
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

  delete (next as any).video_url;
  delete (next as any).video_asset;
  delete (next as any).quiz_questions;
  delete (next as any).quizQuestions;

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
