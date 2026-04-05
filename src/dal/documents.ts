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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

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
  if (opts?.userId) params.set('userId', opts.userId);
  const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
  const json = await request<{ data: any[] }>(url);
  let docs = (json.data || []).map(mapDocumentRecord);

  // Seed a couple of defaults if empty to improve first-run UX.
  // Only seed on admin surfaces (seeding requires write access via admin endpoint).
  // After seeding we append the synthetic records locally to avoid a second round-trip
  // (which would cause an extra auth/org-context log churn on every cold load).
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

    const seeded: DocumentMeta[] = [];
    for (const seed of seedDocs) {
      try {
        const created = await addDocument(seed as any, undefined);
        seeded.push(created);
      } catch {
        // Non-fatal: best-effort seed; don't block the page
      }
    }
    // Use the just-created records directly — no second fetch needed
    docs = seeded;
  }

  if (opts?.organizationId) {
    docs = docs.filter(
      (doc) =>
        doc.visibility === 'global' ||
        (doc.visibility === 'org' && doc.organizationId === opts.organizationId) ||
        (opts?.userId ? doc.visibility === 'user' && doc.userId === opts.userId : false),
    );
  }

  if (opts?.userId) {
    docs = docs.filter(
      (doc) =>
        doc.visibility === 'global' ||
        (doc.visibility === 'user' && doc.userId === opts.userId) ||
        (opts?.organizationId ? doc.visibility === 'org' && doc.organizationId === opts.organizationId : false),
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
  let url = meta.url ?? null;
  let storagePath = meta.storagePath ?? null;
  let urlExpiresAt = meta.urlExpiresAt ?? null;
  let fileType = meta.fileType ?? null;
  let fileSize = meta.fileSize ?? null;

  if (file) {
    try {
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
    } catch (uploadError) {
      console.warn('[documents] storage upload failed, falling back to inline document URL', {
        message: (uploadError as any)?.message || String(uploadError),
      });
      url = await readFileAsDataUrl(file);
      fileType = file.type || fileType;
      fileSize = file.size;
      storagePath = null;
      urlExpiresAt = null;
    }
  }

  // Build the payload using the snake_case organization_id key that the backend
  // pickOrgId() helper reads.  Do NOT use buildDocumentPayload() here because it
  // converts organizationId → organization_id but then the object also carries
  // organization_id from the explicit key below, which is fine — pickOrgId reads
  // whichever arrives first and is non-null.
  const payload: Record<string, any> = {
    name: meta.name,
    filename: meta.filename ?? null,
    url,
    storagePath,
    urlExpiresAt,
    fileSize,
    category: meta.category,
    subcategory: meta.subcategory ?? null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    fileType,
    visibility: meta.visibility ?? 'global',
    // Send all three org-id aliases so normalizeLegacyOrgInput / pickOrgId
    // can resolve whichever is non-null.
    organization_id: meta.organizationId ?? null,
    organizationId: meta.organizationId ?? null,
    userId: meta.userId ?? null,
    createdBy: meta.createdBy ?? null,
    metadata: meta.metadata ?? {},
  };

  const json = await request<{ data: any }>('/api/admin/documents', {
    method: 'POST',
    body: payload as any,
  });

  return mapDocumentRecord(json.data);
};

export const recordDownload = async (id: string) => {
  const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const path = isAdmin ? `/api/admin/documents/${id}/download` : `/api/client/documents/${id}/download`;
  const json = await request<{ data: any }>(path, {
    method: 'POST',
  });
  return mapDocumentRecord(json.data);
};

export const updateDocument = async (id: string, patch: Partial<DocumentMeta>) => {
  const json = await request<{ data: any }>(`/api/admin/documents/${id}`, {
    method: 'PUT',
    body: buildDocumentPayload(patch as Record<string, any>) as any,
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
