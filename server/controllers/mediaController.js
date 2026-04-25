// server/controllers/mediaController.js
// Controller for media (video/audio) endpoints


import { createMediaService } from '../services/mediaService.js';
import { getSupabaseAdminClient } from '../lib/supabaseClient.js';

// These should match the config in index.js
const courseVideosBucket = process.env.SUPABASE_VIDEOS_BUCKET || 'course-videos';
const documentsBucket = process.env.SUPABASE_DOCUMENTS_BUCKET || 'course-resources';

const mediaService = createMediaService({
  getSupabase: () => getSupabaseAdminClient(),
  courseVideosBucket,
  documentsBucket,
});

// Provide stubs for missing methods to prevent runtime errors
mediaService.handleUpload = async (req) => { throw new Error('handleUpload not implemented'); };
mediaService.getDownloadUrl = async (mediaId, user) => { throw new Error('getDownloadUrl not implemented'); };
mediaService.getSignedUrl = async (mediaId, user) => { throw new Error('getSignedUrl not implemented'); };

// POST /upload
export const mediaUploadHandler = async (req, res) => {
  try {
    const result = await mediaService.handleUpload(req);
    res.json({ ok: true, data: result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
};

// GET /:mediaId/download
export const mediaDownloadHandler = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const url = await mediaService.getDownloadUrl(mediaId, req.user);
    res.json({ ok: true, url });
  } catch (error) {
    res.status(404).json({ ok: false, error: error.message });
  }
};

// POST /:mediaId/sign
export const mediaSignHandler = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const url = await mediaService.getSignedUrl(mediaId, req.user);
    res.json({ ok: true, url });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
};
