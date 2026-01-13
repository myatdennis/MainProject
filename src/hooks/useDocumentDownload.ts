import { useCallback, useMemo, useState } from 'react';
import type { DocumentMeta } from '../dal/documents';
import documentsDal from '../dal/documents';
import { shouldRefreshSignedUrl } from '../services/mediaClient';

export type DocumentDownloadState = {
  url: string | null;
  isLoading: boolean;
  error: string | null;
};

const useDocumentDownload = (document: DocumentMeta | null) => {
  const [state, setState] = useState<DocumentDownloadState>(() => ({
    url: document?.url ?? null,
    isLoading: false,
    error: null,
  }));

  const expiresAt = useMemo(() => document?.urlExpiresAt ?? null, [document?.urlExpiresAt]);

  const resolveFreshUrl = useCallback(async () => {
    if (!document?.id) {
      throw new Error('Document is unavailable.');
    }

    if (state.url && !shouldRefreshSignedUrl(expiresAt)) {
      return state.url;
    }

    const refreshed = await documentsDal.recordDownload(document.id);
    if (!refreshed?.url) {
      throw new Error('Signed download URL not available.');
    }
    return refreshed.url;
  }, [document?.id, expiresAt, state.url]);

  const download = useCallback(async () => {
    if (!document) return null;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const url = await resolveFreshUrl();
      setState({ url, isLoading: false, error: null });
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to download document.';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, [document, resolveFreshUrl]);

  return {
    ...state,
    download,
    hasDocument: Boolean(document?.id),
  };
};

export default useDocumentDownload;
