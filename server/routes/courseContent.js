const express = require('express');
const router = express.Router();

const sendApiSuccess = (res, data = null, options = {}) => {
  const {
    statusCode = 200,
    code = null,
    message = null,
    meta = null,
  } = options;
  return res.status(statusCode).json({
    ok: true,
    data,
    code,
    message,
    meta,
  });
};

// Save course content (slides)
router.post('/save', async (req, res) => {
  // TODO: Save course content to database
  // Example: { slides: [{title, text, image, voiceover}, ...] }
  sendApiSuccess(res, null, {
    code: 'course_content_saved',
    message: 'Course saved.',
  });
});

module.exports = router;
