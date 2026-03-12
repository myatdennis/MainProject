const DEFAULT_VIDEOS_BUCKET = 'course-videos';
const DEFAULT_DOCUMENTS_BUCKET = 'course-resources';

export const COURSE_VIDEOS_BUCKET =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_VIDEOS_BUCKET) || DEFAULT_VIDEOS_BUCKET;

export const COURSE_DOCUMENTS_BUCKET =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_DOCUMENTS_BUCKET) || DEFAULT_DOCUMENTS_BUCKET;

export default {
  COURSE_VIDEOS_BUCKET,
  COURSE_DOCUMENTS_BUCKET,
};
