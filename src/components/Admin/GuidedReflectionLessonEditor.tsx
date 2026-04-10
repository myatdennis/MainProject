import { useMemo } from 'react';
import { nanoid } from 'nanoid';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Lesson } from '../../types/courseTypes';
import { normalizeGuidedReflectionConfig, type GuidedReflectionStep } from '../../utils/reflectionFlow';

type GuidedReflectionPersisted = {
  version: 2;
  prompt: string;
  steps: GuidedReflectionStep[];
  labels?: {
    flowLabel?: string;
    promptSectionLabel?: string;
    autosaveHelperText?: string;
    draftRecoveredHelperText?: string;
    requiredFooterText?: string;
    optionalFooterText?: string;
  };
  review?: {
    title?: string;
    subtitle?: string;
    emptyResponseText?: string;
  };
  confirmation?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    continueLabel?: string;
  };
  requiredResponseStepId?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const buildBasePersisted = (lesson: Lesson): GuidedReflectionPersisted => {
  const normalized = normalizeGuidedReflectionConfig((lesson.content ?? {}) as any);
  return {
    version: 2,
    prompt: normalized.prompt,
    steps: normalized.steps,
    labels: normalized.labels,
    review: normalized.review,
    confirmation: normalized.confirmation,
    requiredResponseStepId: normalized.requiredResponseStepId,
  };
};

const deriveLegacyReflectionFields = (guided: GuidedReflectionPersisted) => {
  const intro = guided.steps.find((step) => step.kind === 'intro' || step.id === 'intro');
  const promptStep = guided.steps.find((step) => step.kind === 'prompt' || step.id === 'prompt');
  const deepenPrompts = guided.steps
    .filter((step) => step.responseType && step.responseType !== 'none')
    .filter((step) => step.id.startsWith('deeperReflection'))
    .map((step) => (step.prompt || '').trim())
    .filter(Boolean);
  const action = guided.steps.find((step) => step.id === 'actionCommitment');

  return {
    introText: intro?.body ?? undefined,
    thinkPrompt: promptStep?.body ?? undefined,
    instructions: promptStep?.instructions ?? undefined,
    deepenPrompts: deepenPrompts.length > 0 ? deepenPrompts : undefined,
    actionPrompt: action?.prompt ?? undefined,
    confirmationMessage: guided.confirmation?.subtitle ?? undefined,
  };
};

const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
};

export default function GuidedReflectionLessonEditor({
  lesson,
  onChange,
}: {
  lesson: Lesson;
  onChange: (updates: Partial<Lesson>) => void;
}) {
  const guided = useMemo<GuidedReflectionPersisted>(() => {
    const content: any = lesson.content ?? {};
    const persisted = content.guidedReflection ?? content.guided_reflection ?? null;
    if (isRecord(persisted) && Array.isArray((persisted as any).steps)) {
      // Normalize through the learner config normalizer so legacy shapes hydrate safely.
      const normalized = normalizeGuidedReflectionConfig(content);
      return {
        version: 2,
        prompt: normalized.prompt,
        steps: normalized.steps,
        labels: normalized.labels,
        review: normalized.review,
        confirmation: normalized.confirmation,
        requiredResponseStepId: normalized.requiredResponseStepId,
      };
    }
    return buildBasePersisted(lesson);
  }, [lesson]);

  const responseStepIds = guided.steps
    .filter((step) => step.responseType && step.responseType !== 'none')
    .map((step) => step.id);

  const updateGuided = (nextGuided: GuidedReflectionPersisted) => {
    const legacy = deriveLegacyReflectionFields(nextGuided);
    onChange({
      content: {
        ...(lesson.content ?? {}),
        guidedReflection: nextGuided,
        prompt: nextGuided.prompt,
        reflectionPrompt: nextGuided.prompt,
        collectResponse: true,
        allowReflection: true,
        ...legacy,
      } as any,
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Guided Reflection</h4>
          <p className="mt-1 text-sm text-gray-600">
            Edit every learner-facing step, response field, and helper label. Learner drafts/autosave remain intact.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Total steps: {guided.steps.length + 2}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Flow label</label>
          <input
            value={guided.labels?.flowLabel ?? 'Guided Reflection'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                labels: { ...(guided.labels ?? {}), flowLabel: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="e.g., Guided Reflection"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Prompt section label</label>
          <input
            value={guided.labels?.promptSectionLabel ?? 'Reflection prompt'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                labels: { ...(guided.labels ?? {}), promptSectionLabel: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="e.g., Reflection prompt"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Primary reflection prompt</label>
        <textarea
          value={guided.prompt}
          onChange={(event) => updateGuided({ ...guided, prompt: event.target.value })}
          rows={3}
          placeholder="What do you want learners to reflect on?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          This is shown prominently throughout the flow (and supports backward compatibility for older reflection renderers).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Autosave helper</label>
          <input
            value={guided.labels?.autosaveHelperText ?? 'Your reflection autosaves as you move through each step.'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                labels: { ...(guided.labels ?? {}), autosaveHelperText: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Recovered-draft helper</label>
          <input
            value={guided.labels?.draftRecoveredHelperText ?? 'Recovered your latest draft from this device.'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                labels: { ...(guided.labels ?? {}), draftRecoveredHelperText: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Required footer text</label>
          <input
            value={guided.labels?.requiredFooterText ?? 'A prompt response is required before you submit.'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                labels: { ...(guided.labels ?? {}), requiredFooterText: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Optional footer text</label>
          <input
            value={guided.labels?.optionalFooterText ?? 'You can skip optional steps and return later.'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                labels: { ...(guided.labels ?? {}), optionalFooterText: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Required response step</label>
          <select
            value={guided.requiredResponseStepId ?? ''}
            onChange={(event) =>
              updateGuided({
                ...guided,
                requiredResponseStepId: event.target.value ? event.target.value : null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">First response step</option>
            {responseStepIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Determines what the learner must answer before submitting when “Require reflection” is enabled.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-gray-900">Steps</h5>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const newStep: GuidedReflectionStep = {
                  id: `content-${nanoid(8)}`,
                  kind: 'content',
                  title: 'Content Step',
                  body: '',
                  responseType: 'none',
                };
                updateGuided({ ...guided, steps: [...guided.steps, newStep] });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" /> Add content step
            </button>
            <button
              type="button"
              onClick={() => {
                const newStep: GuidedReflectionStep = {
                  id: `response-${nanoid(8)}`,
                  kind: 'response',
                  title: 'Reflection Step',
                  body: '',
                  label: 'Your response',
                  placeholder: 'Write your response here…',
                  responseType: 'textarea',
                };
                updateGuided({ ...guided, steps: [...guided.steps, newStep] });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" /> Add response step
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {guided.steps.map((step, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < guided.steps.length - 1;
            const isResponse = step.responseType && step.responseType !== 'none';
            return (
              <div key={step.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Step {index + 1} • {step.kind || (isResponse ? 'response' : 'content')}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">id: {step.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!canMoveUp) return;
                        updateGuided({ ...guided, steps: moveItem(guided.steps, index, index - 1) });
                      }}
                      disabled={!canMoveUp}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canMoveDown) return;
                        updateGuided({ ...guided, steps: moveItem(guided.steps, index, index + 1) });
                      }}
                      disabled={!canMoveDown}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateGuided({ ...guided, steps: guided.steps.filter((_, i) => i !== index) })}
                      className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"
                      title="Delete step"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kind</label>
                    <select
                      value={step.kind ?? (isResponse ? 'response' : 'content')}
                      onChange={(event) => {
                        const kind = event.target.value as GuidedReflectionStep['kind'];
                        const nextSteps = [...guided.steps];
                        nextSteps[index] = { ...step, kind };
                        updateGuided({ ...guided, steps: nextSteps });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="intro">intro</option>
                      <option value="prompt">prompt</option>
                      <option value="content">content</option>
                      <option value="response">response</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Response type</label>
                    <select
                      value={step.responseType ?? (isResponse ? 'textarea' : 'none')}
                      onChange={(event) => {
                        const responseType = event.target.value as GuidedReflectionStep['responseType'];
                        const nextSteps = [...guided.steps];
                        nextSteps[index] = { ...step, responseType };
                        updateGuided({ ...guided, steps: nextSteps });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="none">none</option>
                      <option value="short_text">short_text</option>
                      <option value="textarea">textarea</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Step title</label>
                    <input
                      value={step.title}
                      onChange={(event) => {
                        const nextSteps = [...guided.steps];
                        nextSteps[index] = { ...step, title: event.target.value };
                        updateGuided({ ...guided, steps: nextSteps });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Body / instructions</label>
                    <textarea
                      value={step.body ?? ''}
                      onChange={(event) => {
                        const nextSteps = [...guided.steps];
                        nextSteps[index] = { ...step, body: event.target.value };
                        updateGuided({ ...guided, steps: nextSteps });
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Learner-facing helper copy for this step..."
                    />
                  </div>

                  {(step.kind === 'prompt' || step.kind === 'response') && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Step prompt (optional override)
                        </label>
                        <textarea
                          value={step.prompt ?? ''}
                          onChange={(event) => {
                            const nextSteps = [...guided.steps];
                            nextSteps[index] = { ...step, prompt: event.target.value };
                            updateGuided({ ...guided, steps: nextSteps });
                          }}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Optional step-specific prompt. Leave blank to use the primary reflection prompt."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Step instructions (optional)</label>
                        <textarea
                          value={step.instructions ?? ''}
                          onChange={(event) => {
                            const nextSteps = [...guided.steps];
                            nextSteps[index] = { ...step, instructions: event.target.value };
                            updateGuided({ ...guided, steps: nextSteps });
                          }}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Optional extra guidance shown under the prompt."
                        />
                      </div>
                    </div>
                  )}

                  {step.responseType && step.responseType !== 'none' && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Field label</label>
                        <input
                          value={step.label ?? ''}
                          onChange={(event) => {
                            const nextSteps = [...guided.steps];
                            nextSteps[index] = { ...step, label: event.target.value };
                            updateGuided({ ...guided, steps: nextSteps });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="e.g., Your reflection"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Placeholder</label>
                        <input
                          value={step.placeholder ?? ''}
                          onChange={(event) => {
                            const nextSteps = [...guided.steps];
                            nextSteps[index] = { ...step, placeholder: event.target.value };
                            updateGuided({ ...guided, steps: nextSteps });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Shown inside the response field"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Helper text (optional)</label>
                        <input
                          value={step.helperText ?? ''}
                          onChange={(event) => {
                            const nextSteps = [...guided.steps];
                            nextSteps[index] = { ...step, helperText: event.target.value };
                            updateGuided({ ...guided, steps: nextSteps });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Optional helper copy shown under the response field"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Review step title</label>
          <input
            value={guided.review?.title ?? 'Review & Submit'}
            onChange={(event) =>
              updateGuided({ ...guided, review: { ...(guided.review ?? {}), title: event.target.value } })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Review step subtitle</label>
          <input
            value={guided.review?.subtitle ?? 'Look back over your reflection before you submit it.'}
            onChange={(event) =>
              updateGuided({ ...guided, review: { ...(guided.review ?? {}), subtitle: event.target.value } })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Empty response text</label>
          <input
            value={guided.review?.emptyResponseText ?? 'No response yet.'}
            onChange={(event) =>
              updateGuided({ ...guided, review: { ...(guided.review ?? {}), emptyResponseText: event.target.value } })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirmation eyebrow</label>
          <input
            value={guided.confirmation?.eyebrow ?? 'Reflection Saved'}
            onChange={(event) =>
              updateGuided({ ...guided, confirmation: { ...(guided.confirmation ?? {}), eyebrow: event.target.value } })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirmation title</label>
          <input
            value={guided.confirmation?.title ?? 'You captured something meaningful.'}
            onChange={(event) =>
              updateGuided({ ...guided, confirmation: { ...(guided.confirmation ?? {}), title: event.target.value } })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirmation subtitle</label>
          <textarea
            value={guided.confirmation?.subtitle ?? 'Reflection saved. Carry one clear insight with you into the next lesson.'}
            onChange={(event) =>
              updateGuided({ ...guided, confirmation: { ...(guided.confirmation ?? {}), subtitle: event.target.value } })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Continue button label</label>
          <input
            value={guided.confirmation?.continueLabel ?? 'Continue learning'}
            onChange={(event) =>
              updateGuided({
                ...guided,
                confirmation: { ...(guided.confirmation ?? {}), continueLabel: event.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
