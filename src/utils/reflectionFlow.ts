export type ReflectionAnswerMap = Record<string, string>;

export type ReflectionResponseData = {
  /**
   * v2 supports arbitrary guided-reflection step ids via `answers`.
   * Legacy fields are still present for backward compatibility and server interop.
   */
  version?: 1 | 2;
  answers?: ReflectionAnswerMap;
  stepOrder?: string[] | null;

  promptResponse: string;
  deeperReflection1: string;
  deeperReflection2: string;
  deeperReflection3: string;
  actionCommitment: string;
  currentStepId?: string | null;
  submittedAt?: string | null;
};

export type ReflectionDraftPayload = {
  data: ReflectionResponseData;
  currentStepId?: string | null;
  updatedAt: string;
  status?: 'draft' | 'submitted' | null;
};

export type GuidedReflectionConfig = {
  prompt: string;
  steps: GuidedReflectionStep[];
  review: {
    title: string;
    subtitle: string;
    emptyResponseText: string;
  };
  confirmation: {
    eyebrow: string;
    title: string;
    subtitle: string;
    continueLabel: string;
  };
  labels: {
    flowLabel: string;
    promptSectionLabel: string;
    autosaveHelperText: string;
    draftRecoveredHelperText: string;
    requiredFooterText: string;
    optionalFooterText: string;
  };
  requiredResponseStepId: string | null;
};

export type GuidedReflectionStep = {
  id: string;
  /**
   * Used for premium layouts of the first few steps.
   * Unknown values are treated as generic content/response steps.
   */
  kind?: 'intro' | 'prompt' | 'content' | 'response';
  title: string;
  body: string;
  prompt?: string;
  instructions?: string;
  label?: string;
  helperText?: string;
  placeholder?: string;
  responseType?: 'textarea' | 'short_text' | 'none';
};

const DEFAULT_DEEPEN_PROMPTS = [
  'What experiences shaped this perspective?',
  'Where have you seen this in your environment?',
  'What might others experience differently?',
];

export const createEmptyReflectionResponseData = (): ReflectionResponseData => ({
  version: 2,
  answers: {},
  stepOrder: null,
  promptResponse: '',
  deeperReflection1: '',
  deeperReflection2: '',
  deeperReflection3: '',
  actionCommitment: '',
  currentStepId: 'intro',
  submittedAt: null,
});

const normalizeAnswerMap = (value: unknown): ReflectionAnswerMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: ReflectionAnswerMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) out[key] = trimmed;
    }
  }
  return out;
};

const LEGACY_FIELD_IDS: Array<keyof Pick<
  ReflectionResponseData,
  'promptResponse' | 'deeperReflection1' | 'deeperReflection2' | 'deeperReflection3' | 'actionCommitment'
>> = ['promptResponse', 'deeperReflection1', 'deeperReflection2', 'deeperReflection3', 'actionCommitment'];

const buildAnswersFromLegacy = (data: Partial<ReflectionResponseData>): ReflectionAnswerMap => {
  const out: ReflectionAnswerMap = {};
  for (const key of LEGACY_FIELD_IDS) {
    const value = typeof data[key] === 'string' ? (data[key] as string).trim() : '';
    if (value) out[key] = value;
  }
  return out;
};

export const normalizeReflectionResponseData = (value: unknown): ReflectionResponseData => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const normalizedAnswers = normalizeAnswerMap(record.answers);
  const stepOrder = Array.isArray(record.stepOrder)
    ? (record.stepOrder.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean) as string[])
    : Array.isArray(record.step_order)
    ? (record.step_order.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean) as string[])
    : null;

  const promptResponse =
    typeof record.promptResponse === 'string'
      ? record.promptResponse
      : typeof record.prompt_response === 'string'
      ? record.prompt_response
      : typeof normalizedAnswers.promptResponse === 'string'
      ? normalizedAnswers.promptResponse
      : '';

  const deeperReflection1 =
    typeof record.deeperReflection1 === 'string'
      ? record.deeperReflection1
      : typeof record.deeper_reflection_1 === 'string'
      ? record.deeper_reflection_1
      : typeof normalizedAnswers.deeperReflection1 === 'string'
      ? normalizedAnswers.deeperReflection1
      : '';

  const deeperReflection2 =
    typeof record.deeperReflection2 === 'string'
      ? record.deeperReflection2
      : typeof record.deeper_reflection_2 === 'string'
      ? record.deeper_reflection_2
      : typeof normalizedAnswers.deeperReflection2 === 'string'
      ? normalizedAnswers.deeperReflection2
      : '';

  const deeperReflection3 =
    typeof record.deeperReflection3 === 'string'
      ? record.deeperReflection3
      : typeof record.deeper_reflection_3 === 'string'
      ? record.deeper_reflection_3
      : typeof normalizedAnswers.deeperReflection3 === 'string'
      ? normalizedAnswers.deeperReflection3
      : '';

  const actionCommitment =
    typeof record.actionCommitment === 'string'
      ? record.actionCommitment
      : typeof record.action_commitment === 'string'
      ? record.action_commitment
      : typeof normalizedAnswers.actionCommitment === 'string'
      ? normalizedAnswers.actionCommitment
      : '';

  return {
    version: record.version === 2 ? 2 : 1,
    answers: {
      ...buildAnswersFromLegacy({ promptResponse, deeperReflection1, deeperReflection2, deeperReflection3, actionCommitment }),
      ...normalizedAnswers,
    },
    stepOrder,
    promptResponse,
    deeperReflection1,
    deeperReflection2,
    deeperReflection3,
    actionCommitment,
    currentStepId:
      typeof record.currentStepId === 'string'
        ? record.currentStepId
        : typeof record.current_step_id === 'string'
        ? record.current_step_id
        : 'intro',
    submittedAt:
      typeof record.submittedAt === 'string'
        ? record.submittedAt
        : typeof record.submitted_at === 'string'
        ? record.submitted_at
        : null,
  };
};

export const normalizeGuidedReflectionConfig = (content: Record<string, unknown> | null | undefined): GuidedReflectionConfig => {
  const record = content && typeof content === 'object' ? (content as Record<string, unknown>) : {};
  const guided = (record.guidedReflection && typeof record.guidedReflection === 'object')
    ? (record.guidedReflection as Record<string, unknown>)
    : (record.guided_reflection && typeof record.guided_reflection === 'object')
    ? (record.guided_reflection as Record<string, unknown>)
    : null;

  const flowLabel =
    (guided && typeof guided.flowLabel === 'string' && guided.flowLabel.trim()) ||
    (typeof record.flowLabel === 'string' && record.flowLabel.trim()) ||
    'Guided Reflection';

  const prompt =
    (guided && typeof guided.prompt === 'string' && guided.prompt.trim()) ||
    (typeof record.prompt === 'string' && record.prompt.trim()) ||
    (typeof record.reflectionPrompt === 'string' && record.reflectionPrompt.trim()) ||
    'Take a moment to reflect on this lesson.';

  const instructions =
    (guided && typeof guided.instructions === 'string' && guided.instructions.trim()) ||
    (typeof record.instructions === 'string' && record.instructions.trim()) ||
    (typeof record.description === 'string' && record.description.trim()) ||
    '';

  const introText =
    (guided && typeof guided.introText === 'string' && guided.introText.trim()) ||
    (typeof record.introText === 'string' && record.introText.trim()) ||
    (typeof record.intro_text === 'string' && (record.intro_text as string).trim()) ||
    'Create a quiet moment for yourself. This reflection will guide you step by step.';

  const thinkPrompt =
    (guided && typeof guided.thinkPrompt === 'string' && guided.thinkPrompt.trim()) ||
    (typeof record.thinkPrompt === 'string' && record.thinkPrompt.trim()) ||
    (typeof record.think_prompt === 'string' && (record.think_prompt as string).trim()) ||
    'Pause for a breath. Notice what is coming up before you begin writing.';

  const deepenPrompts = (() => {
    const raw =
      (guided && (guided.deepenPrompts ?? guided.deepen_prompts)) ??
      record.deepenPrompts ??
      record.deepen_prompts ??
      [];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  })();

  const actionPrompt =
    (guided && typeof guided.actionPrompt === 'string' && guided.actionPrompt.trim()) ||
    (typeof record.actionPrompt === 'string' && record.actionPrompt.trim()) ||
    (typeof record.action_prompt === 'string' && (record.action_prompt as string).trim()) ||
    'What is one action you can take moving forward?';

  const confirmationMessage =
    (guided && typeof guided.confirmationMessage === 'string' && guided.confirmationMessage.trim()) ||
    (typeof record.confirmationMessage === 'string' && record.confirmationMessage.trim()) ||
    (typeof record.confirmation_message === 'string' && (record.confirmation_message as string).trim()) ||
    'Reflection saved. Carry one clear insight with you into the next lesson.';

  const labelsSource =
    guided && typeof guided.labels === 'object' && guided.labels && !Array.isArray(guided.labels)
      ? (guided.labels as Record<string, unknown>)
      : typeof record.labels === 'object' && record.labels && !Array.isArray(record.labels)
      ? (record.labels as Record<string, unknown>)
      : {};

  const autosaveHelperText =
    typeof labelsSource.autosaveHelperText === 'string' && labelsSource.autosaveHelperText.trim()
      ? labelsSource.autosaveHelperText.trim()
      : 'Your reflection autosaves as you move through each step.';
  const draftRecoveredHelperText =
    typeof labelsSource.draftRecoveredHelperText === 'string' && labelsSource.draftRecoveredHelperText.trim()
      ? labelsSource.draftRecoveredHelperText.trim()
      : 'Recovered your latest draft from this device.';
  const promptSectionLabel =
    typeof labelsSource.promptSectionLabel === 'string' && labelsSource.promptSectionLabel.trim()
      ? labelsSource.promptSectionLabel.trim()
      : 'Reflection prompt';
  const requiredFooterText =
    typeof labelsSource.requiredFooterText === 'string' && labelsSource.requiredFooterText.trim()
      ? labelsSource.requiredFooterText.trim()
      : 'A prompt response is required before you submit.';
  const optionalFooterText =
    typeof labelsSource.optionalFooterText === 'string' && labelsSource.optionalFooterText.trim()
      ? labelsSource.optionalFooterText.trim()
      : 'You can skip optional steps and return later.';

  const reviewSource =
    guided && typeof guided.review === 'object' && guided.review && !Array.isArray(guided.review)
      ? (guided.review as Record<string, unknown>)
      : {};

  const confirmationSource =
    guided && typeof guided.confirmation === 'object' && guided.confirmation && !Array.isArray(guided.confirmation)
      ? (guided.confirmation as Record<string, unknown>)
      : {};

  const requiredResponseStepId =
    (guided && typeof guided.requiredResponseStepId === 'string' && guided.requiredResponseStepId.trim()) ||
    (typeof record.requiredResponseStepId === 'string' && record.requiredResponseStepId.trim()) ||
    null;

  const normalizedSteps: GuidedReflectionStep[] = (() => {
    const rawSteps = guided && Array.isArray(guided.steps) ? guided.steps : null;
    if (rawSteps) {
      return rawSteps
        .map((step: any, index: number) => {
          const rawId = typeof step?.id === 'string' && step.id.trim().length > 0 ? step.id.trim() : `step-${index + 1}`;
          const id = rawId === 'review' || rawId === 'confirmation' ? `custom-${rawId}-${index + 1}` : rawId;
          const title = typeof step?.title === 'string' ? step.title.trim() : '';
          const body = typeof step?.body === 'string' ? step.body.trim() : '';
          const kindRaw = typeof step?.kind === 'string' ? step.kind.trim() : '';
          const kind = (kindRaw === 'intro' || kindRaw === 'prompt' || kindRaw === 'content' || kindRaw === 'response') ? kindRaw : undefined;
          const responseTypeRaw = typeof step?.responseType === 'string' ? step.responseType.trim() : '';
          const responseType =
            responseTypeRaw === 'short_text' || responseTypeRaw === 'textarea'
              ? responseTypeRaw
              : responseTypeRaw === 'none'
              ? 'none'
              : undefined;
          return {
            id,
            kind,
            title: title || `Step ${index + 1}`,
            body,
            prompt: typeof step?.prompt === 'string' ? step.prompt : undefined,
            instructions: typeof step?.instructions === 'string' ? step.instructions : undefined,
            label: typeof step?.label === 'string' ? step.label : undefined,
            helperText: typeof step?.helperText === 'string' ? step.helperText : undefined,
            placeholder: typeof step?.placeholder === 'string' ? step.placeholder : undefined,
            responseType,
          } satisfies GuidedReflectionStep;
        })
        .filter((step) => step.title.trim().length > 0);
    }

    const resolvedDeepen = deepenPrompts.length > 0 ? deepenPrompts : DEFAULT_DEEPEN_PROMPTS.slice(0, 2);
    const deepenSteps = resolvedDeepen.map((promptText, index) => {
      const id = `deeperReflection${index + 1}`;
      return {
        id,
        kind: 'response',
        title: 'Deepen Your Reflection',
        body: 'Stay curious. Let the next layer come into focus.',
        prompt: promptText,
        placeholder: 'Write a deeper reflection here...',
        responseType: 'textarea',
      } satisfies GuidedReflectionStep;
    });

    return [
      {
        id: 'intro',
        kind: 'intro',
        title: 'Settle In',
        body: introText,
        responseType: 'none',
      },
      {
        id: 'prompt',
        kind: 'prompt',
        title: 'Reflection Prompt',
        body: thinkPrompt,
        prompt,
        instructions,
        responseType: 'none',
      },
      {
        id: 'promptResponse',
        kind: 'response',
        title: 'Your Initial Thoughts',
        body: 'Start with what feels most true right now.',
        label: 'Your reflection',
        placeholder: 'Take a moment to reflect and write your thoughts here...',
        responseType: 'textarea',
      },
      ...deepenSteps,
      {
        id: 'actionCommitment',
        kind: 'response',
        title: 'Turn Insight Into Action',
        body: 'Name one practical step you can carry forward.',
        prompt: actionPrompt,
        placeholder: 'Describe one action you can take moving forward...',
        responseType: 'textarea',
      },
    ];
  })() as GuidedReflectionStep[];

  const firstResponseStepId =
    normalizedSteps.find((step) => step.responseType && step.responseType !== 'none')?.id ?? null;

  return {
    prompt,
    steps: normalizedSteps,
    review: {
      title:
        typeof reviewSource.title === 'string' && reviewSource.title.trim()
          ? reviewSource.title.trim()
          : 'Review & Submit',
      subtitle:
        typeof reviewSource.subtitle === 'string' && reviewSource.subtitle.trim()
          ? reviewSource.subtitle.trim()
          : 'Look back over your reflection before you submit it.',
      emptyResponseText:
        typeof reviewSource.emptyResponseText === 'string' && reviewSource.emptyResponseText.trim()
          ? reviewSource.emptyResponseText.trim()
          : 'No response yet.',
    },
    confirmation: {
      eyebrow:
        typeof confirmationSource.eyebrow === 'string' && confirmationSource.eyebrow.trim()
          ? confirmationSource.eyebrow.trim()
          : 'Reflection Saved',
      title:
        typeof confirmationSource.title === 'string' && confirmationSource.title.trim()
          ? confirmationSource.title.trim()
          : 'You captured something meaningful.',
      subtitle:
        typeof confirmationSource.subtitle === 'string' && confirmationSource.subtitle.trim()
          ? confirmationSource.subtitle.trim()
          : confirmationMessage,
      continueLabel:
        typeof confirmationSource.continueLabel === 'string' && confirmationSource.continueLabel.trim()
          ? confirmationSource.continueLabel.trim()
          : 'Continue learning',
    },
    labels: {
      flowLabel,
      promptSectionLabel,
      autosaveHelperText,
      draftRecoveredHelperText,
      requiredFooterText,
      optionalFooterText,
    },
    requiredResponseStepId: requiredResponseStepId ?? firstResponseStepId,
  };
};

export const buildReflectionDraftStorageKey = (courseId: string, lessonId: string, learnerId: string) =>
  `reflection-draft:${courseId}:${lessonId}:${learnerId}`;

export const summarizeReflectionResponse = (data: ReflectionResponseData, stepOrder?: string[] | null): string => {
  const answers: ReflectionAnswerMap = {
    ...buildAnswersFromLegacy(data),
    ...(data.answers ?? {}),
  };
  const orderedKeys = Array.isArray(stepOrder) && stepOrder.length > 0
    ? stepOrder
    : Array.isArray(data.stepOrder) && data.stepOrder.length > 0
    ? (data.stepOrder as string[])
    : LEGACY_FIELD_IDS;
  const seen = new Set<string>();
  const values: string[] = [];
  for (const key of orderedKeys) {
    if (!key) continue;
    seen.add(key);
    const value = typeof answers[key] === 'string' ? answers[key].trim() : '';
    if (value) values.push(value);
  }
  for (const key of Object.keys(answers)) {
    if (seen.has(key)) continue;
    const value = typeof answers[key] === 'string' ? answers[key].trim() : '';
    if (value) values.push(value);
  }
  return values.join('\n\n');
};
