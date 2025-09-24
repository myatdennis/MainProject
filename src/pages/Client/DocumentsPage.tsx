import React, { useEffect, useState } from 'react';
import documentService, { DocumentMeta } from '../../services/documentService';
import { useParams } from 'react-router-dom';

const DocumentsPage: React.FC = () => {
  const { orgId } = useParams();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);

  useEffect(() => {
    const load = async () => {
      const list = await documentService.listDocuments({ orgId });
      setDocs(list);
    };
    load();
  }, [orgId]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Shared Documents</h1>
      <div className="space-y-3">
        {docs.map(d => (
          <div key={d.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-sm text-gray-600">{d.category} • {d.tags.join(', ')}</div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-500">Downloads: {d.downloadCount || 0}</div>
              <div>
                {d.url ? (
                  <a onClick={() => documentService.recordDownload(d.id)} href={d.url} target="_blank" rel="noreferrer" className="text-blue-600">Open</a>
                ) : <span className="text-gray-500">No file</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentsPage;
