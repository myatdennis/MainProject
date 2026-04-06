import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
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
  const userId = user?.id ?? null;
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setDocs([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await documentService.listDocuments({
          organizationId: orgId ?? undefined,
          userId: userId ?? undefined,
        });
        setDocs(list);
      } catch (err) {
        setError('Unable to load documents right now.');
        setDocs([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orgId, userId]);

  const handleRetry = () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    documentService
      .listDocuments({ organizationId: orgId ?? undefined, userId: userId ?? undefined })
      .then((list) => setDocs(list))
      .catch(() => {
        setError('Unable to load documents right now.');
        setDocs([]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="container-page section">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/client/dashboard' },
          { label: 'Documents', to: '/client/documents' },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-charcoal">Shared documents</h1>
          <p className="mt-1 text-sm text-slate/75">Download files shared by your facilitators and organization admins.</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/client/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {!userId ? (
        <EmptyState
          title="Sign in to access documents"
          description="Your shared resources appear here when your learner session is active."
          action={<Button asChild size="sm"><a href="/login">Go to login</a></Button>}
        />
      ) : loading ? (
        <Card tone="muted" padding="lg" className="text-center">
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <LoadingSpinner size="md" />
            <p className="text-sm text-slate/70">Loading documents…</p>
          </div>
        </Card>
      ) : error ? (
        <EmptyState
          title="Documents unavailable"
          description={error}
          action={<Button variant="outline" size="sm" onClick={handleRetry}>Retry</Button>}
        />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No shared documents yet"
          description="Your facilitator will add resources here as your program progresses."
          action={<Button variant="ghost" size="sm" onClick={handleRetry}>Refresh</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((d) => (
            <Card key={d.id} padding="md" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-primary">{d.name}</div>
                <div className="text-sm muted-text">
                  {d.category} • {(d.tags ?? []).join(', ') || 'No tags'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm muted-text">Downloads: {d.downloadCount || 0}</div>
                <div>{d.id ? <SecureDocumentAction document={d} /> : <span className="muted-text">No file</span>}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
