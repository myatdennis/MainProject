import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';

type ReportRouteCard = {
  id: string;
  title: string;
  description: string;
  to: string;
  cta: string;
  status: 'live' | 'review';
  icon: typeof BarChart3;
  notes: string[];
};

const REPORT_ROUTES: ReportRouteCard[] = [
  {
    id: 'platform-analytics',
    title: 'Platform Analytics',
    description: 'Use the live analytics dashboard for completion, engagement, and adoption metrics.',
    to: '/admin/analytics',
    cta: 'Open analytics',
    status: 'live',
    icon: BarChart3,
    notes: [
      'Backed by live course, learner, and completion data.',
      'Best entry point for launch reviews and operational checks.',
    ],
  },
  {
    id: 'survey-results',
    title: 'Survey Results',
    description: 'Review survey response data, completion trends, and HDI analytics from the survey surfaces.',
    to: '/admin/surveys',
    cta: 'Open surveys',
    status: 'live',
    icon: ClipboardList,
    notes: [
      'Use individual survey analytics for cohort, participant, and pre/post comparisons.',
      'No synthetic numbers are shown here.',
    ],
  },
  {
    id: 'learner-operations',
    title: 'Learner Operations',
    description: 'Monitor user access, onboarding, and assignment coverage from the admin users surface.',
    to: '/admin/users',
    cta: 'Open users',
    status: 'live',
    icon: Users,
    notes: [
      'Useful for assignment verification and org-level access audits.',
      'Pairs with analytics when completion issues need user-level inspection.',
    ],
  },
  {
    id: 'documents-resources',
    title: 'Documents & Resources',
    description: 'Audit distributed resources, documents, and supporting materials from the admin documents area.',
    to: '/admin/documents',
    cta: 'Open documents',
    status: 'live',
    icon: FileText,
    notes: [
      'Use this to verify learner-facing collateral before launch.',
      'Supports org-scoped resource checks.',
    ],
  },
  {
    id: 'system-health',
    title: 'System Health',
    description: 'Validate deploy readiness, integrations, and operational checks from the health dashboard.',
    to: '/admin/health',
    cta: 'Open health',
    status: 'review',
    icon: ShieldCheck,
    notes: [
      'Use before launch or after deploys.',
      'Covers service readiness better than synthetic report summaries ever could.',
    ],
  },
  {
    id: 'workspace-review',
    title: 'Org Workspace Review',
    description: 'Inspect org-level execution details, planning artifacts, and action tracking in the workspace.',
    to: '/admin/org-workspace',
    cta: 'Open workspace',
    status: 'review',
    icon: Activity,
    notes: [
      'Useful for delivery reviews and client success follow-up.',
      'Use alongside survey and learner analytics for account-level reviews.',
    ],
  },
];

const STATUS_TONE: Record<ReportRouteCard['status'], 'positive' | 'info'> = {
  live: 'positive',
  review: 'info',
};

const STATUS_LABEL: Record<ReportRouteCard['status'], string> = {
  live: 'Live data',
  review: 'Operational review',
};

const AdminReports = () => {
  const { showToast } = useToast();

  const copyReportChecklist = async () => {
    const checklist = [
      '1. Review Platform Analytics for completion and engagement trends.',
      '2. Verify survey completion and response health in Admin Surveys.',
      '3. Audit user access and assignments in Admin Users.',
      '4. Confirm supporting resources in Admin Documents.',
      '5. Run launch checks in Admin Health.',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(checklist);
      showToast('Launch reporting checklist copied', 'success');
    } catch {
      showToast('Copy not supported on this device', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Reports', to: '/admin/reports' },
        ]}
      />

      <Card tone="gradient" withBorder={false}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-skyblue">Reporting hub</p>
            <h1 className="mt-2 font-heading text-3xl font-bold text-charcoal">Operational reporting without synthetic data</h1>
            <p className="mt-3 text-sm text-slate/80">
              This page now acts as a real reporting index. Use the live admin analytics, survey, user, document,
              workspace, and health surfaces below instead of relying on fabricated summary cards.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link to="/admin/analytics">Open Analytics</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={copyReportChecklist}>
              Copy review checklist
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {REPORT_ROUTES.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-skyblue/10 text-skyblue">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-lg font-semibold text-charcoal">{card.title}</h2>
                      <Badge tone={STATUS_TONE[card.status]}>{STATUS_LABEL[card.status]}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate/75">{card.description}</p>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-slate/80">
                {card.notes.map((note) => (
                  <li key={note} className="rounded-xl bg-cloud/60 px-3 py-2">
                    {note}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />}>
                  <Link to={card.to}>{card.cta}</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card tone="muted" className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Why this changed</h2>
        <p className="text-sm text-slate/80">
          The previous reports page displayed hardcoded totals, synthetic organizations, and fabricated engagement
          trends. That is unacceptable for production reporting. This replacement keeps the route useful while ensuring
          every reporting action takes you to a live data surface.
        </p>
      </Card>
    </div>
  );
};

export default AdminReports;
