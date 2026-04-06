
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Video, Archive, Search, Filter, Calendar, Folder } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Button from '../../components/ui/Button';
import { useSecureAuth } from '../../context/SecureAuthContext';
import documentsDal, { type DocumentMeta } from '../../dal/documents';
import { useToast } from '../../context/ToastContext';

const LMSDownloads = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const { user, activeOrgId, sessionStatus, orgResolutionStatus } = useSecureAuth();
  const { showToast } = useToast();
  const awaitingAuth = sessionStatus !== 'authenticated';
  const awaitingOrgContext = !awaitingAuth && orgResolutionStatus !== 'ready';

  const loadDocuments = useCallback(async () => {
    if (sessionStatus !== 'authenticated' || orgResolutionStatus !== 'ready') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const docs = await documentsDal.listDocuments({
        organizationId: activeOrgId ?? undefined,
        userId: user?.id ?? undefined,
      });
      setDocuments(docs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load downloads.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, orgResolutionStatus, sessionStatus, user?.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const normalizeFileType = (doc: DocumentMeta) => {
    const explicit = doc.fileType ?? doc.metadata?.fileType;
    if (explicit) return `${explicit}`.toLowerCase();
    const filename = doc.filename ?? doc.name ?? '';
    const extMatch = filename.split('.').pop();
    return extMatch ? extMatch.toLowerCase() : 'file';
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || Number.isNaN(bytes)) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const resourceItems = useMemo(() =>
    documents.map((doc) => {
      const type = normalizeFileType(doc);
      const Icon = type === 'mp4' || type === 'mov' ? Video : type === 'zip' ? Archive : FileText;
      const color = type === 'mp4' || type === 'mov'
        ? 'text-blue-500'
        : type === 'zip'
          ? 'text-purple-500'
          : type === 'docx'
            ? 'text-green-500'
            : 'text-red-500';

      return {
        id: doc.id,
        title: doc.name,
        type: type.toUpperCase(),
        category: doc.category || 'General',
        size: formatFileSize(doc.fileSize),
        uploadDate: doc.createdAt,
        description: doc.metadata?.description ?? doc.metadata?.summary ?? 'Downloadable course resource.',
        icon: Icon,
        color,
        document: doc,
      };
    }),
  [documents]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    resourceItems.forEach((item) => unique.add(item.category));
    return ['All Modules', ...Array.from(unique).filter(Boolean)];
  }, [resourceItems]);

  const filteredResources = useMemo(() =>
    resourceItems.filter((resource) => {
      const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || resource.type.toLowerCase() === filterType.toLowerCase();
      const matchesCategory = activeCategory === 'all'
        || activeCategory === 'All Modules'
        || resource.category === activeCategory;
      return matchesSearch && matchesType && matchesCategory;
    }),
  [activeCategory, filterType, resourceItems, searchTerm]);

  const fullPackage = useMemo(
    () => resourceItems.find((item) => item.type.toLowerCase() === 'zip' || item.title.toLowerCase().includes('package')),
    [resourceItems],
  );

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (filteredResources.length === 0) {
      setSelectedItems([]);
      return;
    }
    if (selectedItems.length === filteredResources.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredResources.map(resource => resource.id));
    }
  };

  const handleDownload = useCallback(async (doc: DocumentMeta) => {
    if (!doc.id) return;
    setDownloadingIds((prev) => (prev.includes(doc.id) ? prev : [...prev, doc.id]));
    try {
      const refreshed = await documentsDal.recordDownload(doc.id);
      const url = refreshed?.url ?? doc.url;
      if (!url) {
        throw new Error('Download link not available yet.');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download document.';
      showToast(message, 'error');
    } finally {
      setDownloadingIds((prev) => prev.filter((id) => id !== doc.id));
    }
  }, [showToast]);

  const handleDownloadSelected = async () => {
    if (selectedItems.length === 0) return;
    setBulkDownloading(true);
    try {
      const docs = filteredResources
        .filter((resource) => selectedItems.includes(resource.id))
        .map((resource) => resource.document);
      await Promise.all(docs.map((doc) => handleDownload(doc)));
    } finally {
      setBulkDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFileTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'bg-red-100 text-red-800';
      case 'mp4':
        return 'bg-blue-100 text-blue-800';
      case 'docx':
        return 'bg-green-100 text-green-800';
      case 'zip':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-softwhite">
      <div className="container-page section">
        <Breadcrumbs items={[{ label: 'Downloads', to: '/lms/downloads' }]} />
        {/* Header */}
        <div className="mb-8">
          <h1 className="h1">Downloads</h1>
          <p className="lead">Access all your course materials, worksheets, and resources</p>
        </div>

        {isLoading && (
          <div className="mb-6 rounded-xl border border-cloud bg-white px-4 py-3 text-sm text-slate shadow-sm">
            Loading your downloads…
          </div>
        )}

        {loadError && !isLoading && (
          <div className="mb-6">
            <EmptyState
              title="Downloads unavailable"
              description={loadError}
              action={(
                <Button type="button" variant="outline" size="sm" onClick={() => void loadDocuments()}>
                  Retry
                </Button>
              )}
              illustrationSrc={undefined}
            />
          </div>
        )}

        {!isLoading && !loadError && awaitingAuth && (
          <div className="mb-6">
            <EmptyState
              title="Sign in to view downloads"
              description="Your resources are available once your learner session is active."
              action={<Button asChild size="sm"><a href="/login">Go to login</a></Button>}
            />
          </div>
        )}

        {!isLoading && !loadError && awaitingOrgContext && (
          <div className="mb-6">
            <EmptyState
              title="Preparing your workspace"
              description="We’re still resolving your organization context so we can show the right files."
              action={<Button variant="ghost" size="sm" onClick={() => void loadDocuments()}>Retry</Button>}
            />
          </div>
        )}

        {!awaitingAuth && !awaitingOrgContext && (
          <>

      {/* Search and Filter Bar */}
      <div className="card-lg card-hover mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-mist px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="pdf">PDF</option>
                <option value="mp4">Video</option>
                <option value="docx">Document</option>
                <option value="zip">Archive</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedItems.length > 0 && (
              <Button
                onClick={handleDownloadSelected}
                disabled={bulkDownloading}
                leadingIcon={<Download className="h-4 w-4" />}
                size="sm"
              >
                <Download className="h-4 w-4" />
                <span>{bulkDownloading ? 'Preparing downloads…' : `Download Selected (${selectedItems.length})`}</span>
              </Button>
            )}
            <button
              onClick={handleSelectAll}
              className="nav-link font-medium"
            >
              {filteredResources.length > 0 && selectedItems.length === filteredResources.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-8">
        <h2 className="h2 mb-4">Browse by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const categoryCount = category === 'All Modules'
              ? resourceItems.length
              : resourceItems.filter((r) => r.category === category).length;
            const isActive = activeCategory === category || (activeCategory === 'all' && category === 'All Modules');
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category === 'All Modules' ? 'all' : category)}
                className={`card-lg card-hover cursor-pointer text-left ${
                  isActive ? 'ring-2 ring-orange-400' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <Folder className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-charcoal">{category}</h3>
                    <p className="text-sm text-slate/80">{categoryCount} resources</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredResources.map((resource) => {
          const Icon = resource.icon;
          const isSelected = selectedItems.includes(resource.id);
          const isDownloading = downloadingIds.includes(resource.id);
          
          return (
            <div 
              key={resource.id} 
              className={`card-lg card-hover transition-all duration-200 ${
                isSelected ? 'ring-2 ring-orange-500' : ''
              }`}
            >
              <div className="">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(resource.id)}
                        className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-mist rounded"
                      />
                    </div>
                    <div className={`p-3 rounded-lg bg-white/50`}>
                      <Icon className={`h-6 w-6 ${resource.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-lg font-semibold text-charcoal mb-1">{resource.title}</h3>
                      <p className="text-sm text-slate/80 mb-2">{resource.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-slate/70">
                        <span className={`px-2 py-1 rounded-full font-medium ${getFileTypeColor(resource.type)}`}>
                          {resource.type}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(resource.uploadDate)}
                        </span>
                        <span>{resource.size}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate/80">
                    <span className="font-medium">Category:</span> {resource.category}
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleDownload(resource.document)}
                    disabled={isDownloading}
                    variant="outline"
                    size="sm"
                    leadingIcon={<Download className="h-4 w-4" />}
                  >
                    <span>{isDownloading ? 'Preparing…' : 'Download'}</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && filteredResources.length === 0 && !loadError && (
        <div className="mt-8">
          <EmptyState
            title="No resources found"
            description="Try adjusting your search or filter criteria."
            action={(
              <Button
                onClick={() => { setSearchTerm(''); setFilterType('all'); setSelectedItems([]); }}
                type="button"
                variant="outline"
                size="sm"
              >
                Reset filters
              </Button>
            )}
            illustrationSrc={undefined}
          />
        </div>
      )}

      {/* Quick Download Section */}
      <div className="mt-12 rounded-xl p-8" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--hud-blue) 10%, transparent), color-mix(in srgb, var(--hud-green) 10%, transparent))' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Everything at Once?</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Download our complete resource package containing all course materials, videos, and worksheets in one convenient ZIP file.
          </p>
          <Button
            type="button"
            onClick={() => fullPackage?.document && handleDownload(fullPackage.document)}
            disabled={!fullPackage}
            size="lg"
            leadingIcon={<Archive className="h-5 w-5" />}
            className="mx-auto"
          >
            <span>{fullPackage ? 'Download Complete Package' : 'Package not available yet'}</span>
          </Button>
        </div>
      </div>
      </>
      )}
      </div>
    </div>
  );
};

export default LMSDownloads;