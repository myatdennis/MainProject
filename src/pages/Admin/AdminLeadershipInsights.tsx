import { useCallback, useEffect, useState } from 'react';
import { Brain, Target, Activity, Users, RefreshCcw, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useToast } from '../../context/ToastContext';
import { listOrgs, type Org } from '../../dal/orgs';
import leadershipDal, {
  type LeadershipHealthRecord,
  type LeadershipRecommendation,
  type LeadershipRecommendationStatus,
} from '../../dal/leadership';

const statusLabels: Record<LeadershipRecommendationStatus, string> = {
  open: 'Open',
  planned: 'Planned',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const priorityClasses: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const statusBadgeClasses: Record<LeadershipRecommendationStatus, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dismissed: 'bg-gray-100 text-gray-700 border-gray-200',
};

const formatPercent = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—';

const metricTiles = [
  { key: 'activeLearners', label: 'Active Learners', icon: Users, format: (v?: number) => v ?? 0 },
  { key: 'completionRate', label: 'Completion Rate', icon: CheckCircle2, format: formatPercent },
  { key: 'avgProgress', label: 'Avg Progress', icon: Target, format: formatPercent },
  { key: 'avgSurveyRating', label: 'Satisfaction', icon: Brain, format: (v?: number) => (v ? `${v.toFixed(2)}/5` : '—') },
  { key: 'worstDropoff', label: 'Worst Drop-off', icon: AlertTriangle, format: formatPercent },
  { key: 'overdueAssignments', label: 'Overdue Assignments', icon: Activity, format: (v?: number) => v ?? 0 },
];

const AdminLeadershipInsights = () => {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [healthRows, setHealthRows] = useState<LeadershipHealthRecord[]>([]);
  const [focusedHealth, setFocusedHealth] = useState<LeadershipHealthRecord | null>(null);
  const [recommendations, setRecommendations] = useState<LeadershipRecommendation[]>([]);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOrgInsights, setLoadingOrgInsights] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
  const [orgList, aggHealth] = await Promise.all([listOrgs(), leadershipDal.fetchHealth()]);
        setOrgs(orgList);
        setHealthRows(aggHealth);
        if (!selectedOrgId) {
          const defaultOrgId = orgList[0]?.id ?? aggHealth[0]?.orgId ?? '';
          if (defaultOrgId) {
            setSelectedOrgId(defaultOrgId);
          } else {
            setFocusedHealth(null);
          }
        }
      } catch (error) {
        console.error(error);
        showToast('Failed to load leadership insights.', 'error');
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [showToast]);

  const fetchOrgInsights = useCallback(
    async (orgId: string) => {
      if (!orgId) return;
      setLoadingOrgInsights(true);
      try {
  const [health] = await leadershipDal.fetchHealth(orgId);
        setFocusedHealth(health ?? null);
  const recs = await leadershipDal.fetchRecommendations(orgId);
        setRecommendations(recs);
      } catch (error) {
        console.error(error);
        showToast('Unable to load selected organization insights.', 'error');
      } finally {
        setLoadingOrgInsights(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (selectedOrgId) {
      void fetchOrgInsights(selectedOrgId);
    }
  }, [fetchOrgInsights, selectedOrgId]);

  const handleGenerate = async () => {
    if (!selectedOrgId) return;
    setGenerating(true);
    try {
      const response = await leadershipDal.generateRecommendations(selectedOrgId, {
        instructions: instructions.trim() || undefined,
      });
      const newItems = response.data ?? [];
      if (!newItems.length) {
        showToast('No new recommendations were generated.', 'info');
      } else {
        setRecommendations((prev) => [...newItems, ...prev]);
        showToast(`Added ${newItems.length} ${response.mode ?? 'new'} recommendation(s).`, 'success');
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to generate recommendations.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (recommendation: LeadershipRecommendation, status: LeadershipRecommendationStatus) => {
    setUpdatingId(recommendation.id);
    try {
      const resolutionNotes =
        status === 'resolved'
          ? window.prompt('Add resolution notes (optional)', recommendation.resolution_notes ?? '') ?? undefined
          : undefined;
  const updated = await leadershipDal.updateRecommendation(recommendation.id, {
        status,
        resolutionNotes,
      });
      setRecommendations((prev) => prev.map((rec) => (rec.id === updated.id ? updated : rec)));
      showToast(`Recommendation marked as ${statusLabels[status]}.`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to update recommendation.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const refreshOrg = () => {
    if (selectedOrgId) {
      void fetchOrgInsights(selectedOrgId);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Leadership AI', to: '/admin/leadership' }]} />
      </div>

      <div className="flex flex-col gap-3 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leadership AI Insights</h1>
            <p className="text-gray-600">Combine telemetry, surveys, and AI guidance to steer every organization.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select organization</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={refreshOrg}
              disabled={loadingOrgInsights}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loadingOrgInsights ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          Loading leadership data…
        </div>
      )}

      {!loading && focusedHealth && (
        <div className="mb-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metricTiles.slice(0, 3).map((tile) => {
              const Icon = tile.icon;
              return (
                <div key={tile.key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{tile.label}</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {tile.format((focusedHealth as any)[tile.key])}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-100 p-3">
                      <Icon className="h-5 w-5 text-indigo-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metricTiles.slice(3).map((tile) => {
              const Icon = tile.icon;
              return (
                <div key={tile.key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{tile.label}</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {tile.format((focusedHealth as any)[tile.key])}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-100 p-3">
                      <Icon className="h-5 w-5 text-indigo-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900">Leadership Recommendations</h2>
            </div>
            <div className="space-y-4">
              {recommendations.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                  No recommendations yet. Generate a bundle to get started.
                </div>
              )}
              {recommendations.map((rec) => (
                <div key={rec.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${priorityClasses[rec.priority] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {rec.priority?.toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses[rec.status]}`}>
                          {statusLabels[rec.status]}
                        </span>
                        {rec.generated_by === 'ai' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                            <Zap className="h-3 w-3" /> AI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                            Heuristic
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{rec.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{rec.summary}</p>
                      {rec.impact && <p className="mt-2 text-sm text-gray-500">Impact: {rec.impact}</p>}
                      {rec.tags && rec.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {rec.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-right">
                      <select
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        value={rec.status}
                        disabled={updatingId === rec.id}
                        onChange={(event) =>
                          handleStatusUpdate(rec, event.target.value as LeadershipRecommendationStatus)
                        }
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {rec.resolution_notes && (
                        <p className="text-xs text-gray-400">Last note: {rec.resolution_notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900">Generate AI Guidance</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Blend telemetry with AI nudges. Add optional context (goals, blockers, leadership themes) and we will
                generate up to 3 fresh insights.
              </p>
              <textarea
                rows={4}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Add extra context for AI (e.g., focus on retention + survey follow-through)."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !selectedOrgId}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Generate Recommendations'}
              </button>
              <p className="mt-3 text-xs text-gray-400">
                AI suggestions are stored with provenance so you can track what was auto-generated vs. heuristic signals.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && healthRows.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-gray-900">Organization Health Leaderboard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Active Learners</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Satisfaction</th>
                  <th className="px-4 py-3">Overdue</th>
                  <th className="px-4 py-3">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {healthRows.map((row) => (
                  <tr
                    key={row.orgId}
                    className={`border-t border-gray-100 ${row.orgId === selectedOrgId ? 'bg-indigo-50/50' : 'bg-white'}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3">{row.activeLearners}</td>
                    <td className="px-4 py-3">{formatPercent(row.completionRate)}</td>
                    <td className="px-4 py-3">{formatPercent(row.avgProgress)}</td>
                    <td className="px-4 py-3">{row.avgSurveyRating?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-3">{row.overdueAssignments}</td>
                    <td className="px-4 py-3">{formatPercent(row.worstDropoff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeadershipInsights;
