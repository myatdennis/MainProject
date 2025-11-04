import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, UploadCloud, Trash } from 'lucide-react';
import documentService, { DocumentMeta, Visibility } from '../../dal/documents';
import notificationService from '../../dal/notifications';

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const list = await documentService.listDocuments();
    setDocs(list || []);
  };

  useEffect(() => { load(); }, []);

  const onFile = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    if (!file && !name) return alert('Provide a name or file');

    let url: string | undefined;
    if (file) {
      // read as data URL for local dev (replace with real upload in production)
      url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }

    const doc = await documentService.addDocument({
      name: name || file!.name,
      filename: file?.name,
      url,
      category,
      subcategory: subcategory || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      fileType: file?.type,
      visibility,
      orgId: visibility === 'org' ? orgId : undefined,
      userId: visibility === 'user' ? userId : undefined,
      createdBy: 'Admin'
    }, file || undefined);

    if (visibility === 'org' && orgId) {
      await notificationService.addNotification({ title: 'New Document Shared', body: `A document \"${doc.name}\" was shared with your organization.`, orgId });
    }
    if (visibility === 'user' && userId) {
      await notificationService.addNotification({ title: 'New Document Shared', body: `A document \"${doc.name}\" was shared with you.`, userId });
    }

    setName(''); setFile(null); setTags(''); setOrgId(''); setUserId('');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete document?')) return;
    await documentService.deleteDocument(id);
    load();
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
        <div className="flex flex-col gap-4">
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between border p-4 rounded-lg" style={{border: '1px solid var(--card-border)', background: 'var(--card-bg)'}}>
              <div>
                <div className="font-medium text-primary">{d.name}</div>
                <div className="text-sm muted-text">{d.category} • {d.subcategory} • {d.tags?.join(', ')}</div>
                <div className="text-xs muted-text">{d.visibility}{d.orgId ? ` • org:${d.orgId}` : ''}{d.userId ? ` • user:${d.userId}` : ''}</div>
              </div>
              <div className="flex items-center gap-4">
                {d.url && <a onClick={() => documentService.recordDownload(d.id)} href={d.url} target="_blank" rel="noreferrer" className="text-sm text-primary font-medium underline">Open</a>}
                <div className="text-sm muted-text">{d.downloadCount || 0} downloads</div>
                <button onClick={() => handleDelete(d.id)} className="icon-action"><Trash className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDocuments;
