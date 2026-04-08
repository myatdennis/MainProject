import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import cn from '../../utils/cn';
import { reflectionService } from '../../dal/reflections';
import {
  buildReflectionDraftStorageKey,
  createEmptyReflectionResponseData,
  normalizeGuidedReflectionConfig,
  normalizeReflectionResponseData,
  summarizeReflectionResponse,
  type ReflectionDraftPayload,
  type ReflectionResponseData,
} from '../../utils/reflectionFlow';

type GuidedReflectionFlowProps = {
  courseId: string;
  learnerId: string;
  lessonId: string;
  lessonTitle: string;
  lessonContent: Record<string, unknown>;
  required: boolean;
  onComplete: () => void;
};

type StepDefinition =
  | { id: 'intro'; title: string; subtitle: string }
  | { id: 'prompt'; title: string; subtitle: string }
  | { id: 'initial'; title: string; subtitle: string; field: 'promptResponse'; label: string; placeholder: string }
  | {
      id: 'deepen-1' | 'deepen-2' | 'deepen-3';
      title: string;
      subtitle: string;
      field: 'deeperReflection1' | 'deeperReflection2' | 'deeperReflection3';
      prompt: string;
      placeholder: string;
    }
  | { id: 'action'; title: string; subtitle: string; field: 'actionCommitment'; prompt: string; placeholder: string }
  | { id: 'review'; title: string; subtitle: string }
  | { id: 'confirmation'; title: string; subtitle: string };

const readDraft = (courseId: string, lessonId: string, learnerId: string): ReflectionDraftPayload | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildReflectionDraftStorageKey(courseId, lessonId, learnerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReflectionDraftPayload | { text?: string; updatedAt?: string } | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if ('data' in parsed && parsed.data && typeof parsed.data === 'object') {
      return {
        data: normalizeReflectionResponseData(parsed.data),
        currentStepId: typeof parsed.currentStepId === 'string' ? parsed.currentStepId : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        status: parsed.status === 'submitted' ? 'submitted' : 'draft',
      };
    }
    const legacyText = typeof parsed.text === 'string' ? parsed.text : '';
    if (!legacyText) return null;
    return {
      data: {
        ...createEmptyReflectionResponseData(),
        promptResponse: legacyText,
        currentStepId: 'initial',
      },
      currentStepId: 'initial',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      status: 'draft',
    };
  } catch {
    return null;
  }
};

const writeDraft = (
  courseId: string,
  lessonId: string,
  learnerId: string,
  payload: ReflectionDraftPayload,
) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      buildReflectionDraftStorageKey(courseId, lessonId, learnerId),
      JSON.stringify(payload),
    );
  } catch {
    // no-op
  }
};

const clearDraft = (courseId: string, lessonId: string, learnerId: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(buildReflectionDraftStorageKey(courseId, lessonId, learnerId));
  } catch {
    // no-op
  }
};

const GuidedReflectionFlow = ({
  courseId,
  learnerId,
  lessonId,
  lessonTitle,
  lessonContent,
  required,
  onComplete,
}: GuidedReflectionFlowProps) => {
  const config = useMemo(() => normalizeGuidedReflectionConfig(lessonContent), [lessonContent]);
  const deepenPrompts = useMemo(() => config.deepenPrompts.slice(0, 3), [config.deepenPrompts]);
  const baseSteps = useMemo<StepDefinition[]>(
    () => [
      { id: 'intro', title: 'Settle In', subtitle: config.introText },
      { id: 'prompt', title: 'Reflection Prompt', subtitle: config.thinkPrompt },
      {
        id: 'initial',
        title: 'Your Initial Thoughts',
        subtitle: 'Start with what feels most true right now.',
        field: 'promptResponse',
        label: 'Your initial thoughts',
        placeholder: 'Write your initial thoughts here…',
      },
      ...deepenPrompts.map((prompt, index) => ({
        id: `deepen-${index + 1}` as const,
        title: `Deepen Your Reflection`,
        subtitle: 'Stay curious. Let the next layer come into focus.',
        field: `deeperReflection${index + 1}` as const,
        prompt,
        placeholder: 'Write a deeper reflection here…',
      })),
      {
        id: 'action',
        title: 'Turn Insight Into Action',
        subtitle: 'Name one practical step you can carry forward.',
        field: 'actionCommitment',
        prompt: config.actionPrompt,
        placeholder: 'Describe one action you can take moving forward…',
      },
      { id: 'review', title: 'Review & Submit', subtitle: 'Look back over your reflection before you submit it.' },
      { id: 'confirmation', title: 'Reflection Saved', subtitle: config.confirmationMessage },
    ],
    [config.actionPrompt, config.confirmationMessage, config.introText, config.thinkPrompt, deepenPrompts],
  );

  const [reflectionData, setReflectionData] = useState<ReflectionResponseData>(createEmptyReflectionResponseData());
  const [currentStepId, setCurrentStepId] = useState<StepDefinition['id']>('intro');
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const hydratedRef = useRef(false);
  const syncedSerializedRef = useRef(JSON.stringify(createEmptyReflectionResponseData()));
  const latestDraftRef = useRef<ReflectionResponseData>(createEmptyReflectionResponseData());
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedSaveRef = useRef<{ data: ReflectionResponseData; status: 'draft' | 'submitted' } | null>(null);
  const lastInputEventRef = useRef<string | null>(null);

  const currentStepIndex = Math.max(0, baseSteps.findIndex((step) => step.id === currentStepId));
  const currentStep = baseSteps[currentStepIndex] ?? baseSteps[0];
  const reviewSections = useMemo(
    () => [
      { label: 'Prompt Response', value: reflectionData.promptResponse },
      ...deepenPrompts.map((prompt, index) => ({
        label: `Deeper Reflection ${index + 1}`,
        prompt,
        value: reflectionData[`deeperReflection${index + 1}` as keyof ReflectionResponseData] as string,
      })),
      { label: 'Action Commitment', value: reflectionData.actionCommitment },
    ],
    [deepenPrompts, reflectionData],
  );

  const canSubmit = !required || reflectionData.promptResponse.trim().length > 0;
  const completionReady =
    currentStepId === 'confirmation' || (!required || reflectionData.promptResponse.trim().length > 0);

  useEffect(() => {
    setLoading(true);
    setSaveState('idle');
    setSaveError(null);
    setLastSavedAt(null);
    setDraftRecovered(false);
    hydratedRef.current = false;
    syncedSerializedRef.current = JSON.stringify(createEmptyReflectionResponseData());
    latestDraftRef.current = createEmptyReflectionResponseData();

    let cancelled = false;
    reflectionService
      .fetchLearnerReflection(courseId, lessonId)
      .then((record) => {
        if (cancelled) return;
        const serverData = normalizeReflectionResponseData(
          record?.responseData ??
            (record?.responseText
              ? {
                  promptResponse: record.responseText,
                  currentStepId: 'initial',
                }
              : createEmptyReflectionResponseData()),
        );
        const draft = readDraft(courseId, lessonId, learnerId);
        const draftTime = draft?.updatedAt ? new Date(draft.updatedAt).getTime() : 0;
        const serverTime = record?.updatedAt ? new Date(record.updatedAt).getTime() : 0;
        const shouldPreferDraft = Boolean(draft) && draftTime >= serverTime;
        const nextData = shouldPreferDraft ? draft?.data ?? serverData : serverData;
        const nextStepId =
          (shouldPreferDraft ? draft?.currentStepId : serverData.currentStepId) ?? serverData.currentStepId ?? 'intro';

        setReflectionData(nextData);
        latestDraftRef.current = nextData;
        setCurrentStepId(
          baseSteps.some((step) => step.id === nextStepId) ? (nextStepId as StepDefinition['id']) : 'intro',
        );
        setDraftRecovered(Boolean(shouldPreferDraft && summarizeReflectionResponse(nextData).trim()));
        setLastSavedAt(record?.updatedAt ?? null);
        syncedSerializedRef.current = JSON.stringify(nextData);
        if (record?.status === 'submitted') {
          setCurrentStepId('confirmation');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[guided-reflection] reflection load failed', error);
      })
      .finally(() => {
        if (cancelled) return;
        hydratedRef.current = true;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseSteps, courseId, learnerId, lessonId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload: ReflectionDraftPayload = {
      data: { ...reflectionData, currentStepId },
      currentStepId,
      updatedAt: new Date().toISOString(),
      status: currentStepId === 'confirmation' ? 'submitted' : 'draft',
    };
    writeDraft(courseId, lessonId, learnerId, payload);
  }, [courseId, currentStepId, learnerId, lessonId, reflectionData]);

  const persistReflection = useCallback(
    async (data: ReflectionResponseData, status: 'draft' | 'submitted') => {
      const serialized = JSON.stringify(data);
      if (inFlightRef.current) {
        queuedSaveRef.current = { data, status };
        return inFlightRef.current;
      }

      const executeSave = async () => {
        setSaveState('saving');
        setSaveError(null);
        try {
          const saved = await reflectionService.saveLearnerReflection({
            courseId,
            lessonId,
            responseText: data.promptResponse,
            responseData: data,
            status,
          });
          const savedData = normalizeReflectionResponseData(saved?.responseData ?? data);
          syncedSerializedRef.current = JSON.stringify(savedData);
          setLastSavedAt(saved?.updatedAt ?? new Date().toISOString());
          console.info('[guided-reflection] reflectionSaved', {
            lessonId,
            status,
            responseSize: summarizeReflectionResponse(savedData).length,
          });
          if (JSON.stringify(latestDraftRef.current) === serialized || status === 'submitted') {
            setSaveState('saved');
          } else {
            setSaveState('unsaved');
          }
          if (status === 'submitted') {
            clearDraft(courseId, lessonId, learnerId);
          }
          return true;
        } catch (error) {
          console.warn('[guided-reflection] reflection save failed', error);
          setSaveState('error');
          setSaveError('Save failed. Your draft is still safe on this device.');
          return false;
        } finally {
          inFlightRef.current = null;
          if (queuedSaveRef.current) {
            const next = queuedSaveRef.current;
            queuedSaveRef.current = null;
            if (JSON.stringify(next.data) !== syncedSerializedRef.current || next.status === 'submitted') {
              void persistReflection(next.data, next.status);
            }
          }
        }
      };

      const promise = executeSave().then(() => undefined);
      inFlightRef.current = promise;
      return promise;
    },
    [courseId, learnerId, lessonId],
  );

  useEffect(() => {
    if (!hydratedRef.current || currentStepId === 'confirmation') return;
    latestDraftRef.current = reflectionData;
    const serialized = JSON.stringify(reflectionData);
    if (serialized === syncedSerializedRef.current) {
      if (saveState === 'unsaved') {
        setSaveState(lastSavedAt ? 'saved' : 'idle');
      }
      return;
    }

    setSaveState((current) => (current === 'saving' ? current : 'unsaved'));
    const timer = window.setTimeout(() => {
      void persistReflection({ ...latestDraftRef.current, currentStepId }, 'draft');
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [currentStepId, lastSavedAt, persistReflection, reflectionData, saveState]);

  useEffect(() => {
    if (!currentStep) return;
    console.info('[guided-reflection] reflectionStepViewed', {
      lessonId,
      stepId: currentStep.id,
      stepIndex: currentStepIndex + 1,
      stepCount: baseSteps.length,
    });
  }, [baseSteps.length, currentStep.id, currentStepIndex, lessonId]);

  const updateField = (field: keyof ReflectionResponseData, value: string) => {
    setReflectionData((prev) => {
      const next = { ...prev, [field]: value, currentStepId };
      latestDraftRef.current = next;
      return next;
    });
    const nextSignature = `${currentStepId}:${field}`;
    if (lastInputEventRef.current !== nextSignature) {
      lastInputEventRef.current = nextSignature;
      console.info('[guided-reflection] reflectionInputChanged', {
        lessonId,
        stepId: currentStepId,
        field,
      });
    }
  };

  const goToStep = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(baseSteps.length - 1, nextIndex));
    const nextStep = baseSteps[clamped];
    setCurrentStepId(nextStep.id);
    setReflectionData((prev) => ({ ...prev, currentStepId: nextStep.id }));
    console.info('[guided-reflection] reflectionStepCompleted', {
      lessonId,
      stepId: currentStep.id,
      nextStepId: nextStep.id,
    });
  };

  const handleSubmit = async () => {
    const submittedData = {
      ...reflectionData,
      currentStepId: 'review',
      submittedAt: new Date().toISOString(),
    };
    setReflectionData(submittedData);
    latestDraftRef.current = submittedData;
    const submitResult = await reflectionService.saveLearnerReflection({
      courseId,
      lessonId,
      responseText: submittedData.promptResponse,
      responseData: submittedData,
      status: 'submitted',
    }).then((saved) => {
      const savedData = normalizeReflectionResponseData(saved?.responseData ?? submittedData);
      syncedSerializedRef.current = JSON.stringify(savedData);
      setLastSavedAt(saved?.updatedAt ?? new Date().toISOString());
      setSaveState('saved');
      setSaveError(null);
      clearDraft(courseId, lessonId, learnerId);
      console.info('[guided-reflection] reflectionSaved', {
        lessonId,
        status: 'submitted',
        responseSize: summarizeReflectionResponse(savedData).length,
      });
      return true;
    }).catch((error) => {
      console.warn('[guided-reflection] reflection submit failed', error);
      setSaveState('error');
      setSaveError('Submit failed. Your draft is still safe on this device.');
      return false;
    });
    if (!submitResult) return;
    console.info('[guided-reflection] reflectionSubmitted', {
      lessonId,
      responseSize: summarizeReflectionResponse(submittedData).length,
    });
    setCurrentStepId('confirmation');
  };

  const statusLabel =
    loading
      ? 'Loading your reflection…'
      : saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
      ? `Saved${lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : saveState === 'error'
      ? saveError || 'Save failed'
      : saveState === 'unsaved'
      ? 'Unsaved'
      : 'Ready';

  const renderStepBody = () => {
    if (currentStep.id === 'intro') {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-skyblue/10 text-skyblue">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-skyblue">Guided Reflection</p>
            <h3 className="font-heading text-3xl font-bold text-charcoal">{lessonTitle}</h3>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate/80">{currentStep.subtitle}</p>
          </div>
        </div>
      );
    }

    if (currentStep.id === 'prompt') {
      return (
        <div className="space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-skyblue">Reflection Prompt</p>
          <div className="mx-auto max-w-3xl">
            <p className="text-3xl font-semibold leading-[1.45] text-charcoal sm:text-4xl">{config.prompt}</p>
          </div>
          <p className="mx-auto max-w-2xl text-base leading-8 text-slate/75">{currentStep.subtitle}</p>
          {config.instructions && <p className="mx-auto max-w-2xl text-sm leading-7 text-slate/65">{config.instructions}</p>}
        </div>
      );
    }

    if (currentStep.id === 'review') {
      return (
        <div className="space-y-5">
          {reviewSections.map((section) => (
            <div key={section.label} className="rounded-2xl border border-slate/15 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">{section.label}</p>
              {'prompt' in section && section.prompt && <p className="mt-2 text-sm text-slate/70">{section.prompt}</p>}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-charcoal">
                {section.value?.trim() ? section.value : 'No response yet.'}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (currentStep.id === 'confirmation') {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600">Reflection Saved</p>
            <h3 className="font-heading text-3xl font-bold text-charcoal">You captured something meaningful.</h3>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate/80">{config.confirmationMessage}</p>
          </div>
        </div>
      );
    }

    const fieldValue = currentStep.field ? reflectionData[currentStep.field] ?? '' : '';
    const label = 'label' in currentStep ? currentStep.label : currentStep.title;
    const prompt = 'prompt' in currentStep ? currentStep.prompt : '';
    const placeholder = 'placeholder' in currentStep ? currentStep.placeholder : '';

    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-skyblue">{label}</p>
          {prompt && <p className="text-2xl font-semibold leading-10 text-charcoal">{prompt}</p>}
          <p className="text-sm leading-7 text-slate/70">{currentStep.subtitle}</p>
        </div>
        <textarea
          value={fieldValue}
          onChange={(event) => updateField(currentStep.field, event.target.value)}
          rows={currentStep.id === 'action' ? 5 : 8}
          placeholder={placeholder}
          className="min-h-[220px] w-full resize-y rounded-[28px] border border-slate/15 bg-white px-5 py-4 text-base leading-8 text-charcoal shadow-sm transition focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/30"
        />
      </div>
    );
  };

  return (
    <Card tone="muted" className="mt-8 border border-skyblue/15 bg-gradient-to-b from-white to-skyblue/5 p-6 sm:p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate/60">
                Step {currentStepIndex + 1} of {baseSteps.length}
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-charcoal">{currentStep.title}</h2>
            </div>
            <div
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                saveState === 'saved' && 'bg-emerald-50 text-emerald-700',
                saveState === 'saving' && 'bg-skyblue/10 text-skyblue',
                saveState === 'error' && 'bg-red-50 text-red-700',
                saveState === 'unsaved' && 'bg-amber-50 text-amber-700',
                (saveState === 'idle' || loading) && 'bg-slate-100 text-slate-700',
              )}
            >
              {loading && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
              {statusLabel}
            </div>
          </div>
          <ProgressBar
            value={Math.round(((currentStepIndex + 1) / baseSteps.length) * 100)}
            className="h-2 bg-slate/10"
          />
          <p className="text-xs text-slate/65">
            {draftRecovered
              ? 'Recovered your latest draft from this device.'
              : 'Your reflection autosaves as you move through each step.'}
          </p>
        </div>

        <div className="min-h-[360px] rounded-[32px] border border-white/70 bg-white/90 px-6 py-8 shadow-sm transition-all duration-300 sm:px-10">
          {renderStepBody()}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate/70">
            {required ? 'A prompt response is required before you submit.' : 'You can skip optional steps and return later.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {currentStepIndex > 0 && currentStep.id !== 'confirmation' && (
              <Button size="sm" variant="ghost" onClick={() => goToStep(currentStepIndex - 1)} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            )}

            {currentStep.id === 'review' ? (
              <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit || saveState === 'saving'}>
                Submit reflection
              </Button>
            ) : currentStep.id === 'confirmation' ? (
              <Button size="sm" onClick={onComplete}>
                Continue learning
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => goToStep(currentStepIndex + 1)}
                trailingIcon={<ArrowRight className="h-4 w-4" />}
              >
                {currentStep.id === 'intro'
                  ? 'Begin reflection'
                  : currentStep.id === 'prompt'
                  ? 'Take a moment to think'
                  : currentStepIndex === baseSteps.length - 2
                  ? 'Review reflection'
                  : 'Continue'}
              </Button>
            )}
          </div>
        </div>

        {completionReady && currentStep.id !== 'confirmation' && (
          <div className="flex justify-end border-t border-mist/60 pt-6">
            <Button onClick={onComplete}>
              Complete reflection lesson
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default GuidedReflectionFlow;
