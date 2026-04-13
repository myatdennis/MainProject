import apiRequest from '../utils/apiClient';
import { config } from '../config/env';
import { withRetries } from '../utils/retry';

export class DalError extends Error {
  status?: number;
  code?: string;
  /** Raw response body from the server (parsed JSON or string). */
  body?: unknown;
  constructor(message: string, status?: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'DalError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Extract a human-readable message from a DalError response body.
 *  The backend sends `{ error, message?, fields? }` for validation failures. */
export function extractDalErrorDetail(err: unknown): {
  message: string;
  fields?: Record<string, string>;
} {
  if (!(err instanceof DalError)) {
    return { message: (err as any)?.message || 'An unexpected error occurred.' };
  }
  const body = err.body as Record<string, any> | null | undefined;
  const message =
    body?.message || body?.error || err.message || 'An unexpected error occurred.';
  const fields = body?.fields && typeof body.fields === 'object' ? body.fields : undefined;
  return { message, fields };
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  noTransform?: boolean;
  expectedStatus?: number[];
};

export async function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeouts.requestMs);
    try {
      // apiRequest now enforces the envelope contract
      type AnyFn = (...args: any[]) => Promise<T>;
      const data = await (apiRequest as unknown as AnyFn)(url, { ...options, signal: controller.signal });
      return data as T;
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : undefined;
      const code = err?.code || err?.name;
      const body = err?.body ?? undefined;
      throw new DalError(err?.message || 'Request failed', status, code, body);
    } finally {
      clearTimeout(timeout);
    }
  };

  return withRetries(doFetch, {
    attempts: config.retries.attempts,
    backoffMs: config.retries.backoffMs,
    shouldRetry: (error) => {
      const status = (error as any)?.status;
      return status === undefined || (typeof status === 'number' && status >= 500);
    },
  });
}
