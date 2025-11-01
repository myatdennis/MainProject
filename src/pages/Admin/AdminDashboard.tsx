import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
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

const AdminDashboard = () => {
  const navigate = useNavigate();

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
    </>
  );
};

export default AdminDashboard;
