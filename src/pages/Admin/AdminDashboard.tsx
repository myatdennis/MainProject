import { ReactNode, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

// Module-level flag: persists across component unmount/remount cycles.
// AdminLayout keys <Outlet> on pathname, so the page component unmounts on
// every navigation.  A useRef(false) would reset to false on each remount and
// re-trigger the full-screen catalog loading gate on every revisit to this page.
let _dashboardCatalogEverSucceeded = false;
import { useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { ErrorBoundary } from '../../components/ErrorHandling';
import { logAuthRedirect } from '../../utils/logAuthRedirect';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import { courseStore } from '../../store/courseStore';
import { useAnalyticsDashboard } from '../../hooks/useAnalyticsDashboard';
import apiRequest from '../../utils/apiClient';
import { useRouteChangeReset } from '../../hooks/useRouteChangeReset';
import { useNavTrace } from '../../hooks/useNavTrace';
import {
  Users,
  Building2,
  Award,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  Clock,
  BarChart3,
  Download,
  Wand2,
  Layers,
  Rocket,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';

type ActivityEntry = {
  title: string;
  subtitle: string;
  icon: typeof CheckCircle2;
  tone: string;
};

type AlertEntry = {
  title: string;
  description: string;
  action: string;
  icon: typeof Clock;
  tone: string;
};

const builderHighlights = [
  {
    icon: Wand2,
    title: 'Visual authoring',
    description: 'Drag, reorder, and preview modules without leaving the page.',
  },
  {
    icon: Layers,
    title: 'Reusable templates',
    description: 'Start from scenario, micro-lesson, or workshop blueprints.',
  },
  {
    icon: Rocket,
    title: 'Instant launch',
    description: 'Publish to every organization (or pilot cohorts) in minutes.',
  },
];

const builderSnapshot = [
  { label: 'Active drafts', value: '6', helper: '2 updated this week' },
  { label: 'Ready templates', value: '4', helper: 'Scenario · Micro-lesson · Workshop · Quiz' },
  { label: 'Avg. publish time', value: '12 min', helper: 'From brief to announcement' },
];

/** Fallback rendered by per-widget ErrorBoundary — isolates one broken widget from the rest of the dashboard. */
const WidgetErrorFallback = ({ retry }: { error: Error; retry: () => void }) => (
  <div className="rounded-2xl border border-mist/60 bg-cloud px-6 py-5 text-sm text-ink/60 flex items-center justify-between gap-4">
    <span>This widget is temporarily unavailable.</span>
    <button
      onClick={retry}
      className="rounded-lg border border-mist px-3 py-1 text-xs font-semibold text-slate hover:bg-cloud/80 transition"
    >
      Retry
    </button>
  </div>
);

const AdminDashboard = () => {
  useNavTrace('AdminDashboard');
  const navigate = useNavigate();
  // routeKey increments on every pathname change — use as a dep in
  // useMemo/useEffect to get controlled resets without component remounts.
  const { routeKey } = useRouteChangeReset();
  const runtimeStatus = useRuntimeStatus();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastChecked = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';
  const [retrying, setRetrying] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);

  // useSyncExternalStore gives tear-free reads from the module-scope courseStore
  // singleton. It supersedes the old useState+subscribe pattern which could miss
  // a notification fired between the initial render and the subscribe() call.
  const catalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);

  // Fetch real admin activity feed from audit_logs
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest<{
          data: Array<{ id: string; action: string; details: Record<string, unknown>; createdAt: string; userEmail?: string; orgName?: string }>;
        }>('/api/admin/activity?limit=10');
        if (active && Array.isArray(res?.data) && res.data.length > 0) {
          const mapped: ActivityEntry[] = res.data.map((entry) => {
            const isWarning = entry.action?.includes('overdue') || entry.action?.includes('fail') || entry.action?.includes('error');
            const isMessage = entry.action?.includes('feedback') || entry.action?.includes('survey') || entry.action?.includes('comment');
            const isUser = entry.action?.includes('enroll') || entry.action?.includes('invite') || entry.action?.includes('register');
            const icon = isWarning ? AlertTriangle : isMessage ? MessageSquare : isUser ? Users : CheckCircle2;
            const tone = isWarning ? 'text-deepred' : isMessage ? 'text-sunrise' : isUser ? 'text-skyblue' : 'text-forest';
            const actorLabel = entry.userEmail ?? (entry.details?.email as string) ?? 'A user';
            const courseLabel = (entry.details?.courseTitle as string) ?? (entry.details?.title as string) ?? '';
            const actionLabel = entry.action?.replace(/_/g, ' ') ?? 'action';
            const title = courseLabel
              ? `${actorLabel} ${actionLabel} "${courseLabel}"`
              : `${actorLabel} ${actionLabel}`;
            const orgLabel = entry.orgName ?? (entry.details?.orgName as string) ?? '';
            const timeLabel = entry.createdAt
              ? new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '';
            return { title, subtitle: orgLabel ? `${orgLabel} · ${timeLabel}` : timeLabel, icon, tone };
          });
          setRecentActivity(mapped);
        }
      } catch {
        // Non-fatal — activity feed stays empty
      }
    })();
    return () => { active = false; };
  }, []);


  // Real analytics data
  const { data: analyticsData, loading: analyticsLoading } = useAnalyticsDashboard();
  const ov = analyticsData.overview;


  // Derive alerts from real analytics data
  useEffect(() => {
    if (analyticsLoading) return;
    const derived: AlertEntry[] = [];
    const overdueLearners = (analyticsData as any)?.overview?.overdueLearners ?? 0;
    if (overdueLearners > 0) {
      derived.push({
        title: `${overdueLearners} learner${overdueLearners !== 1 ? 's' : ''} have overdue modules`,
        description: 'Send reminder notifications to improve completion rates.',
        action: 'Send reminders',
        icon: Clock,
        tone: 'text-sunrise',
      });
    }
    const pendingOrgs = (analyticsData as any)?.overview?.pendingOrgs ?? 0;
    if (pendingOrgs > 0) {
      derived.push({
        title: `${pendingOrgs} organization${pendingOrgs !== 1 ? 's' : ''} pending approval`,
        description: 'Review and approve pending organization access requests.',
        action: 'Review requests',
        icon: Building2,
        tone: 'text-skyblue',
      });
    }
    if (analyticsData.courseDetail.length > 0) {
      derived.push({
        title: 'Analytics report ready',
        description: `${analyticsData.courseDetail.length} courses tracked. Export a CSV for detailed review.`,
        action: 'Download report',
        icon: BarChart3,
        tone: 'text-forest',
      });
    }
    setAlerts(derived);
  }, [analyticsLoading, analyticsData]);


  const stats = useMemo(() => [
    {
      label: 'Active learners',
      value: analyticsLoading ? '…' : (ov?.totalActiveLearners ?? 0).toLocaleString(),
      change: 'Total learners with course progress',
      icon: Users,
      accent: 'text-skyblue',
    },
    {
      label: 'Partner organizations',
      value: analyticsLoading ? '…' : (ov?.totalOrgs ?? 0).toLocaleString(),
      change: 'Active organizations on the platform',
      icon: Building2,
      accent: 'text-forest',
    },
    {
      label: 'Published courses',
      value: analyticsLoading ? '…' : (ov?.totalCourses ?? 0).toLocaleString(),
      change: 'Courses available to learners',
      icon: Award,
      accent: 'text-sunrise',
    },
    {
      label: 'Avg. completion rate',
      value: analyticsLoading ? '…' : `${Math.round(ov?.platformAvgCompletion ?? 0)}%`,
      change: `Avg. progress ${Math.round(ov?.platformAvgProgress ?? 0)}%`,
      icon: TrendingUp,
      accent: 'text-gold',
    },
  // routeKey: re-derive stat labels when we navigate back to the dashboard
  // so stale values from a prior visit don't persist.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ov, analyticsLoading, routeKey]);

  // Track whether the catalog has ever successfully loaded in this session.
  // CRITICAL: this flag must be module-level, NOT a useRef — a useRef resets to
  // false every time this page component unmounts and remounts (which happens on
  // every route change because AdminLayout keys Outlet on pathname).  A module-
  // level variable persists across remounts, ensuring the "first load" gate only
  // fires ONCE per browser session, not on every navigation to this page.
  useEffect(() => {
    if (catalogState.adminLoadStatus === 'success') {
      _dashboardCatalogEverSucceeded = true;
    }
  }, [catalogState.adminLoadStatus]);

  useEffect(() => {
    if (catalogState.phase !== 'idle') {
      return;
    }
    (async () => {
      try {
        console.debug('[COURSE INIT CALLER]', {
          source: 'AdminDashboard.tsx',
          phase: catalogState.phase,
          pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
          ts: Date.now(),
        });
        await courseStore.init();
      } catch (error) {
        console.error('[AdminDashboard] Failed to bootstrap admin catalog', error);
      }
    })();
  }, [catalogState.phase]);

  const handleRetry = useCallback(async () => {
    if (catalogState.phase === 'loading' || retrying) {
      return;
    }
    setRetrying(true);
    // Use forceInit to bypass the ready-guard and perform a fresh catalog fetch.
    try {
      await courseStore.forceInit();
    } catch (error) {
      console.error('[AdminDashboard] Admin catalog retry failed', error);
    } finally {
      setRetrying(false);
    }
  }, [catalogState.phase, retrying]);

  const handleCreateCourse = useCallback(() => {
    navigate('/admin/courses?create=1');
  }, [navigate]);

  const handleSwitchAccount = useCallback(() => {
    logAuthRedirect('AdminDashboard.switch_account', { path: '/admin/login' });
    navigate('/admin/login');
  }, [navigate]);

  const breadcrumbItems = useMemo(
    () => [
      { label: 'Admin', to: '/admin' },
      { label: 'Dashboard', to: '/admin/dashboard' },
    ],
    [],
  );

  const gateShell = useCallback(
    (content: ReactNode) => (
      <div className="container-page section">
        <Breadcrumbs items={breadcrumbItems} />
        <div className="mt-8">{content}</div>
      </div>
    ),
    [breadcrumbItems],
  );

  const catalogStatus = catalogState.adminLoadStatus;
  // Only block the dashboard with a full gate when:
  // 1. It's the very first load AND we're still loading (never had a success).
  // 2. The catalog hit a fatal auth/access error on the first load.
  // After the catalog ever succeeds, errors and retries must NEVER block the dashboard.
  const isFirstLoad = !_dashboardCatalogEverSucceeded;
  const isCatalogLoading = isFirstLoad && catalogState.phase === 'loading' && catalogStatus !== 'success';
  const isCatalogEmpty = isFirstLoad && catalogStatus === 'empty';
  const isCatalogUnauthorized = isFirstLoad && catalogStatus === 'unauthorized';
  // Only gate on error during the very first load. Subsequent errors show an inline banner instead.
  const isCatalogError = isFirstLoad && (catalogStatus === 'error' || catalogStatus === 'api_unreachable');
  // Show a non-blocking inline warning when there's a catalog error but we've had prior success.
  const showCatalogWarningBanner = !isFirstLoad && (catalogStatus === 'error' || catalogStatus === 'api_unreachable' || catalogStatus === 'unauthorized');
  const lastSyncAttempt = catalogState.lastAttemptAt ? new Date(catalogState.lastAttemptAt).toLocaleString() : null;

  const reportCsv = useMemo(() => {
    const header = ['Course Name,Completion Rate,Avg Learners,Avg Time (min)'];
    const rows = analyticsData.courseDetail.map((c) =>
      `${c.courseTitle},${Math.round(c.completionPercent ?? 0)}%,${c.totalLearners},${c.avgTimeMinutes ?? 0}`
    );
    return [...header, ...rows].join('\n');
  }, [analyticsData.courseDetail]);

  const handleExportReport = () => {
    const blob = new Blob([reportCsv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huddleco-admin-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  let gateContent: ReactNode | null = null;
  if (isCatalogLoading) {
    gateContent = (
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-mist/40 bg-white px-8 py-16 text-center shadow-card-sm">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-slate/80">Syncing the admin catalog&hellip;</p>
      </div>
    );
  } else if (isCatalogEmpty) {
    gateContent = (
      <div className="flex min-h-[50vh] flex-col justify-center">
        <EmptyState
          title="No courses yet"
          description="Create your first course to start building the catalog for your organization."
          action={
            <Button variant="primary" onClick={handleCreateCourse}>
              Create Course
            </Button>
          }
        />
      </div>
    );
  } else if (isCatalogUnauthorized) {
    gateContent = (
      <Card className="mx-auto max-w-3xl text-center">
        <div className="flex flex-col items-center gap-4 p-10">
          <ShieldCheck className="h-12 w-12 text-skyblue" />
          <h1 className="font-heading text-2xl text-charcoal">Admin access required</h1>
          <p className="max-w-xl text-sm text-slate/80">
            Your session is active, but this account doesn&apos;t have admin privileges yet. Switch to an admin account or
            contact support to request access.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSwitchAccount} isFullWidth>
              Switch account
            </Button>
            <Button variant="ghost" asChild isFullWidth>
              <a href="mailto:help@the-huddle.co?subject=Admin%20Access%20Request">Contact support</a>
            </Button>
          </div>
        </div>
      </Card>
    );
  } else if (isCatalogError) {
    const heading = catalogStatus === 'api_unreachable' ? 'Unable to reach admin services' : 'We couldn’t load the admin catalog';
    gateContent = (
      <Card className="mx-auto max-w-3xl text-center">
        <div className="flex flex-col items-center gap-4 p-10">
          <AlertTriangle className="h-12 w-12 text-deepred" />
          <h1 className="font-heading text-2xl text-charcoal">{heading}</h1>
          <p className="max-w-xl text-sm text-slate/80">
            {catalogState.lastError || 'Check your connection or try again in a moment. We paused the dashboard until the admin API responds.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleRetry} loading={retrying} isFullWidth>
              Retry sync
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin/courses')} isFullWidth>
              Go to courses
            </Button>
          </div>
          {lastSyncAttempt && (
            <p className="mt-4 text-xs text-slate/60">Last attempt: {lastSyncAttempt}</p>
          )}
        </div>
      </Card>
    );
  }

  if (gateContent) {
    return (
      <>
        <SEO title="Admin Dashboard" description="Monitor learner progress and organizational impact." />
        {gateShell(gateContent)}
      </>
    );
  }

  return (
    <>
      <SEO title="Admin Dashboard" description="Monitor learner progress and organizational impact." />
      {gateShell(
        <section className="space-y-10">
        {/* Non-blocking catalog warning — only shown after a prior success */}
        {showCatalogWarningBanner && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <div className="flex flex-1 flex-col gap-1">
              <span className="font-semibold">Course catalog temporarily unavailable</span>
              <span className="text-amber-800/80">
                {catalogStatus === 'unauthorized'
                  ? 'Admin course access requires re-authentication. Dashboard data is still available.'
                  : 'We could not refresh the course catalog. Showing the last known data while we retry.'}
                {lastSyncAttempt && ` Last attempt: ${lastSyncAttempt}.`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying || catalogState.phase === 'loading'}
              className="flex-shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}
        <Card tone="gradient" withBorder={false} className="overflow-hidden">
          <div className="relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between">
            <div>
              <Badge tone="info" className="bg-white/80 text-skyblue">
                Executive Overview
              </Badge>
              <h1 className="mt-4 font-heading text-3xl font-bold md:text-4xl">
                Track impact across every cohort and organization.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate/80">
                Review adoption, celebrate wins, and focus your facilitation where support is needed most.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Button size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />} onClick={() => navigate('/admin/analytics')}>
                View analytics
              </Button>
              <Button variant="ghost" size="sm" trailingIcon={<Download className="h-4 w-4" />} onClick={handleExportReport}>
                Export summary
              </Button>
            </div>
          </div>
        </Card>

        <Card
          tone="muted"
          className={`border ${supabaseReady ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {supabaseReady ? (
                <span className="rounded-xl bg-white/60 p-2 text-emerald-600 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>
              ) : (
                <span className="rounded-xl bg-white/60 p-2 text-amber-600 shadow-sm">
                  <WifiOff className="h-5 w-5" />
                </span>
              )}
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide">
                  {supabaseReady ? 'Secure mode connected' : runtimeStatus.demoModeEnabled ? 'Demo mode active' : 'Supabase connection degraded'}
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {supabaseReady
                    ? 'Realtime analytics, assignments, and builder autosave are fully online.'
                    : runtimeStatus.demoModeEnabled
                      ? 'Demo data is loaded locally. Assignments and analytics will sync after Supabase is re-enabled.'
                      : 'We are queueing edits locally until Supabase recovers. Monitor Sync Diagnostics if you continue publishing.'}
                </p>
                {!supabaseReady && runtimeStatus.lastError && (
                  <p className="mt-2 text-xs opacity-80">Last error: {runtimeStatus.lastError}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Badge
                tone="info"
                className={`${supabaseReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} uppercase tracking-wide`}
              >
                Status: {runtimeStatus.statusLabel}
              </Badge>
              <span className="text-xs opacity-80">Last health check {runtimeLastChecked}</span>
            </div>
          </div>
        </Card>

        <Card tone="muted" className="border border-mist/60 bg-gradient-to-br from-white to-cloud">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                Course Builder
              </Badge>
              <h2 className="mt-4 font-heading text-2xl font-semibold text-charcoal md:text-3xl">
                Design new learning journeys without leaving the dashboard.
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-slate/80">
                Launch the visual Course Builder to remix templates, drag-and-drop content, and publish to every organization in minutes.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {builderHighlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-mist/60 bg-white/70 p-4 shadow-card-sm">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cloud text-skyblue">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-heading text-sm font-semibold text-charcoal">{item.title}</p>
                          <p className="text-xs text-slate/70">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" trailingIcon={<ArrowUpRight className="h-4 w-4" />} onClick={() => navigate('/admin/course-builder/new')}>
                  Launch Course Builder
                </Button>
                <Button variant="ghost" size="lg" onClick={() => navigate('/admin/courses')}>
                  View drafts & templates
                </Button>
              </div>
            </div>
            <div className="rounded-3xl border border-mist/70 bg-white/80 p-6 shadow-card-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">Builder snapshot</p>
              <div className="mt-4 space-y-4">
                {builderSnapshot.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-mist/50 bg-cloud/60 px-4 py-3">
                    <p className="text-xs text-slate/70">{item.label}</p>
                    <p className="font-heading text-2xl font-semibold text-charcoal">{item.value}</p>
                    <p className="text-xs text-slate/60">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ErrorBoundary fallback={WidgetErrorFallback}>
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} tone="muted" className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate/70">{stat.label}</span>
                  <Icon className={`h-5 w-5 ${stat.accent}`} />
                </div>
                <p className="font-heading text-2xl font-bold text-charcoal">{stat.value}</p>
                <p className="text-xs text-slate/70">{stat.change}</p>
              </Card>
            );
          })}
          </ErrorBoundary>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ErrorBoundary fallback={WidgetErrorFallback}>
          <Card className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Recent activity</h2>
              <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />}>
                View all
              </Button>
            </div>
            <div className="space-y-4">
              {recentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-mist/60 bg-white px-4 py-3 shadow-card-sm">
                    <span className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-cloud ${item.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-heading text-sm font-semibold text-charcoal">{item.title}</p>
                      <p className="text-xs text-slate/70">{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          </ErrorBoundary>

          <ErrorBoundary fallback={WidgetErrorFallback}>
          <Card tone="muted" className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Alerts</h2>
            <div className="space-y-3">
              {alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div key={alert.title} className="rounded-2xl border border-mist/60 bg-white px-4 py-3 shadow-card-sm">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-cloud ${alert.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-heading text-sm font-semibold text-charcoal">{alert.title}</p>
                        <p className="text-xs text-slate/70">{alert.description}</p>
                        <Button variant="ghost" size="sm" className="mt-2 text-skyblue">
                          {alert.action}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          </ErrorBoundary>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ErrorBoundary fallback={WidgetErrorFallback}>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Top performing organizations</h2>
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                Completion benchmarks
              </Badge>
            </div>
            <div className="space-y-3">
              {analyticsLoading ? (
                <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
              ) : analyticsData.topOrgs.length === 0 ? (
                <p className="text-sm text-slate/60 py-2">No org data available yet.</p>
              ) : (
                analyticsData.topOrgs.slice(0, 5).map((org) => (
                  <div key={org.orgId} className="rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm">
                    <div className="flex items-center justify-between text-sm font-semibold text-charcoal">
                      <span>{org.orgName}</span>
                      <span>{Math.round(org.completionRate ?? 0)}%</span>
                    </div>
                    <ProgressBar value={Math.round(org.completionRate ?? 0)} className="mt-2" tone="info" srLabel={`${org.orgName} completion`} />
                    <p className="text-xs text-slate/70">{org.totalLearners.toLocaleString()} learners enrolled</p>
                  </div>
                ))
              )}
            </div>
          </Card>
          </ErrorBoundary>

          <ErrorBoundary fallback={WidgetErrorFallback}>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Course performance</h2>
              <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                onClick={() => navigate('/admin/courses')}>
                Manage curriculum
              </Button>
            </div>
            <div className="space-y-3">
              {analyticsLoading ? (
                <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
              ) : analyticsData.courseDetail.length === 0 ? (
                <p className="text-sm text-slate/60 py-2">No published course data available yet.</p>
              ) : (
                analyticsData.courseDetail.slice(0, 5).map((course) => (
                  <div key={course.courseId} className="rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm">
                    <div className="flex items-center justify-between text-sm font-semibold text-charcoal">
                      <span className="truncate max-w-[200px]">{course.courseTitle}</span>
                      <span>{Math.round(course.completionPercent ?? 0)}%</span>
                    </div>
                    <ProgressBar value={Math.round(course.completionPercent ?? 0)} className="mt-2" srLabel={`${course.courseTitle} completion`} />
                    <p className="text-xs text-slate/70">
                      {course.totalLearners.toLocaleString()} learners
                      {course.avgTimeMinutes ? ` · Avg. ${course.avgTimeMinutes} min` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
          </ErrorBoundary>
        </div>
        </section>,
      )}
    </>
  );
};

export default AdminDashboard;
