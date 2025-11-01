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
    <div className="container">
      <h1 className="text-2xl font-bold text-neutral-text mb-4">Shared Documents</h1>
      <div className="flex flex-col gap-3">
        {docs.map(d => (
          <div key={d.id} className="doc-row">
            <div>
              <div className="font-medium text-primary">{d.name}</div>
              <div className="text-sm muted-text">{d.category} • {d.tags.join(', ')}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm muted-text">Downloads: {d.downloadCount || 0}</div>
              <div>
                {d.url ? (
                  <a onClick={() => documentService.recordDownload(d.id)} href={d.url} target="_blank" rel="noreferrer" className="text-primary font-medium underline">Open</a>
                ) : <span className="muted-text">No file</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentsPage;
