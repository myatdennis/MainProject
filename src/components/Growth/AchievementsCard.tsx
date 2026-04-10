import { Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import cn from '../../utils/cn';
import type { GrowthAchievement } from '../../dal/growth';

const titleForAchievement = (type: string) => {
  switch (type) {
    case 'learning:first_lesson':
      return 'First Lesson Completed';
    case 'learning:first_course':
      return 'Completed First Course';
    case 'learning:consistent_7':
      return 'Consistent Learner (7 days)';
    case 'reflection:first_entry':
      return 'Thoughtful Contributor';
    case 'reflection:consistent_7':
      return 'Deep Reflector (7 days)';
    case 'leadership:first_scenario':
      return 'First Scenario Practice';
    case 'leadership:perspective_builder':
      return 'Perspective Builder';
    case 'leadership:inclusive_thinker':
      return 'Inclusive Thinker';
    default:
      return type.replace(/[:_]/g, ' ');
  }
};

const formatWhen = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function AchievementsCard({
  achievements,
  loading,
  href = '/lms/progress',
  className,
}: {
  achievements: GrowthAchievement[];
  loading?: boolean;
  href?: string;
  className?: string;
}) {
  const items = (achievements || []).slice(0, 5);

  return (
    <div className={cn('card-lg card-hover', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Achievements</p>
          <h3 className="mt-2 text-lg font-bold text-charcoal">Milestones that matter</h3>
          <p className="mt-1 text-sm text-slate/75">Recognition without rankings.</p>
        </div>
        <div className="rounded-2xl p-3 bg-white border border-mist shadow-card-sm">
          <Award className="h-5 w-5 text-sunrise" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-mist bg-softwhite p-4 text-sm text-slate/70">
            Loading achievements…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-mist bg-softwhite p-4 text-sm text-slate/70">
            Your first milestone will appear here after you complete a lesson, scenario, or reflection.
          </div>
        ) : (
          items.map((item) => (
            <div key={`${item.achievement_type}:${item.achieved_at}`} className="flex items-start justify-between gap-3 rounded-2xl border border-mist bg-white p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-charcoal">{titleForAchievement(item.achievement_type)}</p>
                <p className="mt-1 text-xs text-slate/60">{formatWhen(item.achieved_at)}</p>
              </div>
              <span className="rounded-full border border-mist bg-softwhite px-3 py-1 text-xs font-medium text-slate/70">
                Unlocked
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <Link to={href} className="inline-flex items-center gap-2 text-sm font-semibold text-skyblue hover:text-skyblue/80">
          View progress <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

