import React, { useEffect, useState } from 'react';
import documentService, { DocumentMeta } from '../../dal/documents';
import { useParams } from 'react-router-dom';
import useDocumentDownload from '../../hooks/useDocumentDownload';

const SecureDocumentAction: React.FC<{ document: DocumentMeta }> = ({ document }) => {
  const { download, isLoading, error } = useDocumentDownload(document);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={isLoading || !document}
        onClick={() => download()}
        className="text-primary font-medium underline disabled:cursor-not-allowed disabled:text-gray-400"
      >
        {isLoading ? 'Securing…' : 'Open'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
};

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
                  <SecureDocumentAction document={d} />
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
