import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, BarChart3, Sparkles, ArrowRight } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { fetchLearnerSurveyResults } from '../../dal/surveys';

const HDI_STAGE_ORDER = [
  { key: 'avoidance', label: 'Avoidance', color: '#D72638' },
  { key: 'polarization', label: 'Polarization', color: '#FF8895' },
  { key: 'minimization', label: 'Minimization', color: '#3A7FFF' },
  { key: 'acceptance', label: 'Acceptance', color: '#2D9B66' },
  { key: 'adaptation', label: 'Adaptation', color: '#3A7FFF' },
  { key: 'integration', label: 'Integration', color: '#2D9B66' },
];

const round = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
};

const ClientSurveyResults = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const location = useLocation();
  const assignmentId = useMemo(() => new URLSearchParams(location.search).get('assignmentId') ?? undefined, [location.search]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    if (!surveyId) {
      setError('Survey ID is required.');
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    fetchLearnerSurveyResults(surveyId, assignmentId)
      .then((data) => {
        if (!mounted) return;
        setPayload(data);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[ClientSurveyResults] load failed', err);
        setError('Unable to load your survey results right now.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [surveyId, assignmentId]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <LoadingSpinner size="lg" text="Loading your HDI results…" />
      </div>
    );
  }

  if (error || !payload?.latest) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <SEO title="Survey Results" description="View your latest survey insights." />
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/client/dashboard' },
            { label: 'Surveys', to: '/client/surveys' },
            { label: 'Results' },
          ]}
        />
        <Card tone="muted" padding="lg" className="space-y-3 text-center">
          <p className="text-sm text-slate/70">{error ?? 'No scored results are available yet for this survey.'}</p>
          <div className="flex justify-center">
            <Button variant="ghost" asChild>
              <Link to="/client/surveys">Back to surveys</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const latest = payload.latest;
  const scoring = latest.scoring ?? {};
  const report = latest.report ?? {};
  const profile = report.profile ?? latest.profile ?? {};
  const comparison = payload.comparison;

  const doScore =
    scoring?.developmentalOrientation?.score ??
    scoring?.doScore ??
    scoring?.overall?.rawAverage ??
    0;
  const markerPercent = Math.max(0, Math.min(100, ((Number(doScore) - 1) / 5) * 100));
  const stagePlacement = report.stagePlacement ?? {
    primaryStage: scoring?.developmentalOrientation?.primaryStage ?? scoring?.primaryStage ?? null,
    secondaryStage: scoring?.developmentalOrientation?.secondaryStage ?? scoring?.secondaryStage ?? null,
  };
  const normalizedScores = report.normalizedScores ?? scoring.normalizedScores ?? {};
  const stageRows = HDI_STAGE_ORDER.map((stage) => ({
    ...stage,
    value: round(normalizedScores?.[stage.key]),
  }));

  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const growthAreas = Array.isArray(report.growthAreas) ? report.growthAreas : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
  <SEO title="HDI Results" description="Review your personalized HDI assessment report and developmental orientation." />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/client/dashboard' },
          { label: 'Surveys', to: '/client/surveys' },
          { label: 'Results' },
        ]}
      />

      <Card tone="muted" padding="lg" className="flex flex-wrap items-start justify-between gap-4 border border-[#FF8895]/30">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal">Your HDI Results</h1>
          <p className="text-sm text-slate/70">
            A premium developmental report showing your placement on the HDI continuum.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/client/surveys">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to surveys
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/client/surveys/${surveyId}/progress?assignmentId=${assignmentId ?? ''}`}>
              View progress <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card tone="muted" padding="md" className="border border-[#3A7FFF]/30">
          <p className="text-sm text-slate/70">Developmental Orientation (DO)</p>
          <p className="text-3xl font-bold text-charcoal">{round(doScore)}</p>
          <p className="text-xs text-slate/70">Scale: 1.00 → 6.00</p>
        </Card>
        <Card tone="muted" padding="md" className="border border-[#D72638]/30">
          <p className="text-sm text-slate/70">Primary stage</p>
          <Badge tone="info">{stagePlacement?.primaryStage?.label ?? 'Unknown'}</Badge>
          {stagePlacement?.secondaryStage?.label && (
            <p className="text-xs text-slate/70 mt-2">Secondary: {stagePlacement.secondaryStage.label}</p>
          )}
        </Card>
        <Card tone="muted" padding="md" className="border border-[#2D9B66]/30">
          <p className="text-sm text-slate/70">Administration</p>
          <Badge tone="attention">{String(latest.administrationType ?? 'single').toUpperCase()}</Badge>
        </Card>
      </div>

      <Card tone="muted" padding="lg" className="space-y-3 border border-[#FF8895]/30">
        <p className="font-semibold text-charcoal">HDI Continuum</p>
        <div className="grid grid-cols-6 gap-1 text-[11px] text-center text-slate/70">
          {HDI_STAGE_ORDER.map((stage) => (
            <span key={stage.key}>{stage.label}</span>
          ))}
        </div>
        <div className="relative h-4 rounded-full overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-6 gap-0">
            {HDI_STAGE_ORDER.map((stage) => (
              <div key={stage.key} style={{ backgroundColor: stage.color }} className="opacity-90" />
            ))}
          </div>
          <div
            className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full border border-white shadow"
            style={{ left: `${markerPercent}%`, backgroundColor: '#111827' }}
            aria-label="Participant continuum marker"
          />
        </div>
      </Card>

      {comparison && (
        <Card tone="muted" padding="lg" className="space-y-2 border border-[#3A7FFF]/25">
          <div className="flex items-center gap-2 text-charcoal">
            <TrendingUp className="h-4 w-4" />
            <p className="font-semibold">Progress since pre-assessment</p>
          </div>
          <p className="text-sm text-slate/70">
            {comparison.doScoreDelta >= 0 ? '+' : ''}
            {comparison.doScoreDelta} DO ({comparison.growthBand}).
          </p>
          {comparison.stageMovement?.summary && (
            <p className="text-sm text-slate/70">{comparison.stageMovement.summary}</p>
          )}
        </Card>
      )}

      <Card tone="muted" padding="lg" className="space-y-3 border border-[#D72638]/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-skyblue" />
          <p className="font-semibold text-charcoal">Profile</p>
        </div>
        <p className="text-lg font-semibold text-charcoal">{profile?.name ?? 'HDI Participant'}</p>
        <p className="text-sm text-slate/80">{report?.summary ?? 'Your report is ready.'}</p>
        {profile?.coachingRecommendation && (
          <p className="text-sm text-slate/80">{profile.coachingRecommendation}</p>
        )}
        {profile?.nextAction && <p className="text-sm font-medium text-charcoal">Next step: {profile.nextAction}</p>}
      </Card>

      <Card tone="muted" padding="lg" className="space-y-4 border border-[#2D9B66]/30">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-skyblue" />
          <p className="font-semibold text-charcoal">Stage scores (normalized)</p>
        </div>
        <div className="space-y-3">
          {stageRows.map((stage) => (
            <div key={stage.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-charcoal">{stage.label}</span>
                <span className="text-slate/70">{stage.value}</span>
              </div>
              <div className="h-2 bg-cloud rounded-full">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, stage.value))}%`, backgroundColor: stage.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card tone="muted" padding="md" className="border border-[#3A7FFF]/30">
          <p className="font-semibold text-charcoal mb-2">Strengths</p>
          <ul className="text-sm text-slate/80 list-disc pl-5 space-y-1">
            {strengths.length ? (
              strengths.map((item: any, index: number) => <li key={`${item.stageKey}-${index}`}>{item.stageLabel}</li>)
            ) : (
              <li>Strengths will appear once your report is fully processed.</li>
            )}
          </ul>
        </Card>
        <Card tone="muted" padding="md" className="border border-[#FF8895]/30">
          <p className="font-semibold text-charcoal mb-2">Growth areas</p>
          <ul className="text-sm text-slate/80 list-disc pl-5 space-y-1">
            {growthAreas.length ? (
              growthAreas.map((item: any, index: number) => <li key={`${item.stageKey}-${index}`}>{item.stageLabel}</li>)
            ) : (
              <li>Growth recommendations will appear once your report is fully processed.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default ClientSurveyResults;
