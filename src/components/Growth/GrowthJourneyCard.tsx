import { Flame, TrendingUp } from 'lucide-react';
import cn from '../../utils/cn';
import type { GrowthInsightPayload } from '../../dal/growth';

type GrowthJourneyCardProps = {
  level: number;
  progressToNextLevel: number; // 0..1
  learningStreak: number;
  reflectionStreak: number;
  learningGraceDaysRemaining?: number;
  reflectionGraceDaysRemaining?: number;
  insights?: GrowthInsightPayload | null;
  loading?: boolean;
};

const percentLabel = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const Pill = ({
  icon,
  label,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  subtle?: boolean;
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
      subtle ? 'border-mist bg-softwhite text-slate/70' : 'border-mist bg-white text-charcoal',
    )}
  >
    {icon}
    {label}
  </span>
);

export default function GrowthJourneyCard({
  level,
  progressToNextLevel,
  learningStreak,
  reflectionStreak,
  learningGraceDaysRemaining = 2,
  reflectionGraceDaysRemaining = 2,
  insights,
  loading,
}: GrowthJourneyCardProps) {
  return (
    <div className="card-lg card-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Growth Journey</p>
          <h3 className="mt-2 text-lg font-bold text-charcoal">Level {loading ? '…' : level}</h3>
          <p className="mt-1 text-sm text-slate/75">
            {loading ? 'Tracking your growth…' : "You're making meaningful progress."}
          </p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--gradient-card)' }}>
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-medium text-slate/70">
          <span>To next level</span>
          <span>{loading ? '…' : percentLabel(progressToNextLevel)}</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-mist/60">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: loading ? '25%' : `${Math.round(Math.max(0, Math.min(1, progressToNextLevel)) * 100)}%`,
              backgroundImage: 'var(--gradient-blue-green)',
            }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Pill
          icon={<Flame className="h-4 w-4 text-sunrise" />}
          label={`${loading ? '…' : learningStreak} day learning streak`}
        />
        <Pill
          subtle
          icon={<span className="text-slate/60">Grace</span>}
          label={`${loading ? '…' : learningGraceDaysRemaining} day${learningGraceDaysRemaining === 1 ? '' : 's'}`}
        />
        <Pill
          icon={<span className="text-skyblue">✍︎</span>}
          label={`${loading ? '…' : reflectionStreak} reflection streak`}
        />
        <Pill
          subtle
          icon={<span className="text-slate/60">Grace</span>}
          label={`${loading ? '…' : reflectionGraceDaysRemaining} day${reflectionGraceDaysRemaining === 1 ? '' : 's'}`}
        />
      </div>

      {insights && !loading ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-mist bg-softwhite p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Your growth insights</p>
            <p className="mt-2 text-sm text-charcoal">{insights.message}</p>
            {insights.strengths?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate/75">
                {insights.strengths.slice(0, 2).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

