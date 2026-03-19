import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, UploadCloud, Trash } from 'lucide-react';
import documentService, { DocumentMeta, Visibility } from '../../dal/documents';
import { extractDalErrorDetail } from '../../dal/http';
import notificationService from '../../dal/notifications';
import { useToast } from '../../context/ToastContext';

type FieldErrors = Record<string, string>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v: string) => UUID_RE.test(v.trim());

const AdminDocuments: React.FC = () => {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Training');
  const [subcategory, setSubcategory] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('global');
  const [orgId, setOrgId] = useState('');
  const [userId, setUserId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await documentService.listDocuments({ forceAdmin: true });
      setDocs(list || []);
    } catch (err: any) {
      console.error('[AdminDocuments] load_failed', { message: err?.message });
      setLoadError(err?.message || 'Unable to load documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!category.trim()) errors.category = 'Category is required.';
    if (visibility === 'org') {
      if (!orgId.trim()) {
        errors.orgId = 'Organization ID is required for org-scoped documents.';
      } else if (!isValidUuid(orgId)) {
        errors.orgId = 'Organization ID must be a valid UUID (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).';
      }
    }
    if (visibility === 'user') {
      if (!userId.trim()) {
        errors.userId = 'User ID is required for user-scoped documents.';
      } else if (!isValidUuid(userId)) {
        errors.userId = 'User ID must be a valid UUID.';
      }
    }
    return errors;
  };

  // Derived: is the form currently in a submittable state?
  const isFormValid = (() => {
    if (!name.trim() || !category.trim()) return false;
    if (visibility === 'org' && (!orgId.trim() || !isValidUuid(orgId))) return false;
    if (visibility === 'user' && (!userId.trim() || !isValidUuid(userId))) return false;
    return true;
  })();

  const onFile = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    setFormError(null);
    setFieldErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const doc = await documentService.addDocument({
        name: name.trim() || file?.name || 'Untitled Document',
        filename: file?.name,
        category: category.trim(),
        subcategory: subcategory.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        fileType: file?.type,
        visibility,
        organizationId: visibility === 'org' ? orgId.trim() : undefined,
        userId: visibility === 'user' ? userId.trim() : undefined,
        createdBy: 'Admin',
      }, file || undefined);

      if (visibility === 'org' && orgId) {
        await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with your organization.`, organizationId: orgId });
      }
      if (visibility === 'user' && userId) {
        await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with you.`, userId });
      }

      setName(''); setFile(null); setTags(''); setOrgId(''); setUserId('');
      setFormError(null);
      setFieldErrors({});
      load();
      showToast('Document uploaded successfully', 'success');
    } catch (error: any) {
      const { message, fields } = extractDalErrorDetail(error);
      console.error('[AdminDocuments] upload_failed', { message, fields, status: error?.status });
      if (fields && Object.keys(fields).length > 0) {
        setFieldErrors(fields);
      }
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete document?')) return;
    try {
      await documentService.deleteDocument(id);
      load();
      showToast('Document deleted', 'success');
    } catch (err: any) {
      console.error('[AdminDocuments] delete_failed', { id, message: err?.message });
      showToast(err?.message || 'Unable to delete document', 'error');
    }
  };

  return (
    <div className="container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-neutral-text">Document Library</h1>
        <div className="flex items-center gap-3">
          <FilePlus className="w-6 h-6 text-primary" />
          <span className="text-sm muted-text">Upload and manage documents</span>
        </div>
      </div>

      <div className="card-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium muted-text block mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`input${fieldErrors.name ? ' border-red-500' : ''}`}
              value={name}
              onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: '' })); }}
            />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <input
              className={`input${fieldErrors.category ? ' border-red-500' : ''}`}
              value={category}
              onChange={e => { setCategory(e.target.value); setFieldErrors(p => ({ ...p, category: '' })); }}
            />
            {fieldErrors.category && <p className="text-xs text-red-600 mt-1">{fieldErrors.category}</p>}
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2">Subcategory</label>
            <input className="input" value={subcategory} onChange={e => setSubcategory(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium muted-text block mb-2">Tags (comma separated)</label>
            <input className="input" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2">Visibility</label>
            <select
              className="input"
              value={visibility}
              onChange={e => { setVisibility(e.target.value as Visibility); setFieldErrors({}); }}
            >
              <option value="global">Global</option>
              <option value="org">Organization</option>
              <option value="user">User</option>
            </select>
          </div>
          <div>
            {visibility === 'org' && (
              <>
                <label className="text-sm font-medium muted-text block mb-2">
                  Organization ID <span className="text-red-500">*</span>
                </label>
                <input
                  className={`input${fieldErrors.orgId ? ' border-red-500' : (!fieldErrors.orgId && orgId && isValidUuid(orgId)) ? ' border-green-500' : ''}`}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={orgId}
                  onChange={e => { setOrgId(e.target.value); setFieldErrors(p => ({ ...p, orgId: '' })); }}
                />
                {fieldErrors.orgId && <p className="text-xs text-red-600 mt-1">{fieldErrors.orgId}</p>}
                {!fieldErrors.orgId && orgId && isValidUuid(orgId) && (
                  <p className="text-xs text-green-700 mt-1">✓ Scoped to organization <code className="font-mono">{orgId}</code></p>
                )}
              </>
            )}
            {visibility === 'user' && (
              <>
                <label className="text-sm font-medium muted-text block mb-2">
                  User ID <span className="text-red-500">*</span>
                </label>
                <input
                  className={`input${fieldErrors.userId ? ' border-red-500' : (!fieldErrors.userId && userId && isValidUuid(userId)) ? ' border-green-500' : ''}`}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={userId}
                  onChange={e => { setUserId(e.target.value); setFieldErrors(p => ({ ...p, userId: '' })); }}
                />
                {fieldErrors.userId && <p className="text-xs text-red-600 mt-1">{fieldErrors.userId}</p>}
                {!fieldErrors.userId && userId && isValidUuid(userId) && (
                  <p className="text-xs text-green-700 mt-1">✓ Scoped to user <code className="font-mono">{userId}</code></p>
                )}
              </>
            )}
            {visibility === 'global' && (
              <div className="text-xs muted-text mt-6">Visible to all authenticated users</div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium muted-text block mb-2">File <span className="text-xs muted-text">(optional — document record can exist without a file)</span></label>
          <div className="border-dashed p-6 rounded-lg" style={{border: '2px dashed var(--input-border)'}}>
            <input ref={inputRef} type="file" onChange={e => onFile(e.target.files?.[0] || null)} style={{display: 'none'}} />
            <div className="flex items-center justify-center gap-3">
              <UploadCloud className="w-5 h-5 muted-text" />
              <button type="button" onClick={() => inputRef.current?.click()} className="text-sm text-primary">Choose file</button>
            </div>
            {file && (
              <div className="mt-3 text-sm text-neutral-text">
                Selected: {file.name}
                <button type="button" onClick={() => setFile(null)} className="ml-3 text-danger">Remove</button>
              </div>
            )}
          </div>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
            {formError}
          </div>
        )}

        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={handleUpload}
            disabled={isSubmitting || !isFormValid}
            className="btn-primary primary-gradient disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
            title={!isFormValid ? 'Fill in required fields (Name, Category) before uploading' : undefined}
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {isSubmitting ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="card-md">
        <h2 className="text-lg font-semibold text-neutral-text mb-4">All Documents</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading documents…</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <p className="text-sm text-red-600">{loadError}</p>
            <button type="button" onClick={load} className="btn-primary text-sm">Retry</button>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400 gap-2">
            <FilePlus className="w-10 h-10 text-gray-300" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs">Upload a document above to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between border p-4 rounded-lg" style={{border: '1px solid var(--card-border)', background: 'var(--card-bg)'}}>
                <div>
                  <div className="font-medium text-primary">{d.name}</div>
                  <div className="text-sm muted-text">{d.category}{d.subcategory ? ` • ${d.subcategory}` : ''}{d.tags?.length ? ` • ${d.tags.join(', ')}` : ''}</div>
                  <div className="text-xs muted-text">{d.visibility}{d.organizationId ? ` • org:${d.organizationId}` : ''}{d.userId ? ` • user:${d.userId}` : ''}</div>
                </div>
                <div className="flex items-center gap-4">
                  {d.url && <a onClick={() => documentService.recordDownload(d.id)} href={d.url} target="_blank" rel="noreferrer" className="text-sm text-primary font-medium underline">Open</a>}
                  <div className="text-sm muted-text">{d.downloadCount || 0} downloads</div>
                  <button type="button" onClick={() => handleDelete(d.id)} className="icon-action"><Trash className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDocuments;
