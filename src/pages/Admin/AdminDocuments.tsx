import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, UploadCloud, Trash } from 'lucide-react';
import documentService, { DocumentMeta, Visibility } from '../../dal/documents';
import { extractDalErrorDetail } from '../../dal/http';
import notificationService from '../../dal/notifications';
import { useToast } from '../../context/ToastContext';
import useActiveOrganization from '../../hooks/useActiveOrganization';

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
  const { organizations, activeOrgId, isMultiOrg } = useActiveOrganization({ surface: 'admin' });

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
  useEffect(() => {
    if (orgId) return;
    if (activeOrgId) {
      setOrgId(activeOrgId);
      return;
    }
    if (organizations.length === 1) {
      setOrgId(organizations[0].id);
    }
  }, [activeOrgId, organizations, orgId]);

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!category.trim()) errors.category = 'Category is required.';
    if (!orgId.trim()) {
      errors.orgId = organizations.length > 1
        ? 'Select the organization that owns this document.'
        : 'Organization is required for document uploads.';
    } else if (!isValidUuid(orgId)) {
      errors.orgId = 'Organization ID must be a valid UUID (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).';
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
    if (!orgId.trim() || !isValidUuid(orgId)) return false;
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
        organizationId: orgId.trim(),
        userId: visibility === 'user' ? userId.trim() : undefined,
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
      await load();
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
            <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-name">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="admin-documents-name"
              aria-label="Name"
              className={`input${fieldErrors.name ? ' border-red-500' : ''}`}
              value={name}
              onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: '' })); }}
            />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-category">
              Category <span className="text-red-500">*</span>
            </label>
            <input
              id="admin-documents-category"
              aria-label="Category"
              className={`input${fieldErrors.category ? ' border-red-500' : ''}`}
              value={category}
              onChange={e => { setCategory(e.target.value); setFieldErrors(p => ({ ...p, category: '' })); }}
            />
            {fieldErrors.category && <p className="text-xs text-red-600 mt-1">{fieldErrors.category}</p>}
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-subcategory">Subcategory</label>
            <input id="admin-documents-subcategory" className="input" value={subcategory} onChange={e => setSubcategory(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-tags">Tags (comma separated)</label>
            <input id="admin-documents-tags" className="input" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-visibility">Visibility</label>
            <select
              id="admin-documents-visibility"
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
            <>
              <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-org">
                Owning organization <span className="text-red-500">*</span>
              </label>
              {organizations.length > 0 ? (
                <select
                  id="admin-documents-org"
                  aria-label="Owning organization"
                  className={`input${fieldErrors.orgId ? ' border-red-500' : ''}`}
                  value={orgId}
                  onChange={e => { setOrgId(e.target.value); setFieldErrors(p => ({ ...p, orgId: '' })); }}
                >
                  <option value="">Select organization</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="admin-documents-org"
                  aria-label="Owning organization"
                  className={`input${fieldErrors.orgId ? ' border-red-500' : (!fieldErrors.orgId && orgId && isValidUuid(orgId)) ? ' border-green-500' : ''}`}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={orgId}
                  onChange={e => { setOrgId(e.target.value); setFieldErrors(p => ({ ...p, orgId: '' })); }}
                />
              )}
              {fieldErrors.orgId && <p className="text-xs text-red-600 mt-1">{fieldErrors.orgId}</p>}
              {!fieldErrors.orgId && orgId && isValidUuid(orgId) && (
                <p className="text-xs text-green-700 mt-1">✓ Document will be owned by <code className="font-mono">{orgId}</code></p>
              )}
              {isMultiOrg && !orgId && (
                <p className="text-xs muted-text mt-1">Select the organization before uploading. Multi-org admins cannot upload into an ambiguous scope.</p>
              )}
            </>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            {visibility === 'user' && (
              <>
                <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-user">
                  User ID <span className="text-red-500">*</span>
                </label>
                <input
                  id="admin-documents-user"
                  aria-label="User ID"
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
              <div className="text-xs muted-text mt-6">Visible to all authenticated users, but still owned by the selected organization for admin scoping and auditing.</div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium muted-text block mb-2" htmlFor="admin-documents-file">File <span className="text-xs muted-text">(optional — document record can exist without a file)</span></label>
          <div className="border-dashed p-6 rounded-lg" style={{border: '2px dashed var(--input-border)'}}>
            <input id="admin-documents-file" ref={inputRef} type="file" onChange={e => onFile(e.target.files?.[0] || null)} style={{display: 'none'}} />
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
