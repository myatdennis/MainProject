import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, UploadCloud, Trash } from 'lucide-react';
import documentService, { DocumentMeta, Visibility } from '../../services/documentService';
import notificationService from '../../services/notificationService';

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
    setDocs(list);
  };

  useEffect(() => { load(); }, []);

  const onFile = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    if (!file && !name) return alert('Provide a name or file');
    let url: string | undefined = undefined;
    const mime = file?.type;
    if (file) {
      // read as data URL for local dev
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
      fileType: mime,
      visibility,
      orgId: visibility === 'org' ? orgId : undefined,
      userId: visibility === 'user' ? userId : undefined,
      createdBy: 'Admin'
    }, file);

    // send a local notification to assigned org or user
    if (visibility === 'org' && orgId) {
      await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with your organization.`, orgId });
    }
    if (visibility === 'user' && userId) {
      await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with you.`, userId });
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Document Library</h1>
        <div className="flex items-center space-x-3">
          <FilePlus className="h-6 w-6 text-orange-500" />
          <span className="text-sm text-gray-600">Upload and manage documents</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subcategory</label>
            <input value={subcategory} onChange={e => setSubcategory(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Tags (comma separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Visibility</label>
            <select value={visibility} onChange={e => setVisibility(e.target.value as Visibility)} className="mt-1 block w-full border rounded-lg p-2">
              <option value="global">Global</option>
              <option value="org">Organization</option>
              <option value="user">User</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Org ID / User ID</label>
            <input placeholder="orgId or userId" value={visibility === 'org' ? orgId : userId} onChange={e => visibility === 'org' ? setOrgId(e.target.value) : setUserId(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
            <div className="border-dashed border-2 border-gray-200 rounded-lg p-6 text-center">
            <input ref={inputRef} type="file" onChange={e => onFile(e.target.files?.[0] || null)} className="hidden" />
            <div className="flex items-center justify-center space-x-3">
              <UploadCloud className="h-5 w-5 text-gray-400" />
              <button onClick={() => inputRef.current?.click()} className="text-sm text-orange-500">Choose file</button>
              <span className="text-sm text-gray-500">or drag and drop (not implemented)</span>
            </div>
            {file && <div className="mt-3 text-sm text-gray-700">Selected: {file.name} <button onClick={() => setFile(null)} className="ml-3 text-red-500">Remove</button></div>}
          </div>
        </div>

        <div className="mt-4 text-right">
          <button onClick={handleUpload} className="bg-gradient-to-r from-orange-400 to-red-500 text-white py-2 px-4 rounded-lg">Upload</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4">All Documents</h2>
        <div className="space-y-4">
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between border p-3 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{d.name}</div>
                <div className="text-sm text-gray-600">{d.category} • {d.subcategory} • {d.tags.join(', ')}</div>
                <div className="text-xs text-gray-500">{d.visibility}{d.orgId ? ` • org:${d.orgId}` : ''}{d.userId ? ` • user:${d.userId}` : ''}</div>
              </div>
              <div className="flex items-center space-x-3">
                {d.url && <a onClick={() => documentService.recordDownload(d.id)} href={d.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Open</a>}
                <div className="text-xs text-gray-500">{d.downloadCount || 0} downloads</div>
                <button onClick={() => handleDelete(d.id)} className="text-red-500"><Trash className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDocuments;
