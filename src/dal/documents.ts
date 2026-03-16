import { request } from './http';
import apiRequest from '../utils/apiClient';

export type Visibility = 'global' | 'org' | 'user';

/** Resolves the correct documents endpoint based on caller surface.
 *  Admin surfaces use the full `/api/admin/documents` endpoint.
 *  Client/learner surfaces use `/api/client/documents` which enforces
 *  org-scoped visibility without exposing admin-only documents.
 */
const resolveDocumentsEndpoint = (forceAdmin = false): string => {
  if (forceAdmin) return '/api/admin/documents';
  // Detect admin surface by URL prefix
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return '/api/admin/documents';
  }
  return '/api/client/documents';
};

export type DocumentMeta = {
  id: string;
  name: string;
  filename?: string;
  url?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  fileType?: string;
  storagePath?: string;
  urlExpiresAt?: string;
  fileSize?: number;
  visibility: Visibility;
  organizationId?: string;
  userId?: string;
  createdAt: string;
  createdBy?: string;
  downloadCount?: number;
  metadata?: Record<string, any> | null;
  mediaAssetId?: string;
};

const mapDocumentRecord = (record: any): DocumentMeta => ({
  id: record.id,
  // DB uses 'name' as primary; 'title' is an older alias kept for backwards compat
  name: record.name ?? record.title ?? '',
  // DB uses 'file_url' as canonical; 'url' is a legacy/camelCase alias
  filename: record.filename ?? record.name ?? undefined,
  url: record.file_url ?? record.url ?? undefined,
  category: record.category,
  subcategory: record.subcategory ?? undefined,
  tags: record.tags ?? [],
  fileType: record.file_type ?? record.fileType ?? undefined,
  storagePath: record.storage_path ?? record.storagePath ?? undefined,
  urlExpiresAt: record.url_expires_at ?? record.urlExpiresAt ?? undefined,
  fileSize: typeof record.file_size === 'number' ? record.file_size : record.fileSize,
  visibility: record.visibility ?? 'global',
  organizationId: record.organization_id ?? record.organizationId ?? record.org_id ?? record.orgId ?? undefined,
  userId: record.user_id ?? record.userId ?? undefined,
  createdAt: record.created_at ?? record.createdAt ?? new Date().toISOString(),
  createdBy: record.created_by ?? record.createdBy ?? undefined,
  // download_count column does not exist in prod; default to 0
  downloadCount: record.download_count ?? record.downloadCount ?? 0,
  metadata: record.metadata ?? record.meta_json ?? null,
  mediaAssetId: record.media_asset_id ?? record.metadata?.mediaAssetId ?? undefined,
});

const buildDocumentPayload = (input: Record<string, any>): Record<string, any> => {
  const payload = { ...input };
  // Normalize organizationId → organization_id
  if (Object.prototype.hasOwnProperty.call(payload, 'organizationId')) {
    payload.organization_id = payload.organizationId;
    delete payload.organizationId;
  }
  // Normalize url → file_url (DB canonical column)
  if (Object.prototype.hasOwnProperty.call(payload, 'url') && !Object.prototype.hasOwnProperty.call(payload, 'file_url')) {
    payload.file_url = payload.url;
    delete payload.url;
  }
  return payload;
};

type DocumentUploadResponse = {
  documentId: string;
  storagePath: string;
  signedUrl: string;
  urlExpiresAt: string;
  fileType?: string;
  fileSize?: number;
};

const uploadDocumentFile = async (
  file: File,
  opts: { documentId: string; organizationId?: string; visibility?: Visibility },
): Promise<DocumentUploadResponse> => {
  const form = new FormData();
  form.append('file', file);
  form.append('documentId', opts.documentId);
  if (opts.organizationId) form.append('organization_id', opts.organizationId);
  if (opts.visibility) form.append('visibility', opts.visibility);

  const response = await apiRequest<{ data: DocumentUploadResponse }>(
    '/api/admin/documents/upload',
    {
      method: 'POST',
      body: form,
      noTransform: false,
    },
  );

  if (!response?.data) {
    throw new Error('Document upload failed: missing response payload');
  }

  return response.data;
};

export const listDocuments = async (opts?: {
  organizationId?: string;
  userId?: string;
  tag?: string;
  category?: string;
  search?: string;
  /** Pass true only from admin surfaces to use the admin endpoint */
  forceAdmin?: boolean;
}) => {
  const endpoint = resolveDocumentsEndpoint(opts?.forceAdmin);
  const params = new URLSearchParams();
  if (opts?.organizationId) params.set('orgId', opts.organizationId);
  const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
  const json = await request<{ data: any[] }>(url);
  let docs = (json.data || []).map(mapDocumentRecord);

  // Seed a couple of defaults if empty to improve first-run UX
  // Only seed on admin surfaces (seeding requires write access via admin endpoint)
  if (docs.length === 0 && opts?.forceAdmin) {
    const seedDocs: Array<Omit<DocumentMeta, 'id' | 'createdAt'>> = [
      {
        name: 'Inclusive Leadership Handbook',
        category: 'Leadership',
        tags: ['handbook', 'leadership'],
        visibility: 'global',
        filename: 'inclusive-leadership-handbook.pdf',
        url: 'https://storage.thehuddleco.com/resources/inclusive-leadership-handbook.pdf',
      },
      {
        name: 'Bias Mitigation Checklist',
        category: 'Bias',
        tags: ['bias', 'checklist'],
        visibility: 'global',
        filename: 'bias-mitigation-checklist.pdf',
        url: 'https://storage.thehuddleco.com/resources/bias-mitigation-checklist.pdf',
      },
    ];

    for (const seed of seedDocs) {
      await addDocument(seed as any, undefined);
    }

    const refreshed = await request<{ data: any[] }>(resolveDocumentsEndpoint(true));
    docs = (refreshed.data || []).map(mapDocumentRecord);
  }

  if (opts?.organizationId) {
    docs = docs.filter(
      (doc) => doc.visibility === 'global' || (doc.visibility === 'org' && doc.organizationId === opts.organizationId),
    );
  }

  if (opts?.userId) {
    docs = docs.filter(
      (doc) => doc.visibility === 'global' || (doc.visibility === 'user' && doc.userId === opts.userId),
    );
  }

  if (opts?.tag) {
    docs = docs.filter((doc) => doc.tags.includes(opts.tag!));
  }

  if (opts?.category) {
    docs = docs.filter((doc) => doc.category === opts.category);
  }

  if (opts?.search) {
    const needle = opts.search.toLowerCase();
    docs = docs.filter((doc) =>
      `${doc.name} ${doc.category ?? ''} ${doc.tags.join(' ')}`.toLowerCase().includes(needle),
    );
  }

  return docs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

export const getDocument = async (id: string) => {
  const docs = await listDocuments();
  return docs.find((d) => d.id === id) || null;
};

export const addDocument = async (
  meta: Omit<DocumentMeta, 'id' | 'createdAt'>,
  file?: File | null,
) => {
  const docId = `doc-${Date.now()}`;
  let url = meta.url;
  let storagePath = meta.storagePath;
  let urlExpiresAt = meta.urlExpiresAt;
  let fileType = meta.fileType;
  let fileSize = meta.fileSize;

  if (file) {
    const uploadResult = await uploadDocumentFile(file, {
      documentId: docId,
      organizationId: meta.organizationId,
      visibility: meta.visibility,
    });

    storagePath = uploadResult.storagePath;
    url = uploadResult.signedUrl;
    urlExpiresAt = uploadResult.urlExpiresAt;
    fileType = uploadResult.fileType || fileType || file.type;
    fileSize = typeof uploadResult.fileSize === 'number' ? uploadResult.fileSize : file.size;
  }

  if (!url && !storagePath) {
    throw new Error('Document uploads require an external URL or a successful storage upload.');
  }

  const payload = buildDocumentPayload({
    id: docId,
    name: meta.name,
    filename: meta.filename,
    url,
    storagePath,
    urlExpiresAt,
    fileSize,
    category: meta.category,
    subcategory: meta.subcategory,
    tags: meta.tags ?? [],
    fileType,
    visibility: meta.visibility,
    organizationId: meta.organizationId,
    userId: meta.userId,
    createdBy: meta.createdBy,
    metadata: meta,
  } as any);

  const json = await request<{ data: any }>('/api/admin/documents', {
    method: 'POST',
    body: payload,
  });

  return mapDocumentRecord(json.data);
};

export const recordDownload = async (id: string) => {
  const json = await request<{ data: any }>(`/api/admin/documents/${id}/download`, {
    method: 'POST',
  });
  return mapDocumentRecord(json.data);
};

export const updateDocument = async (id: string, patch: Partial<DocumentMeta>) => {
  const json = await request<{ data: any }>(`/api/admin/documents/${id}`, {
    method: 'PUT',
    body: buildDocumentPayload(patch as Record<string, any>),
  });
  return mapDocumentRecord(json.data);
};

export const deleteDocument = async (id: string) => {
  await request(`/api/admin/documents/${id}`, { method: 'DELETE' });
};

export const assignToOrg = async (id: string, organizationId: string) =>
  updateDocument(id, { visibility: 'org', organizationId });
export const assignToUser = async (id: string, userId: string) =>
  updateDocument(id, { visibility: 'user', userId });

export default {
  listDocuments,
  getDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  assignToOrg,
  assignToUser,
  recordDownload,
};
