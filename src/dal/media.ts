export type { SignedMediaResponse } from '../services/mediaClient';
export type { LessonVideoUploadResult, DocumentUploadResult, UploadProgressHandler } from '../services/adminMediaUploadService';

export { signMediaAsset, shouldRefreshSignedUrl } from '../services/mediaClient';
export { uploadLessonVideo, uploadDocumentResource } from '../services/adminMediaUploadService';
