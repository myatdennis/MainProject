import apiRequest from '../utils/apiClient';

export type SignedMediaResponse = {
  assetId: string;
  signedUrl: string;
  urlExpiresAt: string;
  bucket?: string;
  storagePath?: string;
  mimeType?: string;
  bytes?: number;
  metadata?: Record<string, any> | null;
};

export const isDirectMediaUrl = (value: string) => /^https?:\/\//i.test(value.trim());
export const isExternalMediaReference = (value: string) => /^external:\/\//i.test(value.trim());
export const shouldBypassMediaSigning = (value: string) =>
  isDirectMediaUrl(value) || isExternalMediaReference(value);

const MEDIA_SIGN_TIMEOUT_MS = 30_000;

export const signMediaAsset = async (assetId: string): Promise<SignedMediaResponse> => {
  if (!assetId) {
    throw new Error('assetId is required to sign media');
  }

  if (isDirectMediaUrl(assetId)) {
    return {
      assetId,
      signedUrl: assetId,
      urlExpiresAt: '',
      bucket: 'external',
      storagePath: assetId,
      mimeType: '',
      bytes: 0,
      metadata: { directUrl: true, external: true },
    };
  }

  if (isExternalMediaReference(assetId)) {
    throw new Error('Media source is external and does not require signing.');
  }

  const payload = await apiRequest<SignedMediaResponse>(`/api/media/assets/${encodeURIComponent(assetId)}/sign`, {
    method: 'POST',
    timeoutMs: MEDIA_SIGN_TIMEOUT_MS,
  });
  if (!payload?.signedUrl) {
    throw new Error('Signed URL not returned by media service');
  }
  return payload;
};

export const shouldRefreshSignedUrl = (expiresAt?: string | null, bufferMs = 60_000) => {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return true;
  return ts - Date.now() <= bufferMs;
};

export default {
  isDirectMediaUrl,
  isExternalMediaReference,
  shouldBypassMediaSigning,
  signMediaAsset,
  shouldRefreshSignedUrl,
};
