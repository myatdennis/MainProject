import { createHash } from 'crypto';
import { logger } from '../lib/logger.js';

const DEFAULT_SIGN_TTL_SECONDS = Number(process.env.MEDIA_SIGN_TTL_SECONDS || 60 * 15);

const toHexChecksum = (buffer) => {
  try {
    return createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    logger.warn('media_checksum_failed', { message: error?.message || String(error) });
    return null;
  }
};

const normalizePath = (value = '') => value.replace(/^\/+/, '');

export const createMediaService = ({
  getSupabase,
  courseVideosBucket,
  documentsBucket,
}) => {
  const requireSupabase = () => {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }
    return client;
  };

  const uploadBufferToBucket = async ({ bucket, path, buffer, contentType }) => {
    const supabase = requireSupabase();
    const normalizedPath = normalizePath(path);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(normalizedPath, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true,
      });
    if (error) {
      throw error;
    }
    return normalizedPath;
  };

  const insertMediaRecord = async ({
    courseId,
    moduleId,
    lessonId,
    orgId,
    bucket,
    storagePath,
    mimeType,
    bytes,
    checksum,
    uploadedBy,
    source = 'api',
    metadata = {},
  }) => {
    const supabase = requireSupabase();
    const payload = {
      course_id: courseId || null,
      module_id: moduleId || null,
      lesson_id: lessonId || null,
      org_id: orgId || null,
      bucket,
      storage_path: storagePath,
      mime_type: mimeType,
      bytes,
      checksum,
      uploaded_by: uploadedBy || null,
      source,
      metadata,
    };
    const { data, error } = await supabase
      .from('course_media_assets')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  };

  const getAssetById = async (assetId) => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('course_media_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const createSignedUrlForPath = async ({ bucket, storagePath, ttlSeconds = DEFAULT_SIGN_TTL_SECONDS }) => {
    const supabase = requireSupabase();
    const normalizedPath = normalizePath(storagePath);
    const ttl = Math.max(60, Math.min(ttlSeconds, DEFAULT_SIGN_TTL_SECONDS * 4));
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(normalizedPath, ttl);
    if (error) throw error;
    if (!data?.signedUrl) {
      throw new Error('Signed URL not returned');
    }
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  };

  const signAssetById = async ({ assetId, ttlSeconds }) => {
    const supabase = requireSupabase();
    const asset = await getAssetById(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }
    const signed = await createSignedUrlForPath({
      bucket: asset.bucket,
      storagePath: asset.storage_path || asset.storagePath,
      ttlSeconds,
    });
    const { error } = await supabase
      .from('course_media_assets')
      .update({
        signed_url: signed.url,
        signed_url_expires_at: signed.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);
    if (error) {
      logger.warn('media_signed_url_update_failed', { assetId, message: error?.message || String(error) });
    }
    return { asset, signedUrl: signed.url, expiresAt: signed.expiresAt };
  };

  const uploadLessonVideo = async ({ file, storagePath, courseId, moduleId, lessonId, orgId, userId }) => {
    if (!courseId) throw new Error('courseId is required');
    if (!lessonId) throw new Error('lessonId is required');
    const targetPath = normalizePath(
      storagePath || `courses/${courseId}/${moduleId || 'module'}/${lessonId}-${Date.now()}/${file.originalname || 'video-upload'}`,
    );
    await uploadBufferToBucket({
      bucket: courseVideosBucket,
      path: targetPath,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
    const checksum = toHexChecksum(file.buffer);
    const assetRecord = await insertMediaRecord({
      courseId,
      moduleId,
      lessonId,
      orgId,
      bucket: courseVideosBucket,
      storagePath: targetPath,
      mimeType: file.mimetype,
      bytes: file.size,
      checksum,
      uploadedBy: userId,
      source: 'lesson-video',
    });
    const signed = await createSignedUrlForPath({ bucket: courseVideosBucket, storagePath: targetPath });
    return {
      asset: assetRecord,
      signedUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  };

  const uploadDocument = async ({ file, storagePath, orgId, userId, metadata = {} }) => {
    const targetPath = normalizePath(
      storagePath || `documents/${orgId || 'global'}/${Date.now()}-${file.originalname || 'upload.bin'}`,
    );
    await uploadBufferToBucket({
      bucket: documentsBucket,
      path: targetPath,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
    const checksum = toHexChecksum(file.buffer);
    const assetRecord = await insertMediaRecord({
      courseId: metadata.courseId || null,
      moduleId: metadata.moduleId || null,
      lessonId: metadata.lessonId || null,
      orgId: orgId || null,
      bucket: documentsBucket,
      storagePath: targetPath,
      mimeType: file.mimetype,
      bytes: file.size,
      checksum,
      uploadedBy: userId,
      source: metadata.source || 'document',
      metadata,
    });
    const signed = await createSignedUrlForPath({ bucket: documentsBucket, storagePath: targetPath });
    return {
      asset: assetRecord,
      signedUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  };

  return {
    uploadLessonVideo,
    uploadDocument,
    signAssetById,
    createSignedUrlForPath,
    getAssetById,
    courseVideosBucket,
    documentsBucket,
    DEFAULT_SIGN_TTL_SECONDS,
  };
};

export default {
  createMediaService,
};
