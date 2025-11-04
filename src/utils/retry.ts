export type RetryOptions = {
  attempts?: number;
  backoffMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

export async function withRetries<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 2, backoffMs = 300, shouldRetry } = opts;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retry = shouldRetry ? shouldRetry(err, attempt) : true;
      if (attempt === attempts || !retry) break;
      // Exponential backoff
      const delay = backoffMs * Math.max(1, attempt + 1);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError;
}
