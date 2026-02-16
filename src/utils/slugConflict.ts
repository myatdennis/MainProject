import { slugify } from './courseNormalization';
import { ApiError } from './apiClient';

export type SlugConflictInfo = {
  suggestion: string;
  message: string;
  attemptedSlug?: string | null;
};

const DEFAULT_MESSAGE = 'Slug already in use. Updated the slug field with a new suggestion.';

const buildLocalSlugSuggestion = (value?: string | null): string => {
  const normalized = slugify(value || '') || '';
  if (!normalized) {
    return `course-${Math.random().toString(36).slice(2, 8)}`;
  }

  const match = normalized.match(/^(.*?)-(\d+)$/);
  if (match) {
    const [, prefix, suffix] = match;
    const next = Number.parseInt(suffix, 10);
    if (Number.isFinite(next)) {
      return `${prefix}-${next + 1}`;
    }
  }

  return `${normalized}-2`;
};

export const parseSlugConflictError = (
  error: unknown,
  fallbackSlug?: string | null,
): SlugConflictInfo | null => {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 409) return null;

  const body = (error.body ?? {}) as Record<string, any>;
  const code = (body?.code || body?.error || '').toString();
  if (code !== 'slug_taken') return null;

  const suggestionInput =
    typeof body?.suggestion === 'string' && body.suggestion.trim().length > 0
      ? body.suggestion.trim()
      : null;
  const suggestion = slugify(suggestionInput || '') || buildLocalSlugSuggestion(fallbackSlug);
  const message =
    typeof body?.message === 'string' && body.message.trim().length > 0
      ? body.message.trim()
      : DEFAULT_MESSAGE;

  return { suggestion, message, attemptedSlug: fallbackSlug ?? null };
};

export class SlugConflictError extends Error {
  suggestion: string;
  attemptedSlug?: string | null;
  originalError?: ApiError;
  constructor(info: SlugConflictInfo, originalError?: ApiError) {
    super(info.message || DEFAULT_MESSAGE);
    this.name = 'SlugConflictError';
    this.suggestion = info.suggestion;
    this.attemptedSlug = info.attemptedSlug;
    this.originalError = originalError;
  }

  get userMessage(): string {
    return this.message || DEFAULT_MESSAGE;
  }
}

export const isSlugConflictError = (error: unknown): error is SlugConflictError =>
  error instanceof SlugConflictError;

