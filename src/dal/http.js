import apiRequest from '../utils/apiClient';
import { config } from '../config/env';
import { withRetries } from '../utils/retry';
export class DalError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'DalError';
        this.status = status;
        this.code = code;
    }
}
export async function request(url, options = {}) {
    const doFetch = async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeouts.requestMs);
        try {
            // apiRequest already throws on non-ok; it also handles auth headers and transforms
            const json = await apiRequest(url, { ...options, signal: controller.signal });
            return json;
        }
        catch (err) {
            const status = typeof err?.status === 'number' ? err.status : undefined;
            const code = err?.code || err?.name;
            throw new DalError(err?.message || 'Request failed', status, code);
        }
        finally {
            clearTimeout(timeout);
        }
    };
    return withRetries(doFetch, {
        attempts: config.retries.attempts,
        backoffMs: config.retries.backoffMs,
        shouldRetry: (error) => {
            const status = error?.status;
            // retry network-ish errors and 5xx
            return status === undefined || (typeof status === 'number' && status >= 500);
        },
    });
}
