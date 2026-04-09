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
  onComplete: () => Promise<void> | void;
};

type StepDefinition =
  | { id: 'intro'; title: string; subtitle: string }
  | { id: 'prompt'; title: string; subtitle: string }
  | { id: 'initial'; title: string; subtitle: string; field: 'promptResponse'; label: 'Your reflection'; placeholder: 'Take a moment to reflect and write your thoughts here...' }
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
    const legacyRecord = parsed as { text?: string };
    const legacyText = typeof legacyRecord.text === 'string' ? legacyRecord.text : '';
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
  const initialDraft = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readDraft(courseId, lessonId, learnerId);
  }, [courseId, lessonId, learnerId]);

  const baseSteps = useMemo<StepDefinition[]>(
    () => [
      { id: 'intro', title: 'Settle In', subtitle: config.introText },
      { id: 'prompt', title: 'Reflection Prompt', subtitle: config.thinkPrompt },
      {
        id: 'initial',
        title: 'Your Initial Thoughts',
        subtitle: 'Start with what feels most true right now.',
        field: 'promptResponse',
        label: 'Your reflection',
        placeholder: 'Take a moment to reflect and write your thoughts here...',
      },
      ...deepenPrompts.map((prompt, index) => {
        const stepId = (`deepen-${index + 1}` as 'deepen-1' | 'deepen-2' | 'deepen-3');
        const field = (`deeperReflection${index + 1}` as 'deeperReflection1' | 'deeperReflection2' | 'deeperReflection3');
        return {
          id: stepId,
          title: 'Deepen Your Reflection',
          subtitle: 'Stay curious. Let the next layer come into focus.',
          field,
          prompt,
          placeholder: 'Write a deeper reflection here...',
        };
      }),
      {
        id: 'action',
        title: 'Turn Insight Into Action',
        subtitle: 'Name one practical step you can carry forward.',
        field: 'actionCommitment',
        prompt: config.actionPrompt,
        placeholder: 'Describe one action you can take moving forward...',
      },
      { id: 'review', title: 'Review & Submit', subtitle: 'Look back over your reflection before you submit it.' },
      { id: 'confirmation', title: 'Reflection Saved', subtitle: config.confirmationMessage },
    ],
    [config.actionPrompt, config.confirmationMessage, config.introText, config.thinkPrompt, deepenPrompts],
  );

  const [reflectionData, setReflectionData] = useState<ReflectionResponseData>(
    initialDraft?.data ?? createEmptyReflectionResponseData(),
  );
  const [currentStepId, setCurrentStepId] = useState<StepDefinition['id']>(
    (initialDraft?.currentStepId as StepDefinition['id']) ?? 'intro',
  );
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(Boolean(initialDraft && summarizeReflectionResponse(initialDraft.data).trim()));
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const hydratedRef = useRef(false);
  const syncedSerializedRef = useRef(JSON.stringify(createEmptyReflectionResponseData()));
  const latestDraftRef = useRef<ReflectionResponseData>(createEmptyReflectionResponseData());
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const queuedSaveRef = useRef<{ data: ReflectionResponseData; status: 'draft' | 'submitted' } | null>(null);
  const lastInputEventRef = useRef<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const saveDelayMs = 1000;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
  const hasPendingChanges = hydratedRef.current && JSON.stringify(reflectionData) !== syncedSerializedRef.current;
  const currentEditableValue = useMemo(() => {
    if (!('field' in currentStep) || !currentStep.field) return '';
    return reflectionData[currentStep.field] ?? '';
  }, [currentStep, reflectionData]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

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
        const rawNextStepId =
          (shouldPreferDraft ? draft?.currentStepId : serverData.currentStepId) ?? serverData.currentStepId ?? 'intro';
        const nextStepId =
          rawNextStepId === 'intro' && summarizeReflectionResponse(nextData).trim().length > 0
            ? record?.status === 'submitted' || nextData.submittedAt
              ? 'review'
              : 'initial'
            : rawNextStepId;

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
      const payloadData: ReflectionResponseData = {
        ...data,
        currentStepId: status === 'submitted' ? 'review' : currentStepId,
      };
      const serialized = JSON.stringify(payloadData);
      if (inFlightRef.current) {
        queuedSaveRef.current = { data: payloadData, status };
        return inFlightRef.current;
      }

      const executeSave = async () => {
        setSaveState('saving');
        setSaveError(null);
        try {
          const saved = await reflectionService.saveLearnerReflection({
            courseId,
            lessonId,
            responseText: payloadData.promptResponse,
            responseData: payloadData,
            status,
          });
          const savedData = normalizeReflectionResponseData(saved?.responseData ?? payloadData);
          syncedSerializedRef.current = JSON.stringify(savedData);
          latestDraftRef.current = savedData;
          setLastSavedAt(saved?.updatedAt ?? new Date().toISOString());
          console.info('[guided-reflection] reflectionSaved', {
            lessonId,
            status,
            responseSize: summarizeReflectionResponse(savedData).length,
          });
          if (JSON.stringify(savedData) === serialized || status === 'submitted') {
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

      const promise = executeSave();
      inFlightRef.current = promise;
      return promise;
    },
    [courseId, currentStepId, learnerId, lessonId],
  );

  useEffect(() => {
    if (!hydratedRef.current || currentStepId === 'confirmation' || submitting) return;
    latestDraftRef.current = reflectionData;
    const serialized = JSON.stringify(reflectionData);
    if (serialized === syncedSerializedRef.current) {
      if (saveState === 'saving' || saveState === 'error') {
        return;
      }
      if (saveState === 'unsaved') {
        setSaveState(lastSavedAt ? 'saved' : 'idle');
      }
      return;
    }

    setSaveState((current) => (current === 'saving' || current === 'error' ? current : 'unsaved'));
    const timer = window.setTimeout(() => {
      void persistReflection({ ...latestDraftRef.current, currentStepId }, 'draft');
    }, saveDelayMs);

    return () => window.clearTimeout(timer);
  }, [currentStepId, lastSavedAt, persistReflection, reflectionData, saveState, submitting]);
  
  useEffect(() => {
    if (saveState !== 'saved' && saveState !== 'idle') return;
    // Keep local draft in sync with successful save state while preserving fallback data.
    const payload: ReflectionDraftPayload = {
      data: { ...reflectionData, currentStepId },
      currentStepId,
      updatedAt: new Date().toISOString(),
      status: saveState === 'saved' ? 'draft' : 'draft',
    };
    writeDraft(courseId, lessonId, learnerId, payload);
  }, [courseId, currentStepId, learnerId, lessonId, reflectionData, saveState]);

  const updateField = (field: keyof ReflectionResponseData, value: string) => {
    setReflectionData((prev) => {
      const next = { ...prev, [field]: value, currentStepId };
      latestDraftRef.current = next;
      return next;
    });
    if (saveState === 'error') {
      setSaveState('unsaved');
      setSaveError(null);
    }
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
    setSubmitting(true);
    const submittedData = {
      ...reflectionData,
      currentStepId: 'review',
      submittedAt: new Date().toISOString(),
    };
    setReflectionData(submittedData);
    latestDraftRef.current = submittedData;
    try {
      if (inFlightRef.current) {
        await inFlightRef.current;
      }
      queuedSaveRef.current = null;
      const submitResult = await persistReflection(submittedData, 'submitted');
      if (!submitResult) return;
      console.info('[guided-reflection] reflectionSubmitted', {
        lessonId,
        responseSize: summarizeReflectionResponse(submittedData).length,
      });
      setCurrentStepId('confirmation');
      setAdvancing(true);
      await onComplete();
    } catch (error) {
      console.warn('[guided-reflection] reflection completion handoff failed', error);
      setSaveState('error');
      setSaveError('Your reflection was saved, but we could not advance the lesson. Please continue manually.');
    } finally {
      setAdvancing(false);
      setSubmitting(false);
    }
  };

  const saveDraft = useCallback(async () => {
    if (submitting || advancing || currentStep.id === 'confirmation') return false;
    if (!hasPendingChanges && saveState !== 'error') return true;
    setManualSaving(true);
    setSaveError(null);
    try {
      const result = await persistReflection(reflectionData, 'draft');
      if (!result) {
        setSaveState('error');
        setSaveError('Save failed. Please try again.');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('[guided-reflection] reflection manual save failed', error);
      setSaveState('error');
      setSaveError('Save failed. Please try again.');
      return false;
    } finally {
      setManualSaving(false);
    }
  }, [advancing, currentStep.id, hasPendingChanges, persistReflection, reflectionData, saveState, submitting]);

  const isSaveDisabled = !hasPendingChanges || saveState === 'saving' || submitting || advancing;

  const statusLabel =
    loading
      ? 'Loading your reflection…'
      : saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
      ? `Saved at ${lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
      : saveState === 'error'
      ? saveError || 'Save failed — retry'
      : saveState === 'unsaved'
      ? 'Unsaved changes'
      : advancing
      ? 'Advancing…'
      : 'Ready';

  const autosizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const minHeight = 220;
    el.style.height = '0px';
    const nextHeight = Math.max(minHeight, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (!('field' in currentStep)) return;
    autosizeTextarea();
  }, [autosizeTextarea, currentEditableValue, currentStepId]);

  const renderStepBody = () => {
    if (currentStep.id === 'intro') {
      return (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-skyblue/10 text-skyblue">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-skyblue">Guided Reflection</p>
            <h3 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">{lessonTitle}</h3>
            <p className="max-w-none text-[17px] leading-8 text-slate/80">{currentStep.subtitle}</p>
          </div>
        </div>
      );
    }

    if (currentStep.id === 'prompt') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Reflection prompt</p>
            <h3 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">
              {currentStep.title}
            </h3>
            <p className="text-[17px] leading-8 text-slate/75">{currentStep.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-mist bg-slate-50/70 p-5 sm:p-6">
            <p className="text-[18px] font-semibold leading-8 text-charcoal sm:text-xl sm:leading-9">
              {config.prompt}
            </p>
            {config.instructions && (
              <p className="mt-4 text-sm leading-7 text-slate/70">{config.instructions}</p>
            )}
          </div>
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
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-charcoal">
                {section.value?.trim() ? section.value : 'No response yet.'}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (currentStep.id === 'confirmation') {
      return (
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Reflection saved</p>
            <h3 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">
              You captured something meaningful.
            </h3>
            <p className="text-[17px] leading-8 text-slate/80">{config.confirmationMessage}</p>
            {advancing && <p className="text-sm font-medium text-slate/65">Taking you to the next lesson…</p>}
            {saveState === 'error' && saveError && <p className="text-sm font-medium text-red-600">{saveError}</p>}
          </div>
        </div>
      );
    }

    const fieldValue = currentStep.field ? reflectionData[currentStep.field] ?? '' : '';
    const label = 'label' in currentStep ? currentStep.label : currentStep.title;
    const prompt = 'prompt' in currentStep ? currentStep.prompt : '';
    const placeholder = 'placeholder' in currentStep ? currentStep.placeholder : '';

    return (
      <div className="space-y-6">
        {config.prompt && (
          <div className="rounded-2xl border border-mist bg-slate-50/70 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Reflection prompt</p>
            <p className="mt-3 text-[17px] font-semibold leading-8 text-charcoal sm:text-lg sm:leading-9">
              {config.prompt}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">{label}</p>
          {prompt && <p className="text-xl font-semibold leading-8 text-charcoal sm:text-2xl sm:leading-9">{prompt}</p>}
          <p className="text-[15px] leading-7 text-slate/75">{currentStep.subtitle}</p>
        </div>
        <textarea
          value={fieldValue}
          onChange={(event) => {
            updateField(currentStep.field, event.target.value);
            window.requestAnimationFrame(() => autosizeTextarea());
          }}
          ref={textareaRef}
          rows={8}
          placeholder={placeholder}
          className="min-h-[220px] w-full max-w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-[17px] leading-7 text-charcoal shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
        />
      </div>
    );
  };

  return (
    <div className="mt-10">
      <div className="mx-auto w-full max-w-[900px] px-4 sm:px-6">
        <Card tone="muted" className="border border-mist bg-gradient-to-b from-white to-skyblue/5 p-5 sm:p-8">
          <div className="flex w-full flex-col gap-9">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate/60">
                Step {currentStepIndex + 1} of {baseSteps.length}
              </p>
              <h2 className="mt-1 font-heading text-3xl font-bold leading-tight text-charcoal">{currentStep.title}</h2>
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
              {(loading || advancing) && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
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

        <div className="min-h-[420px] rounded-3xl border border-white/70 bg-white/92 px-5 py-7 shadow-sm transition-all duration-300 sm:px-8 sm:py-9">
          {renderStepBody()}
        </div>

        <div className="flex flex-col gap-4 border-t border-mist/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl text-sm leading-7 text-slate/70">
            {required ? 'A prompt response is required before you submit.' : 'You can skip optional steps and return later.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {currentStep.id !== 'intro' && currentStep.id !== 'prompt' && currentStep.id !== 'confirmation' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveDraft()}
                disabled={isSaveDisabled}
                loading={manualSaving}
              >
                {manualSaving ? 'Saving…' : 'Save draft'}
              </Button>
            )}
            {currentStepIndex > 0 && currentStep.id !== 'confirmation' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => goToStep(currentStepIndex - 1)}
                disabled={submitting || advancing}
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </Button>
            )}

            {currentStep.id === 'review' ? (
              <Button
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit || saveState === 'saving' || submitting || advancing}
                trailingIcon={(submitting || advancing) ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                {submitting || advancing ? 'Submitting…' : 'Submit reflection'}
              </Button>
            ) : currentStep.id === 'confirmation' ? (
              <Button size="sm" onClick={() => void onComplete()} disabled={advancing}>
                Continue learning
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => goToStep(currentStepIndex + 1)}
                disabled={submitting || advancing}
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

        {saveState === 'error' && saveError && currentStep.id !== 'confirmation' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {saveError}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={manualSaving || submitting || advancing}>
                Retry save
              </Button>
            </div>
          </div>
        )}

          </div>
        </Card>
      </div>
    </div>
  );
};

export default GuidedReflectionFlow;
