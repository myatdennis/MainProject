export const validateAdminDocumentCreatePayload = (payload = {}, { isUuid }) => {
  const missingFields = [];
  if (!payload.name) missingFields.push('name');
  if (!payload.category) missingFields.push('category');
  if (missingFields.length > 0) {
    return {
      ok: false,
      status: 400,
      code: 'validation_failed',
      message: `Missing required fields: ${missingFields.join(', ')}.`,
      fields: Object.fromEntries(missingFields.map((field) => [field, `${field} is required`])),
    };
  }

  if (payload.visibility && !['global', 'org', 'user'].includes(String(payload.visibility))) {
    return {
      ok: false,
      status: 400,
      code: 'validation_failed',
      message: 'Visibility must be one of: global, org, user.',
      fields: { visibility: 'visibility must be one of global, org, user' },
    };
  }

  if (payload.userId && !isUuid(String(payload.userId).trim())) {
    return {
      ok: false,
      status: 400,
      code: 'validation_failed',
      message: 'User ID must be a valid UUID.',
      fields: { userId: 'userId must be a valid UUID' },
    };
  }

  return { ok: true };
};

export const buildDocumentUpdatePayload = (patch = {}) => {
  const updatePayload = {};
  const map = {
    name: 'name',
    filename: 'filename',
    url: 'url',
    category: 'category',
    subcategory: 'subcategory',
    tags: 'tags',
    fileType: 'file_type',
    fileSize: 'file_size',
    bucket: 'bucket',
    storagePath: 'storage_path',
    urlExpiresAt: 'url_expires_at',
    visibility: 'visibility',
    userId: 'user_id',
    metadata: 'metadata',
    organizationId: 'organization_id',
    organization_id: 'organization_id',
    orgId: 'organization_id',
  };

  Object.entries(map).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      updatePayload[column] = patch[key];
    }
  });

  return updatePayload;
};

export default {
  validateAdminDocumentCreatePayload,
  buildDocumentUpdatePayload,
};
