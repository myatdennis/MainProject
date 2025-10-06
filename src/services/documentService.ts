// Local-first document service for dev. Stores documents in localStorage.
export type Visibility = 'global' | 'org' | 'user';

import { supabase } from '../lib/supabase';

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

const STORAGE_KEY = 'huddle_documents_v1';

const readAll = (): DocumentMeta[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as DocumentMeta[]; } catch { return []; }
};

const writeAll = (docs: DocumentMeta[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));

export const listDocuments = async (opts?: { orgId?: string; userId?: string; tag?: string; category?: string; search?: string }) => {
  let docs = readAll();
  if (opts?.orgId) docs = docs.filter(d => d.visibility === 'org' && d.orgId === opts.orgId || d.visibility === 'global');
  if (opts?.userId) docs = docs.filter(d => d.visibility === 'user' && d.userId === opts.userId || d.visibility === 'global');
  if (opts?.tag) docs = docs.filter(d => d.tags.includes(opts.tag!));
  if (opts?.category) docs = docs.filter(d => d.category === opts.category);
  if (opts?.search) docs = docs.filter(d => (d.name + ' ' + d.tags.join(' ') + ' ' + (d.category||'')).toLowerCase().includes(opts.search!.toLowerCase()));
  return docs.sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt));
};

export const getDocument = async (id: string) => {
  const docs = readAll();
  return docs.find(d => d.id === id) || null;
};

export const addDocument = async (meta: Omit<DocumentMeta,'id'|'createdAt'>, file?: File | null) => {
  const docs = readAll();
  const docId = `doc-${Date.now()}`;
  let url = meta.url;

  // If a File is provided and supabase storage is available, upload it to 'documents' bucket
  if (file && (supabase as any)?.storage) {
    try {
      const path = `${docId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (uploadError) {
        console.warn('Storage upload failed, falling back to data URL:', uploadError.message || uploadError);
      } else {
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        url = data?.publicUrl || url;
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

  const doc: DocumentMeta = { id: docId, createdAt: new Date().toISOString(), ...meta, url } as DocumentMeta;
  doc.downloadCount = doc.downloadCount || 0;
  docs.push(doc);
  writeAll(docs);
  return doc;
};

export const recordDownload = async (id: string) => {
  const docs = readAll();
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return;
  docs[idx].downloadCount = (docs[idx].downloadCount || 0) + 1;
  writeAll(docs);
  return docs[idx];
};

export const updateDocument = async (id: string, patch: Partial<DocumentMeta>) => {
  const docs = readAll();
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) throw new Error('Not found');
  docs[idx] = { ...docs[idx], ...patch };
  writeAll(docs);
  return docs[idx];
};

export const deleteDocument = async (id: string) => {
  let docs = readAll();
  docs = docs.filter(d => d.id !== id);
  writeAll(docs);
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
  assignToUser
  , recordDownload
};
