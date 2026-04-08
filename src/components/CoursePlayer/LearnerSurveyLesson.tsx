import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import type { SurveyQuestion } from '../../types/survey';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import cn from '../../utils/cn';
import {
  fetchAssignedSurveysForLearner,
  saveLearnerSurveyProgress,
  submitLearnerSurveyResponse,
} from '../../dal/surveys';

type LearnerSurveyLessonProps = {
  lessonId: string;
  lessonTitle: string;
  lessonDescription?: string;
  surveyId: string;
  onSubmitSuccess: () => Promise<void> | void;
};

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

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

const serializeAnswers = (value: Record<string, unknown>) => JSON.stringify(value ?? {});

const LearnerSurveyLesson = ({
  lessonId,
  lessonTitle,
  lessonDescription,
  surveyId,
  onSubmitSuccess,
}: LearnerSurveyLessonProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<any>(null);
  const [resolvedAssignmentId, setResolvedAssignmentId] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const syncedAnswersRef = useRef<string>(serializeAnswers({}));
  const latestAnswersRef = useRef<Record<string, unknown>>({});
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const queuedSaveRef = useRef<Record<string, unknown> | null>(null);
  const hydratedRef = useRef(false);

  const questions = useMemo(() => normalizeQuestions(survey), [survey]);
  const answeredCount = useMemo(
    () => questions.filter((question) => isAnswered(answers[question.id])).length,
    [answers, questions],
  );
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  useEffect(() => {
    if (!surveyId) {
      setError('A linked survey is required for this lesson.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setSaveError(null);
    setValidationError(null);
    hydratedRef.current = false;
    console.info('[learner-survey-lesson] surveyOpenStarted', {
      lessonId,
      surveyId,
    });

    fetchAssignedSurveysForLearner()
      .then((rows) => {
        if (!active) return;
        const selected =
          rows.find((entry) => String(getEntrySurveyId(entry) ?? '') === String(surveyId)) ?? null;
        if (!selected?.survey) {
          console.error('[learner-survey-lesson] surveyOpenFailed', {
            lessonId,
            surveyId,
            reason: 'survey_not_assigned_or_not_hydrated',
          });
          setError('This survey is not currently assigned to your account.');
          return;
        }

        const assignmentMetadata =
          selected.assignment?.metadata && typeof selected.assignment.metadata === 'object'
            ? (selected.assignment.metadata as Record<string, unknown>)
            : {};
        const restoredAnswers =
          assignmentMetadata.draft_response && typeof assignmentMetadata.draft_response === 'object'
            ? (assignmentMetadata.draft_response as Record<string, unknown>)
            : {};
        const lastResponseStatus = typeof assignmentMetadata.last_response_status === 'string'
          ? assignmentMetadata.last_response_status
          : null;
        const isSubmitted =
          selected.assignment?.status === 'completed' || lastResponseStatus === 'completed';

        setSurvey(selected.survey);
        setResolvedAssignmentId(selected.assignment?.id ?? undefined);
        setAnswers(restoredAnswers);
        latestAnswersRef.current = restoredAnswers;
        syncedAnswersRef.current = serializeAnswers(restoredAnswers);
        setSubmitted(isSubmitted);
        setLastSavedAt(
          typeof assignmentMetadata.last_progress_saved_at === 'string'
            ? assignmentMetadata.last_progress_saved_at
            : typeof assignmentMetadata.last_completed_at === 'string'
            ? assignmentMetadata.last_completed_at
            : null,
        );
      })
      .catch((fetchError) => {
        if (!active) return;
        console.error('[learner-survey-lesson] surveyOpenFailed', {
          lessonId,
          surveyId,
          reason: 'assigned_survey_fetch_failed',
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        setError('Unable to load this survey right now.');
      })
      .finally(() => {
        if (!active) return;
        hydratedRef.current = true;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lessonId, surveyId]);

  const persistAnswers = useCallback(
    async (nextAnswers: Record<string, unknown>, status: 'in-progress' | 'completed') => {
      const serialized = serializeAnswers(nextAnswers);
      if (inFlightRef.current) {
        queuedSaveRef.current = nextAnswers;
        return inFlightRef.current;
      }

      setSaveState('saving');
      setSaveError(null);

      const operation = (status === 'completed'
        ? submitLearnerSurveyResponse(surveyId, {
            assignmentId: resolvedAssignmentId,
            responses: nextAnswers,
            metadata: {
              source: 'learner_survey_lesson',
              lessonId,
            },
          })
        : saveLearnerSurveyProgress(surveyId, {
            assignmentId: resolvedAssignmentId,
            responses: nextAnswers,
            metadata: {
              source: 'learner_survey_lesson',
              lessonId,
            },
          }))
        .then(() => {
          syncedAnswersRef.current = serialized;
          const savedAt = new Date().toISOString();
          setLastSavedAt(savedAt);
          setSaveState('saved');
          console.info('[learner-survey-lesson] surveySaved', {
            lessonId,
            surveyId,
            status,
            responseSize: serialized.length,
          });
          return true;
        })
        .catch((persistError) => {
          console.error('[learner-survey-lesson] save failed', persistError);
          setSaveState('error');
          setSaveError(
            status === 'completed'
              ? 'Unable to submit your survey right now. Your answers are still on screen.'
              : 'Unable to save progress right now. Your answers are still on screen.',
          );
          return false;
        })
        .finally(() => {
          inFlightRef.current = null;
          if (queuedSaveRef.current && status !== 'completed') {
            const queuedAnswers = queuedSaveRef.current;
            queuedSaveRef.current = null;
            if (serializeAnswers(queuedAnswers) !== syncedAnswersRef.current) {
              void persistAnswers(queuedAnswers, 'in-progress');
            }
          }
        });

      inFlightRef.current = operation;
      return operation;
    },
    [lessonId, resolvedAssignmentId, surveyId],
  );

  useEffect(() => {
    if (!hydratedRef.current || submitted || loading) return;
    latestAnswersRef.current = answers;
    const serialized = serializeAnswers(answers);
    if (serialized === syncedAnswersRef.current) {
      if (saveState === 'unsaved') {
        setSaveState(lastSavedAt ? 'saved' : 'idle');
      }
      return;
    }

    setSaveState((current) => (current === 'saving' ? current : 'unsaved'));
    const timer = window.setTimeout(() => {
      void persistAnswers(latestAnswersRef.current, 'in-progress');
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [answers, lastSavedAt, loading, persistAnswers, saveState, submitted]);

  const onChangeValue = (questionId: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      latestAnswersRef.current = next;
      return next;
    });
    setValidationError(null);
  };

  const onToggleMultiValue = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = current.includes(option) ? current.filter((value) => value !== option) : [...current, option];
      latestAnswersRef.current = { ...prev, [questionId]: next };
      return latestAnswersRef.current;
    });
    setValidationError(null);
  };

  const handleSubmit = async () => {
    const requiredQuestions = questions.filter((question) => Boolean(question.required));
    const missing = requiredQuestions.filter((question) => !isAnswered(answers[question.id]));
    if (missing.length > 0) {
      setValidationError('Please answer all required questions before submitting.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    setAdvancing(false);

    if (inFlightRef.current) {
      await inFlightRef.current;
    }
    queuedSaveRef.current = null;

    const submitOk = await persistAnswers(latestAnswersRef.current, 'completed');
    if (!submitOk) {
      setSubmitting(false);
      return;
    }

    console.info('[learner-survey-lesson] surveySubmitted', {
      lessonId,
      surveyId,
      answerCount: Object.keys(latestAnswersRef.current).length,
    });
    setSubmitted(true);
    try {
      setAdvancing(true);
      await onSubmitSuccess();
    } catch (advanceError) {
      console.error('[learner-survey-lesson] post-submit completion failed', advanceError);
      setSaveError('Your survey was submitted, but we could not update lesson progress. Please continue manually.');
      setSaveState('error');
    } finally {
      setAdvancing(false);
      setSubmitting(false);
    }
  };

  const handleManualSave = async () => {
    setValidationError(null);
    await persistAnswers(latestAnswersRef.current, 'in-progress');
  };

  const statusLabel =
    loading
      ? 'Loading survey…'
      : saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
      ? `Saved${lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : saveState === 'error'
      ? saveError || 'Save failed'
      : saveState === 'unsaved'
      ? 'Unsaved changes'
      : submitted
      ? 'Submitted'
      : 'Ready';

  if (loading) {
    return (
      <Card tone="muted" className="mt-8 border border-skyblue/10 p-8 sm:p-10">
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-skyblue" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card tone="muted" className="mt-8 border border-red-200 p-8 sm:p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-600">Survey unavailable</p>
            <h3 className="font-heading text-2xl font-bold text-charcoal">This survey could not be loaded.</h3>
            <p className="max-w-xl text-sm leading-7 text-slate/75">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (submitted && !advancing) {
    return (
      <Card tone="muted" className="mt-8 border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/60 p-8 sm:p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600">Survey submitted</p>
            <h3 className="font-heading text-3xl font-bold text-charcoal">Your response is saved.</h3>
            <p className="max-w-xl text-base leading-8 text-slate/75">
              Your survey was submitted successfully. You can continue with the course whenever you are ready.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card tone="muted" className="mt-8 border border-skyblue/15 bg-gradient-to-b from-white to-skyblue/5 p-5 sm:p-8 lg:p-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                Survey
              </Badge>
              <div className="space-y-2">
                <h2 className="font-heading text-3xl font-bold text-charcoal">{survey?.title ?? lessonTitle}</h2>
                {(survey?.description || lessonDescription) && (
                  <p className="max-w-2xl text-base leading-8 text-slate/75">{survey?.description ?? lessonDescription}</p>
                )}
              </div>
            </div>
            <div
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                saveState === 'saved' && 'bg-emerald-50 text-emerald-700',
                saveState === 'saving' && 'bg-skyblue/10 text-skyblue',
                saveState === 'error' && 'bg-red-50 text-red-700',
                saveState === 'unsaved' && 'bg-amber-50 text-amber-700',
                (saveState === 'idle' || loading || submitted) && 'bg-slate-100 text-slate-700',
              )}
              aria-live="polite"
            >
              {(saveState === 'saving' || advancing) && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
              {advancing ? 'Advancing…' : statusLabel}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate/70">
              <span>{answeredCount} of {questions.length} answered</span>
              <span>{progressPercent}% complete</span>
            </div>
            <ProgressBar value={progressPercent} className="h-2 bg-slate/10" />
          </div>
        </div>

        <div className="space-y-5">
          {questions.length === 0 ? (
            <Card tone="muted" className="rounded-[28px] border border-slate/15 bg-white/90 p-6">
              <p className="text-sm leading-7 text-slate/75">This survey does not have any configured questions yet.</p>
            </Card>
          ) : (
            questions.map((question, index) => {
              const value = answers[question.id];
              const options = Array.isArray(question.options) ? question.options : [];
              return (
                <Card key={question.id} tone="muted" className="rounded-[28px] border border-slate/15 bg-white/95 p-6 sm:p-7">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/55">Question {index + 1}</p>
                      <h3 className="text-xl font-semibold leading-9 text-charcoal">
                        {question.title}
                        {question.required && <span className="ml-1 text-red-500">*</span>}
                      </h3>
                      {question.description && <p className="text-sm leading-7 text-slate/70">{question.description}</p>}
                    </div>

                    {(question.type === 'single-select' || question.type === 'multiple-choice' || question.type === 'demographics') && (
                      <div className="space-y-3">
                        {options.map((option) => (
                          <label
                            key={option}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate/15 bg-white px-4 py-3 text-sm text-slate/85 transition hover:border-skyblue/35"
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              checked={String(value ?? '') === option}
                              onChange={() => onChangeValue(question.id, option)}
                              className="mt-1"
                            />
                            <span className="leading-6">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'multi-select' && (
                      <div className="space-y-3">
                        {options.map((option) => {
                          const selected = Array.isArray(value) ? value.includes(option) : false;
                          return (
                            <label
                              key={option}
                              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate/15 bg-white px-4 py-3 text-sm text-slate/85 transition hover:border-skyblue/35"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => onToggleMultiValue(question.id, option)}
                                className="mt-1"
                              />
                              <span className="leading-6">{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {(question.type === 'open-ended' || question.type === 'other-specify' || question.type === 'file-upload' || question.type === 'text') && (
                      <textarea
                        className="min-h-[160px] w-full rounded-[24px] border border-slate/15 bg-white px-5 py-4 text-base leading-7 text-charcoal shadow-sm transition focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/25"
                        rows={6}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) => onChangeValue(question.id, event.target.value)}
                        placeholder="Type your answer…"
                      />
                    )}

                    {(question.type === 'likert-scale' || question.type === 'nps' || question.type === 'slider') && (
                      <div className="space-y-3">
                        <input
                          type="range"
                          min={question.scale?.min ?? (question.type === 'nps' ? 0 : 1)}
                          max={question.scale?.max ?? (question.type === 'nps' ? 10 : 5)}
                          step={1}
                          value={typeof value === 'number' ? value : question.scale?.min ?? (question.type === 'nps' ? 0 : 1)}
                          onChange={(event) => onChangeValue(question.id, Number(event.target.value))}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between text-xs text-slate/60">
                          <span>{question.scale?.minLabel ?? 'Low'}</span>
                          <span className="font-semibold text-charcoal">{typeof value === 'number' ? value : 'Choose a value'}</span>
                          <span>{question.scale?.maxLabel ?? 'High'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {(validationError || saveError) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {validationError || saveError}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-mist/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate/70">
            Your progress saves automatically as you respond. Submit when you are ready to complete the lesson.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => void handleManualSave()}
              disabled={submitting || advancing || questions.length === 0}
              leadingIcon={<Save className="h-4 w-4" />}
            >
              Save progress
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || advancing || questions.length === 0}
              trailingIcon={(submitting || advancing) ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {submitting || advancing ? 'Submitting…' : 'Submit survey'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LearnerSurveyLesson;
