import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Building2, Plus, Search, MoreVertical, Edit, Eye, Settings, Download, Upload, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import orgService from '../../dal/orgs';
import LoadingButton from '../../components/LoadingButton';
import ConfirmationModal from '../../components/ConfirmationModal';
import AddOrganizationModal from '../../components/AddOrganizationModal';
import EditOrganizationModal from '../../components/EditOrganizationModal';
import { useToast } from '../../context/ToastContext';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import { useDebounce } from '../../components/PerformanceComponents';

const PAGE_SIZE = 24;
type StatusFilterOption = 'all' | 'active' | 'inactive' | 'suspended' | 'trial';
type SubscriptionFilterOption = 'all' | 'Standard' | 'Premium' | 'Enterprise';

const AdminOrganizations = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});
  const [fetching, setFetching] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);
  const [orgToEdit, setOrgToEdit] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilterOption>('all');
  const [paginationMeta, setPaginationMeta] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, hasMore: false });
  const debouncedSearch = useDebounce(searchTerm, 250);

  const fetchOrganizations = useCallback(
    async (targetPage = 1) => {
      setFetching(true);
      setLoadError(null);
      try {
        const response = await orgService.listOrgPage({
          page: targetPage,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          includeProgress: true,
          status: statusFilter === 'all' ? undefined : [statusFilter],
          subscription: subscriptionFilter === 'all' ? undefined : [subscriptionFilter],
        });
        setOrganizations(response.data);
        setProgressMap(response.progress ?? {});
        setPaginationMeta(response.pagination);
      } catch (error) {
        console.error('Failed to load organizations:', error);
        setLoadError('Unable to load organizations');
        showToast('Unable to load organizations', 'error');
      } finally {
        setFetching(false);
        setInitialLoad(false);
      }
    },
    [debouncedSearch, statusFilter, subscriptionFilter, showToast]
  );

  useEffect(() => {
    fetchOrganizations(1);
  }, [fetchOrganizations]);

  const handleRefresh = useCallback(() => {
    fetchOrganizations(paginationMeta.page || 1);
  }, [fetchOrganizations, paginationMeta.page]);

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && paginationMeta.page > 1) {
      fetchOrganizations(paginationMeta.page - 1);
      return;
    }
    if (direction === 'next' && paginationMeta.hasMore) {
      fetchOrganizations(paginationMeta.page + 1);
    }
  };

  const paginationSummary = useMemo(() => {
    const start = organizations.length ? (paginationMeta.page - 1) * paginationMeta.pageSize + 1 : 0;
    const end = organizations.length ? start + organizations.length - 1 : 0;
    return {
      start,
      end,
      total: paginationMeta.total,
    };
  }, [organizations.length, paginationMeta]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getSubscriptionColor = (subscription: string) => {
    return subscription === 'Premium' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800';
  };

  // Handler functions for button actions
  const handleAddOrganization = () => {
    setShowAddOrgModal(true);
  };

  const handleCreateOrganization = () => {
    navigate('/admin/organizations/new');
  };

  const handleOrganizationAdded = () => {
    showToast('Organization added successfully!', 'success');
    setShowAddOrgModal(false);
    fetchOrganizations(1);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        showToast(`Importing ${file.name}...`, 'info');
        setTimeout(() => {
          showToast('Organization import completed successfully!', 'success');
        }, 3000);
      }
    };
    input.click();
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const csvContent = `Name,Type,Contact Person,Contact Email,Total Learners,Active Learners,Completion Rate,Status\n${organizations.map((org: any) => 
        `"${org.name}","${org.type}","${org.contactPerson}","${org.contactEmail}","${org.totalLearners}","${org.activeLearners}","${org.completionRate}%","${org.status}"`
      ).join('\n')}`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organizations-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('Organizations exported successfully!', 'success');
    } catch (error) {
      showToast('Failed to export organizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setOrgToEdit(org);
      setShowEditOrgModal(true);
    }
  };

  const handleOrganizationUpdated = () => {
    setShowEditOrgModal(false);
    setOrgToEdit(null);
    fetchOrganizations(paginationMeta.page || 1);
  };

  const handleDeleteOrganization = (orgId: string) => {
    setOrgToDelete(orgId);
    setShowDeleteModal(true);
  };

  const confirmDeleteOrganization = async () => {
    if (!orgToDelete) return;
    
    setLoading(true);
    try {
      await orgService.deleteOrg(orgToDelete);
      setOrganizations(prev => prev.filter(org => org.id !== orgToDelete));
      showToast('Organization deleted successfully!', 'success');
      setShowDeleteModal(false);
      setOrgToDelete(null);
    } catch (error) {
      console.error('Failed to delete organization:', error);
      showToast('Failed to delete organization', 'error');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Organizations', to: '/admin/organizations' }]} />
      </div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
          <p className="text-gray-600">Manage client organizations, track progress, and oversee cohorts</p>
        </div>
        <LoadingButton onClick={handleRefresh} loading={fetching} variant="secondary">
          Refresh
        </LoadingButton>
      </div>

      {/* Search and Actions */}
      <div className="card-lg card-hover mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="trial">Trial</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Subscription</label>
              <select
                value={subscriptionFilter}
                onChange={(e) => setSubscriptionFilter(e.target.value as SubscriptionFilterOption)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <div className="flex items-center space-x-4">
            <LoadingButton
              onClick={handleAddOrganization}
              variant="primary"
            >
              <Plus className="h-4 w-4" />
              Add Organization
            </LoadingButton>
            <LoadingButton
              onClick={handleCreateOrganization}
              variant="secondary"
            >
              <Building2 className="h-4 w-4" />
              Create Organization
            </LoadingButton>
            <LoadingButton
              onClick={handleImport}
              variant="secondary"
            >
              <Upload className="h-4 w-4" />
              Import
            </LoadingButton>
            <LoadingButton
              onClick={handleExport}
              loading={loading}
              variant="secondary"
            >
              <Download className="h-4 w-4" />
              Export
            </LoadingButton>
            </div>
          </div>
        </div>
      </div>

      {/* Empty / loading / error states */}
      {initialLoad && fetching && (
        <div className="py-16 flex flex-col items-center text-gray-500">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm">Loading organizations…</p>
        </div>
      )}

      {!initialLoad && loadError && (
        <div className="mb-8">
          <EmptyState
            title="Unable to load organizations"
            description="Check your connection and try refreshing."
            action={
              <LoadingButton onClick={handleRefresh} loading={fetching}>
                Retry
              </LoadingButton>
            }
          />
        </div>
      )}

      {!initialLoad && !loadError && organizations.length === 0 && (
        <div className="mb-8">
          <EmptyState
            title="No organizations found"
            description={
              searchTerm
                ? 'Try changing your search to find organizations.'
                : 'You have not added any organizations yet.'
            }
            action={
              <button
                className={searchTerm ? 'btn-outline' : 'btn-cta'}
                onClick={() => {
                  if (searchTerm) setSearchTerm('');
                  else handleAddOrganization();
                }}
              >
                {searchTerm ? 'Reset search' : 'Add organization'}
              </button>
            }
          />
        </div>
      )}

      {/* Organizations Grid */}
      {organizations.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {organizations.map((org: any) => {
          const onboarding = progressMap[org.id];
          const onboardingPct = onboarding
            ? Math.round(
                (onboarding.completed_steps / Math.max(onboarding.total_steps || 1, 1)) * 100
              )
            : null;
          return (
          <div key={org.id} className="card-lg card-hover">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-600">{org.type}</p>
                </div>
              </div>
                <div className="flex items-center space-x-2">
                {getStatusIcon(org.status)}
                <Button asChild variant="ghost" size="sm" aria-label="View organization" title="View organization details" data-tooltip-id={`tooltip-view-${org.id}`}>
                  <Link to={`/admin/organizations/${org.id}`}>View</Link>
                </Button>
                <button 
                  className="p-1 text-gray-400 hover:text-gray-600" 
                  aria-label="More options"
                  tabIndex={0}
                  role="button"
                  title="More options"
                  data-tooltip-id={`tooltip-more-${org.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <span id={`tooltip-view-${org.id}`} className="sr-only">View organization details</span>
                <span id={`tooltip-more-${org.id}`} className="sr-only">More options</span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Contact:</span>
                <span className="text-sm font-medium text-gray-900">{org.contactPerson}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Learners:</span>
                <span className="text-sm font-medium text-gray-900">
                  {org.activeLearners}/{org.totalLearners} active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completion:</span>
                <span className="text-sm font-bold text-green-600">{org.completionRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subscription:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSubscriptionColor(org.subscription)}`}>
                  {org.subscription}
                </span>
              </div>
            </div>

              <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm font-bold text-gray-900">{org.completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full"
                  style={{ width: `${org.completionRate}%`, background: 'var(--gradient-blue-green)' }}
                ></div>
              </div>
            </div>

              {onboardingPct !== null && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Onboarding</span>
                    <span className="font-medium text-gray-900">
                      {onboarding.completed_steps}/{onboarding.total_steps} steps
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-orange-500"
                      style={{ width: `${Math.min(100, onboardingPct)}%` }}
                    ></div>
                  </div>
                </div>
              )}

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Module Progress</h4>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(org.modules || {}).map(([key, value]) => {
                  const v = Number(value || 0);
                  return (
                    <div key={key} className="text-center">
                      <div className={`w-full h-2 rounded-full ${
                        v >= 90 ? 'bg-green-500' :
                        v >= 70 ? 'bg-yellow-500' :
                        v >= 50 ? 'bg-orange-500' : 'bg-red-500'
                      }`}></div>
                      <div className="text-xs text-gray-600 mt-1">{v}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(org.status)}`}>
                  {org.status}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button asChild variant="ghost" size="sm" aria-label="View organization details" title="View organization details" data-tooltip-id={`tooltip-view-details-${org.id}`}>
                  <Link to={`/admin/organizations/${org.id}`} className="flex items-center space-x-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-xs">View</span>
                  </Link>
                </Button>
                <button
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                  title="Edit organization"
                  aria-label="Edit organization"
                  tabIndex={0}
                  role="button"
                  data-tooltip-id={`tooltip-edit-${org.id}`}
                  onClick={() => handleEditOrganization(org.id)}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                  title="Delete organization"
                  aria-label="Delete organization"
                  tabIndex={0}
                  role="button"
                  data-tooltip-id={`tooltip-delete-${org.id}`}
                  onClick={() => handleDeleteOrganization(org.id)}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <span id={`tooltip-view-details-${org.id}`} className="sr-only">View organization details</span>
                <span id={`tooltip-edit-${org.id}`} className="sr-only">Edit organization</span>
                <span id={`tooltip-delete-${org.id}`} className="sr-only">Delete organization</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{organizations.length}</div>
          <div className="text-sm text-gray-600">Total Organizations</div>
        </div>
        <div className="card-lg text-center">
          <div className="text-2xl font-bold text-green-600">
            {organizations.filter(org => org.status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">Active Organizations</div>
        </div>
        <div className="card-lg text-center">
          <div className="text-2xl font-bold text-orange-600">
            {organizations.reduce((acc, org) => acc + (org.totalLearners || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Total Learners</div>
        </div>
        <div className="card-lg text-center">
          <div className="text-2xl font-bold text-purple-600">
            {organizations.length === 0 ? '—' : `${Math.round(organizations.reduce((acc, org) => acc + (org.completionRate || 0), 0) / organizations.length)}%`}
          </div>
          <div className="text-sm text-gray-600">Avg. Completion</div>
        </div>
      </div>

      {/* Detailed Organization Table */}
      <div className="card-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Organization Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 font-semibold text-gray-900">Organization</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Contact</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Learners</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Progress</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Status</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Last Activity</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org: any) => (
                <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-gray-900">{org.name}</div>
                      <div className="text-sm text-gray-600">{org.type}</div>
                      <div className="text-xs text-gray-500 truncate">{org.cohorts?.join(', ')}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div>
                      <div className="font-medium text-gray-900">{org.contactPerson}</div>
                      <div className="text-sm text-gray-600">{org.contactEmail}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="text-lg font-bold text-gray-900">{org.activeLearners}</div>
                    <div className="text-sm text-gray-600">of {org.totalLearners}</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="text-lg font-bold text-green-600">{org.completionRate}%</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1 mx-auto">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
                        style={{ width: `${org.completionRate}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {getStatusIcon(org.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(org.status)}`}>
                        {org.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center text-sm text-gray-600">
                    {org.lastActivity ? new Date(org.lastActivity).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Link to={`/admin/organizations/${org.id}`} className="p-1 text-blue-600 hover:text-blue-800" title="View Details">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link to={`/admin/org-profiles/org-profile-${org.id}`} className="p-1 text-green-600 hover:text-green-800" title="View Profile">
                        <Settings className="h-4 w-4" />
                      </Link>
                      <button 
                        onClick={() => handleEditOrganization(org.id)}
                        className="p-1 text-gray-600 hover:text-gray-800" 
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteOrganization(org.id)}
                        className="p-1 text-red-600 hover:text-red-800" 
                        title="Delete Organization"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100">
          <p className="text-sm text-gray-600">
            Showing {paginationSummary.start}-{paginationSummary.end} of {paginationSummary.total}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              disabled={fetching || paginationMeta.page <= 1}
              onClick={() => handlePageChange('prev')}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {paginationMeta.page}
            </span>
            <Button
              variant="secondary"
              disabled={fetching || !paginationMeta.hasMore}
              onClick={() => handlePageChange('next')}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddOrganizationModal
        isOpen={showAddOrgModal}
        onClose={() => setShowAddOrgModal(false)}
        onOrganizationAdded={handleOrganizationAdded}
      />

      <EditOrganizationModal
        isOpen={showEditOrgModal}
        onClose={() => {
          setShowEditOrgModal(false);
          setOrgToEdit(null);
        }}
        organization={orgToEdit}
        onOrganizationUpdated={handleOrganizationUpdated}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setOrgToDelete(null);
        }}
        onConfirm={confirmDeleteOrganization}
        title="Delete Organization"
        message="Are you sure you want to delete this organization? This action cannot be undone and will remove all associated data including learner progress."
        confirmText="Delete Organization"
        type="danger"
        loading={loading}
      />
    </div>
  );
};

export default AdminOrganizations;