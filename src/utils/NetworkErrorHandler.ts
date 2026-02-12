import { toast } from 'react-hot-toast';

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
  body?: any;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

export class NetworkErrorHandler {
  private static readonly routeCooldowns = new Map<string, number>();
  private static readonly rateLimitBackoff = [500, 1500, 3000];
  private static defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2
  };

  static async handleApiCall<T>(
    apiCall: () => Promise<T>,
    options: {
      retryConfig?: Partial<RetryConfig>;
      errorMessage?: string;
      showErrorToast?: boolean;
      logErrors?: boolean;
      throttleKey?: string;
    } = {}
  ): Promise<T> {
    const {
      retryConfig = {},
      errorMessage = 'An unexpected error occurred',
      showErrorToast = true,
      logErrors = true,
      throttleKey,
    } = options;

    const config = { ...this.defaultRetryConfig, ...retryConfig };
    if (throttleKey) {
      const retryAt = this.routeCooldowns.get(throttleKey);
      if (retryAt && retryAt > Date.now()) {
        const blocked = this.buildThrottleError(throttleKey, retryAt);
        this.handleFinalError(blocked, errorMessage, showErrorToast);
        throw blocked;
      }
    }
    let lastError: ApiError;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = this.normalizeError(error);

        if (logErrors) {
          console.error(`API call failed (attempt ${attempt}/${config.maxAttempts}):`, {
            error: lastError,
            timestamp: new Date().toISOString(),
            attempt,
            maxAttempts: config.maxAttempts
          });
        }

        const isRateLimited = lastError.status === 429;
        if (isRateLimited) {
          const cooldownKey = throttleKey ?? this.extractRouteFromError(lastError);
          const cooldownMs = this.computeRateLimitDelay(lastError, attempt);
          if (cooldownKey) {
            this.routeCooldowns.set(cooldownKey, Date.now() + cooldownMs);
          }
        }

        // Don't retry on certain error types
        if (isRateLimited || this.shouldNotRetry(lastError) || attempt === config.maxAttempts) {
          break;
        }

        let delay = config.delay * Math.pow(config.backoffMultiplier, attempt - 1);
        if (isRateLimited) {
          delay = this.computeRateLimitDelay(lastError, attempt);
        }
        await this.sleep(delay);
      }
    }

    // Handle the final error
    this.handleFinalError(lastError!, errorMessage, showErrorToast);
    throw lastError!;
  }

  private static normalizeError(error: any): ApiError {
    if (error instanceof Error) {
      return error as ApiError;
    }

    if (typeof error === 'object' && error !== null) {
      const apiError = new Error(error.message || 'Unknown API error') as ApiError;
      apiError.status = error.status;
      apiError.code = error.code;
      apiError.details = error.details;
      return apiError;
    }

    return new Error(String(error)) as ApiError;
  }

  private static shouldNotRetry(error: ApiError): boolean {
    // Don't retry client errors (4xx) except for specific cases
    if (error.status && error.status >= 400 && error.status < 500) {
      // Retry on authentication errors (might be token refresh)
      if (error.status === 401 || error.status === 403) {
        return false;
      }
      // Retry on rate limiting
      if (error.status === 429) {
        return false;
      }
      // Don't retry other client errors
      return true;
    }

    // Retry server errors (5xx) and network errors
    return false;
  }

  private static handleFinalError(error: ApiError, message: string, showToast: boolean) {
    let errorMessage = message;
    let errorType: 'error' | 'loading' = 'error';
    const throttled = this.isThrottledError(error);

    // Customize message based on error type
    if (error.status === 401) {
      errorMessage = 'Your session has expired. Please log in again.';
    } else if (error.status === 403) {
      errorMessage = 'You don\'t have permission to perform this action.';
    } else if (error.status === 404) {
      errorMessage = 'The requested resource was not found.';
    } else if (error.status === 429) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.status && error.status >= 500) {
      errorMessage = 'Server error. Our team has been notified.';
    } else if (!navigator.onLine) {
      errorMessage = 'No internet connection. Please check your network.';
      errorType = 'loading';
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'Request timed out. Please try again.';
    }

    if (showToast && !throttled) {
      toast.error(errorMessage, {
        duration: 5000,
        position: 'top-right',
        style: {
          background: errorType === 'error' ? 'rgba(215, 38, 56, 0.12)' : 'rgba(246, 200, 123, 0.18)',
          color: errorType === 'error' ? '#D72638' : 'var(--accent-warning)',
          border: errorType === 'error' ? '1px solid rgba(215, 38, 56, 0.25)' : '1px solid rgba(246, 200, 123, 0.35)'
        }
      });
    }

    // Log to error reporting service
    this.logErrorToService(error, errorMessage);
  }

  private static logErrorToService(error: ApiError, message: string) {
    const errorReport = {
      message,
      originalError: error.message,
      status: error.status,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      online: navigator.onLine
    };

    // In production, send to monitoring service
    console.error('Network Error Report:', errorReport);

    // Store in local storage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('network_errors') || '[]');
      errors.push(errorReport);
      localStorage.setItem('network_errors', JSON.stringify(errors.slice(-20)));
    } catch (e) {
      console.error('Failed to store network error:', e);
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static computeRateLimitDelay(error: ApiError, attempt: number): number {
    const retryAfterMs = this.extractRetryAfter(error);
    if (retryAfterMs && retryAfterMs > 0) {
      return Math.min(retryAfterMs, 5000);
    }
    const index = Math.min(attempt, this.rateLimitBackoff.length);
    return this.rateLimitBackoff[index - 1] ?? this.rateLimitBackoff[this.rateLimitBackoff.length - 1];
  }

  private static extractRetryAfter(error: ApiError): number | undefined {
    const body = (error as any)?.body;
    const details = (error as any)?.details;
    const retryAfterMs = body?.retryAfterMs ?? details?.retryAfterMs;
    if (typeof retryAfterMs === 'number' && retryAfterMs >= 0) {
      return retryAfterMs;
    }
    return undefined;
  }

  private static isThrottledError(error: ApiError): boolean {
    const body = (error as any)?.body;
    const details = (error as any)?.details;
    return Boolean(body?.throttled || details?.throttled || error.code === 'client_throttle');
  }

  private static extractRouteFromError(error: ApiError): string | null {
    const bodyRoute = (error as any)?.body?.route;
    if (typeof bodyRoute === 'string') {
      return bodyRoute;
    }
    const url = (error as any)?.url;
    if (typeof url === 'string') {
      try {
        const parsed = new URL(url);
        return parsed.pathname || parsed.href;
      } catch {
        return url;
      }
    }
    return null;
  }

  private static buildThrottleError(key: string, retryAt: number): ApiError {
    const remaining = Math.max(retryAt - Date.now(), 0);
    const error = new Error('Too many requests. Please wait before retrying.') as ApiError;
    error.status = 429;
    error.code = 'client_throttle';
    error.body = {
      throttled: true,
      route: key,
      retryAt: new Date(retryAt).toISOString(),
      retryAfterMs: remaining,
    };
    return error;
  }

  // Utility method for handling specific API patterns
  static async withLoadingState<T>(
    apiCall: () => Promise<T>,
    setLoading: (loading: boolean) => void,
    options: Parameters<typeof NetworkErrorHandler.handleApiCall>[1] = {}
  ): Promise<T> {
    setLoading(true);
    try {
      return await this.handleApiCall(apiCall, options);
    } finally {
      setLoading(false);
    }
  }

  // Check network connectivity
  static isOnline(): boolean {
    return navigator.onLine;
  }

  // Setup global network monitoring
  static setupNetworkMonitoring(): () => void {
    const handleOnline = () => {
      toast.success('Connection restored', {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleOffline = () => {
      toast.error('No internet connection', {
        duration: Infinity,
        position: 'top-right'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

export default NetworkErrorHandler;
