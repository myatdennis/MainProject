/**
 * AdminSurveys - Admin portal page for managing DEI surveys and analytics.
 * Uses shared UI components and accessibility best practices.
 * Features: survey queue, search/filter, bulk actions, modals, analytics, and summary stats.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter,
  BarChart3,
  Users,
  Eye,
  Edit,
  Copy,
  Play,
  Pause,
  Archive,
  Upload,
  CheckCircle,
  Clock,
  
  Target,
  TrendingUp,
  MessageSquare,
  Brain,
  Loader2,
  RefreshCcw,
  AlertTriangle
} from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useToast } from '../../context/ToastContext';
import EmptyState from '../../components/ui/EmptyState';
import SurveyQueueStatus from '../../components/Survey/SurveyQueueStatus';
import SurveyAssignmentModal from '../../components/Survey/SurveyAssignmentModal';
import type { Survey } from '../../types/survey';
import { listOrgs } from '../../dal/orgs';
import {
  listSurveys,
  saveSurvey as persistSurvey,
  getSurveyById,
  surveyQueueEvents,
  getQueueLength,
} from '../../dal/surveys';
import { useRouteChangeReset } from '../../hooks/useRouteChangeReset';
import useNavTrace from '../../hooks/useNavTrace';

type AdminSurveyCard = {
  id: string;
  title: string;
  description: string;
  status: string;
  type: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastActivity: string;
  totalResponses: number;
  totalInvites: number;
  completionRate: number;
  organizationIds: string[];
  assignedOrgs: string[];
};

const AdminSurveys = () => {
  const { routeKey } = useRouteChangeReset();
  useNavTrace('AdminSurveys');
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);
  const [surveys, setSurveys] = useState<AdminSurveyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [assignmentModal, setAssignmentModal] = useState<{
    surveyId: string;
    surveyTitle: string;
    organizationIds: string[];
  } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<string | null>(null);
  const [orgNameMap, setOrgNameMap] = useState<Map<string, string>>(new Map());  
  
  useEffect(() => {
    let cancelled = false;
    listOrgs()
      .then((orgs) => {
        if (cancelled) return;
        const next = new Map<string, string>();
        orgs.forEach((org) => {
          if (org?.id) {
            next.set(org.id, org.name ?? org.id);
          }
        });
        setOrgNameMap(next);
      })
      .catch((error) => {
        console.warn('[AdminSurveys] Failed to load organization names', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (orgNameMap.size === 0) return;
    setSurveys((prev) =>
      prev.map((survey) => ({
        ...survey,
        assignedOrgs: survey.organizationIds.map((orgId) => orgNameMap.get(orgId) ?? orgId),
      }))
    );
  }, [orgNameMap]);

  // Reset transient filter/selection state whenever the user navigates back to this page.
  useEffect(() => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterType('all');
    setSelectedSurveys([]);
  }, [routeKey]);

  const shapeSurveyRecord = useCallback(
    (record: Survey): AdminSurveyCard => {
      const organizationIds = record.assignedTo?.organizationIds ?? [];
      const assignedOrgs = organizationIds.map((orgId) => orgNameMap.get(orgId) ?? orgId);
      const metrics = (record as any).metrics ?? (record as any).analytics ?? {};
      const totalResponses =
        typeof (record as any).totalResponses === 'number'
          ? (record as any).totalResponses
          : typeof metrics.totalResponses === 'number'
          ? metrics.totalResponses
          : 0;
      const totalInvites =
        typeof (record as any).totalInvites === 'number'
          ? (record as any).totalInvites
          : typeof metrics.totalInvites === 'number'
          ? metrics.totalInvites
          : 0;
      const completionInput =
        typeof (record as any).completionRate === 'number'
          ? (record as any).completionRate
          : typeof metrics.completionRate === 'number'
          ? metrics.completionRate
          : totalInvites > 0
          ? Math.round((totalResponses / totalInvites) * 100)
          : 0;
      const timestamp = record.updatedAt || record.createdAt || new Date().toISOString();
      const parsed = new Date(timestamp as any);
      const lastActivity = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();

      return {
        id: record.id,
        title: record.title || 'Untitled Survey',
        description: record.description || '',
        status: record.status ?? 'draft',
        type: record.type ?? 'custom',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastActivity,
        totalResponses,
        totalInvites,
        completionRate: Number.isFinite(completionInput)
          ? Math.max(0, Math.min(100, Math.round(completionInput)))
          : 0,
        organizationIds,
        assignedOrgs,
      };
    },
    [orgNameMap]
  );

  const fetchSurveys = useCallback(
    async (options: { showLoader?: boolean } = {}) => {
      const { showLoader = false } = options;
      if (showLoader) setIsLoading(true);
      setIsRefreshing(true);
      setErrorMessage(null);
      try {
        const data = await listSurveys();
        setSurveys(data.map(shapeSurveyRecord));
      } catch (err) {
        console.warn('Failed to load surveys', err);
        const message = err instanceof Error ? err.message : 'Unable to load surveys';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [shapeSurveyRecord]
  );

  useEffect(() => {
    fetchSurveys({ showLoader: true });
  }, [fetchSurveys]);

  useEffect(() => {
    const updateTelemetry = () => {
      setQueueLength(getQueueLength());
    };
    updateTelemetry();
    surveyQueueEvents.addEventListener('queuechange', updateTelemetry);
    surveyQueueEvents.addEventListener('flush', updateTelemetry);
    return () => {
      surveyQueueEvents.removeEventListener('queuechange', updateTelemetry);
      surveyQueueEvents.removeEventListener('flush', updateTelemetry);
    };
  }, []);

  useEffect(() => {
    setSelectedSurveys((prev) => prev.filter((id) => surveys.some((survey) => survey.id === id)));
  }, [surveys]);

  const openAssignModal = (surveyId: string) => {
    const survey = surveys.find((entry) => entry.id === surveyId);
    if (!survey) return;
    setAssignmentModal({
      surveyId,
      surveyTitle: survey.title || 'Untitled Survey',
      organizationIds: survey.organizationIds ?? [],
    });
  };

  const closeAssignmentModal = () => {
    setAssignmentModal(null);
  };

  const handleAssignmentComplete = async () => {
    await fetchSurveys();
  };

  const navigate = useNavigate();

  const handleBulkActions = () => {
    if (selectedSurveys.length === 0) {
      showToast('Select at least one survey to perform bulk actions.', 'error');
      return;
    }
    navigate(`/admin/surveys/bulk?ids=${selectedSurveys.join(',')}`);
  };

  const handleAICreator = () => {
    navigate('/admin/surveys/builder?ai=1');
  };

  const handleImport = () => {
    navigate('/admin/surveys/import');
  };

  const handleQueue = () => {
    navigate('/admin/surveys/queue');
  };

  const duplicateSurvey = async (surveyId: string) => {
    setDuplicateTarget(surveyId);
    try {
      const existing = await getSurveyById(surveyId);
      if (!existing) {
        setErrorMessage('Survey not found for duplication');
        return;
      }
      const copy: Survey = {
        ...existing,
        id: `survey-${Date.now().toString(36)}`,
        title: `Copy of ${existing.title || 'Survey'}`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await persistSurvey(copy);
      setSurveys(prev => [shapeSurveyRecord(saved), ...prev]);
      navigate(`/admin/surveys/builder/${saved.id}`);
    } catch (err) {
      console.warn('Failed to duplicate survey', err);
      const message = err instanceof Error ? err.message : 'Unable to duplicate survey';
      setErrorMessage(message);
    } finally {
      setDuplicateTarget(null);
    }
  };

  const filteredSurveys = useMemo(() => {
    return surveys.filter(survey => {
      const matchesSearch = survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           survey.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || survey.status === filterStatus;
      const matchesType = filterType === 'all' || survey.type === filterType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [surveys, searchTerm, filterStatus, filterType]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'archived':
        return <Archive className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'climate-assessment':
        return 'bg-blue-100 text-blue-800';
      case 'inclusion-index':
        return 'bg-green-100 text-green-800';
      case 'equity-lens':
        return 'bg-orange-100 text-orange-800';
      case 'custom':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectSurvey = (surveyId: string) => {
    setSelectedSurveys(prev => 
      prev.includes(surveyId) 
        ? prev.filter(id => id !== surveyId)
        : [...prev, surveyId]
    );
  };

  // removed handleSelectAll (not used)

  return (
    <>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Surveys', to: '/admin/surveys' }]} />
      </div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">DEI Survey Platform</h1>
        <p className="text-gray-600">Create, manage, and analyze DEI surveys with advanced analytics and insights</p>
      </div>

      {errorMessage && (
        <div className="mb-6 flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">
              {errorMessage.toLowerCase().includes('administrator privileges required')
                ? 'Administrator privileges required.'
                : errorMessage}
            </p>
            <p className="text-xs text-red-600">
              Verify the admin API is running (or DEV_FALLBACK is enabled) and then refresh the surveys list.
            </p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Surveys</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {surveys.filter(s => s.status === 'active').length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <Target className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </div>
        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {surveys.reduce((acc, s) => acc + s.totalResponses, 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Completion</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Math.round(surveys.filter(s => s.totalInvites > 0).reduce((acc, s) => acc + s.completionRate, 0) / surveys.filter(s => s.totalInvites > 0).length) || 0}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50">
              <TrendingUp className="h-6 w-6 text-orange-500" />
            </div>
          </div>
        </div>
        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Set(surveys.flatMap(s => s.assignedOrgs)).size}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50">
              <Users className="h-6 w-6 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card-lg card-hover mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search surveys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="climate-assessment">Climate Assessment</option>
                <option value="inclusion-index">Inclusion Index</option>
                <option value="equity-lens">Equity Lens</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedSurveys.length > 0 && (
              <div className="flex items-center space-x-2">
                <button onClick={handleBulkActions} className="btn-outline">
                  Bulk Actions ({selectedSurveys.length})
                </button>
              </div>
            )}
            <button
              onClick={() => fetchSurveys()}
              className="btn-outline px-4 py-2 rounded-lg flex items-center space-x-2"
              disabled={isRefreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <button onClick={handleAICreator} className="btn-outline px-4 py-2 rounded-lg flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI Survey Creator</span>
            </button>
            <Link
              to="/admin/surveys/builder"
              className="btn-cta px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Survey</span>
            </Link>
            <button onClick={handleImport} className="btn-outline px-4 py-2 rounded-lg flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
            <button onClick={handleQueue} className="btn-outline px-4 py-2 rounded-lg flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>{queueLength > 0 ? `Queue (${queueLength})` : 'Queue'}</span>
            </button>
          </div>
          <div className="w-full pt-2">
            <SurveyQueueStatus variant="inline" showFlushButton={false} />
          </div>
        </div>
      </div>

      {/* Surveys Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {filteredSurveys.map((survey) => (
            <div
              key={survey.id}
              className="card-lg card-hover overflow-hidden"
              data-testid={`survey-card-${survey.id}`}
            >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{survey.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(survey.status)}`}>
                      {survey.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{survey.description}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(survey.type)}`}>
                    {survey.type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(survey.status)}
                  <input
                    type="checkbox"
                    checked={selectedSurveys.includes(survey.id)}
                    onChange={() => handleSelectSurvey(survey.id)}
                    className="h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]"
                  />
                </div>
              </div>

              {survey.status !== 'draft' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{survey.totalResponses}</div>
                    <div className="text-xs text-gray-600">Responses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{survey.completionRate}%</div>
                    <div className="text-xs text-gray-600">Completion</div>
                  </div>
                </div>
              )}

              {survey.status === 'active' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-medium text-gray-900">{survey.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full"
                      style={{ width: `${survey.completionRate}%`, background: 'var(--gradient-blue-green)' }}
                    ></div>
                  </div>
                </div>
              )}

              {survey.assignedOrgs.length === 0 && (
                <div className="mb-4">
                  <span className="text-xs text-red-500 italic">Not assigned</span>
                </div>
              )}

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Assigned Organizations:</div>
                <div className="flex flex-wrap gap-1">
                  {survey.assignedOrgs.length > 0 ? (
                    survey.assignedOrgs.map((org: string, index: number) => (
                      <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                        {org}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 italic">No assignments</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {survey.status === 'draft' ? 'Created' : 'Last activity'}: {new Date(survey.lastActivity).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg" 
                    title="AI Insights"
                  >
                    <Brain className="h-4 w-4" />
                  </button>
                  <Link 
                    to={`/admin/surveys/${survey.id}/analytics`}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" 
                    title="View Analytics"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => openAssignModal(survey.id)}
                    className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg"
                    title="Assign to Organizations"
                    data-testid={`survey-assign-${survey.id}`}
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <Link
                    to={`/admin/surveys/${survey.id}/preview`}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                    title="Preview Survey"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/admin/surveys/builder/${survey.id}`}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                    title="Edit Survey"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => duplicateSurvey(survey.id)}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                    title="Duplicate"
                    disabled={duplicateTarget === survey.id}
                  >
                    {duplicateTarget === survey.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          ))}
        </div>
      )}

      {!isLoading && filteredSurveys.length === 0 && (
        <div className="mb-8">
          <EmptyState
            title="No surveys found"
            description={searchTerm || filterStatus !== 'all' || filterType !== 'all' ? 'Try adjusting your search or filters to find surveys.' : 'Create your first survey to get started.'}
            action={
              searchTerm || filterStatus !== 'all' || filterType !== 'all' ? (
                <button className="btn-outline" onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterType('all'); }}>Reset filters</button>
              ) : (
                <Link to="/admin/surveys/builder" className="btn-cta">Create Your First Survey</Link>
              )
            }
          />
        </div>
      )}

      {/* Survey Templates Section */}
      <div className="rounded-xl p-8" style={{ background: 'var(--gradient-banner)' }}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Start with a Template</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Choose from our research-backed DEI survey templates designed by experts in organizational psychology and inclusive leadership.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-lg hover:shadow-md transition-shadow duration-200">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Climate Assessment</h3>
            <p className="text-gray-600 text-sm mb-4">Comprehensive workplace culture and belonging assessment</p>
            <Link
              to="/admin/surveys/builder?template=climate-assessment"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Use Template →
            </Link>
          </div>
          
          <div className="card-lg hover:shadow-md transition-shadow duration-200">
            <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Inclusion Index</h3>
            <p className="text-gray-600 text-sm mb-4">Measure inclusion across key dimensions with benchmarking</p>
            <Link
              to="/admin/surveys/builder?template=inclusion-index"
              className="text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Use Template →
            </Link>
          </div>
          
          <div className="card-lg hover:shadow-md transition-shadow duration-200">
            <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Equity Lens</h3>
            <p className="text-gray-600 text-sm mb-4">Evaluate organizational practices through an equity framework</p>
            <Link
              to="/admin/surveys/builder?template=equity-lens"
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              Use Template →
            </Link>
          </div>
        </div>
      </div>
      {/* Assign-to-Organization Modal (uses shared SurveyAssignmentModal) */}
      {assignmentModal && (
        <SurveyAssignmentModal
          isOpen={true}
          surveyId={assignmentModal.surveyId}
          surveyTitle={assignmentModal.surveyTitle}
          initialOrganizationIds={assignmentModal.organizationIds}
          onClose={closeAssignmentModal}
          onAssigned={handleAssignmentComplete}
        />
      )}
      </div>
    </>
  );
};

export default AdminSurveys;

// Assign Modal (rendered via state inside the component)
