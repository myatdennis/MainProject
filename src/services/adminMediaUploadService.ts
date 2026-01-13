import { buildApiUrl } from '../config/apiBase';
import buildAuthHeaders from '../utils/requestContext';

export type UploadProgressHandler = (percent: number, event?: ProgressEvent<EventTarget>) => void;

interface UploadRequestOptions {
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
}

const sendFormDataWithProgress = async (path: string, formData: FormData, options: UploadRequestOptions = {}) => {
  const url = buildApiUrl(path);
  const headers = await buildAuthHeaders();
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.responseType = 'json';
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        xhr.setRequestHeader(key, value);
      }
    });

    const cleanup = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      xhr.abort();
      cleanup();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener('abort', onAbort);
    }

    if (xhr.upload && options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (!options.onProgress) return;
        if (event.lengthComputable) {
          const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
          options.onProgress(percent, event);
        } else {
          options.onProgress(0, event);
        }
      };
    }

    xhr.onerror = () => {
      cleanup();
      reject(new Error('Network error while uploading media'));
    };

    xhr.onload = () => {
      cleanup();
      const { status } = xhr;
      const response = xhr.response ?? null;
      if (status >= 200 && status < 300) {
        resolve(response);
      } else {
        const message = response?.error || response?.message || `Upload failed with status ${status}`;
        reject(new Error(message));
      }
    };

    xhr.send(formData);
  });
};

export type LessonVideoUploadResult = {
  data: {
    assetId: string;
    signedUrl: string;
    urlExpiresAt: string;
    bucket: string;
    storagePath: string;
    courseId: string;
    moduleId: string;
    lessonId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    checksum?: string | null;
  };
};

export const uploadLessonVideo = async (
  params: {
    courseId: string;
    moduleId: string;
    lessonId: string;
    file: File;
  } & UploadRequestOptions,
): Promise<LessonVideoUploadResult> => {
  const { courseId, moduleId, lessonId, file, ...rest } = params;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('courseId', courseId);
  formData.append('moduleId', moduleId);
  formData.append('lessonId', lessonId);
  const response = await sendFormDataWithProgress(
    `/api/admin/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}/video-upload`,
    formData,
    rest,
  );
  return response as LessonVideoUploadResult;
};

export type DocumentUploadResult = {
  data: {
    documentId: string;
    assetId: string;
    signedUrl: string;
    urlExpiresAt: string;
    storagePath: string;
    fileType: string;
    fileSize: number;
    bucket?: string;
  };
};

export const uploadDocumentResource = async (
  params: {
    file: File;
    documentId?: string;
    orgId?: string | null;
    courseId?: string;
    moduleId?: string;
    lessonId?: string;
  } & UploadRequestOptions,
): Promise<DocumentUploadResult> => {
  const { file, documentId, orgId, courseId, moduleId, lessonId, ...rest } = params;
  const resolvedDocumentId = documentId || `doc_${lessonId || Date.now()}`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', resolvedDocumentId);
  if (orgId) formData.append('orgId', orgId);
  if (courseId) formData.append('courseId', courseId);
  if (moduleId) formData.append('moduleId', moduleId);
  if (lessonId) formData.append('lessonId', lessonId);
  const response = await sendFormDataWithProgress('/api/admin/documents/upload', formData, rest);
  return response as DocumentUploadResult;
};

export default {
  uploadLessonVideo,
  uploadDocumentResource,
};
