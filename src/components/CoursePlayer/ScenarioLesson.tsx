import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

import Card from '../ui/Card';
import Button from '../ui/Button';
import cn from '../../utils/cn';
import { trackEvent } from '../../dal/analytics';
import { reflectionService } from '../../dal/reflections';
import {
  applyScenarioImpact,
  clearScenarioDraft,
  defaultScenarioScores,
  normalizeScenarioLesson,
  readScenarioDraft,
  scoreLabel,
  writeScenarioDraft,
  type ScenarioCoachFeedback,
  type ScenarioDecisionNode,
  type ScenarioDraft,
  type ScenarioImpactScores,
  type ScenarioLesson,
} from '../../utils/scenarioFlow';
import {
  buildReflectionDraftStorageKey,
  createEmptyReflectionResponseData,
  normalizeReflectionResponseData,
  summarizeReflectionResponse,
  type ReflectionDraftPayload,
  type ReflectionResponseData,
} from '../../utils/reflectionFlow';

type ScenarioLessonProps = {
  courseId: string;
  learnerId: string;
  lessonId: string;
  lessonTitle: string;
  lessonContent: Record<string, unknown>;
  onComplete: () => Promise<void> | void;
};

const defaultCoach = (fallback?: Partial<ScenarioCoachFeedback>): ScenarioCoachFeedback => ({
  whatHappened: fallback?.whatHappened ?? 'The moment moved forward.',
  howItMayHaveFelt:
    fallback?.howItMayHaveFelt ??
    'Different people can experience the same moment very differently—especially if psychological safety is already fragile.',
  inclusiveLeaderConsideration:
    fallback?.inclusiveLeaderConsideration ??
    'Slow down, check for impact, and invite perspectives—especially from those most affected—without putting them on the spot.',
});

const avatarLabel = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
};

const readReflectionDraft = (courseId: string, lessonId: string, learnerId: string): ReflectionDraftPayload | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildReflectionDraftStorageKey(courseId, lessonId, learnerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReflectionDraftPayload | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('data' in parsed) || !parsed.data || typeof parsed.data !== 'object') return null;
    return {
      data: normalizeReflectionResponseData(parsed.data),
      currentStepId: typeof parsed.currentStepId === 'string' ? parsed.currentStepId : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      status: parsed.status === 'submitted' ? 'submitted' : 'draft',
    };
  } catch {
    return null;
  }
};

const writeReflectionDraft = (courseId: string, lessonId: string, learnerId: string, payload: ReflectionDraftPayload) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildReflectionDraftStorageKey(courseId, lessonId, learnerId), JSON.stringify(payload));
  } catch {
    // no-op
  }
};

const ScenarioLesson = ({ courseId, learnerId, lessonId, lessonTitle, lessonContent, onComplete }: ScenarioLessonProps) => {
  const scenario = useMemo<ScenarioLesson>(() => normalizeScenarioLesson(lessonContent as any, lessonTitle), [lessonContent, lessonTitle]);
  const nodesById = useMemo(() => new Map(scenario.nodes.map((node) => [node.id, node])), [scenario.nodes]);
  const orderedNodeIds = useMemo(() => scenario.nodes.map((node) => node.id), [scenario.nodes]);
  const initialDraft = useMemo(() => readScenarioDraft(courseId, lessonId, learnerId), [courseId, lessonId, learnerId]);

  const [currentNodeId, setCurrentNodeId] = useState(initialDraft?.currentNodeId ?? scenario.startNodeId);
  const [history, setHistory] = useState<ScenarioDraft['history']>(initialDraft?.history ?? []);
  const [scores, setScores] = useState<ScenarioImpactScores>(initialDraft?.scores ?? defaultScenarioScores());
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [flowCompleted, setFlowCompleted] = useState(false);

  const currentNode = nodesById.get(currentNodeId) ?? scenario.nodes[0];
  const currentIndex = Math.max(0, orderedNodeIds.indexOf(currentNodeId));
  const progressLabel = `Scenario ${Math.min(currentIndex + 1, scenario.nodes.length)} of ${scenario.nodes.length}`;

  const persistDraft = useCallback(
    (next: { nodeId: string; history: ScenarioDraft['history']; scores: ScenarioImpactScores }) => {
      const draft: ScenarioDraft = {
        currentNodeId: next.nodeId,
        history: next.history,
        scores: next.scores,
        updatedAt: new Date().toISOString(),
      };
      writeScenarioDraft(courseId, lessonId, learnerId, draft);
    },
    [courseId, lessonId, learnerId],
  );

  useEffect(() => {
    trackEvent('lesson_started', learnerId, { mode: 'scenario', scenarioVersion: scenario.version }, courseId, lessonId);
    trackEvent('scenario_started', learnerId, { scenarioVersion: scenario.version }, courseId, lessonId);
  }, [courseId, learnerId, lessonId, scenario.version]);

  useEffect(() => {
    setSelectedOptionId(null);
    setShowCoach(false);
  }, [currentNodeId]);

  const handleSelectOption = (node: ScenarioDecisionNode, optionId: string) => {
    const option = node.options.find((opt) => opt.id === optionId);
    if (!option) return;

    const nextScores = applyScenarioImpact(scores, option.impact);
    const nextHistory = [
      ...history,
      {
        nodeId: node.id,
        optionId: option.id,
        ts: new Date().toISOString(),
      },
    ];

    setScores(nextScores);
    setHistory(nextHistory);
    setSelectedOptionId(option.id);
    setShowCoach(true);

    persistDraft({ nodeId: node.id, history: nextHistory, scores: nextScores });
    trackEvent(
      'scenario_decision',
      learnerId,
      {
        scenarioVersion: scenario.version,
        nodeId: node.id,
        optionId: option.id,
        impact: option.impact ?? {},
        pathLength: nextHistory.length,
      },
      courseId,
      lessonId,
    );
  };

  const goNext = () => {
    if (!currentNode) return;
    const chosen = selectedOptionId
      ? currentNode.options.find((option) => option.id === selectedOptionId) ?? null
      : null;
    const nextNodeId = chosen?.nextNodeId ? String(chosen.nextNodeId) : null;

    if (nextNodeId && nodesById.has(nextNodeId)) {
      persistDraft({ nodeId: nextNodeId, history, scores });
      setCurrentNodeId(nextNodeId);
      return;
    }

    setFlowCompleted(true);
    trackEvent(
      'scenario_completed',
      learnerId,
      {
        scenarioVersion: scenario.version,
        pathLength: history.length,
        scores,
      },
      courseId,
      lessonId,
    );
    clearScenarioDraft(courseId, lessonId, learnerId);
  };

  const reflectionDraft = useMemo(() => readReflectionDraft(courseId, lessonId, learnerId), [courseId, lessonId, learnerId]);
  const [reflectionData, setReflectionData] = useState<ReflectionResponseData>(
    reflectionDraft?.data ?? createEmptyReflectionResponseData(),
  );
  const [reflectionStatus, setReflectionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reflectionLastSavedAt, setReflectionLastSavedAt] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasReflection = summarizeReflectionResponse(reflectionData).trim().length > 0;

  const queueReflectionSave = useCallback(
    (nextData: ReflectionResponseData, status: 'draft' | 'submitted') => {
      writeReflectionDraft(courseId, lessonId, learnerId, {
        data: nextData,
        currentStepId: 'initial',
        updatedAt: new Date().toISOString(),
        status,
      });

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      setReflectionStatus('saving');
      saveTimerRef.current = window.setTimeout(() => {
        reflectionService
          .saveLearnerReflection({
            courseId,
            lessonId,
            responseText: summarizeReflectionResponse(nextData),
            responseData: nextData,
            status,
          })
          .then((record) => {
            setReflectionLastSavedAt(record?.updatedAt ?? new Date().toISOString());
            setReflectionStatus('saved');
            trackEvent(
              'reflection_saved',
              learnerId,
              { mode: 'scenario', status, size: summarizeReflectionResponse(nextData).length },
              courseId,
              lessonId,
            );
          })
          .catch((error) => {
            console.warn('[scenario] reflection save failed', error);
            setReflectionStatus('error');
          });
      }, 900);
    },
    [courseId, learnerId, lessonId],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const setReflectionField = (field: keyof ReflectionResponseData, value: string) => {
    const next = { ...reflectionData, [field]: value, currentStepId: 'initial' as any };
    setReflectionData(next);
    queueReflectionSave(next, 'draft');
  };

  const handleFinish = async () => {
    if (hasReflection) {
      queueReflectionSave({ ...reflectionData, submittedAt: new Date().toISOString() }, 'submitted');
    }
    await onComplete();
  };

  const selectedOption = selectedOptionId
    ? currentNode?.options.find((opt) => opt.id === selectedOptionId) ?? null
    : null;
  const coach = defaultCoach(selectedOption?.coach);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Scenario lesson</p>
          <h3 className="font-heading text-2xl font-bold leading-tight text-charcoal sm:text-3xl">
            {scenario.title ?? lessonTitle}
          </h3>
          <p className="text-sm leading-7 text-slate/75">{progressLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-mist bg-white px-3 py-1 text-xs text-slate/70">
            Empathy: <span className="font-semibold text-charcoal">{scoreLabel(scores.empathy)}</span>
          </div>
          <div className="rounded-full border border-mist bg-white px-3 py-1 text-xs text-slate/70">
            Inclusion: <span className="font-semibold text-charcoal">{scoreLabel(scores.inclusion)}</span>
          </div>
          <div className="rounded-full border border-mist bg-white px-3 py-1 text-xs text-slate/70">
            Effectiveness: <span className="font-semibold text-charcoal">{scoreLabel(scores.effectiveness)}</span>
          </div>
        </div>
      </div>

      <Card tone="muted" className="border border-mist bg-slate-50/70">
        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-[17px] font-semibold leading-8 text-charcoal">{scenario.context}</p>
          {scenario.situation && <p className="text-sm leading-7 text-slate/75">{scenario.situation}</p>}
          {scenario.characters.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-1">
              {scenario.characters.map((character) => (
                <div key={character.id} className="flex items-center gap-2 rounded-full border border-mist bg-white px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/10 text-xs font-semibold text-indigo-700">
                    {avatarLabel(character.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-charcoal">{character.name}</p>
                    {(character.role || character.pronouns) && (
                      <p className="text-[11px] text-slate/60">
                        {[character.role, character.pronouns].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {!flowCompleted ? (
          <motion.div
            key={currentNodeId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24 }}
            className="space-y-6"
          >
            {currentNode?.context && (
              <div className="rounded-2xl border border-mist bg-white px-5 py-4 text-sm leading-7 text-slate/80">
                {currentNode.context}
              </div>
            )}

            {Array.isArray(currentNode?.dialogue) && currentNode.dialogue.length > 0 && (
              <div className="space-y-3">
                {currentNode.dialogue.map((line) => {
                  const isNarrator = line.speakerId === 'narrator';
                  const speaker = scenario.characters.find((c) => c.id === line.speakerId);
                  return (
                    <div
                      key={line.id}
                      className={cn(
                        'flex gap-3',
                        isNarrator ? 'justify-center' : 'justify-start',
                      )}
                    >
                      {!isNarrator && (
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-600/10 text-xs font-semibold text-indigo-700">
                          {avatarLabel(speaker?.name ?? 'Team')}
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[680px] rounded-2xl border px-4 py-3 text-sm leading-7 shadow-sm',
                          isNarrator
                            ? 'border-mist bg-slate-50 text-slate/70'
                            : 'border-mist bg-white text-charcoal',
                        )}
                      >
                        {!isNarrator && speaker?.name && (
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate/55">
                            {speaker.name}
                          </p>
                        )}
                        <p className={cn(!isNarrator && speaker?.name ? 'mt-1' : '')}>{line.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Card className="border border-mist bg-white">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Decision point</p>
                  <p className="text-lg font-semibold leading-8 text-charcoal sm:text-xl">{currentNode?.prompt ?? 'What do you do?'}</p>
                </div>
                <div className="space-y-3">
                  {(currentNode?.options ?? []).map((option) => {
                    const isSelected = option.id === selectedOptionId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectOption(currentNode, option.id)}
                        disabled={Boolean(selectedOptionId)}
                        className={cn(
                          'w-full rounded-xl border px-4 py-3 text-left text-sm leading-7 transition',
                          isSelected ? 'border-indigo-600 bg-indigo-50/60' : 'border-mist bg-white hover:bg-slate-50',
                          selectedOptionId ? 'cursor-default opacity-90' : 'cursor-pointer',
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <AnimatePresence>
              {showCoach && selectedOption && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <Card tone="muted" className="border border-indigo-600/15 bg-indigo-50/40">
                    <div className="space-y-5 p-5 sm:p-6">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">Coach reflection</p>
                        <p className="text-sm text-slate/70">No grades. Just impact, perspective, and growth.</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-mist bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">What happened</p>
                          <p className="mt-2 text-sm leading-7 text-charcoal">{coach.whatHappened}</p>
                        </div>
                        <div className="rounded-2xl border border-mist bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">How this may have felt</p>
                          <p className="mt-2 text-sm leading-7 text-charcoal">{coach.howItMayHaveFelt}</p>
                        </div>
                        <div className="rounded-2xl border border-mist bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">What to consider</p>
                          <p className="mt-2 text-sm leading-7 text-charcoal">{coach.inclusiveLeaderConsideration}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={goNext} trailingIcon={<ArrowRight className="h-4 w-4" />}>
                          Continue
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            <Card tone="muted" className="border border-emerald-600/15 bg-emerald-50/40">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold uppercase tracking-[0.22em]">Scenario complete</p>
                  </div>
                  <p className="text-[17px] leading-8 text-charcoal">
                    Take a moment to capture what you noticed—especially impact, perspective, and what you’ll try next time.
                  </p>
                </div>
                <div className="rounded-2xl border border-mist bg-white px-4 py-3 text-xs text-slate/70">
                  {reflectionStatus === 'saving' ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </span>
                  ) : reflectionStatus === 'saved' ? (
                    <span>
                      Saved{reflectionLastSavedAt ? ` at ${new Date(reflectionLastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  ) : reflectionStatus === 'error' ? (
                    <span className="text-red-700">Save failed</span>
                  ) : (
                    <span>Autosave on</span>
                  )}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="border border-mist bg-white">
                <div className="space-y-3 p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Reflection</p>
                  <p className="text-lg font-semibold leading-8 text-charcoal">What would you do differently?</p>
                  <textarea
                    value={reflectionData.promptResponse}
                    onChange={(e) => setReflectionField('promptResponse', e.target.value)}
                    placeholder="Write freely. Keep it real. No perfect answers."
                    className="min-h-[200px] w-full rounded-xl border border-slate-200 px-4 py-4 text-[17px] leading-7 text-charcoal shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
                  />
                </div>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border border-mist bg-white">
                  <div className="space-y-3 p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Perspective</p>
                    <p className="text-base font-semibold leading-7 text-charcoal">Have you experienced something similar?</p>
                    <textarea
                      value={reflectionData.deeperReflection1}
                      onChange={(e) => setReflectionField('deeperReflection1', e.target.value)}
                      placeholder="What was the context? What did you wish had happened?"
                      className="min-h-[160px] w-full rounded-xl border border-slate-200 px-4 py-4 text-sm leading-7 text-charcoal shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
                    />
                  </div>
                </Card>

                <Card className="border border-mist bg-white">
                  <div className="space-y-3 p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate/60">Action</p>
                    <p className="text-base font-semibold leading-7 text-charcoal">What is one action you can take?</p>
                    <textarea
                      value={reflectionData.actionCommitment}
                      onChange={(e) => setReflectionField('actionCommitment', e.target.value)}
                      placeholder="One small, specific thing you’ll try this week."
                      className="min-h-[160px] w-full rounded-xl border border-slate-200 px-4 py-4 text-sm leading-7 text-charcoal shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
                    />
                  </div>
                </Card>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate/70">
                Your journal stays private unless you choose to share it.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void onComplete()}>
                  Skip for now
                </Button>
                <Button onClick={() => void handleFinish()} trailingIcon={<ArrowRight className="h-4 w-4" />}>
                  Continue learning
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScenarioLesson;
