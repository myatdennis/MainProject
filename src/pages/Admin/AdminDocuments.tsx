import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, UploadCloud, Trash } from 'lucide-react';
import documentService, { DocumentMeta, Visibility } from '../../dal/documents';
import notificationService from '../../dal/notifications';
import { useToast } from '../../context/ToastContext';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await documentService.listDocuments({ forceAdmin: true });
      setDocs(list || []);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setLoadError(err?.message || 'Unable to load documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onFile = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    if (!file && !name) {
      showToast('Provide a name or file', 'error');
      return;
    }

    try {
      const doc = await documentService.addDocument({
        name: name || file?.name || 'Untitled Document',
        filename: file?.name,
        category,
        subcategory: subcategory || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        fileType: file?.type,
        visibility,
        organizationId: visibility === 'org' ? orgId : undefined,
        userId: visibility === 'user' ? userId : undefined,
        createdBy: 'Admin'
      }, file || undefined);

      if (visibility === 'org' && orgId) {
        await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with your organization.`, organizationId: orgId });
      }
      if (visibility === 'user' && userId) {
        await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with you.`, userId });
      }

      setName(''); setFile(null); setTags(''); setOrgId(''); setUserId('');
      load();
      showToast('Document uploaded', 'success');
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      showToast(error?.message || 'Unable to upload document', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete document?')) return;
    await documentService.deleteDocument(id);
    load();
    showToast('Document deleted', 'success');
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
            <label className="text-sm font-medium muted-text block mb-2">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2">Category</label>
            <input className="input" value={category} onChange={e => setCategory(e.target.value)} />
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
            <select className="input" value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}>
              <option value="global">Global</option>
              <option value="org">Organization</option>
              <option value="user">User</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium muted-text block mb-2">Org ID / User ID</label>
            <input className="input" placeholder="orgId or userId" value={visibility === 'org' ? orgId : userId} onChange={e => visibility === 'org' ? setOrgId(e.target.value) : setUserId(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium muted-text block mb-2">File</label>
          <div className="border-dashed p-6 rounded-lg" style={{border: '2px dashed var(--input-border)'}}>
            <input ref={inputRef} type="file" onChange={e => onFile(e.target.files?.[0] || null)} style={{display: 'none'}} />
            <div className="flex items-center justify-center gap-3">
              <UploadCloud className="w-5 h-5 muted-text" />
              <button onClick={() => inputRef.current?.click()} className="text-sm text-primary">Choose file</button>
              <span className="text-sm muted-text">or drag and drop (not implemented)</span>
            </div>
            {file && <div className="mt-3 text-sm text-neutral-text">Selected: {file.name} <button onClick={() => setFile(null)} className="ml-3 text-danger">Remove</button></div>}
          </div>
        </div>

        <div className="mt-4 text-right">
          <button onClick={handleUpload} className="btn-primary primary-gradient">Upload</button>
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
            <button onClick={load} className="btn-primary text-sm">Retry</button>
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
                  <div className="text-sm muted-text">{d.category} • {d.subcategory} • {d.tags?.join(', ')}</div>
                  <div className="text-xs muted-text">{d.visibility}{d.organizationId ? ` • org:${d.organizationId}` : ''}{d.userId ? ` • user:${d.userId}` : ''}</div>
                </div>
                <div className="flex items-center gap-4">
                  {d.url && <a onClick={() => documentService.recordDownload(d.id)} href={d.url} target="_blank" rel="noreferrer" className="text-sm text-primary font-medium underline">Open</a>}
                  <div className="text-sm muted-text">{d.downloadCount || 0} downloads</div>
                  <button onClick={() => handleDelete(d.id)} className="icon-action"><Trash className="w-4 h-4" /></button>
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
