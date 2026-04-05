import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Activity } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { fetchLearnerSurveyResults } from '../../dal/surveys';

const ClientSurveyProgress = () => {
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

    let active = true;
    setLoading(true);
    setError(null);

    fetchLearnerSurveyResults(surveyId, assignmentId)
      .then((data) => {
        if (!active) return;
        setPayload(data);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[ClientSurveyProgress] load failed', err);
        setError('Unable to load your progress right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [surveyId, assignmentId]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <LoadingSpinner size="lg" text="Loading HDI progress…" />
      </div>
    );
  }

  const comparison = payload?.comparison;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <SEO title="HDI Progress" description="Track your HDI pre/post progress and growth recommendations." />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/client/dashboard' },
          { label: 'Surveys', to: '/client/surveys' },
          { label: 'Progress' },
        ]}
      />

      <Card tone="muted" padding="lg" className="flex flex-wrap items-start justify-between gap-4 border border-[#3A7FFF]/30">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal">HDI Progress</h1>
          <p className="text-sm text-slate/70">Compare pre/post movement and recommended growth focus.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to={`/client/surveys/${surveyId}/results${assignmentId ? `?assignmentId=${assignmentId}` : ''}`}>
              View report
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/client/surveys">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
        </div>
      </Card>

      {error ? (
        <Card tone="muted" padding="lg" className="text-sm text-red-600">{error}</Card>
      ) : !comparison ? (
        <Card tone="muted" padding="lg" className="text-sm text-slate/70">
          Complete both pre and post administrations to unlock progress analytics.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card tone="muted" padding="md" className="border border-[#FF8895]/30">
              <p className="text-sm text-slate/70">DO Delta</p>
              <p className="text-3xl font-bold text-charcoal">
                {comparison.doScoreDelta >= 0 ? '+' : ''}
                {comparison.doScoreDelta}
              </p>
            </Card>
            <Card tone="muted" padding="md" className="border border-[#2D9B66]/30">
              <p className="text-sm text-slate/70">Growth band</p>
              <p className="text-xl font-semibold text-charcoal">{comparison.growthBand}</p>
            </Card>
            <Card tone="muted" padding="md" className="border border-[#D72638]/30">
              <p className="text-sm text-slate/70">Stage movement</p>
              <p className="text-sm font-medium text-charcoal">{comparison.stageMovement?.summary ?? 'N/A'}</p>
            </Card>
          </div>

          <Card tone="muted" padding="lg" className="space-y-3 border border-[#3A7FFF]/30">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <p className="font-semibold text-charcoal">Dimension growth</p>
            </div>
            <div className="space-y-3">
              {(comparison.dimensionGrowth ?? []).map((entry: any) => (
                <div key={entry.stageKey}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-charcoal">{entry.stageLabel}</span>
                    <span className="text-slate/70">{entry.delta >= 0 ? '+' : ''}{entry.delta ?? 0}</span>
                  </div>
                  <div className="h-2 rounded-full bg-cloud">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, Math.abs((entry.delta ?? 0) * 10)))}%`,
                        backgroundColor: entry.delta >= 0 ? '#2D9B66' : '#D72638',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card tone="muted" padding="lg" className="space-y-2 border border-[#FF8895]/30">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <p className="font-semibold text-charcoal">Recommended focus</p>
            </div>
            <p className="text-sm text-slate/80">{comparison.recommendedFocus}</p>
            <p className="text-sm text-slate/80">{comparison.improvementSummary}</p>
          </Card>
        </>
      )}
    </div>
  );
};

export default ClientSurveyProgress;
