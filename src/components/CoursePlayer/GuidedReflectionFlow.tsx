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
  type GuidedReflectionStep,
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

type FlowStep =
  | GuidedReflectionStep
  | { id: 'review'; kind: 'review'; title: string; body: string }
  | { id: 'confirmation'; kind: 'confirmation'; title: string; body: string };

const LEGACY_FIELD_BY_STEP_ID: Partial<Record<string, keyof ReflectionResponseData>> = {
  promptResponse: 'promptResponse',
  deeperReflection1: 'deeperReflection1',
  deeperReflection2: 'deeperReflection2',
  deeperReflection3: 'deeperReflection3',
  actionCommitment: 'actionCommitment',
};

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
    const empty = createEmptyReflectionResponseData();
    return {
      data: {
        ...empty,
        promptResponse: legacyText,
        answers: { ...(empty.answers ?? {}), promptResponse: legacyText },
        currentStepId: 'promptResponse',
      },
      currentStepId: 'promptResponse',
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
  const initialDraft = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readDraft(courseId, lessonId, learnerId);
  }, [courseId, lessonId, learnerId]);

  const baseSteps = useMemo<FlowStep[]>(() => {
    const steps = config.steps.map((step) => ({
      ...step,
      body: step.body ?? '',
    }));
    return [
      ...steps,
      { id: 'review', kind: 'review', title: config.review.title, body: config.review.subtitle },
      { id: 'confirmation', kind: 'confirmation', title: config.confirmation.eyebrow, body: config.confirmation.subtitle },
    ];
  }, [config]);

  const responseStepIds = useMemo(
    () =>
      config.steps
        .filter((step) => step.responseType && step.responseType !== 'none')
        .map((step) => step.id),
    [config.steps],
  );

  const requiredStepId = useMemo(() => {
    if (config.requiredResponseStepId && responseStepIds.includes(config.requiredResponseStepId)) {
      return config.requiredResponseStepId;
    }
    return responseStepIds[0] ?? null;
  }, [config.requiredResponseStepId, responseStepIds]);

  const [reflectionData, setReflectionData] = useState<ReflectionResponseData>(
    initialDraft?.data ?? createEmptyReflectionResponseData(),
  );
  const [currentStepId, setCurrentStepId] = useState<FlowStep['id']>(() => {
    const draftStep = typeof initialDraft?.currentStepId === 'string' ? initialDraft.currentStepId : null;
    if (draftStep && baseSteps.some((step) => step.id === draftStep)) return draftStep as FlowStep['id'];
    return (baseSteps[0]?.id ?? 'intro') as FlowStep['id'];
  });
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(
    Boolean(initialDraft && summarizeReflectionResponse(initialDraft.data, responseStepIds).trim()),
  );
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
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveFailureCountRef = useRef(0);
  const autosaveNextAttemptAtRef = useRef(0);

  const computeAutosaveBackoffMs = (failureCount: number) => {
    const steps = [3000, 5000, 10_000, 20_000, 30_000, 60_000];
    const idx = Math.max(0, Math.min(steps.length - 1, failureCount - 1));
    return steps[idx] ?? steps[steps.length - 1];
  };

  const currentStepIndex = Math.max(0, baseSteps.findIndex((step) => step.id === currentStepId));
  const currentStep = baseSteps[currentStepIndex] ?? baseSteps[0];
  const reviewSections = useMemo(() => {
    const answers = reflectionData.answers ?? {};
    return config.steps
      .filter((step) => step.responseType && step.responseType !== 'none')
      .map((step) => ({
        id: step.id,
        label: step.label || step.title,
        prompt: step.prompt || '',
        value: typeof answers[step.id] === 'string' ? answers[step.id] : '',
      }));
  }, [config.steps, reflectionData.answers]);

  const canSubmit = !required || (requiredStepId ? Boolean((reflectionData.answers?.[requiredStepId] ?? '').trim()) : true);
  const hasPendingChanges = hydratedRef.current && JSON.stringify(reflectionData) !== syncedSerializedRef.current;
  const currentEditableValue = useMemo(() => {
    if (!('responseType' in currentStep)) return '';
    if (!currentStep.responseType || currentStep.responseType === 'none') return '';
    return (reflectionData.answers?.[currentStep.id] ?? '').toString();
  }, [currentStep, reflectionData.answers]);

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
                  currentStepId: responseStepIds[0] ?? 'intro',
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
          rawNextStepId === 'intro' && summarizeReflectionResponse(nextData, responseStepIds).trim().length > 0
            ? record?.status === 'submitted' || nextData.submittedAt
              ? 'review'
              : (responseStepIds[0] ?? 'intro')
            : rawNextStepId;

        setReflectionData(nextData);
        latestDraftRef.current = nextData;
        setCurrentStepId(
          baseSteps.some((step) => step.id === nextStepId) ? (nextStepId as FlowStep['id']) : (baseSteps[0]?.id ?? 'intro'),
        );
        setDraftRecovered(Boolean(shouldPreferDraft && summarizeReflectionResponse(nextData, responseStepIds).trim()));
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
  }, [baseSteps, courseId, learnerId, lessonId, responseStepIds]);

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
    async (
      data: ReflectionResponseData,
      status: 'draft' | 'submitted',
      options: { reason?: 'autosave' | 'manual' | 'submit' } = {},
    ) => {
      const reason = options.reason ?? (status === 'submitted' ? 'submit' : 'autosave');
      const payloadData: ReflectionResponseData = {
        ...data,
        version: 2,
        currentStepId: status === 'submitted' ? 'review' : currentStepId,
        stepOrder: responseStepIds,
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
          const responseText = summarizeReflectionResponse(payloadData, responseStepIds);
          const saved = await reflectionService.saveLearnerReflection({
            courseId,
            lessonId,
            responseText,
            responseData: payloadData,
            status,
          });
          const savedData = normalizeReflectionResponseData(saved?.responseData ?? payloadData);
          syncedSerializedRef.current = JSON.stringify(savedData);
          latestDraftRef.current = savedData;
          setLastSavedAt(saved?.updatedAt ?? new Date().toISOString());
          autosaveFailureCountRef.current = 0;
          autosaveNextAttemptAtRef.current = 0;
          console.info('[guided-reflection] reflectionSaved', {
            lessonId,
            status,
            reason,
            responseSize: summarizeReflectionResponse(savedData, responseStepIds).length,
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
          const statusCode = typeof (error as any)?.status === 'number' ? (error as any).status : null;
          const body = (error as any)?.body && typeof (error as any).body === 'object' ? (error as any).body : null;
          const backendError = body && typeof (body as any).error === 'string' ? (body as any).error : null;

          if (backendError === 'org_selection_required' || backendError === 'explicit_org_selection_required') {
            setSaveError('Select an organization to enable saving. Your draft is still safe on this device.');
          } else if (statusCode === 503) {
            setSaveError('Autosave is temporarily unavailable. Your draft is still safe on this device.');
          } else {
            setSaveError('Save failed. Your draft is still safe on this device.');
          }

          if (reason === 'autosave' && status !== 'submitted') {
            autosaveFailureCountRef.current += 1;
            const backoffMs = computeAutosaveBackoffMs(autosaveFailureCountRef.current);
            autosaveNextAttemptAtRef.current = Date.now() + backoffMs;
          }
          return false;
        } finally {
          inFlightRef.current = null;
          if (queuedSaveRef.current) {
            const next = queuedSaveRef.current;
            queuedSaveRef.current = null;
            if (JSON.stringify(next.data) !== syncedSerializedRef.current || next.status === 'submitted') {
              void persistReflection(next.data, next.status, { reason: next.status === 'submitted' ? 'submit' : 'autosave' });
            }
          }
        }
      };

      const promise = executeSave();
      inFlightRef.current = promise;
      return promise;
    },
    [courseId, currentStepId, learnerId, lessonId, responseStepIds],
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

    setSaveState((current) => (current === 'saving' ? current : 'unsaved'));

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    // Back off autosave retries after failures to avoid spamming the server.
    const now = Date.now();
    const delay = Math.max(saveDelayMs, Math.max(0, autosaveNextAttemptAtRef.current - now));
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      if (inFlightRef.current || submitting || currentStepId === 'confirmation') return;
      void persistReflection({ ...latestDraftRef.current, currentStepId }, 'draft', { reason: 'autosave' });
    }, delay) as unknown as number;

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
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

  const updateAnswer = (stepId: string, value: string) => {
    // Backwards-compatible helper: updates both legacy fields and v2 `answers`.
    setReflectionData((prev) => {
      const nextAnswers = { ...(prev.answers ?? {}) };
      nextAnswers[stepId] = value;
      const legacyKey = LEGACY_FIELD_BY_STEP_ID[stepId];
      const next: ReflectionResponseData = {
        ...prev,
        answers: nextAnswers,
        ...(legacyKey ? { [legacyKey]: value } : {}),
        currentStepId,
        version: 2,
        stepOrder: responseStepIds,
      };
      latestDraftRef.current = next;
      return next;
    });
    if (saveState === 'error') {
      setSaveState('unsaved');
      setSaveError(null);
    }
      const nextSignature = `${currentStepId}:${stepId}`;
      if (lastInputEventRef.current !== nextSignature) {
        lastInputEventRef.current = nextSignature;
        // Intentionally silent in production — avoid noisy console logging.
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
      const submitResult = await persistReflection(submittedData, 'submitted', { reason: 'submit' });
      if (!submitResult) return;
      console.info('[guided-reflection] reflectionSubmitted', {
        lessonId,
        responseSize: summarizeReflectionResponse(submittedData, responseStepIds).length,
      });
      setCurrentStepId('confirmation');
      setAdvancing(true);
      await onComplete();
    } catch (error) {
      console.warn('[guided-reflection] reflection completion handoff failed', error);
      setSaveState('error');
      setSaveError('Save failed. Your draft is still safe on this device.');
      // Force a state update flush for test timing
      await new Promise((resolve) => setTimeout(resolve, 0));
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
      autosaveFailureCountRef.current = 0;
      autosaveNextAttemptAtRef.current = 0;
      const result = await persistReflection(reflectionData, 'draft', { reason: 'manual' });
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
    const minHeight = 280;
    el.style.height = '0px';
    const nextHeight = Math.max(minHeight, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (!('responseType' in currentStep)) return;
    if (!currentStep.responseType || currentStep.responseType === 'none') return;
    if (currentStep.responseType !== 'textarea') return;
    autosizeTextarea();
  }, [autosizeTextarea, currentEditableValue, currentStepId]);

  const renderStepBody = () => {
    if (currentStep.id === 'intro' && 'kind' in currentStep && currentStep.kind === 'intro') {
      return (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-skyblue/10 text-skyblue">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-skyblue">{config.labels.flowLabel}</p>
            <h3 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">{lessonTitle}</h3>
            <p className="max-w-none text-[17px] leading-8 text-slate/80">{currentStep.body}</p>
          </div>
        </div>
      );
    }

    if (currentStep.id === 'prompt' && 'kind' in currentStep && currentStep.kind === 'prompt') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">{config.labels.promptSectionLabel}</p>
            <h3 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">
              {currentStep.title}
            </h3>
            <p className="text-[17px] leading-8 text-slate/75">{currentStep.body}</p>
          </div>
          <div className="rounded-2xl border border-mist bg-slate-50/70 p-5 sm:p-6">
            <p className="text-[18px] font-semibold leading-8 text-charcoal sm:text-xl sm:leading-9">
              {currentStep.prompt || config.prompt}
            </p>
            {currentStep.instructions && (
              <p className="mt-4 text-sm leading-7 text-slate/70">{currentStep.instructions}</p>
            )}
          </div>
        </div>
      );
    }

    if (currentStep.id === 'review') {
      return (
        <div className="space-y-5">
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" style={{ display: saveError ? undefined : 'none' }}>
            {saveError}
            {saveError && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={manualSaving || submitting || advancing}>
                  Retry save
                </Button>
              </div>
            )}
          </div>
          {reviewSections.map((section) => (
            <div key={section.id} className="rounded-2xl border border-slate/15 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">{section.label}</p>
              {'prompt' in section && section.prompt && <p className="mt-2 text-sm text-slate/70">{section.prompt}</p>}
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-charcoal">
                {section.value?.trim() ? section.value : config.review.emptyResponseText}
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{config.confirmation.eyebrow}</p>
            <h3 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">
              {config.confirmation.title}
            </h3>
            <p className="text-[17px] leading-8 text-slate/80">{config.confirmation.subtitle}</p>
            {advancing && <p className="text-sm font-medium text-slate/65">Taking you to the next lesson…</p>}
            {saveState === 'error' && saveError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-4" role="alert">
                {saveError}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={manualSaving || submitting || advancing}>
                    Retry save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    const step = currentStep as GuidedReflectionStep;
    const fieldValue = currentEditableValue ?? '';
    const label = step.label || step.title;
    const prompt = step.prompt || '';
    const placeholder = step.placeholder || '';
    const helperText = step.helperText || '';

    return (
      <div className="space-y-6">
        {config.prompt && (step.kind === 'response' || step.responseType) && (
          <div className="rounded-2xl border border-mist bg-slate-50/70 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">{config.labels.promptSectionLabel}</p>
            <p className="mt-3 text-[17px] font-semibold leading-8 text-charcoal sm:text-lg sm:leading-9">
              {config.prompt}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">{label}</p>
          {prompt && <p className="text-xl font-semibold leading-8 text-charcoal sm:text-2xl sm:leading-9">{prompt}</p>}
          <p className="text-[15px] leading-7 text-slate/75">{step.body}</p>
        </div>

        {step.responseType === 'short_text' ? (
          <input
            value={fieldValue}
            onChange={(event) => updateAnswer(step.id, event.target.value)}
            placeholder={placeholder}
            className="w-full max-w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[17px] leading-7 text-charcoal shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 placeholder:text-slate/45"
          />
        ) : (
          <textarea
            value={fieldValue}
            onChange={(event) => {
              updateAnswer(step.id, event.target.value);
              window.requestAnimationFrame(() => autosizeTextarea());
            }}
            ref={textareaRef}
            rows={10}
            placeholder={placeholder}
            className="min-h-[300px] w-full max-w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-4 text-[17px] leading-7 text-charcoal shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 placeholder:text-slate/45 sm:min-h-[340px]"
          />
        )}
        {helperText && <p className="text-sm leading-6 text-slate/65">{helperText}</p>}
      </div>
    );
  };

  return (
    <div className="mt-10 w-full">
      <Card tone="muted" className="w-full border border-mist bg-gradient-to-b from-white to-skyblue/5 p-6 sm:p-10">
        <div className="flex w-full flex-col gap-9">
          {saveState === 'error' && saveError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {saveError}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={manualSaving || submitting || advancing}>
                  Retry save
                </Button>
              </div>
            </div>
          )}
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
                ? config.labels.draftRecoveredHelperText
                : config.labels.autosaveHelperText}
            </p>
          </div>

          <div className="min-h-[440px] rounded-3xl border border-white/70 bg-white/92 px-6 py-8 shadow-sm transition-all duration-300 sm:px-10 sm:py-10">
            {renderStepBody()}
          </div>

          <div className="flex flex-col gap-4 border-t border-mist/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl text-sm leading-7 text-slate/70">
              {required ? config.labels.requiredFooterText : config.labels.optionalFooterText}
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
                  {config.confirmation.continueLabel}
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
        </div>
      </Card>
    </div>
  );
};

export default GuidedReflectionFlow;
