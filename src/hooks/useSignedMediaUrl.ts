import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonVideoAsset } from '../types/courseTypes';
import { signMediaAsset, shouldRefreshSignedUrl } from '../dal/media';

const DEFAULT_REFRESH_BUFFER_MS = 60_000;

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

export const useSignedMediaUrl = ({
  asset,
  fallbackUrl = null,
  refreshBufferMs = DEFAULT_REFRESH_BUFFER_MS,
  autoRefresh = true,
}: UseSignedMediaUrlOptions) => {
  const mountedRef = useRef(true);
  const cacheKey = asset?.assetId ? `signed-media:${asset.assetId}` : null;

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
        const payload = await signMediaAsset(asset.assetId);
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
    [asset, fallbackUrl, refreshBufferMs, setSafeState],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!asset?.assetId) {
      setSafeState(createUnavailableState(fallbackUrl));
      return;
    }
    void refresh(true);
  }, [asset?.assetId, asset?.signedUrl, asset?.urlExpiresAt, fallbackUrl, refresh, setSafeState]);

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
