import { Users, TrendingUp } from 'lucide-react';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import type { OrgGrowthMetrics } from '../../dal/growth';

export default function TeamGrowthCard({
  metrics,
  loading,
  message,
}: {
  metrics: OrgGrowthMetrics | null;
  loading?: boolean;
  message?: string | null;
}) {
  const engagementPct = Math.round(((metrics?.engagement_score ?? 0) / 3) * 100);
  const completionPct = Math.round((metrics?.completion_rate ?? 0) * 100);

  return (
    <Card className="mt-6 overflow-hidden" tone="muted">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">Your team’s growth</p>
          <h3 className="mt-2 font-heading text-xl font-semibold text-charcoal">
            {loading ? 'Loading…' : `${engagementPct}% engagement health`}
          </h3>
          <p className="mt-1 text-sm text-slate/70">
            Shared progress without rankings—built for psychological safety.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-mist bg-white p-3 shadow-card-sm">
            <Users className="h-5 w-5 text-skyblue" />
          </div>
          <div className="rounded-2xl border border-mist bg-white p-3 shadow-card-sm">
            <TrendingUp className="h-5 w-5 text-forest" />
          </div>
        </div>
      </div>

      {message && !loading ? (
        <div className="mt-5 rounded-2xl border border-dashed border-mist bg-white/70 p-4 text-sm text-slate/70">
          {message}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-mist/60 bg-white p-4">
          <p className="text-xs text-slate/70">Avg learning streak</p>
          <p className="mt-1 font-heading text-2xl font-bold text-charcoal">
            {loading ? '…' : `${Math.round(metrics?.avg_learning_streak ?? 0)}d`}
          </p>
        </div>
        <div className="rounded-2xl border border-mist/60 bg-white p-4">
          <p className="text-xs text-slate/70">Avg reflection streak</p>
          <p className="mt-1 font-heading text-2xl font-bold text-charcoal">
            {loading ? '…' : `${Math.round(metrics?.avg_reflection_streak ?? 0)}d`}
          </p>
        </div>
        <div className="rounded-2xl border border-mist/60 bg-white p-4">
          <p className="text-xs text-slate/70">Program completion</p>
          <p className="mt-1 font-heading text-2xl font-bold text-charcoal">{loading ? '…' : `${completionPct}%`}</p>
          <div className="mt-3">
            <ProgressBar value={completionPct} srLabel="Team completion" />
          </div>
        </div>
      </div>
      )}
    </Card>
  );
}
