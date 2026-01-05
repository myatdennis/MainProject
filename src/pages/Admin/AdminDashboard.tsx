import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
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

const stats = [
  {
    label: 'Active learners',
    value: '247',
    change: '+12% vs last month',
    icon: Users,
    accent: 'text-skyblue',
  },
  {
    label: 'Partner organizations',
    value: '18',
    change: '+2 newly onboarded',
    icon: Building2,
    accent: 'text-forest',
  },
  {
    label: 'Courses completed',
    value: '1,234',
    change: '+8% completion growth',
    icon: Award,
    accent: 'text-sunrise',
  },
  {
    label: 'Avg. completion rate',
    value: '87%',
    change: '-3% vs last month',
    icon: TrendingUp,
    accent: 'text-gold',
  },
];

const recentActivity = [
  {
    title: 'Sarah Chen completed “Foundations of Inclusive Leadership”',
    subtitle: 'Pacific Coast University · 2 hours ago',
    icon: CheckCircle2,
    tone: 'text-forest',
  },
  {
    title: 'Marcus Rodriguez enrolled in “Courageous Conversations”',
    subtitle: 'Mountain View High School · 4 hours ago',
    icon: Users,
    tone: 'text-skyblue',
  },
  {
    title: 'Jennifer Walsh submitted course feedback',
    subtitle: 'Community Impact Network · 6 hours ago',
    icon: MessageSquare,
    tone: 'text-sunrise',
  },
  {
    title: '15 learners overdue on “Recognizing Bias”',
    subtitle: 'Regional Fire Department · 1 day ago',
    icon: AlertTriangle,
    tone: 'text-deepred',
  },
];

const alerts = [
  {
    title: '15 learners have overdue modules',
    description: 'Send reminder notifications to improve completion rates.',
    action: 'Send reminders',
    icon: Clock,
    tone: 'text-sunrise',
  },
  {
    title: 'New organization pending approval',
    description: 'TechForward Solutions has requested access to the portal.',
    action: 'Review request',
    icon: Building2,
    tone: 'text-skyblue',
  },
  {
    title: 'Monthly report ready',
    description: 'February analytics report is available for download.',
    action: 'Download report',
    icon: BarChart3,
    tone: 'text-forest',
  },
];

const topPerformingOrgs = [
  { name: 'Pacific Coast University', completion: 94, learners: 45 },
  { name: 'Community Impact Network', completion: 91, learners: 28 },
  { name: 'Regional Medical Center', completion: 89, learners: 67 },
  { name: 'Mountain View High School', completion: 87, learners: 23 },
  { name: 'TechForward Solutions', completion: 85, learners: 34 },
];

const modulePerformance = [
  { name: 'Foundations of Inclusive Leadership', completion: 92, avgTime: '45 min' },
  { name: 'Empathy in Action', completion: 89, avgTime: '38 min' },
  { name: 'Courageous Conversations', completion: 84, avgTime: '52 min' },
  { name: 'Recognizing and Mitigating Bias', completion: 81, avgTime: '58 min' },
  { name: 'Personal & Team Action Planning', completion: 78, avgTime: '35 min' },
];

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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const runtimeStatus = useRuntimeStatus();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastChecked = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';

  const reportCsv = useMemo(() => {
    const header = ['Module Name,Completion Rate,Average Time'];
    const rows = modulePerformance.map((module) => `${module.name},${module.completion}%,${module.avgTime}`);
    return [...header, ...rows].join('\n');
  }, []);

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

  return (
    <>
      <SEO title="Admin Dashboard" description="Monitor learner progress and organizational impact." />
      <div className="container-page section">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Dashboard', to: '/admin/dashboard' }]} />
        <section className="space-y-10">
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
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Top performing organizations</h2>
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                Completion benchmarks
              </Badge>
            </div>
            <div className="space-y-3">
              {topPerformingOrgs.map((org) => (
                <div key={org.name} className="rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm">
                  <div className="flex items-center justify-between text-sm font-semibold text-charcoal">
                    <span>{org.name}</span>
                    <span>{org.completion}%</span>
                  </div>
                  <ProgressBar value={org.completion} className="mt-2" tone="info" srLabel={`${org.name} completion`} />
                  <p className="text-xs text-slate/70">{org.learners} learners enrolled</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Module performance</h2>
              <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                onClick={() => navigate('/admin/courses')}>
                Manage curriculum
              </Button>
            </div>
            <div className="space-y-3">
              {modulePerformance.map((module) => (
                <div key={module.name} className="rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm">
                  <div className="flex items-center justify-between text-sm font-semibold text-charcoal">
                    <span>{module.name}</span>
                    <span>{module.completion}%</span>
                  </div>
                  <ProgressBar value={module.completion} className="mt-2" srLabel={`${module.name} completion`} />
                  <p className="text-xs text-slate/70">Average time: {module.avgTime}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </section>
      </div>
    </>
  );
};

export default AdminDashboard;
