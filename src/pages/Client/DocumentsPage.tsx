import React, { useEffect, useState } from 'react';
import documentService, { type DocumentMeta } from '../../dal/documents';
import useDocumentDownload from '../../hooks/useDocumentDownload';
import { useUserProfile } from '../../hooks/useUserProfile';

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
  const { user } = useUserProfile();
  const orgId = user?.organizationId ?? null;
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!orgId) {
        setDocs([]);
        setError('Join an organization to view shared documents.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const list = await documentService.listDocuments({ organizationId: orgId });
        setDocs(list);
      } catch (err) {
        setError('Unable to load documents right now.');
        setDocs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  return (
    <div className="container">
      <h1 className="text-2xl font-bold text-neutral-text mb-4">Shared Documents</h1>
      {loading ? (
        <p className="text-sm muted-text">Loading documents…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : docs.length === 0 ? (
        <p className="text-sm muted-text">No shared documents yet. Your facilitator will add resources soon.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((d) => (
            <div key={d.id} className="doc-row">
              <div>
                <div className="font-medium text-primary">{d.name}</div>
                <div className="text-sm muted-text">
                  {d.category} • {(d.tags ?? []).join(', ') || 'No tags'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm muted-text">Downloads: {d.downloadCount || 0}</div>
                <div>{d.url ? <SecureDocumentAction document={d} /> : <span className="muted-text">No file</span>}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
