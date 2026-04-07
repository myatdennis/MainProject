import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonVideoAsset } from '../types/courseTypes';
import { shouldBypassMediaSigning, signMediaAsset, shouldRefreshSignedUrl } from '../dal/media';

const DEFAULT_REFRESH_BUFFER_MS = 60_000;
const DEFAULT_SIGN_RETRY_COUNT = 2;
const DEFAULT_SIGN_RETRY_BASE_DELAY_MS = 350;

type UseSignedMediaUrlOptions = {
  asset?: LessonVideoAsset | null;
  fallbackUrl?: string | null;
  refreshBufferMs?: number;
  autoRefresh?: boolean;
};

type SignedMediaState = {
  url: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: string | null;
};

const createUnavailableState = (fallbackUrl?: string | null): SignedMediaState => ({
  url: fallbackUrl ?? null,
  expiresAt: null,
  isLoading: false,
  error: fallbackUrl ? null : 'Media source unavailable.',
});

const isTransientSigningError = (error: unknown) => {
  const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('temporarily') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('5xx') ||
    message.includes('service unavailable')
  );
};

export const useSignedMediaUrl = ({
  asset,
  fallbackUrl = null,
  refreshBufferMs = DEFAULT_REFRESH_BUFFER_MS,
  autoRefresh = true,
}: UseSignedMediaUrlOptions) => {
  const mountedRef = useRef(true);
  const bypassSigning = Boolean(asset?.assetId && shouldBypassMediaSigning(asset.assetId));
  const bypassUrl = asset?.signedUrl ?? fallbackUrl ?? (asset?.assetId?.startsWith('http') ? asset.assetId : null);
  const cacheKey = asset?.assetId && !bypassSigning ? `signed-media:${asset.assetId}` : null;

  const readCachedEntry = () => {
    if (!cacheKey || typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { url: string; expiresAt: string | null } | null;
      if (!parsed?.url) return null;
      if (shouldRefreshSignedUrl(parsed.expiresAt, refreshBufferMs)) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const cacheEntry = readCachedEntry();
  const needsInitialRefresh = Boolean(
    asset?.assetId && !cacheEntry && (!asset?.signedUrl || shouldRefreshSignedUrl(asset.urlExpiresAt, refreshBufferMs)),
  );

  const [state, setState] = useState<SignedMediaState>(() => {
    if (!asset?.assetId) {
      return createUnavailableState(fallbackUrl);
    }

    if (bypassSigning) {
      return {
        url: bypassUrl,
        expiresAt: null,
        isLoading: false,
        error: bypassUrl ? null : 'Media source unavailable.',
      };
    }

    const initialSignedUrl = cacheEntry?.url || asset.signedUrl;
    const initialExpires = cacheEntry?.expiresAt || asset.urlExpiresAt;

    if (initialSignedUrl && !shouldRefreshSignedUrl(initialExpires, refreshBufferMs)) {
      return {
        url: initialSignedUrl,
        expiresAt: initialExpires ?? null,
        isLoading: false,
        error: null,
      };
    }

    return {
      url: fallbackUrl ?? initialSignedUrl ?? null,
      expiresAt: initialExpires ?? null,
      isLoading: needsInitialRefresh,
      error: null,
    };
  });

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const setSafeState = useCallback((next: SignedMediaState | ((prev: SignedMediaState) => SignedMediaState)) => {
    if (!mountedRef.current) return;
    setState(next);
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!asset?.assetId) {
        setSafeState(createUnavailableState(fallbackUrl));
        return;
      }

      if (bypassSigning) {
        setSafeState({
          url: bypassUrl,
          expiresAt: null,
          isLoading: false,
          error: bypassUrl ? null : 'Media source unavailable.',
        });
        return;
      }

      if (!force) {
        const cached = readCachedEntry();
        if (cached) {
          setSafeState({ url: cached.url, expiresAt: cached.expiresAt ?? null, isLoading: false, error: null });
          return;
        }
      }

      if (!force && asset.signedUrl && !shouldRefreshSignedUrl(asset.urlExpiresAt, refreshBufferMs)) {
        setSafeState({
          url: asset.signedUrl,
          expiresAt: asset.urlExpiresAt ?? null,
          isLoading: false,
          error: null,
        });
        return;
      }

      setSafeState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        let payload: Awaited<ReturnType<typeof signMediaAsset>> | null = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= DEFAULT_SIGN_RETRY_COUNT; attempt += 1) {
          try {
            payload = await signMediaAsset(asset.assetId);
            break;
          } catch (attemptError) {
            lastError = attemptError;
            if (attempt >= DEFAULT_SIGN_RETRY_COUNT || !isTransientSigningError(attemptError)) {
              throw attemptError;
            }
            const waitMs = DEFAULT_SIGN_RETRY_BASE_DELAY_MS * 2 ** attempt;
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }

        if (!payload) {
          throw lastError ?? new Error('Unable to refresh signed media URL.');
        }

        if (cacheKey && typeof window !== 'undefined') {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ url: payload.signedUrl, expiresAt: payload.urlExpiresAt ?? null }),
          );
        }
        setSafeState({
          url: payload.signedUrl,
          expiresAt: payload.urlExpiresAt ?? null,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Failed to refresh signed media URL', err);
        const message = err instanceof Error ? err.message : 'Unable to load media. Please try again.';
        setSafeState({
          url: fallbackUrl,
          expiresAt: null,
          isLoading: false,
          error: message,
        });
      }
    },
    [asset, bypassSigning, bypassUrl, fallbackUrl, refreshBufferMs, setSafeState],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!asset?.assetId) {
      setSafeState(createUnavailableState(fallbackUrl));
      return;
    }
    if (bypassSigning) {
      setSafeState({
        url: bypassUrl,
        expiresAt: null,
        isLoading: false,
        error: bypassUrl ? null : 'Media source unavailable.',
      });
      return;
    }
    void refresh(true);
  }, [asset?.assetId, asset?.signedUrl, asset?.urlExpiresAt, bypassSigning, bypassUrl, fallbackUrl, refresh, setSafeState]);

  useEffect(() => {
    if (!autoRefresh || !state.expiresAt) return;
    const expiresTs = Date.parse(state.expiresAt);
    if (Number.isNaN(expiresTs)) return;
    const refreshAt = expiresTs - refreshBufferMs;
    const delay = refreshAt - Date.now();
    if (delay <= 0) {
      void refresh(true);
      return;
    }
    const timer = setTimeout(() => {
      void refresh(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [autoRefresh, refreshBufferMs, state.expiresAt, refresh]);

  return {
    url: state.url,
    expiresAt: state.expiresAt,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
    hasAsset: Boolean(asset?.assetId),
  };
};

export default useSignedMediaUrl;
