export type Visibility = 'global' | 'org' | 'user';

import { getSupabase } from '../lib/supabase';
import apiRequest from '../utils/apiClient';

export type DocumentMeta = {
  id: string;
  name: string;
  filename?: string;
  url?: string; // for attachments (can be data URL or external)
  category: string; // top-level category
  subcategory?: string;
  tags: string[];
  fileType?: string; // mime
  visibility: Visibility;
  orgId?: string; // if visibility === 'org'
  userId?: string; // if visibility === 'user'
  createdAt: string;
  createdBy?: string;
  downloadCount?: number;
};

const withQuery = (path: string, params?: Record<string, any>) => {
  if (!params) return path;
  const url = new URL(path, 'http://api-local');
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
    } else {
      url.searchParams.set(key, String(value));
    }
  });
  const query = url.searchParams.toString();
  return query ? `${path}?${query}` : path;
};

const apiFetch = async <T>(path: string, options: RequestInit = {}, params?: Record<string, any>) => {
  const resolvedPath = withQuery(path, params);
  return apiRequest<T>(resolvedPath, options);
};

const mapDocumentRecord = (record: any): DocumentMeta => ({
  id: record.id,
  name: record.name,
  filename: record.filename ?? undefined,
  url: record.url ?? undefined,
  category: record.category,
  subcategory: record.subcategory ?? undefined,
  tags: record.tags ?? [],
  fileType: record.file_type ?? undefined,
  visibility: record.visibility ?? 'global',
  orgId: record.org_id ?? undefined,
  userId: record.user_id ?? undefined,
  createdAt: record.created_at ?? new Date().toISOString(),
  createdBy: record.created_by ?? undefined,
  downloadCount: record.download_count ?? 0
});

export const listDocuments = async (opts?: { orgId?: string; userId?: string; tag?: string; category?: string; search?: string }) => {
  const json = await apiFetch<{ data: any[] }>('/api/admin/documents');
  let docs = (json.data || []).map(mapDocumentRecord);

  if (docs.length === 0) {
    const seedDocs: Array<Omit<DocumentMeta, 'id' | 'createdAt'>> = [
      {
        name: 'Inclusive Leadership Handbook',
        category: 'Leadership',
        tags: ['handbook', 'leadership'],
        visibility: 'global',
        filename: 'inclusive-leadership-handbook.pdf',
        url: 'https://storage.thehuddleco.com/resources/inclusive-leadership-handbook.pdf'
      },
      {
        name: 'Bias Mitigation Checklist',
        category: 'Bias',
        tags: ['bias', 'checklist'],
        visibility: 'global',
        filename: 'bias-mitigation-checklist.pdf',
        url: 'https://storage.thehuddleco.com/resources/bias-mitigation-checklist.pdf'
      }
    ];

    for (const seed of seedDocs) {
      await addDocument(seed as any, undefined);
    }

    const refreshed = await apiFetch<{ data: any[] }>('/api/admin/documents');
    docs = (refreshed.data || []).map(mapDocumentRecord);
  }

  if (opts?.orgId) {
    docs = docs.filter(doc => doc.visibility === 'global' || (doc.visibility === 'org' && doc.orgId === opts.orgId));
  }

  if (opts?.userId) {
    docs = docs.filter(doc => doc.visibility === 'global' || (doc.visibility === 'user' && doc.userId === opts.userId));
  }

  if (opts?.tag) {
    docs = docs.filter(doc => doc.tags.includes(opts.tag!));
  }

  if (opts?.category) {
    docs = docs.filter(doc => doc.category === opts.category);
  }

  if (opts?.search) {
    const needle = opts.search.toLowerCase();
    docs = docs.filter(doc => `${doc.name} ${doc.category ?? ''} ${doc.tags.join(' ')}`.toLowerCase().includes(needle));
  }

  return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getDocument = async (id: string) => {
  const docs = await listDocuments();
  return docs.find(d => d.id === id) || null;
};

export const addDocument = async (meta: Omit<DocumentMeta,'id'|'createdAt'>, file?: File | null) => {
  const docId = `doc-${Date.now()}`;
  let url = meta.url;

  // If a File is provided and supabase storage is available, upload it to 'documents' bucket
  if (file) {
    try {
      const supabase = await getSupabase();
      if (supabase && (supabase as any).storage) {
        const path = `${docId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
        if (uploadError) {
          console.warn('Storage upload failed, falling back to data URL:', uploadError.message || uploadError);
        } else {
          const { data } = supabase.storage.from('documents').getPublicUrl(path);
          url = data?.publicUrl || url;
        }
      }
    } catch (err) {
      console.error('Upload exception:', err);
    }
  }

  // If no storage upload happened but a File was provided, read as data URL
  if (!url && file) {
    url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  const payload = {
    id: docId,
    name: meta.name,
    filename: meta.filename,
    url,
    category: meta.category,
    subcategory: meta.subcategory,
    tags: meta.tags ?? [],
    fileType: meta.fileType,
    visibility: meta.visibility,
    orgId: meta.orgId,
    userId: meta.userId,
    createdBy: meta.createdBy,
    metadata: meta
  };

  const json = await apiFetch<{ data: any }>('/api/admin/documents', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return mapDocumentRecord(json.data);
};

export const recordDownload = async (id: string) => {
  const json = await apiFetch<{ data: any }>(`/api/admin/documents/${id}/download`, {
    method: 'POST'
  });
  return mapDocumentRecord(json.data);
};

export const updateDocument = async (id: string, patch: Partial<DocumentMeta>) => {
  const json = await apiFetch<{ data: any }>(`/api/admin/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  });
  return mapDocumentRecord(json.data);
};

export const deleteDocument = async (id: string) => {
  await apiFetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
};

export const assignToOrg = async (id: string, orgId: string) => updateDocument(id, { visibility: 'org', orgId });
export const assignToUser = async (id: string, userId: string) => updateDocument(id, { visibility: 'user', userId });

export default {
  listDocuments,
  getDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  assignToOrg,
  assignToUser,
  recordDownload
};
