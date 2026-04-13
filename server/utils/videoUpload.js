import multer from 'multer';
// Maximum allowed video upload size (bytes). You may want to set this via env/config in production.
const COURSE_VIDEO_UPLOAD_MAX_BYTES = 750 * 1024 * 1024;

export const isVideoTooLargeError = (error) => {
  if (!error) return false;
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return true;
  }
  const status = Number(error.statusCode ?? error.status ?? 0);
  if (status === 413) {
    return true;
  }
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('exceeded the maximum allowed size') || message.includes('payload too large');
};

export const sendVideoTooLargeResponse = (res, source = 'upload') => {
  const maxBytes = Number.isFinite(COURSE_VIDEO_UPLOAD_MAX_BYTES)
    ? COURSE_VIDEO_UPLOAD_MAX_BYTES
    : 50 * 1024 * 1024;
  const maxMegabytes = Math.round(maxBytes / (1024 * 1024));
  res.status(413).json({
    error: 'video_too_large',
    code: 'video_too_large',
    message: `Video exceeds the size limit (${maxMegabytes}MB). Upload a smaller file or use an external URL.`,
    maxBytes,
    meta: {
      source,
      maxBytes,
    },
  });
};
