import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { fetchLearnerSurveyResults } from '../../dal/surveys';

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
  const scoring = latest.scoring;
  const feedback = latest.feedback;
  const comparison = payload.comparison;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <SEO title="HDI Results" description="Review your personalized HDI assessment results and growth insights." />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/client/dashboard' },
          { label: 'Surveys', to: '/client/surveys' },
          { label: 'Results' },
        ]}
      />

      <Card tone="muted" padding="lg" className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal">Your HDI Results</h1>
          <p className="text-sm text-slate/70">
            A developmental snapshot of your intercultural growth, strengths, and next steps.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/client/surveys">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to surveys
          </Link>
        </Button>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card tone="muted" padding="md">
          <p className="text-sm text-slate/70">Overall score</p>
          <p className="text-3xl font-bold text-charcoal">{scoring?.overall?.normalizedScore ?? 0}</p>
        </Card>
        <Card tone="muted" padding="md">
          <p className="text-sm text-slate/70">Score band</p>
          <Badge tone="info">{scoring?.overall?.band ?? 'Unknown'}</Badge>
        </Card>
        <Card tone="muted" padding="md">
          <p className="text-sm text-slate/70">Administration</p>
          <Badge tone="attention">{String(latest.administrationType ?? 'single').toUpperCase()}</Badge>
        </Card>
      </div>

      {comparison && (
        <Card tone="muted" padding="lg" className="space-y-2">
          <div className="flex items-center gap-2 text-charcoal">
            <TrendingUp className="h-4 w-4" />
            <p className="font-semibold">Progress since pre-assessment</p>
          </div>
          <p className="text-sm text-slate/70">
            {comparison.deltaNormalized >= 0 ? '+' : ''}
            {comparison.deltaNormalized} points ({comparison.growthBand}).
          </p>
        </Card>
      )}

      <Card tone="muted" padding="lg" className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-skyblue" />
          <p className="font-semibold text-charcoal">Personalized summary</p>
        </div>
        <p className="text-sm text-slate/80">{feedback?.overallSummary}</p>
        <p className="text-sm text-slate/80">{feedback?.strengthsParagraph}</p>
        <p className="text-sm text-slate/80">{feedback?.growthAreasParagraph}</p>
        <p className="text-sm font-medium text-charcoal">Next step: {feedback?.practicalNextStep}</p>
      </Card>

      <Card tone="muted" padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-skyblue" />
          <p className="font-semibold text-charcoal">Dimension breakdown</p>
        </div>
        <div className="space-y-3">
          {(scoring?.dimensionScores ?? []).map((dimension: any) => (
            <div key={dimension.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-charcoal">{dimension.label}</span>
                <span className="text-slate/70">{dimension.normalizedScore}</span>
              </div>
              <div className="h-2 bg-cloud rounded-full">
                <div
                  className="h-2 rounded-full bg-skyblue"
                  style={{ width: `${Math.max(0, Math.min(100, dimension.normalizedScore))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ClientSurveyResults;
