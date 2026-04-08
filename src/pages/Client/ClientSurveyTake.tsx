import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { fetchAssignedSurveysForLearner, saveLearnerSurveyProgress, submitLearnerSurveyResponse } from '../../dal/surveys';
import { getLearnerPortalBasePath } from '../../utils/learnerPortalPath';
import type { SurveyQuestion } from '../../types/survey';

const normalizeQuestions = (survey: any): SurveyQuestion[] => {
  if (!survey) return [];
  const fromSections = Array.isArray(survey.sections)
    ? survey.sections.flatMap((section: any) => (Array.isArray(section?.questions) ? section.questions : []))
    : [];
  const fromBlocks = Array.isArray(survey.blocks)
    ? survey.blocks.flatMap((block: any) => (Array.isArray(block?.questions) ? block.questions : []))
    : [];
  const merged = [...fromSections, ...fromBlocks].filter(Boolean);
  const seen = new Set<string>();
  return merged
    .filter((question: any) => {
      const id = typeof question?.id === 'string' ? question.id : null;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
};

const isAnswered = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return value !== null && value !== undefined;
};

const getEntrySurveyId = (entry: any): string | null =>
  entry?.survey?.id ?? entry?.assignment?.surveyId ?? entry?.assignment?.survey_id ?? null;

const ClientSurveyTake = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const portalPath = getLearnerPortalBasePath(location.pathname);
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const assignmentId = query.get('assignmentId') ?? query.get('assignment') ?? undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<any>(null);
  const [resolvedAssignmentId, setResolvedAssignmentId] = useState<string | undefined>(assignmentId);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!surveyId) {
      setError('Survey ID is required.');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    console.info('[learner-surveys] surveyOpenStarted', {
      route: location.pathname,
      surveyId,
      assignmentId: assignmentId ?? null,
    });
    fetchAssignedSurveysForLearner()
      .then((rows) => {
        if (!active) return;
        const matching = rows.filter((entry) => String(getEntrySurveyId(entry) ?? '') === String(surveyId));
        const selected =
          matching.find((entry) => (assignmentId ? String(entry.assignment?.id ?? '') === String(assignmentId) : true)) ??
          matching[0] ??
          null;
        if (!selected?.survey) {
          console.error('[learner-surveys] surveyOpenFailed', {
            surveyId,
            assignmentId: assignmentId ?? null,
            reason: 'survey_not_assigned_or_not_hydrated',
            matchedAssignmentCount: matching.length,
          });
          setError('This survey is not currently assigned to your account.');
          return;
        }
        setSurvey(selected.survey);
        setResolvedAssignmentId(selected.assignment?.id ?? assignmentId ?? undefined);
        const draftResponse =
          selected.assignment?.metadata && typeof selected.assignment.metadata === 'object'
            ? (selected.assignment.metadata as Record<string, unknown>).draft_response
            : null;
        const lastResponseStatus =
          selected.assignment?.metadata && typeof selected.assignment.metadata === 'object'
            ? (selected.assignment.metadata as Record<string, unknown>).last_response_status
            : null;
        if (draftResponse && typeof draftResponse === 'object') {
          setAnswers(draftResponse as Record<string, unknown>);
          console.info('[ClientSurveyTake] survey_progress_restored', {
            surveyId,
            assignmentId: selected.assignment?.id ?? null,
            restoredFieldCount: Object.keys(draftResponse as Record<string, unknown>).length,
          });
        }
        setSubmitted(selected.assignment?.status === 'completed' || lastResponseStatus === 'completed');
      })
      .catch((err) => {
        if (!active) return;
        console.error('[learner-surveys] surveyOpenFailed', {
          surveyId,
          assignmentId: assignmentId ?? null,
          reason: 'assigned_survey_fetch_failed',
          error: err instanceof Error ? err.message : String(err),
        });
        setError('Unable to load this survey right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [surveyId, assignmentId]);

  const questions = useMemo(() => normalizeQuestions(survey), [survey]);

  const onChangeValue = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const onToggleMultiValue = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = current.includes(option) ? current.filter((value) => value !== option) : [...current, option];
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!surveyId) return;
    const requiredQuestions = questions.filter((question) => Boolean(question.required));
    const missing = requiredQuestions.filter((question) => !isAnswered(answers[question.id]));
    if (missing.length > 0) {
      setValidationError('Please answer all required questions before submitting.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    console.info('[ClientSurveyTake] survey_submit_started', {
      surveyId,
      assignmentId: resolvedAssignmentId ?? null,
      answerCount: Object.keys(answers).length,
    });
    try {
      await submitLearnerSurveyResponse(surveyId, {
        assignmentId: resolvedAssignmentId,
        responses: answers,
        metadata: {
          source: 'learner_survey_take',
        },
      });
      console.info('[ClientSurveyTake] survey_submit_succeeded', {
        surveyId,
        assignmentId: resolvedAssignmentId ?? null,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('[ClientSurveyTake] submit failed', err);
      setValidationError('Unable to submit your survey right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!surveyId) return;
    setValidationError(null);
    setSaving(true);
    console.info('[ClientSurveyTake] survey_progress_save_started', {
      surveyId,
      assignmentId: resolvedAssignmentId ?? null,
      answerCount: Object.keys(answers).length,
    });
    try {
      await saveLearnerSurveyProgress(surveyId, {
        assignmentId: resolvedAssignmentId,
        responses: answers,
        metadata: {
          source: 'learner_survey_take',
        },
      });
      setValidationError('Progress saved. You can safely return and finish later.');
      console.info('[ClientSurveyTake] survey_progress_save_succeeded', {
        surveyId,
        assignmentId: resolvedAssignmentId ?? null,
      });
    } catch (err) {
      console.error('[ClientSurveyTake] save progress failed', err);
      setValidationError('Unable to save progress right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <LoadingSpinner size="lg" text="Loading survey…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <SEO title={survey?.title ? `${survey.title} | Survey` : 'Survey'} description="Complete your assigned survey." />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: `${portalPath}/dashboard` },
          { label: 'Surveys', to: `${portalPath}/surveys` },
          { label: submitted ? 'Submitted' : 'Take survey' },
        ]}
      />

      <Card tone="muted" padding="lg" className="space-y-3 border border-skyblue/10 bg-gradient-to-b from-white to-skyblue/5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-skyblue">Assigned Survey</p>
        <h1 className="font-heading text-3xl font-bold text-charcoal">{survey?.title ?? 'Survey'}</h1>
        {survey?.description && <p className="max-w-3xl text-base leading-8 text-slate/75">{survey.description}</p>}
      </Card>

      {error ? (
        <Card tone="muted" padding="lg" className="space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="ghost" asChild>
            <Link to={`${portalPath}/surveys`}>Back to surveys</Link>
          </Button>
        </Card>
      ) : submitted ? (
        <Card tone="muted" padding="lg" className="space-y-4 border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/60 text-center">
          <p className="text-base font-semibold text-charcoal">Thanks! Your survey has been submitted.</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" asChild>
              <Link to={`${portalPath}/surveys`}>Back to surveys</Link>
            </Button>
            <Button
              onClick={() =>
                navigate(
                  `${portalPath}/surveys/${surveyId}/results${resolvedAssignmentId ? `?assignmentId=${resolvedAssignmentId}` : ''}`,
                )
              }
            >
              View results
            </Button>
          </div>
        </Card>
      ) : (
        <Card tone="muted" padding="lg" className="space-y-6 border border-skyblue/10 bg-gradient-to-b from-white to-skyblue/5">
          {questions.length === 0 ? (
            <p className="text-sm text-slate/70">This survey does not have any configured questions yet.</p>
          ) : (
            questions.map((question, index) => {
              const value = answers[question.id];
              const options = Array.isArray(question.options) ? question.options : [];
              return (
                <div key={question.id} className="space-y-4 rounded-[24px] border border-slate/15 bg-white p-5 sm:p-6">
                  <p className="text-base font-semibold leading-8 text-charcoal">
                    {index + 1}. {question.title}
                    {question.required && <span className="ml-1 text-red-500">*</span>}
                  </p>
                  {question.description && <p className="text-sm leading-7 text-slate/70">{question.description}</p>}

                  {(question.type === 'single-select' || question.type === 'multiple-choice' || question.type === 'demographics') && (
                    <div className="space-y-2">
                      {options.map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm text-slate/80">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            checked={String(value ?? '') === option}
                            onChange={() => onChangeValue(question.id, option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  )}

                  {question.type === 'multi-select' && (
                    <div className="space-y-2">
                      {options.map((option) => {
                        const selected = Array.isArray(value) ? value.includes(option) : false;
                        return (
                          <label key={option} className="flex items-center gap-2 text-sm text-slate/80">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => onToggleMultiValue(question.id, option)}
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {(question.type === 'open-ended' || question.type === 'other-specify' || question.type === 'file-upload' || question.type === 'text') && (
                    <textarea
                      className="min-h-[140px] w-full rounded-[20px] border border-slate/15 px-4 py-3 text-base leading-7 shadow-sm focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/25"
                      rows={5}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(event) => onChangeValue(question.id, event.target.value)}
                      placeholder="Type your answer…"
                    />
                  )}

                  {(question.type === 'likert-scale' || question.type === 'nps' || question.type === 'slider') && (
                    <input
                      type="range"
                      min={question.scale?.min ?? (question.type === 'nps' ? 0 : 1)}
                      max={question.scale?.max ?? (question.type === 'nps' ? 10 : 5)}
                      step={1}
                      value={typeof value === 'number' ? value : question.scale?.min ?? 1}
                      onChange={(event) => onChangeValue(question.id, Number(event.target.value))}
                      className="w-full"
                    />
                  )}

                  {(question.type === 'matrix-likert' || question.type === 'matrix') && (
                    <div className="space-y-3">
                      {(question.matrixRows ?? []).map((rowLabel, rowIndex) => {
                        const matrixValue = value && typeof value === 'object' ? (value as Record<string, string>) : {};
                        return (
                          <div key={`${question.id}-row-${rowIndex}`} className="space-y-1">
                            <p className="text-xs font-medium text-slate/80">{rowLabel}</p>
                            <select
                              className="w-full rounded-lg border border-slate/20 p-2 text-sm"
                              value={matrixValue[rowLabel] ?? ''}
                              onChange={(event) => {
                                onChangeValue(question.id, {
                                  ...matrixValue,
                                  [rowLabel]: event.target.value,
                                });
                              }}
                            >
                              <option value="">Select…</option>
                              {(question.matrixColumns ?? options).map((column) => (
                                <option key={column} value={column}>
                                  {column}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.type === 'ranking' && (
                    <textarea
                      className="w-full rounded-lg border border-slate/20 p-2 text-sm"
                      rows={2}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(event) => onChangeValue(question.id, event.target.value)}
                      placeholder="Enter your ranking in order (e.g. Option A, Option B, Option C)"
                    />
                  )}
                </div>
              );
            })
          )}

          {validationError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {validationError}
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-mist/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="ghost" asChild>
              <Link to={`${portalPath}/surveys`}>Cancel</Link>
            </Button>
            <Button variant="ghost" onClick={handleSaveProgress} disabled={saving || submitting || questions.length === 0}>
              {saving ? 'Saving…' : 'Save progress'}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || saving || questions.length === 0}>
              {submitting ? 'Submitting…' : 'Submit survey'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ClientSurveyTake;
