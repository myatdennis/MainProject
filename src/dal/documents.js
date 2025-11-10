import { request } from './http';
import { getSupabase } from '../lib/supabase';
const mapDocumentRecord = (record) => ({
    id: record.id,
    name: record.name,
    filename: record.filename ?? undefined,
    url: record.url ?? undefined,
    category: record.category,
    subcategory: record.subcategory ?? undefined,
    tags: record.tags ?? [],
    fileType: record.file_type ?? record.fileType ?? undefined,
    visibility: record.visibility ?? 'global',
    orgId: record.org_id ?? record.orgId ?? undefined,
    userId: record.user_id ?? record.userId ?? undefined,
    createdAt: record.created_at ?? record.createdAt ?? new Date().toISOString(),
    createdBy: record.created_by ?? record.createdBy ?? undefined,
    downloadCount: record.download_count ?? record.downloadCount ?? 0,
});
export const listDocuments = async (opts) => {
    const json = await request('/api/admin/documents');
    let docs = (json.data || []).map(mapDocumentRecord);
    // Seed a couple of defaults if empty to improve first-run UX
    if (docs.length === 0) {
        const seedDocs = [
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
            await addDocument(seed, undefined);
        }
        const refreshed = await request('/api/admin/documents');
        docs = (refreshed.data || []).map(mapDocumentRecord);
    }
    if (opts?.orgId) {
        docs = docs.filter((doc) => doc.visibility === 'global' || (doc.visibility === 'org' && doc.orgId === opts.orgId));
    }
    if (opts?.userId) {
        docs = docs.filter((doc) => doc.visibility === 'global' || (doc.visibility === 'user' && doc.userId === opts.userId));
    }
    if (opts?.tag) {
        docs = docs.filter((doc) => doc.tags.includes(opts.tag));
    }
    if (opts?.category) {
        docs = docs.filter((doc) => doc.category === opts.category);
    }
    if (opts?.search) {
        const needle = opts.search.toLowerCase();
        docs = docs.filter((doc) => `${doc.name} ${doc.category ?? ''} ${doc.tags.join(' ')}`.toLowerCase().includes(needle));
    }
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
export const getDocument = async (id) => {
    const docs = await listDocuments();
    return docs.find((d) => d.id === id) || null;
};
export const addDocument = async (meta, file) => {
    const docId = `doc-${Date.now()}`;
    let url = meta.url;
    // Try Supabase storage if configured
    if (file) {
        try {
            const supabase = await getSupabase();
            if (supabase && supabase.storage) {
                const path = `${docId}/${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(path, file, { upsert: true });
                if (!uploadError) {
                    const { data } = supabase.storage.from('documents').getPublicUrl(path);
                    url = data?.publicUrl || url;
                }
                else {
                    console.warn('Storage upload failed, falling back to data URL:', uploadError);
                }
            }
        }
        catch (err) {
            console.error('Upload exception:', err);
        }
    }
    // Fallback to data URL in dev/demo
    if (!url && file) {
        url = await new Promise((res, rej) => {
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
        metadata: meta,
    };
    const json = await request('/api/admin/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return mapDocumentRecord(json.data);
};
export const recordDownload = async (id) => {
    const json = await request(`/api/admin/documents/${id}/download`, {
        method: 'POST',
    });
    return mapDocumentRecord(json.data);
};
export const updateDocument = async (id, patch) => {
    const json = await request(`/api/admin/documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
    });
    return mapDocumentRecord(json.data);
};
export const deleteDocument = async (id) => {
    await request(`/api/admin/documents/${id}`, { method: 'DELETE' });
};
export const assignToOrg = async (id, orgId) => updateDocument(id, { visibility: 'org', orgId });
export const assignToUser = async (id, userId) => updateDocument(id, { visibility: 'user', userId });
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
