import { ApiError } from '../../../utils/apiClient';

export type ApiErrorInfo = {
  status: number | null;
  code: string | null;
  message: string | null;
};

export const extractApiErrorInfo = (error: unknown): ApiErrorInfo | null => {
  if (!(error instanceof ApiError)) return null;
  const body = (typeof error.body === 'object' && error.body !== null ? error.body : null) as Record<
    string,
    unknown
  > | null;
  const code =
    typeof body?.code === 'string'
      ? body.code
      : typeof body?.error_code === 'string'
      ? (body?.error_code as string)
      : null;
  const messageCandidates = [
    typeof body?.error === 'string' ? (body.error as string) : null,
    typeof body?.message === 'string' ? (body.message as string) : null,
    typeof body?.detail === 'string' ? (body.detail as string) : null,
  ];
  const message = messageCandidates.find((value) => Boolean(value)) ?? error.message ?? null;
  return {
    status: typeof error.status === 'number' ? error.status : null,
    code,
    message,
  };
};

export const formatApiErrorToast = (info: ApiErrorInfo, context: string): string => {
  const normalizedCode = (info.code || '').toLowerCase();
  const isPayloadTooLarge = info.status === 413 || normalizedCode === 'payload_too_large';
  if (isPayloadTooLarge) {
    return `${context} paused: this draft is too large to sync right now. Remove oversized media/transcript content and try again.`;
  }

  const parts: string[] = [];
  if (info.status) {
    parts.push(String(info.status));
  }
  if (info.code) {
    parts.push(info.code);
  }
  const prefix = parts.length ? `${parts.join(' · ')} ` : '';
  const detail = info.message ?? 'Please try again.';
  return `${context} failed. ${prefix}${detail}`.trim();
};

export const extractConflictDetails = (
  error: unknown,
): { reason: string | null; message: string | null; details?: Record<string, unknown> | null } | null => {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 409) return null;
  const body = (error.body && typeof error.body === 'object') ? (error.body as Record<string, any>) : null;
  const details = body?.details && typeof body.details === 'object' ? (body.details as Record<string, unknown>) : null;
  const explicitReason =
    (typeof details?.reason === 'string' && details.reason) ||
    (typeof body?.reason === 'string' && body.reason) ||
    null;
  const code =
    (typeof body?.code === 'string' && body.code) ||
    (typeof body?.error === 'string' && body.error) ||
    null;
  const reason =
    explicitReason ||
    (code === 'version_conflict' ? 'stale_version' : null) ||
    (code === 'idempotency_conflict' ? 'idempotency_in_flight' : null);
  const message = typeof body?.message === 'string' ? body.message : error.message ?? null;
  return { reason, message, details };
};
